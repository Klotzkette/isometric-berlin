import { describe, expect, test } from "bun:test";
import { MeshStandardMaterial } from "three";

import {
  applyDrawnFacade,
  averageColorFromPixels,
  drawnFacadeColor,
  quantizeChannel,
} from "../src/drawnBuildings";

describe("drawn facade colour derivation", () => {
  test("averages opaque texels and ignores transparent ones", () => {
    const pixels = new Uint8ClampedArray([
      100, 100, 100, 255, 200, 200, 200, 255, 0, 0, 0, 0,
    ]);
    expect(averageColorFromPixels(pixels)).toEqual([150, 150, 150]);
  });

  test("falls back to a neutral tone for an empty buffer", () => {
    expect(averageColorFromPixels(new Uint8ClampedArray())).toEqual([
      176, 172, 160,
    ]);
  });

  test("quantises channels onto discrete flat levels", () => {
    expect(quantizeChannel(0, 6)).toBe(0);
    expect(quantizeChannel(1, 6)).toBe(1);
    // Six levels ⇒ steps of 0.2; 0.33 snaps to 0.4.
    expect(quantizeChannel(0.33, 6)).toBeCloseTo(0.4, 10);
  });

  test("posterises and desaturates toward a drawn tone", () => {
    const drawn = drawnFacadeColor([210, 40, 40]);
    // Result stays reddish but is pulled toward luminance (less saturated).
    const spread = Math.max(...drawn) - Math.min(...drawn);
    expect(spread).toBeLessThan(210 - 40);
    // Every channel lands on a posterised level (multiple of 255/5).
    for (const channel of drawn) {
      expect(Math.round((channel / 255) * 5) / 5).toBeCloseTo(channel / 255, 6);
    }
  });
});

describe("applyDrawnFacade", () => {
  test("removes photo maps and sets matte, non-metallic shading", () => {
    const material = new MeshStandardMaterial({ color: 0x8899aa });
    material.metalness = 0.9;
    applyDrawnFacade(material);
    expect(material.map).toBeNull();
    expect(material.emissiveMap).toBeNull();
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThanOrEqual(0.72);
  });
});
