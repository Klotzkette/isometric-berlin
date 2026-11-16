/** Finite Düppel hut/material corrections and source-supported Kunsthaus café furniture. Host-owned lifetime and complete exact-source receipts. */
import type { SourceQuarterCatalogueEntryV309 } from './SourceQuarterCatalogueV309';
import type { SourceQuarterSourceV303, SourceQuarterPlanV303 } from './SourceQuarterPacketV303';
import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { releaseScratchBuffer } from './releaseScratchBuffer';
import index from './data/museumsSouthwestV354Index.json';

export const MUSEUMS_SOUTHWEST_KIND_V354 = 'museums-southwest-v354';
/** Floor exists only while the exact southern village recipe is resident. */
export function dueppelVillageFloorV354(owners: unknown, x: number, z: number, native: boolean): number | null {
 if (!Array.isArray(owners) || !owners.includes(MUSEUMS_SOUTHWEST_KIND_V354 + ':dueppel')) return null;
 const ground = index.ground.find(g => g.independentNative === native);
 if (!ground) return null;
 const inside = (ring: readonly (readonly number[])[]) => {
  let hit = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
   const a=ring[i], b=ring[j];
   if ((a[1]>z)!==(b[1]>z) && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
 };
 return ground.coverage.some(p => inside(p.ring) && !p.holes.some(inside)) ? ground.floorY : null;
}
export function museumsSouthwestSourceV354(compressed: Uint8Array, keys: readonly string[], decodedBytes: number): SourceQuarterSourceV303 {
 if (keys.length > 16 || new Set(keys).size !== keys.length || !Number.isSafeInteger(decodedBytes) || decodedBytes < 1 || decodedBytes > 2 * 1024 * 1024 || compressed.length < 18 || compressed.length > 512 * 1024) throw Error('Invalid bounded MuseumsSouthwest source');
 let cached: WeakRef<SourceQuarterSourceV303> | undefined;
 const source = () => {
  let value = cached?.deref();
  if (!value) {
   const declared = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength).getUint32(compressed.length - 4, true);
   if (declared !== decodedBytes) throw Error('MuseumsSouthwest source decoded size changed');
   const output = new Uint8Array(decodedBytes + 1);
   try {
    const bytes = gunzipSync(compressed, {out: output});
    if (bytes.length !== decodedBytes) throw Error('MuseumsSouthwest source length changed');
    value = JSON.parse(new TextDecoder().decode(bytes)) as SourceQuarterSourceV303;
   } finally { releaseScratchBuffer(output.buffer); }
   if (value.schemaVersion !== 1 || !Array.isArray(value.keys) || value.keys.length !== keys.length || keys.some((k, i) => value!.keys[i] !== k || !Object.hasOwn(value!.packets, k)) || Object.keys(value.packets).length !== keys.length) throw Error('Incomplete MuseumsSouthwest source');
   cached = new WeakRef(value);
  }
  return value;
 };
 const packets: Record<string, SourceQuarterPlanV303> = {};
 for (const key of keys) Object.defineProperty(packets, key, {enumerable: true, get: () => source().packets[key]});
 return {schemaVersion: 1, keys: [...keys], packets};
}
const keys = index.keys;
export const museumsSouthwestPacketV354: SourceQuarterCatalogueEntryV309 = {
 kind: MUSEUMS_SOUTHWEST_KIND_V354, keys,
 load: async () => {
  const url = new URL('./data/museumsSouthwestV354Packets.json.gz', import.meta.url).href;
  const response = await fetch(url);
  if (!response.ok) throw Error(`MuseumsSouthwest source ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (length > 512 * 1024) throw Error('MuseumsSouthwest source exceeds bounded transfer');
  return {default: museumsSouthwestSourceV354(new Uint8Array(await response.arrayBuffer()), keys, index.decodedBytes)};
 },
};

export const museumsSouthwestV354Entries = [museumsSouthwestPacketV354];
