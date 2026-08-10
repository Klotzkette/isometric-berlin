import { describe, expect, test } from "bun:test";
import { Points, PointsMaterial, Vector3 } from "three";

import {
  createSnowstorm,
  setSnowstormPresentation,
  snowFlurryIntensity,
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
    const flakes = desktop.air.children[0] as Points;
    expect((flakes.material as PointsMaterial).map).not.toBeNull();
    expect(desktop.flakeMaterial.alphaToCoverage).toBeTrue();
    expect(desktop.flakeMaterial.sizeAttenuation).toBeFalse();
    expect(desktop.flakeMaterial.alphaTest).toBeLessThan(0.02);
    expect(desktop.flakeMaterial.size).toBeLessThan(2.25);
    expect(
      desktop.settled.getObjectByName(
        "Continuous deep snow cover across the expanded city",
      ),
    ).toBeDefined();
  });

  test("moves through calm snow and a smooth intermittent mini-blizzard", () => {
    expect(snowFlurryIntensity(0)).toBe(0);
    expect(snowFlurryIntensity(1.9)).toBe(0);
    expect(snowFlurryIntensity(6)).toBeGreaterThan(0.85);
    expect(snowFlurryIntensity(13)).toBe(0);
    const sampled = Array.from({ length: 265 }, (_, index) =>
      snowFlurryIntensity(-2 + index * 0.25),
    );
    expect(Math.min(...sampled)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...sampled)).toBeLessThanOrEqual(1);
    expect(snowFlurryIntensity(Number.NaN)).toBe(0);
  });

  test("keeps settled snow while the weather toggle controls falling flakes", () => {
    const snow = createSnowstorm(false);
    for (const mode of ["day", "night", "minecraft"] as const) {
      setSnowstormPresentation(snow, {
        enabled: true,
        mode,
        obstructed: false,
      });
      expect(snow.group.visible).toBe(false);
    }
    setSnowstormPresentation(snow, {
      enabled: false,
      mode: "snowstorm",
      obstructed: false,
    });
    expect(snow.group.visible).toBe(true);
    expect(snow.settled.visible).toBe(true);
    expect(snow.air.visible).toBe(false);
    const pausedAge = snow.ageSeconds;
    updateSnowstorm(snow, 0.1, new Vector3());
    expect(snow.ageSeconds).toBe(pausedAge);
    setSnowstormPresentation(snow, {
      enabled: true,
      mode: "snowstorm",
      obstructed: false,
    });
    expect(snow.group.visible).toBe(true);
    expect(snow.settled.visible).toBe(true);
    expect(snow.air.visible).toBe(true);
    setSnowstormPresentation(snow, {
      enabled: true,
      mode: "snowstorm",
      obstructed: true,
    });
    expect(snow.group.visible).toBe(false);
    expect(snow.settled.visible).toBe(false);
    expect(snow.air.visible).toBe(false);
  });

  test("falls around the current focus without changing particle count", () => {
    const snow = createSnowstorm(false);
    setSnowstormPresentation(snow, {
      enabled: true,
      mode: "snowstorm",
      obstructed: false,
    });
    const before = snow.flakePositions.getY(0);
    const calmOpacity = snow.flakeMaterial.opacity;
    updateSnowstorm(snow, 0.08, new Vector3(150, 10, -420));
    expect(snow.air.position.x).toBe(150);
    expect(snow.air.position.z).toBe(-420);
    expect(snow.flakePositions.getY(0)).not.toBe(before);
    expect(snow.flakes).toHaveLength(snowflakeCount(false));
    expect(snow.ageSeconds).toBeCloseTo(0.08, 6);
    expect(new Set(snow.flakes.map(({ drift }) => drift)).size).toBeGreaterThan(
      1_000,
    );
    snow.ageSeconds = 5.9;
    updateSnowstorm(snow, 0.1, new Vector3(150, 10, -420));
    expect(snow.flakeMaterial.opacity).toBeGreaterThan(calmOpacity + 0.6);
  });
});
