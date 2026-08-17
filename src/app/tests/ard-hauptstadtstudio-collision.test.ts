import { describe, expect, test } from "bun:test";

import {
  ARD_HAUPTSTADTSTUDIO_ROOF_COLLISION_PROFILE,
  createArdHauptstadtstudioRoofCollision,
  type ArdRoofEquipmentSolid,
} from "../src/ArdHauptstadtstudioCollision";
import {
  ARD_HAUPTSTADTSTUDIO_IDS,
  ARD_HAUPTSTADTSTUDIO_MAIN_ID,
  createArdHauptstadtstudio,
} from "../src/ArdHauptstadtstudio";
import type { PrismPayload } from "../src/IsometricCityWorld";
import {
  createPedestrianState,
  stepPedestrian,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import { resolveSchwellenraumFlightTranslation } from "../src/schwellenraumNavigation";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;
const ardPrisms: PrismPayload = {
  ...prisms,
  buildings: prisms.buildings.filter((building) =>
    ARD_HAUPTSTADTSTUDIO_IDS.has(building.id),
  ),
};

function collision() {
  const result = createArdHauptstadtstudioRoofCollision(ardPrisms);
  if (!result) throw new Error("ARD roof collision fixture is missing");
  return result;
}

function emptyEnvironment(
  interiorSolidAt: NonNullable<PedestrianEnvironment["interiorSolidAt"]>,
  groundY = 0,
): PedestrianEnvironment {
  return {
    bounds: { maxX: 800, maxZ: 200, minX: 500, minZ: -100 },
    groundAt: () => groundY,
    interiorSolidAt,
    water: [],
  };
}

function findSolid<TKind extends ArdRoofEquipmentSolid["kind"]>(
  id: string,
  kind: TKind,
): Extract<ArdRoofEquipmentSolid, { kind: TKind }> {
  const solid = collision().solids.find(
    (candidate) => candidate.id === id && candidate.kind === kind,
  );
  if (!solid) throw new Error(`Missing ${id} collision fixture`);
  return solid as Extract<ArdRoofEquipmentSolid, { kind: TKind }>;
}

describe("ARD Hauptstadtstudio roof equipment collision", () => {
  test("derives its vertical anchor from the retained LoD2 main roof", () => {
    const index = collision();
    const main = ardPrisms.buildings.find(
      (building) => building.id === ARD_HAUPTSTADTSTUDIO_MAIN_ID,
    )!;
    expect(index.roofYM).toBe((main.y0_dm + main.h_dm) / 10);
    expect(index.roofYM).toBe(25.4);
    expect(index.sourcePrismId).toBe(ARD_HAUPTSTADTSTUDIO_MAIN_ID);
    expect(index.displayApproximation).toBeTrue();
    expect(index.geometryStatus).toContain("not surveyed");
    expect(
      ARD_HAUPTSTADTSTUDIO_ROOF_COLLISION_PROFILE.displayApproximation,
    ).toBeTrue();
    expect(
      createArdHauptstadtstudioRoofCollision({ buildings: [] }),
    ).toBeNull();
  });

  test("matches every visible dish, mast and technical-screen approximation", () => {
    const index = collision();
    const model = createArdHauptstadtstudio(ardPrisms);
    const dishes = index.solids.filter(
      (solid): solid is Extract<ArdRoofEquipmentSolid, { kind: "dish" }> =>
        solid.kind === "dish",
    );
    const mast = findSolid("ard-roof-mast", "vertical-cylinder");
    expect(dishes.map((dish) => dish.radiusM * 2)).toEqual(
      model.userData.roofEquipment.dishDiametersM,
    );
    expect(mast.halfHeightM * 2).toBe(model.userData.roofEquipment.mastHeightM);
    expect(
      index.solids.filter(({ id }) => id.includes("screen-vent")),
    ).toHaveLength(model.userData.detailCounts.ventCount);
    expect(index.solids).toHaveLength(17);
    for (const solid of index.solids) {
      expect(index.solidAt(...solid.centerWorldM)).toBeTrue();
    }
    expect(index.solidAt(640, index.roofYM + 4, 35)).toBeFalse();
  });

  test("uses the rendered dish tilt instead of an axis-aligned blocking slab", () => {
    const index = collision();
    const dish = findSolid("ard-roof-dish-large", "dish");
    const radial = dish.radiusM * 0.8;
    const rimPoint = {
      x: dish.centerWorldM[0] + Math.cos(dish.rotationY) * radial,
      y: dish.centerWorldM[1],
      z: dish.centerWorldM[2] - Math.sin(dish.rotationY) * radial,
    };
    expect(index.solidAt(rimPoint.x, rimPoint.y, rimPoint.z)).toBeTrue();

    const normalDistance = 0.45;
    const normal = {
      x: Math.sin(dish.rotationY) * Math.sin(dish.rotationX),
      y: Math.cos(dish.rotationX),
      z: Math.cos(dish.rotationY) * Math.sin(dish.rotationX),
    };
    expect(
      index.solidAt(
        dish.centerWorldM[0] + normal.x * normalDistance,
        dish.centerWorldM[1] + normal.y * normalDistance,
        dish.centerWorldM[2] + normal.z * normalDistance,
      ),
    ).toBeFalse();
  });

  test("swept Schwellenraum flight cannot pass through the large dish", () => {
    const index = collision();
    const dish = findSolid("ard-roof-dish-large", "dish");
    const normal = {
      x: Math.sin(dish.rotationY) * Math.sin(dish.rotationX),
      y: Math.cos(dish.rotationX),
      z: Math.cos(dish.rotationY) * Math.sin(dish.rotationX),
    };
    const start = {
      x: dish.centerWorldM[0] - normal.x * 3,
      y: dish.centerWorldM[1] - normal.y * 3,
      z: dish.centerWorldM[2] - normal.z * 3,
    };
    const result = resolveSchwellenraumFlightTranslation(
      start,
      { x: normal.x * 6, y: normal.y * 6, z: normal.z * 6 },
      emptyEnvironment(index.solidAt),
    );
    expect(result.blocked).toBeTrue();
    const advance =
      (result.position.x - start.x) * normal.x +
      (result.position.y - start.y) * normal.y +
      (result.position.z - start.z) * normal.z;
    expect(advance).toBeGreaterThan(1.8);
    expect(advance).toBeLessThan(3);
  });

  test("pedestrian movement cannot walk through the roof technical box", () => {
    const index = collision();
    const environment = emptyEnvironment(index.solidAt, index.roofYM);
    let state = createPedestrianState(environment, {
      groundYHint: index.roofYM,
      x: 657,
      yaw: Math.PI / 2,
      z: 15,
    });
    for (let step = 0; step < 24; step += 1) {
      state = stepPedestrian(
        state,
        { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
        0.05,
        environment,
      ).state;
    }
    expect(state.x).toBeGreaterThan(657);
    expect(state.x).toBeLessThan(658.5);
    expect(state.z).toBeCloseTo(15);
  });
});
