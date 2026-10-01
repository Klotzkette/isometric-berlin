import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/zooGroundsV165Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

type P = [number, number, number];
type Sheet = { color: number; triangles: number[][][] };
export const ZOO_GROUNDS_V165_GROUP = "Zoo Berlin measured animal houses and mapped grounds";
export const ZOO_GROUNDS_V165_NATIVE_GROUP = "Zoo Berlin independent native animal houses and habitats";

function batch(rows: number[][],glass=false): InstancedMesh {
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("normal");geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff,transparent:glass,opacity:glass?.17:1,depthWrite:!glass});
  const night=new MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true,transparent:glass,opacity:glass?.17:1,depthWrite:!glass});
  const mesh=new InstancedMesh(geometry,day,0),m=new Matrix4(),c=new Color();
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  rows.forEach((r,i)=>{m.makeRotationY(r[6]);m.scale(new Vector3(r[3],r[4],r[5]));m.setPosition(r[0],r[1],r[2]);m.toArray(matrices,i*16);c.setHex(r[7]).toArray(colors,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
}
function sheets(rows: readonly Sheet[],glass=false): Mesh {
  const positions:number[]=[],colors:number[]=[],c=new Color();
  for(const s of rows){c.setHex(s.color);for(const tri of s.triangles)for(const p of tri){positions.push(...p);colors.push(c.r,c.g,c.b);}}
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("color",new Float32BufferAttribute(colors,3));
  const params={vertexColors:true,side:DoubleSide,transparent:glass,opacity:glass?.26:1,depthWrite:!glass};
  const day=new MeshBasicMaterial(params),night=new MeshStandardMaterial({...params,roughness:glass?.3:.9,flatShading:true});
  const mesh=new Mesh(g,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};g.computeBoundingBox();g.computeBoundingSphere();return mesh;
}
class Details {
  boxes:number[][]=[];surfaces:Sheet[]=[];
  constructor(readonly native:boolean){}
  box(c:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0):void {
    if(!this.native||yaw===0){this.boxes.push([x,y,z,w,h,d,yaw,c]);return;}
    const n=Math.ceil(w/.65),m=Math.ceil(d/.65);
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const u=(i+.5)*w/n-w/2,v=(j+.5)*d/m-d/2;this.boxes.push([x+Math.cos(yaw)*u+Math.sin(yaw)*v,y,z-Math.sin(yaw)*u+Math.cos(yaw)*v,w/n,h,d/m,0,c]);}
  }
  line(c:number,a:P,b:P,width=.08):void {
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
    if(Math.abs(dy)<.000001){this.box(c,(a[0]+b[0])/2,a[1],(a[2]+b[2])/2,length,width,width,Math.atan2(-dz,dx));return;}
    if(this.native){const n=Math.ceil(length/.5);for(let i=0;i<=n;i++)this.box(c,a[0]+dx*i/n,a[1]+dy*i/n,a[2]+dz*i/n,Math.max(width,Math.abs(dx)/n),Math.max(width,Math.abs(dy)/n),Math.max(width,Math.abs(dz)/n));return;}
    const axis=new Vector3(dx,dy,dz).normalize(),u=new Vector3().crossVectors(axis,Math.abs(axis.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0)).normalize().multiplyScalar(width/2),v=new Vector3().crossVectors(axis,u).normalize().multiplyScalar(width/2);
    const corners=(p:P):P[]=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>new Vector3(...p).addScaledVector(u,i).addScaledVector(v,j).toArray() as P);
    const first=corners(a),last=corners(b);this.face(c,first);this.face(c,last);for(let i=0;i<4;i++)this.face(c,[first[i],first[(i+1)%4],last[(i+1)%4],last[i]]);
  }
  face(c:number,ring:P[]):void {this.surfaces.push({color:c,triangles:ring.slice(1,-1).map((p,i)=>[ring[0],p,ring[i+2]])});}
}

