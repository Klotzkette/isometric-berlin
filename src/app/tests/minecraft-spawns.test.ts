import { describe, expect, test } from "bun:test";

import {
  MAX_DECORATIVE_SPRITES,
  SPAWN_SCHEDULE,
  buildSpawnPlan,
} from "../src/visual-modes/minecraft/spawns";

const options = {
  averageFrameMs: 16.7,
  dayOfWeek: 3,
  devicePixelRatio: 3,
  zoomBucket: 8,
};

describe("Minecraft decorative life scheduler", () => {
  test("advances through every continuous-dwell stage", () => {
    expect(buildSpawnPlan({ ...options, elapsedMs: 19_999 })).toHaveLength(0);
    expect(
      new Set(
        buildSpawnPlan({ ...options, elapsedMs: SPAWN_SCHEDULE.village }).map(
          (spawn) => spawn.category,
        ),
      ),
    ).toEqual(new Set(["village"]));
    expect(
      new Set(
        buildSpawnPlan({ ...options, elapsedMs: SPAWN_SCHEDULE.boat }).map(
          (spawn) => spawn.category,
        ),
      ),
    ).toEqual(
      new Set(["village", "tent", "field", "npc", "animal", "boat"]),
    );
  });

  test("is deterministic and stays below the density budget", () => {
    const first = buildSpawnPlan({ ...options, elapsedMs: 120_000 });
    const second = buildSpawnPlan({ ...options, elapsedMs: 120_000 });
    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(MAX_DECORATIVE_SPRITES);
    expect(first.every((spawn) => spawn.x < 46 || spawn.x > 54 || spawn.category === "boat")).toBe(
      true,
    );
  });

  test("drops motion-heavy categories on slow or low-density screens", () => {
    const constrained = buildSpawnPlan({
      ...options,
      averageFrameMs: 24,
      devicePixelRatio: 1,
      elapsedMs: 120_000,
    });
    const categories = new Set(constrained.map((spawn) => spawn.category));
    expect(categories.has("village")).toBe(true);
    expect(categories.has("field")).toBe(true);
    expect(categories.has("npc")).toBe(false);
    expect(categories.has("animal")).toBe(false);
    expect(categories.has("boat")).toBe(false);
  });
});
