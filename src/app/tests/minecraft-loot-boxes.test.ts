import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Vector3 } from "three";

import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  MINECRAFT_LOOT_BOX_BUDGETS,
  MINECRAFT_LOOT_BOX_EFFECT_SECONDS,
  createMinecraftLootBoxes,
  setMinecraftLootBoxesVisible,
  updateMinecraftLootBoxes,
} from "../src/MinecraftLootBoxes";
import { createMinecraftMobs } from "../src/MinecraftMobs";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { isHolocaustMinecraftProtectedAt } from "../src/holocaustField";

const payload = voxelPayload as unknown as VoxelPayload;

describe("Minecraft rare loot boxes", () => {
  test("keeps full and mobile boxes inside fixed two-draw-call budgets", () => {
    const navigation = createMinecraftMobs(payload, false);
    const full = createMinecraftLootBoxes(payload, navigation);
    const mobile = createMinecraftLootBoxes(payload, navigation, {
      detailProfile: "mobile",
    });

    expect(full.boxes).toHaveLength(MINECRAFT_LOOT_BOX_BUDGETS.full.boxCount);
    expect(mobile.boxes).toHaveLength(
      MINECRAFT_LOOT_BOX_BUDGETS.mobile.boxCount,
    );
    expect(full.group.children).toHaveLength(2);
    expect(mobile.group.children).toHaveLength(2);
    expect(full.boxMesh).toBeInstanceOf(InstancedMesh);
    expect(full.fireworkMesh).toBeInstanceOf(InstancedMesh);
    expect(full.fireworkMesh.geometry).toBe(full.boxMesh.geometry);
    expect(full.boxMesh.count).toBe(full.boxes.length * 4);
    expect(full.fireworkMesh.count).toBe(
      full.boxes.length * MINECRAFT_LOOT_BOX_BUDGETS.full.particlesPerBox,
    );
    expect(mobile.fireworkMesh.count).toBe(14);
    expect(mobile.fireworkMesh.count).toBeLessThan(full.fireworkMesh.count);
  });

  test("places every chest on safe grass outside the Holocaust field", () => {
    const navigation = createMinecraftMobs(payload, false);
    const field = createMinecraftLootBoxes(payload, navigation);

    for (const box of field.boxes) {
      expect(navigation.isWalkable(box.x, box.z)).toBe(true);
      expect(isHolocaustMinecraftProtectedAt(box.x, box.z)).toBe(false);
    }
  });

  test("opens once on touch, animates bounded fireworks and then goes idle", () => {
    const navigation = createMinecraftMobs(payload, false);
    const field = createMinecraftLootBoxes(payload, navigation, {
      detailProfile: "mobile",
    });
    const box = field.boxes[0];
    const lidBefore = new Matrix4();
    const lidAfter = new Matrix4();
    const positionBefore = new Vector3();
    const positionAfter = new Vector3();
    const fireworkMatrix = new Matrix4();
    const fireworkScale = new Vector3();
    field.boxMesh.getMatrixAt(2, lidBefore);
    positionBefore.setFromMatrixPosition(lidBefore);

    expect(setMinecraftLootBoxesVisible(field, true)).toBe(true);
    expect(
      updateMinecraftLootBoxes(
        field,
        { x: box.x, y: box.groundY + 1.8, z: box.z },
        0.1,
      ),
    ).toBe(true);
    expect(box.triggered).toBe(true);
    field.boxMesh.getMatrixAt(2, lidAfter);
    positionAfter.setFromMatrixPosition(lidAfter);
    expect(positionAfter.y).toBeGreaterThan(positionBefore.y);
    field.fireworkMesh.getMatrixAt(0, fireworkMatrix);
    fireworkScale.setFromMatrixScale(fireworkMatrix);
    expect(fireworkScale.length()).toBeGreaterThan(0);

    for (let step = 0; step < 20; step += 1) {
      updateMinecraftLootBoxes(
        field,
        { x: box.x + 100, y: box.groundY + 1.8, z: box.z + 100 },
        0.1,
      );
    }
    expect(box.effectSeconds).toBe(MINECRAFT_LOOT_BOX_EFFECT_SECONDS);
    field.fireworkMesh.getMatrixAt(0, fireworkMatrix);
    fireworkScale.setFromMatrixScale(fireworkMatrix);
    expect(fireworkScale.length()).toBe(0);
    expect(
      updateMinecraftLootBoxes(
        field,
        { x: box.x, y: box.groundY + 1.8, z: box.z },
        0.1,
      ),
    ).toBe(false);
  });

  test("does no collision work while the Minecraft layer is hidden", () => {
    const navigation = createMinecraftMobs(payload, false);
    const field = createMinecraftLootBoxes(payload, navigation);
    const box = field.boxes[0];

    expect(
      updateMinecraftLootBoxes(
        field,
        { x: box.x, y: box.groundY + 1.8, z: box.z },
        0.1,
      ),
    ).toBe(false);
    expect(box.triggered).toBe(false);
  });

  test("viewer wires boxes to the bounded Minecraft cadence and pedestrian", async () => {
    const source = await Bun.file(
      new URL("../src/ThreeViewer.tsx", import.meta.url),
    ).text();

    expect(source).toContain("createMinecraftLootBoxes(");
    expect(source).toContain("setMinecraftLootBoxesVisible(");
    expect(source).toContain("updateMinecraftLootBoxes(");
    expect(source).toContain(
      "runtime.pedestrian.enabled ? camera.position : null",
    );
    expect(source).toContain(
      'detailProfile: runtime.coarsePointer ? "mobile" : "full"',
    );
    expect(source).not.toContain("requestAnimationFrame(updateMinecraftLootBoxes");
  });
});
