import { describe, expect, test } from "bun:test";

import {
  MODE_FADE_MS,
  MinecraftLifecycleController,
  type Scheduler,
  SpawnThresholdMemory,
} from "../src/visual-modes/minecraft/lifecycle";
import {
  BASE_SCALE_MIN,
  MAX_DECORATIVE_SPRITES,
  SPAWN_SCHEDULE,
  SPRITE_SIZE_MULTIPLIER,
} from "../src/visual-modes/minecraft/spawns";

/**
 * Deterministic replacement for the browser clock. Every handle the spawn
 * system creates lives in these maps, so `pendingHandleCount` is an exact
 * leak detector.
 */
class ManualScheduler implements Scheduler {
  private currentTime = 0;
  private nextHandle = 1;
  private readonly frames = new Map<number, (timestamp: number) => void>();
  private readonly intervals = new Map<
    number,
    { callback: () => void; intervalMs: number; nextAt: number }
  >();
  private readonly timeouts = new Map<
    number,
    { at: number; callback: () => void }
  >();

  readonly cancelAnimationFrame = (handle: number): void => {
    this.frames.delete(handle);
  };

  readonly clearInterval = (handle: number): void => {
    this.intervals.delete(handle);
  };

  readonly clearTimeout = (handle: number): void => {
    this.timeouts.delete(handle);
  };

  readonly now = (): number => this.currentTime;

  readonly requestAnimationFrame = (
    callback: (timestamp: number) => void,
  ): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.frames.set(handle, callback);
    return handle;
  };

  readonly setInterval = (callback: () => void, intervalMs: number): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.intervals.set(handle, {
      callback,
      intervalMs,
      nextAt: this.currentTime + intervalMs,
    });
    return handle;
  };

  readonly setTimeout = (callback: () => void, delayMs: number): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.timeouts.set(handle, { at: this.currentTime + delayMs, callback });
    return handle;
  };

  get pendingHandleCount(): number {
    return this.frames.size + this.intervals.size + this.timeouts.size;
  }

  advance(ms: number): void {
    const target = this.currentTime + ms;
    for (;;) {
      let dueAt = Number.POSITIVE_INFINITY;
      let dueTimeout: number | null = null;
      let dueInterval: number | null = null;
      for (const [handle, entry] of this.timeouts) {
        if (entry.at <= target && entry.at < dueAt) {
          dueAt = entry.at;
          dueTimeout = handle;
          dueInterval = null;
        }
      }
      for (const [handle, entry] of this.intervals) {
        if (entry.nextAt <= target && entry.nextAt < dueAt) {
          dueAt = entry.nextAt;
          dueInterval = handle;
          dueTimeout = null;
        }
      }
      if (dueTimeout === null && dueInterval === null) {
        break;
      }
      this.currentTime = dueAt;
      if (dueTimeout !== null) {
        const entry = this.timeouts.get(dueTimeout);
        this.timeouts.delete(dueTimeout);
        entry?.callback();
      } else if (dueInterval !== null) {
        const entry = this.intervals.get(dueInterval);
        if (entry) {
          entry.nextAt = this.currentTime + entry.intervalMs;
          entry.callback();
        }
      }
    }
    this.currentTime = target;
  }
}

function createController() {
  const scheduler = new ManualScheduler();
  const memory = new SpawnThresholdMemory();
  const controller = new MinecraftLifecycleController({ memory, scheduler });
  controller.setEnvironment({
    dayOfWeek: 3,
    devicePixelRatio: 3,
    zoomBucket: 8,
  });
  return { controller, memory, scheduler };
}

function categoriesOf(controller: MinecraftLifecycleController): Set<string> {
  return new Set(controller.getState().spawns.map((spawn) => spawn.category));
}

