import { describe, expect, test } from "bun:test";

import {
  DATA_EAST_M,
  DATA_NORTH_M,
  DATA_SOUTH_M,
  DATA_WEST_M,
  EXTRAPOLATED_MARGIN_M,
  VISIBLE_RADIUS_M,
  extrapolatedEnvelopeBounds,
  extrapolatedMarginBands,
} from "../src/worldEnvelope";

describe("shared presentation envelope", () => {
  test("encloses the task-13 additional 500 m source hull", () => {
    // Bounds project to E385602.60..391910.58 / N5817089.12..5823617.37.
    // World coordinates are rounded outward to whole decametres.
    expect(DATA_WEST_M).toBe(-3900);
    expect(DATA_EAST_M).toBe(2420);
    expect(DATA_NORTH_M).toBe(-3620);
    expect(DATA_SOUTH_M).toBe(2920);
  });

  test("rings the hull on all four sides without a corner gap", () => {
    const bands = extrapolatedMarginBands();
    expect(bands).toHaveLength(4);
    const bounds = extrapolatedEnvelopeBounds();
    expect(bounds).toEqual({
      maxX: DATA_EAST_M + EXTRAPOLATED_MARGIN_M,
      maxZ: DATA_SOUTH_M + EXTRAPOLATED_MARGIN_M,
      minX: DATA_WEST_M - EXTRAPOLATED_MARGIN_M,
      minZ: DATA_NORTH_M - EXTRAPOLATED_MARGIN_M,
    });
    // The north and south plates run the full outer width, so the four
    // diagonal corners are covered by them rather than left as holes.
    for (const index of [0, 1]) {
      const [cx, , sx] = bands[index];
      expect(cx - sx / 2).toBe(bounds.minX);
      expect(cx + sx / 2).toBe(bounds.maxX);
    }
  });

  test("covers the same complete radius in every renderer", () => {
    const bounds = extrapolatedEnvelopeBounds();
    const corner = Math.hypot(
      Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
      Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)),
    );
    expect(VISIBLE_RADIUS_M).toBe(6450);
    expect(VISIBLE_RADIUS_M).toBeGreaterThanOrEqual(corner);
  });
});
