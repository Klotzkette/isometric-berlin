import { expect, test } from "bun:test";
import { Group, Raycaster, Vector3 } from "three";
import { canReplacePotsdamerNorthPavilion, exactNorthPavilionColumns } from "../src/PotsdamerPavilionOwnership";
import { createPotsdamerNorthPavilionDrawn } from "../src/PotsdamerStationDrawn";
import { preparePotsdamerNorthPavilionNative } from "../src/PotsdamerStationPhotoDetails";
import { createPotsdamerPavilionRoutes, installPotsdamerPavilionNavigation, potsdamerPavilionTerrainAdmitted } from "../src/PotsdamerPavilionRoutes";
import { createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";
import { createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian,
  type PedestrianEnvironment, type PedestrianState } from "../src/pedestrianNavigation";
import { resolveSchwellenraumFlightTranslation } from "../src/schwellenraumNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const meshes = new URL("../public/mesh/regierungsviertel/", import.meta.url);
const ground = await Bun.file(new URL("ground-context.json", meshes)).json() as VoxelPayload;
const voxels = await Bun.file(new URL("minecraft-voxels.json", meshes)).json() as VoxelPayload;
const prisms = await Bun.file(new URL("lod2-prisms.json", meshes)).json() as PrismPayload;
const north = [[293.55,1023.9],[293.5,1023.43],[292.96,1018.66],[292.82,1017.47],
  [292.28,1012.71],[291.71,1007.63],[293.84,1007.76],[314.17,1009.34],
  [311.51,1025.72],[310.82,1029.93]];
const south = [[301.62,1127.5],[301.69,1128.05],[302.25,1132.82],[302.39,1134.06],
  [302.93,1138.82],[303.67,1145.28],[299.95,1145.7],[296.96,1146.04],[295.77,1146.17],[292.79,1146.51],
  [288.88,1146.27],[290.47,1120.37],[293.86,1120.54],[298.52,1043.25],[293.68,1042.96],[294.26,1033.43],
  [294.53,1028.95],[304.06,1029.69],[310.82,1029.93]];

const hall = -.518;
const lower = -3.918;
const surface = 5.4;
const upperMid = (hall + surface) / 2;
const lowerMid = (hall + lower) / 2;
const northFlight = [surface, surface, upperMid, upperMid, hall, hall, hall, hall, hall, hall];
const southFlight = [surface, surface, upperMid, upperMid, hall, hall, hall, lowerMid, lowerMid, lower, lower, lower, lower,
  lower, lower, lower, lower, hall, hall];

function verifyFlight(path: number[][], heights: number[], env: PedestrianEnvironment): void {
  const pose = (i: number) => ({ x: path[i][0], y: heights[i] + 1.19, z: path[i][1] });
  for (let i = 1; i < path.length; i++) {
    const from = pose(i - 1), to = pose(i);
    const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const motion = resolveSchwellenraumFlightTranslation(from, delta, env);
    expect(Math.hypot(motion.position.x - to.x, motion.position.y - to.y, motion.position.z - to.z)).toBeLessThan(.04);
  }
}

function walk(state: PedestrianState, target: readonly number[], env: PedestrianEnvironment): PedestrianState {
  for (let n = 0; n < 700; n++) {
    const dx = target[0] - state.x, dz = target[1] - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .025) return state;
    state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) },
      { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
      Math.min(.029, distance / PEDESTRIAN_WALK_SPEED_MPS), env).state;
  }
  throw Error(`Potsdamer pavilion stopped at ${state.x},${state.groundY},${state.z} toward ${target}`);
}

for (const native of [false, true]) test(`Potsdamer glass pavilions join the public gallery by the mapped routes (${native ? "Native" : "Drawn"})`, () => {
  const terrain = native ? voxels : ground;
  expect(potsdamerPavilionTerrainAdmitted(terrain)).toBeTrue();
  const route = createPotsdamerPavilionRoutes(native);
  const slabs = createGroundSlabs(terrain, native ? "Voxel ground runs" : "Drawn ground slabs", {}, {
    parkRelief: native ? "native" : "drawn",
    skipAtWorld: (x, z) => x < 266 || x > 312 || z < 997 || z > 1155,
  });
  const world = new Group().add(slabs, route.root);
  expect(route.cutGround(world)).toBeTrue();
  world.updateMatrixWorld(true);
  const pavement = new Raycaster(new Vector3(278, 9, 1021), new Vector3(0, -1, 0)).intersectObject(world)[0];
  expect(pavement.point.y).toBeGreaterThanOrEqual(5.2);
  const env = createPedestrianEnvironment(terrain, { water: [] }, null, prisms);
  env.visualMode = () => native ? "minecraft" : "day";
  installPotsdamerPavilionNavigation(env, () => route);
  for (const route of [north, south]) {
    let state = createPedestrianState(env, { x: route[0][0], z: route[0][1], yaw: 0, groundYHint: 5.4, preserveHorizontalPosition: true });
    for (const target of route.slice(1)) {
      state = walk(state, target, env);
    }
    expect(state.groundY).toBeCloseTo(-.518, 2);
    for (const target of route.slice(0, -1).reverse()) state = walk(state, target, env);
    expect(state.groundY).toBeGreaterThanOrEqual(5.25);
  }
  verifyFlight(north, northFlight, env);
  verifyFlight(south, southFlight, env);
  expect(route.flightAt(288.88, -2.77, 1146.27)).toBeTrue();
  expect(route.flightAt(310.82, .632, 1029.93)).toBeTrue();
  disposeStaticAudit(world);
});

test("north pavilion retirement is pinned to its complete LoD2 prism and 47 source cells", () => {
  expect(canReplacePotsdamerNorthPavilion(prisms.buildings)).toBeTrue();
  expect(exactNorthPavilionColumns(prisms.buildings, voxels)).not.toBeNull();
  const changed = prisms.buildings.map(p => p.id === "K0002SCt" ? { ...p, y0_dm: 55 } : p);
  expect(canReplacePotsdamerNorthPavilion(changed)).toBeFalse();
  expect(exactNorthPavilionColumns(changed, voxels)).toBeNull();
  const drawn = createPotsdamerNorthPavilionDrawn(prisms.buildings)!;
  const native = preparePotsdamerNorthPavilionNative(prisms.buildings, voxels)!.group;
  expect(drawn.getObjectByName("Potsdamer Platz pavilion roofs and transparent glazing")).toBeDefined();
  expect(native.getObjectByName("North station native transparent glass")).toBeDefined();
  disposeStaticAudit(drawn);
  disposeStaticAudit(native);
});
