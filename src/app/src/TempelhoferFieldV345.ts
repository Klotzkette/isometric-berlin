import source from "./data/tempelhoferFieldV345.json";
import type { Group } from "three";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";
import { streetCurvesNavigationGuardV276 } from "./streetCurvesV276";

type Plan = typeof source.plans.drawn;
const tokenKey=Symbol("complete Tempelhofer Feld ground v345");
const admissions=new WeakMap<object,Plan>();
const roots=new WeakMap<Group,boolean>();
const bytes=(s:string)=>s.length/4*3-(s.endsWith("==")?2:s.endsWith("=")?1:0);
function fields(m:SurroundingPackedMesh):string[]|null {
  if(!m||typeof m!=="object")return null;
  const values:string[]=[];
  for(const key of ["positions","colors","indices"]){
    const d=Object.getOwnPropertyDescriptor(m,key);
    if(!d||!("value"in d)||typeof d.value!=="string"||d.value.length>2_000_000||d.value.length%4||/[^A-Za-z0-9+/=]/.test(d.value))return null;
    values.push(d.value);
  }
  return values;
}
function* hash(values:string[]):Generator<void,number>{
  let h=2166136261;
  for(const s of values)for(let start=0;start<s.length;start+=65536){
    for(let i=start;i<Math.min(start+65536,s.length);i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
    yield;
  }
  return h;
}
function prior(chunk:SurroundingCityChunk):Plan|undefined{
  const d=Object.getOwnPropertyDescriptor(chunk,tokenKey);
  return d&&"value"in d&&d.value&&typeof d.value==="object"?admissions.get(d.value):undefined;
}
/** Exact one-packet receipt. Originals remain unchanged and available; only
 * admitted ground triangles retire after their complete complements are ready. */
export function* prepareTempelhoferFieldV345(chunk:SurroundingCityChunk,id:string,native=false):Generator<void,SurroundingCityChunk>{
  if(id!=="ring182-2_9"||Object.getOwnPropertyDescriptor(chunk,"id")?.value!==id||prior(chunk))return chunk;
  const p=source.plans[native?"minecraft":"drawn"];
  if(source.schemaVersion!==1||!p.parts.length||chunk.meshes.length!==p.source.length||chunk.meshes.length+p.parts.length>16||
    p.origin.some((v,i)=>v!==chunk.origin[i])||(yield*streetCurvesNavigationGuardV276(chunk.nav))!==p.navGuard)return chunk;
  for(let i=0;i<p.source.length;i++){
    const m=chunk.meshes[i],f=fields(m);
    if(!f||m.kind!==p.source[i].kind||m.positionType!=="u16cm"||bytes(f[0])%6||bytes(f[1])!==bytes(f[0])/2||bytes(f[2])%12||(yield*hash(f))!==p.source[i].fingerprint)return chunk;
  }
  let last=-1;
  for(const part of p.parts){
    const old=chunk.meshes[part.mesh],f=fields(part.append as SurroundingPackedMesh);
    if(!Number.isSafeInteger(part.mesh)||part.mesh<=last||!old||!part.remove.length||
      part.remove.some((v,i)=>!Number.isSafeInteger(v)||v<0||v>=bytes(old.indices)/12||(i>0&&v<=part.remove[i-1]))||
      !f||part.append.kind!=="city"||part.append.positionType!=="u16cm"||!bytes(f[0])||bytes(f[0])%6||bytes(f[1])!==bytes(f[0])/2||!bytes(f[2])||bytes(f[2])%12||
      bytes(f[0])+bytes(f[1])+bytes(f[2])>500_000||(yield*hash(f))!==part.fingerprint)return chunk;
    const ix=atob(f[2]),vertices=bytes(f[0])/6;
    for(let i=0;i<ix.length;i+=4){
      const v=(ix.charCodeAt(i)|ix.charCodeAt(i+1)<<8|ix.charCodeAt(i+2)<<16|ix.charCodeAt(i+3)<<24)>>>0;
      if(v>=vertices)return chunk;
      if(i%65536===65532)yield;
    }
    last=part.mesh;
  }
  const token={};admissions.set(token,p);
  const result={...chunk,meshes:[...chunk.meshes,...p.parts.map(q=>q.append as SurroundingPackedMesh)],[tokenKey]:token};
  return result;
}
export function* applyTempelhoferFieldV345(chunk:SurroundingCityChunk,mesh:number,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{
  const part=prior(chunk)?.parts.find(p=>p.mesh===mesh);if(!part)return 0;
  for(let i=0;i<part.remove.length;i++){
    const at=offset+part.remove[i]*3;
    if(at<0||at+2>=indices.length)throw Error("Tempelhofer Feld ground destination differs from its receipt");
    indices[at+1]=indices[at];indices[at+2]=indices[at];if(i%512===511)yield;
  }
  return part.remove.length;
}
export function bindTempelhoferFieldV345(root:Group,chunk:SurroundingCityChunk,native:boolean):void {
  if(prior(chunk))roots.set(root,native);
}
/** Same NW/SE triangle planes, centimetre heights and Native cell centres as
 * rendered ground. A failed receipt, road, apron or outside point gets no floor. */
export function tempelhoferFieldGroundAtV345(root:Group,x:number,z:number):number|null {
  const native=roots.get(root);if(native===undefined||!Number.isFinite(x)||!Number.isFinite(z))return null;
  const [w,n,e,s]=source.bounds;if(x<w||x>=e||z<n||z>=s)return null;
  const row=Math.floor(z/4)*4;
  if(!source.runs.some(r=>r[0]===row&&x>=r[1]&&x<r[2]))return null;
  if(native){x=Math.floor(x/4)*4+2;z=row+2;}
  const u=(x-w)/4,v=(z-n)/4,i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
  const nw=source.offsets[j][i],se=source.offsets[j+1][i+1],edge=source.offsets[j+(a>=b?0:1)][i+(a>=b?1:0)];
  const delta=nw*(1-Math.max(a,b))+edge*Math.abs(a-b)+se*Math.min(a,b);
  return 3.01+(native?Math.round(delta*100)/100:delta);
}
