import receipt from './data/panoramaFacadeV202.json';
import type { SurroundingPackedMesh } from './SurroundingCityGeometry';

/** Replace only the old owner's exact baked window recipe, leaving all source
 * arrays and every unrelated triangle unchanged. Hashing shares decode yields. */
export function* replacePanoramaFacadeV202(tile: string, native: boolean,
  part: SurroundingPackedMesh, indices: Uint16Array | Uint32Array, offset: number): Generator<void, number> {
  const record = receipt.records.find(r => r.tile === tile && r.kind === part.kind &&
    r.mode === (native ? 'minecraft' : 'drawn'));
  if (!record) return 0;
  let fingerprint = 2166136261;
  for (const text of [part.positions,part.colors,part.indices]) {
    for (let start=0;start<text.length;start+=65536) {
      for(let i=start;i<Math.min(text.length,start+65536);i++)
        fingerprint=Math.imul(fingerprint^text.charCodeAt(i),16777619)>>>0;
      yield;
    }
  }
  // A changed future packet must be audited again, never broadly filtered.
  if(fingerprint!==record.fingerprint)return 0;
  for(const triangle of record.triangles){
    const i=offset+triangle*3;
    indices[i+1]=indices[i];indices[i+2]=indices[i];
  }
  return record.triangles.length;
}
