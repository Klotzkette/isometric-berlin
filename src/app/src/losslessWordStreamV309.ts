/** Exact UInt32 words, including Float32 bit patterns. No numeric quantisation. */
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
const MAX_WORDS = 4_000_000;
function valid(count: number, stride: number): void {
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_WORDS || (stride !== 1 && stride !== 3) || count % stride) throw Error("Invalid finite lossless word stream");
}

export function decodeLosslessWordStreamV309(encoded: string, count: number, stride: number): Uint32Array {
  valid(count, stride);
  const packed = decodeBase64Bytes(encoded), result = new Uint32Array(count), previous = new Uint32Array(stride);
  let offset = 0;
  try {
    for (let i = 0; i < count; i++) {
      let value = 0, shift = 0, byte = 0;
      do {
        if (offset >= packed.length || shift > 28) throw Error("Truncated lossless word stream");
        byte = packed[offset++];
        if (shift === 28 && (byte & 0xf0)) throw Error("Overflowed lossless word stream");
        value = (value | ((byte & 127) << shift)) >>> 0; shift += 7;
      } while (byte & 128);
      // The only multi-byte encoding of zero is forbidden, so all admitted
      // streams have one canonical representation and no hidden trailing data.
      if (shift > 7 && (byte & 127) === 0) throw Error("Noncanonical lossless word stream");
      const axis = i % stride;
      previous[axis] = (previous[axis] + ((value >>> 1) ^ -(value & 1))) >>> 0;
      result[i] = previous[axis];
    }
    if (offset !== packed.length) throw Error("Trailing lossless word stream data");
    return result;
  } finally { releaseScratchBuffer(packed.buffer); }
}

/** Build-time encoder; production imports only the bounded decoder above. */
export function encodeLosslessWordStreamV309(words: Uint32Array, stride: number): Uint8Array {
  valid(words.length, stride);
  const bytes = new Uint8Array(words.length * 5), previous = new Uint32Array(stride);
  let offset = 0;
  for (let i = 0; i < words.length; i++) {
    const axis = i % stride, delta = (words[i] - previous[axis]) | 0;
    previous[axis] = words[i]; let value = ((delta << 1) ^ (delta >> 31)) >>> 0;
    while (value >= 128) { bytes[offset++] = (value & 127) | 128; value >>>= 7; }
    bytes[offset++] = value;
  }
  return bytes.slice(0, offset);
}

/** Wrapped per-axis deltas, followed by axis columns and little-endian byte
 * planes. The outer source compressor benefits without discarding one bit. */
export function encodeLosslessWordPlanesV309(words: Uint32Array, stride: number): Uint8Array {
  valid(words.length, stride);
  const packed = new Uint8Array(words.length * 4), previous = new Uint32Array(stride), rows = words.length / stride;
  for (let i = 0; i < words.length; i++) {
    const axis = i % stride, delta = (words[i] - previous[axis]) | 0;
    previous[axis] = words[i]; const value = ((delta << 1) ^ (delta >> 31)) >>> 0, column = axis * rows + Math.floor(i / stride);
    for (let byte = 0; byte < 4; byte++) packed[byte * words.length + column] = (value >>> (byte * 8)) & 255;
  }
  return packed;
}

export function decodeLosslessWordPlanesV309(encoded: string, count: number, stride: number): Uint32Array {
  valid(count, stride);
  const packed = decodeBase64Bytes(encoded), words = new Uint32Array(count), previous = new Uint32Array(stride), rows = count / stride;
  try {
    if (packed.byteLength !== count * 4) throw Error("Incomplete lossless word planes");
    for (let i = 0; i < count; i++) {
      const axis = i % stride, column = axis * rows + Math.floor(i / stride);
      const value = (packed[column] | packed[count + column] << 8 | packed[count * 2 + column] << 16 | packed[count * 3 + column] << 24) >>> 0;
      previous[axis] = (previous[axis] + ((value >>> 1) ^ -(value & 1))) >>> 0;
      words[i] = previous[axis];
    }
    return words;
  } finally { releaseScratchBuffer(packed.buffer); }
}
