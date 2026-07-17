import { describe, expect, test } from "bun:test";

import { InstancedMesh, Matrix4, Vector3 } from "three";

import {
  type VoxelPayload,
  createMinecraftVoxelWorld,
} from "../src/MinecraftVoxelWorld";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const payload = voxelPayload as unknown as VoxelPayload;

function instanced(name: string, root: ReturnType<typeof createMinecraftVoxelWorld>) {
  const mesh = root.getObjectByName(name);
  expect(mesh).toBeInstanceOf(InstancedMesh);
  return mesh as InstancedMesh;
}

describe("true voxel Minecraft world", () => {
  const world = createMinecraftVoxelWorld(payload);

  test("builds one instanced box set per layer with full counts", () => {
    const groundRuns = payload.ground_rows.reduce(
      (sum, row) => sum + row.length,
      0,
    );
    expect(instanced("Voxel ground runs", world).count).toBe(groundRuns);
    expect(instanced("Voxel building columns", world).count).toBe(
      payload.buildings.length,
    );
    expect(instanced("Voxel tree trunks", world).count).toBe(
      payload.trees.length,
    );
    expect(instanced("Voxel tree crowns", world).count).toBe(
      payload.trees.length,
    );
    // Blocky by construction: thousands of surveyed building columns.
    expect(payload.buildings.length).toBeGreaterThan(10_000);
  });

  test("places tall Reichstag columns at the surveyed world position", () => {
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    let tallReichstagColumns = 0;
    for (let index = 0; index < buildings.count; index += 1) {
      buildings.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (
        position.x >= 260 &&
        position.x <= 372 &&
        position.z >= -34 &&
        position.z <= 115 &&
        scale.y >= 24
      ) {
        tallReichstagColumns += 1;
      }
    }
    expect(tallReichstagColumns).toBeGreaterThan(300);
  });

  test("keeps every column inside the payload grid in world metres", () => {
    const cell = payload.cell_m;
    const minX = payload.grid.min_x_idx * cell;
    const maxX = (payload.grid.min_x_idx + payload.grid.cols) * cell;
    const minZ = payload.grid.min_z_idx * cell;
    const maxZ = (payload.grid.min_z_idx + payload.grid.rows) * cell;
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    for (let index = 0; index < buildings.count; index += 1) {
      buildings.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      expect(position.x).toBeGreaterThanOrEqual(minX);
      expect(position.x).toBeLessThanOrEqual(maxX);
      expect(position.z).toBeGreaterThanOrEqual(minZ);
      expect(position.z).toBeLessThanOrEqual(maxZ);
    }
  });
});
