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

function decodeWord(encoded: string, at: number): number {
  const a = DECODE[encoded.charCodeAt(at)];
  const b = DECODE[encoded.charCodeAt(at + 1)];
  const c = DECODE[encoded.charCodeAt(at + 2)];
  const d = DECODE[encoded.charCodeAt(at + 3)];
  const e = DECODE[encoded.charCodeAt(at + 4)];
  const word = (((a * 85 + b) * 85 + c) * 85 + d) * 85 + e;
  // Invalid ASCII digits are -1. A non-ASCII lookup is undefined and
  // propagates NaN through the calculation.
  if ((a | b | c | d | e) < 0 || Number.isNaN(word)) {
    throw new Error("Invalid lossless base85 alphabet");
  }
  if (word > 0xffffffff) throw new Error("Invalid lossless base85 word");
  return word;
}

/** Strict canonical inverse, allocating only the final gzip byte buffer. */
export function decodeLosslessBase85(encoded: string): Uint8Array<ArrayBuffer> {
  const padding = encoded.charCodeAt(0) - 48;
  if (encoded.length % 5 !== 1 || padding < 0 || padding > 3 ||
      (encoded.length === 1 && padding !== 0)) throw new Error("Invalid lossless base85 length");
  const length = (encoded.length - 1) / 5 * 4 - padding;
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  const fullWordEnd = encoded.length - (padding > 0 ? 5 : 0);
  try {
    let to = 0;
    for (let at = 1; at < fullWordEnd; at += 5) {
      view.setUint32(to, decodeWord(encoded, at), false);
      to += 4;
    }
    if (padding > 0) {
      const word = decodeWord(encoded, fullWordEnd);
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
export function decodeLosslessGzipJson(encoded: string, maxDecodedBytes?: number): unknown {
  const bytes = decodeLosslessBase85(encoded);
  let decoded: Uint8Array<ArrayBuffer> | undefined;
  let boundedOutput: Uint8Array<ArrayBuffer> | undefined;
  let text: string;
  try {
    if (maxDecodedBytes === undefined) decoded = gunzipSync(bytes) as Uint8Array<ArrayBuffer>;
    else {
      if (!Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes < 0 || bytes.length < 18) throw new Error("Invalid bounded gzip size");
      const expected = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(bytes.length - 4, true);
      if (expected > maxDecodedBytes) throw new Error("Lossless gzip exceeds bounded decoded size");
      // fflate never grows a supplied output. One sentinel byte detects a forged
      // smaller ISIZE even when the decompressed prefix happens to be valid JSON.
      boundedOutput = new Uint8Array(expected + 1);
      decoded = gunzipSync(bytes, { out: boundedOutput }) as Uint8Array<ArrayBuffer>;
      if (decoded.length !== expected) throw new Error("Invalid bounded gzip decoded size");
    }
    text = new TextDecoder().decode(decoded);
  } finally {
    releaseScratchBuffer(bytes.buffer);
    releaseScratchBuffer(boundedOutput?.buffer ?? decoded?.buffer);
  }
  // Parsing the owned string can allocate a large object graph. Retire the
  // byte buffers first so their backing stores need not overlap that graph.
  return JSON.parse(text);
}
