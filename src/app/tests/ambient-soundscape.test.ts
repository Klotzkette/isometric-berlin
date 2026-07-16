import { describe, expect, test } from "bun:test";

import {
  AMBIENT_VARIANTS,
  BEAT_INTERVAL_STEPS,
  attackReleaseEnvelope,
  beatMidi,
  isAmbientAudioSupported,
  midiFrequency,
  shouldScheduleBeat,
  swellEnvelope,
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

describe("de-clicked envelopes", () => {
  test("attack/release envelope starts and ends at exactly zero", () => {
    const stages = attackReleaseEnvelope(2, 0.11, 0.03, 0.4, 0.4);
    expect(stages[0]).toEqual({ ramp: "set", time: 2, value: 0 });
    expect(stages.at(-1)?.value).toBe(0);
    expect(stages.at(-1)?.ramp).toBe("linear");
    // Non-zero attack and release durations (Hüllkurven > 0).
    expect(stages[1].time - stages[0].time).toBeGreaterThan(0);
    expect(stages[3].time - stages[2].time).toBeGreaterThan(0);
    // Peak is reached in the middle, never on the first sample.
    expect(stages[1].value).toBe(0.11);
    expect(stages[2].value).toBe(0.11);
  });

  test("beat is a symmetric crescendo→decrescendo swell", () => {
    const stages = swellEnvelope(0, 0.13, 1);
    expect(stages[0].value).toBe(0);
    expect(stages.at(-1)?.value).toBe(0);
    const attack = stages[1].time - stages[0].time;
    const release = stages[3].time - stages[2].time;
    // Rise and fall are equal — a swell, not a percussive hit.
    expect(attack).toBeCloseTo(release, 10);
    expect(attack).toBeGreaterThan(0);
    // No sustain plateau: peak is a single instant.
    expect(stages[2].time).toBe(stages[1].time);
  });
});

describe("deep swell beat cadence", () => {
  test("fires exactly half as often as the old every-other-step hat", () => {
    expect(BEAT_INTERVAL_STEPS).toBe(4);
    const bar = Array.from({ length: 16 }, (_, step) => shouldScheduleBeat(step));
    const hits = bar.filter(Boolean).length;
    // The old hat fired on all eight odd steps of a bar; the swell fires four.
    expect(hits).toBe(4);
  });

  test("is tuned two octaves below the variant root", () => {
    for (const variant of AMBIENT_VARIANTS) {
      expect(beatMidi(variant.rootMidi)).toBe(variant.rootMidi - 24);
      expect(midiFrequency(beatMidi(variant.rootMidi))).toBeLessThan(
        midiFrequency(variant.rootMidi),
      );
    }
  });
});
