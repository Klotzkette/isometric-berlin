import { decodeBase64Bytes } from "./decodeBase64Bytes";

const BASE64_SLICE = 65_536;
const BYTE_SLICE = BASE64_SLICE / 4 * 3;

function encodeBase64(bytes: Uint8Array): string {
  const direct = (bytes as Uint8Array & { toBase64?: () => string }).toBase64;
  if (direct) return direct.call(bytes);
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

/** Delta fields contain unsigned LEB128 zigzag values. Position predictors
 * follow XYZ independently. Index predictors wrap modulo 2^32. */
function* restoreField(encoded: string, size: number, position: boolean): Generator<string> {
  const width = position ? 2 : 4;
  const output = new Uint8Array(Math.min(BYTE_SLICE, size));
  const view = new DataView(output.buffer);
  const predictors = [0, 0, 0];
  let value = 0, shift = 0, words = 0, offset = 0, written = 0;
  for (let start = 0; start < encoded.length; start += BASE64_SLICE) {
    const bytes = decodeBase64Bytes(encoded.slice(start, start + BASE64_SLICE));
    for (const byte of bytes) {
      if (shift === 28 && byte > 15) throw Error("Invalid surrounding-city delta word");
      value |= (byte & 127) << shift;
      if (byte & 128) { shift += 7; continue; }
      if (written >= size || (shift > 0 && byte === 0)) throw Error("Invalid surrounding-city delta word");
      const delta = (value >>> 1) ^ -(value & 1);
      const axis = position ? words % 3 : 0;
      const next = (predictors[axis] + delta) >>> 0;
      if (position) {
        if (next > 65535) throw Error("Invalid surrounding-city delta position");
        view.setUint16(offset, next, true);
      } else {
        view.setUint32(offset, next, true);
      }
      predictors[axis] = next;
      words++;
      written += width;
      offset += width;
      value = shift = 0;
      if (offset === output.length) {
        yield encodeBase64(output);
        offset = 0;
      }
    }
  }
  if (shift !== 0 || written !== size) throw Error("Incomplete surrounding-city delta field");
  if (offset) yield encodeBase64(output.subarray(0, offset));
}

/** Restore the exact source strings before geometry, ownership or navigation
 * validation sees the packet. Only one bounded packet is restored at a time. */
export async function restoreSurroundingPacketDelta(
  packet: unknown, expansion: number, signal: AbortSignal,
): Promise<unknown> {
  const meshes = (packet as { meshes?: unknown } | null)?.meshes;
  if (!Array.isArray(meshes)) throw Error("Invalid surrounding-city delta packet");
  let checkpoint = performance.now();
  for (const part of meshes) {
    if (!part || typeof part !== "object") throw Error("Invalid surrounding-city delta mesh");
    for (const field of ["positions", "indices"] as const) {
      const original = part[field];
      if (typeof original !== "string" || !original.startsWith("~")) continue;
      const match = /^~([1-9][0-9]{0,7}):([A-Za-z0-9+/]+={0,2})$/.exec(original);
      if (!match) throw Error("Invalid surrounding-city delta encoding");
      const [, rawSize, encoded] = match;
      const size = Number(rawSize);
      const position = field === "positions";
      const difference = Math.ceil(size / 3) * 4 - original.length;
      if (encoded.length % 4 || size % (position ? 6 : 4) || difference <= 0 ||
          (position && part.positionType !== "u16cm") || difference > expansion) {
        throw Error("Surrounding-city delta field exceeds its bounded manifest");
      }
      expansion -= difference;
      const pieces: string[] = [];
      for (const bytes of restoreField(encoded, size, position)) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        pieces.push(bytes);
        if (performance.now() - checkpoint >= 4) {
          const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
          if (scheduler?.yield) await scheduler.yield();
          else await new Promise<void>(resolve => setTimeout(resolve, 0));
          checkpoint = performance.now();
        }
      }
      part[field] = pieces.join("");
    }
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (expansion !== 0) throw Error("Incomplete surrounding-city delta packet");
  return packet;
}
