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
    // v0.39.0 adds exactly one new 100 m strip (-3120 … -3020 m); every
    // earlier strip keeps its published positions, seed for seed. The
    // v0.38.0 population is therefore an exact prefix of this one, so the
    // tree that used to be last is still at index 1691.
    expect(trees).toHaveLength(1774);
    expect(trees[0]).toEqual([-1671.2818, -85.676]);
    expect(trees[1691]).toEqual([-2970.892382245511, -44.77091332897544]);
    expect(trees[trees.length - 1]).toEqual([
      -3084.7855821810663,
      25.498811891302466,
    ]);
    expect(Math.min(...trees.map(([x]) => x))).toBeGreaterThan(
      EXTRAPOLATED_WEST_M,
    );
  });

  test("covers the same complete radius in every renderer", () => {
    const bands = extrapolatedMarginBands();
    const minZ = Math.min(...bands.map(([, z, , depth]) => z - depth / 2));
    const maxZ = Math.max(...bands.map(([, z, , depth]) => z + depth / 2));
    expect(minZ).toBe(-3150);
    expect(maxZ).toBe(3571);
    expect(extrapolatedEnvelopeBounds()).toEqual({
      maxX: 2721,
      maxZ: 3571,
      minX: -3120,
      minZ: -3150,
    });
    expect(VISIBLE_RADIUS_M).toBe(3410);
    expect(extrapolatedLampSpots().length).toBeGreaterThan(30);
  });
});
