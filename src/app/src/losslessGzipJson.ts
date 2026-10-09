import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";

/** Synchronous fallback shared by all browsers, independent of CompressionStream.
 * Called only when a lazy source field is first read. Temporary decoded bytes
 * are not retained; the caller keeps its established strong/weak array cache. */
export function decodeLosslessGzipJson(encoded: string): unknown {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  let decoded: Uint8Array<ArrayBuffer> | undefined;
  try {
    decoded = gunzipSync(bytes) as Uint8Array<ArrayBuffer>;
    return JSON.parse(new TextDecoder().decode(decoded));
  } finally {
    // Parsed JS values do not alias the inflater's temporary byte buffers.
    releaseScratchBuffer(bytes.buffer);
    releaseScratchBuffer(decoded?.buffer);
  }
}
