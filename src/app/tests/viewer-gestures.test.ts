import { describe, expect, test } from "bun:test";
import { MOUSE } from "three";

import {
  PEDESTRIAN_JUMP_DOUBLE_TAP_MS,
  PEDESTRIAN_JUMP_DOUBLE_TAP_RADIUS_PX,
  PEDESTRIAN_TAP_MAX_DURATION_MS,
  PEDESTRIAN_TAP_MAX_TRAVEL_PX,
  PEN_GESTURE_SETTINGS,
  THREE_MOUSE_GESTURE_SETTINGS,
  TOUCH_GESTURE_SETTINGS,
  accumulateBoundedFrameDelta,
  isPedestrianJumpDoubleTap,
  isPedestrianTouchTap,
  pedestrianWheelForwardInput,
  rotationDeltaFromMouseDrag,
  rotationDeltaFromTouchPairs,
  snapRotationToCardinals,
  touchInteractionAfterPanGlideCancel,
  viewerGestureResetRequired,
  wheelNavigationIntent,
  wheelZoomFactor,
} from "../src/viewerGestures";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

describe("touch viewer gestures", () => {
  test("coalesces high-frequency samples without a runaway frame jump", () => {
    expect(accumulateBoundedFrameDelta(18, 7, 24)).toBe(24);
    expect(accumulateBoundedFrameDelta(-18, -7, 24)).toBe(-24);
    expect(accumulateBoundedFrameDelta(3, -5, 24)).toBe(-2);
    expect(accumulateBoundedFrameDelta(3, Number.NaN, 24)).toBe(0);
  });

  test("settles wheel input from one RAF deadline without per-event timers", () => {
    expect(viewerSource).toContain("wheelEndNotifyAt = now + 180");
    expect(viewerSource).toContain("timestamp >= wheelEndNotifyAt");
    expect(viewerSource).not.toContain("wheelEndNotifyAt = Number.NEGATIVE_INFINITY");
    expect(viewerSource).toContain("wheelEndNotifyAt = Number.POSITIVE_INFINITY");
    expect(viewerSource).not.toContain("wheelEndTimer");
  });

  test("drops cancelled glide activity unless a real touch gesture remains", () => {
    expect(
      touchInteractionAfterPanGlideCancel({
        customTouchGestureActive: false,
        pedestrianTouchLookActive: false,
        touchInteracting: false,
        touchPointCount: 0,
      }),
    ).toBe(false);
    expect(
      touchInteractionAfterPanGlideCancel({
        customTouchGestureActive: true,
        pedestrianTouchLookActive: false,
        touchInteracting: false,
        touchPointCount: 0,
      }),
    ).toBe(true);
    expect(
      touchInteractionAfterPanGlideCancel({
        customTouchGestureActive: false,
        pedestrianTouchLookActive: true,
        touchInteracting: false,
        touchPointCount: 0,
      }),
    ).toBe(true);
    expect(
      touchInteractionAfterPanGlideCancel({
        customTouchGestureActive: false,
        pedestrianTouchLookActive: false,
        touchInteracting: false,
        touchPointCount: 1,
      }),
    ).toBe(false);
    expect(
      touchInteractionAfterPanGlideCancel({
        customTouchGestureActive: false,
        pedestrianTouchLookActive: false,
        touchInteracting: true,
        touchPointCount: 1,
      }),
    ).toBe(true);
  });

  test("resets blur state for mouse controls and pedestrian look too", () => {
    const idle = {
      controlsInteracting: false,
      customTouchGestureActive: false,
      panMomentumActive: false,
      pedestrianLookPointerActive: false,
      touchInteracting: false,
      touchPointCount: 0,
    };
    expect(viewerGestureResetRequired(idle)).toBe(false);
    expect(
      viewerGestureResetRequired({ ...idle, controlsInteracting: true }),
    ).toBe(true);
    expect(
      viewerGestureResetRequired({
        ...idle,
        pedestrianLookPointerActive: true,
      }),
    ).toBe(true);
    expect(
      viewerGestureResetRequired({ ...idle, panMomentumActive: true }),
    ).toBe(true);
  });

  test("primary drag pans while secondary drag deliberately orbits", () => {
    expect(THREE_MOUSE_GESTURE_SETTINGS.LEFT).toBe(MOUSE.PAN);
    expect(THREE_MOUSE_GESTURE_SETTINGS.MIDDLE).toBe(MOUSE.DOLLY);
    expect(THREE_MOUSE_GESTURE_SETTINGS.RIGHT).toBe(MOUSE.ROTATE);
  });

  test(
    "v0.5.2: two-finger swipe pans (no accidental rotation), pinch zooms, " +
      "flicks are controlled",
    () => {
      for (const settings of [TOUCH_GESTURE_SETTINGS, PEN_GESTURE_SETTINGS]) {
        // Rotation on two-finger swipe felt weird on iPhone (people expect
        // pan). The rotate buttons and the mouse-drag rotation still cover
        // rotation on desktop and via the on-screen controls.
        expect(settings.pinchRotate).toBe(false);
        expect(settings.pinchToZoom).toBe(true);
        expect(settings.dragToPan).toBe(true);
        expect(settings.flickEnabled).toBe(true);
        // v0.5.5: lighter flick threshold + more momentum for effortless
        // phone panning (still bounded so a hard swipe does not fling away).
        expect(settings.flickMinSpeed).toBe(35);
        expect(settings.flickMomentum).toBe(0.68);
        expect(settings.flickMomentum).toBeLessThan(1);
      }
    },
  );

  test("a two-touch twist advances rotation by more than 15 degrees", () => {
    const delta = rotationDeltaFromTouchPairs(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 6.7, y: -25 },
        { x: 93.3, y: 25 },
      ],
    );

    expect(delta).toBeGreaterThan(15);
    expect(delta).toBeLessThan(45);
  });

  test("snaps only rotations within four degrees of a cardinal", () => {
    const cardinals = [296.565, 26.565, 116.565, 206.565] as const;

    expect(snapRotationToCardinals(299.9, cardinals)).toBeCloseTo(296.565);
    expect(snapRotationToCardinals(301, cardinals)).toBeCloseTo(301);
  });

  test("turns a deliberate shift-drag into a controlled free rotation", () => {
    expect(rotationDeltaFromMouseDrag(100)).toBeCloseTo(38);
    expect(rotationDeltaFromMouseDrag(-50)).toBeCloseTo(-19);
  });

  test("normalizes mouse-wheel zoom across browser delta modes", () => {
    expect(
      wheelZoomFactor({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: -100,
      }),
    ).toBeCloseTo(Math.exp(0.22));
    expect(
      wheelZoomFactor({
        ctrlKey: false,
        deltaMode: 1,
        deltaX: 0,
        deltaY: 3,
      }),
    ).toBeCloseTo(Math.exp(-96 * 0.0022));
    expect(
      wheelZoomFactor({
        ctrlKey: true,
        deltaMode: 0,
        deltaX: 0,
        deltaY: -10,
      }),
    ).toBe(1);
    expect(
      wheelZoomFactor({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 20,
        deltaY: 10,
      }),
    ).toBe(1);
  });

  test("separates trackpad pan and pinch from a stepped mouse wheel", () => {
    expect(
      wheelNavigationIntent({
        ctrlKey: true,
        deltaMode: 0,
        deltaX: 0,
        deltaY: -4.5,
      }),
    ).toBe("trackpad-pinch");
    expect(
      wheelNavigationIntent({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 7.25,
        deltaY: 18.5,
      }),
    ).toBe("trackpad-pan");
    expect(
      wheelNavigationIntent({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 100,
      }),
    ).toBe("mouse-wheel-zoom");
    expect(
      wheelNavigationIntent(
        {
          ctrlKey: false,
          deltaMode: 0,
          deltaX: 0,
          deltaY: 96,
        },
        true,
      ),
    ).toBe("trackpad-pan");
    expect(
      wheelNavigationIntent({
        ctrlKey: false,
        deltaMode: 1,
        deltaX: 0,
        deltaY: 3,
      }),
    ).toBe("mouse-wheel-zoom");
  });

  test("turns the pedestrian mouse wheel into bounded forward travel", () => {
    expect(
      pedestrianWheelForwardInput({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: -100,
      }),
    ).toBe(1);
    expect(
      pedestrianWheelForwardInput({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 100,
      }),
    ).toBe(-1);
    expect(
      pedestrianWheelForwardInput({
        ctrlKey: false,
        deltaMode: 1,
        deltaX: 0,
        deltaY: -3,
      }),
    ).toBe(1);
    expect(
      pedestrianWheelForwardInput({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 12.5,
      }),
    ).toBeCloseTo(-0.15625);
    expect(
      pedestrianWheelForwardInput({
        ctrlKey: true,
        deltaMode: 0,
        deltaX: 0,
        deltaY: -100,
      }),
    ).toBe(0);
    expect(
      pedestrianWheelForwardInput({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 20,
        deltaY: 10,
      }),
    ).toBe(0);
  });

  test("turns two completed, nearby pedestrian taps into one jump gesture", () => {
    const first = {
      at: 1_000,
      durationMs: 82,
      maxTravelPx: 3,
      x: 120,
      y: 240,
    };
    const second = {
      at: 1_390,
      durationMs: 94,
      maxTravelPx: 5,
      x: 143,
      y: 255,
    };

    expect(isPedestrianTouchTap(first)).toBe(true);
    expect(isPedestrianJumpDoubleTap(first, second)).toBe(true);
  });

  test("gives a one-handed mobile double tap a generous inclusive window", () => {
    const first = {
      at: 1_000,
      durationMs: PEDESTRIAN_TAP_MAX_DURATION_MS,
      maxTravelPx: PEDESTRIAN_TAP_MAX_TRAVEL_PX,
      x: 100,
      y: 100,
    };
    const second = {
      ...first,
      at: 1_000 + PEDESTRIAN_JUMP_DOUBLE_TAP_MS,
      x: 100 + PEDESTRIAN_JUMP_DOUBLE_TAP_RADIUS_PX,
    };
    expect(PEDESTRIAN_TAP_MAX_DURATION_MS).toBeGreaterThanOrEqual(360);
    expect(PEDESTRIAN_TAP_MAX_TRAVEL_PX).toBeGreaterThanOrEqual(24);
    expect(PEDESTRIAN_JUMP_DOUBLE_TAP_MS).toBeGreaterThanOrEqual(500);
    expect(PEDESTRIAN_JUMP_DOUBLE_TAP_RADIUS_PX).toBeGreaterThanOrEqual(52);
    expect(isPedestrianTouchTap(first)).toBe(true);
    expect(isPedestrianJumpDoubleTap(first, second)).toBe(true);
  });

  test("never mistakes a look drag, long press, distant tap or stale tap for a jump", () => {
    const tap = {
      at: 1_000,
      durationMs: 90,
      maxTravelPx: 2,
      x: 100,
      y: 100,
    };

    expect(
      isPedestrianJumpDoubleTap(tap, {
        ...tap,
        at: 1_200,
        maxTravelPx: PEDESTRIAN_TAP_MAX_TRAVEL_PX + 1,
      }),
    ).toBe(false);
    expect(
      isPedestrianJumpDoubleTap(tap, {
        ...tap,
        at: 1_200,
        durationMs: PEDESTRIAN_TAP_MAX_DURATION_MS + 1,
      }),
    ).toBe(false);
    expect(
      isPedestrianJumpDoubleTap(tap, {
        ...tap,
        at: 1_200,
        x: 100 + PEDESTRIAN_JUMP_DOUBLE_TAP_RADIUS_PX + 1,
      }),
    ).toBe(false);
    expect(
      isPedestrianJumpDoubleTap(tap, {
        ...tap,
        at: 1_000 + PEDESTRIAN_JUMP_DOUBLE_TAP_MS + 1,
      }),
    ).toBe(false);
    expect(isPedestrianJumpDoubleTap(null, tap)).toBe(false);
  });
});
