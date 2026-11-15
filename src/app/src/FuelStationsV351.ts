/** Source-bound canopy repairs. Each requested host owns its complete receipt. */
import type { SourceQuarterCatalogueEntryV309 } from './SourceQuarterCatalogueV309';
import type { SourceQuarterSourceV303, SourceQuarterPlanV303 } from './SourceQuarterPacketV303';
import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { releaseScratchBuffer } from './releaseScratchBuffer';
import index from './data/fuelStationsV351Index.json';

export const FUEL_STATIONS_KIND_V351 = 'fuel-stations-v351';
export function fuelStationSourceV351(compressed: Uint8Array, keys: readonly string[], decodedBytes: number): SourceQuarterSourceV303 {
 if (keys.length > 16 || new Set(keys).size !== keys.length || !Number.isSafeInteger(decodedBytes) || decodedBytes < 1 || decodedBytes > 2 * 1024 * 1024 || compressed.length < 18 || compressed.length > 512 * 1024) throw Error('Invalid bounded fuel source');
 let cached: WeakRef<SourceQuarterSourceV303> | undefined;
 const source = () => {
  let value = cached?.deref();
  if (!value) {
   const declared = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength).getUint32(compressed.length - 4, true);
   if (declared !== decodedBytes) throw Error('Fuel source decoded size changed');
   const output = new Uint8Array(decodedBytes + 1);
   try {
    const bytes = gunzipSync(compressed, {out: output});
    if (bytes.length !== decodedBytes) throw Error('Fuel source length changed');
    value = JSON.parse(new TextDecoder().decode(bytes)) as SourceQuarterSourceV303;
   } finally { releaseScratchBuffer(output.buffer); }
   if (value.schemaVersion !== 1 || !Array.isArray(value.keys) || value.keys.length !== keys.length || keys.some((k, i) => value!.keys[i] !== k || !Object.hasOwn(value!.packets, k)) || Object.keys(value.packets).length !== keys.length) throw Error('Incomplete fuel source');
   cached = new WeakRef(value);
  }
  return value;
 };
 const packets: Record<string, SourceQuarterPlanV303> = {};
 for (const key of keys) Object.defineProperty(packets, key, {enumerable: true, get: () => source().packets[key]});
 return {schemaVersion: 1, keys: [...keys], packets};
}
let loaders: Record<string, () => Promise<unknown>> = {};
try { loaders = import.meta.glob('./data/fuelStationsV351Packets[0-9][0-9][0-9].json.gz', {query: '?url', import: 'default'}); }
catch { /* Bun uses the same immutable local gzip source for offline checks. */ }
export const fuelStationsEntriesV351: SourceQuarterCatalogueEntryV309[] = index.sources.map(({file, keys, decodedBytes}) => ({
 kind: FUEL_STATIONS_KIND_V351, keys,
 load: async () => {
  const path = './data/' + file, loader = loaders[path];
  const url = loader ? await loader() as string : new URL(path, import.meta.url).href;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Fuel source ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (length > 512 * 1024) throw Error('Fuel source exceeds bounded transfer');
  return {default: fuelStationSourceV351(new Uint8Array(await response.arrayBuffer()), keys, decodedBytes)};
 },
}));
