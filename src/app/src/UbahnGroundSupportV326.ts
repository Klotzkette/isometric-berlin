/** Actual delivered ground carriers. Names/public flags never prove coverage;
 * complete mouth triangles must fit current rendered surfaces at the top. */
import {Box3,InstancedMesh,Matrix4,Mesh,ShapeUtils,Vector2,Vector3,type Object3D} from 'three';
import {isParkedStaticStorageV321} from './losslessStaticStorage';
import type {UbahnAccessOpeningV326} from './UbahnAccessV326';
import {mergeUbahnNativeCellsV326} from './UbahnGroundAtlasV326';
type P=number[];
export type UbahnGroundCarrierV326={points:P[];mesh:Mesh;indices:readonly number[];instance:number|null;matrix:Matrix4;read:()=>P[]};
export type UbahnGroundSupportV326={
 carriers:readonly UbahnGroundCarrierV326[];hosts:readonly Mesh[];
 topAt:(x:number,z:number,hint:number)=>number|null;
 covers:(opening:UbahnAccessOpeningV326)=>boolean;
 complete:()=>boolean;
};
const area=(p:readonly P[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[2]-b[0]*a[2];},0))/2;
function clip(poly:readonly P[],distance:(p:P)=>number):P[]{
 const out:P[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;
}
/** Exact convex outside pieces, with interpolation along the original edges. */
export function subtractUbahnConvexV326(poly:readonly P[],ring:readonly P[]):P[][]{
 const signed=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[2]-b[0]*a[2];},0),orientation=Math.sign(signed);if(!orientation)return[poly.map(p=>p.slice())];
 let inside=poly.map(p=>p.slice());const outside:P[][]=[];
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],d=(p:P)=>orientation*((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]));const q=clip(inside,p=>-d(p));if(q.length>=3&&area(q)>1e-10)outside.push(q);inside=clip(inside,d);if(inside.length<3)return outside;}
 return outside;
}
function heightAt(p:readonly P[],x:number,z:number):number|null{
 const[a,b,c]=p,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-10)return null;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
 return Math.min(u,v,1-u-v)>=-1e-7?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
/** Terrain may slope; a retaining wall has no supporting XZ area. */
export function isUbahnGroundFaceV326(p:readonly number[][]):boolean{
 if(p.length!==3||area(p)<1e-8)return false;
 for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],horizontal=Math.hypot(a[0]-b[0],a[2]-b[2]);if(Math.abs(a[1]-b[1])>horizontal*.75+1e-6)return false;}
 return true;
}
const overlaps=(a:readonly number[],b:readonly number[])=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const bounds=(p:readonly P[])=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[2])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[2]))];

/** Borrow only explicitly supplied source owners from the real construction.
 * Cooperative slices never copy a whole city or allocate a second mesh. */
