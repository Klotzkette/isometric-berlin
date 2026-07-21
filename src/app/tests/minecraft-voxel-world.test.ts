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

  test("columns take their building's real colour, snapped to the palette", async () => {
    const { buildColumnToneLookup } = await import("../src/MinecraftVoxelWorld");
    const { MINECRAFT_PALETTE } = await import(
      "../src/visual-modes/minecraft/palette"
    );
    const prisms = (await import(
      "../public/mesh/regierungsviertel/lod2-prisms.json"
    )) as { default: { buildings: Array<{ ring: number[][]; tone?: [number, number, number] }> } };
    const lookup = buildColumnToneLookup(prisms.default);
    // Inside the Reichstag footprint (centre ~308, 41) the lookup
    // returns a palette colour; far out in the Spree it returns null.
    const reichstag = lookup(308, 41);
    expect(reichstag).not.toBeNull();
    expect(MINECRAFT_PALETTE.includes(reichstag as never)).toBe(true);
    expect(lookup(-5000, -5000)).toBeNull();
    // Coverage: most surveyed columns resolve to a real tone.
    let hits = 0;
    const sampleCount = Math.min(2000, payload.buildings.length);
    for (let index = 0; index < sampleCount; index += 1) {
      const [xIdx, , , ,] = payload.buildings[index];
      const zIdx = payload.buildings[index][1];
      const x = (xIdx + 0.5) * payload.cell_m;
      const z = (zIdx + 0.5) * payload.cell_m;
      if (lookup(x, z) !== null) {
        hits += 1;
      }
    }
    expect(hits / sampleCount).toBeGreaterThan(0.5);
  });

  test("exterior column faces carry blocky window panes", async () => {
    const { InstancedMesh } = await import("three");
    const panes = world.getObjectByName("Voxel facade windows");
    expect(panes).toBeInstanceOf(InstancedMesh);
    const mesh = panes as InstanceType<typeof InstancedMesh>;
    // ~54k faces on 17k surveyed columns; interior faces are skipped.
    expect(mesh.count).toBeGreaterThan(30_000);
    expect(mesh.count).toBeLessThan(80_000);
  });

  test("builds one instanced box set per layer with full counts", () => {
    const groundRuns = payload.ground_rows.reduce(
      (sum, row) => sum + row.length,
      0,
    );
    expect(instanced("Voxel ground runs", world).count).toBe(groundRuns);
    // Each column is a facade body plus (when tall enough) a darker
    // roof-cap layer.
    const columns = instanced("Voxel building columns", world).count;
    expect(columns).toBeGreaterThanOrEqual(payload.buildings.length);
    expect(columns).toBeLessThanOrEqual(payload.buildings.length * 2);
    expect(instanced("Voxel tree trunks", world).count).toBe(
      payload.trees.length,
    );
    // Crowns: one per tree plus a stacked spruce top on some species.
    const crowns = instanced("Voxel tree crowns", world).count;
    expect(crowns).toBeGreaterThanOrEqual(payload.trees.length);
    expect(crowns).toBeLessThanOrEqual(payload.trees.length * 2);
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
