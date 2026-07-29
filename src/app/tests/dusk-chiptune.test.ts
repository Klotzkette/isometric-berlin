import { describe, expect, test } from "bun:test";

import {
  AEOLIAN,
  CHIP_BPM,
  CHIP_CYCLE_SECTIONS,
  CHIP_MASTER_GAIN,
  CHIP_SECTIONS,
  CHIP_STEP_SECONDS,
  DuskChiptune,
  FILTER_BASE_HZ,
  FILTER_DEPTHS,
  FILTER_PEAK_HZ,
  LEAD_CONTOURS,
  LEAD_OCTAVES,
  PHRYGIAN,
  TRANSITION_STEPS,
  chipLoopSeconds,
  contourAt,
  degreeToMidi,
  filterHzAt,
  isClickStep,
  isHatStep,
  leadOctaveAt,
  locateStep,
  midiFrequency,
  modeFor,
  percussionWeight,
  sectionAt,
  sectionCycleSteps,
  sectionSteps,
  stepsPerEvent,
} from "../src/DuskChiptune";

const MOTORIK = CHIP_SECTIONS.filter((section) => section.movement === "motorik");
const SLOW = CHIP_SECTIONS.filter((section) => section.movement === "slow");

describe("Dusk Republic — two movements, equal weight", () => {
  test("half the sections are slow, half are motorik", () => {
    expect(CHIP_SECTIONS).toHaveLength(16);
    expect(MOTORIK).toHaveLength(8);
    expect(SLOW).toHaveLength(8);
    // Both movements walk the same harmonic route.
    expect(MOTORIK.map((section) => section.degree)).toEqual(
      SLOW.map((section) => section.degree),
    );
  });

  test("both run on one grid: slow events are quarters, motorik sixteenths", () => {
    expect(stepsPerEvent("slow")).toBe(4);
    expect(stepsPerEvent("motorik")).toBe(1);
    // A slow section spans eight bars, a motorik one four, so the two
    // movements take a comparable share of listening time even though
    // the slow one plays a quarter of the events.
    for (const section of SLOW) {
      expect(section.bass).toHaveLength(32);
      expect(sectionSteps(section)).toBe(128);
    }
    for (const section of MOTORIK) {
      expect(section.bass).toHaveLength(64);
      expect(sectionSteps(section)).toBe(64);
    }
    const slowSteps = SLOW.reduce((sum, s) => sum + sectionSteps(s), 0);
    const motorikSteps = MOTORIK.reduce((sum, s) => sum + sectionSteps(s), 0);
    expect(slowSteps).toBe(1024);
    expect(motorikSteps).toBe(512);
    expect(sectionCycleSteps()).toBe(slowSteps + motorikSteps);
  });

  test("motorik tempo drives, and the whole thing stays quiet", () => {
    // A real motorik pulse, not the old funeral march.
    expect(CHIP_BPM).toBeGreaterThan(100);
    expect(CHIP_BPM).toBeLessThan(130);
    expect(CHIP_STEP_SECONDS).toBeCloseTo(60 / CHIP_BPM / 4, 6);
    // Low key regardless of movement.
    expect(CHIP_MASTER_GAIN).toBeLessThan(0.1);
    expect(CHIP_MASTER_GAIN).toBeGreaterThan(0);
    // Still minor, still dark.
    expect(AEOLIAN[2]).toBe(3);
    expect(PHRYGIAN[1]).toBe(1);
  });

  test("the loop is twice as long and recurs only after many hours", () => {
    // Sixteen sections now (was eight), against coprime cycles of
    // 5 (register), 7 (contour) and 11 (filter breath).
    expect(CHIP_CYCLE_SECTIONS).toBe(18_480);
    expect(chipLoopSeconds()).toBeGreaterThan(8 * 3600);
    // Every combination inside the sampled range is unique.
    const seen = new Set<string>();
    for (let index = 0; index < 4_000; index += 1) {
      const key = [
        index % CHIP_SECTIONS.length,
        index % LEAD_OCTAVES.length,
        index % LEAD_CONTOURS.length,
        index % FILTER_DEPTHS.length,
      ].join("/");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(sectionAt(0)).toBe(sectionAt(CHIP_CYCLE_SECTIONS));
    expect(contourAt(0)).toBe(contourAt(CHIP_CYCLE_SECTIONS));
    expect(leadOctaveAt(0)).toBe(leadOctaveAt(CHIP_CYCLE_SECTIONS));
  });
});

describe("Dusk Republic — motorik spine (NEU!/Kraftwerk)", () => {
  test("a click on every quarter, a hat on every off-eighth", () => {
    expect(isClickStep(0)).toBe(true);
    expect(isClickStep(4)).toBe(true);
    expect(isClickStep(2)).toBe(false);
    expect(isHatStep(2)).toBe(true);
    expect(isHatStep(6)).toBe(true);
    // A step is never both.
    for (let step = 0; step < 64; step += 1) {
      expect(isClickStep(step) && isHatStep(step)).toBe(false);
    }
    let clicks = 0;
    let hats = 0;
    for (let step = 0; step < 64; step += 1) {
      if (isClickStep(step)) clicks += 1;
      if (isHatStep(step)) hats += 1;
    }
    expect(clicks).toBe(16); // one per quarter across four bars
    expect(hats).toBe(16); // one per off-eighth
  });

  test("the motorik bass is a sequencer line hammering its tonic", () => {
    for (const section of MOTORIK) {
      const notes = section.bass.filter((step) => step !== null);
      // Dense by design: a sixteenth-note machine line.
      expect(notes.length).toBeGreaterThan(50);
      // Mostly the tonic with small precise moves — Kraftwerk, not a
      // walking bass.
      const tonics = notes.filter((step) => step === 0).length;
      expect(tonics / notes.length).toBeGreaterThan(0.6);
      const moves = new Set(notes.filter((step) => step !== 0));
      expect(moves.size).toBeGreaterThan(1);
      expect(moves.size).toBeLessThanOrEqual(5);
      expect(section.bass[0]).toBe(0);
    }
  });

  test("the slow movement keeps the original sparse procession", () => {
    for (const section of SLOW) {
      const notes = section.bass.filter((step) => step !== null);
      expect(notes.length).toBeLessThanOrEqual(20);
      expect(notes.length).toBeGreaterThan(6);
      expect(section.bass[0]).toBe(0);
    }
  });
});

describe("Dusk Republic — transitions", () => {
  test("percussion ramps in before motorik and out before slow", () => {
    const slow = SLOW[0];
    const motorik = MOTORIK[0];
    const slowLength = sectionSteps(slow);
    const motorikLength = sectionSteps(motorik);
    // Deep inside a slow section: dry.
    expect(percussionWeight(slow, 10, "slow")).toBe(0);
    // Approaching motorik, the hats wake up over the last 16 steps.
    expect(
      percussionWeight(slow, slowLength - TRANSITION_STEPS, "motorik"),
    ).toBe(0);
    expect(
      percussionWeight(slow, slowLength - TRANSITION_STEPS / 2, "motorik"),
    ).toBeCloseTo(0.5, 6);
    expect(percussionWeight(slow, slowLength - 1, "motorik")).toBeGreaterThan(
      0.9,
    );
    // Motorik runs at full drive…
    expect(percussionWeight(motorik, 10, "motorik")).toBe(1);
    // …and settles over the last 16 steps before a slow section.
    expect(
      percussionWeight(motorik, motorikLength - TRANSITION_STEPS, "slow"),
    ).toBe(1);
    expect(
      percussionWeight(motorik, motorikLength - TRANSITION_STEPS / 2, "slow"),
    ).toBeCloseTo(0.5, 6);
    expect(percussionWeight(motorik, motorikLength - 1, "slow")).toBeLessThan(
      0.1,
    );
  });

  test("the ramp is monotonic, so a change never jumps", () => {
    const motorik = MOTORIK[0];
    const length = sectionSteps(motorik);
    let previous = Number.POSITIVE_INFINITY;
    for (let local = length - TRANSITION_STEPS; local < length; local += 1) {
      const weight = percussionWeight(motorik, local, "slow");
      expect(weight).toBeLessThanOrEqual(previous);
      previous = weight;
    }
    expect(previous).toBeLessThan(0.1);
  });

  test("the step locator walks both movement lengths correctly", () => {
    const motorikSteps = MOTORIK.reduce((sum, s) => sum + sectionSteps(s), 0);
    expect(locateStep(0).section.movement).toBe("motorik");
    expect(locateStep(0).local).toBe(0);
    expect(locateStep(63).section).toBe(CHIP_SECTIONS[0]);
    expect(locateStep(64).section).toBe(CHIP_SECTIONS[1]);
    // The slow half starts once the eight motorik sections are done.
    expect(locateStep(motorikSteps).section.movement).toBe("slow");
    expect(locateStep(motorikSteps).local).toBe(0);
    expect(locateStep(motorikSteps + 127).section).toBe(CHIP_SECTIONS[8]);
    expect(locateStep(motorikSteps + 128).section).toBe(CHIP_SECTIONS[9]);
    // The pass wraps cleanly and the section index keeps counting.
    const perPass = sectionCycleSteps();
    expect(locateStep(perPass).section).toBe(CHIP_SECTIONS[0]);
    expect(locateStep(perPass).sectionIndex).toBe(CHIP_SECTIONS.length);
    // Every sampled step maps inside its section.
    for (let step = 0; step < perPass; step += 37) {
      const at = locateStep(step);
      expect(at.local).toBeGreaterThanOrEqual(0);
      expect(at.local).toBeLessThan(sectionSteps(at.section));
    }
  });
});

describe("Dusk Republic — filter breath (Daft Punk)", () => {
  test("one smooth sweep per section, shut at the edges", () => {
    const motorik = MOTORIK[0];
    const length = sectionSteps(motorik);
    const start = filterHzAt(0, 0, length, "motorik");
    const middle = filterHzAt(0, length / 2, length, "motorik");
    const end = filterHzAt(0, length, length, "motorik");
    expect(start).toBeCloseTo(FILTER_BASE_HZ, 4);
    expect(end).toBeCloseTo(FILTER_BASE_HZ, 4);
    expect(middle).toBeGreaterThan(start);
    expect(middle).toBeLessThanOrEqual(FILTER_PEAK_HZ);
    // The slow movement stays darker: same section, smaller opening.
    const slowMiddle = filterHzAt(0, length / 2, length, "slow");
    expect(slowMiddle).toBeLessThan(middle);
    expect(slowMiddle).toBeGreaterThanOrEqual(FILTER_BASE_HZ);
  });

  test("eleven breath depths keep neighbouring sections distinct", () => {
    expect(FILTER_DEPTHS).toHaveLength(11);
    for (let index = 1; index < FILTER_DEPTHS.length; index += 1) {
      expect(FILTER_DEPTHS[index]).not.toBe(FILTER_DEPTHS[index - 1]);
    }
    for (const depth of FILTER_DEPTHS) {
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(1);
    }
  });
});

describe("Dusk Republic — pitch material", () => {
  test("the harmonic route circles the minor mode and comes home", () => {
    expect(MOTORIK.map((section) => section.degree)).toEqual([
      0, 8, 3, 10, 5, 7, 1, 0,
    ]);
    const phrygian = CHIP_SECTIONS.filter(
      (section) => modeFor(section) === PHRYGIAN,
    );
    // One flat-second station per movement.
    expect(phrygian).toHaveLength(2);
    for (const section of phrygian) {
      expect(section.degree).toBe(1);
    }
  });

  test("the lead stays a stepwise climb-and-fall", () => {
    for (const contour of LEAD_CONTOURS) {
      expect(contour).toHaveLength(8);
      for (let index = 1; index < contour.length; index += 1) {
        expect(
          Math.abs(contour[index] - contour[index - 1]),
        ).toBeLessThanOrEqual(3);
      }
      expect(Math.max(...contour) - Math.min(...contour)).toBeGreaterThan(2);
    }
  });

  test("scale degrees map to real notes, wrapping octaves both ways", () => {
    const tonic = 38; // D2
    expect(degreeToMidi(0, AEOLIAN, tonic)).toBe(38);
    expect(degreeToMidi(2, AEOLIAN, tonic)).toBe(41);
    expect(degreeToMidi(7, AEOLIAN, tonic)).toBe(50);
    expect(degreeToMidi(-1, AEOLIAN, tonic)).toBe(36);
    expect(degreeToMidi(1, PHRYGIAN, tonic)).toBe(39);
    expect(midiFrequency(69)).toBeCloseTo(440, 6);
  });

  test("the bass stays low in both movements — 'tieftönig'", () => {
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

describe("Dusk Republic — player", () => {
  test("starts idle and reports unsupported environments instead of throwing", async () => {
    const player = new DuskChiptune();
    expect(player.playing).toBe(false);
    const started = await player.start();
    expect(started).toBe(false);
    expect(player.playing).toBe(false);
    player.stop();
    await player.dispose();
    expect(player.playing).toBe(false);
  });
});