function fence(d:Details,line:number[][],height:number,kind="fence"):void {
  for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.1)continue;
    if(kind==="wall"||kind==="hedge") {d.box(kind==="wall"?0x9b9884:0x3f6546,(a[0]+b[0])/2,5.2+height/2,(a[1]+b[1])/2,length,height,kind==="wall"?.35:.65,Math.atan2(a[1]-b[1],b[0]-a[0]));continue;}
    for(const h of [.35,height*.64,height])d.line(0x4a5952,[a[0],5.2+h,a[1]],[b[0],5.2+h,b[1]],.045);
    const n=Math.max(1,Math.ceil(length/2.5));for(let j=0;j<n;j++)d.box(0x414d47,a[0]+(b[0]-a[0])*j/n,5.2+height/2,a[1]+(b[1]-a[1])*j/n,.09,height,.09);
  }
}
function animal(d:Details,x:number,y:number,z:number,kind:"ibex"|"takin"|"tahr"|"condor",yaw=0):void {
  const at=(u:number,h:number,v:number):P=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,y+h,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
  if(kind==="condor"){
    d.box(0x292b29,...at(0,.18,0),.95,.3,.4,yaw);d.box(0x373331,...at(.48,.39,0),.25,.25,.19,yaw);
    d.box(0xe1dbc5,...at(.32,.3,0),.15,.27,.28,yaw);
    for(const side of [-1,1]){d.line(0x33322e,at(-.1,.24,0),at(-.42,.21,side*1.2),.18);d.line(0xa79e81,at(-.12,.2,side*.3),at(-.32,.16,side*.85),.07);}
    return;
  }
  const color=kind==="takin"?0xbba477:kind==="tahr"?0x84624c:0x8d7a62,size=kind==="takin"?1.25:1;
  d.box(color,...at(0,.82*size,0),1.22*size,.62*size,.49*size,yaw);
  d.box(color,...at(.56*size,1.05*size,0),.36*size,.52*size,.32*size,yaw);
  for(const u of[-.42,.43])for(const v of[-.2,.2])d.line(color,at(u*size,.65*size,v*size),at((u+.06)*size,.05,v*size),.1*size);
  d.line(0x493d2d,at(.63*size,.96*size,0),at(.55*size,.55*size,0),.12);
  for(const side of[-1,1]){const n=12;let previous=at(.55*size,1.29*size,side*.11*size);for(let i=1;i<=n;i++){const t=i/n;const p=at((.55-.75*t)*size,(1.29+.65*Math.sin(t*Math.PI*.9))*size,side*(.11+.17*t)*size);d.line(0xb4a587,previous,p,.065);previous=p;}}
}
function mountain(d:Details,identity:string,height:number,kind:"ibex"|"takin"|"tahr"):void {
  const habitat=source.habitats.find(h=>h.id===identity)!;const ring=habitat.ring as unknown as WorldRing;
  const minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  const h=(x:number,z:number)=>{const q=Math.max(0,1-Math.hypot((x-cx)/((maxX-minX)*.57),(z-cz)/((maxZ-minZ)*.57)));return 5.39+height*Math.pow(q,.38)*(1+.08*Math.sin(x*.42+z*.23));};
  const step=d.native?1:2.1;
  const validCell=(x:number,z:number)=>[[x,z],[x+step,z],[x+step,z+step],[x,z+step]].every(p=>pointInWorldRing(p[0],p[1],ring));
  for(let x=minX;x<maxX;x+=step)for(let z=minZ;z<maxZ;z+=step){
    const ps:[[number,number],[number,number],[number,number],[number,number]]=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]];
    if(!ps.every(p=>pointInWorldRing(p[0],p[1],ring)))continue;
    const y=h(x+step/2,z+step/2),color=0xbab7aa;
    const neighbors=[[x,z-step],[x+step,z],[x,z+step],[x-step,z]];
    if(d.native){const lower=Math.min(y-1,...neighbors.map(([a,b])=>validCell(a,b)?h(a+step/2,b+step/2)-.5:5.38));d.box(color,x+step/2,(y+lower)/2,z+step/2,step,y-lower,step);}
    else {
      const points=ps.map(p=>[p[0],h(...p),p[1]] as P);d.face(color,points);
      if(Math.floor(z/step)%3===0)d.line(0xa4a296,points[0],points[1],.055);
      for(let i=0;i<4;i++){
        const a=ps[i],b=ps[(i+1)%4],neighbor=neighbors[i];
        if(!validCell(neighbor[0],neighbor[1]))d.face(0xb3afa1,[points[i],points[(i+1)%4],[b[0],5.38,b[1]],[a[0],5.38,a[1]]]);
      }
    }
  }
  for(const [dx,dz,yaw] of [[-3,2,.1],[2,-3,2.3],[5,3,-.8]]){const x=cx+dx,z=cz+dz;if(pointInWorldRing(x,z,ring))animal(d,x,h(x,z)+.12,z,kind,yaw);}
}
function aviary(d:Details,identity:string,height:number):void {
  const habitat=source.habitats.find(h=>h.id===identity)!;
  const profile=source.parts.find(p=>p.osm===identity);
  const ring=(profile?.ring??habitat.ring) as unknown as WorldRing;
  if(profile)height=profile.top_y_m-5.2;
  const roofs=profile?source.surfaces.filter(s=>s.partId===profile.id&&s.kind==="RoofSurface").flatMap(s=>s.triangles):[];
  const roofAt=(x:number,z:number):number=>{let best=5.2+height*.8;for(const [a,b,c] of roofs){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u>=-.0001&&v>=-.0001&&u+v<=1.0001)best=u*a[1]+v*b[1]+(1-u-v)*c[1];}return roofs.length?best:5.2+height;};
  const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
  fence(d,[...habitat.ring,habitat.ring[0]],2.3);
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(length/2.4));
    for(let j=0;j<n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n,top=roofAt(x,z);d.line(0x667069,[x,5.2,z],[x,top,z],j===0?.12:.022);d.line(0x68746b,[x,top,z],[cx,roofAt(cx,cz),cz],.026);}
    for(const h of[3,6,9])if(h<height)d.line(0x6a756c,[a[0],5.2+h,a[1]],[b[0],5.2+h,b[1]],.025);
  }
  if(identity==="32995989")for(const [dx,dz,yaw] of [[-4,-1,.4],[4,5,2.1]]){d.line(0x685444,[cx+dx,5.4,cz+dz],[cx+dx+1,8.1,cz+dz],.23);d.line(0x685444,[cx+dx-.9,8.1,cz+dz],[cx+dx+1.8,8.1,cz+dz],.17);animal(d,cx+dx,8.2,cz+dz,"condor",yaw);}
}
function sign(d:Details,text:string,x:number,y:number,z:number,width:number,height:number,yaw:number,color:number):void {
  const letters=letteringStrokePaths(text,height),xs=letters.flatMap(path=>path.map(p=>p[0])),min=Math.min(...xs),max=Math.max(...xs),scale=Math.min(1,width/(max-min));
  for(const stroke of letters)for(let i=1;i<stroke.length;i++){
    const at=(p:number[]):P=>{const u=(p[0]-(min+max)/2)*scale;return[x+Math.cos(yaw)*u,y+p[1]*scale,z-Math.sin(yaw)*u];};
    d.line(color,at(stroke[i-1]),at(stroke[i]),.055);
  }
}
function beerGarden(d:Details):void {
  for(const [x,z] of source.schleusenkrugTables){
    d.box(0xc3a26a,x,6.2,z,1.5,.07,.72);for(const u of[-.58,.58])d.box(0x405c4a,x+u,5.84,z,.06,.73,.58);
    for(const side of[-1,1]){d.box(0xbb975f,x,5.9,z+side*.82,1.5,.07,.27);for(const u of[-.56,.56])d.box(0x405c4a,x+u,5.66,z+side*.82,.055,.45,.2);}
  }
  const yaw=-.397;
  d.box(0xdfdcc8,-2423.65,13.53,797.38,13.5,1.35,.14,yaw);
  sign(d,"SCHLEUSENKRUG",-2423.7,13.04,797.52,12.9,.93,yaw,0xb74d3c);
}

