import { describe, expect, test } from "bun:test";

import {
  AEOLIAN,
  CHIP_BPM,
  CHIP_CYCLE_SECTIONS,
  CHIP_MAX_STEPS_PER_TICK,
  CHIP_MASTER_GAIN,
  CHIP_SCHEDULE_RESUME_DELAY_SECONDS,
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
  chipScheduleBatch,
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
import { AMBIENT_MASTER_GAIN } from "../src/AmbientSoundscape";

async function withFakeTimerWindow(
  run: (counts: {
    intervalClears: number;
    intervalStarts: number;
  }) => Promise<void>,
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
  const counts = { intervalClears: 0, intervalStarts: 0 };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      AudioContext: class {},
      clearInterval() {
        counts.intervalClears += 1;
      },
      clearTimeout(id: number) {
        nativeClearTimeout(id);
      },
      setInterval() {
        counts.intervalStarts += 1;
        return 73;
      },
      setTimeout(callback: () => void, delay: number) {
        return nativeSetTimeout(callback, delay);
      },
    },
  });
  try {
    await run(counts);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

function fakeChipGraph(initialState: AudioContextState = "running") {
  let state = initialState;
  const counts = { closes: 0, resumes: 0, suspends: 0 };
  const gain = {
    cancelScheduledValues() {},
    linearRampToValueAtTime(value: number) {
      this.value = value;
    },
    setValueAtTime(value: number) {
      this.value = value;
    },
    value: CHIP_MASTER_GAIN,
  };
  const context = {
    close: async () => {
      counts.closes += 1;
      state = "closed";
    },
    currentTime: 27,
    resume: async () => {
      counts.resumes += 1;
      state = "running";
    },
    get state() {
      return state;
    },
    suspend: async () => {
      counts.suspends += 1;
      state = "suspended";
    },
  } as unknown as AudioContext;
  return {
    context,
    counts,
    master: { gain } as unknown as GainNode,
    setState(nextState: AudioContextState) {
      state = nextState;
    },
  };
}

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
    // Still a pulse, no longer a drive. v0.39.0 takes 118 → 88 BPM ("noch zu
    // unruhig und ein bisschen zu schnell"); the floor keeps it clear of the
    // old funeral march.
    expect(CHIP_BPM).toBeGreaterThan(80);
    expect(CHIP_BPM).toBeLessThan(100);
    expect(CHIP_STEP_SECONDS).toBeCloseTo(60 / CHIP_BPM / 4, 6);
    // Low key regardless of movement.
    expect(CHIP_MASTER_GAIN).toBeLessThan(0.1);
    expect(CHIP_MASTER_GAIN).toBeGreaterThan(0);
    // Still minor, still dark.
    expect(AEOLIAN[2]).toBe(3);
    expect(PHRYGIAN[1]).toBe(1);
  });

  test("the two optional audio layers retain shared mobile headroom", () => {
    expect(CHIP_MASTER_GAIN).toBe(0.03);
    expect(AMBIENT_MASTER_GAIN).toBe(0.07);
    expect(CHIP_MASTER_GAIN + AMBIENT_MASTER_GAIN).toBeLessThanOrEqual(0.1);
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
  test("a click on every half, a hat on the off-quarter between them", () => {
    // v0.39.0 halves the percussion density (click 4 → 8, hat 2 → 4). The
    // click–hat–click alternation is what carries the motorik feel, so it is
    // preserved exactly; only the air between the hits doubles.
    expect(isClickStep(0)).toBe(true);
    expect(isClickStep(8)).toBe(true);
    expect(isClickStep(4)).toBe(false);
    expect(isHatStep(4)).toBe(true);
    expect(isHatStep(12)).toBe(true);
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
    expect(clicks).toBe(8); // one per half across four bars
    expect(hats).toBe(8); // one per off-quarter, interleaved
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
  test("a five-minute scheduler run stays bounded and chronological", () => {
    let nextStepAt = 0.12;
    let scheduled = 0;
    let largestBatch = 0;
    for (let currentTime = 0; currentTime <= 5 * 60; currentTime += 0.09) {
      const batch = chipScheduleBatch(currentTime, nextStepAt);
      largestBatch = Math.max(largestBatch, batch.times.length);
      for (let index = 1; index < batch.times.length; index += 1) {
        expect(batch.times[index]).toBeGreaterThan(batch.times[index - 1]);
      }
      scheduled += batch.times.length;
      nextStepAt = batch.nextStepAt;
    }
    // 300 s at 88 BPM sixteenths (CHIP_STEP_SECONDS ≈ 0.1705 s) is ≈ 1760
    // steps, down from ≈ 2360 at 118 BPM — the slowdown, counted.
    expect(scheduled).toBeGreaterThan(1_700);
    expect(scheduled).toBeLessThan(1_800);
    expect(largestBatch).toBeLessThanOrEqual(CHIP_MAX_STEPS_PER_TICK);
  });

  test("a throttled background timer resumes ahead of now without a burst", () => {
    const batch = chipScheduleBatch(305, 4.2);
    // The 0.4 s lookahead holds two of the longer 88 BPM steps (three at the
    // old tempo) — the window is fixed, the step count follows the tempo.
    expect(batch.times).toHaveLength(2);
    expect(batch.times[0]).toBeCloseTo(
      305 + CHIP_SCHEDULE_RESUME_DELAY_SECONDS,
      6,
    );
    expect(batch.times.length).toBeLessThanOrEqual(
      CHIP_MAX_STEPS_PER_TICK,
    );
  });

  test("starts idle and reports unsupported environments instead of throwing", async () => {
    const player = new DuskChiptune();
    expect(player.playing).toBe(false);
    expect(player.activeVoiceCount).toBe(0);
    const started = await player.start();
    expect(started).toBe(false);
    expect(player.playing).toBe(false);
    player.stop();
    await player.dispose();
    expect(player.playing).toBe(false);
  });

  test("disconnects every ended one-shot graph from the active registry", () => {
    const player = new DuskChiptune();
    let sourceDisconnects = 0;
    let nodeDisconnects = 0;
    const source = {
      disconnect() {
        sourceDisconnects += 1;
      },
      onended: null,
    } as unknown as AudioScheduledSourceNode;
    const node = {
      disconnect() {
        nodeDisconnects += 1;
      },
    } as unknown as AudioNode;
    const trackedPlayer = player as unknown as {
      trackSource(
        trackedSource: AudioScheduledSourceNode,
        nodes: AudioNode[],
      ): void;
    };

    trackedPlayer.trackSource(source, [node]);
    expect(player.activeVoiceCount).toBe(1);
    (source.onended as unknown as () => void)();

    expect(sourceDisconnects).toBe(1);
    expect(nodeDisconnects).toBe(1);
    expect(player.activeVoiceCount).toBe(0);
  });

  test("audible is false while the context is not running", () => {
    // The autoplay block leaves the scheduler armed over a suspended
    // context. Reporting that as playing is what made the toggle lie.
    const player = new DuskChiptune();
    expect(player.playing).toBe(false);
    expect(player.audible).toBe(false);
    const internals = player as unknown as {
      context: { state: string } | null;
      timer: number | null;
    };
    internals.timer = 1;
    internals.context = { state: "suspended" };
    expect(player.playing).toBe(true);
    expect(player.audible).toBe(false);
    internals.context = { state: "running" };
    expect(player.audible).toBe(true);
    internals.timer = null;
    expect(player.audible).toBe(false);
  });

  test("a real gesture supersedes a still-pending autoplay attempt", async () => {
    await withFakeTimerWindow(async (timerCounts) => {
      const player = new DuskChiptune();
      const graph = fakeChipGraph("suspended");
      let releaseBlockedResume: (() => void) | null = null;
      graph.context.resume = () => {
        graph.counts.resumes += 1;
        if (graph.counts.resumes === 1) {
          return new Promise<void>((resolve) => {
            releaseBlockedResume = resolve;
          });
        }
        graph.setState("running");
        return Promise.resolve();
      };
      const internals = player as unknown as {
        context: AudioContext | null;
        ensureGraph(context: AudioContext): void;
        master: GainNode | null;
        prepare(): boolean;
        scheduleAhead(): void;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.prepare = () => true;
      internals.ensureGraph = () => undefined;
      internals.scheduleAhead = () => undefined;

      const blockedAutoplay = player.start();
      await Promise.resolve();
      const clickedStart = player.start();

      expect(await clickedStart).toBe(true);
      expect(player.audible).toBe(true);
      expect(timerCounts.intervalStarts).toBe(1);
      releaseBlockedResume?.();
      expect(await blockedAutoplay).toBe(false);
      expect(timerCounts.intervalStarts).toBe(1);
      await player.dispose();
    });
  });

  test("an explicit start repairs a stale scheduler over suspended audio", async () => {
    await withFakeTimerWindow(async (timerCounts) => {
      const player = new DuskChiptune();
      const graph = fakeChipGraph("suspended");
      let scheduleCalls = 0;
      const internals = player as unknown as {
        context: AudioContext | null;
        ensureGraph(context: AudioContext): void;
        master: GainNode | null;
        prepare(): boolean;
        scheduleAhead(): void;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 8;
      internals.prepare = () => true;
      internals.ensureGraph = () => undefined;
      internals.scheduleAhead = () => {
        scheduleCalls += 1;
      };

      expect(await player.start()).toBe(true);
      expect(graph.counts.resumes).toBe(1);
      expect(timerCounts.intervalClears).toBe(1);
      expect(timerCounts.intervalStarts).toBe(1);
      expect(scheduleCalls).toBe(1);
      expect(player.audible).toBe(true);
      await player.dispose();
    });
  });

  test("hide clears the scheduler and voices, then resumes on a fresh step", async () => {
    await withFakeTimerWindow(async (timerCounts) => {
      const player = new DuskChiptune();
      const graph = fakeChipGraph();
      let nodeDisconnects = 0;
      let scheduleCalls = 0;
      let sourceDisconnects = 0;
      let sourceStops = 0;
      const source = {
        disconnect() {
          sourceDisconnects += 1;
        },
        onended: null,
        stop() {
          sourceStops += 1;
        },
      } as unknown as AudioScheduledSourceNode;
      const node = {
        disconnect() {
          nodeDisconnects += 1;
        },
      } as unknown as AudioNode;
      const internals = player as unknown as {
        activeSources: Map<AudioScheduledSourceNode, AudioNode[]>;
        context: AudioContext | null;
        master: GainNode | null;
        nextStepAt: number;
        scheduleAhead(): void;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 8;
      internals.activeSources.set(source, [node]);
      internals.scheduleAhead = () => {
        scheduleCalls += 1;
      };

      expect(await player.setSuspended(true)).toBe(true);
      expect(player.playing).toBe(false);
      expect(player.activeVoiceCount).toBe(0);
      expect(sourceStops).toBe(1);
      expect(sourceDisconnects).toBe(1);
      expect(nodeDisconnects).toBe(1);
      expect(graph.counts.suspends).toBe(1);
      expect(timerCounts.intervalClears).toBe(1);

      expect(await player.setSuspended(true)).toBe(true);
      expect(await player.setSuspended(false)).toBe(true);
      expect(graph.counts.resumes).toBe(1);
      expect(scheduleCalls).toBe(1);
      expect(timerCounts.intervalStarts).toBe(1);
      expect(internals.nextStepAt).toBeCloseTo(
        graph.context.currentTime + CHIP_SCHEDULE_RESUME_DELAY_SECONDS,
        6,
      );
      expect(await player.setSuspended(false)).toBe(false);
      expect(timerCounts.intervalStarts).toBe(1);
      await player.dispose();
    });
  });

  test("dispose wins a race with resume and cannot restart the sequencer", async () => {
    await withFakeTimerWindow(async (timerCounts) => {
      const player = new DuskChiptune();
      const graph = fakeChipGraph("suspended");
      let resolveResume: (() => void) | null = null;
      graph.context.resume = () =>
        new Promise<void>((resolve) => {
          resolveResume = resolve;
        });
      const internals = player as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        resumeAfterSuspension: boolean;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.resumeAfterSuspension = true;

      const pending = player.setSuspended(false);
      await player.dispose();
      resolveResume?.();

      expect(await pending).toBe(false);
      expect(internals.timer).toBeNull();
      expect(timerCounts.intervalStarts).toBe(0);
      expect(graph.counts.closes).toBe(1);
    });
  });

  test("a hidden autoplay attempt cannot resume without a fresh gesture", async () => {
    await withFakeTimerWindow(async (timerCounts) => {
      const player = new DuskChiptune();
      const graph = fakeChipGraph();
      const internals = player as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        startPromise: Promise<boolean> | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.startPromise = Promise.resolve(false);

      expect(await player.setSuspended(true)).toBe(true);
      expect(await player.setSuspended(false)).toBe(false);
      expect(timerCounts.intervalStarts).toBe(0);
      await player.dispose();
    });
  });
});
