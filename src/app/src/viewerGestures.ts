import type OpenSeadragon from "openseadragon";

export const CARDINAL_SNAP_TOLERANCE_DEGREES = 4;
export const MOUSE_DRAG_ROTATION_DEGREES_PER_PIXEL = 0.28;

export type RotatableGestureSettings = OpenSeadragon.GestureSettings & {
  pinchRotate: boolean;
};

// Desktop direct-manipulation contract: the primary button moves the map,
// while the secondary button deliberately changes the camera orbit.
export const THREE_MOUSE_GESTURE_SETTINGS = {
  // Three's public MOUSE enum is ROTATE=0, DOLLY=1, PAN=2. Keeping the
  // stable protocol values here prevents map-only UI helpers from eagerly
  // pulling the complete Three.js runtime into the app-shell bundle.
  LEFT: 2,
  MIDDLE: 1,
  RIGHT: 0,
} as const;

export type WheelNavigationIntent =
  | "mouse-wheel-zoom"
  | "trackpad-pan"
  | "trackpad-pinch";

export type WheelNavigationSample = {
  ctrlKey: boolean;
  deltaMode: number;
  deltaX: number;
  deltaY: number;
};

export type PedestrianTouchTap = {
  at: number;
  durationMs: number;
  maxTravelPx: number;
  x: number;
  y: number;
};

export type ViewerGestureResetState = {
  controlsInteracting: boolean;
  customTouchGestureActive: boolean;
  panMomentumActive: boolean;
  pedestrianLookPointerActive: boolean;
  touchInteracting: boolean;
  touchPointCount: number;
};

export type PanGlideCancelState = {
  customTouchGestureActive: boolean;
  pedestrianTouchLookActive: boolean;
  touchInteracting: boolean;
  touchPointCount: number;
};

/** Keep the RAF touch flag only while a real touch gesture still exists. */
export function touchInteractionAfterPanGlideCancel({
  customTouchGestureActive,
  pedestrianTouchLookActive,
  touchInteracting,
  touchPointCount,
}: PanGlideCancelState): boolean {
  return (
    customTouchGestureActive ||
    pedestrianTouchLookActive ||
    (touchInteracting && touchPointCount > 0)
  );
}

/** Detect every interaction state cleared by a blur/visibility reset. */
export function viewerGestureResetRequired({
  controlsInteracting,
  customTouchGestureActive,
  panMomentumActive,
  pedestrianLookPointerActive,
  touchInteracting,
  touchPointCount,
}: ViewerGestureResetState): boolean {
  return (
    touchPointCount > 0 ||
    customTouchGestureActive ||
    touchInteracting ||
    controlsInteracting ||
    pedestrianLookPointerActive ||
    panMomentumActive
  );
}

// Phone taps are less precise than mouse clicks, especially one-handed. These
// thresholds deliberately allow a relaxed double tap while staying below a
// short look-drag: every participating pointer must still complete alone and
// remain within the travel bound, so a second finger/pinch cannot qualify.
export const PEDESTRIAN_TAP_MAX_DURATION_MS = 380;
export const PEDESTRIAN_TAP_MAX_TRAVEL_PX = 24;
export const PEDESTRIAN_JUMP_DOUBLE_TAP_MS = 520;
export const PEDESTRIAN_JUMP_DOUBLE_TAP_RADIUS_PX = 56;

export function isPedestrianTouchTap(sample: PedestrianTouchTap): boolean {
  return (
    sample.durationMs >= 0 &&
    sample.durationMs <= PEDESTRIAN_TAP_MAX_DURATION_MS &&
    sample.maxTravelPx <= PEDESTRIAN_TAP_MAX_TRAVEL_PX
  );
}

