import data from "./data/volksbuehneV209Navigation.json";

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function edgeDistanceSquared(ring: readonly number[][], x: number, z: number): number {
  let result = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    result = Math.min(result, (x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2);
  }
  return result;
}

/** Only the new upper auditorium, stage and rear sloping roof are solid here.
 * Old lower walls, both rear courts and adjacent space retain their prior nav. */
export function volksbuehneV209SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  if (![x, y, z, radius].every(Number.isFinite) || radius < 0) return false;
  const radiusSquared = radius * radius;
  for (const volume of data.flatVolumes) {
    if (y < volume.lowY || y > volume.highY) continue;
    const [outer, ...holes] = volume.rings;
    if (inside(outer, x, z) && !holes.some(r => inside(r, x, z))) return true;
    if (volume.rings.some(r => edgeDistanceSquared(r, x, z) <= radiusSquared + 1e-12)) return true;
  }
  const roof = data.rearRoof;
  if (y < roof.lowY || y > roof.highY) return false;
  const dx = x - roof.origin[0], dz = z - roof.origin[1];
  const u = dx * roof.axis[0] + dz * roof.axis[1];
  const v = -dx * roof.axis[1] + dz * roof.axis[0];
  // At this exact height a gable's solid cross-section is a narrower rectangle.
  // Testing the horizontal disk against it respects slopes and corner radius.
  const halfWidth = roof.halfWidth * (roof.highY - y) / (roof.highY - roof.lowY);
  const du = Math.max(0, Math.abs(u) - halfWidth);
  const dv = Math.max(roof.vMin - v, 0, v - roof.vMax);
  return du * du + dv * dv <= radiusSquared + 1e-12;
}
