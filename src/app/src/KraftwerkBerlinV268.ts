import data from './data/kraftwerkBerlinV268.json';
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from './SurroundingCityGeometry';

type Transfer = { mesh: number; kind: string; fingerprint: number; triangles: number[] };
type Receipt = { origin: number[]; records: Transfer[]; navigationFingerprint: number;
  replacement: SurroundingPackedMesh; replacementFingerprint: number;
  buildings: SurroundingNavigation['buildings'] };
export type KraftwerkBerlinSourceV268 = { schema: number; keys: string[]; packets: Record<string, Receipt> };
type Prepared = SurroundingCityChunk & { kraftwerkBerlinV268?: Receipt };
const source = data as KraftwerkBerlinSourceV268;
const known = new Set(source.keys);
export const KRAFTWERK_BERLIN_V268_KIND = 'kraftwerk-berlin-v268';
export const KRAFTWERK_BERLIN_V268_PROFILE = data.profile;
const OWNER = 'DEBE01YYK00002yj';
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

function* fingerprint(parts: readonly string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start=0;start<text.length;start+=65_536) {
    for (let i=start;i<Math.min(text.length,start+65_536);i++) value=Math.imul(value^text.charCodeAt(i),16777619)>>>0;
    yield;
  }
  return value;
}

/** Existing 6_1 packet transaction: complete measured drawn shells stay in place.
 * Exact false facade recipes yield only after their complete required industrial
 * replacement is admitted. Native preserves the complete source-sheet reading.
 * Run after immutable preparers; unrelated additional meshes are accepted. */
export function* prepareKraftwerkBerlinV268(chunk: SurroundingCityChunk,id: string,native=false,
  evidence: KraftwerkBerlinSourceV268=source): Generator<void,SurroundingCityChunk> {
  const key=`${native?'minecraft':'drawn'}:${id}`;
  if(evidence===source&&!known.has(key))return chunk;
  if(!Object.prototype.hasOwnProperty.call(evidence.packets,key)||chunk.meshes.some(m=>m.kind===KRAFTWERK_BERLIN_V268_KIND))return chunk;
  const r=evidence.packets[key], added=r.replacement;
  if(evidence.schema!==1||!added||added.kind!==KRAFTWERK_BERLIN_V268_KIND||added.positionType!=='u16cm'||
    r.origin.length!==3||r.origin.some((v,i)=>v!==chunk.origin[i])||chunk.meshes.length>=16||!r.records.length||
    !chunk.nav.buildings.some(b=>b.sourceId===OWNER)||r.buildings.length!==2||
    r.buildings.some(b=>!b.sourceId.startsWith('kraftwerk-v268-way/')||b.height!==100||b.minHeight!==42||b.holes.length!==1))return chunk;
  if(chunk.meshes.reduce((n,m)=>n+bytes(m.positions)/6,bytes(added.positions)/6)>400_000||
    chunk.meshes.reduce((n,m)=>n+bytes(m.indices)/4,bytes(added.indices)/4)>2_400_000)return chunk;
  for(const rec of r.records){
    const m=chunk.meshes[rec.mesh];
    if(!m||m.kind!==rec.kind||m.kind!=='alt-mitte-v169'||
      (yield* fingerprint([m.positions,m.colors,m.indices]))!==rec.fingerprint||
      rec.triangles.some(t=>!Number.isSafeInteger(t)||t<0||t>=bytes(m.indices)/12))return chunk;
  }
  if((yield* fingerprint([JSON.stringify(chunk.nav)]))!==r.navigationFingerprint||
    (yield* fingerprint([added.positions,added.colors,added.indices]))!==r.replacementFingerprint)return chunk;
  return {...chunk,meshes:[...chunk.meshes,added],kraftwerkBerlinV268:r} as Prepared;
}

function receipt(chunk: SurroundingCityChunk): Receipt|undefined {
  const r=(chunk as Prepared).kraftwerkBerlinV268;
  return r&&chunk.meshes.includes(r.replacement)?r:undefined;
}

/** Original encoded streams are immutable; only exact decoded recipe indices yield. */
export function* applyKraftwerkBerlinV268Triangles(chunk: SurroundingCityChunk,mesh: number,
  indices: Uint16Array|Uint32Array,offset: number): Generator<void,number> {
  const r=receipt(chunk);if(!r)return 0;
  let count=0;
  for(const rec of r.records)if(rec.mesh===mesh)for(const t of rec.triangles){
    const at=offset+t*3;
    if(at+2>=indices.length)throw new Error('Kraftwerk facade transfer exceeds original decoded indices');
    indices[at+1]=indices[at];indices[at+2]=indices[at];
    if(++count%1024===0)yield;
  }
  return count;
}

/** Keep every original owner/ground record. Upper stack annuli retain their open
 * inner holes for collision and roof sampling, matching the visible mouth rims. */
export function kraftwerkBerlinNavigationV268(chunk: SurroundingCityChunk,nav: SurroundingNavigation): SurroundingNavigation {
  const r=receipt(chunk);if(!r)return nav;
  const ids=new Set(nav.buildings.map(b=>b.sourceId));
  const additions=r.buildings.filter(b=>!ids.has(b.sourceId));
  return additions.length?{...nav,buildings:[...nav.buildings,...additions]}:nav;
}
