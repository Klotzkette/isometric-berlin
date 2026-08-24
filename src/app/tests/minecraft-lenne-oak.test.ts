import { describe, expect, test } from "bun:test";

import {
  Box3,
  InstancedMesh,
  MeshStandardMaterial,
  Vector3,
} from "three";

import minecraftPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  createMinecraftLenneOak,
  isLenneOakVoxelTree,
} from "../src/MinecraftLenneOak";
import {
  decodeVoxelTreeBlocks,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import { LENNE_OAK_PROFILE } from "../src/LenneOak";

const payload = minecraftPayload as unknown as VoxelPayload;
const sourceMatches = decodeVoxelTreeBlocks(payload).filter(
  ([xIndex, zIndex, y0dm, heightDm]) =>
    isLenneOakVoxelTree(
      xIndex,
      zIndex,
      y0dm,
      heightDm,
      payload.cell_m,
    ),
);

function signature(profile: "full" | "mobile") {
  const tree = sourceMatches[0];
  return createMinecraftLenneOak(tree[2] / 10, profile);
}

describe("Minecraft Lenné-Eiche", () => {
  test("matches exactly one official voxel source tree", () => {
    expect(sourceMatches).toEqual([[-69, 38, 38, 240]]);
    const [xIndex, zIndex] = sourceMatches[0];
    expect((xIndex + 0.5) * payload.cell_m).toBeCloseTo(-274, 5);
    expect((zIndex + 0.5) * payload.cell_m).toBeCloseTo(154, 5);
    expect(
      Math.hypot(
        (xIndex + 0.5) * payload.cell_m - LENNE_OAK_PROFILE.position[0],
        (zIndex + 0.5) * payload.cell_m - LENNE_OAK_PROFILE.position[2],
      ),
    ).toBeLessThan(1.3);
  });

  test("keeps the veteran silhouette in one opaque instanced draw", () => {
    const full = signature("full");
    full.updateMatrixWorld(true);
    const meshes: InstancedMesh[] = [];
    full.traverse((object) => {
      if (object instanceof InstancedMesh) meshes.push(object);
    });
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBeGreaterThanOrEqual(130);
    expect(meshes[0].count).toBeLessThan(150);
    const material = meshes[0].material as MeshStandardMaterial;
    expect(material.transparent).toBe(false);
    expect(material.map).toBeNull();

    const bounds = new Box3().setFromObject(full);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(18);
    expect(size.y).toBeGreaterThan(22.5);
    expect(size.y).toBeLessThan(23.5);
    expect(size.z).toBeGreaterThanOrEqual(14);
    expect(full.position.x).toBe(LENNE_OAK_PROFILE.position[0]);
    expect(full.position.z).toBe(LENNE_OAK_PROFILE.position[2]);
  });

  test("preserves the outline with a smaller mobile block budget", () => {
    const full = signature("full");
    const mobile = signature("mobile");
    const fullMesh = full.children[0] as InstancedMesh;
    const mobileMesh = mobile.children[0] as InstancedMesh;
    expect(mobileMesh.count).toBeGreaterThanOrEqual(80);
    expect(mobileMesh.count).toBeLessThan(fullMesh.count * 0.7);

    mobile.updateMatrixWorld(true);
    const size = new Box3().setFromObject(mobile).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(18);
    expect(size.y).toBeGreaterThan(22.5);
    expect(mobile.userData.detailProfile).toBe("mobile");
  });
});
