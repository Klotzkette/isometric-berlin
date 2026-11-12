import { expect, test } from "bun:test";
import { Group, InstancedMesh, Raycaster, Vector3 } from "three";
import { addPotsdamerPassarelle, cutPotsdamerPassarelleGround } from "../src/PotsdamerSouthGround";
import {
  installPotsdamerPassarelleNavigation, POTSDAMER_PASSARELLE_NAME, POTSDAMER_PASSARELLE_Y,
  potsdamerPassarelleFlightAt,
} from "../src/PotsdamerPassarelle";
import {
  createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian,
} from "../src/pedestrianNavigation";
import { schwellenraumFlightPointIsBlocked } from "../src/SchwellenraumNavigation";
import { createGroundSlabs, smoothGroundTopSampler, type VoxelPayload } from "../src/terrainPayload";
import { createRestoredRoadBatch, type RestoredRoadBatch } from "../src/restoredRoadSurfaces";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const nativeGround = await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url)).json() as VoxelPayload;
const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;

for (const native of [false, true]) test(`${native ? "Minecraft" : "Drawn"} crosses the Mittelpassarelle in both directions through both Leipziger Platz stairways`, () => {
  const source = native ? nativeGround : ground;
  const slabs = createGroundSlabs(source, native ? "Voxel ground runs" : "Drawn ground slabs", {}, {
    skipAtWorld: (x, z) => x < 337 || x > 385 || z < 1018 || z > 1073,
  });
  const root = new Group().add(slabs);
  addPotsdamerPassarelle(root, native);
  root.updateMatrixWorld(true);
  expect(root.userData.potsdamerPassarellePublicAccess).toBeTrue();
  const down = (x: number, y: number, z: number) =>
    new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0)).intersectObject(root)[0]?.point.y;
  expect(down(351.5, 2, 1045)).toBeCloseTo(POTSDAMER_PASSARELLE_Y, 4);
  expect(down(351.5, 8, 1045)).toBeGreaterThan(4.8);
  expect(down(362.5, 8, 1029.77)).toBeLessThan(2);
  expect(down(362.5, 8, 1034.6)).toBeGreaterThan(4.8);
  const motion: number[] = [];
  root.getObjectByName(POTSDAMER_PASSARELLE_NAME)?.traverse(obj => {
    if (obj instanceof InstancedMesh && obj.userData.hbfMotionV291) motion.push(obj.userData.hbfMotionV291.direction);
  });
  expect(motion).toEqual([1, 1]);

  const environment = createPedestrianEnvironment(source, { water: [] }, null, prisms);
  installPotsdamerPassarelleNavigation(environment, () => true, () => native);
  let state = createPedestrianState(environment, { x: 373.15, z: 1028.84, yaw: 0,
    groundYHint: 5.4, preserveHorizontalPosition: true });
  const walk = (x: number, z: number) => {
    for (let n = 0; n < 900; n++) {
      const dx = x - state.x, dz = z - state.z, distance = Math.hypot(dx, dz);
      if (distance < .02) return;
      state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) }, {
        forward: 1, look: 0, sprint: false, strafe: 0, turn: 0,
      }, Math.min(.035, distance / PEDESTRIAN_WALK_SPEED_MPS), environment).state;
    }
    throw new Error(`Route to ${x}, ${z} blocked at ${state.x}, ${state.groundY}, ${state.z}`);
  };
  const route = [
    [368, 1029.28], [361.17, 1029.90], [356.4, 1029.9],
    [356.4, 1062.4], [360, 1062.4], [361.7, 1065.8],
    [368.9, 1065.32], [375.8, 1064.77],
  ] as const;
  for (const [x, z] of route) walk(x, z);
  expect(state.groundY).toBeGreaterThan(4.8);
  for (const [x, z] of route.slice(0, -1).reverse()) walk(x, z);
  walk(373.15, 1028.84);
  expect(state.groundY).toBeGreaterThan(4.8);
  expect(environment.interiorGroundAt?.(351.5, 1045, 5.4)).toBeNull();
  const point = new Vector3(356.4, .91, 1045);
  expect(potsdamerPassarelleFlightAt(point.x, point.y, point.z)).toBeTrue();
  expect(schwellenraumFlightPointIsBlocked(point, environment, .22)).toBeFalse();
  expect(schwellenraumFlightPointIsBlocked(new Vector3(356.4, 4.0, 1045), environment, .22)).toBeTrue();
  disposeStaticAudit(root);
});


test("The real deferred paving packet retains the plaza around the south Leipziger entrance", async () => {
  const rows = await Bun.file(new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url)).text();
  const raw = rows.split("\n").find(row => row.startsWith('{"id":"restored-paving-0-2",'));
  expect(raw).toBeDefined();
  const sample = smoothGroundTopSampler(ground);
  const at = (x: number, z: number) => sample(x / ground.cell_m - ground.grid.min_x_idx,
    z / ground.cell_m - ground.grid.min_z_idx);
  const mesh = createRestoredRoadBatch(JSON.parse(raw!) as RestoredRoadBatch, at);
  const transferred = deserializeTransferredObject3D(serializeObject3DForTransfer(mesh).object) as Group;
  const rays = [[373.24, 1065.77], [371.36, 1065.93], [374.04, 1065.91], [372.61, 1065.77],
    [371.25, 1058.79], [365.61, 1068.70], [372.32, 1068.45], [371.91, 1067.09]];
  function hits() {
    transferred.updateMatrixWorld(true);
    return rays.map(([x, z]) =>
      new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0)).intersectObject(transferred).length > 0);
  }
  const before = hits();
  expect(before.slice(0, 4)).toEqual([true, true, true, true]);
  expect(before.slice(4).some(Boolean)).toBeTrue();
  cutPotsdamerPassarelleGround(transferred, false);
  expect(hits()).toEqual([false, false, false, false, ...before.slice(4)]);
  disposeStaticAudit(mesh);
  disposeStaticAudit(transferred);
});
