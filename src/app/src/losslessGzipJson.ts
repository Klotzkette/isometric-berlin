import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";

/** Synchronous fallback shared by all browsers, independent of CompressionStream.
 * Called only when a lazy source field is first read. Temporary decoded bytes
 * are not retained; the caller keeps its established strong/weak array cache. */
export function decodeLosslessGzipJson(encoded: string): unknown {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(gunzipSync(bytes)));
}