export function* collectUbahnGroundSupportV326Steps(root:Object3D,hosts:readonly Mesh[],points:readonly{point:readonly[number,number];ring?:readonly(readonly[number,number])[]}[],eligible?:(mesh:Mesh,ids:readonly number[])=>boolean):Generator<void,UbahnGroundSupportV326|null>{
 if(!points.length||points.length>192||!hosts.length||new Set(hosts).size!==hosts.length)return null;
 const within=(m:Object3D)=>{for(let p:Object3D|null=m;p;p=p.parent)if(p===root)return true;return false;};
 if(hosts.some(m=>!within(m)))return null;root.updateMatrixWorld(true);
 const query=points.map(p=>{const q=p.ring??[p.point];return[Math.min(...q.map(p=>p[0]))-1,Math.min(...q.map(p=>p[1]))-1,Math.max(...q.map(p=>p[0]))+1,Math.max(...q.map(p=>p[1]))+1];});
 const carriers:UbahnGroundCarrierV326[]=[],pins:Array<()=>boolean>=[],v=new Vector3(),box=new Box3();let work=0;
 for(const mesh of hosts){
  const g=mesh.geometry,p=g.getAttribute('position'),index=g.index;if(!p||p.itemSize!==3||g.morphAttributes.position?.length)continue;
  const transform=mesh.matrixWorld.clone(),oldParent=mesh.parent,oldP=p,oldIndex=index,oldCount=p.count,oldIndexCount=index?.count;
  const pv='data'in p?p.data.version:p.version,iv=index?.version;
  pins.push(()=>mesh.parent===oldParent&&within(mesh)&&mesh.geometry===g&&g.getAttribute('position')===oldP&&g.index===oldIndex&&p.count===oldCount&&index?.count===oldIndexCount&&('data'in p?p.data.version:p.version)===pv&&index?.version===iv&&mesh.matrixWorld.elements.every((n,i)=>n===transform.elements[i]));
  const instances=mesh instanceof InstancedMesh?mesh.count:1,im=new Matrix4(),instanceAttribute=mesh instanceof InstancedMesh?mesh.instanceMatrix:null,instanceVersion=instanceAttribute?.version,drawStart=g.drawRange.start,drawCount=g.drawRange.count,wasVisible=mesh.visible;
  pins.push(()=>mesh.visible===wasVisible&&g.drawRange.start===drawStart&&g.drawRange.count===drawCount&&(!(mesh instanceof InstancedMesh)||mesh.count===instances&&mesh.instanceMatrix===instanceAttribute&&mesh.instanceMatrix.version===instanceVersion));
  if(!g.boundingBox)g.computeBoundingBox();
  for(let n=0;n<instances;n++){
   if(++work%128===0)yield;
   let matrix=transform;
   if(mesh instanceof InstancedMesh){mesh.getMatrixAt(n,im);matrix=new Matrix4().multiplyMatrices(transform,im);box.copy(g.boundingBox!).applyMatrix4(matrix);if(!query.some(q=>overlaps(q,[box.min.x,box.min.z,box.max.x,box.max.z])))continue;}
   const sourceMatrix=matrix.clone();
   for(let at=0;at<(index?.count??p.count);at+=3){
    const ids=index?[index.getX(at),index.getX(at+1),index.getX(at+2)]:[at,at+1,at+2];
    if(eligible&&!eligible(mesh,ids))continue;
    const read=()=>{let current=mesh.matrixWorld;if(mesh instanceof InstancedMesh){const m=new Matrix4();mesh.getMatrixAt(n,m);current=new Matrix4().multiplyMatrices(mesh.matrixWorld,m);}return ids.map(i=>{v.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(current);return[v.x,v.y,v.z];});};
    if(++work%4096===0)yield;
    const vertices=read();if(area(vertices)<1e-8||!query.some(q=>overlaps(q,bounds(vertices))))continue;
    // Upright structures cannot masquerade as a supporting footway.
    if(!isUbahnGroundFaceV326(vertices))continue;
    pins.push(()=>!index||isParkedStaticStorageV321(index)||ids.every((id,k)=>index.getX(at+k)===id));
    carriers.push({points:vertices,mesh,indices:ids,instance:mesh instanceof InstancedMesh?n:null,matrix:sourceMatrix,read});
   }
  }
 }
 if(!carriers.length)return null;
 const complete=()=>pins.every(f=>f())&&carriers.every(c=>(isParkedStaticStorageV321('data'in c.mesh.geometry.getAttribute('position')?(c.mesh.geometry.getAttribute('position')as any).data:c.mesh.geometry.getAttribute('position'))&&(!(c.mesh instanceof InstancedMesh)||isParkedStaticStorageV321(c.mesh.instanceMatrix)))||c.read().every((p,i)=>p.every((n,j)=>Object.is(n,c.points[i][j]))));
 const topAt=(x:number,z:number,hint:number)=>{let y:number|null=null;for(const c of carriers){const q=heightAt(c.points,x,z);if(q!==null&&Math.abs(q-hint)<1.5&&(y===null||q>y))y=q;}return y;};
 const covers=(opening:UbahnAccessOpeningV326)=>{
  const ring=opening.ring.map(p=>[p[0],opening.surfaceY,p[1]]),triangles:P[][]=[];
  if(opening.native){for(const r of mergeUbahnNativeCellsV326(opening.nativeCells??[])){const a=[r[0],opening.surfaceY,r[1]],b=[r[2],opening.surfaceY,r[1]],c=[r[2],opening.surfaceY,r[3]],d=[r[0],opening.surfaceY,r[3]];triangles.push([a,b,c],[a,c,d]);}}
  else for(const ids of ShapeUtils.triangulateShape(opening.ring.map(p=>new Vector2(...p)),[]))triangles.push(ids.map(i=>ring[i]));
  if(!triangles.length)return false;const close=carriers.filter(c=>overlaps(bounds(c.points),bounds(ring))).map(c=>clip(clip(c.points,p=>p[1]-opening.bottomY-.02),p=>opening.surfaceY+.34-p[1])).filter(p=>p.length>=3&&area(p)>1e-10);
  for(const triangle of triangles){let remainder=[triangle];for(const c of close){remainder=remainder.flatMap(p=>subtractUbahnConvexV326(p,c));if(!remainder.length)break;}if(remainder.reduce((n,p)=>n+area(p),0)>1e-5)return false;}
  return true;
 };
 if(!complete())return null;return{carriers,hosts,topAt,covers,complete};
}
