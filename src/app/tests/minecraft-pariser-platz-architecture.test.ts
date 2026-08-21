import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  MINECRAFT_PARISER_PLATZ_GROUP_NAME,
  MINECRAFT_PARISER_PLATZ_MESH_NAME,
  createMinecraftPariserPlatzArchitecture,
} from "../src/MinecraftPariserPlatzArchitecture";
import { PARISER_PLATZ_ARCHITECTURE_PROFILE } from "../src/PariserPlatzArchitecture";
import {
  type VoxelPayload,
  createMinecraftVoxelWorld,
} from "../src/MinecraftVoxelWorld";
import { MINECRAFT_PALETTE } from "../src/visual-modes/minecraft/palette";

const integrationFixture: VoxelPayload = {
  schema_version: 2,
  cell_m: 4,
  classes: ["grass"],
  grid: { cols: 1, min_x_idx: 2_000, min_z_idx: 2_000, rows: 1 },
  ground_height: { cols: 1, rows: 1, stride_cells: 1, y_dm: [0] },
  ground_rows: [[[0, 1, 0]]],
  building_rows: [[]],
  tree_rows: [[]],
  water_top_y_m: -1.15,
};

function fingerprint(mesh: InstancedMesh): string {
  const matrix = new Matrix4();
  const color = new Color();
  const rows: string[] = [];
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    mesh.getColorAt(index, color);
    rows.push(
      matrix.elements.map((value) => value.toFixed(5)).join(","),
      color.getHex().toString(16).padStart(6, "0"),
    );
  }
  return rows.join("|");
}

describe("Minecraft Pariser Platz architecture", () => {
  test("uses one opaque cube batch and retains the surveyed voxel masses", () => {
    const group = createMinecraftPariserPlatzArchitecture();
    expect(group.name).toBe(MINECRAFT_PARISER_PLATZ_GROUP_NAME);
    expect(group.children).toHaveLength(1);
    expect(group.userData).toMatchObject({
      buildingCount: 4,
      drawCallBudget: 1,
      genericSourceMassRetained: true,
      instanceBudget: 600,
    });

    const mesh = group.children[0] as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.name).toBe(MINECRAFT_PARISER_PLATZ_MESH_NAME);
    expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    expect(mesh.count).toBeGreaterThan(300);
    expect(mesh.count).toBeLessThan(600);
    expect(mesh.userData).toMatchObject({
      blockNative: true,
      drawCallBudget: 1,
      genericSourceMassRetained: true,
      instanceCount: mesh.count,
      maxBlockSpanM: 6.2,
      textureFree: true,
    });
    const material = mesh.material as MeshStandardMaterial;
    expect(material.map).toBeNull();
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.flatShading).toBe(true);
  });

  test("is mounted exactly once in the authored voxel world", () => {
    const world = createMinecraftVoxelWorld(integrationFixture);
    expect(
      world.children.filter(
        ({ name }) => name === MINECRAFT_PARISER_PLATZ_GROUP_NAME,
      ),
    ).toHaveLength(1);
    expect(
      world.getObjectByName(MINECRAFT_PARISER_PLATZ_MESH_NAME),
    ).toBeInstanceOf(InstancedMesh);
  });

  test("keeps every cue block-sized, coloured and aligned to all four facades", () => {
    const mesh = createMinecraftPariserPlatzArchitecture()
      .children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const color = new Color();
    const positions: Vector3[] = [];
    const colors = new Set<number>();
    const closedPalette = new Set<number>(MINECRAFT_PALETTE);
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      positions.push(position.clone());
      mesh.getColorAt(index, color);
      colors.add(color.getHex());
      expect(closedPalette.has(color.getHex())).toBe(true);
      expect(Math.max(scale.x, scale.y, scale.z)).toBeLessThanOrEqual(6.201);
      expect(Math.min(scale.x, scale.y, scale.z)).toBeGreaterThan(0.3);
    }
    expect(colors.size).toBeGreaterThanOrEqual(7);
    for (const profile of Object.values(
      PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings,
    )) {
      const anchor = new Vector3(...profile.facadeCenterWorldM);
      expect(
        positions.some(
          (candidate) =>
            Math.hypot(candidate.x - anchor.x, candidate.z - anchor.z) < 7,
        ),
      ).toBe(true);
    }
  });

  test("is deterministic and carries no photo or texture dependency", () => {
    const first = createMinecraftPariserPlatzArchitecture();
    const second = createMinecraftPariserPlatzArchitecture();
    expect(fingerprint(first.children[0] as InstancedMesh)).toBe(
      fingerprint(second.children[0] as InstancedMesh),
    );
    expect(first.userData.sourceProfile.performance).toMatchObject({
      photoTexturesBundled: false,
      staticGeometry: true,
    });
    for (const profile of Object.values(
      first.userData.sourceProfile.buildings,
    ) as Array<{
      visualQa: { photoBundled: boolean; referenceUrl: string };
    }>) {
      expect(profile.visualQa.photoBundled).toBe(false);
      expect(profile.visualQa.referenceUrl).toContain("commons.wikimedia.org");
    }
  });
});
