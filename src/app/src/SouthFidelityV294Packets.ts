import data from "./data/southFidelityV294Packets.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Receipt = {
  origin: number[];
  records: { mesh: number; fingerprint: number; triangles: number[] }[];
  segments: number[]; lineFingerprint: number | null;
  navigationRecords: { owner: string; original: SurroundingNavigation["buildings"][number]; groundY: number }[];
  navigationSolids: { ring: number[][]; holes: number[][][]; minY: number; maxY: number }[];
  complement?: SurroundingPackedMesh | null;
};
export type SouthFidelityPacketEvidenceV294 = { schema: number; keys: readonly string[]; packets: Record<string, Receipt> };
type Prepared = SurroundingCityChunk & { southFidelityV294?: Receipt };
const source = data as unknown as SouthFidelityPacketEvidenceV294;
const keys = new Set(source.keys);
const bytes=(s:string)=>s.length/4*3-(s.endsWith("==")?2:s.endsWith("=")?1:0);
function equal(a:unknown,b:unknown):boolean {
  if(a===b)return true;if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&equal(x[k],y[k]));
}
function* fingerprint(parts:string[]):Generator<void,number>{let h=2166136261;for(const text of parts)for(let start=0;start<text.length;start+=65536){for(let i=start;i<Math.min(start+65536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}return h;}

/** The independently complete required NKZ owner must already be attached.
 * Changed source indices, neighbouring owners or navigation fail closed. */
export function* prepareSouthFidelityV294(chunk:SurroundingCityChunk,id:string,native=false,ownersReady=false,evidence:SouthFidelityPacketEvidenceV294=source):Generator<void,SurroundingCityChunk>{
  const key=`${native?"minecraft":"drawn"}:${id}`;
  if(!ownersReady||(chunk as Prepared).southFidelityV294||(!keys.has(key)&&evidence===source)||evidence.schema!==1||!Object.hasOwn(evidence.packets,key))return chunk;
  const r=evidence.packets[key];if(!equal(r.origin,chunk.origin))return chunk;
  for(const rec of r.records){const m=chunk.meshes[rec.mesh];if(!m||(yield* fingerprint([m.positions,m.colors,m.indices]))!==rec.fingerprint||rec.triangles.some(t=>!Number.isSafeInteger(t)||t<0||t>=bytes(m.indices)/12))return chunk;}
  if(r.segments.length&&(!chunk.lines||(yield* fingerprint([chunk.lines.positions,chunk.lines.colors??""]))!==r.lineFingerprint))return chunk;
  for(const rec of r.navigationRecords)if(chunk.nav.groundY!==rec.groundY||!chunk.nav.buildings.some(b=>b.sourceId===rec.owner&&equal(b,rec.original)))return chunk;
  return{...chunk,meshes:r.complement?[...chunk.meshes,r.complement]:chunk.meshes,southFidelityV294:r} as Prepared;
}
export function* applySouthFidelityTrianglesV294(chunk:SurroundingCityChunk,mesh:number,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{
  const r=(chunk as Prepared).southFidelityV294;if(!r)return 0;let n=0;
  for(const rec of r.records)if(rec.mesh===mesh)for(const triangle of rec.triangles){const i=offset+triangle*3;if(i+2>=indices.length)throw Error("South source receipt exceeds packet");indices[i+1]=indices[i];indices[i+2]=indices[i];if(++n%1024===0)yield;}return n;
}
export function* applySouthFidelityLinesV294(chunk:SurroundingCityChunk,positions:Uint16Array,stride:number):Generator<void,number>{
  const r=(chunk as Prepared).southFidelityV294;if(!r)return 0;let n=0;
  for(const seg of r.segments){const i=seg*2*stride;if(i+stride+2>=positions.length)throw Error("South line receipt exceeds packet");positions[i+stride]=positions[i];positions[i+stride+1]=positions[i+1];positions[i+stride+2]=positions[i+2];if(++n%1024===0)yield;}return n;
}
export function southFidelityNavigationV294(chunk:SurroundingCityChunk,nav:SurroundingNavigation):SurroundingNavigation {
  const r=(chunk as Prepared).southFidelityV294;if(!r)return nav;
  return{...nav,buildings:[...nav.buildings.filter(b=>!r.navigationRecords.some(rec=>rec.groundY===nav.groundY&&rec.owner===b.sourceId&&equal(b,rec.original))),...r.navigationSolids.map((s,i)=>({ring:s.ring,holes:s.holes,minHeight:s.minY-nav.groundY,height:s.maxY-nav.groundY,sourceId:`south-v294-nkz-${i}`}))]};
}
