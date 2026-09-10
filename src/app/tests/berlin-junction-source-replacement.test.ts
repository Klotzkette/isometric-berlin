import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";

import {
  BERLIN_JUNCTION_PRISM_IDS,
  BERLIN_JUNCTION_SOURCE_RING_DM,
  berlinJunctionReplacesSourceColumn,
} from "../src/BerlinJunction";
import {
  PRISM_SUPPRESSED_IDS,
  createDistantBuildingShells,
  createIsometricCity,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  createMinecraftVoxelWorld,
  decodeVoxelBuildingColumns,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import {
  compilePedestrianObstacles,
  pedestrianPointIsBlocked,
} from "../src/pedestrianNavigation";

const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const retainedPrism = source.buildings.find(({ id }) => id === "K0003UOE")!;
const rawVoxels = await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url)).json() as VoxelPayload;

describe("Berlin Junction replaces its closed source envelope only", () => {
  test("retains the exact source record and bounds the replacement by its original ring", () => {
    expect([...BERLIN_JUNCTION_PRISM_IDS]).toEqual(["K0003UOE"]);
    expect(retainedPrism.ring).toEqual(BERLIN_JUNCTION_SOURCE_RING_DM);
    expect(retainedPrism.y0_dm).toBe(40);
    expect(retainedPrism.h_dm).toBe(39);
    expect(retainedPrism.holes).toEqual([]);
    expect(berlinJunctionReplacesSourceColumn(-202, 930)).toBeTrue();
    // This point is inside the overall source bbox but outside the bent ring.
    expect(berlinJunctionReplacesSourceColumn(-204, 937)).toBeFalse();
    expect(berlinJunctionReplacesSourceColumn(-198, 930)).toBeFalse();
    expect(berlinJunctionReplacesSourceColumn(-165.4, 922.7)).toBeFalse();
  });

  test("omits the false solid in both near and distant drawing without changing a foreign source id", () => {
    expect(PRISM_SUPPRESSED_IDS.has(retainedPrism.id)).toBeTrue();
    expect(createDistantBuildingShells(source, [retainedPrism]).children).toHaveLength(0);
    const detailed = createIsometricCity(source, null, null, null, {
      buildings: [retainedPrism], includeContext: false,
    });
    const body = detailed.getObjectByName("LoD2 prism buildings") as Mesh | undefined;
    expect(body?.geometry.getAttribute("position").count ?? 0).toBe(0);
    const foreign = { ...retainedPrism, id: "serra-neighbour-control" };
    expect(PRISM_SUPPRESSED_IDS.has(foreign.id)).toBeFalse();
    expect(createDistantBuildingShells(source, [foreign]).children.length).toBeGreaterThan(0);
  });

  test("keeps the raw voxel source while excluding only its exact-ring display columns", () => {
    const columns = decodeVoxelBuildingColumns(rawVoxels);
    const replaced = columns.filter(([x, z]) =>
      berlinJunctionReplacesSourceColumn((x + 0.5) * rawVoxels.cell_m, (z + 0.5) * rawVoxels.cell_m));
    expect(replaced).toHaveLength(1);
    for (const [, , bottom, top] of replaced) {
      expect(bottom).toBe(retainedPrism.y0_dm);
      // The retained source voxel raster rounds the 3.9 m shell to 4 m.
      expect(top).toBe(80);
    }
    expect(columns.some(([x, z]) => Math.abs((x + 0.5) * rawVoxels.cell_m + 150) < 40 &&
      Math.abs((z + 0.5) * rawVoxels.cell_m - 950) < 40 &&
      !berlinJunctionReplacesSourceColumn((x + 0.5) * rawVoxels.cell_m, (z + 0.5) * rawVoxels.cell_m)))
      .toBeTrue();
  });

  test("suppresses the closed collision footprint by source identity without opening a foreign prism", () => {
    const replaced = compilePedestrianObstacles({ buildings: [retainedPrism] });
    expect(replaced.buildingCount).toBe(0);
    expect(pedestrianPointIsBlocked(-202, 930, 4, replaced)).toBeFalse();
    const foreign = compilePedestrianObstacles({ buildings: [{ ...retainedPrism, id: "serra-neighbour-control" }] });
    expect(foreign.buildingCount).toBe(1);
    expect(pedestrianPointIsBlocked(-202, 930, 4, foreign)).toBeTrue();
  });

  test("keeps adjacent voxel columns in both full and mobile construction", () => {
    const fixture: VoxelPayload = {
      schema_version: 2,
      cell_m: 4,
      classes: ["grass", "concrete"],
      grid: { cols: 3, rows: 1, min_x_idx: -51, min_z_idx: 232 },
      ground_height: { cols: 3, rows: 1, stride_cells: 1, y_dm: [40, 40, 40] },
      ground_rows: [[[0, 3, 0]]],
      building_rows: [[[0, 3, 40, 79, 1]]],
      tree_rows: [[]],
      water_top_y_m: -1.15,
    };
    for (const detailProfile of ["full", "mobile"] as const) {
      const world = createMinecraftVoxelWorld(fixture, null, null, { detailProfile });
      const columns = world.getObjectByName("Voxel building columns") as InstancedMesh;
      expect(columns).toBeInstanceOf(InstancedMesh);
      const matrix = new Matrix4();
      const positions: number[][] = [];
      for (let instance = 0; instance < columns.count; instance += 1) {
        columns.getMatrixAt(instance, matrix);
        positions.push([matrix.elements[12], matrix.elements[14]]);
      }
      expect(positions).toEqual([[-198, 930], [-194, 930]]);
    }
  });
});
