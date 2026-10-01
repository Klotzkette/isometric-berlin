import source from "./data/spanishEmbassyV164Navigation.json";

/** Explicit identity ownership: no spatial blanket may suppress neighbouring buildings. */
export const SPANISH_EMBASSY_V164_PRISM_IDS: ReadonlySet<string> = new Set([
  "yIGjF11M", "DC13dOb2", "xytVlQkz", "IMvGGC26", "aRtl1pZV", "K0003Ul3",
]);
export const SPANISH_EMBASSY_V164_SOURCE_PROFILE = Object.freeze({
  parts: source.parts,
  names: ["Spanische Botschaft"],
  groundY: 5.2,
  licence: "dl-de/zero-2-0",
  sourceStatus: "Five complete official building parts plus the open four-column portico replace exactly six retained legacy prisms. The separately retained LoD2 portico envelope is not a closed building. Authored facade and entrance recognition remains separate from surveyed navigation roofs.",
});
export const SPANISH_EMBASSY_V164_SOURCE_BOUNDS = source.parts.map(part => ({
  part, topY: part.topY,
  minX: Math.min(...part.rings.flat().map(p => p[0])),
  maxX: Math.max(...part.rings.flat().map(p => p[0])),
  minZ: Math.min(...part.rings.flat().map(p => p[1])),
  maxZ: Math.max(...part.rings.flat().map(p => p[1])),
}));
function inRing(x: number, z: number, ring: readonly number[][], scale = 1): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] / scale > z) !== (b[1] / scale > z) &&
      x < (b[0] - a[0]) * (z - a[1] / scale) / (b[1] - a[1]) + a[0] / scale)
      inside = !inside;
  }
  return inside;
}
export function spanishEmbassyV164Contains(x: number, z: number): boolean {
  return SPANISH_EMBASSY_V164_SOURCE_BOUNDS.some(({ part, minX, maxX, minZ, maxZ }) =>
    x >= minX && x <= maxX && z >= minZ && z <= maxZ && part.rings.some((r, i) => inRing(x, z, r) && !part.holes[i].some(h => inRing(x, z, h))));
}
const nativeRoofs = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${Math.floor(x / 2)},${Math.floor(z / 2)}`, y]));
/** Native cells are checked before metric bounds: edge blocks can straddle a facade. */
export function spanishEmbassyV164RoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? null;
  if (!SPANISH_EMBASSY_V164_SOURCE_BOUNDS.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) return null;
  let roof: number | null = null;
  for (const [a, b, c] of source.roofTriangles) {
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    roof = roof === null ? y : Math.max(roof, y);
  }
  return roof;
}
/** Match only the legacy centre-sampled four-metre column and its original height. */
export function spanishEmbassyV164SourceColumn(x: number, z: number, baseY: number, topY: number): boolean {
  if (x < -1820 || x > -1745 || z < 886 || z > 953) return false;
  return source.legacyPrisms.some(p => SPANISH_EMBASSY_V164_PRISM_IDS.has(p.id) &&
    Math.abs(baseY - p.y0_dm / 10) < .11 &&
    Math.abs(topY - baseY - Math.ceil(p.h_dm / 40) * 4) < .11 &&
    inRing(x, z, p.ring, 10) && !p.holes.some(h => inRing(x, z, h, 10)));
}
