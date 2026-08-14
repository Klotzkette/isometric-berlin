import { describe, expect, test } from "bun:test";

import {
  PEDESTRIAN_EYE_HEIGHT_M,
  PEDESTRIAN_JUMP_APEX_M,
  PEDESTRIAN_MAX_PITCH_RAD,
  PEDESTRIAN_RESPAWN,
  PEDESTRIAN_SPRINT_MULTIPLIER,
  compilePedestrianWater,
  createPedestrianState,
  heldPedestrianInput,
  isPedestrianSprintDoubleActivation,
  jumpPedestrian,
  lookPedestrian,
  pedestrianPointIsWater,
  pedestrianViewDirection,
  stepPedestrian,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";

const environment: PedestrianEnvironment = {
  bounds: { maxX: 1_000, maxZ: 1_000, minX: -1_000, minZ: -1_000 },
  groundAt: () => 4.25,
  water: [],
};

describe("pedestrian navigation", () => {
  test("spawns at eye height on Pariser Platz facing the Brandenburg Gate", () => {
    const state = createPedestrianState(environment);
    const direction = pedestrianViewDirection(state);
    expect(state.x).toBe(PEDESTRIAN_RESPAWN.x);
    expect(state.z).toBe(PEDESTRIAN_RESPAWN.z);
    expect(state.groundY + PEDESTRIAN_EYE_HEIGHT_M).toBeCloseTo(6.05);
    expect(direction.x).toBeCloseTo(-1);
    expect(direction.z).toBeCloseTo(0);
  });

  test("walk input stays horizontal and diagonal speed is normalized", () => {
    const start = createPedestrianState(environment);
    const result = stepPedestrian(
      start,
      { forward: 1, look: 0, sprint: false, strafe: 1, turn: 0 },
      0.05,
      environment,
    );
    expect(Math.hypot(result.state.x - start.x, result.state.z - start.z)).toBeCloseTo(
      0.32,
    );
    expect(result.state.groundY).toBe(start.groundY);
    expect(result.state.jumpOffset).toBe(0);
  });

  test("sprint is an explicit four-times speed layer", () => {
    const start = createPedestrianState(environment);
    const result = stepPedestrian(
      start,
      { forward: 1, look: 0, sprint: true, strafe: 0, turn: 0 },
      0.05,
      environment,
    );
    expect(Math.hypot(result.state.x - start.x, result.state.z - start.z)).toBeCloseTo(
      0.32 * PEDESTRIAN_SPRINT_MULTIPLIER,
    );
  });

  test("double activation has a bounded, deterministic sprint window", () => {
    expect(isPedestrianSprintDoubleActivation(1_000, 1_339)).toBe(true);
    expect(isPedestrianSprintDoubleActivation(1_000, 1_341)).toBe(false);
    expect(isPedestrianSprintDoubleActivation(0, 100)).toBe(false);
    expect(isPedestrianSprintDoubleActivation(1_000, 999)).toBe(false);
  });

  test("starts on the ground below the current view instead of teleporting", () => {
    const state = createPedestrianState(environment, {
      pitch: 0.25,
      x: 125,
      yaw: 0.75,
      z: -240,
    });
    expect(state.x).toBe(125);
    expect(state.z).toBe(-240);
    expect(state.groundY).toBe(4.25);
    expect(state.yaw).toBeCloseTo(0.75);
    expect(state.pitch).toBeCloseTo(0.25);
  });

  test("jump reaches roughly three person heights and cannot double jump", () => {
    let state = jumpPedestrian(createPedestrianState(environment));
    expect(jumpPedestrian(state)).toBe(state);
    let apex = 0;
    for (let step = 0; step < 400 && !state.grounded; step += 1) {
      state = stepPedestrian(
        state,
        { forward: 0, look: 0, sprint: false, strafe: 0, turn: 0 },
        0.01,
        environment,
      ).state;
      apex = Math.max(apex, state.jumpOffset);
    }
    expect(apex).toBeCloseTo(PEDESTRIAN_JUMP_APEX_M, 1);
    expect(state.grounded).toBe(true);
    expect(state.jumpOffset).toBe(0);
  });

  test("head look is clamped before it can flip upside down", () => {
    const start = createPedestrianState(environment);
    const up = lookPedestrian(start, 0, Math.PI);
    const down = lookPedestrian(up, 0, -Math.PI * 2);
    expect(up.pitch).toBe(PEDESTRIAN_MAX_PITCH_RAD);
    expect(down.pitch).toBe(-PEDESTRIAN_MAX_PITCH_RAD);
  });

  test("water holes remain dry while the surrounding water respawns", () => {
    const water = compilePedestrianWater({
      water: [
        {
          area_m2: 96,
          holes: [[[20, 20], [40, 20], [40, 40], [20, 40], [20, 20]]],
          kind: "pond",
          name: "fixture pond",
          ring: [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]],
        },
      ],
    });
    expect(pedestrianPointIsWater(1, 1, water)).toBe(true);
    expect(pedestrianPointIsWater(3, 3, water)).toBe(false);

    const wetEnvironment = {
      ...environment,
      water,
    };
    const result = stepPedestrian(
      {
        ...createPedestrianState(environment),
        x: 1,
        z: 1,
      },
      { forward: 0, look: 0, sprint: false, strafe: 0, turn: 0 },
      0.016,
      wetEnvironment,
    );
    expect(result.respawned).toBe(true);
    expect(result.state.x).toBe(PEDESTRIAN_RESPAWN.x);
    expect(result.state.z).toBe(PEDESTRIAN_RESPAWN.z);
  });

  test("held keyboard input separates walking, strafing and turning", () => {
    expect(heldPedestrianInput(new Set(["w", "d", "ArrowLeft"]))).toEqual({
      forward: 1,
      look: 0,
      sprint: false,
      strafe: 1,
      turn: -1,
    });
    expect(heldPedestrianInput(new Set(["w", "Shift"])).sprint).toBe(true);
  });
});
