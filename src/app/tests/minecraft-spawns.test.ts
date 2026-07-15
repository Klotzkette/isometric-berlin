import { describe, expect, test } from "bun:test";

import {
  BASE_SCALE_MIN,
  BASE_SCALE_SPREAD,
  CATEGORY_COUNTS,
  MAX_DECORATIVE_SPRITES,
  SPAWN_CATEGORY_ORDER,
  SPAWN_SCHEDULE,
  SPRITE_SIZE_MULTIPLIER,
  buildSpawnPlan,
} from "../src/visual-modes/minecraft/spawns";
import { minecraftSpriteDataUri } from "../src/visual-modes/minecraft/sprites";

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

  test("uses the reduced npc/animal counts and keeps the other categories", () => {
    const plan = buildSpawnPlan({ ...options, elapsedMs: 120_000 });
    const counted = new Map<string, number>();
    for (const spawn of plan) {
      counted.set(spawn.category, (counted.get(spawn.category) ?? 0) + 1);
    }
    // Pinned after the ~30 % reduction (npc was 36, animal was 12).
    expect(CATEGORY_COUNTS.npc).toBe(25);
    expect(CATEGORY_COUNTS.animal).toBe(8);
    for (const category of SPAWN_CATEGORY_ORDER) {
      expect(counted.get(category)).toBe(CATEGORY_COUNTS[category]);
    }
    expect(plan.length).toBeLessThanOrEqual(MAX_DECORATIVE_SPRITES);
  });

  test("applies the ~40 % render-size multiplier to every category", () => {
    expect(SPRITE_SIZE_MULTIPLIER).toBe(1.4);
    const plan = buildSpawnPlan({ ...options, elapsedMs: 120_000 });
    expect(plan.length).toBeGreaterThan(0);
    const minScale = BASE_SCALE_MIN * SPRITE_SIZE_MULTIPLIER;
    const maxScale =
      (BASE_SCALE_MIN + BASE_SCALE_SPREAD) * SPRITE_SIZE_MULTIPLIER;
    for (const spawn of plan) {
      expect(spawn.scale).toBeGreaterThanOrEqual(minScale);
      expect(spawn.scale).toBeLessThanOrEqual(maxScale);
    }
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

describe("Minecraft sprite generator", () => {
  const variants = [0, 1, 2, 3, 4, 5];

  function decodedSvg(category: (typeof SPAWN_CATEGORY_ORDER)[number], variant: number): string {
    const uri = minecraftSpriteDataUri(category, variant);
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    return decodeURIComponent(uri.slice("data:image/svg+xml,".length));
  }

  test("emits only axis-aligned <rect> blocks — no paths, curves or gradients", () => {
    for (const category of SPAWN_CATEGORY_ORDER) {
      for (const variant of variants) {
        const svg = decodedSvg(category, variant);
        expect(svg).not.toContain("<path");
        expect(svg).not.toContain("<polygon");
        expect(svg).not.toContain("<polyline");
        expect(svg).not.toContain("<circle");
        expect(svg).not.toContain("<ellipse");
        expect(svg).not.toContain("Gradient");
        expect(svg).toContain("<rect");
        // Nothing but rects inside the svg element.
        const inner = svg.replace(/^<svg [^>]*>/, "").replace(/<\/svg>$/, "");
        expect(inner.replace(/<rect [^>]*\/>/g, "")).toBe("");
      }
    }
  });

  test("stays on a 16×16 pixel grid with crisp edges", () => {
    for (const category of SPAWN_CATEGORY_ORDER) {
      const svg = decodedSvg(category, 0);
      expect(svg).toContain('viewBox="0 0 16 16"');
      expect(svg).toContain('shape-rendering="crispEdges"');
      // Every rect coordinate is a whole pixel inside the 16×16 grid.
      for (const match of svg.matchAll(
        /x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g,
      )) {
        const [, x, y, width, height] = match.map(Number);
        expect(x + width).toBeLessThanOrEqual(16);
        expect(y + height).toBeLessThanOrEqual(16);
      }
    }
  });

  test("keeps the variant accent-colour system", () => {
    for (const category of SPAWN_CATEGORY_ORDER) {
      const uris = new Set(
        variants.map((variant) => minecraftSpriteDataUri(category, variant)),
      );
      expect(uris.size).toBe(variants.length);
      // Variants wrap around the palette.
      expect(minecraftSpriteDataUri(category, 6)).toBe(
        minecraftSpriteDataUri(category, 0),
      );
    }
  });
});
