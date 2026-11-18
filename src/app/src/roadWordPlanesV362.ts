import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeLosslessBase85 } from "./losslessGzipBase85";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

export const ROAD_PLANES_ENCODING = "road-word-planes-gzip-base85";
export type RoadWordBatch = {
  id: string;
  kind: "asphalt" | "paving" | "kerbs";
  xz: ArrayBuffer;
  indices?: ArrayBuffer;
};

/** Keep every bit of each original 32-bit word, including the sign of zero. */
function restoreWords(planes: Uint8Array, start: number, length: number): ArrayBuffer {
  const words = new Uint8Array(length);
  for (let plane = 0; plane < 4; plane++) {
    for (let target = plane; target < length; target += 4) words[target] = planes[start++];
  }
  return words.buffer;
}

type RoadWordRecord = { id: string; kind: RoadWordBatch["kind"]; coords: number; indices: number; encoded: string };

export function readRoadWordRecord(value: unknown, maxBytes: number): RoadWordRecord {
  if (!Array.isArray(value) || value.length !== 5) throw new Error("Invalid packed road record");
  const [id, kind, coords, indices, encoded] = value;
  if (typeof id !== "string" || !["asphalt", "paving", "kerbs"].includes(kind) ||
      !Number.isSafeInteger(coords) || coords < 0 || coords % (kind === "kerbs" ? 16 : 8) ||
      !Number.isSafeInteger(indices) || indices < 0 || indices % 12 ||
      (kind === "kerbs" && indices !== 0) || coords + indices > maxBytes ||
      typeof encoded !== "string" || encoded.length > maxBytes) throw new Error("Invalid packed road dimensions");
  return { id, kind, coords, indices, encoded };
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let word = byte;
  for (let bit = 0; bit < 8; bit++) word = (word >>> 1) ^ (word & 1 ? 0xedb88320 : 0);
  return word;
});

function crc32(bytes: Uint8Array): number {
  let word = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) word = (word >>> 8) ^ crcTable[(word ^ bytes[i]) & 255];
  return (word ^ 0xffffffff) >>> 0;
}

export function readRoadWordBatch({ id, kind, coords, indices, encoded }: RoadWordRecord): RoadWordBatch {
  const size = coords + indices;
  const compressed = decodeLosslessBase85(encoded);
  let scratch: Uint8Array<ArrayBuffer> | undefined;
  try {
    if (compressed.length < 18) throw new Error("Incomplete packed road gzip");
    const footer = new DataView(compressed.buffer, compressed.byteOffset + compressed.length - 8, 8);
    if (footer.getUint32(4, true) !== size) {
      throw new Error("Invalid packed road gzip size");
    }
    scratch = new Uint8Array(size + 1);
    const planes = gunzipSync(compressed, { out: scratch });
    if (planes.length !== size) throw new Error("Invalid expanded road size");
    if (crc32(planes) !== footer.getUint32(0, true)) throw new Error("Invalid packed road checksum");
    const xz = restoreWords(planes, 0, coords);
    return kind === "kerbs" ? { id, kind, xz } : { id, kind, xz, indices: restoreWords(planes, coords, indices) };
  } finally {
    releaseScratchBuffer(compressed.buffer);
    releaseScratchBuffer(scratch?.buffer);
  }
}
