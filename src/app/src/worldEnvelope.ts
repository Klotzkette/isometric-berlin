// Owner-approved v159 outline scope, rounded outward to whole decametres.
// The full existing city remains in its original coordinate frame; additional
// source-bound context covers Moabit, Prenzlauer Berg and four finite lobes.
// These rectangular extrema are a presentation envelope, not the data polygon.
export const DATA_WEST_M = -6160;
export const DATA_EAST_M = 6840;
export const DATA_NORTH_M = -4380;
export const DATA_SOUTH_M = 4380;

// Width of the blank paper ring that carries the drawing past the surveyed
// hull, so a maximum-altitude flight fades into light ground instead of a
// void. It invents no content: only flat tone plates outside the source bounds.
// At 790 m every rectangular corner remains inside the versioned 9,250 m
// visible radius while retaining a broad clean fade past the last feature.
export const EXTRAPOLATED_MARGIN_M = 790;

export const VISIBLE_RADIUS_M = 9250;

// Presentation-only backing planes must sit below every authored underground
// structure. The Tiergartentunnel road reaches about -8.5 m; older -5.5/-8 m
// backdrops became visible as soon as its entrance cut was opened and looked
// like grass or paper roofing the descending carriageway.
export const PRESENTATION_FLOOR_Y_M = -24;

// Existing 16 km drawn backdrop, shared with sparse outline extensions so
// coplanar paper surfaces never overlap. Minecraft uses the smaller envelope.
export const PRESENTATION_BACKDROP_BOUNDS = {
  minX: -8220, maxX: 7780, minZ: -7790, maxZ: 8210,
};

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
