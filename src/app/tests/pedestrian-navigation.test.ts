import { describe, expect, test } from "bun:test";

import {
  PEDESTRIAN_BODY_RADIUS_M,
  PEDESTRIAN_EYE_HEIGHT_M,
  PEDESTRIAN_JUMP_APEX_M,
  PEDESTRIAN_MAX_PITCH_RAD,
  PEDESTRIAN_RESPAWN,
  PEDESTRIAN_SPRINT_MULTIPLIER,
  addPedestrianParkObstacles,
  compilePedestrianObstacles,
  compilePedestrianWater,
  createPedestrianState,
  heldPedestrianInput,
  isPedestrianSprintDoubleActivation,
  jumpPedestrian,
  lookPedestrian,
  pedestrianPointIsBlocked,
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

const buildingObstacles = compilePedestrianObstacles({
  buildings: [
    {
      class: 0,
      h_dm: 120,
      holes: [
        [
          [40, 40],
          [60, 40],
          [60, 60],
          [40, 60],
          [40, 40],
        ],
      ],
      id: "fixture-building",
      ring: [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [0, 0],
      ],
      y0_dm: 40,
    },
  ],
});

const collisionEnvironment: PedestrianEnvironment = {
  ...environment,
  obstacles: buildingObstacles,
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
    expect(
      Math.hypot(result.state.x - start.x, result.state.z - start.z),
    ).toBeCloseTo(0.32);
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
    expect(
      Math.hypot(result.state.x - start.x, result.state.z - start.z),
    ).toBeCloseTo(0.32 * PEDESTRIAN_SPRINT_MULTIPLIER);
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
          holes: [
            [
              [20, 20],
              [40, 20],
              [40, 40],
              [20, 40],
              [20, 20],
            ],
          ],
          kind: "pond",
          name: "fixture pond",
          ring: [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
            [0, 0],
          ],
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

  test("LoD2 walls are solid while a real courtyard hole remains walkable", () => {
    expect(pedestrianPointIsBlocked(2, 2, 4.25, buildingObstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(5, 5, 4.25, buildingObstacles)).toBe(false);
    expect(pedestrianPointIsBlocked(-0.3, 5, 4.25, buildingObstacles)).toBe(
      true,
    );
    expect(pedestrianPointIsBlocked(2, 2, -8, buildingObstacles)).toBe(false);
  });

  test("walk mode stops at a facade and slides along it", () => {
    const stopped = stepPedestrian(
      createPedestrianState(collisionEnvironment, {
        x: -0.7,
        yaw: Math.PI / 2,
        z: 5,
      }),
      { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
      0.05,
      collisionEnvironment,
    );
    expect(stopped.state.x).toBeGreaterThan(-0.7);
    expect(stopped.state.x).toBeLessThanOrEqual(-PEDESTRIAN_BODY_RADIUS_M);

    const slid = stepPedestrian(
      createPedestrianState(collisionEnvironment, {
        x: -0.5,
        yaw: Math.PI / 2,
        z: 5,
      }),
      { forward: 1, look: 0, sprint: false, strafe: 1, turn: 0 },
      0.05,
      collisionEnvironment,
    );
    expect(slid.state.x).toBeCloseTo(-0.5);
    expect(slid.state.z).toBeGreaterThan(5);
  });

  test("sprint substeps cannot tunnel through a thin official tree trunk", () => {
    const treeEnvironment: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
    };
    const parkPayload = {
      paths: [],
      playgrounds: [],
      schema_version: 4,
      source: {
        attribution: "fixture",
        geometry_status: "fixture",
        name: "fixture",
      },
      trees: [
        {
          cr: 2,
          h: 12,
          i: "fixture-tree",
          position: [0, 4.25, 0] as [number, number, number],
          tr: 0.1,
          v: 0,
        },
      ],
    };
    const obstacles = addPedestrianParkObstacles(treeEnvironment, parkPayload);
    expect(obstacles.treeCount).toBe(1);
    expect(addPedestrianParkObstacles(treeEnvironment, parkPayload)).toBe(
      obstacles,
    );
    expect(obstacles.treeCount).toBe(1);

    const result = stepPedestrian(
      createPedestrianState(treeEnvironment, {
        x: -0.6,
        yaw: Math.PI / 2,
        z: 0,
      }),
      { forward: 1, look: 0, sprint: true, strafe: 0, turn: 0 },
      0.05,
      treeEnvironment,
    );
    expect(result.state.x).toBeLessThanOrEqual(-0.58);
  });

  test("official wall traces are solid without becoming infinite barriers", () => {
    const wallEnvironment: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
    };
    const obstacles = addPedestrianParkObstacles(wallEnvironment, {
      paths: [],
      playgrounds: [],
      schema_version: 4,
      source: {
        attribution: "fixture",
        geometry_status: "fixture",
        name: "fixture",
      },
      trees: [],
      wall_traces: [
        {
          id: "fixture-wall",
          points: [
            [0, 4.25, -2],
            [0, 4.25, 2],
          ],
          wall_type: "fixture",
        },
      ],
    });
    expect(obstacles.wallSegmentCount).toBe(1);
    expect(pedestrianPointIsBlocked(-0.2, 0, 4.25, obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(-0.2, 3, 4.25, obstacles)).toBe(false);
    expect(pedestrianPointIsBlocked(-0.2, 0, 8, obstacles)).toBe(false);
  });

  test("activation over a solid footprint relocates to nearby open ground", () => {
    const state = createPedestrianState(collisionEnvironment, {
      x: 2,
      yaw: 0,
      z: 2,
    });
    expect(
      pedestrianPointIsBlocked(
        state.x,
        state.z,
        state.groundY,
        buildingObstacles,
      ),
    ).toBe(false);
  });
});
