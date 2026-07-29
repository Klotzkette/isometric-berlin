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
  test("keeps every published tree strip byte-stable while growing west", () => {
    const trees = extrapolatedTreeSpots();
    // v0.38.0 adds exactly one new 100 m strip (-3020 … -2920 m); every
    // earlier strip keeps its published positions, seed for seed.
    expect(trees).toHaveLength(1692);
    expect(trees[0]).toEqual([-1671.2818, -85.676]);
    expect(trees[trees.length - 1]).toEqual([
      -2970.892382245511,
      -44.77091332897544,
    ]);
    expect(Math.min(...trees.map(([x]) => x))).toBeGreaterThan(
      EXTRAPOLATED_WEST_M,
    );
  });

  test("covers the same complete radius in every renderer", () => {
    const bands = extrapolatedMarginBands();
    const minZ = Math.min(...bands.map(([, z, , depth]) => z - depth / 2));
    const maxZ = Math.max(...bands.map(([, z, , depth]) => z + depth / 2));
    expect(minZ).toBe(-3050);
    expect(maxZ).toBe(3471);
    expect(extrapolatedEnvelopeBounds()).toEqual({
      maxX: 2621,
      maxZ: 3471,
      minX: -3020,
      minZ: -3050,
    });
    expect(VISIBLE_RADIUS_M).toBe(3310);
    expect(extrapolatedLampSpots().length).toBeGreaterThan(30);
  });
});
