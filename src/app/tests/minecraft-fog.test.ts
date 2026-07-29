import { describe, expect, test } from "bun:test";

import { VISIBLE_RADIUS_M } from "../src/IsometricCityWorld";
import { minecraftFogRange } from "../src/minecraftFog";

describe("radius-aware Minecraft atmosphere", () => {
  test("starts beyond the visible ring and leaves a broad fade band", () => {
    const range = minecraftFogRange();
    expect(range.near).toBeGreaterThan(VISIBLE_RADIUS_M * 2.1);
    expect(range.far).toBeGreaterThan(VISIBLE_RADIUS_M * 3.3);
    expect(range.far - range.near).toBeGreaterThan(VISIBLE_RADIUS_M);
  });

  test("grows with every versioned radius expansion", () => {
    expect(minecraftFogRange(1000)).toEqual({ near: 2200, far: 3400 });
    expect(minecraftFogRange(1100)).toEqual({
      near: 2420,
      far: 3740,
    });
  });
});
