import { describe, expect, test } from "bun:test";

import {
  COMPACT_LAYOUT_MAX_WIDTH_PX,
  chromeHiddenForLayout,
  compactLayoutForWidth,
  observeCompactLayout,
  shouldPersistChromePreference,
} from "../src/responsiveLayout";

type MutableMediaQuery = {
  matches: boolean;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

function eventTarget(): {
  listeners: Set<EventListener>;
  target: Pick<MutableMediaQuery, "addEventListener" | "removeEventListener">;
} {
  const listeners = new Set<EventListener>();
  return {
    listeners,
    target: {
      addEventListener(_type, listener) {
        listeners.add(listener);
      },
      removeEventListener(_type, listener) {
        listeners.delete(listener);
      },
    },
  };
}

describe("responsive viewer chrome", () => {
  test("shares the inclusive 1024 px breakpoint with the compact CSS", () => {
    expect(COMPACT_LAYOUT_MAX_WIDTH_PX).toBe(1024);
    expect(compactLayoutForWidth(390)).toBe(true);
    expect(compactLayoutForWidth(1024)).toBe(true);
    expect(compactLayoutForWidth(1025)).toBe(false);
  });

  test("tracks rotation and iPad Split View changes until cleanup", () => {
    const mediaEvents = eventTarget();
    const viewportEvents = eventTarget();
    const query: MutableMediaQuery = {
      matches: false,
      ...mediaEvents.target,
    };
    const states: boolean[] = [];
    const stop = observeCompactLayout(
      query,
      (compact) => states.push(compact),
      viewportEvents.target,
    );

    expect(states).toEqual([false]);
    query.matches = true;
    for (const listener of mediaEvents.listeners) {
      listener({} as Event);
    }
    expect(states).toEqual([false, true]);

    query.matches = false;
    for (const listener of viewportEvents.listeners) {
      listener({} as Event);
    }
    expect(states).toEqual([false, true, false]);

    stop();
    expect(mediaEvents.listeners.size).toBe(0);
    expect(viewportEvents.listeners.size).toBe(0);
  });

  test("always opens direct controls when a compact viewer starts", () => {
    expect(chromeHiddenForLayout(true, true)).toBe(false);
    expect(chromeHiddenForLayout(false, true)).toBe(false);
    expect(shouldPersistChromePreference(true)).toBe(false);
  });

  test("retains the explicit hide preference only on desktop", () => {
    expect(chromeHiddenForLayout(true, false)).toBe(true);
    expect(chromeHiddenForLayout(false, false)).toBe(false);
    expect(shouldPersistChromePreference(false)).toBe(true);
  });
});
