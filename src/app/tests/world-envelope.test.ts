import { describe, expect, test } from "bun:test";

import {
  EXTRAPOLATED_WEST_M,
  VISIBLE_RADIUS_M,
  extrapolatedEnvelopeBounds,
  extrapolatedLampSpots,
  extrapolatedMarginBands,
  extrapolatedTreeSpots,
} from "../src/worldEnvelope";

describe("shared presentation envelope", () => {
  test("keeps the published v0.35 tree population byte-stable", () => {
    const trees = extrapolatedTreeSpots();
    expect(trees).toHaveLength(1613);
    expect(trees[0]).toEqual([-1671.2818, -85.676]);
    expect(trees[trees.length - 1]).toEqual([
      -2856.4432556554675,
      -80.72616967372596,
    ]);
    expect(Math.min(...trees.map(([x]) => x))).toBeGreaterThan(
      EXTRAPOLATED_WEST_M,
    );
  });

  test("covers the same complete radius in every renderer", () => {
    const bands = extrapolatedMarginBands();
    const minZ = Math.min(...bands.map(([, z, , depth]) => z - depth / 2));
    const maxZ = Math.max(...bands.map(([, z, , depth]) => z + depth / 2));
    expect(minZ).toBe(-2950);
    expect(maxZ).toBe(3371);
    expect(extrapolatedEnvelopeBounds()).toEqual({
      maxX: 2521,
      maxZ: 3371,
      minX: -2920,
      minZ: -2950,
    });
    expect(VISIBLE_RADIUS_M).toBe(3210);
    expect(extrapolatedLampSpots().length).toBeGreaterThan(30);
  });
});
