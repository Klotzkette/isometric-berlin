export type MiniMapImagePoint = {
  x: number;
  y: number;
};

export type PedestrianMiniMapTransform = {
  height: number;
  legendWidth: number;
  maxEasting: number;
  maxNorthing: number;
  minEasting: number;
  minNorthing: number;
  pad: number;
  width: number;
};

export const REFERENCE_MAP_TRANSFORM: PedestrianMiniMapTransform = {
  height: 1300,
  legendWidth: 800,
  maxEasting: 391910.578288,
  maxNorthing: 5823617.370211,
  minEasting: 385602.60218,
  minNorthing: 5817089.115618,
  pad: 52,
  width: 2200,
} as const;

export const WORLD_EASTING_OFFSET_M = 389500;
export const WORLD_NORTHING_ORIGIN_M = 5820000;

export function miniMapScale(transform: PedestrianMiniMapTransform): number {
  const mapWidth = transform.width - transform.legendWidth;
  const spanX = transform.maxEasting - transform.minEasting;
  const spanY = transform.maxNorthing - transform.minNorthing;
  return Math.min(
    (mapWidth - transform.pad * 2) / spanX,
    (transform.height - transform.pad * 2) / spanY,
  );
}

export function worldToReferenceMapPoint(
  worldX: number,
  worldZ: number,
  transform: PedestrianMiniMapTransform = REFERENCE_MAP_TRANSFORM,
): MiniMapImagePoint {
  const scale = miniMapScale(transform);
  const easting = worldX + WORLD_EASTING_OFFSET_M;
  const northing = WORLD_NORTHING_ORIGIN_M - worldZ;
  return {
    x: transform.pad + (easting - transform.minEasting) * scale,
    y: transform.pad + (transform.maxNorthing - northing) * scale,
  };
}

export function miniMapCardinalRotationDegrees(
  orientationDegrees: number,
  northUpRotation: number,
): number {
  const rotation = -(orientationDegrees - northUpRotation);
  return Object.is(rotation, -0) ? 0 : rotation;
}

export function miniMapHeadingRotationDegrees(
  headingDegrees: number,
  orientationDegrees: number,
  northUpRotation: number,
): number {
  return headingDegrees + miniMapCardinalRotationDegrees(
    orientationDegrees,
    northUpRotation,
  );
}
