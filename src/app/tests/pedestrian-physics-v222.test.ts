import { describe, expect, test } from "bun:test";
import {
  compilePedestrianObstacles, createPedestrianRecoveryHistory, createPedestrianState,
  jumpPedestrian, pedestrianPointIsBlocked, pedestrianSpawnFromView, recoverPedestrian,
  stepPedestrian, PEDESTRIAN_EYE_HEIGHT_M, PEDESTRIAN_FLIGHT_DESCENT_SPEED_MPS,
  PEDESTRIAN_HIGH_JUMP_APEX_M, type PedestrianEnvironment, type PedestrianState,
} from "../src/pedestrianNavigation";

const idle = { forward: 0, strafe: 0, turn: 0, look: 0, sprint: false };
const east = { ...idle, forward: 1 };
const plain: PedestrianEnvironment = {
  bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 }, groundAt: () => 0, water: [],
};
const spawn = (environment = plain, x = -2, z = 0) => createPedestrianState(environment, { x, z, yaw: Math.PI / 2 });
const feet = (state: PedestrianState) => state.groundY + state.jumpOffset;
const hurdle = compilePedestrianObstacles({ buildings: [{
  id: "v222-low-hurdle", class: 0, y0_dm: 0, h_dm: 20,
  ring: [[0, -20], [30, -20], [30, 20], [0, 20]], holes: [],
}] });

describe("v222 continuous walking height and effective recovery", () => {
  test("flight activation preserves the eye, eases down without input, and lands on a roof", () => {
    const environment = { ...plain, obstacles: hurdle };
    const camera = { x: 1, y: 82, z: 0 };
    const requested = pedestrianSpawnFromView(environment, { x: 0, y: 0, z: 0 }, camera, { x: 0, y: -.3, z: -1 })!;
    let state = createPedestrianState(environment, requested);
    expect(feet(state) + PEDESTRIAN_EYE_HEIGHT_M).toBeCloseTo(camera.y, 8);
    expect(state.grounded).toBeFalse();
    expect(state.groundY).toBe(2);
    let previous = feet(state), frames = 0;
    while (!state.grounded && frames++ < 900) {
      state = stepPedestrian(state, idle, 1 / 60, environment).state;
      expect(feet(state)).toBeLessThanOrEqual(previous);
      expect(previous - feet(state)).toBeLessThanOrEqual(PEDESTRIAN_FLIGHT_DESCENT_SPEED_MPS / 60 + 1e-9);
      expect([state.x, state.z]).toEqual([camera.x, camera.z]);
      if (frames === 1) expect(previous - feet(state)).toBeLessThan(.01);
      previous = feet(state);
    }
    expect(state.grounded).toBeTrue();
    expect(state.groundY).toBe(2);
    expect(state.jumpOffset).toBe(0);
    expect(state.descentFromFlight).toBeUndefined();
  });

  test("a normal jump clears a hurdle, preserves world height at its edge, and lands on it", () => {
    const environment = { ...plain, obstacles: hurdle };
    let state = jumpPedestrian(spawn(environment));
    for (let i = 0; i < 20; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
    for (let i = 0; i < 15; i++) {
      const before = feet(state), velocity = state.verticalVelocity;
      state = stepPedestrian(state, east, 1 / 60, environment).state;
      expect(feet(state) - before).toBeCloseTo(velocity / 60 - 26 / 7200, 6);
    }
    expect(state.x).toBeGreaterThan(0);
    expect(state.x).toBeLessThan(3);
    for (let i = 0; i < 120 && !state.grounded; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
    expect(state.grounded).toBeTrue();
    expect(state.groundY).toBe(2);
    expect(pedestrianPointIsBlocked(state.x, state.z, feet(state), hurdle, environment)).toBeFalse();
    state = jumpPedestrian(state);
    for (let i = 0; i < 30; i++) state = stepPedestrian(state, east, 1 / 60, environment).state;
    expect(state.x).toBeGreaterThan(3.5);
    for (let i = 0; i < 120 && !state.grounded; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
    expect(feet(state)).toBe(0);
  });

  test("the higher jump keeps its takeoff apex after crossing raised support", () => {
    const environment = { ...plain, obstacles: hurdle };
    let state = jumpPedestrian(spawn(environment));
    for (let i = 0; i < 20; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
    for (let i = 0; i < 12; i++) state = stepPedestrian(state, east, 1 / 60, environment).state;
    expect(state.groundY).toBe(2);
    state = jumpPedestrian(state, true);
    let apex = feet(state);
    for (let i = 0; i < 180 && !state.grounded; i++) {
      state = stepPedestrian(state, idle, 1 / 60, environment).state; apex = Math.max(apex, feet(state));
    }
    expect(apex).toBeCloseTo(PEDESTRIAN_HIGH_JUMP_APEX_M, 1);
  });

  test("an upward jump stops below a thin ceiling instead of tunnelling through it", () => {
    const ceiling = compilePedestrianObstacles({ buildings: [{
      id: "v222-canopy", class: 0, y0_dm: 30, h_dm: 2,
      ring: [[-100, -100], [100, -100], [100, 100], [-100, 100]], holes: [],
    }] });
    const environment = { ...plain, obstacles: ceiling };
    let state = jumpPedestrian(spawn(environment));
    let apex = 0;
    for (let i = 0; i < 90 && !state.grounded; i++) {
      state = stepPedestrian(state, idle, 1 / 60, environment).state; apex = Math.max(apex, feet(state));
    }
    expect(apex).toBeGreaterThan(.5);
    expect(apex + PEDESTRIAN_EYE_HEIGHT_M).toBeLessThanOrEqual(3.02);
    expect(state.grounded).toBeTrue();
  });

  test("recovery can leave a wedged elevated terrace for clear lower street support", () => {
    const environment: PedestrianEnvironment = {
      ...plain,
      interiorGroundAt: (x, z) => Math.hypot(x, z) < 6 ? 4.6 : null,
      interiorSolidAt: (x, _y, z) => Math.hypot(x, z) < 6,
    };
    const stuck = { ...spawn(), x: 0, groundY: 4.6, yaw: .4, pitch: -.2 };
    const result = recoverPedestrian(stuck, environment, createPedestrianRecoveryHistory());
    expect(result.recovered).toBeTrue(); expect(result.source).toBe("nearby");
    expect(Math.hypot(result.state.x, result.state.z)).toBeGreaterThan(6.4);
    expect(result.state.groundY).toBe(0);
    expect([result.state.yaw, result.state.pitch]).toEqual([.4, -.2]);
    expect(pedestrianPointIsBlocked(result.state.x, result.state.z, 0, undefined, environment)).toBeFalse();
    const walked = stepPedestrian(result.state, east, 1 / 60, environment).state;
    expect(Math.hypot(walked.x - result.state.x, walked.z - result.state.z)).toBeGreaterThan(.1);
  });

  test("recovery's lower-support fallback never exchanges a tunnel for street level", () => {
    const environment: PedestrianEnvironment = { ...plain, resolveGround: () => ({ y: 0, layer: "surface", insideTunnel: false }) };
    const stuck = { ...spawn(), x: 0, groundY: -4, groundLayer: "tunnel" as const, insideTunnel: true };
    expect(recoverPedestrian(stuck, environment, createPedestrianRecoveryHistory())).toEqual({ recovered: false, source: "none", state: stuck });
  });
});
