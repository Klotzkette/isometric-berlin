import data from "./data/weddingSitesV210Envelopes.json";

const volumes = data.volumes.map(v => {
  const rings = v.geometry.coordinates;
  const xs = rings.flat().map(p => p[0]), zs = rings.flat().map(p => p[1]);
  return { ...v, rings, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});
const barriers = data.barriers.map(v => ({ ...v,
  minX: Math.min(...v.points.map(p => p[0])), maxX: Math.max(...v.points.map(p => p[0])),
  minZ: Math.min(...v.points.map(p => p[1])), maxZ: Math.max(...v.points.map(p => p[1])),
}));
function distance(x: number, z: number, a: number[], b: number[]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
function inside(ring: number[][], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
/** Added upper hall and exact mapped boundary members. Existing core floor/body navigation stays authoritative. */
export function weddingSitesV210SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  if (x + radius < -665 || x - radius > -9 || z + radius < -2600 || z - radius > -1995) return false;
  for (const v of volumes) {
    if (y < v.low || y >= v.high || x + radius < v.minX || x - radius > v.maxX || z + radius < v.minZ || z - radius > v.maxZ) continue;
    if (inside(v.rings[0], x, z) && !v.rings.slice(1).some(r => inside(r, x, z))) return true;
    if (radius > 0) for (const ring of v.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < radius) return true;
    }
  }
  for (const b of barriers) {
    const reach = radius + b.thickness / 2;
    if (y < b.low || y >= b.high || x + reach < b.minX || x - reach > b.maxX || z + reach < b.minZ || z - reach > b.maxZ) continue;
    for (let i = 1; i < b.points.length; i++) if (distance(x, z, b.points[i - 1], b.points[i]) < reach) return true;
  }
  return false;
}
