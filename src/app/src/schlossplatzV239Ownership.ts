import previous from "./data/schlossplatzV239AltMittePrevious.json";
import { transferExactPacketLines, transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

const triangleTiles = new Set([
  "alt-mitte-v169-3_0-piece-0", "alt-mitte-v169-4_0-piece-0",
  "alt-mitte-v169-4_0-piece-1", "3_0", "4_0",
]);

/** Opt in only inside a world transaction guaranteeing complete v239 bodies.
 * The default preserves standalone worlds; changed encoded arrays fail open.
 */
export function* transferSchlossplatzTrianglesV239(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || part.kind !== "alt-mitte-v169" || !triangleTiles.has(tile)) return 0;
  return yield* transferExactPacketTriangles(previous.records, tile, native, part, indices, offset);
}

export function* transferSchlossplatzLinesV239(
  enabled: boolean, tile: string, part: SurroundingPackedLines,
  values: Uint16Array, stride: number,
): Generator<void, number> {
  if (!enabled) return 0;
  return yield* transferExactPacketLines(previous.lineRecords, tile, part, values, stride);
}
