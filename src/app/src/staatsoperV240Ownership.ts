import previous from "./data/staatsoperV240Previous.json";
import { transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** Explicit world-transaction opt-in; no decoded receipt cache in standalone
 * factories. Every measured v169 shell and source edge remains in its owner.
 */
export function* transferStaatsoperTrianglesV240(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || part.kind !== "alt-mitte-v169" ||
    !(native ? tile.startsWith("alt-mitte-v169-3_0-piece-") : tile === "3_0" || tile.startsWith("3_0-alt-mitte-v169-"))) return 0;
  return yield* transferExactPacketTriangles(previous.records, tile, native, part, indices, offset);
}

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Closure lifetime is one v182 construction only, keeping lossless JSON fields
 * collectible. Receipt matching uses original row indices and exact row values.
 */
export function staatsoperV240PreviousFilters(enabled: boolean): {
  box: (row: readonly number[], index: number) => boolean;
  segment: (row: readonly number[], index: number) => boolean;
} {
  if (!enabled) return { box: () => true, segment: () => true };
  const boxes = new Map(previous.boxes.map(r => [r.index, r.row]));
  const segments = new Map(previous.segments.map(r => [r.index, r.row]));
  return {
    box: (row, index) => { const old = boxes.get(index); return !old || !same(row, old); },
    segment: (row, index) => { const old = segments.get(index); return !old || !same(row, old); },
  };
}
