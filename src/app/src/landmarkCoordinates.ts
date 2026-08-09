export type NormalizedLandmark = {
  nx: number;
  ny: number;
};

export type ImagePoint = {
  x: number;
  y: number;
};

export function landmarkPixelCoordinates(
  landmark: NormalizedLandmark,
  imageWidth: number,
  imageHeight: number,
): ImagePoint {
  return {
    x: Math.min(1, Math.max(0, landmark.nx)) * imageWidth,
    y: Math.min(1, Math.max(0, landmark.ny)) * imageHeight,
  };
}
