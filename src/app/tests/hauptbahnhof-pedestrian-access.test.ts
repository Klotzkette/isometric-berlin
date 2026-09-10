import { describe, expect, test } from "bun:test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { createArchitecturalSignature, type HauptbahnhofModelSignature } from "../src/ArchitecturalLandmarks";
import { HAUPTBAHNHOF_ACCESS } from "../src/HauptbahnhofAccessProfile";
import { hauptbahnhofGroundAt, hauptbahnhofSolidAt, hauptbahnhofWalkableInteriorAt } from "../src/HauptbahnhofNavigation";
import { createMinecraftArchitecturalLandmarks, MINECRAFT_ARCHITECTURAL_PROFILES } from "../src/MinecraftArchitecturalLandmarks";
import { HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS, minecraftHeroGroundAt, minecraftHeroLocalToWorld } from "../src/MinecraftHeroNavigation";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { schwellenraumInteriorGroundAt, schwellenraumInteriorSolidAt } from "../src/SchwellenraumInteriors";
import { createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian, type PedestrianEnvironment, type PedestrianState } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";
import { createPedestrianRecoveryHistory, recoverPedestrian, rememberPedestrianRecoveryState } from "../src/pedestrianNavigation";

const MODES: readonly VisualMode[] = ["day", "night", "snowstorm", "minecraft", "schwellenraum"];
const station = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
const world = (x: number, z: number, y = 0) => minecraftHeroLocalToWorld(station, [x, y, z]);
const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;
const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const scene = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json() as { architectural_signatures: HauptbahnhofModelSignature[] };

function environmentFor(mode: VisualMode): PedestrianEnvironment {
  // Keep ALL source prisms and actual terrain: an unknown overlapping shell
  // must fail this test rather than disappearing through a prefiltered fixture.
  const environment = createPedestrianEnvironment(ground, { water: [] }, null, prisms);
  environment.walkableInteriorAt = (x, y, z, id) => visualModeWalkableInteriorAt(mode, x, y, z, id);
  environment.interiorSolidAt = (x, y, z, radius) => hauptbahnhofSolidAt(mode, x, y, z, 0) ||
    (mode === "schwellenraum" && schwellenraumInteriorSolidAt(x, y, z, radius));
  environment.interiorGroundAt = (x, z, hint) => hauptbahnhofGroundAt(mode, x, z, hint) ??
    (mode === "minecraft" ? minecraftHeroGroundAt(x, z) : mode === "schwellenraum" ? schwellenraumInteriorGroundAt(x, z, hint ?? environment.groundAt(x, z) ?? 0) : null);
  return environment;
}

function walkTo(state: PedestrianState, localX: number, localZ: number, environment: PedestrianEnvironment, analogForward: number): PedestrianState {
  const target = world(localX, localZ);
  for (let step = 0; step < 500; step += 1) {
    const dx = target[0] - state.x;
    const dz = target[2] - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.015) return state;
    const result = stepPedestrian(
      { ...state, yaw: Math.atan2(dx, -dz) },
      { forward: analogForward, strafe: 0, turn: 0, look: 0, sprint: false },
      Math.min(0.04, distance / (PEDESTRIAN_WALK_SPEED_MPS * analogForward)),
      environment,
    );
    state = result.state;
  }
  throw new Error(`Blocked en route to station local [${localX}, ${localZ}], world [${state.x}, ${state.groundY}, ${state.z}]`);
}

