import type OpenSeadragon from "openseadragon";

export const CARDINAL_SNAP_TOLERANCE_DEGREES = 4;
export const MOUSE_DRAG_ROTATION_DEGREES_PER_PIXEL = 0.28;

export type RotatableGestureSettings = OpenSeadragon.GestureSettings & {
  pinchRotate: boolean;
};

export const TOUCH_GESTURE_SETTINGS: RotatableGestureSettings = {
  clickToZoom: false,
  dblClickToZoom: true,
  dragToPan: true,
  flickEnabled: true,
  flickMinSpeed: 60,
  flickMomentum: 0.5,
  pinchRotate: true,
  pinchToZoom: true,
};

export const PEN_GESTURE_SETTINGS: RotatableGestureSettings = {
  ...TOUCH_GESTURE_SETTINGS,
};

export function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function rotationDistance(left: number, right: number): number {
  const diff = Math.abs(normalizeRotation(left - right));
  return Math.min(diff, 360 - diff);
}

export function snapRotationToCardinals(
  degrees: number,
  cardinals: readonly number[],
  tolerance = CARDINAL_SNAP_TOLERANCE_DEGREES,
): number {
  const normalized = normalizeRotation(degrees);
  const closest = cardinals.reduce<number | null>((best, candidate) => {
    if (best === null) {
      return candidate;
    }
    return rotationDistance(normalized, candidate) <
      rotationDistance(normalized, best)
      ? candidate
      : best;
  }, null);
  if (closest === null || rotationDistance(normalized, closest) > tolerance) {
    return normalized;
  }
  return normalizeRotation(closest);
}

export type GesturePoint = { x: number; y: number };

export function rotationDeltaFromTouchPairs(
  previous: readonly [GesturePoint, GesturePoint],
  current: readonly [GesturePoint, GesturePoint],
): number {
  const angle = (points: readonly [GesturePoint, GesturePoint]) =>
    Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x);
  return normalizeRotation(((angle(current) - angle(previous)) * 180) / Math.PI);
}

export function rotationDeltaFromMouseDrag(deltaX: number): number {
  return deltaX * MOUSE_DRAG_ROTATION_DEGREES_PER_PIXEL;
}
