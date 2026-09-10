import { describe, expect, test } from "bun:test";
import type { PrismBuilding, PrismPayload } from "../src/IsometricCityWorld";
import {
  buildingDetailDistricts,
  MOBILE_DETAIL_BATCH_SIZE,
  MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS,
  MOBILE_DETAIL_RESIDENT_LIMIT,
  selectBuildingDetailDistricts,
  type BuildingDetailDistrict,
} from "../src/buildingDetailStreaming";
import {
  MOBILE_INITIAL_BUILDING_COUNT,
  splitProgressiveBuildings,
} from "../src/progressiveWorld";

function building(id: string, x: number, z: number): PrismBuilding {
  return {
    id, class: 0, y0_dm: 0, h_dm: 100,
    ring: [[x * 10, z * 10], [(x + 8) * 10, z * 10],
      [(x + 8) * 10, (z + 6) * 10], [x * 10, (z + 6) * 10]],
  };
}

function district(id: number, x: number, z = 0, count = MOBILE_DETAIL_BATCH_SIZE): BuildingDetailDistrict {
  return {
    id: `buildings-${id}`, previewId: `buildings-preview-${id}`,
    count, center: [x + 5, z + 5], bounds: [x, z, x + 10, z + 10],
  };
}

function assertBudget(districts: readonly BuildingDetailDistrict[], ids: readonly string[]): void {
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBeLessThanOrEqual(MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS);
  const counts = new Map(districts.map((entry) => [entry.id, entry.count]));
  expect(ids.every((id) => counts.has(id))).toBeTrue();
  expect(ids.reduce((sum, id) => sum + counts.get(id)!, 0)).toBeLessThanOrEqual(
    MOBILE_DETAIL_RESIDENT_LIMIT,
  );
}

describe("camera-following mobile building detail", () => {
  test("source partition IDs and world bounds survive sparse batches without retaining source objects", () => {
    const source = [
      [building("west", -20, -30), building("east", 10, 20)],
      [],
      [building("remote", 2_000, -1_000)],
    ];
    const districts = buildingDetailDistricts(source);
    expect(districts).toEqual([
      { id: "buildings-1", previewId: "buildings-preview-1", count: 2,
        center: [-1, -2], bounds: [-20, -30, 18, 26] },
      { id: "buildings-3", previewId: "buildings-preview-3", count: 1,
        center: [2_004, -997], bounds: [2_000, -1_000, 2_008, -994] },
    ]);
    source[0][0].ring[0][0] = 999;
    expect(districts[0].bounds).toEqual([-20, -30, 18, 26]);
    expect(buildingDetailDistricts([])).toEqual([]);
    expect(selectBuildingDetailDistricts([], [0, 0])).toEqual([]);
  });

  test("distance is measured to the district footprint, not its potentially distant centre", () => {
    const long = { ...district(1, 0), bounds: [0, 0, 2_000, 10] as const,
      center: [1_000, 5] as const };
    const nearby = district(2, -20);
    expect(selectBuildingDetailDistricts([long, nearby], [1, 5])[0]).toBe(long.id);
  });

  test("moving beyond the old 600 m boundary changes exact districts across every edge", () => {
    const districts = Array.from({ length: 61 }, (_, index) => district(index + 1, (index - 30) * 200));
    for (const x of [-6_000, -2_000, 0, 2_000, 6_000]) {
      const ids = selectBuildingDetailDistricts(districts, [x + 5, 5]);
      expect(ids[0]).toBe(districts.find((entry) => entry.center[0] === x + 5)!.id);
      assertBudget(districts, ids);
    }
    const initial = selectBuildingDetailDistricts(districts, [5, 5]);
    const distant = selectBuildingDetailDistricts(districts, [6_005, 5]);
    expect(initial.filter((id) => distant.includes(id))).toHaveLength(0);
  });

  test("reserves lookahead capacity without starving the camera's current neighbourhood", () => {
    const local = Array.from({ length: 20 }, (_, index) => district(index + 1, index * 20));
    const ahead = Array.from({ length: 20 }, (_, index) => district(index + 21, 5_000 + index * 20));
    const districts = [...local, ...ahead];
    const ids = selectBuildingDetailDistricts(districts, [5, 5], [5_005, 5]);
    expect(ids.slice(0, 3)).toEqual(["buildings-1", "buildings-2", "buildings-21"]);
    expect(ids.filter((id) => local.some((entry) => entry.id === id))).toHaveLength(10);
    expect(ids.filter((id) => ahead.some((entry) => entry.id === id))).toHaveLength(5);
    expect(selectBuildingDetailDistricts(districts, [5, 5], [5_005, 5])).toEqual(ids);
    assertBudget(districts, ids);
  });

  test("identical focus and lookahead retain nearest-first order without duplicate districts", () => {
    const districts = Array.from({ length: 25 }, (_, index) => district(index + 1, index * 100));
    const ids = selectBuildingDetailDistricts(districts, [5, 5]);
    expect(ids).toEqual(districts.slice(0, 15).map((entry) => entry.id));
    assertBudget(districts, ids);
  });

  test("bounds both source parts and resident draw calls for irregular or sparse districts", () => {
    const irregular = Array.from({ length: 30 }, (_, index) => district(index + 1, index * 10, 0, 700));
    irregular.push(district(31, 500, 0, 100));
    const selected = selectBuildingDetailDistricts(irregular, [0, 0]);
    expect(selected).toHaveLength(6);
    expect(selected).toContain("buildings-31");
    assertBudget(irregular, selected);
    const sparse = Array.from({ length: 100 }, (_, index) => district(index + 1, index * 100, 0, 1));
    expect(selectBuildingDetailDistricts(sparse, [0, 0])).toHaveLength(15);
    const tiny = sparse.slice(0, 3);
    expect(selectBuildingDetailDistricts(tiny, [0, 0])).toEqual(tiny.map((entry) => entry.id));
    assertBudget(sparse, selectBuildingDetailDistricts(sparse, [0, 0]));
  });

  test("the full committed source partition is selectable everywhere, including all formerly permanent shells", async () => {
    const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
    const partition = splitProgressiveBuildings(
      payload.buildings, MOBILE_INITIAL_BUILDING_COUNT, MOBILE_DETAIL_BATCH_SIZE,
    );
    expect(partition.omitted).toHaveLength(0);
    const districts = buildingDetailDistricts(partition.remaining);
    expect(districts.reduce((sum, entry) => sum + entry.count, partition.initial.length)).toBe(payload.buildings.length);
    expect(districts.every((entry) => entry.count <= MOBILE_DETAIL_BATCH_SIZE)).toBeTrue();
    expect(districts.map((entry) => entry.id)).toEqual(
      partition.remaining.map((_, index) => `buildings-${index + 1}`),
    );
    const selectedAnywhere = new Set<string>();
    for (const entry of districts) {
      const ids = selectBuildingDetailDistricts(districts, entry.center);
      expect(ids).toContain(entry.id);
      assertBudget(districts, ids);
      for (const id of ids) selectedAnywhere.add(id);
    }
    expect(selectedAnywhere.size).toBe(districts.length);
    // Reloading creates exactly the same IDs/bounds for retained-batch resume.
    const again = splitProgressiveBuildings(
      payload.buildings, MOBILE_INITIAL_BUILDING_COUNT, MOBILE_DETAIL_BATCH_SIZE,
    );
    expect(buildingDetailDistricts(again.remaining)).toEqual(districts);
  });
});
