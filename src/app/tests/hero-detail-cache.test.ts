import { describe, expect, test } from "bun:test";
import {
  type HeroCacheCandidate,
  heroDetailEvictions,
} from "../src/heroDetailCache";

describe("hero detail cache", () => {
  test("stays bounded through 100 mobile landmark selections", () => {
    const names = ["Reichstag", "Kanzleramt", "Hauptbahnhof", "Brandenburger Tor"];
    const cache = new Map<string, HeroCacheCandidate>();

    for (let index = 0; index < 100; index += 1) {
      const name = names[index % names.length];
      cache.set(name, { lastUsed: index, loading: false, name });
      for (const eviction of heroDetailEvictions([...cache.values()], name, 1)) {
        cache.delete(eviction);
      }
      expect(cache.size).toBeLessThanOrEqual(1);
      expect(cache.has(name)).toBe(true);
    }
  });

  test("does not evict active or in-flight details", () => {
    const entries: HeroCacheCandidate[] = [
      { lastUsed: 1, loading: false, name: "old" },
      { lastUsed: 2, loading: true, name: "loading" },
      { lastUsed: 3, loading: false, name: "active" },
    ];

    expect(heroDetailEvictions(entries, "active", 1)).toEqual(["old"]);
  });
});
