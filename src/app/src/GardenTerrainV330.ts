import { decodeBase64Bytes } from "./decodeBase64Bytes";

const STEP = 4;
const CELLS = 512 / STEP;

function sideLength(native: boolean): number {
  return native ? CELLS : CELLS + 1;
}

/** Each streamed packet owns one finite, little-endian centimetre height grid. */
export function decodeGardenTerrainV330(source: string, native: boolean): DataView {
  const side = sideLength(native);
  const byteLength = 2 * side * side;
  if (typeof source !== "string" || source.length !== 4 * Math.ceil(byteLength / 3)) {
    throw Error("Invalid Kienberg terrain grid length");
  }
  const bytes = decodeBase64Bytes(source);
  if (bytes.byteLength !== byteLength) throw Error("Incomplete Kienberg terrain grid");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function gardenTerrainGroundAtV330(
  grid: DataView, x: number, z: number, native: boolean,
): number | null {
  if (!(x >= 0 && x < 512 && z >= 0 && z < 512)) return null;
  const u = x / STEP, v = z / STEP;
  const column = Math.floor(u), row = Math.floor(v);
  const side = sideLength(native);
  const offset = (row * side + column) * 2;
  const nw = grid.getInt16(offset, true);
  if (native) return nw / 100;
  const a = u - column, b = v - row;
  const se = grid.getInt16(offset + (side + 1) * 2, true);
  const edge = grid.getInt16(offset + (a >= b ? 2 : side * 2), true);
  return (nw * (1 - Math.max(a, b)) + edge * Math.abs(a - b) + se * Math.min(a, b)) / 100;
}