/** A forgiving double tap that cannot be produced by a drag or pinch. */
export function isPedestrianJumpDoubleTap(
  previous: PedestrianTouchTap | null,
  current: PedestrianTouchTap,
): boolean {
  if (
    !previous ||
    !isPedestrianTouchTap(previous) ||
    !isPedestrianTouchTap(current)
  ) {
    return false;
  }
  const elapsed = current.at - previous.at;
  return (
    elapsed >= 0 &&
    elapsed <= PEDESTRIAN_JUMP_DOUBLE_TAP_MS &&
    Math.hypot(current.x - previous.x, current.y - previous.y) <=
      PEDESTRIAN_JUMP_DOUBLE_TAP_RADIUS_PX
  );
}

const PEDESTRIAN_WHEEL_NOTCH_PIXELS = 100;
const PEDESTRIAN_WHEEL_LINE_PIXELS = 32;
const PEDESTRIAN_WHEEL_PAGE_PIXELS = 240;

/**
 * Convert a vertical wheel gesture into pedestrian forward input. A regular
 * wheel notch reaches full walking input, while high-resolution trackpad
 * deltas stay proportional. Browser pinch events and horizontal gestures do
 * not move the pedestrian.
 */
export function pedestrianWheelForwardInput(
  sample: WheelNavigationSample,
): number {
  if (
    sample.ctrlKey ||
    !Number.isFinite(sample.deltaX) ||
    !Number.isFinite(sample.deltaY) ||
    Math.abs(sample.deltaY) <= Math.abs(sample.deltaX)
  ) {
    return 0;
  }
  const pixels =
    sample.deltaMode === 1
      ? sample.deltaY * PEDESTRIAN_WHEEL_LINE_PIXELS
      : sample.deltaMode === 2
        ? Math.sign(sample.deltaY) * PEDESTRIAN_WHEEL_PAGE_PIXELS
        : sample.deltaY;
  return Math.max(-1, Math.min(1, -pixels / PEDESTRIAN_WHEEL_NOTCH_PIXELS));
}

/**
 * Separate a stepped mouse wheel from high-resolution trackpad input.
 * Browsers expose trackpad pinch as ctrl+wheel, while two-finger scroll
 * usually arrives as pixel-mode, fractional or horizontal wheel deltas.
 * `recentTrackpadPan` keeps a fast swipe classified consistently after its
 * first small delta, even when later momentum events become large integers.
 */
export function wheelNavigationIntent(
  sample: WheelNavigationSample,
  recentTrackpadPan = false,
): WheelNavigationIntent {
  if (sample.ctrlKey) {
    return "trackpad-pinch";
  }
  if (sample.deltaMode !== 0) {
    return "mouse-wheel-zoom";
  }
  if (recentTrackpadPan) {
    return "trackpad-pan";
  }
  const hasHorizontalMotion = Math.abs(sample.deltaX) > 0.01;
  const hasFractionalMotion =
    !Number.isInteger(sample.deltaX) || !Number.isInteger(sample.deltaY);
  const isFineMotion = Math.max(
    Math.abs(sample.deltaX),
    Math.abs(sample.deltaY),
  ) < 50;
  return hasHorizontalMotion || hasFractionalMotion || isFineMotion
    ? "trackpad-pan"
    : "mouse-wheel-zoom";
}

// Touch profile v0.5.2: two-finger swipe pans (does not rotate) and pinch
// zoom automatically follows the pinch centre. Rotation stays reachable
// through the on-screen rotate buttons and the keyboard shortcuts. This
// matches the natural iPhone expectation that swiping fingers left moves
// the map contents left along with the fingers, not spinning the map.
// v0.5.5: lower the flick threshold and raise the momentum so a light
// two-finger swipe glides the map instead of stopping dead — the previous
// 60 px/s / 0.5 momentum felt sticky on a phone. Pinch-zoom semantics are
// unchanged.
export const TOUCH_GESTURE_SETTINGS: RotatableGestureSettings = {
  clickToZoom: false,
  dblClickToZoom: true,
  dragToPan: true,
  flickEnabled: true,
  flickMinSpeed: 35,
  flickMomentum: 0.68,
  pinchRotate: false,
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
