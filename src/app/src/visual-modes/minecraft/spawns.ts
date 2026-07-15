export type SpawnCategory =
  | "village"
  | "tent"
  | "field"
  | "npc"
  | "animal"
  | "boat";

export type DecorativeSpawn = {
  category: SpawnCategory;
  delayMs: number;
  id: string;
  scale: number;
  variant: number;
  x: number;
  y: number;
};

export type SpawnPlanOptions = {
  averageFrameMs: number;
  dayOfWeek: number;
  devicePixelRatio: number;
  elapsedMs: number;
  zoomBucket: number;
};

export const MAX_DECORATIVE_SPRITES = 220;

export const SPAWN_SCHEDULE = {
  village: 20_000,
  tent: 30_000,
  field: 40_000,
  npc: 55_000,
  animal: 55_000,
  boat: 75_000,
} as const;

const CATEGORY_COUNTS: Record<SpawnCategory, number> = {
  village: 30,
  tent: 12,
  field: 12,
  npc: 36,
  animal: 12,
  boat: 4,
};

const CATEGORY_ZONES: Record<SpawnCategory, readonly [number, number, number, number][]> = {
  village: [[4, 18, 26, 70], [80, 94, 24, 68]],
  tent: [[7, 20, 70, 82], [78, 92, 16, 30]],
  field: [[3, 18, 42, 74], [82, 96, 40, 72]],
  npc: [[10, 26, 20, 84], [74, 90, 18, 82]],
  animal: [[5, 20, 36, 75], [80, 95, 34, 74]],
  boat: [[26, 72, 47, 57]],
};

export function stableSpawnSeed(
  zoomBucket: number,
  dayOfWeek: number,
): number {
  let value = 0x811c9dc5;
  for (const character of `berlin:${zoomBucket}:${dayOfWeek}`) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}
function randomGenerator(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function enabledCategories(options: SpawnPlanOptions): SpawnCategory[] {
  const order: SpawnCategory[] = [
    "village",
    "tent",
    "field",
    "npc",
    "animal",
    "boat",
  ];
  return order.filter((category) => {
    if (options.elapsedMs < SPAWN_SCHEDULE[category]) {
      return false;
    }
    if (
      (options.devicePixelRatio < 2 || options.averageFrameMs > 20) &&
      (category === "npc" || category === "animal" || category === "boat")
    ) {
      return false;
    }
    return true;
  });
}

export function buildSpawnPlan(options: SpawnPlanOptions): DecorativeSpawn[] {
  const seed = stableSpawnSeed(options.zoomBucket, options.dayOfWeek);
  const random = randomGenerator(seed);
  const spawns: DecorativeSpawn[] = [];
  for (const category of enabledCategories(options)) {
    const zones = CATEGORY_ZONES[category];
    for (let index = 0; index < CATEGORY_COUNTS[category]; index += 1) {
      const zone = zones[index % zones.length];
      const [minX, maxX, minY, maxY] = zone;
      spawns.push({
        category,
        delayMs: Math.round(random() * 900),
        id: `${category}-${index}-${seed.toString(16)}`,
        scale: 0.78 + random() * 0.44,
        variant: Math.floor(random() * 6),
        x: minX + random() * (maxX - minX),
        y: minY + random() * (maxY - minY),
      });
    }
  }
  return spawns.slice(0, MAX_DECORATIVE_SPRITES);
}
