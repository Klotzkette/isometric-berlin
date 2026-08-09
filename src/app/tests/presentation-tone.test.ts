import { describe, expect, test } from "bun:test";
import { ACESFilmicToneMapping, NoToneMapping } from "three";

import { CRISPNESS_PROFILES } from "../src/crispnessProfile";
import { PRESENTATION_TONE, isPaintFaithful } from "../src/presentationTone";

/**
 * The drawn modes are a flat unlit drawing whose every tone is authored by
 * hand. Anything that rewrites those tones on the way to the screen is a
 * defect, and this file is the guard: v0.37.0 shipped ACES at exposure
 * 1.33, which measurably turned the ivory register #f8f3e6 into a neutral
 * grey #e9e7e4 and the sage lawn #a9c592 into a fluorescent #d0fea1.
 */
describe("presentation tone response", () => {
  test("the drawn modes reproduce authored paint with no film curve", () => {
    for (const mode of ["day", "night"] as const) {
      expect(PRESENTATION_TONE[mode].toneMapping).toBe(NoToneMapping);
      expect(PRESENTATION_TONE[mode].exposure).toBe(1);
      expect(isPaintFaithful(mode)).toBe(true);
    }
  });

  test("Minecraft keeps a filmic curve — it is a genuinely lit world", () => {
    expect(PRESENTATION_TONE.minecraft.toneMapping).toBe(
      ACESFilmicToneMapping,
    );
    expect(isPaintFaithful("minecraft")).toBe(false);
    // Calibrated down from the v0.37.0 1.62, which drove cream facades
    // into clipped lemon-yellow. ACES pre-multiplies by exposure / 0.6, so
    // anything much above ~1.3 pushes pale blocks onto the shoulder.
    expect(PRESENTATION_TONE.minecraft.exposure).toBeLessThanOrEqual(1.3);
    expect(PRESENTATION_TONE.minecraft.exposure).toBeGreaterThan(0.6);
  });

  test("the drawn crisp pass is chroma- and contrast-neutral", () => {
    // With the curve gone the composited pixel equals the authored tone.
    // A saturation or contrast lift here would silently repaint it again —
    // which is how the loud green survived several rounds of retuning the
    // palette itself.
    for (const mode of ["day", "night"] as const) {
      expect(CRISPNESS_PROFILES[mode].saturation).toBe(1);
      expect(CRISPNESS_PROFILES[mode].contrast).toBe(1);
    }
    // Neighbour-sampling sharpening is forbidden because it amplifies
    // sub-pixel motion even when it is hue-neutral.
    expect(CRISPNESS_PROFILES.day.strength).toBe(0);
    expect(CRISPNESS_PROFILES.night.strength).toBe(0);
  });
});
