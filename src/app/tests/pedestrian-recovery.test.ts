import { describe, expect, test } from "bun:test";
import {
  PEDESTRIAN_RECOVERY_CHECKPOINT_LIMIT,
  PEDESTRIAN_RECOVERY_RADIUS_M,
  compilePedestrianWater,
  createPedestrianRecoveryHistory,
  createPedestrianState,
  pedestrianPointIsBlocked,
  jumpPedestrian,
  recoverPedestrian,
  rememberPedestrianRecoveryState,
  stepPedestrian,
  type PedestrianEnvironment,
  type PedestrianState,
} from "../src/pedestrianNavigation";

const environment: PedestrianEnvironment = {
  bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
  groundAt: () => 4,
  water: [],
};
const position = (x = 0, z = 0): PedestrianState => ({
  ...createPedestrianState(environment, { x, z, yaw: 0.7, pitch: 0.2 }),
});

describe("explicit pedestrian recovery", () => {
  test("retraces verified places while keeping live heading and consuming the trail", () => {
    const history = createPedestrianRecoveryHistory();
    for (const x of [-18, -12, -6, 0]) {
      rememberPedestrianRecoveryState(history, position(x), environment);
    }
    const stuck = { ...position(), yaw: 1.2, pitch: -0.4 };
    const result = recoverPedestrian(stuck, environment, history);
    expect(result.recovered).toBe(true);
    expect(result.source).toBe("checkpoint");
    expect([result.state.x, result.state.z]).toEqual([-6, 0]);
    expect([result.state.yaw, result.state.pitch]).toEqual([1.2, -0.4]);
    rememberPedestrianRecoveryState(history, result.state, environment);
    const again = recoverPedestrian(result.state, environment, history);
    expect(again.state.x).toBe(-12);
    expect(history.checkpoints.map((state) => state.x)).toEqual([-18]);
  });

  test("rechecks checkpoints after a mode introduces solids and protected volumes", () => {
    const history = createPedestrianRecoveryHistory();
    for (const x of [-18, -12, -6]) {
      rememberPedestrianRecoveryState(history, position(x), environment);
    }
    const changedEnvironment: PedestrianEnvironment = {
      ...environment,
      interiorSolidAt: (x) => x > -9 && x < -3,
      protectedVolumeAt: (x) => x > -15 && x < -9,
    };
    const result = recoverPedestrian(position(), changedEnvironment, history);
    expect(result.source).toBe("checkpoint");
    expect(result.state.x).toBe(-18);
    expect(pedestrianPointIsBlocked(
      result.state.x, result.state.z, result.state.groundY,
      changedEnvironment.obstacles, changedEnvironment,
    )).toBe(false);
  });

  test("finds an exit outside an enclosed, capsule-sized cavity without a history", () => {
    const enclosed: PedestrianEnvironment = {
      ...environment,
      interiorSolidAt: (x, _y, z) => {
        const radius = Math.max(Math.abs(x), Math.abs(z));
        return radius >= 0.8 && radius < 3;
      },
    };
    const result = recoverPedestrian(position(), enclosed, createPedestrianRecoveryHistory());
    expect(result.source).toBe("nearby");
    expect(Math.max(Math.abs(result.state.x), Math.abs(result.state.z))).toBeGreaterThan(3.4);
    expect(result.state.groundY).toBe(4);
  });

  test("never chooses water, invalid terrain, or a protected location as a recovery endpoint", () => {
    const constrained: PedestrianEnvironment = {
      ...environment,
      groundAt: (x, z) => x < -4 && z > 0 ? 4 : null,
      protectedVolumeAt: (_x, _y, z) => z < 4,
      water: compilePedestrianWater({ water: [{
        area_m2: 800,
        holes: [],
        kind: "pond",
        name: "fixture pond",
        ring: [[-2000, 40], [-60, 40], [-60, 2000], [-2000, 2000]],
      }] }),
    };
    const result = recoverPedestrian(position(), constrained, createPedestrianRecoveryHistory());
    expect(result.recovered).toBe(true);
    expect(result.state.x).toBeGreaterThan(-5.58);
    expect(result.state.x).toBeLessThan(-4);
    expect(result.state.z).toBeGreaterThan(4.42);
    expect(Math.hypot(result.state.x, result.state.z)).toBeLessThanOrEqual(PEDESTRIAN_RECOVERY_RADIUS_M);
  });

  test("keeps the current tunnel and station level rather than jumping to the roof", () => {
    for (const groundLayer of ["surface", "tunnel"] as const) {
      const low = { ...position(), groundLayer, groundY: -8, insideTunnel: groundLayer === "tunnel" };
      const stacked: PedestrianEnvironment = {
        ...environment,
        resolveGround: (x, z, layer) => ({
          insideTunnel: layer === "tunnel",
          layer,
          y: Math.hypot(x, z) < 6 ? 4 : -8,
        }),
      };
      const history = createPedestrianRecoveryHistory();
      history.checkpoints.push(position(-6));
      const result = recoverPedestrian(low, stacked, history);
      expect(result.source).toBe("nearby");
      expect(result.state.groundLayer).toBe(groundLayer);
      expect(result.state.groundY).toBe(-8);
      expect(Math.hypot(result.state.x, result.state.z)).toBeGreaterThanOrEqual(6);
    }
  });

  test("is bounded and returns the exact position when no valid escape exists", () => {
    let groundQueries = 0;
    const blocked: PedestrianEnvironment = {
      ...environment,
      groundAt: () => { groundQueries += 1; return 4; },
      protectedVolumeAt: () => true,
    };
    const stuck = position();
    const result = recoverPedestrian(stuck, blocked, createPedestrianRecoveryHistory());
    expect(result).toEqual({ recovered: false, source: "none", state: stuck });
    expect(result.state).toBe(stuck);
    expect(groundQueries).toBeLessThanOrEqual(12 * 24);
  });

  test("limits the trail and ignores airborne, blocked and unchanged samples", () => {
    const history = createPedestrianRecoveryHistory();
    for (let x = -195; x <= 195; x += 3) {
      rememberPedestrianRecoveryState(history, position(x), environment);
    }
    expect(history.checkpoints).toHaveLength(PEDESTRIAN_RECOVERY_CHECKPOINT_LIMIT);
    const snapshot = [...history.checkpoints];
    rememberPedestrianRecoveryState(history, position(195), environment);
    rememberPedestrianRecoveryState(history, { ...position(), grounded: false }, environment);
    rememberPedestrianRecoveryState(history, position(), { ...environment, interiorSolidAt: () => true });
    expect(history.checkpoints).toEqual(snapshot);
  });
});

