import { describe, expect, test } from "bun:test";
import { InstancedMesh } from "three";

import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  CREEPER_COUNT,
  ZOMBIE_COUNT,
  createMinecraftMobs,
  setMinecraftMobsVisible,
  updateMinecraftMobs,
} from "../src/MinecraftMobs";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

const payload = voxelPayload as unknown as VoxelPayload;

describe("Minecraft roaming mobs", () => {
  test("builds three creepers and four zombies in one draw call", () => {
    const field = createMinecraftMobs(payload, false);

    expect(field.creeperCount).toBe(CREEPER_COUNT);
    expect(field.zombieCount).toBe(ZOMBIE_COUNT);
    expect(field.mobs).toHaveLength(CREEPER_COUNT + ZOMBIE_COUNT);
    expect(field.mesh).toBeInstanceOf(InstancedMesh);
    expect(field.group.children).toHaveLength(1);
    expect(field.mesh.count).toBe(field.parts.length);
    expect(field.mesh.count).toBeLessThan(90);
    expect(
      field.parts.filter((part) => part.color === 0x18251b).length,
    ).toBeGreaterThanOrEqual(20);
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
      expect(
        Math.hypot(mob.x - starts[index][0], mob.z - starts[index][1]),
      ).toBeGreaterThan(0.1);
    });
    expect(field.mesh.count).toBe(field.parts.length);
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
});
