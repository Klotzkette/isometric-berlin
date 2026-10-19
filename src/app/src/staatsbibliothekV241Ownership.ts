import previous from "./data/staatsbibliothekV241Previous.json";
import { transferExactPacketLines, transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** Only the complete required-library transaction may retire the exact prior
 * recipe. Standalone factories retain the entire original source by default.
 */
export function* transferStaatsbibliothekTrianglesV241(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || part.kind !== "alt-mitte-v169" ||
    !(tile.startsWith("alt-mitte-v169-2_0-piece-") || (!native &&
      (tile === "2_0" || tile.startsWith("2_0-alt-mitte-v169-"))))) return 0;
  return yield* transferExactPacketTriangles(previous.records, tile, native, part, indices, offset);
}

export function* transferStaatsbibliothekLinesV241(
  enabled: boolean, tile: string, part: SurroundingPackedLines,
  values: Uint16Array, stride: number,
): Generator<void, number> {
  if (!enabled || !tile.startsWith("alt-mitte-v169-2_0-")) return 0;
  return yield* transferExactPacketLines(previous.lineRecords, tile, part, values, stride);
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(k => Object.hasOwn(right, k) && same(left[k], right[k]));
  }
  return false;
}

/** Receipt maps live only for this construction, never in the warm viewer.
 * Exact index + row matching fails open for future source changes.
 */
export function staatsbibliothekV241PreviousFilters(enabled: boolean): {
  box: (row: readonly number[], index: number) => boolean;
  block: (row: readonly number[], index: number) => boolean;
  surface: (row: unknown, index: number) => boolean;
} {
  if (!enabled) return { box: () => true, block: () => true, surface: () => true };
  const boxes = new Map(previous.boxes.map(r => [r.index, r.row]));
  const blocks = new Map(previous.blocks.map(r => [r.index, r.row]));
  const surfaces = new Map(previous.surfaces.map(r => [r.index, r.row]));
  return {
    box: (row, index) => { const old = boxes.get(index); return !old || !same(row, old); },
    block: (row, index) => { const old = blocks.get(index); return !old || !same(row, old); },
    surface: (row, index) => { const old = surfaces.get(index); return !old || !same(row, old); },
  };
}
