import { expect, test } from "bun:test";
import { Group, Raycaster, Vector3 } from "three";
import data from "../src/data/nordbahnhofPublicAccess.json";
import { buildNordbahnhofPublicAccess, prepareNordbahnhofDrawn, prepareNordbahnhofNative } from "../src/NordbahnhofPublicAccess";
import { currentNordbahnhofPlan, installNordbahnhofNavigation, registerNordbahnhofPublicAccess } from "../src/NordbahnhofNavigation";
import { createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";
import { createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian,
  type PedestrianEnvironment, type PedestrianState } from "../src/pedestrianNavigation";
import { resolveSchwellenraumFlightTranslation, schwellenraumFlightPointIsBlocked } from "../src/schwellenraumNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

type Point = readonly number[];
const meshes = new URL("../public/mesh/regierungsviertel/", import.meta.url);
const ground = await Bun.file(new URL("ground-context.json", meshes)).json() as VoxelPayload;
const voxels = await Bun.file(new URL("minecraft-voxels.json", meshes)).json() as VoxelPayload;
const prisms = await Bun.file(new URL("lod2-prisms.json", meshes)).json() as PrismPayload;
const axes = data.portals as unknown as [number, Point[]][];
const approach = [1086.8, -1535];
const common = axes.slice(0, 6).flatMap(([, axis], i) => i ? axis.slice(1) : axis);
const lowerRoutes = [[...axes[6][1].slice(1), ...axes[7][1].slice(1), [1110.792, -1507.708]],
  [...axes[9][1].slice(1), ...axes[10][1].slice(1), [1096.2475, -1523.094]]];

function walk(state: PedestrianState, point: Point, environment: PedestrianEnvironment) {
  for (let n = 0; n < 420; n++) {
    const dx = point[0] - state.x, dz = point[1] - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .018) return state;
    state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) },
      { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
      Math.min(.032, distance / PEDESTRIAN_WALK_SPEED_MPS), environment).state;
  }
  throw new Error(`Nordbahnhof path to ${point} blocked at ${state.x}, ${state.groundY}, ${state.z}`);
}

for (const native of [false, true]) test(`Nordbahnhof park access to both public platform stair landings and back (${native ? "Native" : "Drawn"})`, () => {
  const payload = native ? voxels : ground;
  const prepared = native ? prepareNordbahnhofNative(prisms.buildings, payload) : prepareNordbahnhofDrawn(prisms.buildings, payload);
  expect(prepared).not.toBeNull();
  const plan = prepared!.plan;
  const slabs = createGroundSlabs(payload, native ? "Voxel ground runs" : "Drawn ground slabs", {}, {
    skipAtWorld: (x, z) => x < 1070 || x > 1132 || z < -1555 || z > -1490,
    parkRelief: native ? "native" : "drawn",
  });
  const world = new Group().add(slabs);
  const model = buildNordbahnhofPublicAccess(plan);
  const environment = createPedestrianEnvironment(payload, { water: [] }, null, prisms);
  environment.visualMode = () => native ? "minecraft" : "day";
  installNordbahnhofNavigation(environment, () => currentNordbahnhofPlan(world));
  expect(environment.interiorGroundAt?.(1097.959, -1524.675, -2.79)).toBeNull();
  expect(plan.cutGround(world)).toBeTrue();
  registerNordbahnhofPublicAccess(world, model, plan);
  world.updateMatrixWorld(true);
  const y = (x: number, z: number, from: number) => new Raycaster(new Vector3(x, from, z), new Vector3(0, -1, 0))
    .intersectObject(world)[0]?.point.y;
  expect(y(1086, -1537, 6)).toBeCloseTo(5.2, 3);
  expect(y(1104.014, -1515.059, 2)).toBeCloseTo(1.29, 3);
  expect(schwellenraumFlightPointIsBlocked({ x: 1104.014, y: 2.3, z: -1515.059 }, environment, .23)).toBeFalse();
  expect(schwellenraumFlightPointIsBlocked({ x: 1104.014, y: 3.64, z: -1515.059 }, environment, .23)).toBeTrue();

  const segments = data.portals as unknown as [number, Point[], number, number, number][];
  const flightSegments = [segments.slice(0, 8), [...segments.slice(0, 6), ...segments.slice(9, 11)]];
  for (const legs of flightSegments) {
    for (const [source, line, start, end] of legs) {
      const lengths = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
      const length = lengths.reduce((sum, span) => sum + span, 0);
      // The 62cm camera sphere needs a slight sweep into the outside of one
      // Drawn corner. The still narrower default walking route stays central.
      const point = (p: Point, metres: number) => ({ x: p[0], y: start + (end - start) * metres / length + 1.15,
        z: p[1] - (!native && (source === 396459321 || source === 396459318) &&
          p[0] === 1103.369 && p[1] === -1519.29 ? .18 : 0) });
      let progress = 0;
      for (let i = 0; i < lengths.length; i++) {
        const from = point(line[i], progress);
        progress += lengths[i];
        const to = point(line[i + 1], progress);
        const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
        const flight = resolveSchwellenraumFlightTranslation(from, delta, environment);
        expect(Math.hypot(flight.position.x - to.x, flight.position.y - to.y, flight.position.z - to.z)).toBeLessThan(.035);
      }
    }
  }

  for (const branch of lowerRoutes) {
    let state = createPedestrianState(environment, { x: approach[0], z: approach[1], yaw: 0,
      groundYHint: 5.2, preserveHorizontalPosition: true });
    const itinerary = [...common, ...branch];
    for (const point of itinerary) state = walk(state, point, environment);
    expect(state.groundY).toBeCloseTo(-2.79, 1);
    for (const point of [...itinerary.slice(0, -1).reverse(), approach]) state = walk(state, point, environment);
    expect(state.groundY).toBeCloseTo(5.2, 2);
  }
  model.removeFromParent();
  expect(currentNordbahnhofPlan(world)).toBeNull();
  disposeStaticAudit(model);
  disposeStaticAudit(world);
});

test("Nordbahnhof closes on changed source prisms and exact native runs", () => {
  const first = prisms.buildings.find(b => b.id === "97805995")!;
  expect(prepareNordbahnhofDrawn([first], ground)).toBeNull();
  expect(prepareNordbahnhofDrawn(prisms.buildings.map(b => b === first ? { ...b, h_dm: b.h_dm + 1 } : b), ground)).toBeNull();
  const [x, z, offset, length] = data.voxels[0];
  const prepared = prepareNordbahnhofNative(prisms.buildings, voxels)!;
  expect(prepared.expectedColumns).toBe(8);
  const buildingRows = [...voxels.building_rows!];
  const rowIndex = z - voxels.grid.min_z_idx;
  buildingRows[rowIndex] = buildingRows[rowIndex].map(run => run[0] === offset && run[1] === length
    ? [run[0], run[1], run[2], run[3] + 1, run[4]] : run);
  expect(prepareNordbahnhofNative(prisms.buildings, { ...voxels, building_rows: buildingRows })).toBeNull();
  expect(prepared.cuts(x, z, -1, -1, -1)).toEqual([]);
});
