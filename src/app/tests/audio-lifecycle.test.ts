import { describe, expect, test } from "bun:test";

import {
  registerAudioLifecycle,
  registerPageExitAudioStop,
} from "../src/audioLifecycle";

type FakeTarget = {
  addEventListener(type: string, listener: EventListener): void;
  fire(type: string): void;
  listenerCount(): number;
  removeEventListener(type: string, listener: EventListener): void;
};

function fakeTarget(): FakeTarget {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? new Set<EventListener>();
      entries.add(listener);
      listeners.set(type, entries);
    },
    fire(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener(new Event(type));
      }
    },
    listenerCount() {
      return [...listeners.values()].reduce(
        (count, entries) => count + entries.size,
        0,
      );
    },
    removeEventListener(type, listener) {
      const entries = listeners.get(type);
      entries?.delete(listener);
      if (entries?.size === 0) {
        listeners.delete(type);
      }
    },
  };
}

function lifecycleHarness(initiallyHidden = false) {
  const windowTarget = fakeTarget();
  const documentEvents = fakeTarget();
  const documentTarget = {
    ...documentEvents,
    hidden: initiallyHidden,
  };
  const calls = { dispose: 0, resume: 0, suspend: 0 };
  const cleanup = registerAudioLifecycle({
    dispose: () => {
      calls.dispose += 1;
    },
    documentTarget: documentTarget as unknown as Pick<
      Document,
      "addEventListener" | "hidden" | "removeEventListener"
    >,
    resume: () => {
      calls.resume += 1;
    },
    suspend: () => {
      calls.suspend += 1;
    },
    windowTarget: windowTarget as unknown as Pick<
      Window,
      "addEventListener" | "removeEventListener"
    >,
  });
  return { calls, cleanup, documentTarget, windowTarget };
}

describe("page audio lifecycle", () => {
  test("suspends a page that mounts hidden without trying to resume it", () => {
    const { calls, cleanup } = lifecycleHarness(true);
    expect(calls).toEqual({ dispose: 0, resume: 0, suspend: 1 });
    cleanup();
  });

  test("deduplicates repeated hide/show notifications", () => {
    const { calls, cleanup, documentTarget } = lifecycleHarness();
    documentTarget.hidden = true;
    documentTarget.fire("visibilitychange");
    documentTarget.fire("visibilitychange");
    expect(calls).toEqual({ dispose: 0, resume: 0, suspend: 1 });

    documentTarget.hidden = false;
    documentTarget.fire("visibilitychange");
    documentTarget.fire("visibilitychange");
    expect(calls).toEqual({ dispose: 0, resume: 1, suspend: 1 });
    cleanup();
  });

  test("an ordinary focus cannot swallow the matching visible transition", () => {
    const { calls, cleanup, documentTarget, windowTarget } = lifecycleHarness();
    documentTarget.hidden = true;
    documentTarget.fire("visibilitychange");
    documentTarget.hidden = false;
    windowTarget.fire("focus");
    documentTarget.fire("visibilitychange");
    expect(calls).toEqual({ dispose: 0, resume: 1, suspend: 1 });
    cleanup();
  });

  test("disposes once across exit signals and never auto-restarts on restore", () => {
    const { calls, cleanup, documentTarget, windowTarget } = lifecycleHarness();
    documentTarget.hidden = true;
    documentTarget.fire("visibilitychange");
    windowTarget.fire("pagehide");
    windowTarget.fire("beforeunload");
    documentTarget.fire("freeze");
    expect(calls).toEqual({ dispose: 1, resume: 0, suspend: 1 });

    documentTarget.hidden = false;
    windowTarget.fire("pageshow");
    documentTarget.fire("visibilitychange");
    expect(calls.resume).toBe(0);

    // A BFCache-restored page remains observable, but only a later ordinary
    // hide/show cycle may resume audio created by a fresh user gesture.
    documentTarget.hidden = true;
    documentTarget.fire("visibilitychange");
    documentTarget.hidden = false;
    documentTarget.fire("visibilitychange");
    expect(calls).toEqual({ dispose: 1, resume: 1, suspend: 2 });
    cleanup();
  });

  test("rearms after a freeze/resume without emitting a resume callback", () => {
    const { calls, cleanup, documentTarget } = lifecycleHarness();
    documentTarget.fire("freeze");
    documentTarget.fire("resume");
    expect(calls).toEqual({ dispose: 1, resume: 0, suspend: 0 });

    documentTarget.hidden = true;
    documentTarget.fire("visibilitychange");
    expect(calls.suspend).toBe(1);
    cleanup();
  });

  test("removes every window and document listener", () => {
    const { cleanup, documentTarget, windowTarget } = lifecycleHarness();
    expect(documentTarget.listenerCount()).toBe(3);
    expect(windowTarget.listenerCount()).toBe(4);
    cleanup();
    expect(documentTarget.listenerCount()).toBe(0);
    expect(windowTarget.listenerCount()).toBe(0);
  });
});

describe("legacy page-exit stop", () => {
  test("stops on pagehide and beforeunload and removes both listeners", () => {
    const target = fakeTarget();
    let stops = 0;
    const cleanup = registerPageExitAudioStop(
      target as unknown as Pick<
        Window,
        "addEventListener" | "removeEventListener"
      >,
      () => {
        stops += 1;
      },
    );
    target.fire("pagehide");
    target.fire("beforeunload");
    expect(stops).toBe(2);
    cleanup();
    expect(target.listenerCount()).toBe(0);
  });
});
