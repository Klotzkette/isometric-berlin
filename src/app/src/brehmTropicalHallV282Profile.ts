import data from './data/brehmTropicalHallV282.json';
import type { SurroundingCityChunk } from './SurroundingCityGeometry';

type Point = readonly number[];

/** Exact complete parent witness. No roof is published for a stale/partial
 * packet, duplicate parent part, changed datum or a neighbouring packet. */
export function hasBrehmTropicalHallParentV282(chunk: Pick<SurroundingCityChunk, 'origin' | 'nav'>, id: string): boolean {
  if (id !== data.packetId || chunk.origin.some((value, i) => value !== data.packetOrigin[i]) || chunk.nav.groundY !== data.groundY) return false;
  const records = chunk.nav.buildings.filter(b => (b as typeof b & { partId?: string }).partId === data.parentId);
  if (records.length !== 1) return false;
  const p = records[0], witness = data.parentGuard;
  return p.sourceId === witness.sourceId && p.height === witness.height && p.minHeight === witness.minHeight &&
    (p.groundOffset ?? 0) === 0 && JSON.stringify(p.ring) === JSON.stringify(witness.ring) &&
    JSON.stringify(p.holes) === JSON.stringify(witness.holes);
}

/** Maximum of one actual roof plane inside a horizontal collision disc.
 * Its extrema lie at an enclosed vertex, an edge/disc intersection or the
 * plane-gradient extremum on the disc. This avoids a flat max-height prism.
 */
function triangleHeight(a: Point, b: Point, c: Point, x: number, z: number, radius: number): number | null {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-10) return null;
  const bary = (px: number, pz: number): [number, number, number] => {
    const u = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / det;
    const v = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / det;
    return [u, v, 1 - u - v];
  };
  const at = (px: number, pz: number): number | null => {
    const weights = bary(px, pz);
    return Math.min(...weights) >= -1e-7 ? weights[0] * a[1] + weights[1] * b[1] + weights[2] * c[1] : null;
  };
  let high = at(x, z);
  if (radius <= 0) return high;
  const accept = (height: number | null): void => {
    if (height !== null) high = Math.max(high ?? -Infinity, height);
  };
  const gx = ((b[2] - c[2]) * (a[1] - c[1]) + (c[2] - a[2]) * (b[1] - c[1])) / det;
  const gz = ((c[0] - b[0]) * (a[1] - c[1]) + (a[0] - c[0]) * (b[1] - c[1])) / det;
  const gradient = Math.hypot(gx, gz);
  if (gradient > 1e-10) accept(at(x + radius * gx / gradient, z + radius * gz / gradient));
  for (const [p, q] of [[a, b], [b, c], [c, a]]) {
    const dx = q[0] - p[0], dz = q[2] - p[2], length2 = dx * dx + dz * dz;
    if (length2 < 1e-12) continue;
    const middle = ((x - p[0]) * dx + (z - p[2]) * dz) / length2;
    const distance2 = (p[0] + middle * dx - x) ** 2 + (p[2] + middle * dz - z) ** 2;
    if (distance2 > radius * radius) continue;
    const spread = Math.sqrt(Math.max(0, radius * radius - distance2) / length2);
    const low = Math.max(0, middle - spread), upper = Math.min(1, middle + spread);
    if (low <= upper) {
      accept(p[1] + (q[1] - p[1]) * low);
      accept(p[1] + (q[1] - p[1]) * upper);
    }
  }
  return high;
}

/** World coordinates; occupied columns and drawn roof each use their own data. */
export function brehmTropicalHallRoofAtV282(native: boolean, x: number, z: number, radius = 0): number | null {
  let high: number | null = null;
  const [xmin, zmin, xmax, zmax] = data.nativeBounds;
  if (x + radius < xmin - 1 || x - radius > xmax + 1 || z + radius < zmin - 1 || z - radius > zmax + 1) return null;
  if (native) {
    for (const [cx, cz, width, top] of data.nativeRuns) {
      const dx = Math.max(cx - x, 0, x - cx - width), dz = Math.max(cz - z, 0, z - cz - 1);
      if (dx * dx + dz * dz <= radius * radius && (radius > 0 || (x < cx + width && z < cz + 1)))
        high = Math.max(high ?? -Infinity, top);
    }
  } else for (const [a, b, c] of data.roofIndices) {
    const height = triangleHeight(data.roofVertices[a], data.roofVertices[b], data.roofVertices[c], x, z, radius);
    if (height !== null) high = Math.max(high ?? -Infinity, height);
  }
  return high;
}

/** Called only by the resident packet that successfully attached this roof. */
export function brehmTropicalHallSolidAtV282(native: boolean, x: number, y: number, z: number, radius = 0): boolean {
  if (y < (native ? data.nativeBottomY : data.bottomY) || y > (native ? data.nativeMaxY : data.maxY)) return false;
  const roof = brehmTropicalHallRoofAtV282(native, x, z, radius);
  return roof !== null && y <= roof + 1e-6;
}
