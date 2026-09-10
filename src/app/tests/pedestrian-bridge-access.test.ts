import { describe, expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { createAdlerBridge } from "../src/AdlerBridge";
import { createHistoricParkBridgeCollision } from "../src/HistoricParkBridgeCollision";
import { BRIDGE_PROFILES, createBridgeStructures, type PrismPayload, type SurfacePayload } from "../src/IsometricCityWorld";
import { createLoewenBridge } from "../src/LoewenBridge";
import { createMinecraftHistoricParkBridges } from "../src/MinecraftHistoricParkBridges";
import { createMinecraftHumboldthafenDetails } from "../src/MinecraftHumboldthafen";
import { worldGroundSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { weidendammerBridgeSolidAt } from "../src/WeidendammerBridgeDetails";
import { createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked, pedestrianPointIsWater, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian, type PedestrianEnvironment, type PedestrianState } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";

const MODES: readonly VisualMode[] = ["day", "night", "snowstorm", "minecraft", "schwellenraum"];
const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const surfaces = await Bun.file(new URL("../public/mesh/regierungsviertel/surface-polygons.json", import.meta.url)).json() as SurfacePayload;
const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const profiles = BRIDGE_PROFILES.filter(({ surveyedDeck }) => surveyedDeck);
const historic = createHistoricParkBridgeCollision(ground);

function environmentFor(mode: VisualMode): PedestrianEnvironment {
  const environment = createPedestrianEnvironment(ground, surfaces, null, prisms);
  environment.visualMode = () => mode;
  environment.interiorSolidAt = (x, y, z, radius) => weidendammerBridgeSolidAt(x, y, z, radius) ||
    (mode === "schwellenraum" && historic.solidAt(x, y, z, radius));
  return environment;
}

function world(profile: typeof profiles[number], u: number, v = 0): [number, number] {
  const axis = profile.axis!;
  const length = Math.hypot(...axis);
  const offset = (profile.curveSagittaM ?? 0) * Math.max(0, 1 - (u / profile.surveyedDeck!.halfLengthM) ** 2);
  return [profile.world[0] + (u * axis[0] - (v + offset) * axis[1]) / length,
    profile.world[1] + (u * axis[1] + (v + offset) * axis[0]) / length];
}

function walkTo(state: PedestrianState, target: [number, number], environment: PedestrianEnvironment, forward: number): PedestrianState {
  for (let frame = 0; frame < 800; frame += 1) {
    const dx = target[0] - state.x;
    const dz = target[1] - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.02) return state;
    state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) },
      { forward, strafe: 0, turn: 0, look: 0, sprint: false },
      Math.min(0.04, distance / (PEDESTRIAN_WALK_SPEED_MPS * forward)), environment).state;
  }
  throw new Error(`Stopped at [${state.x}, ${state.groundY}, ${state.z}], target [${target}]`);
}