function birdhouse(d:Details):void {
  const loop=source.parts.find(p=>p.id.endsWith("WINsha0OLq"))!;
  const ring=loop.ring;
  // Measured clover-leaf perimeter: the cage rails follow the source loop,
  // not a circle, rectangle or a traced architect's plan.
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    d.line(0x4d5851,[a[0],9.32,a[1]],[b[0],9.32,b[1]],.065);
    if(i%3===0||len>3)d.line(0x525c52,[a[0],5.3,a[1]],[a[0],9.32,a[1]],.08);
  }
  if(!d.native){const seen=new Set<string>();for(const surface of source.surfaces.filter(s=>s.partId===loop.id&&s.kind==="RoofSurface"))for(const tri of surface.triangles)for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=[a.join(","),b.join(",")].sort().join(";");if(seen.has(key))continue;seen.add(key);d.line(0x647368,[a[0],a[1]+.035,a[2]],[b[0],b[1]+.035,b[2]],.022);}}
  // West entrance of the measured high brick core.
  d.box(0x41615b,-2410.2,8.2,911.8,.16,5.5,7.3);
  for(const z of[908.2,910.6,913,915.4])d.box(0xa28f5c,-2410.31,8.2,z,.14,5.5,.07);
  d.box(0xa28f5c,-2410.31,8.2,911.8,.14,.075,7.3);
  sign(d,"WELT DER VÖGEL",-2410.4,12,911.8,8.4,.59,Math.PI/2,0x8f7955);
}

