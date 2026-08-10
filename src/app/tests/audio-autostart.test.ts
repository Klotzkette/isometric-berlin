import { describe, expect, test } from "bun:test";

import {
  FIRST_GESTURE_EVENTS,
  isIgnoredGesture,
  registerFirstGestureStart,
  registerVisibleAutoplayRetry,
  shouldStopAudioOnToggleTap,
} from "../src/audioAutostart";

type Registration = {
  capture: boolean;
  listener: (event: Event) => void;
  passive: boolean;
  type: string;
};

function fakeTarget() {
  const registered: Registration[] = [];
  return {
    registered,
    target: {
      addEventListener(
        type: string,
        listener: (event: Event) => void,
        options?: AddEventListenerOptions,
      ) {
        registered.push({
          capture: options?.capture === true,
          listener,
          passive: options?.passive === true,
          type,
        });
      },
      removeEventListener(type: string, listener: (event: Event) => void) {
        for (let index = registered.length - 1; index >= 0; index -= 1) {
          if (
            registered[index].type === type &&
            registered[index].listener === listener
          ) {
            registered.splice(index, 1);
          }
        }
      },
    },
  };
}

function fire(registered: Registration[], type: string, event: Partial<Event>) {
  for (const entry of [...registered]) {
    if (entry.type === type) {
      entry.listener({ target: null, type, ...event } as Event);
    }
  }
}

describe("first-gesture audio start", () => {
  test("listens in the capture phase so a map drag still starts the music", () => {
    const { registered, target } = fakeTarget();
    registerFirstGestureStart({ start: async () => true, target });
    expect(registered.length).toBe(FIRST_GESTURE_EVENTS.length);
    for (const entry of registered) {
      // The canvas handlers stop propagation on the very first pointerdown.
      // Bubble-phase listeners never see it, which is the whole bug.
      expect(entry.capture).toBe(true);
      expect(entry.passive).toBe(true);
    }
  });

  test("covers the gestures a phone actually produces first", () => {
    for (const type of [
      "pointerdown",
      "pointermove",
      "touchstart",
      "keydown",
      "scroll",
      "wheel",
    ]) {
      expect(FIRST_GESTURE_EVENTS).toContain(type as never);
    }
  });

  test("calls start synchronously inside the handler (iOS keeps the gesture)", () => {
    const { registered, target } = fakeTarget();
    let calledDuringHandler = false;
    registerFirstGestureStart({
      start: async () => {
        calledDuringHandler = true;
        return true;
      },
      target,
    });
    fire(registered, "pointerdown", {});
    expect(calledDuringHandler).toBe(true);
  });

  test("disarms after a real start, stays armed after a blocked one", async () => {
    const { registered, target } = fakeTarget();
    let started = false;
    let attempts = 0;
    registerFirstGestureStart({
      start: async () => {
        attempts += 1;
        return started;
      },
      target,
    });
    fire(registered, "pointerdown", {});
    await Promise.resolve();
    expect(attempts).toBe(1);
    expect(registered.length).toBe(FIRST_GESTURE_EVENTS.length);

    started = true;
    fire(registered, "pointerdown", {});
    await Promise.resolve();
    expect(attempts).toBe(2);
    expect(registered.length).toBe(0);
  });

  test("a click supersedes a pointerdown resume that never settles", async () => {
    const { registered, target } = fakeTarget();
    const resolvers: Array<(started: boolean) => void> = [];
    let attempts = 0;
    registerFirstGestureStart({
      start: () => {
        attempts += 1;
        return new Promise<boolean>((resolve) => resolvers.push(resolve));
      },
      target,
    });

    fire(registered, "pointerdown", {});
    fire(registered, "mousedown", {});
    expect(attempts).toBe(1);

    // Some browsers grant audio activation only to the completed click. It
    // must get a fresh synchronous resume call even while pointerdown hangs.
    fire(registered, "click", {});
    expect(attempts).toBe(2);
    resolvers[1](true);
    await Promise.resolve();
    expect(registered.length).toBe(0);

    // A late result from the stale attempt cannot re-arm or alter the winner.
    resolvers[0](false);
    await Promise.resolve();
    expect(registered.length).toBe(0);
  });

  test("an explicit mute is respected on every gesture", async () => {
    const { registered, target } = fakeTarget();
    let attempts = 0;
    let muted = true;
    registerFirstGestureStart({
      isMuted: () => muted,
      start: async () => {
        attempts += 1;
        return true;
      },
      target,
    });
    fire(registered, "pointerdown", {});
    await Promise.resolve();
    expect(attempts).toBe(0);
    muted = false;
    fire(registered, "pointerdown", {});
    await Promise.resolve();
    expect(attempts).toBe(1);
  });

  test("the audio buttons and the b/t/n shortcuts keep their own handlers", () => {
    const toggle = {
      closest: (selector: string) =>
        selector === "[data-audio-toggle]" ? {} : null,
    };
    expect(
      isIgnoredGesture({ target: toggle, type: "pointerdown" } as never),
    ).toBe(true);
    expect(
      isIgnoredGesture({ key: "B", target: null, type: "keydown" } as never),
    ).toBe(true);
    expect(
      isIgnoredGesture({ key: "T", target: null, type: "keydown" } as never),
    ).toBe(true);
    // Regression (v0.52.1): "N" toggles night lights via its own App.tsx
    // handler. Before this fix it was missing from IGNORED_KEYS, so the
    // capture-phase first-gesture listener also raced in and started the
    // ambient music/soundtrack on the very first "N" press — a shortcut
    // collision that looked like "N triggers the music toggle".
    expect(
      isIgnoredGesture({ key: "n", target: null, type: "keydown" } as never),
    ).toBe(true);
    expect(
      isIgnoredGesture({ key: "N", target: null, type: "keydown" } as never),
    ).toBe(true);
    // Keys without their own dedicated shortcut-vs-autostart guard still
    // count as a valid first gesture (e.g. "d" day/night, "m" Minecraft).
    expect(
      isIgnoredGesture({ key: "d", target: null, type: "keydown" } as never),
    ).toBe(false);
  });

  describe("shouldStopAudioOnToggleTap (v0.56.2 mobile tap fix)", () => {
    test("a silent engine always starts, an audible one always stops", () => {
      expect(shouldStopAudioOnToggleTap(false)).toBe(false);
      expect(shouldStopAudioOnToggleTap(true)).toBe(true);
    });

    // Regression (v0.56.2): "Man kann auf mobil 'Dusk Republic' nicht
    // anklicken/einschalten." On a phone the visitor's first tap is
    // often the "…" overflow button (no [data-audio-toggle]), which
    // registerFirstGestureStart legitimately treats as the first
    // gesture and uses to start the soundtrack — before the visitor's
    // very next tap lands on the actual "Dusk Republic" button inside
    // the sheet that button just opened. The old toggle branched on
    // stored on-load INTENT (true from first render, so the desktop
    // toggle auto-plays without a race), which was therefore already
    // `true` from that overflow tap and made the very next tap on the
    // visible button turn straight back off in the same combined
    // gesture — the exact shape of the N-shortcut collision in v0.52.1,
    // here via a race instead of a missing ignore-list key. Branching on
    // audibility instead means: whatever a first gesture elsewhere on
    // the page already started, the next tap on the button itself is
    // read from what the visitor can actually hear, so it reliably ends
    // in "on", never a same-gesture double toggle.
    test("an overflow-button first gesture no longer flips the very next toggle tap back off", () => {
      // Step 1: the visitor's first-ever tap is the "…" overflow button.
      // isIgnoredGesture is false for it (no data-audio-toggle), so
      // registerFirstGestureStart legitimately starts the engine.
      const overflowButtonGestureIgnored = isIgnoredGesture({
        target: { closest: () => null },
        type: "pointerdown",
      } as never);
      expect(overflowButtonGestureIgnored).toBe(false);
      // What registerFirstGestureStart's start() achieves once it runs.
      const isAudible = true;

      // Step 2: the visitor's very next tap lands on the "Dusk Republic"
      // button itself, inside the sheet the overflow tap just opened.
      // The old code asked stored intent (already true pre-tap) and
      // stopped the engine it had just started. The fixed toggle asks
      // audibility instead and correctly leaves it playing.
      expect(shouldStopAudioOnToggleTap(isAudible)).toBe(true);
      // A tap that lands on the button as the TRUE first gesture (desktop,
      // or a phone visitor who taps the visible toolbar button directly)
      // never raced with the autostart listener in the first place
      // (isIgnoredGesture caught it), so audible is still false and the
      // toggle correctly starts rather than stops.
      expect(shouldStopAudioOnToggleTap(false)).toBe(false);
    });
  });
});

