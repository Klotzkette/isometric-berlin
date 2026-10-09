import source from "./data/centralSitesV200Navigation.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";

type Ring = readonly (readonly number[])[];
function inside(x: number, z: number, ring: Ring): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
export const CENTRAL_SITES_V200_NAVIGATION_BUILDINGS = source.buildings.map(p => ({ ...p,
  topY: Math.max(...p.roofTriangles.flatMap(t => t.map(v => v[1]))),
  lift: buildingTerrainOffset(p.id, p.anchor[0], p.anchor[1], p.groundY),
  bounds: [Math.min(...p.polygons.flatMap(q => q.ring.map(v => v[0]))), Math.min(...p.polygons.flatMap(q => q.ring.map(v => v[1]))), Math.max(...p.polygons.flatMap(q => q.ring.map(v => v[0]))), Math.max(...p.polygons.flatMap(q => q.ring.map(v => v[1])))],
}));

const buildings = CENTRAL_SITES_V200_NAVIGATION_BUILDINGS;

/** Additional source bodies; caller retains the original HQ/HU prism obstacles. */
export function centralSitesV200NavigationForPrism(id: string) {
  return buildings.filter(p => p.legacyPrismIds.includes(id));
}

function roofAt(p: typeof buildings[number], x: number, z: number): number | null {
  let roof: number | null = null;
  for (const [a, b, c] of p.roofTriangles) {
    const determinant = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(determinant) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / determinant;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / determinant;
    if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1] + p.lift;
    roof = roof === null ? y : Math.max(roof, y);
  }
  return roof;
}

/** Only newly visible measured envelopes; the real courtyard holes remain free. */
export function centralSitesV200SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  for (const p of buildings) {
    const [west, north, east, south] = p.bounds;
    if (x < west - radius || x > east + radius || z < north - radius || z > south + radius || y < p.groundY + p.lift) continue;
    for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
      const px = x + dx, pz = z + dz;
      if (!p.polygons.some(q => inside(px, pz, q.ring) && !q.holes.some(h => inside(px, pz, h)))) continue;
      const roof = roofAt(p, px, pz);
      if (roof !== null && y <= roof) return true;
    }
  }
  return false;
}

/** Exact planar roof interpolation is shared by camera landing and collision. */
export function centralSitesV200RoofAt(x: number, z: number): number | null {
  let top: number | null = null;
  for (const p of buildings) {
    if (!p.polygons.some(q => inside(x, z, q.ring) && !q.holes.some(h => inside(x, z, h)))) continue;
    const roof = roofAt(p, x, z);
    if (roof !== null) top = top === null ? roof : Math.max(top, roof);
  }
  return top;
}
