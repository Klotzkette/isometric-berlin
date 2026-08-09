import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";

import {
  createSnowstorm,
  setSnowstormPresentation,
  snowflakeCount,
  updateSnowstorm,
} from "../src/SnowstormEffects";

describe("snowstorm presentation", () => {
  test("uses one bounded point field and a smaller mobile budget", () => {
    const desktop = createSnowstorm(false);
    const mobile = createSnowstorm(true);
    expect(desktop.flakes).toHaveLength(snowflakeCount(false));
    expect(mobile.flakes).toHaveLength(snowflakeCount(true));
    expect(mobile.flakes.length).toBeLessThan(desktop.flakes.length);
    expect(desktop.air.children).toHaveLength(1);
    expect(
      desktop.settled.getObjectByName(
        "Continuous deep snow cover across the expanded city",
      ),
    ).toBeDefined();
  });

  test("appears only in snowstorm mode above ground", () => {
    const snow = createSnowstorm(false);
    for (const mode of ["day", "night", "minecraft"] as const) {
      setSnowstormPresentation(snow, { mode, obstructed: false });
      expect(snow.group.visible).toBe(false);
    }
    setSnowstormPresentation(snow, {
      mode: "snowstorm",
      obstructed: false,
    });
    expect(snow.group.visible).toBe(true);
    setSnowstormPresentation(snow, {
      mode: "snowstorm",
      obstructed: true,
    });
    expect(snow.group.visible).toBe(false);
  });

  test("falls around the current focus without changing particle count", () => {
    const snow = createSnowstorm(false);
    setSnowstormPresentation(snow, {
      mode: "snowstorm",
      obstructed: false,
    });
    const before = snow.flakePositions.getY(0);
    updateSnowstorm(snow, 0.08, new Vector3(150, 10, -420));
    expect(snow.air.position.x).toBe(150);
    expect(snow.air.position.z).toBe(-420);
    expect(snow.flakePositions.getY(0)).not.toBe(before);
    expect(snow.flakes).toHaveLength(snowflakeCount(false));
  });
});
