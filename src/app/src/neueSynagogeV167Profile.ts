import source from "./data/neueSynagogeV167Navigation.json";

export const NEUE_SYNAGOGE_V167_PRISM_IDS: ReadonlySet<string> = new Set(source.legacyPrisms.map(p => p.id));
export const NEUE_SYNAGOGE_V167_PARENT_IDS: ReadonlySet<string> = new Set(source.parents.map(p => p.id));
export const NEUE_SYNAGOGE_V167_PARTS = source.parts;
export const NEUE_SYNAGOGE_V167_PROFILE = Object.freeze({
  parents: source.parents, parts: source.parts, names: ["Neue Synagoge / Centrum Judaicum"],
  osmWayId: "24054915", monumentId: "09080249", sourceBoundaryPolygons: 127,
  historicalRearHallRebuilt: false,
  sourceStatus: "All four surveyed parts retained. Current gilded crown, missing upper right tower and small ornament are explicitly estimated additive detail; approximately 50 m overall is primary published context.",
});
const towerIds = new Set(["DEBE3DYIHbEo8Vy5", "DEBE3DUO8TFzQeXH"]);
export const NEUE_SYNAGOGE_V167_SOURCE_BOUNDS = source.parts.map(part => ({
  part, topY: part.id === "DEBE3DNfKjXQh90W" ? 55.2 : towerIds.has(part.id) ? 42.1 : part.topY,
  minX: Math.min(...part.polygons.flatMap(p => p.ring.map(v => v[0]))),
  maxX: Math.max(...part.polygons.flatMap(p => p.ring.map(v => v[0]))),
  minZ: Math.min(...part.polygons.flatMap(p => p.ring.map(v => v[1]))),
  maxZ: Math.max(...part.polygons.flatMap(p => p.ring.map(v => v[1]))),
}));
function inRing(x: number, z: number, ring: readonly number[][], scale = 1): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] / scale > z) !== (b[1] / scale > z) &&
      x < (b[0] - a[0]) * (z - a[1] / scale) / (b[1] - a[1]) + a[0] / scale) inside = !inside;
  }
  return inside;
}
export function neueSynagogeV167Contains(x: number, z: number): boolean {
  return NEUE_SYNAGOGE_V167_SOURCE_BOUNDS.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ &&
    b.part.polygons.some(p => inRing(x, z, p.ring) && !p.holes.some(h => inRing(x, z, h))));
}
/** Exact legacy OSM prism ring, source base and 4 m native top quantization. */
export function neueSynagogeV167SourceColumn(x: number, z: number, baseY: number, topY: number): boolean {
  return source.legacyPrisms.some(p => Math.abs(baseY - p.y0_dm / 10) < .11 &&
    Math.abs(topY - baseY - Math.ceil(p.h_dm / 40) * 4) < .11 &&
    inRing(x, z, p.ring, 10) && !p.holes.some(h => inRing(x, z, h, 10)));
}
const nativeRoofs = new Map(source.nativeRoofCells.map(([ix, iz, y]) => [`${ix},${iz}`, y]));
export function neueSynagogeV167RoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x / .5)},${Math.floor(z / .5)}`) ?? null;
  if (x < 1539 || x > 1595 || z < -670 || z > -615) return null;
  let roof: number | null = null;
  const take = (y: number) => { roof = roof === null ? y : Math.max(roof, y); };
  for (const [a, b, c] of source.roofTriangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001) take(u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  for (const dome of source.domes) {
    const r = Math.hypot(x - dome.center[0], z - dome.center[1]);
    for (let i = 1; i < dome.profile.length; i++) {
      const [ya, ra] = dome.profile[i - 1], [yb, rb] = dome.profile[i];
      if (r >= Math.min(ra, rb) && r <= Math.max(ra, rb) && ra !== rb) take(ya + (yb - ya) * (r - ra) / (rb - ra));
    }
    if (r < dome.profile.at(-1)![1]) take(dome.profile.at(-1)![0]);
    if (r < .13) take(dome.finialTopY);
  }
  return roof;
}
