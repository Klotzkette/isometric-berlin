import data from './data/tachelesFrontsV270Receipts.json';
import type { SurroundingCityChunk } from './SurroundingCityGeometry';
type Record = {mesh:number;kind:string;fingerprint:number;triangles:number[]};
type Receipt = {origin:number[];records:Record[]};
export type TachelesFrontReceiptsV270 = {schema:number;keys:string[];packets:{[key:string]:Receipt}};
const source=data as TachelesFrontReceiptsV270;
const known=new Set(source.keys);
type Prepared=SurroundingCityChunk&{tachelesFrontsV270?:Receipt};
function* fingerprint(parts:readonly string[]):Generator<void,number>{
 let hash=2166136261;
 for(const part of parts)for(let start=0;start<part.length;start+=65536){
  for(let i=start;i<Math.min(start+65536,part.length);i++)hash=Math.imul(hash^part.charCodeAt(i),16777619)>>>0;
  yield;
 }
 return hash;
}
const bytes=(s:string)=>s.length/4*3-(s.endsWith('==')?2:s.endsWith('=')?1:0);
/** Retirement requires the complete required replacement transaction to be ready.
 * Keep encoded originals intact for every prior preparer and interrupted build. */
export function* prepareTachelesFrontsV270(chunk:SurroundingCityChunk,id:string,native=false,requiredReady=false,evidence:TachelesFrontReceiptsV270=source):Generator<void,SurroundingCityChunk>{
 if(!requiredReady||(chunk as Prepared).tachelesFrontsV270)return chunk;
 const key=`${native?'minecraft':'drawn'}:${id}`;
 if(evidence===source&&!known.has(key))return chunk;
 const r=Object.prototype.hasOwnProperty.call(evidence.packets,key)?evidence.packets[key]:undefined;
 if(evidence.schema!==1||!r||r.origin.length!==3||r.origin.some((v,i)=>v!==chunk.origin[i])||!r.records.length)return chunk;
 const meshes=new Set<number>();
 for(const row of r.records){
  const m=chunk.meshes[row.mesh];
  if(!Number.isSafeInteger(row.mesh)||row.mesh<0||meshes.has(row.mesh)||!m||!['mitte-street-fronts-v166','oranien-corridors-v167'].includes(row.kind)||m.kind!==row.kind||!row.triangles.length||new Set(row.triangles).size!==row.triangles.length||row.triangles.some(t=>!Number.isSafeInteger(t)||t<0||t>=bytes(m.indices)/12))return chunk;
  if((yield* fingerprint([m.positions,m.colors,m.indices]))!==row.fingerprint)return chunk;
  meshes.add(row.mesh);
 }
 return {...chunk,tachelesFrontsV270:r} as Prepared;
}
/** Retire only receipted decoded triangles; all source positions/colours stay. */
export function* applyTachelesFrontsV270Triangles(chunk:SurroundingCityChunk,mesh:number,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{
 const r=(chunk as Prepared).tachelesFrontsV270;if(!r)return 0;
 let count=0;
 for(const row of r.records)if(row.mesh===mesh)for(const triangle of row.triangles){
  const i=offset+triangle*3;
  if(i+2>=indices.length)throw new Error('Tacheles facade receipt exceeds source indices');
  indices[i+1]=indices[i];indices[i+2]=indices[i];
  if(++count%1024===0)yield;
 }
 return count;
}
