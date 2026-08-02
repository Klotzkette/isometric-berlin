import { describe, expect, test } from "bun:test";

import {
  INTERACTION_COALESCE_MS,
  nextPixelRatioMode,
  nextSettledDetailMode,
  PIXEL_RATIO_DOWNGRADE_HOLD_MS,
  PIXEL_RATIO_UPGRADE_HOLD_MS,
  SETTLED_DETAIL_DROP_HOLD_MS,
  SETTLED_DETAIL_RESTORE_HOLD_MS,
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

  test("keeps the desktop interaction step small enough to hide", () => {
    // One switch per gesture is still one visible resample, so the two desktop
    // tiers have to land close together. A 1080p HiDPI canvas is the case the
    // flicker was reported on.
    const settings = { coarsePointer: false, devicePixelRatio: 2, height: 1080, width: 1920 };
    const interacting = renderPixelRatio({ ...settings, interacting: true });
    const settled = renderPixelRatio({ ...settings, interacting: false });
    expect(interacting / settled).toBeGreaterThan(0.9);
  });

  test("still cuts the interaction cost on a 4K canvas", () => {
    const settings = { coarsePointer: false, devicePixelRatio: 2, height: 2160, width: 3840 };
    const interacting = renderPixelRatio({ ...settings, interacting: true });
    const settled = renderPixelRatio({ ...settings, interacting: false });
    expect(interacting).toBeLessThan(settled);
  });

  test("leaves the phone tiers alone", () => {
    const settings = { coarsePointer: true, devicePixelRatio: 3, height: 844, width: 390 };
    expect(renderPixelRatio({ ...settings, interacting: true })).toBe(1);
    expect(renderPixelRatio({ ...settings, interacting: false })).toBe(2);
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

  test("a back-and-forth drag costs one downgrade and one upgrade", () => {
    // The v0.51.0 report case: bursts of input with short pauses between them,
    // which is what "hin und her bewegen" actually looks like at the event
    // level. Every pause used to outlast the restore hold, so the canvas swapped
    // resolution roughly once per second for as long as the user kept moving.
    const frames: Array<{ inputActive: boolean; nowMs: number }> = [];
    for (let t = 0; t <= 8000; t += 16) {
      frames.push({ inputActive: t % 1000 < 600, nowMs: t });
    }
    for (let t = 8016; t <= 12000; t += 16) {
      frames.push({ inputActive: false, nowMs: t });
    }
    expect(run(frames)).toEqual({ applied: false, switches: 2 });
  });

  test("the restore hold outlasts the pauses inside a gesture", () => {
    // 400 ms is a generous direction change; anything at or below it has to
    // stay inside one interaction.
    expect(PIXEL_RATIO_UPGRADE_HOLD_MS).toBeGreaterThan(400);
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

describe("settled detail tier", () => {
  const run = (frames: Array<{ moving: boolean; nowMs: number }>) => {
    let applied = false;
    let movingSince: number | null = null;
    let stillSince: number | null = 0;
    let switches = 0;
    for (const frame of frames) {
      if (frame.moving) {
        movingSince ??= frame.nowMs;
        stillSince = null;
      } else {
        stillSince ??= frame.nowMs;
        movingSince = null;
      }
      const next = nextSettledDetailMode({
        activeSinceMs: movingSince,
        applied,
        idleSinceMs: stillSince,
        inputActive: frame.moving,
        nowMs: frame.nowMs,
      });
      if (next !== applied) {
        switches += 1;
      }
      applied = next;
    }
    return { applied, switches };
  };

  test("a single rotate step never drops the microcrowns", () => {
    // One click eases the camera for about a quarter of a second; the tier has
    // to sit that out or the whole canopy blinks for every step.
    const frames: Array<{ moving: boolean; nowMs: number }> = [];
    for (let t = 0; t < SETTLED_DETAIL_DROP_HOLD_MS - 20; t += 16) {
      frames.push({ moving: true, nowMs: t });
    }
    for (let t = SETTLED_DETAIL_DROP_HOLD_MS; t <= 4000; t += 16) {
      frames.push({ moving: false, nowMs: t });
    }
    expect(run(frames)).toEqual({ applied: false, switches: 0 });
  });

  test("a sustained zoom costs one drop and one restore, not a blink per tick", () => {
    const frames: Array<{ moving: boolean; nowMs: number }> = [];
    // cameraMoving flaps while a wheel dolly plays out: settle timers and the
    // stabiliser each release on their own frame.
    for (let t = 0; t < 4000; t += 16) {
      frames.push({ moving: t % 650 > 50, nowMs: t });
    }
    for (let t = 4000; t <= 8000; t += 16) {
      frames.push({ moving: false, nowMs: t });
    }
    expect(run(frames)).toEqual({ applied: false, switches: 2 });
  });

  test("a back-and-forth drag never blinks the canopy", () => {
    const frames: Array<{ moving: boolean; nowMs: number }> = [];
    for (let t = 0; t <= 8000; t += 16) {
      frames.push({ moving: t % 1000 < 600, nowMs: t });
    }
    for (let t = 8016; t <= 12000; t += 16) {
      frames.push({ moving: false, nowMs: t });
    }
    expect(run(frames)).toEqual({ applied: false, switches: 2 });
  });

  test("restoring the detail waits longer than the camera keeps easing", () => {
    expect(
      nextSettledDetailMode({
        activeSinceMs: null,
        applied: true,
        idleSinceMs: 1000,
        inputActive: false,
        nowMs: 1000 + SETTLED_DETAIL_RESTORE_HOLD_MS - 1,
      }),
    ).toBe(true);
    expect(
      nextSettledDetailMode({
        activeSinceMs: null,
        applied: true,
        idleSinceMs: 1000,
        inputActive: false,
        nowMs: 1000 + SETTLED_DETAIL_RESTORE_HOLD_MS,
      }),
    ).toBe(false);
  });
});
