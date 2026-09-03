import { describe, expect, test } from "bun:test";

import {
  addPedestrianParkObstacles,
  compilePedestrianObstacles,
  createPedestrianState,
  pedestrianPointIsBlocked,
  stepPedestrian,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import {
  SCHWELLENRAUM_FLIGHT_RADIUS_M,
  createSchwellenraumFlightScratch,
  resolveSchwellenraumFlightTranslation,
  schwellenraumFlightPointIsBlocked,
} from "../src/schwellenraumNavigation";

const buildingObstacles = compilePedestrianObstacles({
  buildings: [
    {
      class: 0,
      h_dm: 100,
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
      y0_dm: 0,
    },
  ],
});

const environment: PedestrianEnvironment = {
  bounds: { maxX: 100, maxZ: 100, minX: -100, minZ: -100 },
  groundAt: () => 0,
  obstacles: buildingObstacles,
  water: [],
};

describe("Schwellenraum solid movement", () => {
  test("reuses the complete swept-flight result during held movement", () => {
    const scratch = createSchwellenraumFlightScratch();
    const first = resolveSchwellenraumFlightTranslation(
      { x: -4, y: 3, z: -4 },
      { x: 0.5, y: 0, z: 0.25 },
      environment,
      undefined,
      scratch,
    );
    const second = resolveSchwellenraumFlightTranslation(
      first.position,
      { x: -0.2, y: 0.1, z: 0.4 },
      environment,
      undefined,
      scratch,
    );

    expect(second).toBe(first);
    expect(second.position).toBe(scratch.position);
    expect(second.applied).toBe(scratch.applied);
    expect(Object.values(second.position).every(Number.isFinite)).toBeTrue();
  });

  test("swept flight cannot skip a facade even with a twenty-metre input", () => {
    const result = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 2, z: 2 },
      { x: 20, y: 0, z: 0 },
      environment,
    );
    expect(result.blocked).toBe(true);
    expect(result.position.x).toBeLessThanOrEqual(
      -SCHWELLENRAUM_FLIGHT_RADIUS_M,
    );
    expect(result.position.x).toBeGreaterThan(-2);
    expect(
      schwellenraumFlightPointIsBlocked(result.position, environment),
    ).toBe(false);
  });

  test("a glancing flight slides along a facade instead of sticking", () => {
    const result = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 2, z: 2 },
      { x: 4, y: 0, z: 5 },
      environment,
    );
    expect(result.blocked).toBe(true);
    expect(result.position.x).toBeLessThanOrEqual(
      -SCHWELLENRAUM_FLIGHT_RADIUS_M,
    );
    expect(result.position.z).toBeGreaterThan(6);
  });

  test("terrain and roofs are solid while open air above them remains free", () => {
    expect(
      schwellenraumFlightPointIsBlocked({ x: -2, y: 0.4, z: 2 }, environment),
    ).toBe(true);
    expect(
      schwellenraumFlightPointIsBlocked({ x: 2, y: 12, z: 2 }, environment),
    ).toBe(false);
    const descent = resolveSchwellenraumFlightTranslation(
      { x: 2, y: 12, z: 2 },
      { x: 0, y: -8, z: 0 },
      environment,
    );
    expect(descent.blocked).toBe(true);
    expect(descent.position.y).toBeGreaterThanOrEqual(
      10 + SCHWELLENRAUM_FLIGHT_RADIUS_M - 0.02,
    );
  });

  test("authored interior floors support walking and cannot be flown through", () => {
    const flooredInterior: PedestrianEnvironment = {
      ...environment,
      interiorGroundAt: () => 5,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
      walkableInteriorAt: () => true,
    };
    const fromAbove = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 8, z: 2 },
      { x: 0, y: -6, z: 0 },
      flooredInterior,
    );
    const fromBelow = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 2, z: 2 },
      { x: 0, y: 6, z: 0 },
      flooredInterior,
    );
    expect(fromAbove.blocked).toBe(true);
    expect(fromAbove.position.y).toBeGreaterThan(5.6);
    expect(fromBelow.blocked).toBe(true);
    expect(fromBelow.position.y).toBeLessThan(4.4);
  });

  test("the surveyed courtyard hole remains a real opening in three dimensions", () => {
    expect(
      schwellenraumFlightPointIsBlocked({ x: 5, y: 2, z: 5 }, environment),
    ).toBe(false);
    expect(
      schwellenraumFlightPointIsBlocked({ x: 4.3, y: 2, z: 5 }, environment),
    ).toBe(true);
  });

  test("authored access opens only the matching building and full body width", () => {
    const accessible: PedestrianEnvironment = {
      ...environment,
      walkableInteriorAt: (x, y, z, sourceId) =>
        sourceId === "fixture-building" &&
        x >= -3 &&
        x <= 7 &&
        y >= 1 &&
        y <= 3 &&
        z >= 1 &&
        z <= 3,
    };
    const entered = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 2, z: 2 },
      { x: 7, y: 0, z: 0 },
      accessible,
    );
    expect(entered.blocked).toBe(false);
    expect(entered.position.x).toBeCloseTo(5);

    const wrongBuilding: PedestrianEnvironment = {
      ...accessible,
      walkableInteriorAt: (_x, _y, _z, sourceId) =>
        sourceId === "some-other-building",
    };
    expect(
      resolveSchwellenraumFlightTranslation(
        { x: -2, y: 2, z: 2 },
        { x: 7, y: 0, z: 0 },
        wrongBuilding,
      ).blocked,
    ).toBe(true);
  });

  test("protected volumes override every authored interior opening", () => {
    const protectedEnvironment: PedestrianEnvironment = {
      ...environment,
      protectedVolumeAt: (x, y, z) =>
        x >= 1 && x <= 3 && y >= 0 && y <= 5 && z >= 1 && z <= 3,
      walkableInteriorAt: () => true,
    };
    const result = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 2, z: 2 },
      { x: 7, y: 0, z: 0 },
      protectedEnvironment,
    );
    expect(result.blocked).toBe(true);
    expect(result.position.x).toBeLessThan(1 - SCHWELLENRAUM_FLIGHT_RADIUS_M);
    expect(
      pedestrianPointIsBlocked(
        2,
        2,
        0,
        buildingObstacles,
        protectedEnvironment,
      ),
    ).toBe(true);
  });

  test("authored interior walls stay solid after the outer shell opens", () => {
    const furnishedInterior: PedestrianEnvironment = {
      ...environment,
      interiorSolidAt: (x, y, z, radius = 0) =>
        x + radius >= 2 &&
        x - radius <= 2.25 &&
        y + radius >= 0 &&
        y - radius <= 5 &&
        z + radius >= 1 &&
        z - radius <= 3,
      walkableInteriorAt: () => true,
    };
    const result = resolveSchwellenraumFlightTranslation(
      { x: -2, y: 2, z: 2 },
      { x: 7, y: 0, z: 0 },
      furnishedInterior,
    );
    expect(result.blocked).toBe(true);
    expect(result.position.x).toBeLessThan(
      2 - SCHWELLENRAUM_FLIGHT_RADIUS_M + 0.02,
    );
    expect(
      pedestrianPointIsBlocked(2, 2, 0, buildingObstacles, furnishedInterior),
    ).toBe(true);
  });

  test("walking follows an authored ramp floor without weakening its walls", () => {
    const rampEnvironment: PedestrianEnvironment = {
      ...environment,
      interiorGroundAt: (x) => (x >= -2 && x <= 5 ? 1 + (x + 2) * 0.5 : null),
      walkableInteriorAt: () => true,
    };
    let state = createPedestrianState(rampEnvironment, {
      groundYHint: 1,
      x: -2,
      yaw: Math.PI / 2,
      z: 2,
    });
    for (let index = 0; index < 12; index += 1) {
      state = stepPedestrian(
        state,
        { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
        0.05,
        rampEnvironment,
      ).state;
    }
    expect(state.x).toBeGreaterThan(1.5);
    expect(state.groundY).toBeCloseTo(1 + (state.x + 2) * 0.5);
  });

  test("trees and mapped walls stay solid in flight", () => {
    const parkEnvironment: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
    };
    addPedestrianParkObstacles(parkEnvironment, {
      paths: [],
      playgrounds: [],
      schema_version: 5,
      source: {
        attribution: "fixture",
        geometry_status: "fixture",
        name: "fixture",
      },
      street_lights: [],
      trees: [
        {
          cr: 2,
          h: 12,
          i: "tree",
          position: [0, 0, 0],
          tr: 0.2,
          v: 0,
        },
      ],
      wall_traces: [
        {
          id: "wall",
          points: [
            [4, 0, -2],
            [4, 0, 2],
          ],
          wall_type: "fixture",
        },
      ],
    });
    expect(
      resolveSchwellenraumFlightTranslation(
        { x: -3, y: 1, z: 0 },
        { x: 6, y: 0, z: 0 },
        parkEnvironment,
      ).blocked,
    ).toBe(true);
    expect(
      schwellenraumFlightPointIsBlocked({ x: 4, y: 1, z: 0 }, parkEnvironment),
    ).toBe(true);
  });

  test("walking below the surface keeps the Tiergartentunnel course open", () => {
    const tunnelEnvironment: PedestrianEnvironment = {
      ...environment,
      resolveGround: (_x, _z, currentLayer) =>
        currentLayer === "tunnel"
          ? { insideTunnel: true, layer: "tunnel", y: -8 }
          : { insideTunnel: false, layer: "surface", y: 0 },
    };
    let state = createPedestrianState(tunnelEnvironment, {
      groundYHint: -8,
      x: -2,
      yaw: Math.PI / 2,
      z: 2,
    });
    for (let index = 0; index < 16; index += 1) {
      state = stepPedestrian(
        state,
        { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
        0.05,
        tunnelEnvironment,
      ).state;
    }
    expect(state.groundLayer).toBe("tunnel");
    expect(state.insideTunnel).toBe(true);
    expect(state.x).toBeGreaterThan(1);
    expect(state.groundY).toBe(-8);
  });
});