function create(native:boolean):Group {
  const group=new Group();group.name=native?ZOO_GROUNDS_V165_NATIVE_GROUP:ZOO_GROUNDS_V165_GROUP;
  const details=new Details(native);
  if(native)for(const r of source.facadeBoxes)details.box(r[7],r[0],r[1],r[2],r[3],r[4],r[5],r[6]);
  for(const b of source.barriers)fence(details,b.line,Math.min(4,b.height),b.kind);
  mountain(details,"25036813",10.5,"ibex");mountain(details,"25036814",9.8,"takin");mountain(details,"49896121",7.8,"tahr");
  aviary(details,"32995989",21.2);aviary(details,"32995991",23.9);aviary(details,"618256710",8.8);aviary(details,"48374319",7.5);
  beerGarden(details);birdhouse(details);
  if(native){
    const rows=[...source.nativeRows.filter(r=>r[6]!==0x758c86),...source.groundRuns].map(r=>[r[0],r[1],r[2],r[3],r[4],r[5],0,r[6]]);
    const model=batch(rows);model.name="Zoo retained native house shells and ground rows";group.add(model);
    const props=batch(details.boxes);props.name="Zoo native aviaries climbing rocks and furniture";group.add(props);
    const glass=batch(source.nativeRows.filter(r=>r[6]===0x758c86).map(r=>[r[0],r[1],r[2],r[3],r[4],r[5],0,r[6]]),true);glass.name="Zoo native transparent aviary shell blocks";group.add(glass);
  }else{
    const opaque=sheets(source.surfaces.filter(s=>!s.glass));opaque.name="Zoo complete official animal-house walls and roofs";group.add(opaque);
    const transparent=sheets(source.surfaces.filter(s=>s.glass),true);transparent.name="Zoo glass hippo house and birdhouse aviary shell";group.add(transparent);
    const facade=batch(source.facadeBoxes);facade.name="Zoo source-clipped facade windows";group.add(facade);
    const ground=sheets(source.groundSurfaces);ground.name="Zoo exact mapped paths ponds and habitat grounds";group.add(ground);
    const boxes=batch(details.boxes);boxes.name="Zoo structural posts rails and garden furniture";group.add(boxes);
    const rocks=sheets(details.surfaces);rocks.name="Zoo climbing cliffs aviary rods and animals";group.add(rocks);
  }
  group.userData={fullStaticDetailOnTouch:true,textureFree:true,sourceBound:true,sourceHouseParts:source.parts.length,mappedHabitats:source.habitats.length,mappedPaths:source.paths.length,mappedPonds:source.waters.length,schleusenkrugTables:source.schleusenkrugTables.length,condorAviary:"way/32995989",mountainHabitats:["25036813","25036814","49896121"],polarFoxStatus:source.polarFoxStatus,native};
  freezeStaticSceneTransforms(group);return group;
}
export function createZooGroundsV165():Group {return create(false);}
export function createMinecraftZooGroundsV165():Group {return create(true);}
