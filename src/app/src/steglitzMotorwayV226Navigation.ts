import data from "./data/steglitzMotorwayV226Navigation.json";

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function within(x: number, z: number, radius = 0): boolean {
  const [x0, z0, x1, z1] = data.bounds;
  return x >= x0 - radius - data.cellM && x <= x1 + radius + data.cellM && z >= z0 - radius - data.cellM && z <= z1 + radius + data.cellM;
}
function planAt(x: number, z: number): boolean {
  return data.polygons.some(rings => inside(rings[0], x, z) && !rings.slice(1).some(r => inside(r, x, z)));
}
function elevation(z: number): number {
  for (let i = 1; i < data.profile.length; i++) {
    const [a, low] = data.profile[i - 1], [b, high] = data.profile[i];
    if (z >= a && z <= b) return low + (high - low) * (z - a) / (b - a);
  }
  return 3.09;
}
/** Native support is the actual retained two-metre cell, including its edge,
 * not the smooth source polygon beneath the orthogonal representation. */
export function steglitzMotorwayV226DeckAt(x: number, z: number, native = false): number | null {
  if (!within(x, z)) return null;
  if (native) {
    x = Math.floor(x / data.cellM) * data.cellM + data.cellM / 2;
    z = Math.floor(z / data.cellM) * data.cellM + data.cellM / 2;
  }
  if (!planAt(x, z)) return null;
  const y = elevation(z);
  return native ? Math.round(y * 4) / 4 : y;
}
/** Never raise someone underneath the viaduct onto its deck. */
export function steglitzMotorwayV226GroundAt(x: number, z: number, currentFootY: number, native = false): number | null {
  if (!Number.isFinite(currentFootY)) return null;
  const top = steglitzMotorwayV226DeckAt(x, z, native);
  return top !== null && currentFootY >= top - .45 ? top : null;
}
export function steglitzMotorwayV226SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (!within(x, z, radius)) return false;
  const probes = radius > 0 ? [[x, z], [x - radius, z], [x + radius, z], [x, z - radius], [x, z + radius]] : [[x, z]];
  for (const [px, pz] of probes) {
    const top = steglitzMotorwayV226DeckAt(px, pz, native);
    if (top !== null && y >= top - data.thickness && y <= top) return true;
  }
  for (const r of native ? data.nativeRails : data.rails) {
    if (y < r[1] - r[4] / 2 || y > r[1] + r[4] / 2) continue;
    const dx = x - r[0], dz = z - r[2], c = native ? 1 : Math.cos(r[6]), s = native ? 0 : Math.sin(r[6]);
    if (Math.abs(dx * c - dz * s) <= r[3] / 2 + radius && Math.abs(dx * s + dz * c) <= r[5] / 2 + radius) return true;
  }
  return false;
}
