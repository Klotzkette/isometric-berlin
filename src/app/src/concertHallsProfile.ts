import source from "./data/concertHallsNavigation.json";

export const CONCERT_HALL_PRISM_IDS: ReadonlySet<string> = new Set(
  source.parts.map((part) => part.shortId),
);
export const CONCERT_HALL_PROFILE = Object.freeze({
  sourceUrl: "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip",
  licence: "dl-de/zero-2-0",
  parts: source.parts,
  surfacePartCount: 27,
  mainEntrances: [
    { name: "Philharmonie", osmNode: 247854384, sourcePart: "rzUWjRbq", worldXZ: [-200.457, 969.94], wall: [[-197.901, 979.700], [-190.129, 971.688]], groundY: 4.1, heightM: 3.3 },
    { name: "Kammermusiksaal", osmNode: 3100521550, sourcePart: "WjWjPODG", worldXZ: [-228.967, 1075.143], wall: [[-232.316, 1070.922], [-226.327, 1079.433]], groundY: 4.0, heightM: 3.7 },
  ],
  geometryStatus: "Complete official LoD2 exterior surfaces; panel pitch, glazed-door divisions and metal relief are bounded display subdivisions. Entrance nodes are OSM; doors fit their measured supporting walls.",
});

export const CONCERT_HALL_SOURCE_BOUNDS = source.parts.map((part) => ({
  topY: part.groundY + part.heightM,
  part,
  minX: Math.min(...part.rings.flat().map((p) => p[0])),
  maxX: Math.max(...part.rings.flat().map((p) => p[0])),
  minZ: Math.min(...part.rings.flat().map((p) => p[1])),
  maxZ: Math.max(...part.rings.flat().map((p) => p[1])),
}));

function inRing(x: number, z: number, ring: readonly number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]; const b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function concertHallContains(x: number, z: number): boolean {
  return CONCERT_HALL_SOURCE_BOUNDS.some(({ part, minX, maxX, minZ, maxZ }) => x >= minX && x <= maxX && z >= minZ && z <= maxZ && part.rings.some((ring) => inRing(x, z, ring)));
}

/** Actual sloping source roof, not the maximum-height prism's flat lid. */
const nativeRoofs = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${Math.floor(x / 2)},${Math.floor(z / 2)}`, y]));

export function concertHallRoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? null;
  if (!CONCERT_HALL_SOURCE_BOUNDS.some((b) => x >= b.minX - .001 && x <= b.maxX + .001 && z >= b.minZ - .001 && z <= b.maxZ + .001)) return null;
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

/** Conservative ownership of legacy 4 m building columns, never nearby props. */
export function concertHallSourceColumn(x: number, z: number, baseY: number, topY: number, halfCell = 2): boolean {
  return CONCERT_HALL_SOURCE_BOUNDS.some(({ part, minX, maxX, minZ, maxZ }) => {
    if (x + halfCell < minX || x - halfCell > maxX || z + halfCell < minZ || z - halfCell > maxZ) return false;
    if (Math.abs(baseY - part.groundY) > 1.2 || Math.abs(topY - baseY - Math.ceil(part.heightM / 4) * 4) > 0.11) return false;
    // Raster source selection uses centre-in-footprint, so requiring the same
    // centre protects the neighbouring museum and entrance canopy ownership.
    return part.rings.some((ring) => inRing(x, z, ring));
  });
}
