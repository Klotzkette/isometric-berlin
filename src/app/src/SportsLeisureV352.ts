/** Mapped pool/rink edges and supported open goals in existing packet lifetimes. */
import type { SourceQuarterCatalogueEntryV309 } from './SourceQuarterCatalogueV309';
import type { NeighbourhoodSourceV300, NeighbourhoodPlanV300 } from './NeighbourhoodPacketV300';
import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { releaseScratchBuffer } from './releaseScratchBuffer';
import index from './data/sportsLeisureV352Index.json';

export const SPORTS_LEISURE_KIND_V352 = 'sports-leisure-v352';
export function sportsLeisureSourceV352(compressed: Uint8Array, keys: readonly string[], decodedBytes: number): NeighbourhoodSourceV300 {
 if (keys.length > 16 || new Set(keys).size !== keys.length || !Number.isSafeInteger(decodedBytes) || decodedBytes < 1 || decodedBytes > 2 * 1024 * 1024 || compressed.length < 18 || compressed.length > 512 * 1024) throw Error('Invalid bounded sports/leisure source');
 let cached: WeakRef<NeighbourhoodSourceV300> | undefined;
 const source = () => {
  let value = cached?.deref();
  if (!value) {
   const declared = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength).getUint32(compressed.length - 4, true);
   if (declared !== decodedBytes) throw Error('Sports/leisure source decoded size changed');
   const output = new Uint8Array(decodedBytes + 1);
   try {
    const bytes = gunzipSync(compressed, {out: output});
    if (bytes.length !== decodedBytes) throw Error('Sports/leisure source length changed');
    value = JSON.parse(new TextDecoder().decode(bytes)) as NeighbourhoodSourceV300;
   } finally { releaseScratchBuffer(output.buffer); }
   if (value.schemaVersion !== 1 || !Array.isArray(value.keys) || value.keys.length !== keys.length || keys.some((k, i) => value!.keys[i] !== k || !Object.hasOwn(value!.packets, k)) || Object.keys(value.packets).length !== keys.length) throw Error('Incomplete sports/leisure source');
   for(const key of keys){const plan=value.packets[key];if(plan.retire.length||plan.append.kind!==SPORTS_LEISURE_KIND_V352)throw Error('Sports detail may only append its own mesh');}
   cached = new WeakRef(value);
  }
  return value;
 };
 const packets: Record<string, NeighbourhoodPlanV300> = {};
 for (const key of keys) Object.defineProperty(packets, key, {enumerable: true, get: () => source().packets[key]});
 return {schemaVersion: 1, keys: [...keys], packets};
}
let loaders: Record<string, () => Promise<unknown>> = {};
try { loaders = import.meta.glob('./data/sportsLeisureV352Packets[0-9][0-9][0-9].json.gz', {query: '?url', import: 'default'}); }
catch { /* Bun uses the same immutable local gzip source for offline checks. */ }
export const sportsLeisureEntriesV352: SourceQuarterCatalogueEntryV309[] = index.sources.map(({file, keys, decodedBytes}) => ({
 kind: SPORTS_LEISURE_KIND_V352, keys,
 load: async () => {
  const path = './data/' + file, loader = loaders[path];
  const url = loader ? await loader() as string : new URL(path, import.meta.url).href;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Sports/leisure source ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (length > 512 * 1024) throw Error('Sports/leisure source exceeds bounded transfer');
  return {default: sportsLeisureSourceV352(new Uint8Array(await response.arrayBuffer()), keys, decodedBytes)};
 },
}));
