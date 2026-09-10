import { describe, expect, test } from "bun:test";

import payload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  decodeVoxelTreeBlocks,
  minecraftVoxelTreeRetained,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";

const sourceTrees = decodeVoxelTreeBlocks(payload as unknown as VoxelPayload);

describe("lighter Minecraft tree cover", () => {
  test("removes about one fifth of each v1.0.26 profile without relocating trees", () => {
    for (const profile of ["full", "mobile"] as const) {
      let previousCount = 0;
      let retainedCount = 0;
      for (const [x, z] of sourceTrees) {
        // Frozen v1.0.26 selection: verifies that thinning is a subset rather
        // than a reshuffle which would add different trees elsewhere.
        const oldHash = (Math.imul(x, 73_856_093) ^ Math.imul(z, 19_349_663)) >>> 0;
        const previouslyVisible =
          oldHash % 3 < (profile === "full" ? 2 : 1) &&
          Math.floor(oldHash / 3) % 6 < 5;
        const retained = minecraftVoxelTreeRetained(x, z, profile);
        if (previouslyVisible) previousCount += 1;
        if (retained) {
          expect(previouslyVisible).toBe(true);
          retainedCount += 1;
        }
      }
      expect(retainedCount / previousCount).toBeGreaterThan(0.78);
      expect(retainedCount / previousCount).toBeLessThan(0.82);
    }
  });

  test("mobile is a stable subset of desktop across positive and negative cells", () => {
    for (let x = -500; x <= 500; x += 7) {
      for (let z = -500; z <= 500; z += 11) {
        const mobile = minecraftVoxelTreeRetained(x, z, "mobile");
        const full = minecraftVoxelTreeRetained(x, z, "full");
        if (mobile) expect(full).toBe(true);
        expect(minecraftVoxelTreeRetained(x, z, "full")).toBe(full);
      }
    }
  });
});
