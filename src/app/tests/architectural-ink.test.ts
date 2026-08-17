import { describe, expect, test } from "bun:test";
import { LineBasicMaterial } from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  ARCHITECTURAL_INK_PALETTE,
  applyArchitecturalInkMode,
  markArchitecturalAccentInk,
  markArchitecturalInk,
} from "../src/architecturalInk";

describe("shared architectural ink register", () => {
  test("gives every visual mode three restrained drawing levels", () => {
    expect(ARCHITECTURAL_EDGE_THRESHOLD_DEGREES).toBe(18);
    for (const mode of [
      "day",
      "night",
      "minecraft",
      "snowstorm",
      "schwellenraum",
    ] as const) {
      const tones = ARCHITECTURAL_INK_PALETTE[mode];
      expect(new Set(Object.values(tones)).size).toBe(3);
      for (const tone of Object.values(tones)) {
        expect(tone).toBeGreaterThan(0x101010);
        expect(tone).toBeLessThan(0xd0d0d0);
      }
    }
  });

  test("switches ordinary silhouette ink losslessly across all modes", () => {
    const material = markArchitecturalInk(
      new LineBasicMaterial(),
      "silhouette",
    );
    expect(material.userData.modeInk).toBeTrue();
    expect(material.userData.architecturalInkRole).toBe("silhouette");

    for (const mode of [
      "day",
      "night",
      "minecraft",
      "snowstorm",
      "schwellenraum",
      "day",
    ] as const) {
      applyArchitecturalInkMode(material, mode);
      expect(material.color.getHex()).toBe(
        ARCHITECTURAL_INK_PALETTE[mode].silhouette,
      );
    }
  });

  test("keeps purposeful material accents while adapting their contrast", () => {
    const bronze = 0x88775d;
    const material = markArchitecturalAccentInk(
      new LineBasicMaterial(),
      bronze,
      "micro",
    );
    expect(material.color.getHex()).toBe(bronze);

    applyArchitecturalInkMode(material, "night");
    const night = material.color.getHex();
    expect(night).not.toBe(bronze);
    expect(night).not.toBe(ARCHITECTURAL_INK_PALETTE.night.micro);

    applyArchitecturalInkMode(material, "minecraft");
    expect(material.color.getHex()).not.toBe(night);
    applyArchitecturalInkMode(material, "snowstorm");
    expect(material.color.getHex()).not.toBe(night);
    applyArchitecturalInkMode(material, "schwellenraum");
    expect(material.color.getHex()).toBe(bronze);
    applyArchitecturalInkMode(material, "day");
    expect(material.color.getHex()).toBe(bronze);
  });
});
