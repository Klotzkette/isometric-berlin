import { describe, expect, test } from "bun:test";

import {
  INTERACTION_COALESCE_MS,
  nextPixelRatioMode,
  PIXEL_RATIO_DOWNGRADE_HOLD_MS,
  PIXEL_RATIO_UPGRADE_HOLD_MS,
  renderInteractionActive,
  renderPixelRatio,
} from "../src/renderQuality";

describe("adaptive 3D render quality", () => {
  test("treats OrbitControls, direct touch and trackpad input as interaction", () => {
    expect(
      renderInteractionActive({ controls: true, touch: false, wheel: false }),
    ).toBe(true);
    expect(
      renderInteractionActive({ controls: false, touch: true, wheel: false }),
    ).toBe(true);
    expect(
      renderInteractionActive({ controls: false, touch: false, wheel: true }),
    ).toBe(true);
    expect(
      renderInteractionActive({ controls: false, touch: false, wheel: false }),
    ).toBe(false);
  });

  test("raises settled phone detail without exceeding the mobile cap", () => {
    expect(
      renderPixelRatio({
        coarsePointer: true,
        devicePixelRatio: 3,
        height: 844,
        interacting: false,
        width: 390,
      }),
    ).toBe(2);
  });

  test("drops interaction resolution for smooth touch movement", () => {
    expect(
      renderPixelRatio({
        coarsePointer: true,
        devicePixelRatio: 3,
        height: 844,
        interacting: true,
        width: 390,
      }),
    ).toBe(1);
  });

  test("bounds large desktop canvases by a fixed pixel budget", () => {
    const ratio = renderPixelRatio({
      coarsePointer: false,
      devicePixelRatio: 2.5,
      height: 2160,
      interacting: false,
      width: 3840,
    });
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(3840 * 2160 * ratio ** 2).toBeLessThanOrEqual(11_600_000);
  });
});

/**
 * A mouse wheel is not a continuous gesture: OrbitControls fires start and end
 * for every tick, so switching resolution off the raw flag swapped the whole
 * canvas between the interaction and settled pixel ratios twice per tick. That
 * is the flicker users saw while zooming on a HiDPI screen.
 */
describe("zoom-stable pixel-ratio governor", () => {
  const run = (
    events: Array<{ inputActive: boolean; nowMs: number }>,
  ): { applied: boolean; switches: number } => {
    let applied = false;
    let activeSinceMs: number | null = null;
    let idleSinceMs: number | null = 0;
    let switches = 0;
    for (const { inputActive, nowMs } of events) {
      if (inputActive) {
        activeSinceMs ??= nowMs;
        idleSinceMs = null;
      } else {
        idleSinceMs ??= nowMs;
        activeSinceMs = null;
      }
      const next = nextPixelRatioMode({
        activeSinceMs,
        applied,
        idleSinceMs,
        inputActive,
        nowMs,
      });
      if (next !== applied) {
        switches += 1;
        applied = next;
      }
    }
    return { applied, switches };
  };

  test("never downgrades for input shorter than the coalescing window", () => {
    expect(PIXEL_RATIO_DOWNGRADE_HOLD_MS).toBeGreaterThan(INTERACTION_COALESCE_MS);
  });

  test("a single wheel tick costs no resolution switch at all", () => {
    const frames: Array<{ inputActive: boolean; nowMs: number }> = [];
    for (let t = 0; t <= 2000; t += 16) {
      frames.push({ inputActive: t < INTERACTION_COALESCE_MS, nowMs: t });
    }
    expect(run(frames)).toEqual({ applied: false, switches: 0 });
  });

  test("a whole zoom run costs one downgrade and one upgrade", () => {
    const frames: Array<{ inputActive: boolean; nowMs: number }> = [];
    // Ticks every 130 ms for three seconds: each one extends the deadline, so
    // the governor sees a single sustained interaction, not 23 separate ones.
    for (let t = 0; t <= 3000; t += 16) {
      frames.push({ inputActive: true, nowMs: t });
    }
    for (let t = 3016; t <= 6000; t += 16) {
      frames.push({ inputActive: false, nowMs: t });
    }
    expect(run(frames)).toEqual({ applied: false, switches: 2 });
  });

  test("restoring full resolution waits for input to really stop", () => {
    let applied = true;
    const idleSinceMs = 1000;
    for (const elapsed of [0, PIXEL_RATIO_UPGRADE_HOLD_MS - 1]) {
      applied = nextPixelRatioMode({
        activeSinceMs: null,
        applied: true,
        idleSinceMs,
        inputActive: false,
        nowMs: idleSinceMs + elapsed,
      });
      expect(applied).toBe(true);
    }
    expect(
      nextPixelRatioMode({
        activeSinceMs: null,
        applied: true,
        idleSinceMs,
        inputActive: false,
        nowMs: idleSinceMs + PIXEL_RATIO_UPGRADE_HOLD_MS,
      }),
    ).toBe(false);
  });
});
