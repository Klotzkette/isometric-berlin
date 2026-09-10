import { describe, expect, test } from "bun:test";
import {
  addPedestrianParkObstacles,
  compilePedestrianObstacles,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import {
  findPedestrianFlightRecoveryPosition,
  PEDESTRIAN_FLIGHT_RECOVERY_HEIGHT_M,
} from "../src/pedestrianFlightRecovery";
import { resolveMinecraftHeroFlightTranslation } from "../src/MinecraftHeroNavigation";
import {
  resolveSchwellenraumFlightTranslation,
  schwellenraumFlightPointIsBlocked,
} from "../src/schwellenraumNavigation";

const environment: PedestrianEnvironment = {
  bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
  groundAt: () => 4,
  water: [],
};

describe("vertical flight exit after exhausted local walking recovery", () => {
  test("thinned Minecraft trees stop blocking flight while drawn trees and protection stay solid", () => {
    const trees: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [] }),
    };
    addPedestrianParkObstacles(trees, {
      paths: [], playgrounds: [], schema_version: 4,
      source: { attribution: "fixture", geometry_status: "fixture", name: "fixture" },
      trees: [{ cr: 3, h: 12, i: "fixture-tree", position: [0, 4, 0], tr: 0.3, v: 0 }],
    });
    const camera = { x: 0, y: 6, z: 0 };
    expect(schwellenraumFlightPointIsBlocked(camera, trees)).toBe(true);
    trees.parkTreeSolidAt = () => false;
    expect(schwellenraumFlightPointIsBlocked(camera, trees)).toBe(false);
    trees.protectedVolumeAt = () => true;
    expect(schwellenraumFlightPointIsBlocked(camera, trees)).toBe(true);
    trees.protectedVolumeAt = undefined;
    trees.parkTreeSolidAt = () => true;
    expect(schwellenraumFlightPointIsBlocked(camera, trees)).toBe(true);
  });

  test("gets above a closed source building at the same X/Z and permits normal flight", () => {
    const building: PedestrianEnvironment = {
      ...environment,
      obstacles: compilePedestrianObstacles({ buildings: [{
        class: 0, h_dm: 1_160, y0_dm: 40, id: "fixture-high-building",
        holes: [], ring: [[-100, -100], [100, -100], [100, 100], [-100, 100]],
      }] }),
    };
    const camera = { x: 0, y: 5.8, z: 0 };
    for (const resolve of [resolveMinecraftHeroFlightTranslation, resolveSchwellenraumFlightTranslation]) {
      expect(resolve(camera, { x: 0, y: 1, z: 0 }, building).applied.y).toBe(0);
      const recovered = findPedestrianFlightRecoveryPosition(camera, building)!;
      expect([recovered.x, recovered.z]).toEqual([0, 0]);
      expect(recovered.y).toBeGreaterThan(120.62);
      expect(schwellenraumFlightPointIsBlocked(recovered, building)).toBe(false);
      expect(resolve(recovered, { x: 0, y: 1, z: 0 }, building).applied.y).toBeCloseTo(1);
    }
  });

  test("does not stop inside an empty room underneath a solid canopy", () => {
    const roof: PedestrianEnvironment = {
      ...environment,
      interiorSolidAt: (_x, y, _z, radius = 0) => Math.abs(y - 20) <= 0.3 + radius,
    };
    const recovered = findPedestrianFlightRecoveryPosition({ x: 0, y: 5.8, z: 0 }, roof)!;
    expect(recovered.y).toBeGreaterThan(21);
    expect(recovered.y).toBeLessThan(23);
  });

  test("never moves into a protected volume, outside bounds, or beyond the flight ceiling", () => {
    let queries = 0;
    const protectedEnvironment: PedestrianEnvironment = {
      ...environment,
      protectedVolumeAt: () => { queries += 1; return true; },
    };
    expect(findPedestrianFlightRecoveryPosition({ x: 0, y: 5.8, z: 0 }, protectedEnvironment)).toBeNull();
    expect(queries).toBeLessThanOrEqual(PEDESTRIAN_FLIGHT_RECOVERY_HEIGHT_M / 0.5 + 1);
    expect(findPedestrianFlightRecoveryPosition({ x: 201, y: 5.8, z: 0 }, environment)).toBeNull();
    expect(findPedestrianFlightRecoveryPosition({ x: 0, y: 279, z: 0 }, environment)).toBeNull();
    expect(findPedestrianFlightRecoveryPosition({ x: NaN, y: 5.8, z: 0 }, environment)).toBeNull();
  });
});
