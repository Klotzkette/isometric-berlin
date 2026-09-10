import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, ShapeUtils, Vector2, Vector3,
} from "three";
import source from "./economicMinistrySource.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { PrismBuilding } from "./IsometricCityWorld";

export const ECONOMIC_MINISTRY_SOURCE = source;
export const ECONOMIC_MINISTRY_SOURCE_IDS = new Set(source.prisms.map(p => p.id));
export const ECONOMIC_MINISTRY_SOURCE_GROUP = "Bundeswirtschaftsministerium source architecture";
export const MINECRAFT_ECONOMIC_MINISTRY_GROUP = "Minecraft Bundeswirtschaftsministerium source architecture";
type Triple = [number, number, number];
type Point = [number, number];
type Block = { position: Triple; size: Triple; quaternion: [number,number,number,number]; color: number; role: string; sourceId: string };
type RoofTriangle = { points: Triple[]; id: string; minX: number; maxX: number; minZ: number; maxZ: number };
const C = { historic: 0xe8e1d1, modern: 0xdce0da, tile: 0xa35d49, modernRoof: 0x765c55, flatRoof: 0x9aa5a0, solar: 0x243b4e, frame: 0xc4ccc6, gravel: 0xc3c0ac };
const mainId = "K00008CN", modernId = "yAAWS2KQ", podiumId = "-3202585";
const planBounds = new Map(source.prisms.map(p => [p.id, {
  minX: Math.min(...p.ring.map(q=>q[0]/10)), maxX: Math.max(...p.ring.map(q=>q[0]/10)),
  minZ: Math.min(...p.ring.map(q=>q[1]/10)), maxZ: Math.max(...p.ring.map(q=>q[1]/10)),
}]));
const allBounds={minX:Math.min(...[...planBounds.values()].map(b=>b.minX)),maxX:Math.max(...[...planBounds.values()].map(b=>b.maxX)),minZ:Math.min(...[...planBounds.values()].map(b=>b.minZ)),maxZ:Math.max(...[...planBounds.values()].map(b=>b.maxZ))};

function insideRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function economicMinistryContains(part: Pick<PrismBuilding,"ring"|"holes">,x:number,z:number):boolean {
  return insideRing(part.ring,x*10,z*10)&&!(part.holes??[]).some(r=>insideRing(r,x*10,z*10));
}
/** Exact retained plan intersection, including holes, for replacing coarse voxel cells. */
export function isEconomicMinistryReplacementCell(x:number,z:number,size:number):boolean {
  if(x+size<allBounds.minX||x>allBounds.maxX||z+size<allBounds.minZ||z>allBounds.maxZ)return false;
  const a=x*10,b=z*10,s=size*10;
  for(const part of source.prisms) {
    const bounds=planBounds.get(part.id)!;
    if(x+size<bounds.minX||x>bounds.maxX||z+size<bounds.minZ||z>bounds.maxZ)continue;
    if([[x,z],[x+size,z],[x+size,z+size],[x,z+size],[x+size/2,z+size/2]].some(p=>economicMinistryContains(part,p[0],p[1]))) return true;
    for(const ring of [part.ring,...part.holes]) for(let i=0;i<ring.length;i++) {
      const p=ring[i],q=ring[(i+1)%ring.length];
      if(p[0]>=a&&p[0]<=a+s&&p[1]>=b&&p[1]<=b+s)return true;
      let lo=0,hi=1;
      for(const [delta,origin,min,max] of [[q[0]-p[0],p[0],a,a+s],[q[1]-p[1],p[1],b,b+s]]) {
        if(Math.abs(delta)<1e-9){if(origin<min||origin>max){lo=1;hi=0;break;}}
        else {const t0=(min-origin)/delta,t1=(max-origin)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
      }
      if(lo<=hi)return true;
    }
  }
  return false;
}
function triangulate(rings:number[][][]):Triple[][] {
  const r=rings[0],normal=new Vector3();
  for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];normal.x+=(a[1]-b[1])*(a[2]+b[2]);normal.y+=(a[2]-b[2])*(a[0]+b[0]);normal.z+=(a[0]-b[0])*(a[1]+b[1]);}
  const axis=Math.abs(normal.y)>Math.abs(normal.x)?Math.abs(normal.y)>Math.abs(normal.z)?1:2:Math.abs(normal.x)>Math.abs(normal.z)?0:2;
  const flat=rings.flat(),projected=rings.map(r=>r.map(v=>axis===1?new Vector2(v[0],v[2]):axis===0?new Vector2(v[2],v[1]):new Vector2(v[0],v[1])));
  return ShapeUtils.triangulateShape(projected[0],projected.slice(1)).map(t=>t.map(i=>flat[i] as Triple));
}
const roofTriangles:RoofTriangle[]=[];
for(const part of source.parts) {
  const triangles=part.id===mainId?source.mainRoof.triangles.map(t=>[t.slice(0,3),t.slice(3,6),t.slice(6,9)] as Triple[]):part.surfaces.filter(s=>s.kind==="RoofSurface").flatMap(s=>triangulate(s.rings));
  for(const points of triangles)roofTriangles.push({points,id:part.id,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[2])),maxZ:Math.max(...points.map(p=>p[2]))});
}
const roofGrid=new Map<string,RoofTriangle[]>();
for(const t of roofTriangles)for(let x=Math.floor((t.minX-.1)/8);x<=Math.floor((t.maxX+.1)/8);x++)for(let z=Math.floor((t.minZ-.1)/8);z<=Math.floor((t.maxZ+.1)/8);z++){const key=`${t.id}:${x}:${z}`,cell=roofGrid.get(key)??[];cell.push(t);roofGrid.set(key,cell);}
const partsById=new Map(source.prisms.map(p=>[p.id,p]));
export function economicMinistryRoofTopAt(x:number,z:number,id:string):number|null {
  const part=partsById.get(id),bounds=planBounds.get(id);if(!part||!bounds||x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||!economicMinistryContains(part,x,z))return null;
  if(id===podiumId)return (part.y0_dm+part.h_dm)/10;
  let top:number|null=null;let nearest:{distance:number;y:number}|null=null;
  for(const t of roofGrid.get(`${id}:${Math.floor(x/8)}:${Math.floor(z/8)}`)??[]) {
    if(x<t.minX-.1||x>t.maxX+.1||z<t.minZ-.1||z>t.maxZ+.1)continue;
    const [a,b,c]=t.points,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-8)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,w=1-u-v;
    if(u<-.002||v<-.002||w<-.002){
      // Source planes keep millimetres while retained plan coordinates were
      // rounded to decimetres. Bridge only that <= 0.1 m edge difference.
      for(const [p,q] of [[a,b],[b,c],[c,a]]){
        const dx=q[0]-p[0],dz=q[2]-p[2],lengthSquared=dx*dx+dz*dz;if(lengthSquared<1e-12)continue;
        const ratio=Math.max(0,Math.min(1,((x-p[0])*dx+(z-p[2])*dz)/lengthSquared)),xx=p[0]+ratio*dx,zz=p[2]+ratio*dz,distance=Math.hypot(x-xx,z-zz);
        if(distance<=.1&&(!nearest||distance<nearest.distance))nearest={distance,y:p[1]+ratio*(q[1]-p[1])};
      }
      continue;
    }
    const y=u*a[1]+v*b[1]+w*c[1];top=top===null?y:Math.max(top,y);
  }
  return top??nearest?.y??null;
}
function solarBlocks():Block[] {
  const part=source.prisms.find(p=>p.id===modernId)!,a=part.ring[5],b=part.ring[6],dx=(b[0]-a[0])/10,dz=(b[1]-a[1])/10,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
  // Ring runs along the canal face from south to north: inward points east.
  const nx=-uz,nz=ux,p=source.solar,span=length-p.alongStartM-p.alongEndMarginM,columns=Math.floor(span/p.columnPitchM),pitch=span/columns,rows=p.rows,rowPitch=(p.inwardEndM-p.inwardStartM)/rows,blocks:Block[]=[];
  const point=(u:number,v:number):Point=>[a[0]/10+ux*u+nx*v,a[1]/10+uz*u+nz*v];
  for(let col=0;col<columns;col++)for(let row=0;row<rows;row++) {
    const u=p.alongStartM+(col+.5)*pitch,v=p.inwardStartM+(row+.5)*rowPitch,[x,z]=point(u,v),y=economicMinistryRoofTopAt(x,z,modernId);if(y===null)continue;
    const aa=point(u,v-.1),bb=point(u,v+.1),ya=economicMinistryRoofTopAt(...aa,modernId),yb=economicMinistryRoofTopAt(...bb,modernId);if(ya===null||yb===null)continue;
    const slope=(yb-ya)/.2,q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(uz,ux));q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.atan(slope)));
    blocks.push({position:[x,y+.13,z],size:[pitch-.075,.085,(rowPitch-.055)*Math.hypot(1,slope)],quaternion:q.toArray(),color:C.solar,role:"modern roof photovoltaic module",sourceId:modernId});
  }
  return blocks;
}
export const ECONOMIC_MINISTRY_SOLAR_BLOCKS=solarBlocks();
function podiumFacadeBlocks():Block[] {
  const part=partsById.get(podiumId)!,blocks:Block[]=[];
  for(const [ringIndex,ring] of [part.ring,...part.holes].entries()){
    const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0),sign=(area>=0?1:-1)*(ringIndex===0?1:-1);
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],dx=(b[0]-a[0])/10,dz=(b[1]-a[1])/10,len=Math.hypot(dx,dz);if(len<5)continue;
      const ux=dx/len,uz=dz/len,nx=uz*sign,nz=-ux*sign,count=Math.max(1,Math.round((len-1.2)/3.6)),pitch=(len-1.2)/count,q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(uz,ux)).toArray();
      for(let bay=0;bay<count;bay++)for(let level=0;level<3;level++){
        const u=.6+(bay+.5)*pitch,x=a[0]/10+ux*u+nx*.16,z=a[1]/10+uz*u+nz*.16;
        if(source.prisms.some(p=>p.id!==podiumId&&economicMinistryContains(p,x,z)))continue;
        const y=part.y0_dm/10+1.9+level*2.65;
        blocks.push({position:[x,y,z],size:[pitch*.69,1.55,.16],quaternion:q,color:0x526d71,role:"modern lower-wing courtyard or canal window",sourceId:podiumId});
        blocks.push({position:[x+nx*.09,y-.9,z+nz*.09],size:[pitch-.08,.19,.24],quaternion:q,color:C.modern,role:"modern lower-wing sill",sourceId:podiumId});
      }
    }
  }
  return blocks;
}
const podiumBlocks=podiumFacadeBlocks();

