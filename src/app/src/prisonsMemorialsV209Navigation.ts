import data from "./data/prisonsMemorialsV209Navigation.json";

type Shape = { type: string; coordinates: unknown };
type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number };
const polygonsOf = (g: Shape): number[][][][] =>
  g.type === "Polygon" ? [g.coordinates as number[][][]] : g.coordinates as number[][][][];
function boundsOf(points: number[][]): Bounds {
  const bounds = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const [x, z] of points) {
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  return bounds;
}
const nearBounds = (b: Bounds, x: number, z: number, radius = 0) =>
  x + radius >= b.minX && x - radius <= b.maxX && z + radius >= b.minZ && z - radius <= b.maxZ;

// Index the original rings once. A remote query visits three site bounds;
// a local query checks only nearby owner bounds before any polygon/edge work.
const sites = data.sites.map(site => {
  const polygons = polygonsOf(site.geometry), groundBounds = boundsOf(polygons.flat(2));
  const owners = data.owners.filter(owner => owner.site === site.key).map(owner => {
    const polygons = polygonsOf(owner.geometry);
    return { ...owner, polygons, bounds: boundsOf(polygons.flat(2)) };
  });
  const walls = data.barriers.filter(wall => wall.site === site.key).map(wall => ({
    ...wall, bounds: boundsOf(wall.sourceCoordinates), thickness: wall.barrier === "wall" ? .25 : .08,
  }));
  const bounds = { ...groundBounds };
  for (const entry of [...owners, ...walls]) {
    bounds.minX = Math.min(bounds.minX, entry.bounds.minX); bounds.maxX = Math.max(bounds.maxX, entry.bounds.maxX);
    bounds.minZ = Math.min(bounds.minZ, entry.bounds.minZ); bounds.maxZ = Math.max(bounds.maxZ, entry.bounds.maxZ);
  }
  return { polygons, groundBounds, bounds, owners, walls, gates: data.gates.filter(gate => gate.site === site.key) };
});
function ringContains(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function contains(polygons: number[][][][], x: number, z: number): boolean {
  return polygons.some(p => ringContains(p[0], x, z) && !p.slice(1).some(r => ringContains(r, x, z)));
}
function segmentDistance(x: number, z: number, a: number[], b: number[]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
/** Finite site/context support; no surrounding district ground is invented. */
export function prisonsMemorialsV209GroundAt(x: number, z: number): number | null {
  return sites.some(s => nearBounds(s.groundBounds, x, z) && contains(s.polygons, x, z)) ? data.groundY : null;
}
/** Footprint holes and represented mapped gate gaps remain traversable. */
export function prisonsMemorialsV209SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  for (const site of sites) {
    if (!nearBounds(site.bounds, x, z, radius + .25)) continue;
    for (const owner of site.owners) {
      if (y <= owner.low || y >= owner.high || !nearBounds(owner.bounds, x, z, radius)) continue;
      if (contains(owner.polygons, x, z)) return true;
      if (radius > 0) for (const polygon of owner.polygons) for (const ring of polygon) {
        // Include every original outer/courtyard edge and the closing edge,
        // whether or not the retained ring repeats its first vertex.
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
          if (segmentDistance(x, z, ring[j], ring[i]) < radius) return true;
      }
    }
    for (const wall of site.walls) {
      if (y < data.groundY || y > data.groundY + wall.height ||
          !nearBounds(wall.bounds, x, z, radius + wall.thickness)) continue;
      if (site.gates.some(g => Math.hypot(x - g.position[0], z - g.position[1]) < g.width / 2 - radius)) continue;
      for (let i = 1; i < wall.sourceCoordinates.length; i++)
        if (segmentDistance(x, z, wall.sourceCoordinates[i - 1], wall.sourceCoordinates[i]) < radius + wall.thickness) return true;
    }
  }
  return false;
}
