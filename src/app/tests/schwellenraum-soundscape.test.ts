import { describe, expect, test } from "bun:test";

import {
  SCHWELLENRAUM_ENTER_FADE_SECONDS,
  SCHWELLENRAUM_LEAVE_FADE_SECONDS,
  SCHWELLENRAUM_MASTER_GAIN,
  SCHWELLENRAUM_MAX_STEPS_PER_TICK,
  SCHWELLENRAUM_MIX_FADE_SECONDS,
  SCHWELLENRAUM_ROOM_GAIN,
  SCHWELLENRAUM_SCORE_GAIN,
  SCHWELLENRAUM_STEP_SECONDS,
  SchwellenraumSoundscape,
  createSeededSoftNoise,
  isSchwellenraumAudioSupported,
  makeSoftNoiseLoopSafe,
  planSchwellenraumSchedule,
  schwellenraumFrequency,
  schwellenraumPadIntervals,
  schwellenraumStepPlan,
} from "../src/SchwellenraumSoundscape";

type TimerHarness = {
  clearInterval(id: number): void;
  clearTimeout(id: number): void;
  flushTimeouts(): void;
  intervalClears: number;
  intervalStarts: number;
  setInterval(callback: () => void, delay: number): number;
  setTimeout(callback: () => void, delay: number): number;
};

