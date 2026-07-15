import { describe, expect, test } from "bun:test";

import {
  PEN_GESTURE_SETTINGS,
  TOUCH_GESTURE_SETTINGS,
  rotationDeltaFromMouseDrag,
  rotationDeltaFromTouchPairs,
  snapRotationToCardinals,
} from "../src/viewerGestures";

describe("touch viewer gestures", () => {
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
    expect(rotationDeltaFromMouseDrag(100)).toBeCloseTo(28);
    expect(rotationDeltaFromMouseDrag(-50)).toBeCloseTo(-14);
  });
});
