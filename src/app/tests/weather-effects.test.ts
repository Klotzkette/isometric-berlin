import { describe, expect, test } from "bun:test";
import { Matrix4, Vector3 } from "three";

import {
  createModerateRain,
  moderateRainDropCount,
  setRainPresentation,
  updateModerateRain,
} from "../src/WeatherEffects";

describe("moderate rain", () => {
  test("keeps one bounded instanced draw call on desktop and touch", () => {
    const desktop = createModerateRain(false);
    const touch = createModerateRain(true);

    expect(desktop.mesh.count).toBe(moderateRainDropCount(false));
    expect(touch.mesh.count).toBe(moderateRainDropCount(true));
    expect(desktop.group.children).toHaveLength(1);
    expect(touch.group.children).toHaveLength(1);
    expect(touch.mesh.count).toBeLessThan(desktop.mesh.count);
  });

  test("is available in every surface mode but hidden below ground", () => {
    const rain = createModerateRain(false);

    for (const mode of ["day", "night", "minecraft"] as const) {
      setRainPresentation(rain, { enabled: true, mode, obstructed: false });
      expect(rain.group.visible).toBe(true);
    }
    setRainPresentation(rain, {
      enabled: true,
      mode: "snowstorm",
      obstructed: false,
    });
    expect(rain.group.visible).toBe(false);
    setRainPresentation(rain, {
      enabled: true,
      mode: "day",
      obstructed: true,
    });
    expect(rain.group.visible).toBe(false);
    setRainPresentation(rain, {
      enabled: false,
      mode: "night",
      obstructed: false,
    });
    expect(rain.group.visible).toBe(false);
  });

  test("falls around the current focus and wraps without adding instances", () => {
    const rain = createModerateRain(false);
    setRainPresentation(rain, {
      enabled: true,
      mode: "day",
      obstructed: false,
    });
    const before = new Matrix4();
    const after = new Matrix4();
    rain.mesh.getMatrixAt(0, before);

    updateModerateRain(rain, 0.1, new Vector3(123, 17, -456), "day");
    rain.mesh.getMatrixAt(0, after);

    expect(rain.group.position.x).toBe(123);
    expect(rain.group.position.z).toBe(-456);
    expect(after.equals(before)).toBe(false);
    expect(rain.mesh.count).toBe(moderateRainDropCount(false));
    expect(new Set(rain.drops.map(({ lengthScale }) => lengthScale)).size).toBeGreaterThan(100);
  });
});
