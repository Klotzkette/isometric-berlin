import data from "./data/westCivicV210Navigation.json";

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function near(ring: readonly number[][], x: number, z: number, radius: number): boolean {
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    if ((x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2 <= radius * radius) return true;
  }
  return false;
}

/** Existing building navigation stays intact. Only added upper bodies and
 * the tight artwork plinth are represented here; no courtyard/road envelope. */
export function westCivicSolidAtV210(x: number, y: number, z: number, radius = 0): boolean {
  if (![x, y, z, radius].every(Number.isFinite) || radius < 0) return false;
  return data.volumes.some(v => y >= v.lowY && y <= v.highY && (
    (inside(v.ring, x, z) && !v.holes.some(h => inside(h, x, z))) ||
    near(v.ring, x, z, radius) || v.holes.some(h => near(h, x, z, radius))
  ));
}
