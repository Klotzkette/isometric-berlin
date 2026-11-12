import { expect, test } from "bun:test";
import { InstancedMesh, Raycaster, Vector3 } from "three";
import {
  createPotsdamerRegionalAccess, installPotsdamerRegionalNavigation, POTSDAMER_REGIONAL_PLATFORM_Y,
  POTSDAMER_REGIONAL_UPPER_Y, potsdamerRegionalFloorAt,
} from "../src/PotsdamerRegionalAccess";
import {
  createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian,
} from "../src/pedestrianNavigation";
import { schwellenraumFlightPointIsBlocked } from "../src/SchwellenraumNavigation";
import type { VoxelPayload } from "../src/terrainPayload";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;
const routes = [
  [[269.9, 1041.53], [269.46, 1046.86], [268.22, 1062.33], [268.11, 1064.18]],
  [[289.91, 1042.73], [289.59, 1048.04], [288.68, 1063], [288.59, 1064.48]],
  [[264.57, 1118.94], [265.13, 1112.37], [266.06, 1097.41], [266.18, 1095.80]],
  [[286.31, 1120.16], [286.73, 1113.77], [287.63, 1098.81], [287.73, 1097.21]],
] as const;

for (const native of [false, true]) {
  test(`${native ? "Minecraft" : "Drawn"}: each regional stair bank supports a walk and flight in both directions`, async () => {
    const terrain = native ? "minecraft-voxels.json" : "ground-context.json";
    const source = await Bun.file(new URL(`../public/mesh/regierungsviertel/${terrain}`, import.meta.url)).json() as VoxelPayload;
    const environment = createPedestrianEnvironment(source, { water: [] }, null, prisms);
    installPotsdamerRegionalNavigation(environment, () => true, () => native);
    for (const route of routes) {
      let state = createPedestrianState(environment, {
        x: route[0][0], z: route[0][1], yaw: 0,
        groundYHint: POTSDAMER_REGIONAL_UPPER_Y, preserveHorizontalPosition: true,
      });
      expect(state.groundY).toBeCloseTo(POTSDAMER_REGIONAL_UPPER_Y, 4);
      const walk = ([x, z]: readonly [number, number]) => {
        for (let i = 0; i < 450; i++) {
          const dx = x - state.x, dz = z - state.z, distance = Math.hypot(dx, dz);
          if (distance < .019) return;
          state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) },
            { forward: 1, look: 0, strafe: 0, turn: 0, sprint: false },
            Math.min(.04, distance / PEDESTRIAN_WALK_SPEED_MPS), environment).state;
        }
        throw Error(`Route to ${x}/${z} blocked at ${state.x}/${state.z}/${state.groundY}`);
      };
      route.slice(1).forEach(walk);
      expect(state.groundY).toBeCloseTo(POTSDAMER_REGIONAL_PLATFORM_Y, 4);
      route.slice(0, -1).reverse().forEach(walk);
      expect(state.groundY).toBeCloseTo(POTSDAMER_REGIONAL_UPPER_Y, 4);

      let groundY = POTSDAMER_REGIONAL_UPPER_Y;
      for (let i = 1; i < route.length; i++) {
        const [x0, z0] = route[i - 1], [x1, z1] = route[i];
        for (let j = 1; j <= 40; j++) {
          const x = x0 + (x1 - x0) * j / 40, z = z0 + (z1 - z0) * j / 40;
          const floor = potsdamerRegionalFloorAt(x, z, native, groundY);
          if (floor === null) throw Error(`Missing flight support at ${x}/${z}/${groundY}`);
          groundY = floor;
          if (schwellenraumFlightPointIsBlocked({ x, y: floor + 1.61, z }, environment, .62)) {
            throw Error(`Blocked flight at ${x}/${z}/${floor}`);
          }
        }
      }
    }
  });

  test(`${native ? "Minecraft" : "Drawn"}: both exact islands are visible with a real deck and moving fixtures`, () => {
    const model = createPotsdamerRegionalAccess(native);
    model.updateMatrixWorld(true);
    const moving: number[] = [];
    model.traverse(object => {
      if (object instanceof InstancedMesh && object.userData.hbfMotionV291) {
        moving.push(object.userData.hbfMotionV291.direction);
      }
    });
    expect(moving).toEqual([-1, 1, -1, 1, -1, 1, -1, 1]);
    for (const x of [267, 287]) {
      const y = new Raycaster(new Vector3(x, -8.5, 1080), new Vector3(0, -1, 0), 0, 5)
        .intersectObject(model)[0]?.point.y;
      expect(y).toBeCloseTo(POTSDAMER_REGIONAL_PLATFORM_Y, 4);
    }
    for (const route of routes) {
      const [x, z] = route[1];
      const y = new Raycaster(new Vector3(x, POTSDAMER_REGIONAL_UPPER_Y + 1.5, z),
        new Vector3(0, 1, 0), 0, 2).intersectObject(model)[0]?.point.y;
      expect(y).toBeCloseTo(POTSDAMER_REGIONAL_UPPER_Y + 2.42, 4);
    }
    expect(potsdamerRegionalFloorAt(267, 1080, native, 5.4)).toBeNull();
    disposeStaticAudit(model);
  });
}
