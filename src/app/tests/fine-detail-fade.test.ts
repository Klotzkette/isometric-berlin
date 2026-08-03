import { describe, expect, test } from "bun:test";

import {
  FINE_DETAIL_HIDE_DISTANCE_M,
  FINE_DETAIL_SHOW_DISTANCE_M,
  INK_LINE_FULL_PX,
  INK_LINE_HIDE_PX,
  INK_LINE_REFERENCE_FEATURE_M,
  inkLineFadeOpacity,
  nextFineDetailVisible,
  projectedPixelSize,
} from "../src/fineDetailFade";

// App.tsx's default framing and camera FOV, kept in sync manually rather
// than imported so a future default-view change is a visible test edit,
// not a silent recalibration of the anti-flicker curve.
const DEFAULT_VIEW_DISTANCE_M = 948;
const CAMERA_FOV_DEGREES = 39;
const TYPICAL_VIEWPORT_HEIGHT_PX = 1000;

/**
 * "Flackert immer noch alles bei größerer Entfernung": far-zoomed ink
 * lines, lane markings and window-band seams alias because their
 * projected size crosses sub-pixel boundaries frame to frame. These tests
 * pin the thresholds and hysteresis bands that fix it, independent of any
 * WebGL context (see the v0.53.0 report for why live capture needed a long
 * SwiftShader warmup instead).
 */
describe("projectedPixelSize", () => {
  test("a 1 m feature covers fewer screen pixels the farther the camera stands off", () => {
    const near = projectedPixelSize(1, 200, 1080, 39);
    const far = projectedPixelSize(1, 2000, 1080, 39);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeCloseTo(near / 10, 1);
  });

  test("matches the pinhole-camera projection formula", () => {
    // At distance == viewport-height-equivalent focal length, a feature the
    // size of the vertical FOV's near-plane extent should project to
    // exactly viewportHeightPx / (2*tan(fov/2)) times its metre size per
    // metre of distance — check the closed form directly for one case.
    const fovRad = (39 * Math.PI) / 180;
    const distanceM = 500;
    const worldSizeM = 0.05;
    const expected =
      (worldSizeM * 1080) / (2 * distanceM * Math.tan(fovRad / 2));
    expect(projectedPixelSize(worldSizeM, distanceM, 1080, 39)).toBeCloseTo(
      expected,
      6,
    );
  });

  test("degenerates safely for non-finite or non-positive inputs", () => {
    expect(projectedPixelSize(1, 0, 1080, 39)).toBe(0);
    expect(projectedPixelSize(1, -5, 1080, 39)).toBe(0);
    expect(projectedPixelSize(Number.NaN, 500, 1080, 39)).toBe(0);
    expect(projectedPixelSize(1, Number.POSITIVE_INFINITY, 1080, 39)).toBe(0);
  });
});

describe("ink-line fade calibration against the viewer's own distance regime", () => {
  test("stays fully opaque at the app's default framing distance", () => {
    const px = projectedPixelSize(
      INK_LINE_REFERENCE_FEATURE_M,
      DEFAULT_VIEW_DISTANCE_M,
      TYPICAL_VIEWPORT_HEIGHT_PX,
      CAMERA_FOV_DEGREES,
    );
    expect(inkLineFadeOpacity(px)).toBe(1);
  });

  test("is nearly hidden by the far end of the crisp-pass fade window (2100 m)", () => {
    const px = projectedPixelSize(
      INK_LINE_REFERENCE_FEATURE_M,
      2100,
      TYPICAL_VIEWPORT_HEIGHT_PX,
      CAMERA_FOV_DEGREES,
    );
    expect(inkLineFadeOpacity(px)).toBeLessThan(0.05);
  });
});

