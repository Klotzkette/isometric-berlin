import { expect, test } from "bun:test";
import { Group, Raycaster, Vector3 } from "three";
import {
  installPotsdamerPassarelleNavigation, POTSDAMER_PASSARELLE_Y,
} from "../src/PotsdamerPassarelle";
import {
  createPotsdamerPavilionRoutes, installPotsdamerPavilionNavigation, potsdamerPavilionTerrainAdmitted,
} from "../src/PotsdamerPavilionRoutes";
import {
  createPotsdamerRegionalAccess, installPotsdamerRegionalNavigation,
  POTSDAMER_REGIONAL_PLATFORM_Y, POTSDAMER_REGIONAL_UPPER_Y,
} from "../src/PotsdamerRegionalAccess";
import { POTSDAMER_SBAHN_Y } from "../src/PotsdamerSBahn";
import { createPotsdamerNorthPavilionDrawn, createPotsdamerSouthStationPhotoDrawn } from "../src/PotsdamerStationDrawn";
import { preparePotsdamerNorthPavilionNative, preparePotsdamerSouthStationPhotoTransfer } from "../src/PotsdamerStationPhotoDetails";
import { installPotsdamerSouthNavigation } from "../src/PotsdamerSouthAccess";
import { addPotsdamerPassarelle } from "../src/PotsdamerSouthGround";
import {
  createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian,
} from "../src/pedestrianNavigation";
import { schwellenraumFlightPointIsBlocked } from "../src/SchwellenraumNavigation";
import { createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

type Point = readonly [number, number];
type Route = readonly Point[];

const source = (name: string) => Bun.file(new URL(`../public/mesh/regierungsviertel/${name}`, import.meta.url));
const prisms = await source("lod2-prisms.json").json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;
const drawn = await source("ground-context.json").json() as VoxelPayload;
const minecraft = await source("minecraft-voxels.json").json() as VoxelPayload;

const leipzigerNord = [
  [373.15, 1028.84], [368, 1029.28], [361.17, 1029.90], [356.4, 1029.9], [356.4, 1042.3],
] as const;
const leipzigerSued = [
  [375.8, 1064.77], [368.9, 1065.32], [361.7, 1065.8], [360, 1062.4], [356.4, 1062.4], [356.4, 1042.3],
] as const;
const sBahn = [
  [[327.2, 1042.3], [327.2, 1036.98], [318.9, 1036.68], [318.66, 1044.7], [318.6, 1045.4]],
  [[348, 1042.3], [348, 1031.15], [340.30, 1030.93], [340.01, 1039], [339.98, 1039.8]],
] as const;

const nordPavillon = [
  [293.55, 1023.9], [293.5, 1023.43], [292.96, 1018.66], [292.82, 1017.47],
  [292.28, 1012.71], [291.71, 1007.63], [293.84, 1007.76], [314.17, 1009.34],
  [311.51, 1025.72], [310.82, 1029.93],
] as const;
const suedPavillon = [
  [301.62, 1127.5], [301.69, 1128.05], [302.25, 1132.82], [302.39, 1134.06],
  [302.93, 1138.82], [303.67, 1145.28], [299.95, 1145.7], [296.96, 1146.04],
  [295.77, 1146.17], [292.79, 1146.51], [288.88, 1146.27], [290.47, 1120.37],
] as const;
const regionalNord = [[269.9, 1041.53], [269.46, 1046.86], [268.22, 1062.33], [268.11, 1064.18]] as const;
const regionalSued = [[286.31, 1120.16], [286.73, 1113.77], [287.63, 1098.81], [287.73, 1097.21]] as const;
const northCrossing = [[293.68, 1042.96], [294.26, 1033.43], [294.53, 1028.95]] as const;
const lowerSuedToSony = [[293.86, 1120.54], [298.52, 1043.25], ...northCrossing] as const;
const sonyStairs = [[294.53, 1028.95], [304.06, 1029.69], [310.82, 1029.93]] as const;
const sonyToEast = [[327.2, 1029.9], [327.2, 1042.3], [356.4, 1042.3]] as const;

function station(native: boolean) {
  const payload = native ? minecraft : drawn;
  const root = new Group().add(createGroundSlabs(payload, native ? "Voxel ground runs" : "Drawn ground slabs", {}, {
    skipAtWorld: (x, z) => x < 245 || x > 385 || z < 995 || z > 1161,
  }));
  expect(potsdamerPavilionTerrainAdmitted(payload)).toBeTrue();
  const north = native
    ? preparePotsdamerNorthPavilionNative(prisms.buildings, payload)?.group
    : createPotsdamerNorthPavilionDrawn(prisms.buildings);
  const south = native
    ? preparePotsdamerSouthStationPhotoTransfer(prisms.buildings, payload, true)?.group
    : createPotsdamerSouthStationPhotoDrawn(prisms.buildings, true);
  if (!north || !south) throw new Error("Exact pavilion source shells were not admitted");
  const pavilions = createPotsdamerPavilionRoutes(native);
  root.add(north, south, pavilions.root, createPotsdamerRegionalAccess(native));
  expect(pavilions.cutGround(root)).toBeTrue();
  addPotsdamerPassarelle(root, native, true);
  expect(root.userData.potsdamerPassarellePublicAccess).toBeTrue();
  expect(root.userData.potsdamerPassarelleWestDock).toBeTrue();
  root.updateMatrixWorld(true);

  const environment = createPedestrianEnvironment(payload, { water: [] }, null, prisms, undefined, {
    potsdamerStationPhoto: true,
  });
  environment.visualMode = () => native ? "minecraft" : "day";
  installPotsdamerSouthNavigation(environment, () => false, () => native);
  installPotsdamerPassarelleNavigation(environment, () => true, () => native, () => true);
  installPotsdamerPavilionNavigation(environment, () => pavilions);
  installPotsdamerRegionalNavigation(environment, () => true, () => native);

  function walker([x, z]: Point, label: string) {
    let state = createPedestrianState(environment, { x, z, yaw: 0, groundYHint: 5.4, preserveHorizontalPosition: true });
    expect(state.groundY).toBeGreaterThan(4.8);
    function walk(route: Route, checkFlight = false) {
      for (const [tx, tz] of route) {
        let stagnant = 0;
        for (let frame = 0; ; frame++) {
          const dx = tx - state.x, dz = tz - state.z, distance = Math.hypot(dx, dz);
          if (distance < .022) break;
          if (checkFlight && frame % 10 === 0) flightClear();
          const old = state;
          state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) }, {
            forward: .8, look: 0, sprint: false, strafe: 0, turn: 0,
          }, Math.min(.035, distance / (.8 * PEDESTRIAN_WALK_SPEED_MPS)), environment).state;
          if (Math.hypot(old.x - state.x, old.z - state.z) > .0001) stagnant = 0;
          else stagnant++;
          if (stagnant >= 30 || frame >= 1800) throw new Error(`${label}: route to ${tx}, ${tz} blocked at ${state.x.toFixed(3)}, ${state.groundY.toFixed(3)}, ${state.z.toFixed(3)}`);
        }
      }
    }
    function flightClear() {
      const point = new Vector3(state.x, state.groundY + 1.55, state.z);
      if (schwellenraumFlightPointIsBlocked(point, environment)) {
        throw new Error(`${label}: flight blocked at ${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)}`);
      }
    }
    function level(expected: number) {
      expect(state.groundY).toBeCloseTo(expected, 4);
      flightClear();
    }
    return { walk, level, outside: () => expect(state.groundY).toBeGreaterThan(4.8) };
  }
  function surface([x, z]: Point, y: number, start: number) {
    const hit = new Raycaster(new Vector3(x, start, z), new Vector3(0, -1, 0)).intersectObject(root)[0];
    expect(hit?.point.y).toBeCloseTo(y, 4);
  }
  function clearRun(x: number, y: number, z: number, length: number) {
    const ray = new Raycaster(new Vector3(x, y, z), new Vector3(0, 0, 1), 0, length);
    expect(ray.intersectObject(root)).toHaveLength(0);
  }
  return { root, walker, surface, clearRun };
}

