import relief from "./data/parkReliefV182.json";

const support = relief.profiles.find(profile => profile.name === "Volkspark Humboldthain")!.support;
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
  if (z < support[1] - apron || z > support[3] + apron) return null;
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
  append(xStart, first - xStart, PARK_RELIEF_ORIGINAL_CORE_Y);
  for (let x = first; x < end; x++) {
    let y = options.nearest(x + .5, zOffset + .5);
    if (options.mode === "drawn") {
      const corners = [options.smooth(x, zOffset), options.smooth(x + 1, zOffset),
        options.smooth(x, zOffset + 1), options.smooth(x + 1, zOffset + 1)];
      // Exact vector lawns/paths cover the backing. Its flat four-metre top
      // must never cut through the continuously sloping visible surface.
      y = corners.every(v => Math.abs(v - PARK_RELIEF_ORIGINAL_CORE_Y) < 1e-8)
        ? PARK_RELIEF_ORIGINAL_CORE_Y : Math.min(...corners) - .2;
    }
    append(x, 1, y);
  }
  append(end, xStart + run - end, PARK_RELIEF_ORIGINAL_CORE_Y);
  return result;
}
