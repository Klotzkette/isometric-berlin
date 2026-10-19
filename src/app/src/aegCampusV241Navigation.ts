import raw from "./data/aegCampusV241Navigation.json";

type SurfaceOwner = { id?: string; owner?: string; ring: number[][]; holes: number[][][]; low: number; high: number };
const data = raw as { sites: { key: string; bounds: number[]; owners: SurfaceOwner[]; roofTriangles: number[][][]; pads: SurfaceOwner[] }[] };

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function contains(p: { ring: number[][]; holes: number[][][] }, x: number, z: number): boolean {
  return inside(p.ring, x, z) && !p.holes.some(r => inside(r, x, z));
}
function inBounds(b: readonly number[], x: number, z: number, margin = 0): boolean {
  return x >= b[0] - margin && x <= b[2] + margin && z >= b[1] - margin && z <= b[3] + margin;
}
function roofAt(triangles: readonly number[][][], x: number, z: number, native: boolean): number | null {
  let roof: number | null = null;
  for (const [a, b, c] of triangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -.000001 || v < -.000001 || u + v > 1.000001) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    roof = Math.max(roof ?? -Infinity, native ? Math.floor(y) + 1 : y);
  }
  return roof;
}
export function aegCampusV241RoofAt(x: number, z: number, native = false): number | null {
  for (const site of data.sites) if (inBounds(site.bounds, x, z)) {
    const roof = roofAt(site.roofTriangles, x, z, native); if (roof !== null) return roof;
  }
  return null;
}
/** Real represented pad support also exists where the earlier city has no tile. */
export function aegCampusV241TerrainAt(x: number, z: number, native = false): number | null {
  for (const site of data.sites) if (inBounds(site.bounds, x, z))
    for (const pad of site.pads) if (contains(pad, x, z)) return native ? Math.floor(pad.high) + 1 : pad.high;
  return null;
}
/** Courtyards stay open and a high roof never lifts a pedestrian from below. */
export function aegCampusV241GroundAt(x: number, z: number, feet: number, native = false): number | null {
  if (!Number.isFinite(feet)) return null;
  for (const site of data.sites) if (inBounds(site.bounds, x, z)) {
    const roof = roofAt(site.roofTriangles, x, z, native);
    if (roof !== null && feet >= roof - .45) return roof;
    for (const pad of site.pads) if (contains(pad, x, z)) {
      const y = native ? Math.floor(pad.high) + 1 : pad.high;
      if (feet >= y - .45) return y;
    }
  }
  return null;
}
export function aegCampusV241SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  for (const site of data.sites) if (inBounds(site.bounds, x, z, radius + (native ? 1 : 0))) {
    for (const p of site.owners) {
      if (y <= (native ? Math.floor(p.low) : p.low) || y > p.high + (native ? 1 : 0)) continue;
      if (contains(p, x, z)) {
        const roof = roofAt(site.roofTriangles, x, z, native); if (roof !== null && y < roof) return true;
      }
      if (radius > 0) for (const ring of [p.ring, ...p.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        const px = a[0] + t * dx, pz = a[1] + t * dz;
        if (Math.hypot(x - px, z - pz) < radius) {
          const roof = roofAt(site.roofTriangles, px, pz, native); if (roof !== null && y < roof) return true;
        }
      }
    }
    for (const pad of site.pads) if (y > pad.low && y < pad.high && contains(pad, x, z)) return true;
  }
  return false;
}

export const aegCampusNavigationV241 = data;
