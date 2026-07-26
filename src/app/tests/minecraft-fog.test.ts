import { describe, expect, test } from "bun:test";

import { VISIBLE_RADIUS_M } from "../src/IsometricCityWorld";
import { minecraftFogRange } from "../src/minecraftFog";

describe("radius-aware Minecraft atmosphere", () => {
  test("starts beyond the visible ring and leaves a broad fade band", () => {
    const range = minecraftFogRange();
    expect(range.near).toBeGreaterThan(VISIBLE_RADIUS_M);
    expect(range.far).toBeGreaterThan(VISIBLE_RADIUS_M * 1.8);
    expect(range.far - range.near).toBeGreaterThan(VISIBLE_RADIUS_M * 0.7);
  });

  test("grows with every versioned radius expansion", () => {
    expect(minecraftFogRange(1000)).toEqual({ near: 1050, far: 1850 });
    expect(minecraftFogRange(1100)).toEqual({ near: 1155, far: 2035 });
  });
});
