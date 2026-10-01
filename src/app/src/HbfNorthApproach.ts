import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HBF_NORTH_APPROACH_SOURCE as source, hbfNorthPointInRing, hbfNorthRailFloorAt } from './HbfNorthApproachProfile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
type Point=readonly number[];
type Vec=[number,number,number];
const UP=new Vector3(0,1,0),FORWARD=new Vector3(0,0,1);
class Parts {
  matrices:number[]=[];colors:number[]=[];plates:BufferGeometry[]=[];
  constructor(readonly native:boolean){}
  box(p:Vec,size:Vec,tint:number,yaw=0):void{
    new Matrix4().compose(new Vector3(...p),new Quaternion().setFromAxisAngle(UP,yaw),new Vector3(...size)).toArray(this.matrices,this.matrices.length);
    new Color(tint).toArray(this.colors,this.colors.length);
  }
  beam(a:Vec,b:Vec,width:number,height:number,tint:number):void{
    const dx=b[0]-a[0],dz=b[2]-a[2],run=Math.hypot(dx,dz);if(run<.001)return;
    if(this.native){
      const count=Math.ceil(run/Math.max(.4,Math.min(1.5,width)));
      for(let i=0;i<count;i++){const t=(i+.5)/count;this.box([a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t],[Math.max(width,run/count),height,Math.max(width,run/count)],tint);}
    }else{
      const direction=new Vector3(...b).sub(new Vector3(...a));
      new Matrix4().compose(new Vector3(...a).add(new Vector3(...b)).multiplyScalar(.5),new Quaternion().setFromUnitVectors(FORWARD,direction.clone().normalize()),new Vector3(width,height,direction.length())).toArray(this.matrices,this.matrices.length);
      new Color(tint).toArray(this.colors,this.colors.length);
    }
  }
  polygon(ring:Point[],holes:Point[][],height:(x:number,z:number)=>number,tint:number):void{
    if(this.native){
      const minX=Math.floor(Math.min(...ring.map(p=>p[0]))/2)*2,maxX=Math.max(...ring.map(p=>p[0]));
      const minZ=Math.floor(Math.min(...ring.map(p=>p[1]))/2)*2,maxZ=Math.max(...ring.map(p=>p[1]));
      for(let x=minX;x<maxX;x+=2)for(let z=minZ;z<maxZ;z+=2)if(hbfNorthPointInRing(x+1,z+1,ring)&&!holes.some(r=>hbfNorthPointInRing(x+1,z+1,r)))this.box([x+1,height(x+1,z+1)-.12,z+1],[2,.24,2],tint);
      return;
    }
    const shape=new Shape();ring.forEach((p,i)=>i?shape.lineTo(p[0],-p[1]):shape.moveTo(p[0],-p[1]));
    for(const hole of holes){const path=new Path();hole.forEach((p,i)=>i?path.lineTo(p[0],-p[1]):path.moveTo(p[0],-p[1]));shape.holes.push(path);}
    const g=new ShapeGeometry(shape);g.deleteAttribute('uv');g.rotateX(-Math.PI/2);
    const position=g.getAttribute('position'),c=new Color(tint),colors=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++){position.setY(i,height(position.getX(i),position.getZ(i)));c.toArray(colors,i*3);}
    g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();this.plates.push(g);
  }
  finish(root:Group):void{
    const day=new MeshBasicMaterial({color:0xffffff,side:DoubleSide});const night=new MeshStandardMaterial({color:0xffffff,side:DoubleSide,roughness:.96});
    if(this.colors.length){const geo=new BoxGeometry();geo.deleteAttribute('uv');const mesh=new InstancedMesh(geo,day,0);mesh.count=this.colors.length/3;mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(this.matrices),16);mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(this.colors),3);mesh.name='North rail concrete, rails, catenary and park furniture';mesh.userData={dayMaterial:day,nightMaterial:night,sourceBound:true,blockNative:this.native,textureFree:true};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);}
    if(this.plates.length){const g=mergeGeometries(this.plates,false);for(const p of this.plates)p.dispose();if(g){const a=day.clone(),b=night.clone();a.vertexColors=true;b.vertexColors=true;const mesh=new Mesh(g,a);mesh.name='Source-bound open-cut floor and Döberitzer path surfaces';mesh.userData={dayMaterial:a,nightMaterial:b,sourceBound:true,textureFree:true};root.add(mesh);}}
  }
}
function ribbon(parts:Parts,points:Point[],width:number,height:(x:number,z:number)=>number,color:number):void{
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.01)continue;
    const nx=-dz/length*width/2,nz=dx/length*width/2,n=Math.ceil(length/8);
    for(let k=0;k<n;k++){const p=[a[0]+dx*k/n,a[1]+dz*k/n],q=[a[0]+dx*(k+1)/n,a[1]+dz*(k+1)/n];parts.polygon([[p[0]+nx,p[1]+nz],[q[0]+nx,q[1]+nz],[q[0]-nx,q[1]-nz],[p[0]-nx,p[1]-nz]],[],height,color);}
  }
}
/** Exact source horizontal geometry; height/sections remain documented estimates. */
export function createHbfNorthApproach(terrainAt:(x:number,z:number)=>number,native=false):Group{
  const root=new Group();root.name=native?'Minecraft Hauptbahnhof north rail portals and Döberitzer Grünzug':'Hauptbahnhof north rail portals and Döberitzer Grünzug';
  root.userData={sourceBound:true,sourceUrl:source.source_url,sourceSha256:source.source_sha256,fullStaticDetailOnTouch:true,keepInMinecraft:native,blockNative:native,textureFree:true,geometryStatus:source.geometry_status};
  const parts=new Parts(native),concrete=0xaaa99c,rail=0x65625b,iron=0x66726b;
  // Use the mapped park envelope and its complete maintained path node chains.
  for(const park of source.park_render_polygons)parts.polygon(park.ring,park.holes,(x,z)=>terrainAt(x,z)+.11,0x889b66);
  for(const path of source.paths){
    ribbon(parts,path.points,path.width_m+.22,(x,z)=>terrainAt(x,z)+.19,0xa9a994);
    ribbon(parts,path.points,path.width_m,(x,z)=>terrainAt(x,z)+.215,path.tags.surface==='asphalt'?0x727873:0xc4c2b4);
  }
  for(const bench of source.benches){
    const [x,z]=bench.point,y=terrainAt(x,z)+.23,tags=bench.tags as Record<string,string>;
    const yaw=tags.direction?Number(tags.direction)*Math.PI/180:.58,length=Math.max(.65,Math.min(7.2,Number(tags.seats??'3')*.58));
    const line=(offset:number,level:number,depth:number,color:number)=>{const nx=Math.cos(yaw),nz=-Math.sin(yaw);parts.beam([x-nx*length/2+Math.sin(yaw)*offset,y+level,z-nz*length/2+Math.cos(yaw)*offset],[x+nx*length/2+Math.sin(yaw)*offset,y+level,z+nz*length/2+Math.cos(yaw)*offset],depth,.07,color);};
    for(let k=0;k<4;k++)line((k-1.5)*.13,.47,.11,0x9b805b);
    if(tags.backrest!=='no')for(let k=0;k<3;k++)line(.28,.67+k*.12,.07,0x8f7757);
    for(const side of[-1,1])parts.box([x+side*Math.cos(yaw)*length*.34,y+.22,z-side*Math.sin(yaw)*length*.34],[.12,.45,.42],iron,native?0:yaw);
  }
  for(let familyIndex=0;familyIndex<source.cuts.length;familyIndex++){
    const family=familyIndex===1?'s21':'mainline',cut=source.cuts[familyIndex];
    const floor=(x:number,z:number)=>hbfNorthRailFloorAt(x,z,family);
    // Shape triangles must stay within one affine grade section; otherwise
    // clamped endpoints can raise a diagonal floor above the rail sleepers.
    const floorParts=native?[cut]:source.floor_sections[familyIndex];
    for(const section of floorParts)parts.polygon(section.ring,section.holes,(x,z)=>floor(x,z)+.04,0xa9a394);
    // Long side walls, but no cross-wall across the mouth or the surface join.
    const r=cut.ring;
    for(let i=0;i<r.length-1;i++){
      const a=r[i],b=r[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<25)continue;
      const n=Math.ceil(length/(native?1.5:4));
      for(let k=0;k<n;k++){
        const t=(k+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t,low=floor(x,z),top=Math.max(low+.3,terrainAt(x,z)+.12),yaw=Math.atan2(dx,dz);
        parts.box([x,(low+top)/2,z],[native?1:.38,top-low,length/n+.03],concrete,native?0:yaw);
        if(native)continue;
        for(const yy of[.23,1.05])parts.beam([a[0]+dx*k/n,top+yy,a[1]+dz*k/n],[a[0]+dx*(k+1)/n,top+yy,a[1]+dz*(k+1)/n],.045,.045,iron);
        parts.box([x,top+.65,z],[.055,1.25,.055],iron);
      }
    }
    const centre=familyIndex===0?source.profile.origin:[-283.156,-1159.452],out=familyIndex===0?source.profile.outward:[-.596,-.803];
    const across=[-out[1],out[0]],width=familyIndex===0?25.4:11.2,yaw=Math.atan2(out[0],out[1]);
    const at=(u:number,s:number,y:number):Vec=>[centre[0]+across[0]*u+out[0]*s,y,centre[1]+across[1]*u+out[1]*s];
    // One broad mainline mouth, as seen in the licensed reference; no centrepier.
    const portalTop=Math.max(4.7,terrainAt(centre[0],centre[1]));
    if(native){
      for(let u=-width/2;u<width/2;u+=1)for(let s=-12;s<.3;s+=1)parts.box(at(u+.5,s+.5,3.7),[1,1.8,1],concrete);
    }else{
      parts.box(at(0,-5.5,3.7),[width,1.8,12],concrete,yaw);
      for(const side of[-1,1])parts.box(at(side*width/2,-5.5,-.25),[.55,6.1,12],concrete,yaw);
      for(let s=-3;s>-12;s-=4)parts.beam(at(-width/2,s,2.69),at(width/2,s,2.69),.12,.12,0x6c746e);
      for(let u=-width/2;u<=width/2;u+=1.8)parts.box(at(u,.22,portalTop+.62),[.05,1.2,.05],iron);
      parts.beam(at(-width/2,.22,portalTop+1.18),at(width/2,.22,portalTop+1.18),.07,.07,iron);
      parts.box(at(0,.56,3.52),[familyIndex===0?3.2:1.6,.6,.08],0xd7d8cb,yaw);
    }
    // The licensed north-portal reference shows the narrow emergency stair at
    // the east cheek. Its local tread dimensions are an illustrative reading.
    if(familyIndex===0){
      for(let step=0;step<(native?16:42);step++){
        const count=native?16:42,t=(step+.5)/count,s=14*(1-t),y=-2.95+t*(portalTop+2.95);
        parts.box(at(width/2-.72,s,y-.09),[native?1.25:1.3,.18,14/count+.03],0xb9b9a9,native?0:yaw);
      }
      for(const u of[width/2-1.37,width/2-.10])parts.beam(at(u,14,-2.0),at(u,0,portalTop+1.0),.06,.06,iron);
    }
    // Short interior extends the live rails behind the roof and gives real depth.
    parts.polygon([at(-width/2,-12,0).filter((_,i)=>i!==1),at(width/2,-12,0).filter((_,i)=>i!==1),at(width/2,0,0).filter((_,i)=>i!==1),at(-width/2,0,0).filter((_,i)=>i!==1)],[],()=>-3.26,0x64675f);
  }
  for(const track of source.tracks){
    const family=track.family as 'mainline'|'s21',p=track.points;
    for(let i=0;i<p.length-1;i++){
      const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;const nx=-dz/len,nz=dx/len;
      for(const side of[-1,1])parts.beam([a[0]+nx*.7175*side,hbfNorthRailFloorAt(a[0],a[1],family)+.24,a[1]+nz*.7175*side],[b[0]+nx*.7175*side,hbfNorthRailFloorAt(b[0],b[1],family)+.24,b[1]+nz*.7175*side],native?.21:.11,.15,rail);
      for(let d=.45;d<len;d+=native?2:1.35){const t=d/len,x=a[0]+dx*t,z=a[1]+dz*t;parts.beam([x-nx*1.25,hbfNorthRailFloorAt(x,z,family)+.105,z-nz*1.25],[x+nx*1.25,hbfNorthRailFloorAt(x,z,family)+.105,z+nz*1.25],native?.4:.24,.13,0xc3bdad);}
    }
  }
  // Bounded catenary spacing is illustrative; no added point lights or textures.
  const p=source.profile;
  for(let s=18;s<p.length_m;s+=42){const x=p.origin[0]+p.outward[0]*s,z=p.origin[1]+p.outward[1]*s,y=hbfNorthRailFloorAt(x,z);
    for(const side of[-1,1]){const a:Vec=[x-p.outward[1]*side*8.9,y+4.2,z+p.outward[0]*side*8.9];parts.box(a,[.28,8.4,.32],0x748676);parts.beam([a[0],y+7.7,a[2]],[x,y+6.2,z],.1,.1,0x748676);}
  }
  parts.finish(root);return freezeStaticSceneTransforms(root);
}
