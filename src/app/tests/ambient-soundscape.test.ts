import { describe, expect, test } from "bun:test";

import {
  AMBIENT_VARIANTS,
  isAmbientAudioSupported,
  midiFrequency,
} from "../src/AmbientSoundscape";

describe("procedural ambient soundtrack", () => {
  test("contains seven distinct looping variants", () => {
    expect(AMBIENT_VARIANTS).toHaveLength(7);
    expect(new Set(AMBIENT_VARIANTS.map((variant) => variant.name)).size).toBe(7);
    expect(new Set(AMBIENT_VARIANTS.map((variant) => variant.rootMidi)).size).toBe(
      7,
    );
  });

  test("keeps every bass and chime pattern on one sixteen-step bar", () => {
    for (const variant of AMBIENT_VARIANTS) {
      expect(variant.bass).toHaveLength(16);
      expect(variant.chime).toHaveLength(16);
      expect(variant.bass.some((note) => note !== null)).toBe(true);
      expect(variant.chime.some((note) => note !== null)).toBe(true);
    }
  });

  test("uses concert pitch for deterministic note scheduling", () => {
    expect(midiFrequency(69)).toBe(440);
    expect(midiFrequency(57)).toBe(220);
  });

  test("reports missing Web Audio support without throwing", () => {
    expect(isAmbientAudioSupported()).toBe(false);
  });
});