function attachBlocks(root:Group,blocks:Block[],name:string):void {
  const g=new BoxGeometry(1,1,1);g.deleteAttribute("uv");const mesh=new InstancedMesh(g,new MeshBasicMaterial({color:0xffffff}),blocks.length),m=new Matrix4(),p=new Vector3(),q=new Quaternion(),s=new Vector3(),c=new Color();mesh.name=name;
  blocks.forEach((b,i)=>{m.compose(p.fromArray(b.position),q.fromArray(b.quaternion),s.fromArray(b.size));mesh.setMatrixAt(i,m);mesh.setColorAt(i,c.setHex(b.color));});mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.userData.dayMaterial=mesh.material;mesh.userData.nightMaterial=new MeshStandardMaterial({color:0xffffff,roughness:.8});root.add(mesh);
}
function roofColor(id:string,y:number):number{return id===podiumId?C.gravel:id===modernId?C.modernRoof:id===mainId&&y>=source.mainRoof.topM-.03?C.flatRoof:C.tile;}
export function createEconomicMinistrySourceGeometry():Group {
  const root=new Group();root.name=ECONOMIC_MINISTRY_SOURCE_GROUP;const positions:number[]=[],colors:number[]=[],col=new Color();
  const triangle=(t:Triple[],color:number)=>{col.setHex(color);for(const p of t){positions.push(...p);colors.push(col.r,col.g,col.b);}};
  for(const part of source.parts)for(const surface of part.surfaces) {
    if(surface.kind!=="WallSurface"&&surface.kind!=="ClosureSurface")continue;
    const rings=surface.rings.map(r=>r.map(p=>[p[0],part.id===mainId?Math.min(p[1],source.mainRoof.eavesM):p[1],p[2]]));
    for(const t of triangulate(rings))triangle(t,part.id===modernId?C.modern:C.historic);
  }
  for(const t of roofTriangles)triangle(t.points,roofColor(t.id,Math.min(...t.points.map(p=>p[1]))));
  const podium=source.prisms.find(p=>p.id===podiumId)!,low=podium.y0_dm/10,top=(podium.y0_dm+podium.h_dm)/10;
  for(const ring of [podium.ring,...podium.holes])for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];for(const t of triangulate([[[a[0]/10,low,a[1]/10],[b[0]/10,low,b[1]/10],[b[0]/10,top,b[1]/10],[a[0]/10,top,a[1]/10]]]))triangle(t,C.modern);}
  for(const t of triangulate([podium.ring,...podium.holes].map(r=>r.map(p=>[p[0]/10,top,p[1]/10]))))triangle(t,C.gravel);
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new Mesh(g,new MeshBasicMaterial({vertexColors:true,side:DoubleSide}));mesh.name="Ministry exact walls, open courts and source-qualified roofs";mesh.userData.dayMaterial=mesh.material;mesh.userData.nightMaterial=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.86});root.add(mesh);
  attachBlocks(root,[...ECONOMIC_MINISTRY_SOLAR_BLOCKS,...podiumBlocks],"Ministry modern roof photovoltaic modules and lower-wing facades");
  root.userData.sourcePrismIds=[...ECONOMIC_MINISTRY_SOURCE_IDS];root.userData.originalSourceRetained=true;root.userData.solarModules=ECONOMIC_MINISTRY_SOLAR_BLOCKS.length;root.userData.mainRoofStatus=source.mainRoof.status;freezeStaticSceneTransforms(root);return root;
}
export function createMinecraftEconomicMinistryDetails(_prisms?:{buildings:readonly PrismBuilding[]},options:{mobileLike?:boolean;diagnostics?:boolean}={}):Group {
  const root=new Group();root.name=MINECRAFT_ECONOMIC_MINISTRY_GROUP;const blocks:Block[]=[];const identity:[number,number,number,number]=[0,0,0,1],cell=options.mobileLike?2.5:1.8;
  // Surface-only columns retain every courtyard; no hidden solid infill.
  for(const part of source.prisms) {
    const minX=Math.min(...part.ring.map(p=>p[0]/10)),maxX=Math.max(...part.ring.map(p=>p[0]/10)),minZ=Math.min(...part.ring.map(p=>p[1]/10)),maxZ=Math.max(...part.ring.map(p=>p[1]/10));
    for(const [ringIndex,ring] of [part.ring,...part.holes].entries()) {
      const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0),outSign=(area>=0?1:-1)*(ringIndex===0?1:-1);
      for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length],dx=(b[0]-a[0])/10,dz=(b[1]-a[1])/10,len=Math.hypot(dx,dz);if(len<.2)continue;
        const ux=dx/len,uz=dz/len,nx=uz*outSign,nz=-ux*outSign,count=Math.ceil(len/cell),pitch=len/count;
        for(let j=0;j<count;j++) {
          const x=a[0]/10+ux*(j+.5)*pitch,z=a[1]/10+uz*(j+.5)*pitch,top=economicMinistryRoofTopAt(x-nx*.12,z-nz*.12,part.id);if(top===null)continue;
          const height=top-part.y0_dm/10;
          blocks.push({position:[x-nx*.1,part.y0_dm/10+height/2,z-nz*.1],size:[pitch+.025,height,.24],quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(uz,ux)).toArray(),color:part.id===modernId||part.id===podiumId?C.modern:C.historic,role:"source perimeter wall block",sourceId:part.id});
        }
      }
    }
    for(let xi=Math.floor(minX/cell);xi<=Math.floor(maxX/cell);xi++)for(let zi=Math.floor(minZ/cell);zi<=Math.floor(maxZ/cell);zi++) {
      const x=(xi+.5)*cell,z=(zi+.5)*cell;
      const tile=(xx:number,zz:number,width:number,depth:number):void=>{
        const samples=[[xx-width/2,zz-width/2],[xx+width/2,zz-width/2],[xx+width/2,zz+width/2],[xx-width/2,zz+width/2],[xx,zz]],inside=samples.map(p=>economicMinistryContains(part,p[0],p[1]));
        if(inside.every(Boolean)){
          const yy=economicMinistryRoofTopAt(xx,zz,part.id);
          if(yy!==null){
            const heights=samples.map(p=>economicMinistryRoofTopAt(p[0],p[1],part.id)).filter((y):y is number=>y!==null),thickness=Math.max(.64,Math.max(...heights)-Math.min(...heights)+.2);
            blocks.push({position:[xx,yy-thickness/2,zz],size:[width,thickness,width],quaternion:identity,color:roofColor(part.id,yy),role:"source roof surface block",sourceId:part.id});
          }
          return;
        }
        if(depth>=3)return;
        // An outside centre must not discard a roof cell crossing a measured
        // sloping eave. Recurse only where a corner or source vertex is inside.
        if(!inside.some(Boolean)&&![part.ring,...part.holes].some(r=>r.some(p=>Math.abs(p[0]/10-xx)<width/2&&Math.abs(p[1]/10-zz)<width/2)))return;
        for(const dx of [-1,1])for(const dz of [-1,1])tile(xx+dx*width/4,zz+dz*width/4,width/2,depth+1);
      };
      tile(x,z,cell,0);
    }
  }
  // Adaptive edge cells can meet much wider interior tiles. Comparing actual
  // shared edges, rather than just each tile's own slope, closes every vertical
  // step without changing a roof top, source footprint or courtyard opening.
  type RoofEdge={block:Block;start:number;end:number;side:number;top:number};
  const roofEdges=new Map<string,RoofEdge[]>(),lowerNeighbour=new Map<Block,number>();
  for(const block of blocks.filter(b=>b.role==="source roof surface block")){
    const x=block.position[0],z=block.position[2],half=block.size[0]/2,top=block.position[1]+block.size[1]/2;
    for(const [axis,value,start,end,side] of [[0,x-half,z-half,z+half,-1],[0,x+half,z-half,z+half,1],[1,z-half,x-half,x+half,-1],[1,z+half,x-half,x+half,1]]){
      const key=`${block.sourceId}:${axis}:${Math.round(value*1e6)}`,edges=roofEdges.get(key)??[];edges.push({block,start,end,side,top});roofEdges.set(key,edges);
    }
  }
  for(const edges of roofEdges.values()){
    edges.sort((a,b)=>a.start-b.start);
    for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length&&edges[j].start<edges[i].end-1e-6;j++){
      const a=edges[i],b=edges[j];if(a.side===b.side||Math.min(a.end,b.end)-Math.max(a.start,b.start)<1e-6)continue;
      lowerNeighbour.set(a.block,Math.min(lowerNeighbour.get(a.block)??a.top,b.top));lowerNeighbour.set(b.block,Math.min(lowerNeighbour.get(b.block)??b.top,a.top));
    }
  }
  for(const [block,neighbourTop] of lowerNeighbour){const top=block.position[1]+block.size[1]/2,height=Math.max(block.size[1],top-neighbourTop+.16);block.size[1]=height;block.position[1]=top-height/2;}
  const main=partsById.get(mainId)!;
  for(const [ringIndex,ring] of [main.ring,...main.holes].entries()) {
    const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0),sign=(area>=0?1:-1)*(ringIndex===0?1:-1);
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length],dx=(b[0]-a[0])/10,dz=(b[1]-a[1])/10,len=Math.hypot(dx,dz);
      if(len<5||(ringIndex===0&&[23,27,35,42,46].includes(i)))continue;
      const ux=dx/len,uz=dz/len,nx=uz*sign,nz=-ux*sign,bays=Math.max(1,Math.round((len-1.5)/3.65)),pitch=(len-1.5)/bays,q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(uz,ux)).toArray();
      for(let bay=0;bay<bays;bay++)for(let level=0;level<2;level++) {
        const u=.75+(bay+.5)*pitch,x=a[0]/10+ux*u+nx*.17,z=a[1]/10+uz*u+nz*.17,y=main.y0_dm/10+5.55+level*4.85;
        blocks.push({position:[x,y,z],size:[pitch*.49,2.75,.2],quaternion:q,color:0x4b666b,role:"historic court or side window",sourceId:mainId});
        blocks.push({position:[x+nx*.12,y-1.49,z+nz*.12],size:[pitch*.60,.17,.25],quaternion:q,color:C.historic,role:"historic window sill",sourceId:mainId});
      }
    }
  }
  blocks.push(...podiumBlocks);
  // Discrete, level tiles read as block-native solar rows along the same slope.
  const modernRoofBlocks=blocks.filter(b=>b.sourceId===modernId&&b.role==="source roof surface block"),yaw=-Math.atan2(-156.4,-89.9),ux=Math.cos(yaw),uz=-Math.sin(yaw),vx=Math.sin(yaw),vz=Math.cos(yaw),flatDepth=(source.solar.inwardEndM-source.solar.inwardStartM)/source.solar.rows-.055;
  for(const b of ECONOMIC_MINISTRY_SOLAR_BLOCKS){
    const halfWidth=b.size[0]/2,halfDepth=flatDepth/2;let support=b.position[1]-.13;
    for(const roof of modernRoofBlocks){
      const dx=roof.position[0]-b.position[0],dz=roof.position[2]-b.position[2],hx=roof.size[0]/2,hz=roof.size[2]/2;
      // Four separating axes compare the rotated solar tile to each level roof
      // block. Seat the complete tile above the highest actual stepped support.
      if(Math.abs(dx)>hx+Math.abs(ux)*halfWidth+Math.abs(vx)*halfDepth||Math.abs(dz)>hz+Math.abs(uz)*halfWidth+Math.abs(vz)*halfDepth||Math.abs(dx*ux+dz*uz)>halfWidth+Math.abs(ux)*hx+Math.abs(uz)*hz||Math.abs(dx*vx+dz*vz)>halfDepth+Math.abs(vx)*hx+Math.abs(vz)*hz)continue;
      support=Math.max(support,roof.position[1]+roof.size[1]/2);
    }
    blocks.push({...b,position:[b.position[0],support+.2,b.position[2]],size:[b.size[0],.2,flatDepth],quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw).toArray()});
  }
  attachBlocks(root,blocks,"Ministry block-native walls, pitched roofs and solar rows");root.userData.sourcePrismIds=[...ECONOMIC_MINISTRY_SOURCE_IDS];root.userData.minecraft=true;root.userData.instances=blocks.length;root.userData.solarModules=ECONOMIC_MINISTRY_SOLAR_BLOCKS.length;if(options.diagnostics)root.userData.blocks=blocks;freezeStaticSceneTransforms(root);return root;
}
