import { describe, expect, test } from "bun:test";

import {
  AMBIENT_MASTER_GAIN,
  AMBIENT_VARIANTS,
  AMBIENT_START_DELAY_SECONDS,
  AmbientSoundscape,
  BEAT_INTERVAL_STEPS,
  attackReleaseEnvelope,
  beatMidi,
  isAmbientAudioSupported,
  midiFrequency,
  shouldScheduleBeat,
  swellEnvelope,
} from "../src/AmbientSoundscape";

type TimerWindow = {
  clearInterval(id: number): void;
  clearTimeout(id: number): void;
  setInterval(callback: () => void, delay: number): number;
  setTimeout(callback: () => void, delay: number): number;
};

async function withTimerWindow(
  run: (counts: {
    intervalClears: number;
    intervalStarts: number;
  }) => Promise<void>,
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
  const counts = { intervalClears: 0, intervalStarts: 0 };
  const timerWindow: TimerWindow = {
    clearInterval() {
      counts.intervalClears += 1;
    },
    clearTimeout(id) {
      nativeClearTimeout(id);
    },
    setInterval() {
      counts.intervalStarts += 1;
      return 41;
    },
    setTimeout(callback, delay) {
      return nativeSetTimeout(callback, delay) as unknown as number;
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: timerWindow,
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

function fakeAudioGraph(initialState: AudioContextState = "running") {
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
    value: 0.07,
  };
  const context = {
    close: async () => {
      counts.closes += 1;
      state = "closed";
    },
    currentTime: 12,
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
  test("fires twice per bar, a quarter of the original hat cadence", () => {
    // v0.39.0 ("noch zu unruhig"): 4 → 8 steps between swells. Combined with
    // the 72 → 54 BPM drop, a swell now lands roughly every 4.4 s instead of
    // every 1.7 s.
    expect(BEAT_INTERVAL_STEPS).toBe(8);
    const bar = Array.from({ length: 16 }, (_, step) => shouldScheduleBeat(step));
    const hits = bar.filter(Boolean).length;
    expect(hits).toBe(2);
  });

  test("is tuned two octaves below the variant root", () => {
    for (const variant of AMBIENT_VARIANTS) {
      expect(beatMidi(variant.rootMidi)).toBe(variant.rootMidi - 24);
      expect(midiFrequency(beatMidi(variant.rootMidi))).toBeLessThan(
        midiFrequency(variant.rootMidi),
      );
    }
  });

  test("audible is false while the context is not running", () => {
    // Same contract as the chiptune layer: an armed scheduler over a
    // suspended context is silence, and the toggle has to say so.
    const soundscape = new AmbientSoundscape();
    expect(soundscape.audible).toBe(false);
    const internals = soundscape as unknown as {
      context: { state: string } | null;
      timer: number | null;
    };
    internals.timer = 1;
    internals.context = { state: "suspended" };
    expect(soundscape.audible).toBe(false);
    internals.context = { state: "running" };
    expect(soundscape.audible).toBe(true);
  });

  test("a real gesture supersedes a still-pending autoplay attempt", async () => {
    await withTimerWindow(async (timerCounts) => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("suspended");
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
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        scheduleAhead(): void;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.scheduleAhead = () => undefined;

      const blockedAutoplay = soundscape.start();
      await Promise.resolve();
      const clickedStart = soundscape.start();

      expect(await clickedStart).toBe(true);
      expect(soundscape.audible).toBe(true);
      expect(timerCounts.intervalStarts).toBe(1);
      releaseBlockedResume?.();
      expect(await blockedAutoplay).toBe(false);
      expect(timerCounts.intervalStarts).toBe(1);
      soundscape.dispose();
    });
  });

  test("an explicit start repairs a stale scheduler over suspended audio", async () => {
    await withTimerWindow(async (timerCounts) => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("suspended");
      let scheduleCalls = 0;
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        scheduleAhead(): void;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 7;
      internals.scheduleAhead = () => {
        scheduleCalls += 1;
      };

      expect(await soundscape.start()).toBe(true);
      expect(graph.counts.resumes).toBe(1);
      expect(timerCounts.intervalClears).toBe(1);
      expect(timerCounts.intervalStarts).toBe(1);
      expect(scheduleCalls).toBe(1);
      expect(soundscape.audible).toBe(true);
      soundscape.dispose();
    });
  });

  test("hide stops the scheduler and voices, then resumes once from now", async () => {
    await withTimerWindow(async (timerCounts) => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph();
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
      const internals = soundscape as unknown as {
        activeSources: Map<AudioScheduledSourceNode, AudioNode[]>;
        context: AudioContext | null;
        master: GainNode | null;
        nextStepAt: number;
        scheduleAhead(): void;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 7;
      internals.activeSources.set(source, []);
      internals.scheduleAhead = () => {
        scheduleCalls += 1;
      };

      expect(await soundscape.setSuspended(true)).toBe(true);
      expect(soundscape.audible).toBe(false);
      expect(soundscape.activeVoiceCount).toBe(0);
      expect(sourceStops).toBe(1);
      expect(sourceDisconnects).toBe(1);
      expect(graph.counts.suspends).toBe(1);
      expect(timerCounts.intervalClears).toBe(1);

      // Repeated lifecycle notifications are harmless and preserve the
      // already-playing intent.
      expect(await soundscape.setSuspended(true)).toBe(true);
      expect(graph.counts.suspends).toBe(1);
      expect(await soundscape.setSuspended(false)).toBe(true);
      expect(graph.counts.resumes).toBe(1);
      expect(timerCounts.intervalStarts).toBe(1);
      expect(scheduleCalls).toBe(1);
      expect(internals.nextStepAt).toBeCloseTo(
        graph.context.currentTime + AMBIENT_START_DELAY_SECONDS,
        6,
      );
      expect(await soundscape.setSuspended(false)).toBe(false);
      expect(timerCounts.intervalStarts).toBe(1);
      soundscape.dispose();
    });
  });

  test("dispose invalidates an in-flight resume before it can arm a timer", async () => {
    await withTimerWindow(async (timerCounts) => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("suspended");
      let resolveResume: (() => void) | null = null;
      graph.context.resume = () =>
        new Promise<void>((resolve) => {
          resolveResume = resolve;
        });
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        resumeAfterSuspension: boolean;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.resumeAfterSuspension = true;

      const pending = soundscape.setSuspended(false);
      soundscape.dispose();
      resolveResume?.();

      expect(await pending).toBe(false);
      expect(internals.timer).toBeNull();
      expect(timerCounts.intervalStarts).toBe(0);
      expect(graph.counts.closes).toBe(1);
    });
  });

  test("mode handover fades to zero before suspending and remains resumable", async () => {
    await withTimerWindow(async (timerCounts) => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("running");
      const source = {
        disconnect() {},
        onended: null,
        stop() {},
      } as unknown as AudioScheduledSourceNode;
      const internals = soundscape as unknown as {
        activeSources: Map<AudioScheduledSourceNode, AudioNode[]>;
        context: AudioContext | null;
        master: GainNode | null;
        resumeAfterSuspension: boolean;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 17;
      internals.activeSources.set(source, []);

      expect(await soundscape.fadeToSuspended(0.02)).toBe(true);
      expect(graph.master.gain.value).toBe(0);
      expect(graph.counts.suspends).toBe(1);
      expect(timerCounts.intervalClears).toBe(1);
      expect(internals.resumeAfterSuspension).toBeTrue();
      expect(soundscape.activeVoiceCount).toBe(0);
      soundscape.dispose();
    });
  });

  test("an immediate restart cancels a stale mode-handover suspension", async () => {
    await withTimerWindow(async () => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("running");
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 18;

      const fading = soundscape.fadeToSuspended(0.02);
      expect(await soundscape.start()).toBe(true);
      expect(await fading).toBe(false);
      expect(graph.counts.suspends).toBe(0);
      expect(graph.master.gain.value).toBe(AMBIENT_MASTER_GAIN);
      soundscape.dispose();
    });
  });

  test("a restart wins while the handover suspend promise is pending", async () => {
    await withTimerWindow(async () => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("running");
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 19;
      (soundscape as unknown as { scheduleAhead(): void }).scheduleAhead = () =>
        undefined;

      let markSuspendStarted: (() => void) | undefined;
      let releaseSuspend: (() => void) | undefined;
      const suspendStarted = new Promise<void>((resolve) => {
        markSuspendStarted = resolve;
      });
      (graph.context as unknown as { suspend(): Promise<void> }).suspend = () => {
        graph.counts.suspends += 1;
        markSuspendStarted?.();
        return new Promise<void>((resolve) => {
          releaseSuspend = () => {
            graph.setState("suspended");
            resolve();
          };
        });
      };

      const fading = soundscape.fadeToSuspended(0.02);
      await suspendStarted;
      expect(await soundscape.start()).toBe(true);
      releaseSuspend?.();

      expect(await fading).toBe(false);
      expect(graph.context.state).toBe("running");
      expect(graph.counts.resumes).toBe(1);
      expect(internals.timer).not.toBeNull();
      expect(graph.master.gain.value).toBe(AMBIENT_MASTER_GAIN);
      soundscape.dispose();
    });
  });

  test("a visibility resume wins while lifecycle suspension is pending", async () => {
    await withTimerWindow(async () => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph("running");
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        timer: number | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.timer = 20;
      (soundscape as unknown as { scheduleAhead(): void }).scheduleAhead = () =>
        undefined;

      let markSuspendStarted: (() => void) | undefined;
      let releaseSuspend: (() => void) | undefined;
      const suspendStarted = new Promise<void>((resolve) => {
        markSuspendStarted = resolve;
      });
      (graph.context as unknown as { suspend(): Promise<void> }).suspend = () => {
        graph.counts.suspends += 1;
        markSuspendStarted?.();
        return new Promise<void>((resolve) => {
          releaseSuspend = () => {
            graph.setState("suspended");
            resolve();
          };
        });
      };

      const pausing = soundscape.setSuspended(true);
      await suspendStarted;
      expect(await soundscape.setSuspended(false)).toBe(true);
      releaseSuspend?.();

      expect(await pausing).toBe(false);
      expect(graph.context.state).toBe("running");
      expect(graph.counts.resumes).toBe(1);
      expect(internals.timer).not.toBeNull();
      soundscape.dispose();
    });
  });

  test("a hidden autoplay attempt cannot resume without a fresh gesture", async () => {
    await withTimerWindow(async (timerCounts) => {
      const soundscape = new AmbientSoundscape();
      const graph = fakeAudioGraph();
      const internals = soundscape as unknown as {
        context: AudioContext | null;
        master: GainNode | null;
        startPromise: Promise<boolean> | null;
      };
      internals.context = graph.context;
      internals.master = graph.master;
      internals.startPromise = Promise.resolve(false);

      expect(await soundscape.setSuspended(true)).toBe(true);
      expect(await soundscape.setSuspended(false)).toBe(false);
      expect(timerCounts.intervalStarts).toBe(0);
      soundscape.dispose();
    });
  });
});
