import { coreParkReliefSupports } from "./parkReliefV182";
import fritz from "./data/parkReliefV183.json";
import { WALL_GALLERY_HILL_BOUNDS_V298, wallGalleryHillGroundAtV298 } from "./wallGalleryV298Profile";

/** Exact v182 nearest ground samples around the new hill, before raising it. */
export function originalFritzGroundAt(x: number, z: number, fallback: number): number {
  const source = fritz.originalGround;
  const col = Math.floor((x - source.origin[0]) / source.stepM);
  const row = Math.floor((z - source.origin[1]) / source.stepM);
  return source.yDm[row]?.[col] === undefined ? fallback : source.yDm[row][col] / 10;
}
// Every retained v1.0.81 run intersecting this support and its 16 m apron had
// precisely this midpoint altitude. Keep it on unsplit/outside portions.
export const PARK_RELIEF_ORIGINAL_CORE_Y = 5.2;
export type ReliefGroundSlice = { xStart: number; run: number; topY: number };

/** Expand only this corrected park; keep original runs and colour keys elsewhere. */
export function parkReliefGroundSlices(
  xStart: number, run: number, zOffset: number,
  options: {
    cell: number; minXIndex: number; minZIndex: number; strideCells: number;
    mode: "drawn" | "native";
    nearest: (x: number, z: number) => number;
    smooth: (x: number, z: number) => number;
  },
): ReliefGroundSlice[] | null {
  const { cell, minXIndex, minZIndex, strideCells } = options;
  const apron = cell * strideCells;
  const z = (minZIndex + zOffset + .5) * cell;
  const support = coreParkReliefSupports.find(bounds => z >= bounds[1] - apron && z <= bounds[3] + apron &&
    (minXIndex + xStart + run) * cell >= bounds[0] - apron &&
    (minXIndex + xStart) * cell <= bounds[2] + apron);
  if (!support) return null;
  const isFritz = support === coreParkReliefSupports[1];
  const isMauerpark = support === WALL_GALLERY_HILL_BOUNDS_V298;
  const oldTop = isFritz ? originalFritzGroundAt(
    (minXIndex + xStart + run / 2) * cell, (minZIndex + zOffset) * cell,
    options.nearest(xStart + run / 2, zOffset)) : PARK_RELIEF_ORIGINAL_CORE_Y;
  if (isMauerpark) {
    let changed = false;
    for (let x = xStart; x < xStart + run; x++) {
      const top = wallGalleryHillGroundAtV298((minXIndex + x + .5) * cell, z, options.mode === "native", oldTop);
      if (top !== null && Math.abs(top - oldTop) > 1e-8) { changed = true; break; }
    }
    // Grid metadata/apron overlap is not occupied terrain. Preserve the exact
    // original run transform, paint salt and count when no true cell changes.
    if (!changed) return null;
  }
  const first = Math.max(xStart, Math.ceil((support[0] - apron) / cell - minXIndex - .5));
  const end = Math.min(xStart + run, Math.floor((support[2] + apron) / cell - minXIndex - .5) + 1);
  if (first >= end) return null;
  const result: ReliefGroundSlice[] = [];
  const append = (x: number, count: number, y: number) => {
    if (!count) return;
    const last = result[result.length - 1];
    if (last && last.xStart + last.run === x && last.topY === y) last.run += count;
    else result.push({ xStart: x, run: count, topY: y });
  };
  append(xStart, first - xStart, oldTop);
  for (let x = first; x < end; x++) {
    let y = options.nearest(x + .5, zOffset + .5);
    if (isMauerpark) {
      // Core has no occupied cells in this support in the released payload.
      // A bounded raster caller still gets the same four-metre cell surface
      // as navigation, with its exact original run altitude outside the mask.
      y = wallGalleryHillGroundAtV298((minXIndex + x + .5) * cell, z,
        options.mode === "native", oldTop) ?? oldTop;
    } else if (options.mode === "drawn") {
      const corners = [options.smooth(x, zOffset), options.smooth(x + 1, zOffset),
        options.smooth(x, zOffset + 1), options.smooth(x + 1, zOffset + 1)];
      // Exact vector lawns/paths cover the backing. Its flat four-metre top
      // must never cut through the continuously sloping visible surface.
      y = !isFritz && corners.every(v => Math.abs(v - PARK_RELIEF_ORIGINAL_CORE_Y) < 1e-8)
        ? PARK_RELIEF_ORIGINAL_CORE_Y : Math.min(...corners) - .2;
    }
    append(x, 1, y);
  }
  append(end, xStart + run - end, oldTop);
  return result;
}