describe("Minecraft lifecycle controller", () => {
  test("day → minecraft → day → minecraft restores the identical category set and seeded positions", () => {
    const { controller, scheduler } = createController();

    controller.setMode("minecraft");
    scheduler.advance(SPAWN_SCHEDULE.field + 500);
    const firstVisit = controller.getState().spawns;
    expect(categoriesOf(controller)).toEqual(
      new Set(["village", "tent", "field"]),
    );

    controller.setMode("day");
    scheduler.advance(MODE_FADE_MS);
    expect(controller.getState().phase).toBe("hidden");
    expect(controller.getState().spawns).toHaveLength(0);
    scheduler.advance(5_000);

    controller.setMode("minecraft");
    // Reached categories reappear immediately, before any new dwell time.
    expect(controller.getState().spawns).toEqual(firstVisit);
    expect(categoriesOf(controller)).toEqual(
      new Set(["village", "tent", "field"]),
    );

    // Unreached categories still follow the documented schedule from zero.
    scheduler.advance(SPAWN_SCHEDULE.npc - 500);
    expect(categoriesOf(controller).has("npc")).toBe(false);
    scheduler.advance(500);
    expect(categoriesOf(controller).has("npc")).toBe(true);
    expect(categoriesOf(controller).has("animal")).toBe(true);
    expect(categoriesOf(controller).has("boat")).toBe(false);
    scheduler.advance(SPAWN_SCHEDULE.boat - SPAWN_SCHEDULE.npc);
    expect(categoriesOf(controller).has("boat")).toBe(true);
  });

  test("restarts the dwell schedule at zero when no threshold was reached", () => {
    const { controller, scheduler } = createController();

    controller.setMode("minecraft");
    scheduler.advance(10_000);
    expect(controller.getState().spawns).toHaveLength(0);
    controller.setMode("day");
    scheduler.advance(MODE_FADE_MS + 1_000);

    controller.setMode("minecraft");
    expect(controller.getState().spawns).toHaveLength(0);
    scheduler.advance(SPAWN_SCHEDULE.village - 500);
    expect(controller.getState().spawns).toHaveLength(0);
    scheduler.advance(500);
    expect(categoriesOf(controller)).toEqual(new Set(["village"]));
  });

  test("switching to day removes every decoration and clears every timer handle", () => {
    const { controller, scheduler } = createController();

    controller.setMode("minecraft");
    scheduler.advance(SPAWN_SCHEDULE.village + 500);
    expect(controller.getState().spawns.length).toBeGreaterThan(0);
    expect(controller.activeTimerHandleCount).toBeGreaterThan(0);

    controller.setMode("day");
    // During the bounded fade only the fade timeout may remain.
    expect(controller.getState().phase).toBe("leaving");
    expect(controller.getState().announcedCategory).toBeNull();
    expect(controller.activeTimerHandleCount).toBe(1);

    scheduler.advance(MODE_FADE_MS);
    expect(controller.getState().phase).toBe("hidden");
    expect(controller.getState().spawns).toHaveLength(0);
    expect(controller.activeTimerHandleCount).toBe(0);
    expect(scheduler.pendingHandleCount).toBe(0);

    // Long after leaving, nothing wakes back up.
    scheduler.advance(120_000);
    expect(controller.getState().spawns).toHaveLength(0);
    expect(scheduler.pendingHandleCount).toBe(0);
  });

  test("dispose tears everything down immediately without a fade", () => {
    const { controller, scheduler } = createController();

    controller.setMode("minecraft");
    scheduler.advance(SPAWN_SCHEDULE.tent + 500);
    controller.dispose();
    expect(controller.getState().phase).toBe("hidden");
    expect(controller.getState().spawns).toHaveLength(0);
    expect(controller.activeTimerHandleCount).toBe(0);
    expect(scheduler.pendingHandleCount).toBe(0);
  });

  test("keeps the density budget at or below 220 after repeated toggles", () => {
    const { controller, scheduler } = createController();

    for (let round = 0; round < 5; round += 1) {
      controller.setMode("minecraft");
      scheduler.advance(SPAWN_SCHEDULE.boat + 5_000);
      const spawns = controller.getState().spawns;
      expect(spawns.length).toBeGreaterThan(0);
      expect(spawns.length).toBeLessThanOrEqual(MAX_DECORATIVE_SPRITES);
      const ids = new Set(spawns.map((spawn) => spawn.id));
      expect(ids.size).toBe(spawns.length);
      // The ~40 % render-size boost applies to every spawned sprite.
      for (const spawn of spawns) {
        expect(spawn.scale).toBeGreaterThanOrEqual(
          BASE_SCALE_MIN * SPRITE_SIZE_MULTIPLIER,
        );
      }
      controller.setMode("day");
      scheduler.advance(MODE_FADE_MS);
      expect(controller.getState().spawns).toHaveLength(0);
    }

    // All categories were reached, so re-entry restores the full set at
    // once — still within budget with no duplicated sprites.
    controller.setMode("minecraft");
    const restored = controller.getState().spawns;
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.length).toBeLessThanOrEqual(MAX_DECORATIVE_SPRITES);
    expect(new Set(restored.map((spawn) => spawn.id)).size).toBe(
      restored.length,
    );
  });

  test("mode-switch fades are bounded by 200 ms and quick re-entry cancels the leave fade", () => {
    expect(MODE_FADE_MS).toBeLessThanOrEqual(200);
    const { controller, scheduler } = createController();

    controller.setMode("minecraft");
    expect(controller.getState().phase).toBe("entering");
    scheduler.advance(MODE_FADE_MS);
    expect(controller.getState().phase).toBe("active");

    scheduler.advance(SPAWN_SCHEDULE.village + 500);
    controller.setMode("day");
    expect(controller.getState().phase).toBe("leaving");
    scheduler.advance(MODE_FADE_MS - 1);
    expect(controller.getState().phase).toBe("leaving");
    expect(controller.getState().spawns.length).toBeGreaterThan(0);

    // Re-enter mid-fade: the leave fade is cancelled, spawns never drop.
    controller.setMode("minecraft");
    expect(controller.getState().phase).toBe("entering");
    expect(controller.getState().spawns.length).toBeGreaterThan(0);
    scheduler.advance(MODE_FADE_MS);
    expect(controller.getState().phase).toBe("active");
    expect(categoriesOf(controller).has("village")).toBe(true);
  });

  test("announces each category once per page load and resetSchedule forgets everything", () => {
    const { controller, memory, scheduler } = createController();

    controller.setMode("minecraft");
    scheduler.advance(SPAWN_SCHEDULE.village);
    expect(controller.getState().announcedCategory).toBe("village");
    scheduler.advance(4_000);
    expect(controller.getState().announcedCategory).toBeNull();

    controller.setMode("day");
    scheduler.advance(MODE_FADE_MS);
    controller.setMode("minecraft");
    // Restored categories are not re-announced.
    expect(controller.getState().announcedCategory).toBeNull();

    controller.resetSchedule();
    expect(memory.isReached("village")).toBe(false);
    expect(controller.getState().spawns).toHaveLength(0);
    scheduler.advance(SPAWN_SCHEDULE.village);
    expect(categoriesOf(controller)).toEqual(new Set(["village"]));
    expect(controller.getState().announcedCategory).toBe("village");
  });
});