for (const native of [false, true]) {
  const mode = native ? "Minecraft" : "Drawn";

  test(`${mode} from both Leipziger Platz exits to both S-Bahn islands and back`, () => {
    const { root, walker, surface } = station(native);
    try {
      for (const leipziger of [leipzigerNord, leipzigerSued]) {
        const pedestrian = walker(leipziger[0], mode + " Leipziger Platz");
        pedestrian.walk(leipziger.slice(1));
        pedestrian.level(POTSDAMER_PASSARELLE_Y);
        for (const island of sBahn) {
          pedestrian.walk(island);
          pedestrian.level(POTSDAMER_SBAHN_Y);
          surface(island.at(-1)!, POTSDAMER_SBAHN_Y, POTSDAMER_SBAHN_Y + 1.7);
          pedestrian.walk([...island.slice(0, -1).reverse(), leipziger.at(-1)!]);
          pedestrian.level(POTSDAMER_PASSARELLE_Y);
        }
        pedestrian.walk(leipziger.slice(0, -1).reverse());
        pedestrian.outside();
      }
    } finally { disposeStaticAudit(root); }
  });

  test(`${mode} round trips from each glass pavilion to regional and S-Bahn platforms`, () => {
    const { root, walker, surface, clearRun } = station(native);
    try {
      // The same two handoffs must also be open in the rendered lining.
      clearRun(311.51, POTSDAMER_PASSARELLE_Y + 1.55, 1023.2, 2.6);
      clearRun(269.8, POTSDAMER_REGIONAL_UPPER_Y + 1.55, 1041.9, 2.7);
      for (const entry of [suedPavillon, nordPavillon]) {
        const north = entry === nordPavillon;
        const pedestrian = walker(entry[0], mode + (north ? " Pavillon Nord" : " Pavillon Süd"));
        const regional = north ? regionalNord : regionalSued;
        pedestrian.walk(entry.slice(1));
        if (north) {
          pedestrian.level(POTSDAMER_PASSARELLE_Y);
          pedestrian.walk(sonyStairs.slice(0, -1).reverse(), true);
          pedestrian.walk(northCrossing.slice(0, -1).reverse());
        }
        pedestrian.level(POTSDAMER_REGIONAL_UPPER_Y);
        pedestrian.walk(regional);
        pedestrian.level(POTSDAMER_REGIONAL_PLATFORM_Y);
        surface(regional.at(-1)!, POTSDAMER_REGIONAL_PLATFORM_Y, POTSDAMER_REGIONAL_PLATFORM_Y + 1.7);
        pedestrian.walk(regional.slice(0, -1).reverse());
        pedestrian.level(POTSDAMER_REGIONAL_UPPER_Y);
        pedestrian.walk(north ? northCrossing : lowerSuedToSony);
        pedestrian.walk(sonyStairs.slice(1), true);
        pedestrian.level(POTSDAMER_PASSARELLE_Y);
        pedestrian.walk(sonyToEast, true);
        const island = sBahn[north ? 0 : 1];
        pedestrian.walk(island);
        pedestrian.level(POTSDAMER_SBAHN_Y);
        surface(island.at(-1)!, POTSDAMER_SBAHN_Y, POTSDAMER_SBAHN_Y + 1.7);
        pedestrian.walk([...island.slice(0, -1).reverse(), sonyToEast.at(-1)!]);
        pedestrian.walk([...sonyToEast.slice(0, -1).reverse(), sonyStairs.at(-1)!], true);
        pedestrian.level(POTSDAMER_PASSARELLE_Y);
        if (!north) {
          pedestrian.walk(sonyStairs.slice(0, -1).reverse(), true);
          pedestrian.walk([...lowerSuedToSony.slice(0, -1).reverse(), entry.at(-1)!]);
        }
        pedestrian.walk(entry.slice(0, -1).reverse());
        pedestrian.outside();
      }
    } finally { disposeStaticAudit(root); }
  });
}
