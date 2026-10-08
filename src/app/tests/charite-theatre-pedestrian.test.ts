import { describe, expect, test } from "bun:test";
import { Raycaster, Vector3 } from "three";
import source from "../public/mesh/regierungsviertel/lod2-prisms.json";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { createChariteAnatomicalTheatre } from "../src/ChariteAnatomicalTheatre";
import {
  CHARITE_THEATRE_PROFILE as P,
  chariteTheatreSourceForPrism,
  chariteTheatreRoofAt,
} from "../src/chariteTheatreProfile";
import {
  compilePedestrianObstacles,
  createPedestrianState,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
  type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";

const buildings = (source as unknown as PrismPayload).buildings.filter((b) =>
  P.sourceIds.includes(b.id as (typeof P.sourceIds)[number]),
);
const original = JSON.stringify(buildings);

describe("Tieranatomisches Theater source-bound walking heights", () => {
  test("keeps the exact source body/drum plans and only replaces their obsolete flat heights", () => {
    const index = compilePedestrianObstacles({ buildings });
    const entries = [
      ...new Set([...index.cells.values()].flat()),
    ] as PedestrianPolygonObstacle[];
    const baseline = compilePedestrianObstacles({ buildings: [] });
    const expectedIds = new Set([...baseline.cells.values()].flat().map(e => e.sourceId));
    for (const id of P.sourceIds) expectedIds.add(id);
    expect(entries.map(e => e.sourceId).sort()).toEqual([...expectedIds].sort());
    for (const id of P.sourceIds) {
      const entry = entries.find((e) => e.sourceId === id)!;
      const part = chariteTheatreSourceForPrism(id)!;
      expect(entry.kind).toBe("polygon");
      expect(entry.ring).toBe(part.ring);
      expect(entry.holes).toBe(part.holes);
      expect(entry.coordinateScale).toBe(1);
      expect(entry.minY).toBe(P.groundY);
    }
    expect(JSON.stringify(buildings)).toBe(original);
    const duplicate = compilePedestrianObstacles({
      buildings: [...buildings, ...buildings],
    });
    expect(duplicate.obstacleCount).toBe(index.obstacleCount);
  });

  for (const mode of [
    "day",
    "night",
    "snowstorm",
    "schwellenraum",
    "minecraft",
  ] as const)
    test(`${mode}: raised body and descending dome support the player without a ghost flat roof`, () => {
      const obstacles = compilePedestrianObstacles({ buildings }, () => mode);
      const environment: PedestrianEnvironment = {
        obstacles,
        groundAt: () => P.groundY,
        water: [],
        bounds: { minX: 620, maxX: 750, minZ: -720, maxZ: -620 },
      };
      // The attached wing is represented up to14.6m, not the old8.2m default.
      expect(pedestrianPointIsBlocked(700, -650, 10, obstacles)).toBe(true);
      expect(pedestrianPointIsBlocked(700, -650, P.bodyTopY, obstacles)).toBe(
        false,
      );
      const wing = createPedestrianState(environment, {
        x: 700,
        z: -650,
        yaw: 0,
        groundYHint: 16,
        preserveHorizontalPosition: true,
      });
      expect(wing.groundY).toBeCloseTo(P.bodyTopY, 6);
      for (const [dx, dz] of [
        [0, 0],
        [3, 0],
        [6, 1],
        [7.5, 0],
      ]) {
        const x = P.center[0] + dx,
          z = P.center[1] + dz;
        const roof = chariteTheatreRoofAt(
          x,
          z,
          "sFAYdHwz",
          mode === "minecraft",
        )!;
        expect(pedestrianPointIsBlocked(x, z, roof - 0.2, obstacles)).toBe(
          true,
        );
        expect(pedestrianPointIsBlocked(x, z, roof, obstacles)).toBe(false);
        const standing = createPedestrianState(environment, {
          x,
          z,
          yaw: 0,
          groundYHint: 23,
          preserveHorizontalPosition: true,
        });
        expect(standing.groundY).toBeCloseTo(roof, 6);
      }
      expect(
        pedestrianPointIsBlocked(P.center[0] + 7.5, P.center[1], 21, obstacles),
      ).toBe(false);
      expect(pedestrianPointIsBlocked(640, -677, 6, obstacles)).toBe(false);
    });

  for (const native of [false, true])
    test(`${native ? "Minecraft" : "drawn"}: roof collision agrees with rendered triangles and rooflight`, () => {
      const root = createChariteAnatomicalTheatre(native);
      root.updateMatrixWorld(true);
      for (const [dx, dz] of [
        [0, 0],
        [3, 0],
        [4.13, 2.47],
        [6, 1],
        [7.5, 0],
      ]) {
        const x = P.center[0] + dx,
          z = P.center[1] + dz;
        const hits = new Raycaster(
          new Vector3(x, 25, z),
          new Vector3(0, -1, 0),
          0,
          15,
        ).intersectObject(root, true);
        expect(hits.length).toBeGreaterThan(0);
        expect(chariteTheatreRoofAt(x, z, "sFAYdHwz", native)).toBeCloseTo(
          hits[0].point.y,
          3,
        );
      }
      root.traverse((o: any) => {
        o.geometry?.dispose();
        const materials = new Set([
          o.material,
          o.userData.dayMaterial,
          o.userData.nightMaterial,
        ]);
        for (const material of materials) material?.dispose?.();
      });
    });
});
