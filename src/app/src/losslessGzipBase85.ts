import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

// Z85's ASCII alphabet needs no quoting escapes in generated JS literals.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";
const DECODE = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET.charCodeAt(i)] = i;

/** Build-time only. One leading digit records zero padding of the last word. */
export function encodeLosslessBase85(bytes: Uint8Array): string {
  const chunks: string[] = [String((4 - bytes.length % 4) % 4)];
  let chunk = "";
  for (let at = 0; at < bytes.length; at += 4) {
    let word = 0;
    for (let i = 0; i < 4; i++) word = word * 256 + (bytes[at + i] ?? 0);
    let encoded = "";
    for (let i = 0; i < 5; i++) {
      encoded = ALPHABET[word % 85] + encoded;
      word = Math.floor(word / 85);
    }
    chunk += encoded;
    if (chunk.length >= 65_535) { chunks.push(chunk); chunk = ""; }
  }
  chunks.push(chunk);
  return chunks.join("");
}

/** Strict canonical inverse, allocating only the final gzip byte buffer. */
export function decodeLosslessBase85(encoded: string): Uint8Array<ArrayBuffer> {
  const padding = encoded.charCodeAt(0) - 48;
  if (encoded.length % 5 !== 1 || padding < 0 || padding > 3 ||
      (encoded.length === 1 && padding !== 0)) throw new Error("Invalid lossless base85 length");
  const length = (encoded.length - 1) / 5 * 4 - padding;
  const bytes = new Uint8Array(length);
  let to = 0;
  try {
    for (let at = 1; at < encoded.length; at += 5) {
      let word = 0;
      for (let i = 0; i < 5; i++) {
        const code = encoded.charCodeAt(at + i);
        const value = code < DECODE.length ? DECODE[code] : -1;
        if (value < 0) throw new Error("Invalid lossless base85 alphabet");
        word = word * 85 + value;
      }
      if (word > 0xffffffff) throw new Error("Invalid lossless base85 word");
      for (let shift = 24; shift >= 0; shift -= 8) {
        const value = (word >>> shift) & 255;
        if (to < length) bytes[to++] = value;
        else if (value !== 0) throw new Error("Invalid lossless base85 padding");
      }
    }
    return bytes;
  } catch (error) {
    releaseScratchBuffer(bytes.buffer);
    throw error;
  }
}

/** Same gzip, parser and temporary-buffer retirement as the existing decoder.
 * Only the source string alphabet differs; caller cache ownership is untouched. */
export function decodeLosslessGzipJson(encoded: string): unknown {
  const bytes = decodeLosslessBase85(encoded);
  let decoded: Uint8Array<ArrayBuffer> | undefined;
  try {
    decoded = gunzipSync(bytes) as Uint8Array<ArrayBuffer>;
    return JSON.parse(new TextDecoder().decode(decoded));
  } finally {
    releaseScratchBuffer(bytes.buffer);
    releaseScratchBuffer(decoded?.buffer);
  }
}
