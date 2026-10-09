import profile from "./data/weinbergTerrainV176.json";
import buildings from "./data/weinbergBuildingOffsetsV176.json";
import basinData from "./data/weinbergBasinsV176.json";
import { parkReliefAt } from "./parkReliefV182";
import { grunewaldGroundAt } from "./grunewaldTerrainV190";
import { olympicTerrainOffsetV201 } from "./olympicTerrainV201";
import { wuhlheideTerrainOffsetV201 } from "./wuhlheideTerrainV201";

type Point = readonly number[];
type P = [number, number, number];
const [west, north, east, south] = profile.support;
const step = profile.stepM;

function sample(x: number, z: number, values: number[][]): number {
  if (x <= west || x >= east || z <= north || z >= south) return 0;
  const u = (x - west) / step, v = (z - north) / step;
  const ix = Math.floor(u), iz = Math.floor(v), a = u - ix, b = v - iz;
  const nw = values[iz][ix], ne = values[iz][ix + 1];
  const sw = values[iz + 1][ix], se = values[iz + 1][ix + 1];
  return a >= b ? nw * (1 - a) + ne * (a - b) + se * b
    : nw * (1 - b) + sw * (b - a) + se * a;
}

/** Same piecewise planar DGM field as the offline surface tessellator. */
export function terrainOffset(x: number, z: number): number {
  return sample(x, z, profile.offsets);
}

export function nativeTerrainOffset(x: number, z: number): number {
  if (x <= west || x >= east || z <= north || z >= south) return 0;
  return terrainOffset(Math.floor(x / 4) * 4 + 2, Math.floor(z / 4) * 4 + 2);
}

export function terrainWeight(x: number, z: number): number {
  return sample(x, z, profile.weights);
}

export function terrainGroundAt(x: number, z: number, baseline = 3, native = false): number {
  const height = baseline + (native ? nativeTerrainOffset(x, z) : terrainOffset(x, z)) + (3 - baseline) * terrainWeight(x, z);
  if (x <= west || x >= east || z <= north || z >= south) {
    // These bounded DGM fields include their transition to the earlier terrain.
    // They replace its local offset rather than adding a second hill to it.
    const amphitheatreOffset = olympicTerrainOffsetV201(x, z, native)
      ?? wuhlheideTerrainOffsetV201(x, z, native);
    if (amphitheatreOffset !== null) return height + amphitheatreOffset;
    return grunewaldGroundAt(x, z, parkReliefAt(x, z, height, native), native);
  }
  for (const basin of basinData.basins) {
    if (inRing(x, z, basin.ring) && !basin.holes.some(hole => inRing(x, z, hole))) return basin.floorY;
  }
  return height;
}

function inRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Translate a complete parent, never bend individual walls or roof vertices. */
export function buildingTerrainOffset(sourceId: string, x: number, z: number, groundY = 3): number {
  const value = (buildings.offsets as Record<string, number>)[sourceId];
  return value ?? terrainGroundAt(x, z, groundY) - groundY;
}

function clipped(points: P[], distance: (point: P) => number): P[] {
  const result: P[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = distance(a), db = distance(b);
    if (da >= -1e-9) result.push(a);
    if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return result;
}

/** Clip to the common 10 m DGM triangles so overlapping paths stay coplanar.
 * The original x/z coverage, winding and layer separation remain unchanged.
 * Only local ground sheets use this; buildings and props have rigid anchors.
 */
export function drapeTerrainTriangle(triangle: readonly Point[]): P[][] {
  const points = triangle.map(p => [p[0], p[1], p[2]] as P);
  const x0 = Math.min(...points.map(p => p[0])), x1 = Math.max(...points.map(p => p[0]));
  const z0 = Math.min(...points.map(p => p[2])), z1 = Math.max(...points.map(p => p[2]));
  if (x1 <= west || x0 >= east || z1 <= north || z0 >= south) return [points];
  const result: P[][] = [];
  const emit = (ring: P[]) => {
    for (let i = 1; i + 1 < ring.length; i++) {
      const [a, b, c] = [ring[0], ring[i], ring[i + 1]];
      if (Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) < 1e-8) continue;
      result.push([a, b, c].map(p => [p[0], p[1] + terrainOffset(p[0], p[2]), p[2]]));
    }
  };
  emit(clipped(points, p => north - p[2]));
  emit(clipped(points, p => p[2] - south));
  const middle = clipped(clipped(points, p => p[2] - north), p => south - p[2]);
  emit(clipped(middle, p => west - p[0]));
  emit(clipped(middle, p => p[0] - east));
  const inside = clipped(clipped(middle, p => p[0] - west), p => east - p[0]);
  for (let iz = Math.max(0, Math.floor((z0 - north) / step)); iz < Math.min(profile.height - 1, Math.ceil((z1 - north) / step)); iz++) {
    const z = north + iz * step;
    const row = clipped(clipped(inside, p => p[2] - z), p => z + step - p[2]);
    if (row.length < 3) continue;
    for (let ix = Math.max(0, Math.floor((x0 - west) / step)); ix < Math.min(profile.width - 1, Math.ceil((x1 - west) / step)); ix++) {
      const x = west + ix * step;
      const cell = clipped(clipped(row, p => p[0] - x), p => x + step - p[0]);
      if (cell.length < 3) continue;
      emit(clipped(cell, p => (p[0] - x) - (p[2] - z)));
      emit(clipped(cell, p => (p[2] - z) - (p[0] - x)));
    }
  }
  return result;
}
