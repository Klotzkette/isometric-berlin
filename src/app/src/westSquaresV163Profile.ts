import source from "./data/westSquaresV163Navigation.json";

/** Explicit identity ownership: no spatial blanket may suppress neighbouring buildings. */
export const WEST_SQUARES_V163_PRISM_IDS: ReadonlySet<string> = new Set([
  "-5396409", "-5396410", "26369724", "40452037",
]);
export const WEST_SQUARES_V163_SOURCE_PROFILE = Object.freeze({
  parts: source.parts,
  names: ["KaDeWe", "Wittenbergplatz pavilion", "Telefunken-Hochhaus"],
  groundY: 5.2,
  licence: "dl-de/zero-2-0",
  sourceStatus: "All nine official parts replace exactly four retained legacy prisms. Authored facade and roof recognition remains separate from surveyed navigation roofs.",
});
export const WEST_SQUARES_V163_SOURCE_BOUNDS = source.parts.map(part => ({
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
export function westSquaresV163Contains(x: number, z: number): boolean {
  return WEST_SQUARES_V163_SOURCE_BOUNDS.some(({ part, minX, maxX, minZ, maxZ }) =>
    x >= minX && x <= maxX && z >= minZ && z <= maxZ && part.rings.some(r => inRing(x, z, r)));
}
const nativeRoofs = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${Math.floor(x / 2)},${Math.floor(z / 2)}`, y]));
/** Native cells are checked before metric bounds: edge blocks can straddle a facade. */
export function westSquaresV163RoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? null;
  if (!WEST_SQUARES_V163_SOURCE_BOUNDS.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) return null;
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
export function westSquaresV163SourceColumn(x: number, z: number, baseY: number, topY: number): boolean {
  if (x < -3480 || x > -1900 || z < 400 || z > 2050) return false;
  return source.legacyPrisms.some(p => WEST_SQUARES_V163_PRISM_IDS.has(p.id) &&
    Math.abs(baseY - p.y0_dm / 10) < .11 &&
    Math.abs(topY - baseY - Math.ceil(p.h_dm / 40) * 4) < .11 &&
    inRing(x, z, p.ring, 10) && !p.holes.some(h => inRing(x, z, h, 10)));
}
