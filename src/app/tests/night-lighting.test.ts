import { afterEach, describe, expect, test } from "bun:test";

import {
  NIGHT_LIGHTS_STORAGE_KEY,
  isNightLightsOnByUser,
  rememberNightLightsOn,
  resolveNightLightsOn,
  supportsNightLightsToggle,
} from "../src/nightLighting";

// bun test has no DOM by default (see responsive-layout.test.ts for the same
// constraint on window.matchMedia). nightLighting.ts intentionally reads
// window.localStorage directly, mirroring the untested-but-identical
// isMusicMutedByUser/rememberMusicMuted pair in App.tsx, so persistence is
// exercised here through a minimal in-memory stand-in.
class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

function withStubbedWindow<T>(
  localStorage: Pick<Storage, "getItem" | "setItem"> | undefined,
  run: () => T,
): T {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = localStorage
    ? { localStorage }
    : {
        get localStorage(): never {
          throw new Error("storage blocked");
        },
      };
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previous;
    }
  }
}

describe("night lights toggle support", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  test("only night mode supports the toggle", () => {
    expect(supportsNightLightsToggle("night")).toBe(true);
    expect(supportsNightLightsToggle("day")).toBe(false);
    expect(supportsNightLightsToggle("minecraft")).toBe(false);
  });

  test("day and Minecraft always resolve to lights-on regardless of preference", () => {
    expect(resolveNightLightsOn("day", false)).toBe(true);
    expect(resolveNightLightsOn("day", true)).toBe(true);
    expect(resolveNightLightsOn("minecraft", false)).toBe(true);
    expect(resolveNightLightsOn("minecraft", true)).toBe(true);
  });

  test("night mode passes the preference straight through", () => {
    expect(resolveNightLightsOn("night", true)).toBe(true);
    expect(resolveNightLightsOn("night", false)).toBe(false);
  });
});

describe("night lights persistence (mirrors music-mute contract)", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  test("defaults to on when nothing has ever been stored", () => {
    withStubbedWindow(new MemoryStorage(), () => {
      expect(isNightLightsOnByUser()).toBe(true);
    });
  });

  test("remembers an explicit off choice across reads", () => {
    withStubbedWindow(new MemoryStorage(), () => {
      rememberNightLightsOn(false);
      expect(isNightLightsOnByUser()).toBe(false);
      rememberNightLightsOn(true);
      expect(isNightLightsOnByUser()).toBe(true);
    });
  });

  test("writes under the documented storage key, as a plain boolean string", () => {
    const storage = new MemoryStorage();
    withStubbedWindow(storage, () => {
      rememberNightLightsOn(false);
    });
    expect(storage.getItem(NIGHT_LIGHTS_STORAGE_KEY)).toBe("false");
  });

  test("stays usable (defaults true) when storage throws", () => {
    withStubbedWindow(undefined, () => {
      expect(isNightLightsOnByUser()).toBe(true);
      // Must not throw even though every localStorage access blows up.
      expect(() => rememberNightLightsOn(false)).not.toThrow();
    });
  });
});
