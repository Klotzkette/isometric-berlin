import { describe, expect, test } from "bun:test";
import { InstancedMesh } from "three";

import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  CREEPER_COUNT,
  MINECRAFT_MOB_BUDGETS,
  SKELETON_COUNT,
  ZOMBIE_COUNT,
  createMinecraftMobs,
  setMinecraftMobsVisible,
  updateMinecraftMobs,
} from "../src/MinecraftMobs";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  HOLOCAUST_FIELD,
  HOLOCAUST_MINECRAFT_PROTECTION,
  isHolocaustMinecraftProtectedAt,
} from "../src/holocaustField";

const payload = voxelPayload as unknown as VoxelPayload;

const compactWalkabilityFixture: VoxelPayload = {
  schema_version: 2,
  cell_m: 4,
  classes: ["grass", "concrete"],
  grid: { cols: 4, min_x_idx: 0, min_z_idx: 0, rows: 3 },
  ground_height: {
    cols: 4,
    rows: 3,
    stride_cells: 1,
    y_dm: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  ground_rows: [
    [[0, 4, 0]],
    [[0, 4, 0]],
    [[0, 4, 0]],
  ],
  building_rows: [
    [[1, 2, 0, 40, 1]],
    [],
    [[0, 1, 0, 40, 1]],
  ],
  tree_rows: [[], [], []],
  water_top_y_m: -1.15,
};

describe("Minecraft roaming mobs", () => {
  test("builds a sparse mix of creepers, skeletons and zombies in one draw call", () => {
    const field = createMinecraftMobs(payload, false);

    expect(field.creeperCount).toBe(CREEPER_COUNT);
    expect(field.skeletonCount).toBe(SKELETON_COUNT);
    expect(field.zombieCount).toBe(ZOMBIE_COUNT);
    expect(field.creeperCount).toBe(4);
    expect(field.skeletonCount).toBe(3);
    expect(field.zombieCount).toBe(6);
    expect(field.mobs).toHaveLength(
      CREEPER_COUNT + SKELETON_COUNT + ZOMBIE_COUNT,
    );
    expect(field.mesh).toBeInstanceOf(InstancedMesh);
    expect(field.group.children).toHaveLength(1);
    expect(field.mesh.count).toBe(field.parts.length);
    expect(field.mesh.count).toBeLessThan(170);
    expect(field.mobs.filter(({ kind }) => kind === "skeleton")).toHaveLength(3);
    expect(
      field.parts.filter((part) => part.color === 0xd9d8c8).length,
    ).toBeGreaterThanOrEqual(24);
    expect(
      field.parts.filter((part) => part.color === 0x76502f).length,
    ).toBe(9);
    expect(
      field.parts.filter((part) => part.color === 0x18251b).length,
    ).toBeGreaterThanOrEqual(30);
  });

  test("uses a smaller but still zombie-richer one-draw-call mobile cast", () => {
    const field = createMinecraftMobs(payload, false, "mobile");
    const budget = MINECRAFT_MOB_BUDGETS.mobile;

    expect(field.creeperCount).toBe(budget.creeper);
    expect(field.skeletonCount).toBe(budget.skeleton);
    expect(field.zombieCount).toBe(budget.zombie);
    expect(field.zombieCount).toBeGreaterThan(4);
    expect(field.mobs).toHaveLength(
      budget.creeper + budget.skeleton + budget.zombie,
    );
    expect(field.group.children).toHaveLength(1);
    expect(field.mesh.count).toBeLessThan(140);
  });

  test("spawns and keeps every walker on open park grass", () => {
    const field = createMinecraftMobs(payload, false);
    setMinecraftMobsVisible(field, true);
    const starts = field.mobs.map(({ x, z }) => [x, z] as const);

    for (let step = 0; step < 240; step += 1) {
      updateMinecraftMobs(field, 0.1);
    }

    field.mobs.forEach((mob, index) => {
      expect(field.isWalkable(mob.x, mob.z)).toBe(true);
      expect(isHolocaustMinecraftProtectedAt(mob.x, mob.z)).toBe(false);
      expect(
        Math.hypot(mob.x - starts[index][0], mob.z - starts[index][1]),
      ).toBeGreaterThan(0.1);
    });
    expect(field.mesh.count).toBe(field.parts.length);
  });

  test("keeps the rotated Holocaust field and its safety edge mob-free", () => {
    const field = createMinecraftMobs(payload, false);
    const [centreX, centreZ] =
      HOLOCAUST_MINECRAFT_PROTECTION.centreWorldM;
    const sine = Math.sin(HOLOCAUST_MINECRAFT_PROTECTION.rotationY);
    const cosine = Math.cos(HOLOCAUST_MINECRAFT_PROTECTION.rotationY);
    const toWorld = (localX: number, localZ: number): [number, number] => [
      centreX + cosine * localX + sine * localZ,
      centreZ - sine * localX + cosine * localZ,
    ];
    const protectedSamples = [
      toWorld(0, 0),
      toWorld(HOLOCAUST_FIELD.siteWidth / 2 + 7.9, 0),
      toWorld(0, HOLOCAUST_FIELD.siteDepth / 2 + 7.9),
      toWorld(
        HOLOCAUST_FIELD.siteWidth / 2 + 7.9,
        HOLOCAUST_FIELD.siteDepth / 2 + 7.9,
      ),
    ];
    for (const [x, z] of protectedSamples) {
      expect(isHolocaustMinecraftProtectedAt(x, z)).toBe(true);
      expect(field.isWalkable(x, z)).toBe(false);
    }
    const outside = toWorld(HOLOCAUST_FIELD.siteWidth / 2 + 8.1, 0);
    expect(isHolocaustMinecraftProtectedAt(...outside)).toBe(false);

    setMinecraftMobsVisible(field, true);
    for (let step = 0; step < 1_200; step += 1) {
      updateMinecraftMobs(field, 0.1);
    }
    expect(
      field.mobs.every(
        ({ x, z }) => !isHolocaustMinecraftProtectedAt(x, z),
      ),
    ).toBe(true);
  });

  test("omits decorative mobs when a reduced payload has no safe grass", () => {
    const noGrass: VoxelPayload = {
      ...compactWalkabilityFixture,
      ground_rows: compactWalkabilityFixture.ground_rows.map((row) =>
        row.map(([start, run]) => [start, run, 1]),
      ),
    };
    const field = createMinecraftMobs(noGrass, false);
    expect(field.mobs).toHaveLength(0);
    expect(field.mesh.count).toBe(0);
    expect(field.creeperCount + field.skeletonCount + field.zombieCount).toBe(0);
  });

  test("only exposes the field when Minecraft presentation requests it", () => {
    const field = createMinecraftMobs(payload, false);

    expect(field.group.visible).toBe(false);
    expect(setMinecraftMobsVisible(field, true)).toBe(true);
    expect(field.group.visible).toBe(true);
    expect(setMinecraftMobsVisible(field, true)).toBe(false);
    expect(setMinecraftMobsVisible(field, false)).toBe(true);
    expect(field.group.visible).toBe(false);
  });

  test("reads compact building runs directly with legacy-identical walkability", async () => {
    const legacyFixture: VoxelPayload = {
      ...compactWalkabilityFixture,
      building_rows: undefined,
      buildings: [
        [1, 0, 0, 40, 1],
        [2, 0, 0, 40, 1],
        [0, 2, 0, 40, 1],
      ],
    };
    const compact = createMinecraftMobs(compactWalkabilityFixture, false);
    const legacy = createMinecraftMobs(legacyFixture, false);
    for (let zOffset = 0; zOffset < 3; zOffset += 1) {
      for (let xOffset = 0; xOffset < 4; xOffset += 1) {
        const x = (xOffset + 0.5) * compactWalkabilityFixture.cell_m;
        const z = (zOffset + 0.5) * compactWalkabilityFixture.cell_m;
        expect(compact.isWalkable(x, z)).toBe(legacy.isWalkable(x, z));
      }
    }
    expect(compact.isWalkable(6, 2)).toBe(false);
    expect(compact.isWalkable(10, 2)).toBe(false);
    expect(compact.isWalkable(2, 10)).toBe(false);
    expect(compact.isWalkable(14, 10)).toBe(true);

    const source = await Bun.file(
      new URL("../src/MinecraftMobs.ts", import.meta.url),
    ).text();
    expect(source).toContain("payload.building_rows.forEach");
    expect(source).not.toContain("decodeVoxelBuildingColumns");
  });
});
