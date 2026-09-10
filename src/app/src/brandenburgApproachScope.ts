import { BRANDENBURG_APPROACH_SCOPE } from "./brandenburgApproachScopeData";

type Point = readonly [number, number];
const polygons = BRANDENBURG_APPROACH_SCOPE.map((polygon) => ({
  ...polygon,
  minX: Math.min(...polygon.ring.map(([x]) => x)),
  maxX: Math.max(...polygon.ring.map(([x]) => x)),
  minZ: Math.min(...polygon.ring.map(([, z]) => z)),
  maxZ: Math.max(...polygon.ring.map(([, z]) => z)),
}));

function insideRing(x: number, z: number, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function nearBoundary(x: number, z: number, ring: readonly Point[], radius: number): boolean {
  const squared = radius * radius;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    const dx = bx - ax, dz = bz - az;
    const length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2)) : 0;
    if ((x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 <= squared) return true;
  }
  return false;
}

/** A clearance disk keeps every corner of a removed raster cell inside its replacement. */
export function pointInBrandenburgApproach(x: number, z: number, clearanceM = 0): boolean {
  for (const p of polygons) {
    if (x < p.minX + clearanceM || x > p.maxX - clearanceM ||
        z < p.minZ + clearanceM || z > p.maxZ - clearanceM || !insideRing(x, z, p.ring)) continue;
    if (p.holes.some((hole) => insideRing(x, z, hole))) continue;
    if (clearanceM > 0 && [p.ring, ...p.holes].some((ring) => nearBoundary(x, z, ring, clearanceM))) continue;
    return true;
  }
  return false;
}