describe("deferred obstacles do not strand walking", () => {
  test("a changed mode floor cannot move an idle or looking visitor; movement still resolves ground", () => {
    const changedGround = { ...environment, groundAt: () => 5 };
    const state = position();
    const idle = { forward: 0, strafe: 0, turn: 0, look: 0, sprint: false };
    expect(stepPedestrian(state, idle, 1 / 60, changedGround).state).toBe(state);
    const looking = stepPedestrian(state, { ...idle, turn: 1, look: 1 }, 1 / 60, changedGround).state;
    expect(looking.groundY).toBe(4);
    expect(looking.yaw).not.toBe(state.yaw);
    expect(looking.pitch).not.toBe(state.pitch);
    const jumping = stepPedestrian(jumpPedestrian(state), idle, 1 / 60, changedGround).state;
    expect(jumping.groundY).toBe(4);
    expect(jumping.jumpOffset).toBeGreaterThan(0);
    const moving = stepPedestrian(state, { ...idle, forward: 1 }, 1 / 60, changedGround).state;
    expect(moving.groundY).toBe(5);
  });

  test("can leave newly loaded water over many slow frames without a reset", () => {
    const wet: PedestrianEnvironment = {
      ...environment,
      water: compilePedestrianWater({ water: [{
        area_m2: 100,
        holes: [],
        kind: "pond",
        name: "fixture pond",
        ring: [[-50, -50], [50, -50], [50, 50], [-50, 50]],
      }] }),
    };
    let state = { ...position(), yaw: Math.PI / 2 };
    for (let frame = 0; frame < 400; frame += 1) {
      const result = stepPedestrian(state,
        { forward: 0.1, strafe: 0, turn: 0, look: 0, sprint: false },
        1 / 60, wet);
      expect(result.respawned).toBe(false);
      state = result.state;
    }
    expect(state.x).toBeGreaterThan(5);
  });

  test("late solid overlap never permits walking into a protected volume", () => {
    const lateSolid: PedestrianEnvironment = {
      ...environment,
      interiorSolidAt: (x) => x < 3,
      protectedVolumeAt: (x) => x >= 1,
    };
    const result = stepPedestrian({ ...position(), yaw: Math.PI / 2 },
      { forward: 1, strafe: 0, turn: 0, look: 0, sprint: true },
      0.1, lateSolid);
    expect(result.state.x).toBeGreaterThan(0);
    expect(result.state.x).toBeLessThan(0.58);
    expect(result.respawned).toBe(false);
  });
});
