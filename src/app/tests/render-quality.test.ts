import { describe, expect, test } from "bun:test";

import {
  ACTIVE_MOTION_FRAME_INTERVAL_MS,
  STABLE_DESKTOP_PIXEL_BUDGET,
  STABLE_DESKTOP_PIXEL_RATIO_CAP,
  STABLE_TOUCH_PIXEL_BUDGET,
  STABLE_TOUCH_PIXEL_RATIO_CAP,
  renderInteractionActive,
  renderPixelRatio,
} from "../src/renderQuality";

describe("stable 3D render quality", () => {
  test("does not discard alternate touch frames during camera motion", () => {
    expect(ACTIVE_MOTION_FRAME_INTERVAL_MS).toBe(0);
  });

  test("recognises every direct interaction source", () => {
    expect(
      renderInteractionActive({ controls: true, touch: false, wheel: false }),
    ).toBe(true);
    expect(
      renderInteractionActive({ controls: false, touch: true, wheel: false }),
    ).toBe(true);
    expect(
      renderInteractionActive({ controls: false, touch: false, wheel: true }),
    ).toBe(true);
    expect(
      renderInteractionActive({ controls: false, touch: false, wheel: false }),
    ).toBe(false);
  });

  test("keeps one desktop backing-store resolution for the whole gesture", () => {
    const settings = {
      coarsePointer: false,
      devicePixelRatio: 2,
      height: 720,
      width: 1280,
    };
    const ratios = Array.from({ length: 120 }, () =>
      renderPixelRatio(settings),
    );
    expect(new Set(ratios)).toEqual(new Set([2]));
    expect(STABLE_DESKTOP_PIXEL_RATIO_CAP).toBe(2);
  });

  test("raises touch movement detail without a post-gesture resize", () => {
    const ratio = renderPixelRatio({
      coarsePointer: true,
      devicePixelRatio: 3,
      height: 844,
      width: 390,
    });
    expect(ratio).toBe(STABLE_TOUCH_PIXEL_RATIO_CAP);
    expect(ratio).toBe(1.5);
  });

  test("bounds desktop 4K and large touch canvases by fixed budgets", () => {
    const desktop = renderPixelRatio({
      coarsePointer: false,
      devicePixelRatio: 3,
      height: 2160,
      width: 3840,
    });
    const touch = renderPixelRatio({
      coarsePointer: true,
      devicePixelRatio: 3,
      height: 1366,
      width: 1024,
    });
    expect(3840 * 2160 * desktop ** 2).toBeLessThanOrEqual(
      STABLE_DESKTOP_PIXEL_BUDGET + 1,
    );
    expect(1024 * 1366 * touch ** 2).toBeLessThanOrEqual(
      STABLE_TOUCH_PIXEL_BUDGET + 1,
    );
  });

  test("never scales below one physical render pixel per CSS pixel", () => {
    expect(
      renderPixelRatio({
        coarsePointer: false,
        devicePixelRatio: 0.5,
        height: 9000,
        width: 9000,
      }),
    ).toBe(1);
  });
});
