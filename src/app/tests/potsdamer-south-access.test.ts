import { expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createGroundSlabs } from "../src/terrainPayload";
import { createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian } from "../src/pedestrianNavigation";
import { schwellenraumFlightPointIsBlocked } from "../src/SchwellenraumNavigation";
import { createPotsdamerSouthAccess, installPotsdamerSouthNavigation } from "../src/PotsdamerSouthAccess";
import { cutPotsdamerSouthGround } from "../src/PotsdamerSouthGround";
import { POTSDAMER_DETAIL_PROFILE } from "../src/expandedCityProfiles";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";
import type { VoxelPayload } from "../src/terrainPayload";

const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;
const hall = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.halls[1];
const cos = Math.cos(hall.rotationY), sin = Math.sin(hall.rotationY);
const world = (x: number, z: number, y: number = hall.groundY) => new Vector3(hall.centerWorldM[0] + x * cos + z * sin, y,
  hall.centerWorldM[1] - x * sin + z * cos);

for (const native of [false, true]) test(`${native ? "Native" : "Drawn"} retains real terrain outside the aperture and permits both walks down and back`, () => {
  const slabs = createGroundSlabs(ground, native ? "Voxel ground runs" : "Drawn ground slabs", {}, {
    skipAtWorld: (x, z) => x < 269 || x > 322 || z < 1109 || z > 1160,
    parkRelief: native ? "native" : "drawn",
  });
  const access = createPotsdamerSouthAccess(native);
  const root = new Group().add(slabs, access);
  expect(cutPotsdamerSouthGround(root, native, true)).toBeTrue();
  root.updateMatrixWorld(true);
  const point = world(5, 7, 9);
  const floor = new Raycaster(point, new Vector3(0, -1, 0), 0, 12).intersectObject(root)[0];
  expect(floor.point.y).toBeCloseTo(hall.sourceGroundYM, 3);
  const pavement = new Raycaster(world(10, 7, 9), new Vector3(0, -1, 0), 0, 12).intersectObject(root)[0];
  expect(pavement.point.y).toBeGreaterThan(4.8);
  const moving: Mesh[] = [];
  access.traverse(o => { if (o instanceof InstancedMesh && o.userData.hbfMotionV291) moving.push(o); });
  expect(moving.map(m => m.userData.hbfMotionV291.direction)).toEqual([-1, 1, -1, 1]);

  const environment = createPedestrianEnvironment(ground, { water: [] }, null, prisms, undefined, { potsdamerStationPhoto: true });
  let admitted = false;
  installPotsdamerSouthNavigation(environment, () => admitted, () => native);
  expect(environment.interiorGroundAt?.(point.x, point.z)).toBeNull();
  admitted = true;
  expect(environment.interiorGroundAt?.(point.x, point.z)).toBeCloseTo(hall.sourceGroundYM, 6);
  const cabin = world(5, 7, .9);
  expect(schwellenraumFlightPointIsBlocked(cabin, environment, .23)).toBeFalse();

  for (const x of [-5, 5]) {
    const entrance = world(x, -14);
    let state = createPedestrianState(environment, { x: entrance.x, z: entrance.z,
      yaw: 0, groundYHint: hall.groundY, preserveHorizontalPosition: true });
    const walkTo = (z: number) => {
      const target = world(x, z);
      const analog = native ? .65 : 1;
      for (let n = 0; n < 700; n++) {
        const dx = target.x - state.x, dz = target.z - state.z;
        const distance = Math.hypot(dx, dz);
        if (distance < .02) return;
        state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) }, {
          forward: analog, look: 0, sprint: false, strafe: 0, turn: 0,
        }, Math.min(.04, distance / (PEDESTRIAN_WALK_SPEED_MPS * analog)), environment).state;
      }
      throw new Error(`Potsdamer stair route to ${z} blocked at ${state.x}, ${state.groundY}, ${state.z}`);
    };
    walkTo(7);
    expect(state.groundY).toBeCloseTo(hall.sourceGroundYM, 5);
    walkTo(-14);
    expect(state.groundY).toBeGreaterThan(4.8);
  }
  disposeStaticAudit(root);
});
