import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { houseCurbGroundGuardV233 } from "./houseCurbsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type CrossingPavingPlan = {
  origin: readonly number[];
  roadsGuard: number;
  surfaceGuard: number;
  xz: string;
  indices: string;
};

export type CrossingPavingBank = Readonly<Record<string, CrossingPavingPlan>>;

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});

function* surfaceGuard(chunk: SurroundingCityChunk): Generator<void, number> {
  let crc = 0xffffffff;
  for (const part of chunk.meshes) {
    if (part.kind !== "city") continue;
    for (const stream of [part.positions, part.colors, part.indices]) {
      for (let start = 0; start < stream.length; start += 32768) {
        const end = Math.min(stream.length, start + 32768);
        for (let i = start; i < end; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ stream.charCodeAt(i)) & 255];
        yield;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encode(array: ArrayBufferView): string {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}

/** These polygons are the intersection of mapped unmarked crossings, asphalt
 * carriageways and the incorrect beige triangles in this exact source mesh. */
export function* crossingPavingPart(
  chunk: SurroundingCityChunk, plan?: CrossingPavingPlan,
): Generator<void, SurroundingPackedMesh | undefined> {
  if (!plan || chunk.nav.groundY !== 3 || !chunk.nav.roads?.length ||
      !chunk.origin.every((v, i) => v === plan.origin[i]) ||
      (yield* surfaceGuard(chunk)) !== plan.surfaceGuard ||
      houseCurbGroundGuardV233(chunk.nav.roads) !== plan.roadsGuard) return undefined;

  const xz = new Uint16Array(decodeBase64Bytes(plan.xz).buffer);
  const indices = new Uint16Array(decodeBase64Bytes(plan.indices).buffer);
  const count = xz.length / 2;
  const positions = new Uint16Array(count * 3);
  const colors = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[3*i] = xz[2*i];
    positions[3*i+1] = 1315;
    positions[3*i+2] = xz[2*i+1];
    // Identical linear-u8 asphalt to the adjacent source road faces.
    colors[3*i] = 39;
    colors[3*i+1] = 41;
    colors[3*i+2] = 39;
  }
  return {
    kind: "unmarked-crossings-v368", positionType: "u16cm",
    positions: encode(positions), colors: encode(colors), indices: encode(Uint32Array.from(indices)),
  };
}