describe("source-bound bridge pedestrian routes", () => {
  test("committed water polygons really continue underneath all nine bridge decks", () => {
    expect(profiles).toHaveLength(9);
    const environment = environmentFor("day");
    for (const profile of profiles) {
      expect(pedestrianPointIsWater(...profile.world, environment.water)).toBeTrue();
      expect(environment.bridgeGroundAt!(...profile.world)).not.toBeNull();
    }
  });

  for (const mode of MODES) {
    for (const profile of profiles) test(`${mode}, ${profile.name}: cross and return with keyboard and partial joystick, without jumping`, () => {
      const environment = environmentFor(mode);
        for (const forward of [1, 0.35]) {
          const halfLength = profile.surveyedDeck!.halfLengthM;
          const start = world(profile, -halfLength - 3);
          let state = createPedestrianState(environment, { x: start[0], z: start[1], yaw: 0 });
          expect(Math.hypot(state.x - start[0], state.z - start[1])).toBeLessThan(0.02);
          state = walkTo(state, world(profile, 0), environment, forward);
          expect(state.groundY).toBeCloseTo(environment.bridgeGroundAt!(...profile.world)!, 5);
          const far = world(profile, halfLength + 3);
          state = walkTo(state, far, environment, forward);
          state = walkTo(state, start, environment, forward);
          expect(state.jumpOffset).toBe(0);
        }
    });
  }

  test("bridge support cannot admit a pedestrian off the side into open water", () => {
    const environment = environmentFor("day");
    for (const profile of profiles) {
      const edge = world(profile, 0, profile.surveyedDeck!.halfWidthM + 0.6);
      expect(environment.bridgeGroundAt!(...edge)).toBeNull();
      const start = createPedestrianState(environment, { x: profile.world[0], z: profile.world[1], yaw: 0 });
      let state = start;
      for (let frame = 0; frame < 70; frame += 1) {
        state = stepPedestrian({ ...state, yaw: Math.atan2(edge[0] - state.x, state.z - edge[1]) },
          { forward: 1, strafe: 0, turn: 0, look: 0, sprint: true }, 0.04, environment).state;
      }
      expect(environment.bridgeGroundAt!(state.x, state.z)).not.toBeNull();
    }
  });

  test("Löwenbrücke keeps an actual 84 cm body clear 30 cm off centre, without double expansion", () => {
    const profile = profiles.find(({ kind }) => kind === "suspension")!;
    const environment = environmentFor("schwellenraum");
    for (const side of [-1, 1]) {
      const point = world(profile, 0, side * 0.3);
      const y = environment.bridgeGroundAt!(...point)!;
      expect(historic.solidAt(point[0], y + 0.9, point[1], 0.42)).toBeFalse();
      expect(pedestrianPointIsBlocked(point[0], point[1], y, environment.obstacles, environment)).toBeFalse();
      const rail = world(profile, 0, side * 0.9);
      expect(pedestrianPointIsBlocked(rail[0], rail[1], y, environment.obstacles, environment)).toBeTrue();
    }
  });

  test("mode changes preserve an idle bridge pose exactly; the first walking step uses the active deck", () => {
    let mode: VisualMode = "day";
    const environment = environmentFor(mode);
    environment.visualMode = () => mode;
    let lastState: PedestrianState | null = null;
    for (const profile of profiles) {
      for (const forward of [1, 0.35]) {
        mode = "day";
        const axis = profile.axis!;
        let state = createPedestrianState(environment, {
          x: profile.world[0], z: profile.world[1], yaw: Math.atan2(axis[0], -axis[1]),
        });
        for (const nextMode of ["minecraft", "schwellenraum", "night", "snowstorm", "day"] as const) {
          mode = nextMode;
          const idle = stepPedestrian(state, { forward: 0, strafe: 0, look: 0, turn: 0, sprint: false }, 0.016, environment);
          expect(idle.state).toBe(state);
          expect(idle.changed).toBeFalse();

          const moved = stepPedestrian(state, { forward, strafe: 0, look: 0, turn: 0, sprint: false }, 0.016, environment);
          expect(moved.respawned).toBeFalse();
          expect(Math.hypot(moved.state.x - state.x, moved.state.z - state.z))
            .toBeCloseTo(PEDESTRIAN_WALK_SPEED_MPS * forward * 0.016, 6);
          const deckY = environment.bridgeGroundAt!(moved.state.x, moved.state.z);
          expect(deckY).not.toBeNull();
          expect(moved.state.groundY).toBeCloseTo(deckY!, 6);
          expect(moved.state.grounded).toBeTrue();
          expect(moved.state.jumpOffset).toBe(0);
          expect(pedestrianPointIsBlocked(moved.state.x, moved.state.z,
            moved.state.groundY, environment.obstacles, environment)).toBeFalse();
          state = moved.state;
        }
        lastState = state;
      }
    }
    environment.protectedVolumeAt = () => true;
    expect(pedestrianPointIsBlocked(lastState!.x, lastState!.z, lastState!.groundY, environment.obstacles, environment)).toBeTrue();
  });

  test("navigation height agrees with real drawn and block deck meshes", () => {
    const bridgeRoot = createBridgeStructures(ground, "mobile")!;
    const roots = [bridgeRoot, createLoewenBridge(ground), createAdlerBridge(ground), createMinecraftHistoricParkBridges(worldGroundSampler(ground)), createMinecraftHumboldthafenDetails(ground)];
    roots.forEach((root) => root.updateMatrixWorld(true));
    for (const mode of ["day", "minecraft"] as const) {
      const environment = environmentFor(mode);
      for (const profile of profiles) {
        const root = profile.kind === "suspension" ? mode === "minecraft" ? roots[3] : roots[1]
          : profile.kind === "adler" ? mode === "minecraft" ? roots[3] : roots[2]
          : profile.kind === "openFrame" && mode === "minecraft" ? roots[4] : roots[0];
        for (const factor of [-0.6, 0, 0.6]) {
          const point = world(profile, profile.surveyedDeck!.halfLengthM * factor, profile.kind === "openFrame" ? 11 : profile.kind === "ironArch" ? 8.8 : 0.25);
          const y = environment.bridgeGroundAt!(...point)!;
          const meshes: Mesh[] = [];
          root.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
          const hits = new Raycaster(new Vector3(point[0], y + 0.3, point[1]), new Vector3(0, -1, 0), 0, 0.65).intersectObjects(meshes, false);
          expect(hits.length).toBeGreaterThan(0);
          expect(Math.abs(hits[0].point.y - y)).toBeLessThan(0.06);
        }
      }
    }
    roots.forEach((root) => root.traverse((object) => { if (object instanceof Mesh) object.geometry.dispose(); }));
  });
});
