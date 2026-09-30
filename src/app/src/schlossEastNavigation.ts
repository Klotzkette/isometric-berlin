import source from "./data/schlossEastNavigation.json";
import type { VisualMode } from "./visualMode";

type Polygon = { bounds: number[]; ring: number[][]; holes: number[][][] };
export const SCHLOSS_EAST_NAVIGATION = source;
export const SCHLOSS_EAST_NAVIGATION_BOUNDS = {
  minX: source.bounds[0],
  minZ: source.bounds[1],
  maxX: source.bounds[2],
  maxZ: source.bounds[3],
} as const;
function inRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function contains(p: Polygon, x: number, z: number): boolean {
  return (
    x >= p.bounds[0] &&
    x <= p.bounds[2] &&
    z >= p.bounds[1] &&
    z <= p.bounds[3] &&
    inRing(x, z, p.ring) &&
    !p.holes.some((h) => inRing(x, z, h))
  );
}
const gridSize = 32,
  grid = new Map<string, { polygon: Polygon; lift: number }[]>();
for (const surface of source.surfaces)
  for (const polygon of surface.polygons) {
    const lift = surface.kind === "asphalt" ? 0.18 : 0.32;
    for (
      let x = Math.floor(polygon.bounds[0] / gridSize);
      x <= Math.floor(polygon.bounds[2] / gridSize);
      x++
    )
      for (
        let z = Math.floor(polygon.bounds[1] / gridSize);
        z <= Math.floor(polygon.bounds[3] / gridSize);
        z++
      ) {
        const key = `${x}/${z}`,
          list = grid.get(key) ?? [];
        list.push({ polygon, lift });
        grid.set(key, list);
      }
  }
const nativeRows = new Map<number, number[][]>();
for (const run of source.native_runs) {
  const list = nativeRows.get(run[1]) ?? [];
  list.push(run);
  nativeRows.set(run[1], list);
}
/** Only the already drawn source-clipped neutral lobe beyond the old grid.
 * Its flat east-edge height is a presentation fallback, never surveyed terrain. */
export function schlossEastNavigationGroundAt(
  x: number,
  z: number,
  mode: VisualMode = "day",
): number | null {
  const b = SCHLOSS_EAST_NAVIGATION_BOUNDS;
  if (
    x < b.minX ||
    x > b.maxX ||
    z < b.minZ ||
    z > b.maxZ ||
    !source.footprint.some((p) => contains(p, x, z))
  )
    return null;
  if (mode === "minecraft") {
    const asphalt = nativeRows
      .get(Math.floor(z))
      ?.some(([start, , length]) => x >= start && x < start + length);
    return source.ground_y_m + (asphalt ? 0.18 : 0.32);
  }
  let lift = 0.1; // createSchlossEastStreets uses the ordinary paving lift for its backing.
  for (const p of grid.get(
    `${Math.floor(x / gridSize)}/${Math.floor(z / gridSize)}`,
  ) ?? [])
    if (contains(p.polygon, x, z)) lift = Math.max(lift, p.lift);
  return source.ground_y_m + lift;
}
