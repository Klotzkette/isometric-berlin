import source from "./data/huthmacherNavigation.json";

export const HUTHMACHER_PRISM_IDS: ReadonlySet<string> = new Set(source.legacyPrisms.map(p => p.id));
export const HUTHMACHER_PROFILE = Object.freeze({
  sourceUrl: "https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5818.zip",
  licence: "dl-de/zero-2-0",
  parts: source.parts,
  names: ["Huthmacher-Haus / DOB-Hochhaus"],
  groundY: 5.2,
  sourceStatus: "Complete official LoD2 walls and roofs replace exactly one older OSM maximum-height prism. Facade subdivisions are source-clipped display detail.",
});

export const HUTHMACHER_SOURCE_BOUNDS = source.parts.map(part => ({
  part, topY: part.topY,
  minX: Math.min(...part.rings.flat().map(p => p[0])), maxX: Math.max(...part.rings.flat().map(p => p[0])),
  minZ: Math.min(...part.rings.flat().map(p => p[1])), maxZ: Math.max(...part.rings.flat().map(p => p[1])),
}));
function inRing(x: number, z: number, ring: readonly number[][], scale = 1): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] / scale > z) !== (b[1] / scale > z) && x < (b[0] - a[0]) * (z - a[1] / scale) / (b[1] - a[1]) + a[0] / scale) inside = !inside;
  }
  return inside;
}
export function huthmacherContains(x: number, z: number): boolean {
  return HUTHMACHER_SOURCE_BOUNDS.some(({ part, minX, maxX, minZ, maxZ }) => x >= minX && x <= maxX && z >= minZ && z <= maxZ && part.rings.some(r => inRing(x, z, r)));
}
const nativeRoofs = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${Math.floor(x / 2)},${Math.floor(z / 2)}`, y]));
export function huthmacherRoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? null;
  if (!HUTHMACHER_SOURCE_BOUNDS.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) return null;
  let roof: number | null = null;
  for (const [a, b, c] of source.roofTriangles) {
    const denom = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denom) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denom;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denom;
    if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    roof = roof === null ? y : Math.max(roof, y);
  }
  return roof;
}
/** Match the original centre-sampled 4 m columns and their exact height only. */
export function huthmacherSourceColumn(x: number, z: number, baseY: number, topY: number): boolean {
  return source.legacyPrisms.some(p => Math.abs(baseY - p.y0_dm / 10) < .11 && Math.abs(topY - baseY - Math.ceil(p.h_dm / 40) * 4) < .11 && inRing(x, z, p.ring, 10) && !p.holes.some(h => inRing(x, z, h, 10)));
}