describe("Hauptbahnhof public entry in every visual mode", () => {
  test("local recovery stays on the actual source-bound gallery in all five modes", () => {
    for (const mode of MODES) {
      const environment = environmentFor(mode);
      const previous = world(12, 70);
      const current = world(12, 60);
      const floor = station.anchorWorld[1] + (mode === "minecraft" ? 1.32 : 0.25);
      const stateAt = (point: number[]) => createPedestrianState(environment, {
        x: point[0], z: point[2], yaw: 0.4,
        groundYHint: floor, preserveHorizontalPosition: true,
      });
      const history = createPedestrianRecoveryHistory();
      rememberPedestrianRecoveryState(history, stateAt(previous), environment);
      const result = recoverPedestrian(stateAt(current), environment, history);
      expect(result.source).toBe("checkpoint");
      expect(result.state.groundY).toBeCloseTo(floor, 5);
      expect(Math.hypot(result.state.x - previous[0], result.state.z - previous[2])).toBeLessThan(0.01);
    }
  });

  for (const mode of MODES) {
    test(`${mode}: north/south inbound, side-gallery visit and outbound with desktop and mobile analog input`, () => {
      const environment = environmentFor(mode);
      for (const side of [-1, 1]) {
        for (const forward of [1, 0.65]) {
          const start = world(1.745, side * 96);
          let state = createPedestrianState(environment, { x: start[0], z: start[2], yaw: 0 });
          expect(Math.hypot(state.x - start[0], state.z - start[2])).toBeLessThan(0.02);
          state = walkTo(state, 1.745, side * 85, environment, forward);
          state = walkTo(state, 12, side * 85, environment, forward);
          state = walkTo(state, 12, side * 60, environment, forward);
          expect(state.groundY).toBeCloseTo(station.anchorWorld[1] +
            (mode === "minecraft" ? 1.32 : 0.25), 5);
          state = walkTo(state, 12, side * 85, environment, forward);
          state = walkTo(state, 1.745, side * 85, environment, forward);
          state = walkTo(state, 1.745, side * 96, environment, forward);
          expect(Math.hypot(state.x - start[0], state.z - start[2])).toBeLessThan(0.02);
        }
      }
    });
  }

  test("keeps actual entrance jambs, side walls, lift shafts, pavilion and atrium guards solid", () => {
    for (const mode of MODES) {
      const environment = environmentFor(mode);
      const solidPoints = mode === "minecraft"
        ? [[8, 89.1], [19.2, 70]]
        : [[0, 90], [14, 90], [20, 60], [9.5, 33], [-9.5, -33], [0, 37], [0, 82], [9.5, 65]];
      for (const [x, z] of solidPoints) {
        const point = world(x, z);
        const floor = mode === "minecraft" ? 1.32 : 0.25;
        expect(pedestrianPointIsBlocked(point[0], point[2], station.anchorWorld[1] + floor, environment.obstacles, environment)).toBeTrue();
      }
    }
  });

  test("does not bypass foreign buildings, offices, upper floors or the daylight void", () => {
    const point = world(1.745, 90, 2);
    expect(hauptbahnhofWalkableInteriorAt(...point, "unrelated-building")).toBeFalse();
    expect(hauptbahnhofWalkableInteriorAt(...point)).toBeFalse();
    const source = HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS[0];
    expect(hauptbahnhofWalkableInteriorAt(...world(35, 80, 2), source)).toBeFalse();
    expect(hauptbahnhofWalkableInteriorAt(...world(0, 90, 8), source)).toBeFalse();
    for (const mode of ["day", "night", "snowstorm"] as const) {
      const voidPoint = world(0, -60);
      expect(hauptbahnhofGroundAt(mode, voidPoint[0], voidPoint[2])).toBeCloseTo(station.anchorWorld[1] - 15, 5);
      const foyerPoint = world(0, 85);
      expect(hauptbahnhofGroundAt(mode, foyerPoint[0], foyerPoint[2], station.anchorWorld[1] - 14.53)).toBeCloseTo(station.anchorWorld[1] - 15, 5);
    }
    for (const mode of MODES) {
      const environment = environmentFor(mode);
      environment.protectedVolumeAt = () => true;
      const entry = world(1.745, 90);
      expect(pedestrianPointIsBlocked(entry[0], entry[2], station.anchorWorld[1] + 1.32, environment.obstacles, environment)).toBeTrue();
    }
  });

  test("mode switches and spawning over the atrium resolve actual lower geometry, never invisible terrain", () => {
    for (const mode of ["day", "night", "snowstorm"] as const) {
      const environment = environmentFor(mode);
      for (const side of [-1, 1]) {
        const point = world(0, side * 60);
        const state = createPedestrianState(environment, {
          x: point[0], z: point[2], yaw: 0,
          groundYHint: station.anchorWorld[1] + 1.32,
          preserveHorizontalPosition: true,
        });
        expect(state.groundY).toBeCloseTo(station.anchorWorld[1] - 15, 5);
        expect(state.groundY).toBeLessThan(environment.groundAt(state.x, state.z)! - 14);
      }
    }
  });

  test("Minecraft entry routes pass the actual block gables, while their adjacent bays stay solid", () => {
    const root = createMinecraftArchitecturalLandmarks();
    root.updateMatrixWorld(true);
    const a = station.rotationDegrees * Math.PI / 180;
    for (const side of [-1, 1]) {
      const origin = new Vector3(...world(1.745, side * 94, 2.7));
      const direction = new Vector3(-side * Math.sin(a), 0, -side * Math.cos(a));
      expect(new Raycaster(origin, direction, 0, 9).intersectObject(root, true)).toHaveLength(0);
      const blockedOrigin = new Vector3(...world(8, side * 94, 2.7));
      expect(new Raycaster(blockedOrigin, direction, 0, 9).intersectObject(root, true).length).toBeGreaterThan(0);
    }
    root.traverse((object) => { if (object instanceof Mesh) object.geometry.dispose(); });
  });

  test("warm and cold worlds install the same source, floor and physical-solid policy", async () => {
    const viewer = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
    const warm = viewer.slice(viewer.indexOf("function ensureIsoWorld"), viewer.indexOf("function ensureVoxelWorld"));
    const cold = viewer.slice(viewer.indexOf("function ensureVoxelWorld"), viewer.indexOf("const PHOTO_FOV_DEGREES"));
    for (const builder of [warm, cold]) {
      expect(builder).toContain("visualModeWalkableInteriorAt(");
      expect(builder).toContain("hauptbahnhofGroundAt(runtime.lightingMode, x, z, currentGroundY)");
      expect(builder).toContain("hauptbahnhofSolidAt(runtime.lightingMode, x, y, z, 0)");
    }
  });

  test("all twelve drawn apertures are physically empty through the facade, mullions and retracted leaves", () => {
    const signature = scene.architectural_signatures.find(({ kind }) => kind === "hauptbahnhof_model")!;
    const root = createArchitecturalSignature({ ...signature, anchor_world: [0, 0, 0], rotation_y_degrees: 0 }) as Group;
    root.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    for (const side of [-1, 1]) {
      for (const centre of HAUPTBAHNHOF_ACCESS.doorCentresLocalX) {
        for (const offset of [-0.43, 0, 0.43]) {
          const ray = new Raycaster(new Vector3(centre + offset, 1.4, side * 93), new Vector3(0, 0, -side), 0, 6);
          expect(ray.intersectObjects(meshes, false)).toHaveLength(0);
        }
      }
      const closedBay = new Raycaster(new Vector3(14, 1.4, side * 93), new Vector3(0, 0, -side), 0, 6);
      expect(closedBay.intersectObjects(meshes, false).length).toBeGreaterThan(0);
    }
    root.traverse((object) => { if (object instanceof Mesh) object.geometry.dispose(); });
  });
});
