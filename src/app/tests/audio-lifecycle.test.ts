import { describe, expect, test } from "bun:test";

import { registerPageExitAudioStop } from "../src/audioLifecycle";

describe("page-exit audio lifecycle", () => {
  test("stops on pagehide and beforeunload and removes both listeners", () => {
    const listeners = new Map<string, EventListener>();
    const target = {
      addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
        listeners.set(name, listener as EventListener);
      },
      removeEventListener: (name: string) => {
        listeners.delete(name);
      },
    } as Pick<Window, "addEventListener" | "removeEventListener">;
    let stops = 0;

    const cleanup = registerPageExitAudioStop(target, () => {
      stops += 1;
    });
    listeners.get("pagehide")?.(new Event("pagehide"));
    listeners.get("beforeunload")?.(new Event("beforeunload"));

    expect(stops).toBe(2);
    cleanup();
    expect(listeners.size).toBe(0);
  });
});
