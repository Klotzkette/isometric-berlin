import { describe, expect, test } from "bun:test";

import {
  AEOLIAN,
  CHIP_BPM,
  CHIP_CYCLE_SECTIONS,
  CHIP_MASTER_GAIN,
  CHIP_SECTIONS,
  CHIP_STEPS_PER_SECTION,
  CHIP_STEP_SECONDS,
  DuskChiptune,
  LEAD_CONTOURS,
  LEAD_OCTAVES,
  PERCUSSION_PATTERNS,
  PHRYGIAN,
  chipLoopSeconds,
  contourAt,
  degreeToMidi,
  leadOctaveAt,
  midiFrequency,
  modeFor,
  percussionAt,
  sectionAt,
} from "../src/DuskChiptune";

describe("Dusk Republic chiptune — composition", () => {
  test("is slow, dark and quiet by construction", () => {
    // Slow: a funeral-march tempo, eighths just over half a second.
    expect(CHIP_BPM).toBeLessThan(70);
    expect(CHIP_STEP_SECONDS).toBeGreaterThan(0.5);
    // Quiet: the master sits far below a foreground mix.
    expect(CHIP_MASTER_GAIN).toBeLessThan(0.1);
    expect(CHIP_MASTER_GAIN).toBeGreaterThan(0);
    // Dark: both scales are minor (flat third), one has a flat second.
    expect(AEOLIAN[2]).toBe(3);
    expect(PHRYGIAN[1]).toBe(1);
    expect(PHRYGIAN[2]).toBe(3);
  });

  test("recurs only after many hours — 'ewig lang'", () => {
    // The four cycles are pairwise coprime, so the exact combination
    // returns after lcm(8, 5, 7, 3) = 840 sections.
    expect(CHIP_SECTIONS.length).toBe(8);
    expect(LEAD_OCTAVES.length).toBe(5);
    expect(LEAD_CONTOURS.length).toBe(7);
    expect(PERCUSSION_PATTERNS.length).toBe(3);
    expect(CHIP_CYCLE_SECTIONS).toBe(840);
    // Just over four hours before the loop truly repeats — long
    // enough that a listener never hears the seam.
    expect(chipLoopSeconds()).toBeGreaterThan(4 * 3600);
    expect(chipLoopSeconds()).toBeLessThan(5 * 3600);
  });

  test("harmony, register, contour and percussion drift independently", () => {
    // Within one full cycle every combination is unique, and no two
    // consecutive sections share all four choices.
    const seen = new Set<string>();
    for (let index = 0; index < CHIP_CYCLE_SECTIONS; index += 1) {
      const key = [
        index % CHIP_SECTIONS.length,
        index % LEAD_OCTAVES.length,
        index % LEAD_CONTOURS.length,
        index % PERCUSSION_PATTERNS.length,
      ].join("/");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(CHIP_CYCLE_SECTIONS);
    // Section 0 and section 840 are the same again (the true loop point).
    expect(sectionAt(0)).toBe(sectionAt(CHIP_CYCLE_SECTIONS));
    expect(contourAt(0)).toBe(contourAt(CHIP_CYCLE_SECTIONS));
    expect(leadOctaveAt(0)).toBe(leadOctaveAt(CHIP_CYCLE_SECTIONS));
    expect(percussionAt(0)).toBe(percussionAt(CHIP_CYCLE_SECTIONS));
  });

  test("every section is a well-formed 32-step chip pattern", () => {
    for (const section of CHIP_SECTIONS) {
      expect(section.bass).toHaveLength(CHIP_STEPS_PER_SECTION);
      expect(section.colour).toHaveLength(CHIP_STEPS_PER_SECTION);
      expect(section.name.length).toBeGreaterThan(3);
      const bassNotes = section.bass.filter((step) => step !== null).length;
      const colourNotes = section.colour.filter((step) => step !== null).length;
      // Sparse by design: even the busiest section rests a third of
      // its steps, the quietest most of them.
      expect(bassNotes).toBeLessThanOrEqual(20);
      expect(bassNotes).toBeGreaterThan(6);
      expect(colourNotes).toBeLessThan(bassNotes);
      // Every section opens on its tonic, so the harmony reads clearly.
      expect(section.bass[0]).toBe(0);
    }
  });

  test("the harmonic route circles the minor mode and comes home", () => {
    const degrees = CHIP_SECTIONS.map((section) => section.degree);
    // i – VI – III – VII – iv – v – ♭II – i
    expect(degrees).toEqual([0, 8, 3, 10, 5, 7, 1, 0]);
    // The flat-second station is the only phrygian one.
    const phrygian = CHIP_SECTIONS.filter(
      (section) => modeFor(section) === PHRYGIAN,
    );
    expect(phrygian).toHaveLength(1);
    expect(phrygian[0].degree).toBe(1);
  });

  test("the lead is a monophonic climb-and-fall, Manic Miner style", () => {
    for (const contour of LEAD_CONTOURS) {
      expect(contour.length).toBe(8);
      // Stepwise motion: no leap wider than a fourth in scale degrees.
      for (let index = 1; index < contour.length; index += 1) {
        expect(Math.abs(contour[index] - contour[index - 1])).toBeLessThanOrEqual(3);
      }
      // It turns around rather than running away.
      expect(Math.max(...contour) - Math.min(...contour)).toBeGreaterThan(2);
      expect(Math.max(...contour)).toBeLessThanOrEqual(7);
      expect(Math.min(...contour)).toBeGreaterThanOrEqual(-3);
    }
  });

  test("scale degrees map to real notes, wrapping octaves both ways", () => {
    const tonic = 38; // D2
    expect(degreeToMidi(0, AEOLIAN, tonic)).toBe(38);
    expect(degreeToMidi(2, AEOLIAN, tonic)).toBe(41); // minor third
    expect(degreeToMidi(7, AEOLIAN, tonic)).toBe(50); // octave up
    expect(degreeToMidi(-1, AEOLIAN, tonic)).toBe(36); // step below tonic
    expect(degreeToMidi(-3, AEOLIAN, tonic)).toBe(33);
    // Phrygian's flat second really is a semitone.
    expect(degreeToMidi(1, PHRYGIAN, tonic)).toBe(39);
    // A440 anchors the frequency table.
    expect(midiFrequency(69)).toBeCloseTo(440, 6);
    expect(midiFrequency(38)).toBeCloseTo(73.416, 2);
  });

  test("the bass stays in the low register — 'tieftönig'", () => {
    // The bass voice plays an octave below its section tonic; even the
    // highest bass note stays below middle C.
    let highest = 0;
    for (const section of CHIP_SECTIONS) {
      const mode = modeFor(section);
      const tonic = 38 + section.degree - 12;
      for (const degree of section.bass) {
        if (degree === null) {
          continue;
        }
        highest = Math.max(highest, degreeToMidi(degree, mode, tonic));
      }
    }
    expect(highest).toBeLessThan(60); // below middle C
    expect(midiFrequency(highest)).toBeLessThan(250);
  });
});

describe("Dusk Republic chiptune — player", () => {
  test("starts idle and reports unsupported environments instead of throwing", async () => {
    const player = new DuskChiptune();
    expect(player.playing).toBe(false);
    // Headless bun has no AudioContext: start must fail softly.
    const started = await player.start();
    expect(started).toBe(false);
    expect(player.playing).toBe(false);
    // Stop and dispose are safe no-ops before any start.
    player.stop();
    await player.dispose();
    expect(player.playing).toBe(false);
  });
});
