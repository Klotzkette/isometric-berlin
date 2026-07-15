import { describe, expect, test } from "bun:test";

import { isVisualMode, resolveInitialVisualMode } from "../src/visualMode";

describe("visual mode boot behaviour", () => {
  test("defaults to Day on a fresh load with no theme request", () => {
    // v0.5.4: Day mode must be active on every (re)load. The previously
    // selected mode is deliberately never restored, so with no explicit
    // request the boot mode is always Day.
    expect(resolveInitialVisualMode(null)).toBe("day");
    expect(resolveInitialVisualMode("")).toBe("day");
    expect(resolveInitialVisualMode("garbage")).toBe("day");
  });

  test("does not restore night or minecraft without an explicit request", () => {
    // Even values that are otherwise valid persisted modes are ignored
    // unless they arrive as an explicit ?theme= request.
    expect(resolveInitialVisualMode(undefined as unknown as string)).toBe("day");
  });

  test("honours a deliberate ?theme= request", () => {
    expect(resolveInitialVisualMode("day")).toBe("day");
    expect(resolveInitialVisualMode("night")).toBe("night");
    expect(resolveInitialVisualMode("minecraft")).toBe("minecraft");
  });

  test("recognises exactly the three supported modes", () => {
    expect(isVisualMode("day")).toBe(true);
    expect(isVisualMode("night")).toBe(true);
    expect(isVisualMode("minecraft")).toBe(true);
    expect(isVisualMode("sepia")).toBe(false);
    expect(isVisualMode(null)).toBe(false);
  });
});
