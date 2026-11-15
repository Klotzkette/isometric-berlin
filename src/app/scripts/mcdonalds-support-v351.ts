/** Offline literal-wall and existing-fitting checks; never shipped to the viewer. */
import { applyNeighbourhoodTrianglesV300 } from '../src/NeighbourhoodPacketV300';
import { applySourceQuarterTrianglesV303 } from '../src/SourceQuarterPacketV303';
import type { SurroundingCityChunk } from '../src/SurroundingCityGeometry';
import type { McdonaldsSignV351 } from '../src/McdonaldsV351';
export function drain<T>(g:Generator<void,T>):T{for(;;){const n=g.next();if(n.done)return n.value;}}
type Mesh={p:Uint16Array;i:Uint32Array};
export function supportMeshesV350(chunk:SurroundingCityChunk):Mesh[]{
 return chunk.meshes.map((part,mesh)=>{
  const p=new Uint16Array(Uint8Array.from(atob(part.positions),c=>c.charCodeAt(0)).buffer);
  const i=new Uint32Array(Uint8Array.from(atob(part.indices),c=>c.charCodeAt(0)).buffer);
  drain(applyNeighbourhoodTrianglesV300(chunk,mesh,i,0));drain(applySourceQuarterTrianglesV303(chunk,mesh,i,0));
  return {p,i};
 });
}
function inside(a:number[],b:number[],c:number[],p:number[]):boolean{
 const cross=(q:number[],r:number[],s:number[])=>(r[0]-q[0])*(s[1]-q[1])-(r[1]-q[1])*(s[0]-q[0]);
 if(Math.abs(cross(a,b,c))<1)return false;
 const d=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];return d.every(n=>n>=-.1)||d.every(n=>n<=.1);
}
/** Supports all five plaque sample points on retained coplanar wall triangles,
 * and rejects any forward-facing older fitting crossing its padded rectangle. */
export function mcdonaldsSignClearV351(meshes:Mesh[],plate:McdonaldsSignV351):boolean{
 const[x,y,z,dx,dz,nx,nz,width,height]=plate;
 const halfHeight=height/2+2;
 const samples=[[-width/2-2,-halfHeight],[width/2+2,-halfHeight],[-width/2-2,halfHeight],[width/2+2,halfHeight],[0,0]],covered=samples.map(()=>false);
 for(const {p,i} of meshes)for(let t=0;t<i.length;t+=3){
  if(i[t]===i[t+1]||i[t]===i[t+2])continue;
  const a=[];
  for(let v=0;v<3;v++){const at=i[t+v]*3,xx=p[at]-x,zz=p[at+2]-z;a.push([(xx*dx+zz*dz)/1e6,p[at+1]-y,(xx*nx+zz*nz)/1e6]);}
  const us=a.map(q=>q[0]),ys=a.map(q=>q[1]),ds=a.map(q=>q[2]);
  if(Math.max(...us)<-width/2-3||Math.min(...us)>width/2+3||Math.max(...ys)<-halfHeight-1||Math.min(...ys)>halfHeight+1)continue;
  if(ds.every(n=>Math.abs(n)<=1.5)){
   for(let s=0;s<samples.length;s++)if(inside(a[0],a[1],a[2],samples[s]))covered[s]=true;
  }else if(Math.max(...ds)>1.5&&Math.min(...ds)<45&&Math.max(...ds)>=2){
   // Bounding projection is conservative: a fit touching the padded plate
   // region rejects the candidate, including frame/door/recess side walls.
   return false;
  }
 }
 return covered.every(Boolean);
}
export function clearMcdonaldsSignV351(meshes:Mesh[],plate:McdonaldsSignV351,faceLength:number,also?:Mesh[]):McdonaldsSignV351|undefined{
 for(const vertical of [0,-.6,.6,-1.2,1.2])for(const metres of [0,-1,1,-2,2,-3,3,-4,4,-6,6]){
  if(Math.abs(metres)+(plate[7]/100)/2+.05>faceLength/2)continue;
  const moved=plate.slice() as McdonaldsSignV351;
  moved[1]=Math.round(plate[1]+vertical*100);
  moved[0]=Math.round(plate[0]+plate[3]*metres/10000);moved[2]=Math.round(plate[2]+plate[4]*metres/10000);
  if(mcdonaldsSignClearV351(meshes,moved)&&(!also||mcdonaldsSignClearV351(also,moved)))return moved;
 }
 return undefined;
}
