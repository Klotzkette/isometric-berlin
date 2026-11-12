import { expect, test } from "bun:test";
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import profile from "../src/data/zooU9PublicConnection.json";
import source from "../src/data/ubahnAccessV326.json";
import { createUbahnGroundRuntimeV326Steps } from "../src/UbahnGroundRuntimeV326";
import { createCoreUbahnClearanceV326 } from "../src/CoreUbahnAccessV326";
import { createPedestrianEnvironment, createPedestrianState, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian,
  type PedestrianEnvironment, type PedestrianState } from "../src/pedestrianNavigation";
import { worldGroundSampler, type VoxelPayload } from "../src/terrainPayload";

const meshRoot = new URL("../public/mesh/regierungsviertel/", import.meta.url);
const terrain = await Bun.file(new URL("ground-context.json", meshRoot)).json() as VoxelPayload;
const prisms = await Bun.file(new URL("lod2-prisms.json", meshRoot)).json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;
const entry = source.entries.find(e => e.id === profile.entry.id)!;

function walk(state: PedestrianState, target: number[], env: PedestrianEnvironment): PedestrianState {
  const [tx, tz] = target;
  for (let i = 0; i < 1000; i++) {
    const dx = tx - state.x, dz = tz - state.z, distance = Math.hypot(dx, dz);
    if (distance < .012) return state;
    const dt = Math.min(.035, distance / PEDESTRIAN_WALK_SPEED_MPS);
    state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) }, {
      forward: 1, strafe: 0, turn: 0, look: 0, sprint: false,
    }, dt, env).state;
  }
  throw Error(`Stopped at ${state.x}, ${state.groundY}, ${state.z} on route to ${target}`);
}

test("the admitted source staircase and its U9 continuation are walkable in both families", () => {
  for (const native of [false, true]) {
    const root = new Group();
    const y = worldGroundSampler(terrain)(entry.point[0], entry.point[1]);
    const geometry = new PlaneGeometry(25, 25).rotateX(-Math.PI / 2);
    const host = new Mesh(geometry, new MeshBasicMaterial());
    host.position.set(entry.point[0], y, entry.point[1]);
    root.add(host);
    const environment = createPedestrianEnvironment(terrain, { water: [] }, null, prisms);
    environment.visualMode = () => native ? "minecraft" : "day";
    const clearance = createCoreUbahnClearanceV326(environment)!;
    const steps = createUbahnGroundRuntimeV326Steps(root, [host], [entry.id], native, () => y, true, clearance);
    let result = steps.next();
    while (!result.done) result = steps.next();
    const access = result.value!;
    expect(access).not.toBeNull();
    expect(access.openingIds).toEqual([entry.id]);
    environment.interiorGroundAt = access.groundAt;
    environment.interiorSolidAt = access.solidAt;
    const [entryX, entryZ] = entry.point;
    const start = [entryX - entry.axis[0] * 1.25, entryZ - entry.axis[1] * 1.25];
    // Terrain owns the approach. The fixture uses the sampled rendered datum
    // where it hands over to the source-bound stair, in both directions.
    environment.groundAt = () => y;
    environment.resolveGround = () => ({ y, layer: "surface", insideTunnel: false });
    let state = createPedestrianState(environment, { x: start[0], z: start[1], groundYHint: y, preserveHorizontalPosition: true });
    const route = [profile.approach[0], ...profile.approach.slice(1), profile.stair[1],
      ...profile.lowerPassage.slice(1), [-2644.2, 1281.3]];
    for (const point of route) state = walk(state, point, environment);
    expect(state.groundY).toBeCloseTo(access.openings[0].bottomY - 26 * .17, 4);

    const scene = access.root.getObjectByName("Zoologischer Garten mapped U9 circulation")!;
    expect(scene).toBeDefined();
    root.updateMatrixWorld(true);
    const hit = new Raycaster(new Vector3(state.x, state.groundY + .4, state.z), new Vector3(0, -1, 0)).intersectObject(scene);
    expect(hit[0]?.point.y).toBeCloseTo(state.groundY, 4);
    expect(access.groundAt(state.x, state.z, y)).toBeNull();

    for (const point of [...route.slice(0, -1).reverse(), start]) state = walk(state, point, environment);
    expect(state.groundY).toBeCloseTo(y, 4);
    access.dispose();
    expect(access.complete()).toBeFalse();
    expect(root.children).toEqual([host]);
    geometry.dispose();
    host.material.dispose();
  }
});
