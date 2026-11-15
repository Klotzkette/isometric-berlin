/** Source-bound Nikolaikirche body and twin-spire corrections. Each requested host owns its complete receipt. */
import type { SourceQuarterCatalogueEntryV309 } from './SourceQuarterCatalogueV309';
import type { SourceQuarterSourceV303, SourceQuarterPlanV303 } from './SourceQuarterPacketV303';
import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { releaseScratchBuffer } from './releaseScratchBuffer';
import index from './data/nikolaikircheV353Index.json';

export const NIKOLAIKIRCHE_KIND_V353 = 'nikolaikirche-v353';
export function nikolaikircheSourceV353(compressed: Uint8Array, keys: readonly string[], decodedBytes: number): SourceQuarterSourceV303 {
 if (keys.length > 16 || new Set(keys).size !== keys.length || !Number.isSafeInteger(decodedBytes) || decodedBytes < 1 || decodedBytes > 2 * 1024 * 1024 || compressed.length < 18 || compressed.length > 512 * 1024) throw Error('Invalid bounded Nikolaikirche source');
 let cached: WeakRef<SourceQuarterSourceV303> | undefined;
 const source = () => {
  let value = cached?.deref();
  if (!value) {
   const declared = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength).getUint32(compressed.length - 4, true);
   if (declared !== decodedBytes) throw Error('Nikolaikirche source decoded size changed');
   const output = new Uint8Array(decodedBytes + 1);
   try {
    const bytes = gunzipSync(compressed, {out: output});
    if (bytes.length !== decodedBytes) throw Error('Nikolaikirche source length changed');
    value = JSON.parse(new TextDecoder().decode(bytes)) as SourceQuarterSourceV303;
   } finally { releaseScratchBuffer(output.buffer); }
   if (value.schemaVersion !== 1 || !Array.isArray(value.keys) || value.keys.length !== keys.length || keys.some((k, i) => value!.keys[i] !== k || !Object.hasOwn(value!.packets, k)) || Object.keys(value.packets).length !== keys.length) throw Error('Incomplete Nikolaikirche source');
   cached = new WeakRef(value);
  }
  return value;
 };
 const packets: Record<string, SourceQuarterPlanV303> = {};
 for (const key of keys) Object.defineProperty(packets, key, {enumerable: true, get: () => source().packets[key]});
 return {schemaVersion: 1, keys: [...keys], packets};
}
const keys = ['drawn:4_0', 'drawn:nikolai239-4_0', 'drawn:4_0-alt-mitte-v169-1', 'minecraft:4_0', 'minecraft:nikolai239-4_0'];
export const nikolaikirchePacketV353: SourceQuarterCatalogueEntryV309 = {
 kind: NIKOLAIKIRCHE_KIND_V353, keys,
 load: async () => {
  const url = new URL('./data/nikolaikircheV353Packets.json.gz', import.meta.url).href;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Nikolaikirche source ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (length > 512 * 1024) throw Error('Nikolaikirche source exceeds bounded transfer');
  return {default: nikolaikircheSourceV353(new Uint8Array(await response.arrayBuffer()), keys, index.decodedBytes)};
 },
};
