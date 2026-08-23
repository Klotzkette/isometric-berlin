import { describe, expect, test } from "bun:test";

import {
  ACTIVE_MOTION_FRAME_INTERVAL_MS,
  DESKTOP_ENVIRONMENT_FRAME_INTERVAL_MS,
  STABLE_DESKTOP_PIXEL_BUDGET,
  STABLE_DESKTOP_PIXEL_RATIO_CAP,
  STABLE_TOUCH_PIXEL_BUDGET,
  STABLE_TOUCH_PIXEL_RATIO_CAP,
  TOUCH_ENVIRONMENT_FRAME_INTERVAL_MS,
  environmentFrameIntervalMs,
  preservedBackbufferRequired,
  renderFrameRequired,
  renderInteractionActive,
  renderPixelRatio,
  stableWebglMemoryProfile,
  stableViewportSize,
} from "../src/renderQuality";

describe("stable 3D render quality", () => {
  test("bounds persistent WebGL targets on coarse-pointer devices", () => {
    expect(stableWebglMemoryProfile(true)).toEqual({
      antialias: false,
      composerSamples: 0,
    });
  });

  test("uses one compact SMAA-owned WebGL profile on desktop too", () => {
    expect(stableWebglMemoryProfile(false)).toEqual({
      antialias: false,
      composerSamples: 0,
    });
  });

  test("does not discard alternate touch frames during camera motion", () => {
    expect(ACTIVE_MOTION_FRAME_INTERVAL_MS).toBe(0);
  });

  test("bounds environmental buffer uploads independently of camera motion", () => {
    expect(environmentFrameIntervalMs(false)).toBe(
      DESKTOP_ENVIRONMENT_FRAME_INTERVAL_MS,
    );
    expect(environmentFrameIntervalMs(true)).toBe(
      TOUCH_ENVIRONMENT_FRAME_INTERVAL_MS,
    );
    expect(DESKTOP_ENVIRONMENT_FRAME_INTERVAL_MS).toBeCloseTo(1_000 / 30);
    expect(TOUCH_ENVIRONMENT_FRAME_INTERVAL_MS).toBe(50);
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

  test("does not render an unchanged scene from elapsed time alone", () => {
    expect(
      renderFrameRequired({
        cameraMoving: false,
        environmentalMotion: false,
        presentationChanged: false,
        renderInvalidated: false,
      }),
    ).toBe(false);
  });

  test("retains the settled backbuffer only where WebKit needs it", () => {
    expect(
      preservedBackbufferRequired(
        "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18 Safari/605.1.15",
      ),
    ).toBe(true);
    expect(
      preservedBackbufferRequired(
        "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
    expect(
      preservedBackbufferRequired(
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
      ),
    ).toBe(false);
    expect(
      preservedBackbufferRequired(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/142.0",
      ),
    ).toBe(false);
  });

  test("renders each genuine visual mutation source", () => {
    const idle = {
      cameraMoving: false,
      environmentalMotion: false,
      presentationChanged: false,
      renderInvalidated: false,
    };
    for (const source of Object.keys(idle) as Array<keyof typeof idle>) {
      expect(renderFrameRequired({ ...idle, [source]: true }), source).toBe(
        true,
      );
    }
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
    expect(new Set(ratios)).toEqual(new Set([1.75]));
    expect(STABLE_DESKTOP_PIXEL_RATIO_CAP).toBe(1.75);
  });

  test("raises touch movement detail without a post-gesture resize", () => {
    const ratio = renderPixelRatio({
      coarsePointer: true,
      devicePixelRatio: 3,
      height: 844,
      width: 390,
    });
    expect(ratio).toBe(STABLE_TOUCH_PIXEL_RATIO_CAP);
    expect(ratio).toBe(1.35);
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

  test("quantises fractional Safari viewport jitter to one backing size", () => {
    expect(stableViewportSize(389.98, 843.99)).toEqual({
      height: 844,
      width: 390,
    });
    expect(stableViewportSize(390.02, 844.01)).toEqual({
      height: 844,
      width: 390,
    });
    expect(stableViewportSize(0, Number.NaN)).toEqual({
      height: 1,
      width: 1,
    });
  });
});
