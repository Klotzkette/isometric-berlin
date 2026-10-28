import { BufferGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from 'three';
import source from './data/pekingerPlatzV281.json';
import { justicePalaceV183Boxes } from './justicePalaceV183Batches';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

export const PEKINGER_PLATZ_V281 = source;
type P = readonly number[];
export function pekingerInsideV281(r: readonly P[], x:number,z:number):boolean {
  let hit=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>z)!==(r[j][1]>z)&&x<(r[j][0]-r[i][0])*(z-r[i][1])/(r[j][1]-r[i][1])+r[i][0])hit=!hit;
  return hit;
}
function distance(p:P,a:P,b:P):number {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
}
function squareInside(r:readonly P[],x:number,z:number,half:number):boolean {
  return [-half,half].every(dx=>[-half,half].every(dz=>pekingerInsideV281(r,x+dx,z+dz)));
}
/** Clearance uses all retained path vertices and their original schema7 widths. */
export function pekingerBushAllowedV281(x:number,z:number,radius:number):boolean {
  if(!squareInside(source.park.ring,x,z,radius)||!source.bushPatches.some(r=>squareInside(r,x,z,radius)))return false;
  if(pekingerInsideV281(source.playground.ring,x,z))return false;
  for(let i=1;i<source.playground.ring.length;i++)if(distance([x,z],source.playground.ring[i-1],source.playground.ring[i])<radius+.7)return false;
  for(const path of source.paths)for(let i=1;i<path.points.length;i++)if(distance([x,z],path.points[i-1],path.points[i])<path.width/2+radius+.6)return false;
  return source.treeClearance.every(p=>Math.hypot(x-p[0],z-p[1])>radius+2);
}
/** Same floor as the visible shallow finish; every retained terrain run is5.2m. */
export function pekingerPlatzFloorV281At(x:number,z:number,native=false):number|null {
  if(x< -1100||x> -1078||z< -2398||z> -2357)return null;
  if(native){const cx=Math.floor(x*2)/2+.25,cz=Math.floor(z*2)/2+.25;return squareInside(source.playground.ring,cx,cz,.25)?source.nativeSandY:null;}
  return pekingerInsideV281(source.playground.ring,x,z)?source.drawnSandY:null;
}
/** Fixed table footprints only; shrub gaps and every public path remain open. */
export function pekingerTablesBlockedV281(x:number,z:number,bottom:number,top:number,radius:number,native=false):boolean {
  const floor=native?source.nativeSandY:source.drawnSandY;
  if(top<floor||bottom>=floor+.91)return false;
  return source.tables.some(t=>{
    const dx=x-t.point[0],dz=z-t.point[1],yaw=native?0:t.yaw;
    const lx=dx*Math.cos(yaw)-dz*Math.sin(yaw),lz=dx*Math.sin(yaw)+dz*Math.cos(yaw);
    const intersects=(w:number,d:number)=>Math.max(0,Math.abs(lx)-w/2)**2+Math.max(0,Math.abs(lz)-d/2)**2<=radius*radius;
    return (bottom<floor+.76&&intersects(1.525,2.74))||(top>floor+.76&&intersects(1.63,.045));
  });
}
export function pekingerBushesV281(native=false):number[][] {
  const rows:number[][]=[],step=native?2:2.4;
  for(let zi=0,z=-2404;z< -2352;zi++,z+=step)for(let x=-1169+(native?0:(zi%2)*1.2);x< -1073;x+=step){
    const r=native?.9:1.12;if(!pekingerBushAllowedV281(x,z,r))continue;
    const h=.65+((Math.round(x*10)+Math.round(z*10))%7+7)%7/12;
    rows.push([x,source.groundY,z,r,h]);
  }return rows;
}
export function pekingerPlatzRowsV281(native=false):number[][] {
  const rows:number[][]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,tone:number,yaw=0)=>rows.push(native?[x,y,z,w,h,d,tone]:[x,y,z,w,h,d,yaw,tone]);
  for(const table of source.tables){
    const [x,z]=table.point,y=native?source.nativeSandY:source.drawnSandY,yaw=native?0:table.yaw;
    const place=(dx:number,dy:number,dz:number,w:number,h:number,d:number,tone:number)=>box(x+dx*Math.cos(yaw)+dz*Math.sin(yaw),y+dy,z-dx*Math.sin(yaw)+dz*Math.cos(yaw),w,h,d,tone,yaw);
    // Mapped centres; dimensions, orientation and muted colours are estimates.
    place(0,.705,0,1.525,.11,2.74,0x708278);
    for(const dz of [-.79,.79])place(0,.325,dz,1.04,.65,.25,0xaaa99b);
    place(0,.835,0,1.63,.15,.045,0xd0cec0);
    place(0,.766,0,.025,.012,2.7,0xe1dfd0);
    for(const dx of [-.75,.75])place(dx,.766,0,.025,.012,2.7,0xe1dfd0);
    for(const dz of [-1.35,1.35])place(0,.766,dz,1.5,.012,.025,0xe1dfd0);
  }
  if(native){
    // Independently cardinal foliage terraces and exact-count merged sand runs.
    for(const[x,y,z,r,h]of pekingerBushesV281(true)){
      box(x,y+h*.3,z,r*2,h*.6,r*2,0x496439);
      box(x,y+h*.8,z,r*1.4,h*.4,r*1.4,0x5d7546);
    }
    for(let z=-2398;z< -2357;z+=.5){
      let start:number|null=null;
      for(let x=-1100;x<=-1078;x+=.5){
        const yes=x< -1078&&pekingerPlatzFloorV281At(x+.25,z+.25,true)!==null;
        if(yes&&start===null)start=x;
        if(!yes&&start!==null){box((start+x)/2,source.nativeSandY-.01,z+.25,x-start,.02,.5,0xbca77d);start=null;}
      }
    }
  }return rows;
}
export function createPekingerPlatzV281(native=false,_options:{mobileLike?:boolean}={}):Group {
  const root=new Group();root.name='Pekinger Platz mapped playground and interpreted shrub islands v281';
  const fittings=justicePalaceV183Boxes(pekingerPlatzRowsV281(native),native);
  fittings.name=native?'Pekinger independent cardinal tables, shrubs and sand':'Pekinger two mapped table tennis tables';root.add(fittings);
  if(!native){
    const ring=source.playground.ring.slice(0,-1),geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(ring.flatMap(p=>[p[0],source.drawnSandY,p[1]]),3));
    const faces=ShapeUtils.triangulateShape(ring.map(p=>new Vector2(p[0],p[1])),[]);
    geometry.setIndex(faces.flatMap(f=>[f[2],f[1],f[0]]));geometry.computeVertexNormals();
    const day=new MeshBasicMaterial({color:0xbca77d}),night=new MeshStandardMaterial({color:0xbca77d,roughness:1});
    const sand=new Mesh(geometry,day);sand.name='Complete mapped playground shallow sand finish';sand.userData={dayMaterial:day,nightMaterial:night,sourceId:43890640};root.add(sand);
    const bushes=pekingerBushesV281(),g=new IcosahedronGeometry(1,0);g.deleteAttribute('uv');
    const bushDay=new MeshBasicMaterial({color:0x526c3c}),bushNight=new MeshStandardMaterial({color:0x526c3c,roughness:1,flatShading:true});
    const mesh=new InstancedMesh(g,bushDay,0),matrix=new Matrix4(),matrices=new Float32Array(bushes.length*16);
    bushes.forEach(([x,y,z,r,h],i)=>matrix.makeScale(r,h/2,r).setPosition(x,y+h/2,z).toArray(matrices,i*16));
    mesh.count=bushes.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.name='DOP interpreted low shrub islands, clear of every existing path';mesh.userData={dayMaterial:bushDay,nightMaterial:bushNight};root.add(mesh);
  }
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,sourceGeometryRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,sourceIds:[4751040,43890640,...source.tables.map(t=>t.id)],estimateStatus:'Shrub footprints from DOP2025 interpretation; shrub/table dimensions and colours estimated. Exact OSM park/playground vertices and table centres retained.'};
  return freezeStaticSceneTransforms(root);
}
