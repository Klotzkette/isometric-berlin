import data from "./data/littenStadthausV297Packets.json";
import type {SurroundingCityChunk,SurroundingPackedMesh} from "./SurroundingCityGeometry";

type Receipt={origin:number[];records:{mesh:number;fingerprint:number;triangles:number[]}[];complement:SurroundingPackedMesh;complementFingerprint:number;openingCount:number;sourceOwner:string;sourcePart:string;sourceSurfaceIndex:number};
type Evidence={schema:number;keys:string[];packets:Record<string,Receipt>};
const source=data as unknown as Evidence,keys=new Set(source.keys);
const admission=Symbol("Private complete Litten v297 packet admission");
const prepared=new WeakMap<object,{receipt:Receipt;original:SurroundingCityChunk}>();
const priorAdmission=(chunk:SurroundingCityChunk):{receipt:Receipt;original:SurroundingCityChunk}|undefined=>{
  const d=Object.getOwnPropertyDescriptor(chunk,admission);return d&&"value"in d&&d.value&&typeof d.value==="object"?prepared.get(d.value):undefined;
};
const bytes=(value:string):number=>value.length/4*3-(value.endsWith("==")?2:value.endsWith("=")?1:0);
const strings=(mesh:SurroundingPackedMesh):string[]|null=>{
  if(!mesh||typeof mesh!=="object")return null;
  const out:string[]=[];
  for(const key of["positions","colors","indices"]as const){const d=Object.getOwnPropertyDescriptor(mesh,key);if(!d||!("value"in d)||typeof d.value!=="string"||d.value.length%4||d.value.length>16*1024*1024)return null;out.push(d.value);}
  return out;
};
function* fingerprint(parts:string[]):Generator<void,number>{let h=2166136261;for(const text of parts)for(let start=0;start<text.length;start+=65536){for(let i=start;i<Math.min(start+65536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}return h;}

/** Exact finite keys only. This also lets the existing controller retry a
 * previously resident drawn facade when its required owner becomes ready. */
export function littenStadthausPacketCandidateV297(id:string,native=false):boolean{return keys.has(`${native?"minecraft":"drawn"}:${id}`);}

/** Default-off complete transfer of one old generic estimate. The replacement
 * is appended before any exact old fitting index is allowed to degenerate.
 * Drawn source walls/roofs and native occupied surfaces remain complete. */
export function* prepareLittenStadthausV297(chunk:SurroundingCityChunk,id:string,native=false,ownersReady=false):Generator<void,SurroundingCityChunk>{
  const prior=priorAdmission(chunk);
  if(!ownersReady)return prior?.original??chunk;
  if(prior)return chunk;
  const key=`${native?"minecraft":"drawn"}:${id}`;
  if(!keys.has(key)||source.schema!==1||!Object.hasOwn(source.packets,key))return chunk;
  const r=source.packets[key];
  if(r.openingCount!==21||r.sourceOwner!=="DEBE01YYK00002Vr"||r.sourcePart!==r.sourceOwner||r.sourceSurfaceIndex!==33||r.origin.length!==3||r.origin.some((v,i)=>!Number.isFinite(v)||chunk.origin[i]!==v))return chunk;
  if(r.complement.kind!=="podewil-complete-principal-front-v297")return chunk;
  const full=strings(r.complement);
  if(!full||bytes(full[0])%6||bytes(full[1])!==bytes(full[0])/2||bytes(full[2])%12||bytes(full[2])===0||(yield* fingerprint(full))!==r.complementFingerprint)return chunk;
  for(const rec of r.records){
    const m=chunk.meshes[rec.mesh],parts=strings(m);
    if(!parts||m.kind!=="alt-mitte-v169"||bytes(parts[2])%12||(yield* fingerprint(parts))!==rec.fingerprint||new Set(rec.triangles).size!==rec.triangles.length||rec.triangles.some(t=>!Number.isSafeInteger(t)||t<0||t>=bytes(parts[2])/12))return chunk;
  }
  if(!r.records.length||!r.records.some(r=>r.triangles.length))return chunk;
  // The private admitted token survives the ordinary shallow packet copies of
  // later independent preparers. JSON/public-property copies cannot forge it.
  const token={},next={...chunk,meshes:[...chunk.meshes,r.complement],[admission]:token};prepared.set(token,{receipt:r,original:chunk});return next;
}

/** Edits only decoder-owned destination indices. Input packet bytes are intact. */
export function* applyLittenStadthausTrianglesV297(chunk:SurroundingCityChunk,mesh:number,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{
  const r=priorAdmission(chunk)?.receipt;if(!r||!chunk.meshes.includes(r.complement))return 0;let count=0;
  for(const rec of r.records)if(rec.mesh===mesh)for(const triangle of rec.triangles){const i=offset+triangle*3;if(i+2>=indices.length)throw Error("Litten v297 receipt exceeds its exact packet");indices[i+1]=indices[i];indices[i+2]=indices[i];if(++count%1024===0)yield;}
  return count;
}
