/** Shared OSM/official metric anchors for both drawn and Minecraft modes. */
export const HUMBOLDTHAFEN_SOURCES = {
  officialBank:
    "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/wasserbau/uferwaende/humboldthafen/",
  officialTerrainPlan:
    "https://www.berlin.de/sen/stadtentwicklung/_assets/planung/bebauungsplanverfahren/02_ii-201da_begruendung.pdf",
  water: "OSM way 52189421",
  northCrest: "OSM footway 237691534",
  eastPromenade: "OSM footway 237691524",
  ramps: ["OSM ways 1087036422", "1087036423"],
  settPaths: [
    "OSM ways 1087036419",
    "1087036421",
    "1087036424",
    "1087036425",
    "1087036426",
    "1190534970",
  ],
  steps: ["OSM way 896110818", "OSM way 1190534971"],
} as const;

/** Exact north-bank portion of OSM water polygon 52189421, world metres. */
export const HUMBOLDTHAFEN_NORTH_WATERLINE_M = [
  [-5.8, -847.1],
  [24.1, -846.4],
  [24.1, -845.5],
  [24.9, -844.6],
  [27.7, -844.5],
  [28.5, -845.3],
  [28.5, -846.3],
  [101.591, -844.435],
] as const;

/** Exact OSM 237691534 endpoints; this is the DGM-grounded upper crest. */
export const HUMBOLDTHAFEN_NORTH_CREST_M = [
  [-15.975, -857.225],
  [101.591, -855.83],
] as const;

export type SandkrugOsmCarriageway = {
  bounds: { maxX: number; maxZ: number; minX: number; minZ: number };
  points: readonly [readonly [number, number], readonly [number, number]];
  wayId: number;
};

/** The two independently mapped Invalidenstraße carriageways. */
export const SANDKRUG_OSM_CARRIAGEWAYS: readonly SandkrugOsmCarriageway[] = [
  {
    bounds: {
      maxX: 202.532,
      maxZ: -977.198,
      minX: 172.324,
      minZ: -991.05,
    },
    points: [
      [172.324, -977.198],
      [202.532, -991.05],
    ],
    wayId: 36260393,
  },
  {
    bounds: {
      maxX: 198.19,
      maxZ: -989.219,
      minX: 168.231,
      minZ: -1002.854,
    },
    points: [
      [198.19, -1002.854],
      [168.231, -989.219],
    ],
    wayId: 248010193,
  },
] as const;

export const SANDKRUG_OSM_DECK = {
  axis: [0.9095796753, -0.4155295589] as const,
  centreWorldM: [185.31925, -990.08025] as const,
  inventoryLengthM: 32.6,
  inventoryWidthM: 28.8,
  inventorySource:
    "Masterplan Brücken Berlin 2025–2040, Anlage 1, BW 3446035 (data status 06/2025)",
  osmWays: [36260393, 248010193] as const,
} as const;

/** The erroneous pre-correction bearing, retained only as a regression pin. */
export const LEGACY_WRONG_SANDKRUG_AXIS = [0.31623, 0.94868] as const;

export const HUMBOLDTHAFEN_ROAD_AXES = {
  hugoPreussBridge: {
    osmWay: 26109166,
    points: [
      [12.879, -515.04],
      [38.71, -517.373],
      [57.315, -517.71],
      [78.089, -516.974],
      [101, -514.421],
    ],
  },
  kapelleUfer: {
    osmWay: 1009714187,
    points: [
      [101, -514.421],
      [125.455, -509.909],
      [153.804, -502.304],
    ],
  },
  rahelHirschStrasse: {
    osmWay: 4592633,
    points: [
      [-37.383, -505.058],
      [-15.677, -510.466],
      [12.879, -515.04],
    ],
  },
} as const;

export const HUGO_PREUSS_OSM_DECK = {
  axis: [0.999975, 0.00702] as const,
  centreWorldM: [57.3, -514.73] as const,
  curveSagittaM: -2.98,
  inventoryLengthM: 88.41,
  inventoryWidthM: 23.56,
  inventorySource:
    "Masterplan Brücken Berlin 2025–2040, Anlage 1 (data status 06/2025)",
  osmWay: 26109166,
} as const;

/** Recognises only the source-backed north sloped-bank replacement run. */
export function isNorthernHumboldthafenQuayEdge(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const sourceNotch =
    mx >= 23.5 && mx <= 29.1 && mz >= -847.1 && mz <= -844.4;
  return (
    sourceNotch ||
    (mx >= -8 &&
      mx <= 104 &&
      mz >= -850.5 &&
      mz <= -840.5 &&
      Math.abs(bx - ax) >= Math.abs(bz - az) * 1.45)
  );
}

export function northernHumboldthafenCrestZAt(x: number): number {
  const [[ax, az], [bx, bz]] = HUMBOLDTHAFEN_NORTH_CREST_M;
  const t = Math.max(0, Math.min(1, (x - ax) / (bx - ax)));
  return az + (bz - az) * t;
}

export function northernHumboldthafenWaterZAt(x: number): number {
  const points = HUMBOLDTHAFEN_NORTH_WATERLINE_M;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    if (x < Math.min(ax, bx) || x > Math.max(ax, bx) || ax === bx) continue;
    const t = (x - ax) / (bx - ax);
    return az + (bz - az) * t;
  }
  return points[x < points[0][0] ? 0 : points.length - 1][1];
}

/** Exact predicate shared by Minecraft ground suppression and replacement. */
export function isNorthernHumboldthafenReplacementCell(
  x: number,
  z: number,
): boolean {
  if (x < -5.8 || x > 101.591) return false;
  const waterZ = northernHumboldthafenWaterZAt(x);
  const crestZ = northernHumboldthafenCrestZAt(x);
  return z >= Math.min(waterZ, crestZ) && z <= Math.max(waterZ, crestZ);
}
