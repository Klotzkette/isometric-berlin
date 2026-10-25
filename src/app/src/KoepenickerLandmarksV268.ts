import data from './data/koepenickerLandmarksV268.json';
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from './SurroundingCityGeometry';

type Transfer = { mesh: number; fingerprint: number; triangles: number[] };
type Receipt = { origin: number[]; records: Transfer[]; lineFingerprint: number | null; segments: number[];
  navigationFingerprint: number; replacement: SurroundingPackedMesh; replacementFingerprint: number;
  buildings: (SurroundingNavigation['buildings'][number] & { partId: string })[] };
export type KoepenickerLandmarksSourceV268 = { schema: number; keys: string[]; packets: Record<string, Receipt> };
type Prepared = SurroundingCityChunk & { koepenickerLandmarksV268?: Receipt };
const source = data as KoepenickerLandmarksSourceV268;
const known = new Set(source.keys);
export const KOEPENICKER_LANDMARKS_V268_KIND = 'koepenicker-landmarks-v268';
export const KOEPENICKER_LANDMARKS_V268_PROFILE = data.profile;
const OWNER = 'DEBE02YY400000KE';
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

function* fingerprint(parts: readonly string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65_536) {
    for (let i = start; i < Math.min(text.length,start + 65_536); i++) value = Math.imul(value ^ text.charCodeAt(i),16777619) >>> 0;
    yield;
  }
  return value;
}

/** Complete eleven-part source replacement in the existing packet lifetime.
 * Unchanged original streams remain available to every earlier receipt. Extra
 * meshes are permitted, so ordinary street preparations can precede this step. */
export function* prepareKoepenickerLandmarksV268(chunk: SurroundingCityChunk,id: string,native = false,
  evidence: KoepenickerLandmarksSourceV268 = source): Generator<void, SurroundingCityChunk> {
  const key = `${native ? 'minecraft' : 'drawn'}:${id}`;
  if (evidence === source && !known.has(key)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets,key) || chunk.meshes.some(m=>m.kind===KOEPENICKER_LANDMARKS_V268_KIND)) return chunk;
  const r = evidence.packets[key], replacement = r.replacement;
  if (evidence.schema!==1 || !replacement || replacement.kind!==KOEPENICKER_LANDMARKS_V268_KIND || replacement.positionType!=='u16cm' ||
      r.origin.some((v,i)=>v!==chunk.origin[i]) || chunk.meshes.length>=16 || !r.records.length ||
      !r.buildings.length || r.buildings.some(b=>b.sourceId!==OWNER || !b.partId || !Number.isFinite(b.height)) ||
      !chunk.nav.buildings.some(b=>b.sourceId===OWNER)) return chunk;
  if (chunk.meshes.reduce((n,m)=>n+bytes(m.positions)/6,bytes(replacement.positions)/6)>400_000 ||
      chunk.meshes.reduce((n,m)=>n+bytes(m.indices)/4,bytes(replacement.indices)/4)>2_400_000) return chunk;
  for (const record of r.records) {
    const part=chunk.meshes[record.mesh];
    if (!part || part.kind!=='city' || (yield* fingerprint([part.positions,part.colors,part.indices]))!==record.fingerprint ||
        record.triangles.some(t=>!Number.isSafeInteger(t)||t<0||t>=bytes(part.indices)/12)) return chunk;
  }
  if (r.segments.length && (!chunk.lines || (yield* fingerprint([chunk.lines.positions,chunk.lines.colors??'']))!==r.lineFingerprint ||
      r.segments.some(s=>!Number.isSafeInteger(s)||s<0||s>=bytes(chunk.lines!.positions)/12))) return chunk;
  if ((yield* fingerprint([JSON.stringify(chunk.nav)]))!==r.navigationFingerprint ||
      (yield* fingerprint([replacement.positions,replacement.colors,replacement.indices]))!==r.replacementFingerprint) return chunk;
  return {...chunk,meshes:[...chunk.meshes,replacement],koepenickerLandmarksV268:r} as Prepared;
}

function receipt(chunk: SurroundingCityChunk): Receipt | undefined {
  const r=(chunk as Prepared).koepenickerLandmarksV268;
  return r && chunk.meshes.includes(r.replacement) ? r : undefined;
}

export function* applyKoepenickerLandmarksV268Triangles(chunk: SurroundingCityChunk,mesh: number,
  indices: Uint16Array|Uint32Array,offset: number): Generator<void, number> {
  const r=receipt(chunk); if(!r)return 0;
  let changed=0;
  for(const record of r.records)if(record.mesh===mesh)for(const triangle of record.triangles){
    const at=offset+triangle*3;
    if(at+2>=indices.length)throw new Error('Heeresbaeckerei transfer exceeds decoded source');
    indices[at+1]=indices[at];indices[at+2]=indices[at];
    if(++changed%1024===0)yield;
  }
  return changed;
}

export function* applyKoepenickerLandmarksV268Lines(chunk: SurroundingCityChunk,values: Uint16Array,stride: number): Generator<void, number> {
  const r=receipt(chunk);if(!r)return 0;
  let changed=0;
  for(const segment of r.segments){
    const at=segment*2*stride;
    if(at+stride+2>=values.length)throw new Error('Heeresbaeckerei transfer exceeds decoded source ink');
    values[at+stride]=values[at];values[at+stride+1]=values[at+1];values[at+stride+2]=values[at+2];
    if(++changed%1024===0)yield;
  }
  return changed;
}

export function koepenickerLandmarksNavigationV268(chunk: SurroundingCityChunk,nav: SurroundingNavigation): SurroundingNavigation {
  const r=receipt(chunk);if(!r)return nav;
  return {...nav,buildings:[...nav.buildings.filter(b=>b.sourceId!==OWNER),...r.buildings]};
}
