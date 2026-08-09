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
  test("encloses the surveyed task-09 data hull", () => {
    // LoD2 buildings for the expanded bounds span EPSG:25833
    // E386627..390182 / N5818392..5821304, i.e. scene world x -2873..682 and
    // z -1304..1608. The hull constants must contain that, not trail it.
    expect(DATA_WEST_M).toBeLessThanOrEqual(-2873);
    expect(DATA_EAST_M).toBeGreaterThanOrEqual(682);
    expect(DATA_NORTH_M).toBeLessThanOrEqual(-1304);
    expect(DATA_SOUTH_M).toBeGreaterThanOrEqual(1608);
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
    expect(VISIBLE_RADIUS_M).toBe(5130);
    expect(VISIBLE_RADIUS_M).toBeGreaterThanOrEqual(corner);
  });
});
