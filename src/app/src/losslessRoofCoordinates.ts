import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";

/** Exact double storage, independent of browser endianness. No Float32 conversion. */
export function decodeLosslessRoofCoordinates(source: {
  format: string; triangles: number; bytes: number; gzip: string;
}): Float64Array {
  if (source.format !== "lossless-f64le-roof-triangles-v1" ||
      !Number.isSafeInteger(source.triangles) || source.triangles < 0 ||
      source.bytes !== source.triangles * 9 * 8) throw new Error("Invalid packed roof coordinates");
  const packed = decodeBase64Bytes(source.gzip);
  const decoded = gunzipSync(packed);
  if (decoded.byteLength !== source.bytes) throw new Error("Incomplete packed roof coordinates");
  const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  if (littleEndian && decoded.byteOffset % 8 === 0)
    return new Float64Array(decoded.buffer, decoded.byteOffset, decoded.byteLength / 8);
  const values = new Float64Array(source.triangles * 9);
  const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  for (let i = 0; i < values.length; i++) values[i] = view.getFloat64(i * 8, true);
  return values;
}