describe("visible-page autoplay retry", () => {
  test("retries a permitted soundtrack when a background tab becomes visible", async () => {
    const documentEvents = fakeTarget();
    const windowEvents = fakeTarget();
    const documentTarget = {
      ...documentEvents.target,
      hidden: true,
    };
    let attempts = 0;
    registerVisibleAutoplayRetry({
      documentTarget,
      isAudible: () => false,
      isEnabled: () => true,
      start: async () => {
        attempts += 1;
        return true;
      },
      windowTarget: windowEvents.target,
    });

    fire(windowEvents.registered, "pageshow", {});
    expect(attempts).toBe(0);
    documentTarget.hidden = false;
    fire(documentEvents.registered, "visibilitychange", {});
    await Promise.resolve();
    expect(attempts).toBe(1);
  });

  test("does not restart audible, disabled, or already-pending audio", async () => {
    const documentEvents = fakeTarget();
    const windowEvents = fakeTarget();
    const documentTarget = {
      ...documentEvents.target,
      hidden: false,
    };
    let enabled = true;
    let audible = true;
    let attempts = 0;
    let resolveStart: ((started: boolean) => void) | null = null;
    const unregister = registerVisibleAutoplayRetry({
      documentTarget,
      isAudible: () => audible,
      isEnabled: () => enabled,
      start: () => {
        attempts += 1;
        return new Promise<boolean>((resolve) => {
          resolveStart = resolve;
        });
      },
      windowTarget: windowEvents.target,
    });

    fire(windowEvents.registered, "focus", {});
    expect(attempts).toBe(0);
    audible = false;
    enabled = false;
    fire(windowEvents.registered, "focus", {});
    expect(attempts).toBe(0);
    enabled = true;
    fire(windowEvents.registered, "focus", {});
    fire(windowEvents.registered, "pageshow", {});
    expect(attempts).toBe(1);
    resolveStart?.(true);
    await Promise.resolve();

    unregister();
    expect(documentEvents.registered).toHaveLength(0);
    expect(windowEvents.registered).toHaveLength(0);
  });

  test("recovers when an audio engine throws before returning its promise", () => {
    const documentEvents = fakeTarget();
    const windowEvents = fakeTarget();
    let attempts = 0;
    registerVisibleAutoplayRetry({
      documentTarget: { ...documentEvents.target, hidden: false },
      isAudible: () => false,
      isEnabled: () => true,
      start: () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary audio construction failure");
        }
        return Promise.resolve(true);
      },
      windowTarget: windowEvents.target,
    });

    fire(windowEvents.registered, "focus", {});
    fire(windowEvents.registered, "focus", {});
    expect(attempts).toBe(2);
  });
});
