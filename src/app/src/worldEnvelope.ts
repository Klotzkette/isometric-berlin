// Owner-approved task-13 source hull, rounded outward to whole decametres in
// scene world metres. It is the second exact EPSG:25833 500 m outward buffer,
// this time around the complete task-12 polygon. Current OSM and context
// buildings span this hull. The extrapolated paper margin starts outside it.
export const DATA_WEST_M = -3900;
export const DATA_EAST_M = 2420;
export const DATA_NORTH_M = -3620;
export const DATA_SOUTH_M = 2920;

// Width of the blank paper ring that carries the drawing past the surveyed
// hull, so a maximum-altitude flight fades into light ground instead of a
// void. It invents no content: flat tone plates plus cartographic ruling.
// The task-13 source hull adds real mapped context instead of more blank paper.
// At 790 m every rectangular corner remains inside the versioned 6,450 m
// visible radius while retaining a broad clean fade past the last feature.
export const EXTRAPOLATED_MARGIN_M = 790;

export const VISIBLE_RADIUS_M = 6450;

// Presentation-only backing planes must sit below every authored underground
// structure. The Tiergartentunnel road reaches about -8.5 m; older -5.5/-8 m
// backdrops became visible as soon as its entrance cut was opened and looked
// like grass or paper roofing the descending carriageway.
export const PRESENTATION_FLOOR_Y_M = -24;

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
