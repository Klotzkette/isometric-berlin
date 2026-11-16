/** Complete measured Grunewald restaurant bodies on exact preceding owners. */
import type { SourceQuarterCatalogueEntryV309 } from './SourceQuarterCatalogueV309';
import type { SourceQuarterSourceV303, SourceQuarterPlanV303 } from './SourceQuarterPacketV303';
import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { releaseScratchBuffer } from './releaseScratchBuffer';
import index from './data/grunewaldVenuesV354Index.json';

export const GRUNEWALD_VENUES_KIND_V354 = 'grunewald-venues-v354';
export function grunewaldVenuesSourceV354(compressed: Uint8Array, keys: readonly string[], decodedBytes: number): SourceQuarterSourceV303 {
 if (keys.length > 16 || new Set(keys).size !== keys.length || !Number.isSafeInteger(decodedBytes) || decodedBytes < 1 || decodedBytes > 2 * 1024 * 1024 || compressed.length < 18 || compressed.length > 512 * 1024) throw Error('Invalid bounded Grunewald venues source');
 let cached: WeakRef<SourceQuarterSourceV303> | undefined;
 const source = () => {
  let value = cached?.deref();
  if (!value) {
   const declared = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength).getUint32(compressed.length - 4, true);
   if (declared !== decodedBytes) throw Error('Grunewald venues source decoded size changed');
   const output = new Uint8Array(decodedBytes + 1);
   try {
    const bytes = gunzipSync(compressed, {out: output});
    if (bytes.length !== decodedBytes) throw Error('Grunewald venues source length changed');
    value = JSON.parse(new TextDecoder().decode(bytes)) as SourceQuarterSourceV303;
   } finally { releaseScratchBuffer(output.buffer); }
   if (value.schemaVersion !== 1 || !Array.isArray(value.keys) || value.keys.length !== keys.length || keys.some((k, i) => value!.keys[i] !== k || !Object.hasOwn(value!.packets, k)) || Object.keys(value.packets).length !== keys.length) throw Error('Incomplete Grunewald venues source');
   cached = new WeakRef(value);
  }
  return value;
 };
 const packets: Record<string, SourceQuarterPlanV303> = {};
 for (const key of keys) Object.defineProperty(packets, key, {enumerable: true, get: () => source().packets[key]});
 return {schemaVersion: 1, keys: [...keys], packets};
}
let loaders: Record<string, () => Promise<unknown>> = {};
try { loaders = import.meta.glob('./data/grunewaldVenuesV354Packets[0-9][0-9][0-9].json.gz', {query: '?url', import: 'default'}); }
catch { /* Bun uses the same immutable local gzip source for offline checks. */ }
export const grunewaldVenuesEntriesV354: SourceQuarterCatalogueEntryV309[] = index.sources.map(({file, keys, decodedBytes}) => ({
 kind: GRUNEWALD_VENUES_KIND_V354, keys,
 load: async () => {
  const path = './data/' + file, loader = loaders[path];
  const url = loader ? await loader() as string : new URL(path, import.meta.url).href;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Grunewald venues source ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (length > 512 * 1024) throw Error('Grunewald venues source exceeds bounded transfer');
  return {default: grunewaldVenuesSourceV354(new Uint8Array(await response.arrayBuffer()), keys, decodedBytes)};
 },
}));
