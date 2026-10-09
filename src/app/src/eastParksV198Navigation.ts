import solids from './data/eastParksV198Navigation.json';
import waters from './data/eastParksV198Water.json';

type Ring = readonly (readonly number[])[];
function contains(ring: Ring, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function touches(ring: Ring, x: number, z: number, radius: number): boolean {
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1], len = dx * dx + dz * dz;
    const t = len > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len)) : 0;
    if ((x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2 <= radius * radius + 1e-12) return true;
  }
  return false;
}
const rows = solids.map(row => {
  const xs = row.ring.map(p => p[0]), zs = row.ring.map(p => p[1]);
  const bounds = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  return { ...row, bounds, tapered: row.owner === 'way/142701792' || row.owner === 'way/1002636043' };
});

/** Source-owned bodies in both styles; holes and open entrance arches remain open. */
export function eastParksV198SolidAt(x: number, y: number, z: number, radius = 0, _native = false): boolean {
  if (![x, y, z, radius].every(Number.isFinite)) return false;
  radius = Math.max(0, radius);
  for (const row of rows) {
    const b = row.bounds;
    if (y < row.groundY || y > row.topY || x < b[0] - radius || x > b[2] + radius || z < b[1] - radius || z > b[3] + radius) continue;
    let px = x, pz = z, r = radius;
    if (row.tapered) {
      const scale = 1 - Math.min(13, Math.floor(y - row.groundY)) / 25;
      const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
      px = cx + (x - cx) / scale; pz = cz + (z - cz) / scale; r /= scale;
    }
    if (touches(row.ring, px, pz, r)) return true;
    if (!contains(row.ring, px, pz)) continue;
    if (row.holes.some(h => touches(h, px, pz, r))) return true;
    if (!row.holes.some(h => contains(h, px, pz))) return true;
  }
  return false;
}

/** Small three-polygon water payload; native queries match the visible source-contained runs. */
export function eastParksV198WaterAt(x: number, z: number, native = false): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (const water of waters) {
    if (native) {
      if (water.nativeRuns.some(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2)) return water.y;
    } else if (contains(water.rings[0], x, z) && !water.rings.slice(1).some(h => contains(h, x, z))) return water.y;
  }
  return null;
}
