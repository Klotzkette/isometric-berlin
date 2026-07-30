// Hull of the SURVEYED data as fetched for the task-09 expanded
// bounds.geojson (LoD2 buildings E386627..390182 / N5818392..5821304, OSM
// layers and the official tree/lamp points inside the same polygon), rounded
// out to whole decametres in scene world metres. Everything inside this box
// is measured open data; the extrapolated paper margin starts outside it.
export const DATA_WEST_M = -2880;
export const DATA_EAST_M = 690;
export const DATA_NORTH_M = -1310;
export const DATA_SOUTH_M = 1620;

// Width of the blank paper ring that carries the drawing past the surveyed
// hull, so a maximum-altitude flight fades into light ground instead of a
// void. It invents no content: flat tone plates plus cartographic ruling.
export const EXTRAPOLATED_MARGIN_M = 1200;

export const VISIBLE_RADIUS_M = 5030;

// Straße des 17. Juni from Pariser Platz to the Großer Stern. Both endpoints
// are surveyed positions (the Großer Stern centre is EPSG:25833 E388041 /
// N5819544), used by the Siegessäule recognition model.
export const AXIS_FROM: readonly [number, number] = [372, 292];
export const AXIS_TO: readonly [number, number] = [-1459, 456];

export type EnvelopeBand = readonly [
  centerX: number,
  centerZ: number,
  sizeX: number,
  sizeZ: number,
];

/**
 * The four paper plates that ring the surveyed hull: north, south, west and
 * east. Corners are covered because the north and south bands run the full
 * outer width.
 */
export function extrapolatedMarginBands(): EnvelopeBand[] {
  const outerWest = DATA_WEST_M - EXTRAPOLATED_MARGIN_M;
  const outerEast = DATA_EAST_M + EXTRAPOLATED_MARGIN_M;
  const outerWidth = outerEast - outerWest;
  const outerCenterX = (outerWest + outerEast) / 2;
  const dataDepth = DATA_SOUTH_M - DATA_NORTH_M;
  const dataCenterZ = (DATA_NORTH_M + DATA_SOUTH_M) / 2;
  return [
    [
      outerCenterX,
      DATA_NORTH_M - EXTRAPOLATED_MARGIN_M / 2,
      outerWidth,
      EXTRAPOLATED_MARGIN_M,
    ],
    [
      outerCenterX,
      DATA_SOUTH_M + EXTRAPOLATED_MARGIN_M / 2,
      outerWidth,
      EXTRAPOLATED_MARGIN_M,
    ],
    [
      DATA_WEST_M - EXTRAPOLATED_MARGIN_M / 2,
      dataCenterZ,
      EXTRAPOLATED_MARGIN_M,
      dataDepth,
    ],
    [
      DATA_EAST_M + EXTRAPOLATED_MARGIN_M / 2,
      dataCenterZ,
      EXTRAPOLATED_MARGIN_M,
      dataDepth,
    ],
  ];
}

export type EnvelopeBounds = {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
};

export function extrapolatedEnvelopeBounds(): EnvelopeBounds {
  const bands = extrapolatedMarginBands();
  return {
    maxX: Math.max(DATA_EAST_M, ...bands.map(([x, , width]) => x + width / 2)),
    maxZ: Math.max(DATA_SOUTH_M, ...bands.map(([, z, , depth]) => z + depth / 2)),
    minX: Math.min(DATA_WEST_M, ...bands.map(([x, , width]) => x - width / 2)),
    minZ: Math.min(DATA_NORTH_M, ...bands.map(([, z, , depth]) => z - depth / 2)),
  };
}
