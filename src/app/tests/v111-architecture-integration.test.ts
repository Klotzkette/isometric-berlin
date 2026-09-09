import { describe, expect, test } from "bun:test";
import { Color, Group, InstancedMesh, Matrix4 } from "three";
import groundData from "../public/mesh/regierungsviertel/ground-context.json";
import prismData from "../public/mesh/regierungsviertel/lod2-prisms.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import { buildMinecraftVoxelWorldSteps, createGroundSlabs, smoothGroundTopSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { type PrismPayload, createSmoothSurfaces } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles, createPedestrianEnvironment, createPedestrianState, stepPedestrian, PEDESTRIAN_IDLE_INPUT, type PedestrianPolygonObstacle } from "../src/pedestrianNavigation";
import { createSpreebogenLawnGroundAt } from "../src/SpreebogenPark";
import { DB_TOWER_PRISM_IDS } from "../src/dbTowerIds";
import { dbTowerRoofAt } from "../src/dbTowerProfile";
import { MUSIC_MUSEUM_IDS, musicMuseumPart, musicMuseumDisplayTop } from "../src/museumLenneProfile";
import { isSpreebogenParkSurface, isSpreebogenRasterReplacementAt, spreebogenTerrainYAt, spreebogenPromenadeYAt, spreebogenWalkSurfaceAt, LUDWIG_ERHARD_UFER_WORLD_M } from "../src/spreebogenBankProfile";
const ground = groundData as unknown as VoxelPayload;
const prisms = prismData as unknown as PrismPayload;
const matrix = new Matrix4();
describe("v1.0.11 architecture and shared world integration", () => {
  test("walking starts and remains on the authored lawn rather than four metres below it", () => {
    const lawnAt = createSpreebogenLawnGroundAt(ground);
    for (const minecraft of [false, true]) {
      const environment = createPedestrianEnvironment(ground, surfaces);
      environment.interiorGroundAt = (x,z,hint) => spreebogenWalkSurfaceAt(x,z,hint ?? environment.groundAt(x,z) ?? 0,minecraft,false) ?? lawnAt(x,z);
      const lawnY = lawnAt(10,-405)!;
      expect(lawnY - environment.groundAt(10,-405)!).toBeGreaterThan(4);
      const state = createPedestrianState(environment, {x:10,z:-405,yaw:0});
      expect(state.groundY).toBeCloseTo(lawnY, 5);
      const next = stepPedestrian(state, PEDESTRIAN_IDLE_INPUT, 1 / 60, environment);
      expect(next.state.groundY).toBeCloseTo(lawnY, 5);
    }
  });
  test("every replaced tower/museum prism keeps its exact footprint and gets its own absolute roof", () => {
    const index = compilePedestrianObstacles(prisms);
    const polygons = new Map([...new Set([...index.cells.values()].flat())]
      .filter((o): o is PedestrianPolygonObstacle => o.kind === "polygon").map(o => [o.sourceId, o]));
    for (const id of [...DB_TOWER_PRISM_IDS, ...MUSIC_MUSEUM_IDS]) {
      const source = prisms.buildings.find(p => p.id === id)!;
      const obstacle = polygons.get(id)!;
      expect(obstacle.ring).toBe(source.ring);
      expect(obstacle.coordinateScale).toBe(0.1);
      expect(obstacle.topAt).toBeFunction();
      if (MUSIC_MUSEUM_IDS.has(id)) {
        expect(obstacle.maxY).toBe(musicMuseumDisplayTop(id));
        expect(obstacle.minY).toBe(musicMuseumPart(id)!.street_ground_y_m);
      } else for (const [x, z] of source.ring.slice(0, -1)) {
        const roof = dbTowerRoofAt(x / 10, z / 10, id);
        if (roof !== null) expect(obstacle.topAt!(x / 10, z / 10)).toBe(roof);
      }
    }
    expect(polygons.get("C63xrbXN")!.maxY).toBeCloseTo(13.914, 3);
    expect(polygons.get("K0003U6g")!.maxY).toBeCloseTo(10.4, 3);
    const neighbour = prisms.buildings.find(p => p.id === "K0003VMd")!;
    expect(polygons.get(neighbour.id)!.maxY).toBe((neighbour.y0_dm + neighbour.h_dm) / 10);
  });
  test("only the exact owned park is removed from generic park plates", () => {
    const owned = surfaces.parks.filter(isSpreebogenParkSurface);
    expect(owned).toHaveLength(1);
    const fixture = { ...surfaces, parks: owned, water: [], roads: [], paths: [] };
    expect(createSmoothSurfaces(fixture, 0, 4, () => 4).getObjectByName("smooth parkland lawns")).toBeUndefined();
    const unrelated = { ...owned[0], name: "Another park" };
    expect(createSmoothSurfaces({ ...fixture, parks: [unrelated] }, 0, 4, () => 4).getObjectByName("smooth parkland lawns")).toBeDefined();
  });
  test("the production Minecraft builder keeps native bank paving above its backing terrain", () => {
    const before = Bun.hash(JSON.stringify(ground));
    const root = new Group(), steps = buildMinecraftVoxelWorldSteps(root, ground);
    let complete = false;
    for (let i = 0; i < 1000; i++) {
      complete = steps.next().done === true;
      if (root.getObjectByName("Minecraft Spreebogenpark maintained bank") || complete) break;
    }
    expect(complete).toBe(false);
    expect(root.getObjectByName("Minecraft Spreebogenpark maintained bank")).toBeDefined();
    steps.return(root);
    const mesh = root.getObjectByName("Voxel ground runs") as InstancedMesh;
    expect(mesh.userData.gradedPromenadeCells).toBeGreaterThan(1000);
    const sourceSample = smoothGroundTopSampler(ground);
    let actual = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements, x = e[12], z = e[14];
      if (!isSpreebogenRasterReplacementAt(x, z, 0) || e[0] !== ground.cell_m) continue;
      const sourceTop = sourceSample(x / ground.cell_m - ground.grid.min_x_idx, z / ground.cell_m - ground.grid.min_z_idx);
      const expected = spreebogenTerrainYAt(x, z, sourceTop) - 0.24;
      const top = e[13] + e[5] / 2;
      if (Math.abs(top - (ground.water_top_y_m ?? 0)) < 0.0001) continue;
      expect(top).toBeCloseTo(expected, 4);
      actual++;
    }
    expect(actual).toBeGreaterThan(1000);
    expect(Bun.hash(JSON.stringify(ground))).toBe(before);
  });
  test("grading leaves unrelated long runs unchanged and walking follows the lower promenade", () => {
    const fixture = { ...ground, ground_rows: [[[0, 50, 0]]], grid: { ...ground.grid, rows: 1 } } as VoxelPayload;
    const plain = createGroundSlabs(fixture, "plain", { grass: [0x667755] });
    const bounded = createGroundSlabs(fixture, "bounded", { grass: [0x667755] }, {
      terrainOverride: { bounds: { minX: -148, maxX: 278, minZ: -439, maxZ: -230 }, topAt: () => 2 },
    });
    expect(bounded.instanceMatrix.array).toEqual(plain.instanceMatrix.array);
    expect(bounded.instanceColor!.array).toEqual(plain.instanceColor!.array);
    const crossing = { ...fixture,
      grid: { min_x_idx: -40, min_z_idx: -106, cols: 130, rows: 1 },
      ground_rows: [[[0, 130, 0]]],
      ground_height: { cols: 130, rows: 1, stride_cells: 1, y_dm: Array.from({length: 130}, (_, i) => 40 + i) },
    } as VoxelPayload;
    const shades = { grass: [0x557744, 0x889955, 0x446633] };
    const original = createGroundSlabs(crossing, "original crossing", shades);
    const split = createGroundSlabs(crossing, "split crossing", shades, {
      terrainOverride: { bounds: { minX: -100, maxX: 100, minZ: -430, maxZ: -410 }, topAt: () => 2 },
    });
    original.getMatrixAt(0, matrix);
    const originalTop = matrix.elements[13] + matrix.elements[5] / 2;
    const originalColour = new Color(), colour = new Color();
    original.getColorAt(0, originalColour);
    let width = 0;
    for (let i = 0; i < split.count; i++) {
      split.getMatrixAt(i, matrix);
      width += matrix.elements[0];
      if (matrix.elements[12] < -100 || matrix.elements[12] > 100)
        expect(matrix.elements[13] + matrix.elements[5] / 2).toBe(originalTop);
      split.getColorAt(i, colour);
      expect(colour.toArray()).toEqual(originalColour.toArray());
    }
    expect(width).toBe(130 * 4);
    const environment = createPedestrianEnvironment(ground, surfaces);
    for (const [x, , z] of LUDWIG_ERHARD_UFER_WORLD_M)
      expect(environment.groundAt(x, z)).toBeCloseTo(spreebogenPromenadeYAt(x, z)!, 8);
  });
});
