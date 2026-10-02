import source from "./data/berlinWallMemorialV174Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const BERLIN_WALL_MEMORIAL_V174_PRISM_IDS: ReadonlySet<string> = new Set(["45664094", "53333454"]);
export const BERLIN_WALL_MEMORIAL_V174_BUILDINGS = source.buildings;
export const BERLIN_WALL_MEMORIAL_V174_PARTS = source.buildings;
export const BERLIN_WALL_MEMORIAL_V174_SOLIDS = source.solids;
export const BERLIN_WALL_MEMORIAL_V174_POSTS = source.posts;
export const BERLIN_WALL_MEMORIAL_V174_ENCLOSURE = source.inaccessibleEnclosure;
export const BERLIN_WALL_MEMORIAL_V174_ARTWORK_KEYS: ReadonlySet<string> = new Set(source.genericArtworkSuppressionKeys);
export const BERLIN_WALL_MEMORIAL_V174_PROFILE = Object.freeze({
  name: "Gedenkstätte Berliner Mauer · Bernauer Straße",
  focusWorldM: [1305, 8.8, -1754] as const,
  focusDistanceM: 150,
  museumFocusWorldM: [1270, 12, -1800] as const,
  publicSiteFocusWorldM: [1300, 6, -1750] as const,
  groundY: source.groundY,
  officialMonumentId: "09040270,T,001",
  preservedExistingParents: source.retainedParents,
  preservedSectionPublishedLengthM: [64, 70] as const,
  exactMappedEnclosureWay: "45664093",
  completeMuseumSourceParts: source.buildings.length,
  reconstructionPolicy: "present-day enclosed national monument only; public memorial landscape and its crossings stay open",
  sourcePolicy: "exact OSM line courses plus complete official museum source parts; only two older OSM fallback envelopes replaced",
});

const contains = (x: number, z: number, ring: readonly number[][]): boolean =>
  pointInWorldRing(x, z, ring as unknown as WorldRing);

/** Exact source roof planes for ordinary walking; native height uses its 0.75 m cells. */
export function berlinWallMemorialV174RoofAt(x: number, z: number, minecraft = false): number | null {
  if (x < 1105 || x > 1287 || z < -1820 || z > -1615) return null;
  let roof: number | null = null;
  for (const [a, b, c] of source.roofTriangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
    const value = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    const height = minecraft ? (Math.floor(value / 0.75) + 1) * 0.75 : value;
    roof = roof === null ? height : Math.max(roof, height);
  }
  return roof;
}

/** Match only the two specific old fallback voxel bodies, never nearby buildings. */
export function berlinWallMemorialV174SourceColumn(x: number, z: number, base: number, top: number): boolean {
  if (x < 1105 || x > 1287 || z < -1820 || z > -1615) return false;
  return source.legacyPrisms.some((p) =>
    Math.abs(base - p.y0_dm / 10) < 0.11 &&
    Math.abs(top - base - Math.ceil(p.h_dm / 40) * 4) < 0.11 &&
    contains(x * 10, z * 10, p.ring) &&
    !p.holes.some((hole) => contains(x * 10, z * 10, hole)),
  );
}

/** The inaccessible enclosure is the exact mapped monument, not the whole site. */
export function berlinWallMemorialV174EnclosureContains(x: number, z: number): boolean {
  return x >= 1270 && x <= 1340 && z >= -1795 && z <= -1719 && contains(x, z, source.inaccessibleEnclosure);
}

/** Solid obstacle footprints retain the public crossings between the marker bars. */
export function berlinWallMemorialV174SolidAt(x: number, z: number, y: number, radius = 0): boolean {
  if (x < 1100 || x > 1535 || z < -2015 || z > -1495) return false;
  const occupied = (px: number, pz: number) =>
    source.solids.some((s) => y > s.y0 - 0.05 && y < s.y1 + 0.05 && contains(px, pz, s.ring)) ||
    (y > source.groundY && source.posts.some(([sx, sz, halfWidth, top]) =>
      y < top && Math.abs(px - sx) <= halfWidth && Math.abs(pz - sz) <= halfWidth,
    ));
  return occupied(x, z) || (radius > 0 && (
    occupied(x - radius, z) || occupied(x + radius, z) ||
    occupied(x, z - radius) || occupied(x, z + radius)
  ));
}
