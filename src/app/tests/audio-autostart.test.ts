import { describe, expect, test } from "bun:test";

import {
  FIRST_GESTURE_EVENTS,
  isIgnoredGesture,
  registerFirstGestureStart,
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
    for (const type of ["pointerdown", "touchstart", "keydown", "scroll", "wheel"]) {
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
});
