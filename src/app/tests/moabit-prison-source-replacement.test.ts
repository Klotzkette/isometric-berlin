import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import {
  MOABIT_PRISON_PORTAL_PRISM_IDS,
  MOABIT_PRISON_MEMORIAL_PROFILE,
  createMoabitPrisonMemorialPark,
  createMoabitPrisonMemorialParkMinecraft,
  isMoabitPrisonPortalVoxelColumn,
  moabitPrisonMemorialSolidAt,
} from "../src/MoabitPrisonMemorialPark";
import {
  PRISM_SUPPRESSED_IDS, createDistantBuildingShells, createIsometricCity,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  createMinecraftVoxelWorld, decodeVoxelBuildingColumns,
  isCompleteRecognitionVoxelColumn, smoothGroundTopSampler, type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";

const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const rawVoxels = await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url)).json() as VoxelPayload;
const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const retained = [...MOABIT_PRISON_PORTAL_PRISM_IDS].map(id => source.buildings.find(building => building.id === id)!);

describe("Moabit portal replacement in the assembled source world", () => {
  test("replaces precisely the two closed gate envelopes and preserves their original rings", () => {
    expect(retained.map(prism => prism.id)).toEqual(["pF0000BJ", "pF0000BI"]);
    expect(retained.map(prism => prism.ring.map(([x, z]) => [x / 10, z / 10])))
      .toEqual(MOABIT_PRISON_MEMORIAL_PROFILE.openPortalSourceReplacement.sourceRingsWorldM);
    expect(retained.map(prism => [prism.y0_dm, prism.h_dm])).toEqual([[61, 29], [59, 29]]);
    expect(retained.every(prism => PRISM_SUPPRESSED_IDS.has(prism.id))).toBeTrue();
    expect(createDistantBuildingShells(source, retained).children).toHaveLength(0);
    const city = createIsometricCity(source, null, null, null, { buildings: retained, includeContext: false });
    const body = city.getObjectByName("LoD2 prism buildings") as Mesh | undefined;
    expect(body?.geometry.getAttribute("position").count ?? 0).toBe(0);
    const foreign = { ...retained[0], id: "moabit-unrelated-control" };
    expect(createDistantBuildingShells(source, [foreign]).children.length).toBeGreaterThan(0);
    expect(PRISM_SUPPRESSED_IDS.has("2yz00000")).toBeFalse();
  });

  test("walks through the actual source gate with the replacement wall collision active", () => {
    const portal = MOABIT_PRISON_MEMORIAL_PROFILE.mappedPortals[0];
    const obstacles = compilePedestrianObstacles({ buildings: retained });
    const original = compilePedestrianObstacles({ buildings: retained.map(p => ({ ...p, id: `${p.id}-control` })) });
    expect(obstacles.buildingCount).toBe(0);
    expect(original.buildingCount).toBe(2);
    const axis = new Vector3(Math.cos(portal.rotationY), 0, -Math.sin(portal.rotationY));
    const normal = new Vector3(Math.sin(portal.rotationY), 0, Math.cos(portal.rotationY));
    const access = { interiorSolidAt: (x: number, y: number, z: number) => moabitPrisonMemorialSolidAt(x, y, z, 0) };
    for (const offset of [-0.65, 0, 0.65]) {
      for (let along = -2; along <= 2; along += 0.25) {
        const point = new Vector3(...portal.worldM).addScaledVector(axis, offset).addScaledVector(normal, along);
        expect(pedestrianPointIsBlocked(point.x, point.z, portal.worldM[1], obstacles, access)).toBeFalse();
      }
    }
    expect(pedestrianPointIsBlocked(portal.worldM[0], portal.worldM[2], portal.worldM[1], original)).toBeTrue();
  });

  test("excludes the one actual coarse gate column through the production mask only", () => {
    const replaced = decodeVoxelBuildingColumns(rawVoxels).filter(([x, z]) =>
      isMoabitPrisonPortalVoxelColumn((x + .5) * rawVoxels.cell_m, (z + .5) * rawVoxels.cell_m));
    expect(replaced.map(([x, z, bottom, top]) => [(x + .5) * 4, (z + .5) * 4, bottom, top]))
      .toEqual([[-314, -798, 59, 99]]);
    expect(isCompleteRecognitionVoxelColumn(-314, -798)).toBeTrue();
    expect(isMoabitPrisonPortalVoxelColumn(-318, -798)).toBeFalse();
    expect(isMoabitPrisonPortalVoxelColumn(-314, -804)).toBeFalse();
    const fixture: VoxelPayload = {
      schema_version: 2, cell_m: 4, classes: ["grass", "concrete"],
      grid: { cols: 2, rows: 1, min_x_idx: -80, min_z_idx: -200 },
      ground_height: { cols: 2, rows: 1, stride_cells: 1, y_dm: [59, 59] },
      ground_rows: [[[0, 2, 0]]], building_rows: [[[0, 2, 59, 99, 1]]],
      tree_rows: [[]], water_top_y_m: -1.15,
    };
    for (const detailProfile of ["full", "mobile"] as const) {
      const world = createMinecraftVoxelWorld(fixture, null, null, { detailProfile });
      const columns = world.getObjectByName("Voxel building columns") as InstancedMesh;
      expect(columns.count).toBe(1);
      const matrix = new Matrix4();
      columns.getMatrixAt(0, matrix);
      expect([matrix.elements[12], matrix.elements[14]]).toEqual([-318, -798]);
    }
  });

  test("keeps the court upward-facing above the actual smoothed lawn in every representation", () => {
    const terrain = smoothGroundTopSampler(ground);
    const roots = [createMoabitPrisonMemorialPark("full"), createMoabitPrisonMemorialPark("mobile"),
      createMoabitPrisonMemorialParkMinecraft("full"), createMoabitPrisonMemorialParkMinecraft("mobile")];
    for (const root of roots) root.updateMatrixWorld(true);
    for (const [x, z] of [[-360, -883], [-351, -882], [-355, -878]]) {
      const lawnTop = terrain(x / ground.cell_m - ground.grid.min_x_idx, z / ground.cell_m - ground.grid.min_z_idx) + .06;
      expect(lawnTop).toBeCloseTo(6.56, 5);
      for (const root of roots) {
        const ray = new Raycaster(new Vector3(x, 7, z), new Vector3(0, -1, 0), 0, .44);
        const courtHits = ray.intersectObject(root, true).filter(hit => hit.object instanceof Mesh && hit.point.y > lawnTop + .04);
        expect(courtHits.length, root.name).toBeGreaterThan(0);
        expect(courtHits.some(hit => (hit.face?.normal.y ?? 0) > .99), root.name).toBeTrue();
      }
    }
  });
});