function timerHarness(): TimerHarness {
  let nextTimer = 10;
  const timeouts = new Map<number, () => void>();
  return {
    clearInterval() {
      this.intervalClears += 1;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
    flushTimeouts() {
      const pending = [...timeouts.values()];
      timeouts.clear();
      for (const callback of pending) {
        callback();
      }
    },
    intervalClears: 0,
    intervalStarts: 0,
    setInterval() {
      this.intervalStarts += 1;
      nextTimer += 1;
      return nextTimer;
    },
    setTimeout(callback) {
      nextTimer += 1;
      timeouts.set(nextTimer, callback);
      return nextTimer;
    },
  };
}

async function withTimerWindow(
  run: (timers: TimerHarness) => Promise<void> | void,
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const timers = timerHarness();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: timers,
  });
  try {
    await run(timers);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

function fakeParam(initialValue = 0) {
  const ramps: Array<{ at: number; value: number }> = [];
  return {
    cancelAndHoldAtTime() {},
    cancelScheduledValues() {},
    linearRampToValueAtTime(value: number, at: number) {
      ramps.push({ at, value });
      this.value = value;
    },
    ramps,
    setValueAtTime(value: number) {
      this.value = value;
    },
    value: initialValue,
  };
}

function fakeGraph(initialState: AudioContextState = "running") {
  let state = initialState;
  const calls = { closes: 0, resumes: 0, suspends: 0 };
  const masterParam = fakeParam(SCHWELLENRAUM_MASTER_GAIN);
  const roomParam = fakeParam(SCHWELLENRAUM_ROOM_GAIN);
  const scoreParam = fakeParam(SCHWELLENRAUM_SCORE_GAIN);
  const context = {
    close: async () => {
      calls.closes += 1;
      state = "closed";
    },
    currentTime: 18,
    get state() {
      return state;
    },
    resume: async () => {
      calls.resumes += 1;
      state = "running";
    },
    suspend: async () => {
      calls.suspends += 1;
      state = "suspended";
    },
  } as unknown as AudioContext;
  return {
    calls,
    context,
    master: { gain: masterParam } as unknown as GainNode,
    masterParam,
    roomBus: { gain: roomParam } as unknown as GainNode,
    roomParam,
    scoreBus: { gain: scoreParam } as unknown as GainNode,
    scoreParam,
    setState(nextState: AudioContextState) {
      state = nextState;
    },
  };
}

type SoundscapeInternals = {
  activeSources: Map<AudioScheduledSourceNode, AudioNode[]>;
  context: AudioContext | null;
  master: GainNode | null;
  playbackRequested: boolean;
  roomBuffer: AudioBuffer | null;
  roomBus: GainNode | null;
  schedulerTimer: number | null;
  scheduleGlint(context: AudioContext, at: number, midi: number, step: number): void;
  schedulePad(context: AudioContext, at: number, midi: number, step: number): void;
  scheduleRustle(context: AudioContext, at: number, index: number): void;
  scoreBus: GainNode | null;
  scheduleAhead(): void;
  scheduleStep(context: AudioContext, at: number, step: number): void;
  startRoomBed(context: AudioContext, at: number): void;
};

function attachGraph(
  soundscape: SchwellenraumSoundscape,
  graph: ReturnType<typeof fakeGraph>,
): SoundscapeInternals {
  const internals = soundscape as unknown as SoundscapeInternals;
  internals.context = graph.context;
  internals.master = graph.master;
  internals.roomBus = graph.roomBus;
  internals.scoreBus = graph.scoreBus;
  internals.roomBuffer = {} as AudioBuffer;
  internals.startRoomBed = () => undefined;
  internals.scheduleAhead = () => undefined;
  return internals;
}

describe("Schwellenraum procedural texture", () => {
  test("uses deterministic, bounded soft noise", () => {
    const first = createSeededSoftNoise(256, 0x12345678);
    const again = createSeededSoftNoise(256, 0x12345678);
    const other = createSeededSoftNoise(256, 0x87654321);
    expect([...first]).toEqual([...again]);
    expect([...first]).not.toEqual([...other]);
    expect(first.some((sample) => sample !== 0)).toBe(true);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(-1);
  });

  test("joins the generated room loop at exactly the same sample", () => {
    const raw = createSeededSoftNoise(512, 0x91827364);
    const loop = makeSoftNoiseLoopSafe(raw, 64);
    expect(loop[0]).toBe(loop.at(-1));
    expect(loop).not.toEqual(raw);
    expect(Math.abs(loop[1] - loop[0])).toBeLessThan(
      Math.abs(raw[1] - raw[0]),
    );
  });

  test("uses concert pitch without importing a normal-mode engine", () => {
    expect(schwellenraumFrequency(69)).toBe(440);
    expect(schwellenraumFrequency(57)).toBe(220);
  });

  test("keeps both buses and the master inside the quiet headroom contract", () => {
    expect(SCHWELLENRAUM_MASTER_GAIN).toBeLessThanOrEqual(0.045);
    expect(SCHWELLENRAUM_ROOM_GAIN).toBeLessThan(0.7);
    expect(SCHWELLENRAUM_SCORE_GAIN).toBeLessThan(0.5);
    expect(SCHWELLENRAUM_ENTER_FADE_SECONDS).toBeGreaterThan(2);
    expect(SCHWELLENRAUM_LEAVE_FADE_SECONDS).toBeGreaterThan(2);
    expect(SCHWELLENRAUM_MIX_FADE_SECONDS).toBeGreaterThan(1);
  });

  test("is sparse and deterministic over a complete event cycle", () => {
    const plans = Array.from({ length: 104 }, (_, step) =>
      schwellenraumStepPlan(step),
    );
    expect(plans.filter((plan) => plan.pad)).toHaveLength(13);
    expect(plans.filter((plan) => plan.rustle)).toHaveLength(52);
    expect(plans.filter((plan) => plan.glint)).toHaveLength(8);
    expect(plans).toEqual(
      Array.from({ length: 104 }, (_, step) => schwellenraumStepPlan(step)),
    );
  });

  test("alternates unresolved minor and suspended harmonic fields", () => {
    expect(schwellenraumPadIntervals(0)).toEqual([0, 3, 10]);
    expect(schwellenraumPadIntervals(8)).toEqual([0, 5, 11]);
    expect(schwellenraumPadIntervals(16)).toEqual([0, 3, 10]);
  });

  test("reports absent Web Audio support without throwing", () => {
    expect(isSchwellenraumAudioSupported()).toBe(false);
  });
});

describe("Schwellenraum scheduler bounds", () => {
  test("never catches up more than the hard step budget", () => {
    const plan = planSchwellenraumSchedule(-100, 30);
    expect(plan.times.length).toBeLessThanOrEqual(
      SCHWELLENRAUM_MAX_STEPS_PER_TICK,
    );
    expect(plan.times[0]).toBeGreaterThanOrEqual(30);
  });

  test("advances every scheduled event on the slow grid", () => {
    const plan = planSchwellenraumSchedule(10, 10);
    for (let index = 1; index < plan.times.length; index += 1) {
      expect(plan.times[index] - plan.times[index - 1]).toBeCloseTo(
        SCHWELLENRAUM_STEP_SECONDS,
        8,
      );
    }
    expect(plan.nextAt).toBeGreaterThan(10);
  });
});

describe("Schwellenraum mix and lifecycle", () => {
  test("fades the room and score buses independently", () => {
    const soundscape = new SchwellenraumSoundscape();
    const graph = fakeGraph();
    attachGraph(soundscape, graph);

    soundscape.setMix({ room: false, score: true });
    expect(soundscape.currentMix).toEqual({ room: false, score: true });
    expect(graph.roomParam.ramps.at(-1)?.value).toBe(0);
    expect(graph.scoreParam.ramps.at(-1)?.value).toBe(
      SCHWELLENRAUM_SCORE_GAIN,
    );

    soundscape.setMix({ room: true, score: false }, 2.1);
    expect(graph.roomParam.ramps.at(-1)).toEqual({
      at: graph.context.currentTime + 2.1,
      value: SCHWELLENRAUM_ROOM_GAIN,
    });
    expect(graph.scoreParam.ramps.at(-1)?.value).toBe(0);
    soundscape.dispose();
  });

  test("does not allocate events for a bus whose switch is off", () => {
    const soundscape = new SchwellenraumSoundscape();
    const internals = soundscape as unknown as SoundscapeInternals;
    const calls = { glint: 0, pad: 0, rustle: 0 };
    internals.scheduleGlint = () => {
      calls.glint += 1;
    };
    internals.schedulePad = () => {
      calls.pad += 1;
    };
    internals.scheduleRustle = () => {
      calls.rustle += 1;
    };

    soundscape.setMix({ room: false, score: false });
    internals.scheduleStep({} as AudioContext, 0, 0);
    expect(calls).toEqual({ glint: 0, pad: 0, rustle: 0 });

    soundscape.setMix({ room: true, score: false });
    internals.scheduleStep({} as AudioContext, 0, 0);
    expect(calls).toEqual({ glint: 0, pad: 0, rustle: 1 });
  });

  test("starts with a long master fade and exposes truthful audibility", async () => {
    await withTimerWindow(async (timers) => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      attachGraph(soundscape, graph);

      expect(await soundscape.start()).toBe(true);
      expect(soundscape.audible).toBe(true);
      expect(timers.intervalStarts).toBe(1);
      expect(graph.masterParam.ramps.at(-1)).toEqual({
        at: graph.context.currentTime + SCHWELLENRAUM_ENTER_FADE_SECONDS,
        value: SCHWELLENRAUM_MASTER_GAIN,
      });

      soundscape.setMix({ room: false, score: false });
      expect(soundscape.audible).toBe(false);
      soundscape.dispose();
    });
  });

  test("a quick re-entry retires the old loop before arming a new one", async () => {
    await withTimerWindow(async () => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      const internals = attachGraph(soundscape, graph);
      let disconnects = 0;
      let stops = 0;
      const source = {
        disconnect() {
          disconnects += 1;
        },
        onended: null,
        stop() {
          stops += 1;
        },
      } as unknown as AudioScheduledSourceNode;
      internals.activeSources.set(source, []);

      expect(await soundscape.start()).toBe(true);
      expect(stops).toBe(1);
      expect(disconnects).toBe(1);
      expect(soundscape.activeVoiceCount).toBe(0);
      soundscape.dispose();
    });
  });

  test("mode exit fades, retires voices and suspends the warm graph", async () => {
    await withTimerWindow(async (timers) => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      const internals = attachGraph(soundscape, graph);
      internals.playbackRequested = true;
      internals.schedulerTimer = 31;

      soundscape.stop();
      expect(soundscape.audible).toBe(false);
      expect(timers.intervalClears).toBe(1);
      expect(graph.masterParam.ramps.at(-1)).toEqual({
        at: graph.context.currentTime + SCHWELLENRAUM_LEAVE_FADE_SECONDS,
        value: 0,
      });
      timers.flushTimeouts();
      await Promise.resolve();
      expect(graph.calls.suspends).toBe(1);
      soundscape.dispose();
    });
  });

  test("a rapid re-entry wins while the mode-exit suspend is pending", async () => {
    await withTimerWindow(async (timers) => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      const internals = attachGraph(soundscape, graph);
      internals.playbackRequested = true;
      internals.schedulerTimer = 32;

      let markSuspendStarted: (() => void) | undefined;
      let releaseSuspend: (() => void) | undefined;
      const suspendStarted = new Promise<void>((resolve) => {
        markSuspendStarted = resolve;
      });
      (graph.context as unknown as { suspend(): Promise<void> }).suspend = () => {
        graph.calls.suspends += 1;
        markSuspendStarted?.();
        return new Promise<void>((resolve) => {
          releaseSuspend = () => {
            graph.setState("suspended");
            resolve();
          };
        });
      };

      soundscape.stop();
      timers.flushTimeouts();
      await suspendStarted;
      expect(await soundscape.start()).toBe(true);
      releaseSuspend?.();
      await Promise.resolve();
      await Promise.resolve();

      expect(graph.context.state).toBe("running");
      expect(graph.calls.resumes).toBe(1);
      expect(internals.schedulerTimer).not.toBeNull();
      expect(soundscape.audible).toBe(true);
      soundscape.dispose();
    });
  });

  test("page suspension resumes only a layer that was really active", async () => {
    await withTimerWindow(async (timers) => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      const internals = attachGraph(soundscape, graph);
      internals.playbackRequested = true;
      internals.schedulerTimer = 31;

      expect(await soundscape.setSuspended(true)).toBe(true);
      expect(soundscape.audible).toBe(false);
      expect(graph.calls.suspends).toBe(1);
      expect(await soundscape.setSuspended(false)).toBe(true);
      expect(graph.calls.resumes).toBe(1);
      expect(timers.intervalStarts).toBe(1);
      expect(soundscape.audible).toBe(true);
      soundscape.dispose();
    });
  });

  test("a visibility resume wins while its lifecycle suspend is pending", async () => {
    await withTimerWindow(async () => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      const internals = attachGraph(soundscape, graph);
      internals.playbackRequested = true;
      internals.schedulerTimer = 33;

      let markSuspendStarted: (() => void) | undefined;
      let releaseSuspend: (() => void) | undefined;
      const suspendStarted = new Promise<void>((resolve) => {
        markSuspendStarted = resolve;
      });
      (graph.context as unknown as { suspend(): Promise<void> }).suspend = () => {
        graph.calls.suspends += 1;
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
      expect(graph.calls.resumes).toBe(1);
      expect(internals.schedulerTimer).not.toBeNull();
      expect(soundscape.audible).toBe(true);
      soundscape.dispose();
    });
  });

  test("dispose closes once and invalidates the running scheduler", async () => {
    await withTimerWindow(async (timers) => {
      const soundscape = new SchwellenraumSoundscape();
      const graph = fakeGraph();
      const internals = attachGraph(soundscape, graph);
      internals.playbackRequested = true;
      internals.schedulerTimer = 31;
      soundscape.dispose();
      soundscape.dispose();
      await Promise.resolve();
      expect(timers.intervalClears).toBe(1);
      expect(graph.calls.closes).toBe(1);
      expect(soundscape.audible).toBe(false);
    });
  });
});
