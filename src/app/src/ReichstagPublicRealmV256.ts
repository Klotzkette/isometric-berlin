import data from "./data/reichstagPublicRealmV256.json";

type Vec = [number, number, number];
type Parts = {
  native: boolean;
  box(position: Vec, size: Vec, tint: number, yaw?: number): void;
};

export const REICHSTAG_PUBLIC_REALM_V256 = {
  source: "geo_data/regierungsviertel/reichstag-public-v256-source.json",
  sourceSha256: data.sourceSha256,
  counts: data.counts,
  fountainName: "Wasserspiele im Forum am Kanzleramt",
  location: "West of Paul-Löbe-Haus, between Paul-Löbe-Haus and Bundeskanzleramt",
  geometryStatus: "Exact retained OSM fountain-strip rings and existing kerb courses; grate, nozzle, static jet and joint dimensions are display estimates.",
  sourceGeometryRetained: true,
  fullStaticDetailOnTouch: true,
  textureFree: true,
  cameras: {
    fountains: { eye: [-17, 22, -96], target: [42, 3.8, -139] },
    reichstagSouth: { eye: [178, 25, 191], target: [242, 3.5, 130] },
    reichstagNorth: { eye: [197, 24, -14], target: [237, 3.5, -61] },
  },
} as const;

/** Shares the existing public-space batch, terrain and disposal. The 20 mapped
 * strips are ground-level water-wall slots, not basin or platform footprints.
 * Water is a static recognition cue and does not assert current pump operation.
 * Native members are independently built orthogonal cells within source rings. */
export function appendReichstagPublicRealmV256(
  parts: Parts,
  terrainAt: (x: number, z: number) => number,
): number {
  const rows = parts.native ? data.nativeRows : data.boxes;
  for (const row of rows) {
    const [x, y, z, width, height, depth] = row;
    parts.box(
      [x, terrainAt(x, z) + y, z],
      [width, height, depth],
      row[parts.native ? 6 : 7],
      parts.native ? 0 : row[6],
    );
  }
  return rows.length;
}
