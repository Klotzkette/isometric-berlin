import { describe, expect, test } from "bun:test";

import {
  PEDESTRIAN_BODY_RADIUS_M,
  PEDESTRIAN_EYE_HEIGHT_M,
  PEDESTRIAN_FAST_RUN_MULTIPLIER,
  PEDESTRIAN_HIGH_JUMP_APEX_M,
  PEDESTRIAN_JUMP_APEX_M,
  PEDESTRIAN_MAX_PITCH_RAD,
  PEDESTRIAN_RESPAWN,
  PEDESTRIAN_SPRINT_MULTIPLIER,
  PEDESTRIAN_WALK_SPEED_MPS,
  addPedestrianParkObstacles,
  compilePedestrianObstacles,
  compilePedestrianWater,
  createPedestrianState,
  heldPedestrianInput,
  isPedestrianHighJumpDoubleActivation,
  isPedestrianSprintDoubleActivation,
  pedestrianMovementActivation,
  jumpPedestrian,
  lookPedestrian,
  pedestrianPointIsBlocked,
  pedestrianPointIsWater,
  pedestrianSpawnFromView,
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
  test("enters walking mode below the visible camera instead of its look-at focus", () => {
    const spawn = pedestrianSpawnFromView(
      environment,
      { x: 123.45, y: 4.25, z: -345.67 },
      { x: 181.2, y: 96, z: -281.4 },
      { x: -0.6, y: -0.2, z: -0.7745966692 },
    );
    expect(spawn?.x).toBe(181.2);
    expect(spawn?.z).toBe(-281.4);
    expect(spawn?.groundYHint).toBeCloseTo(96 - PEDESTRIAN_EYE_HEIGHT_M);
    expect(spawn?.preserveHorizontalPosition).toBe(true);
    expect(spawn?.yaw).toBeCloseTo(
      Math.atan2(-0.6, 0.7745966692),
    );
  });

  test("falls back to the look-at focus only when the camera is outside the world", () => {
    const spawn = pedestrianSpawnFromView(
      environment,
      { x: 33.5, y: 4.25, z: -22.25 },
      { x: 1_001, y: 8.05, z: 0 },
      { x: 0, y: 0, z: -1 },
    );
    expect(spawn).toEqual({
      groundYHint: 4.25,
      pitch: 0,
      x: 33.5,
      yaw: 0,
      z: -22.25,
    });
  });

  test("drops vertically onto a roof without changing the flight X/Z", () => {
    const spawn = pedestrianSpawnFromView(
      collisionEnvironment,
      { x: 40, y: 4.25, z: 40 },
      { x: 2, y: 30, z: 2 },
      { x: 0.4, y: -0.6, z: -0.692820323 },
    );
    expect(spawn?.preserveHorizontalPosition).toBe(true);
    const state = createPedestrianState(collisionEnvironment, spawn);
    expect(state.x).toBe(2);
    expect(state.z).toBe(2);
    expect(state.groundY).toBe(16);
    expect(
      pedestrianPointIsBlocked(
        state.x,
        state.z,
        state.groundY,
        buildingObstacles,
      ),
    ).toBe(false);
  });

  test("keeps the radial safety search for non-flight respawns", () => {
    const state = createPedestrianState(collisionEnvironment, {
      x: 2,
      yaw: 0,
      z: 2,
    });
    expect(state.x === 2 && state.z === 2).toBe(false);
    expect(state.groundY).toBe(4.25);
  });

  test("never uses an exact vertical drop to enter a protected memorial", () => {
    const state = createPedestrianState(
      {
        ...environment,
        protectedVolumeAt: (x, _y, z) => Math.hypot(x, z) < 2,
      },
      {
        groundYHint: 20,
        preserveHorizontalPosition: true,
        x: 0,
        yaw: 0,
        z: 0,
      },
    );
    expect(state.x === 0 && state.z === 0).toBe(false);
    expect(Math.hypot(state.x, state.z)).toBeGreaterThanOrEqual(2);
  });

  test("returns no authored spawn when neither live camera point is walkable", () => {
    expect(
      pedestrianSpawnFromView(
        { ...environment, groundAt: () => null },
        { x: 10, y: 0, z: 10 },
        { x: 20, y: 10, z: 20 },
        { x: 0, y: -1, z: 0 },
      ),
    ).toBeUndefined();
  });

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
    ).toBeCloseTo(PEDESTRIAN_WALK_SPEED_MPS * 0.05);
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
    ).toBeCloseTo(
      PEDESTRIAN_WALK_SPEED_MPS * 0.05 * PEDESTRIAN_SPRINT_MULTIPLIER,
    );
  });

  test("triple activation adds a distinct eight-times fast-run layer", () => {
    const start = createPedestrianState(environment);
    const result = stepPedestrian(
      start,
      {
        fastRun: true,
        forward: 1,
        look: 0,
        sprint: true,
        strafe: 0,
        turn: 0,
      },
      0.05,
      environment,
    );
    expect(
      Math.hypot(result.state.x - start.x, result.state.z - start.z),
    ).toBeCloseTo(
      PEDESTRIAN_WALK_SPEED_MPS * 0.05 * PEDESTRIAN_FAST_RUN_MULTIPLIER,
    );
  });

  test("double activation has a bounded, deterministic sprint window", () => {
    expect(isPedestrianSprintDoubleActivation(1_000, 1_339)).toBe(true);
    expect(isPedestrianSprintDoubleActivation(1_000, 1_341)).toBe(false);
    expect(isPedestrianSprintDoubleActivation(0, 100)).toBe(false);
    expect(isPedestrianSprintDoubleActivation(1_000, 999)).toBe(false);
  });

  test("counts three quick presses only for the same movement direction", () => {
    const first = pedestrianMovementActivation(
      { count: 0, key: "", lastActivationAt: 0 },
      "ArrowUp",
      1_000,
    );
    const second = pedestrianMovementActivation(first, "ArrowUp", 1_339);
    const third = pedestrianMovementActivation(second, "ArrowUp", 1_678);
    expect([first.count, second.count, third.count]).toEqual([1, 2, 3]);
    expect(pedestrianMovementActivation(second, "w", 1_500).count).toBe(3);
    expect(pedestrianMovementActivation(second, "s", 1_500).count).toBe(1);
    expect(
      pedestrianMovementActivation(second, "ArrowUp", 1_680).count,
    ).toBe(1);
  });

  test("double Space has its own bounded high-jump window", () => {
    expect(isPedestrianHighJumpDoubleActivation(1_000, 1_319)).toBe(true);
    expect(isPedestrianHighJumpDoubleActivation(1_000, 1_321)).toBe(false);
    expect(isPedestrianHighJumpDoubleActivation(0, 100)).toBe(false);
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

  test("normal jump clears three person heights and rejects an ordinary airborne jump", () => {
    let state = jumpPedestrian(createPedestrianState(environment));
    expect(jumpPedestrian(state)).toBe(state);
    let apex = 0;
    let flightTime = 0;
    for (let step = 0; step < 400 && !state.grounded; step += 1) {
      state = stepPedestrian(
        state,
        { forward: 0, look: 0, sprint: false, strafe: 0, turn: 0 },
        0.01,
        environment,
      ).state;
      apex = Math.max(apex, state.jumpOffset);
      flightTime += 0.01;
    }
    expect(apex).toBeCloseTo(PEDESTRIAN_JUMP_APEX_M, 1);
    expect(apex).toBeGreaterThan(PEDESTRIAN_EYE_HEIGHT_M * 3);
    expect(flightTime).toBeGreaterThan(1.3);
    expect(flightTime).toBeLessThan(1.5);
    expect(state.grounded).toBe(true);
    expect(state.jumpOffset).toBe(0);
  });

  test("double Space boosts once to the bounded high apex", () => {
    let state = jumpPedestrian(createPedestrianState(environment));
    state = stepPedestrian(
      state,
      { forward: 0, look: 0, sprint: false, strafe: 0, turn: 0 },
      0.08,
      environment,
    ).state;
    const boosted = jumpPedestrian(state, true);
    expect(boosted).not.toBe(state);
    expect(jumpPedestrian(boosted, true)).toBe(boosted);
    state = boosted;
    let apex = 0;
    for (let step = 0; step < 500 && !state.grounded; step += 1) {
      state = stepPedestrian(
        state,
        { forward: 0, look: 0, sprint: false, strafe: 0, turn: 0 },
        0.01,
        environment,
      ).state;
      apex = Math.max(apex, state.jumpOffset);
    }
    expect(apex).toBeCloseTo(PEDESTRIAN_HIGH_JUMP_APEX_M, 1);
    expect(apex).toBeGreaterThan(PEDESTRIAN_JUMP_APEX_M + 4);
    expect(state.grounded).toBe(true);
  });

  test("head look is clamped before it can flip upside down", () => {
    const start = createPedestrianState(environment);
    const up = lookPedestrian(start, 0, Math.PI);
    const down = lookPedestrian(up, 0, -Math.PI * 2);
    expect(up.pitch).toBe(PEDESTRIAN_MAX_PITCH_RAD);
    expect(down.pitch).toBe(-PEDESTRIAN_MAX_PITCH_RAD);
  });

  test("water holes remain dry while shorelines block without respawning", () => {
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
    const wetState = {
      ...createPedestrianState(environment),
      x: 1,
      z: 1,
    };
    const stranded = stepPedestrian(
      wetState,
      { forward: 0, look: 0, sprint: false, strafe: 0, turn: 0 },
      0.016,
      wetEnvironment,
    );
    expect(stranded.respawned).toBe(false);
    expect(stranded.state).toEqual(wetState);

    const shoreline = stepPedestrian(
      {
        ...createPedestrianState(environment),
        x: -0.25,
        yaw: Math.PI / 2,
        z: 1,
      },
      { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
      0.5,
      wetEnvironment,
    );
    expect(shoreline.respawned).toBe(false);
    expect(shoreline.state.x).toBeLessThan(0);
    expect(pedestrianPointIsWater(shoreline.state.x, shoreline.state.z, water)).toBe(
      false,
    );
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
    expect(heldPedestrianInput(new Set(["Shift", "a"]))).toEqual({
      forward: 0,
      look: 0,
      sprint: true,
      strafe: 0,
      turn: -1,
    });
    expect(heldPedestrianInput(new Set(["Shift", "ArrowRight"]))).toEqual({
      forward: 0,
      look: 0,
      sprint: true,
      strafe: 0,
      turn: 1,
    });
  });

  test("LoD2 walls are solid while a real courtyard hole remains walkable", () => {
    expect(pedestrianPointIsBlocked(2, 2, 4.25, buildingObstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(5, 5, 4.25, buildingObstacles)).toBe(false);
    expect(pedestrianPointIsBlocked(-0.3, 5, 4.25, buildingObstacles)).toBe(
      true,
    );
    expect(pedestrianPointIsBlocked(2, 2, -8, buildingObstacles)).toBe(false);
  });

  test("indexes LoD2 source rings without cloning the city footprint graph", () => {
    const sourceRing = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    const obstacles = compilePedestrianObstacles({
      buildings: [
        {
          class: 0,
          h_dm: 120,
          holes: [],
          id: "retained-source-ring",
          ring: sourceRing,
          y0_dm: 40,
        },
      ],
    });
    const polygon = [...obstacles.cells.values()]
      .flat()
      .find(
        (obstacle) =>
          obstacle.kind === "polygon" &&
          obstacle.sourceId === "retained-source-ring",
      );
    expect(polygon?.kind).toBe("polygon");
    if (!polygon || polygon.kind !== "polygon") {
      throw new Error("source-backed building obstacle missing");
    }
    expect(polygon.ring).toBe(sourceRing);
    expect(polygon.coordinateScale).toBe(0.1);
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

  test("fast-run substeps cannot tunnel through a thin official tree trunk", () => {
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
      {
        fastRun: true,
        forward: 1,
        look: 0,
        sprint: false,
        strafe: 0,
        turn: 0,
      },
      0.05,
      treeEnvironment,
    );
    expect(result.state.x).toBeLessThanOrEqual(-0.58);
  });

  test("preserves a measured 1.426 m veteran-tree trunk as solid", () => {
    const veteranEnvironment: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
    };
    const obstacles = addPedestrianParkObstacles(veteranEnvironment, {
      paths: [],
      playgrounds: [],
      schema_version: 6,
      source: {
        attribution: "fixture",
        geometry_status: "fixture",
        name: "fixture",
      },
      trees: [
        {
          cr: 12.5,
          h: 35,
          i: "official-veteran-tree",
          position: [0, 4.25, 0] as [number, number, number],
          tr: 1.426,
          v: 0,
        },
      ],
    });
    const veteranTrunk = [...obstacles.cells.values()]
      .flat()
      .find(
        (obstacle) =>
          obstacle.kind === "circle" && obstacle.x === 0 && obstacle.z === 0,
      );
    expect(veteranTrunk?.kind).toBe("circle");
    if (!veteranTrunk || veteranTrunk.kind !== "circle") {
      throw new Error("veteran-tree trunk obstacle missing");
    }
    expect(veteranTrunk.radius).toBeCloseTo(1.426, 3);
    expect(pedestrianPointIsBlocked(1.84, 0, 4.25, obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(1.86, 0, 4.25, obstacles)).toBe(false);
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

  test("mapped hedges and rendered shrubs are finite obstacles", () => {
    const hedgeEnvironment: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
    };
    const obstacles = addPedestrianParkObstacles(hedgeEnvironment, {
      hedges: [
        {
          dimensions_status: "Display dimensions",
          height_m: 1.5,
          id: "way/hedge-line:0",
          kind: "line",
          points: [
            [0, 4.25, -2],
            [0, 4.25, 2],
          ],
          source_url: "https://www.openstreetmap.org/way/hedge-line",
          width_m: 1,
        },
        {
          dimensions_status: "Display dimensions",
          height_m: 1.5,
          id: "way/hedge-area:0",
          kind: "area",
          rings: [
            [
              [10, 4.25, 10],
              [14, 4.25, 10],
              [14, 4.25, 14],
              [10, 4.25, 14],
              [10, 4.25, 10],
            ],
          ],
          source_url: "https://www.openstreetmap.org/way/hedge-area",
        },
      ],
      paths: [],
      playgrounds: [],
      schema_version: 6,
      shrub_patches: [
        {
          clusters: [[20, 4.25, 20, 1.4, 1, 0]],
          id: "way/scrub:0",
          rings: [
            [
              [18, 4.25, 18],
              [22, 4.25, 18],
              [22, 4.25, 22],
              [18, 4.25, 22],
              [18, 4.25, 18],
            ],
          ],
          source_url: "https://www.openstreetmap.org/way/scrub",
        },
      ],
      source: {
        attribution: "fixture",
        geometry_status: "fixture",
        name: "fixture",
      },
      trees: [],
    });
    expect(obstacles.hedgeSegmentCount).toBe(2);
    expect(obstacles.hedgeAreaCount).toBe(1);
    expect(obstacles.shrubClusterCount).toBe(1);
    expect(pedestrianPointIsBlocked(-0.3, 0, 4.25, obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(-0.3, 3, 4.25, obstacles)).toBe(false);
    expect(pedestrianPointIsBlocked(12, 12, 4.25, obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(20, 20, 4.25, obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(18.5, 18.5, 4.25, obstacles)).toBe(false);
    expect(pedestrianPointIsBlocked(20, 20, 6, obstacles)).toBe(false);
  });

  test("activation over a solid footprint relocates to nearby open ground", () => {
    const requested = { x: 2, yaw: 0, z: 2 };
    const state = createPedestrianState(collisionEnvironment, {
      ...requested,
    });
    expect(
      pedestrianPointIsBlocked(
        state.x,
        state.z,
        state.groundY,
        buildingObstacles,
      ),
    ).toBe(false);
    const view = pedestrianViewDirection(state);
    expect(
      view.x * (state.x - requested.x) +
        view.z * (state.z - requested.z),
    ).toBeGreaterThan(0);
    expect(
      state.x < 0 || state.x > 10 || state.z < 0 || state.z > 10,
    ).toBe(true);
  });
});
