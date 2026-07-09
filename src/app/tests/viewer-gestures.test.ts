import { describe, expect, test } from "bun:test";

import {
  PEN_GESTURE_SETTINGS,
  TOUCH_GESTURE_SETTINGS,
  rotationDeltaFromTouchPairs,
  snapRotationToCardinals,
} from "../src/viewerGestures";

describe("touch viewer gestures", () => {
  test("enables pinch rotation, pinch zoom, pan, and controlled flicks", () => {
    for (const settings of [TOUCH_GESTURE_SETTINGS, PEN_GESTURE_SETTINGS]) {
      expect(settings.pinchRotate).toBe(true);
      expect(settings.pinchToZoom).toBe(true);
      expect(settings.dragToPan).toBe(true);
      expect(settings.flickEnabled).toBe(true);
      expect(settings.flickMinSpeed).toBe(120);
      expect(settings.flickMomentum).toBe(0.25);
    }
  });

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
});
