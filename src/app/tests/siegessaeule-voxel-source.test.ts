import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import { createMinecraftVoxelWorld, decodeVoxelBuildingColumns, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { isSiegessaeuleSourceVoxelColumn, SIEGESSAEULE_SOURCE } from "../src/SiegessaeuleSource";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";

describe("Siegessäule's exact coarse-source replacement", () => {
  test("pins only the existing three source identities and their actual socle outline", () => {
    for (const part of SIEGESSAEULE_SOURCE.parts) {
      const source = prisms.buildings.find((building) => building.id === part.id)!;
      expect(source.y0_dm).toBe(SIEGESSAEULE_SOURCE.baseYDm);
      expect(source.h_dm).toBe(part.heightDm);
    }
    expect(prisms.buildings.find((building) => building.id === "xzlowEa3")!.ring).toEqual(SIEGESSAEULE_SOURCE.outerFootprintDm);
  });

  test("matches exactly 37 delivered monument columns while retaining neighbours and unrelated heights", () => {
    const payload = voxels as unknown as VoxelPayload;
    const matched = decodeVoxelBuildingColumns(payload).filter(([x, z, y0, y1]) =>
      isSiegessaeuleSourceVoxelColumn((x + 0.5) * payload.cell_m, (z + 0.5) * payload.cell_m, y0 / 10, y1 / 10, payload.cell_m));
    expect(matched).toHaveLength(37);
    expect(isSiegessaeuleSourceVoxelColumn(-1458, 454, 5.2, 33.2, 4)).toBe(true);
    expect(isSiegessaeuleSourceVoxelColumn(-1438, 454, 5.2, 33.2, 4)).toBe(false);
    expect(isSiegessaeuleSourceVoxelColumn(-1458, 454, 5.2, 45.2, 4)).toBe(false);
    expect(isSiegessaeuleSourceVoxelColumn(-1458, 454, 9.2, 33.2, 4)).toBe(false);
  });

  for (const detailProfile of ["full", "mobile"] as const) {
    test(`${detailProfile} omits the generic source mass/windows and retains the authored monument`, () => {
      const fixture: VoxelPayload = {
        schema_version: 1, cell_m: 4, classes: ["concrete"],
        grid: { cols: 12, rows: 12, min_x_idx: -370, min_z_idx: 108 },
        ground_height: { cols: 1, rows: 1, stride_cells: 12, y_dm: [52] },
        ground_rows: [], trees: [],
        buildings: [[-365, 113, 52, 332, 0], [-360, 113, 52, 172, 0]],
        water_top_y_m: 3,
      };
      const world = createMinecraftVoxelWorld(fixture, null, null, { detailProfile });
      const generic = world.getObjectByName("Voxel building columns") as InstancedMesh;
      expect(generic.count).toBeGreaterThan(0);
      const matrix = new Matrix4();
      for (let index = 0; index < generic.count; index += 1) {
        generic.getMatrixAt(index, matrix);
        expect(matrix.elements[12]).toBe(-1438);
      }
      const authored = world.getObjectByName("Voxel extrapolated Siegessäule") as InstancedMesh;
      expect(authored.count).toBe(304);
      world.traverse((object) => {
        if (!(object instanceof InstancedMesh) || !object.name.toLowerCase().includes("window")) return;
        for (let index = 0; index < object.count; index += 1) {
          object.getMatrixAt(index, matrix);
          expect(Math.abs(matrix.elements[12] + 1458) > 3 || Math.abs(matrix.elements[14] - 454) > 3).toBe(true);
        }
      });
    });
  }
});
