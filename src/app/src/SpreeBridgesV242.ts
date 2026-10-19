import payload from "./data/spreeBridgesV242.json";
import previous from "./data/spreeBridgeCorePreviousV242.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPolygon } from "./SurroundingCityGeometry";
import { groundTopSampler, type VoxelPayload } from "./terrainPayload";

export type SpreeBridgeNavigationV242 = {
  floors: (SurroundingPolygon & { y: number })[];
  solids: (SurroundingPolygon & { low: number; high: number })[];
};
type Navigation = SurroundingNavigation & { spreeBridgesV242?: SpreeBridgeNavigationV242 };
export type SpreeBridgeCorePacketV242 = SurroundingCityChunk & { owner: string; name: string };

/** Only called while constructing the required core bridge root. The complete
 * outer meshes reside in their existing packets, not in this module's data. */
export function spreeBridgeCorePacketsV242(native = false): SpreeBridgeCorePacketV242[] {
  return (payload.core[native ? "minecraft" : "drawn"] as unknown) as SpreeBridgeCorePacketV242[];
}

const receipts = new Map(previous.records.map(r => [
  r.cells.map(p => p.join(",")).sort().join(";"), r,
]));

/** Exact whole source-cell set only. Changed, partial and unrelated clusters
 * keep their older estimate; matching never uses a bounding rectangle. */
export function spreeBridgeCoreOwnerV242(ground: VoxelPayload, cluster: Array<[number, number]>): string | null {
  if (ground.cell_m !== previous.cellM || !cluster.length) return null;
  const cells = cluster.map(([x, z]) => `${(x + ground.grid.min_x_idx) * ground.cell_m},${(z + ground.grid.min_z_idx) * ground.cell_m}`);
  const receipt = receipts.get(cells.sort().join(";"));
  if (!receipt) return null;
  const top = groundTopSampler(ground);
  let base = (ground.water_top_y_m ?? 1.31) + 5.4;
  for (const [x, z] of cluster) base = Math.max(base, top(x, z) + 0.55);
  return Math.abs(base - receipt.baseY) <= 0.001 ? receipt.sourceId : null;
}

const bounds = new WeakMap<SurroundingPolygon, readonly number[]>();
function boxOf(p: SurroundingPolygon): readonly number[] {
  let b = bounds.get(p);
  if (!b) {
    let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
    for (const [x, z] of p.ring) { minx = Math.min(minx, x); minz = Math.min(minz, z); maxx = Math.max(maxx, x); maxz = Math.max(maxz, z); }
    b = [minx, minz, maxx, maxz]; bounds.set(p, b);
  }
  return b;
}
function ringContains(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function contains(p: SurroundingPolygon, x: number, z: number): boolean {
  return ringContains(p.ring, x, z) && !p.holes.some(r => ringContains(r, x, z));
}
function nearRing(ring: number[][], x: number, z: number, radius: number): boolean {
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
    if ((x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2 <= radius * radius) return true;
  }
  return false;
}

/** Navigation belongs only to resident packets; no global outer-city index. */
export function spreeBridgeFloorAtV242(nav: Navigation, x: number, z: number): number | null {
  if (![x, z].every(Number.isFinite)) return null;
  let top: number | null = null;
  for (const p of nav.spreeBridgesV242?.floors ?? []) {
    const b = boxOf(p);
    if (x < b[0] || z < b[1] || x > b[2] || z > b[3] || !contains(p, x, z)) continue;
    top = Math.max(top ?? -Infinity, p.y);
  }
  return top;
}

export function spreeBridgeSolidAtV242(nav: Navigation, x: number, y: number, z: number, radius = 0): boolean {
  if (![x, y, z, radius].every(Number.isFinite) || radius < 0) return false;
  for (const p of nav.spreeBridgesV242?.solids ?? []) {
    if (y < p.low || y > p.high) continue;
    const b = boxOf(p);
    if (x + radius < b[0] || z + radius < b[1] || x - radius > b[2] || z - radius > b[3]) continue;
    if (contains(p, x, z) || (radius > 0 && [p.ring, ...p.holes].some(r => nearRing(r, x, z, radius)))) return true;
  }
  return false;
}