describe("inkLineFadeOpacity", () => {
  test("is fully opaque once the line is at least a full device pixel wide", () => {
    expect(inkLineFadeOpacity(INK_LINE_FULL_PX)).toBe(1);
    expect(inkLineFadeOpacity(5)).toBe(1);
  });

  test("is fully transparent once the line drops below the hide threshold", () => {
    expect(inkLineFadeOpacity(INK_LINE_HIDE_PX)).toBe(0);
    expect(inkLineFadeOpacity(0.01)).toBe(0);
    expect(inkLineFadeOpacity(0)).toBe(0);
  });

  test("ramps smoothly (monotonically) between the two thresholds", () => {
    const mid = (INK_LINE_HIDE_PX + INK_LINE_FULL_PX) / 2;
    const step = (INK_LINE_FULL_PX - INK_LINE_HIDE_PX) / 10;
    const samples = [
      INK_LINE_HIDE_PX + step,
      INK_LINE_HIDE_PX + 2 * step,
      mid,
      INK_LINE_FULL_PX - 2 * step,
      INK_LINE_FULL_PX - step,
    ].map((px) => inkLineFadeOpacity(px));
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(samples[0]).toBeGreaterThan(0);
    expect(samples[samples.length - 1]).toBeLessThan(1);
  });

  test("never produces a value outside [0, 1] or NaN", () => {
    for (const px of [-10, 0, 0.2, 0.35, 0.5, 0.99, 1, 1.5, 100, Number.NaN]) {
      const opacity = inkLineFadeOpacity(px);
      expect(Number.isNaN(opacity)).toBe(false);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});

describe("nextFineDetailVisible", () => {
  test("hides once distance passes the hide threshold", () => {
    expect(
      nextFineDetailVisible({
        distanceM: FINE_DETAIL_HIDE_DISTANCE_M - 1,
        visible: true,
      }),
    ).toBe(true);
    expect(
      nextFineDetailVisible({
        distanceM: FINE_DETAIL_HIDE_DISTANCE_M,
        visible: true,
      }),
    ).toBe(false);
  });

  test("only restores once distance comes back inside the show threshold", () => {
    expect(
      nextFineDetailVisible({
        distanceM: FINE_DETAIL_SHOW_DISTANCE_M + 1,
        visible: false,
      }),
    ).toBe(false);
    expect(
      nextFineDetailVisible({
        distanceM: FINE_DETAIL_SHOW_DISTANCE_M,
        visible: false,
      }),
    ).toBe(true);
  });

  test("the band between SHOW and HIDE has real width (no boundary blink)", () => {
    // A camera orbiting at a fixed radius inside the band must read the
    // same visibility on every frame regardless of tiny distance jitter,
    // which requires the show/hide thresholds to actually differ.
    expect(FINE_DETAIL_HIDE_DISTANCE_M).toBeGreaterThan(
      FINE_DETAIL_SHOW_DISTANCE_M,
    );
    const midBand =
      (FINE_DETAIL_SHOW_DISTANCE_M + FINE_DETAIL_HIDE_DISTANCE_M) / 2;
    // Once visible, staying in the band (below HIDE) keeps it visible...
    expect(
      nextFineDetailVisible({ distanceM: midBand, visible: true }),
    ).toBe(true);
    // ...and once hidden, staying in the band (above SHOW) keeps it hidden.
    expect(
      nextFineDetailVisible({ distanceM: midBand, visible: false }),
    ).toBe(false);
  });

  test("a full dolly in-and-out across the band costs exactly one drop and one restore", () => {
    const distances: number[] = [];
    // In from far, through the band, well inside SHOW, back out again.
    for (let d = 1500; d >= 700; d -= 10) distances.push(d);
    for (let d = 700; d <= 1500; d += 10) distances.push(d);
    let visible = false;
    let switches = 0;
    for (const distanceM of distances) {
      const next = nextFineDetailVisible({ distanceM, visible });
      if (next !== visible) {
        switches += 1;
        visible = next;
      }
    }
    expect(switches).toBe(2);
  });

  test("passes through a non-finite distance unchanged rather than flip state", () => {
    expect(
      nextFineDetailVisible({ distanceM: Number.NaN, visible: true }),
    ).toBe(true);
    expect(
      nextFineDetailVisible({ distanceM: Number.NaN, visible: false }),
    ).toBe(false);
  });
});
