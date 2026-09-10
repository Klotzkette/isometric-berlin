import { describe, expect, test } from "bun:test";
import { Raycaster, Vector3 } from "three";
import {
  createHumboldthafenBuildingColumnTester,
  createHumboldthafenBuildingDetails,
  HUMBOLDTHAFEN_BUILDING_IDS,
  harbourPrismContains,
  planHumboldthafenBuildingDetails,
} from "../src/HumboldthafenBuildings";
import {
  HUMBOLDTHAFEN_H3_COURTYARD_PROFILE,
  resolveHumboldthafenPrism,
} from "../src/humboldthafenCourtyardProfile";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import sourceJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const source = sourceJson as unknown as PrismPayload;
const payload = {
  ...source,
  buildings: source.buildings.filter(p => HUMBOLDTHAFEN_BUILDING_IDS.has(p.id)),
};
const main = payload.buildings.find(p => p.id === "ee9JgIcN")!;
const court = new Vector3(70, 60, -883);

describe("H3 upper courtyard source overlap", () => {
  test("uses the existing enclosing wall vertices and retains every source record", () => {
    const before = JSON.stringify(payload);
    const surrounding = payload.buildings.find(p => p.id === "WeZM0Chn")!;
    const resolved = resolveHumboldthafenPrism(main);
    expect(main.holes).toHaveLength(0);
    expect(resolved.ring).toBe(main.ring);
    expect(resolved.h_dm).toBe(main.h_dm);
    expect(resolved.y0_dm).toBe(main.y0_dm);
    expect(resolved.holes).toHaveLength(1);
    for (const point of HUMBOLDTHAFEN_H3_COURTYARD_PROFILE.ring) {
      expect(surrounding.ring).toContainEqual([...point]);
    }
    for (const id of HUMBOLDTHAFEN_H3_COURTYARD_PROFILE.lowerRoofIds) {
      const lower = payload.buildings.find(p => p.id === id)!;
      expect(lower).toBeDefined();
      expect(resolveHumboldthafenPrism(lower)).toBe(lower);
      expect((lower.y0_dm + lower.h_dm) / 10).toBeLessThan(13);
    }
    expect(JSON.stringify(payload)).toBe(before);
    expect(resolveHumboldthafenPrism(resolved)).toBe(resolved);
    const transferred = structuredClone(resolved);
    expect(resolveHumboldthafenPrism(transferred)).toBe(transferred);
    expect(harbourPrismContains(resolved, court.x, court.z)).toBeFalse();
  });

  test("removes the original tall Minecraft court columns before adding low roofs", () => {
    const replace = createHumboldthafenBuildingColumnTester();
    expect(replace(court.x, court.z)).toBeTrue();
    expect(replace(140, -885)).toBeFalse();
    expect(replace(188.2751047, -898.0614511)).toBeFalse();
  });

  test("reveals source court walls and low roofs in both Minecraft profiles", () => {
    for (const mobileLike of [false, true]) {
      const blocks = planHumboldthafenBuildingDetails(payload.buildings, true, mobileLike);
      const lowerIds = new Set<string>(HUMBOLDTHAFEN_H3_COURTYARD_PROFILE.lowerRoofIds);
      expect(blocks.some(b => lowerIds.has(b.sourceId) && b.role === "source-flat-roof")).toBeTrue();
      const root = createHumboldthafenBuildingDetails(payload, { minecraft: true, mobileLike });
      root.updateMatrixWorld(true);
      const hits = new Raycaster(court, new Vector3(0, -1, 0)).intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeLessThan(13);
      expect(hits[0].point.y).toBeGreaterThan(11.5);
      const highFacade = blocks.filter(b => b.sourceId === "ee9JgIcN" && b.role === "window");
      expect(highFacade.some(b => b.position[0] > 60 && b.position[0] < 81 && b.position[2] < -873 && b.position[2] > -901)).toBeTrue();
    }
  });

  test("the complete drawn source composition no longer covers the lower court", () => {
    const before = JSON.stringify(payload);
    const root = createIsometricCity(payload, null, null, null, { includeContext: false });
    root.add(createHumboldthafenBuildingDetails(payload));
    root.updateMatrixWorld(true);
    const hits = new Raycaster(court, new Vector3(0, -1, 0)).intersectObject(root, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeLessThan(13);
    expect(hits[0].point.y).toBeGreaterThan(11.5);
    expect(JSON.stringify(payload)).toBe(before);
  });

  test("collision leaves the upper court open while retaining its low solid floor", () => {
    const obstacles = compilePedestrianObstacles(payload);
    expect(pedestrianPointIsBlocked(court.x, court.z, 13, obstacles)).toBeFalse();
    expect(pedestrianPointIsBlocked(court.x, court.z, 24, obstacles)).toBeFalse();
    expect(pedestrianPointIsBlocked(court.x, court.z, 8, obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(50, -880, 13, obstacles)).toBeTrue();
  });
});
