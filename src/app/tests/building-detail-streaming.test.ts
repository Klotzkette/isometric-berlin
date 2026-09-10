import { describe, expect, test } from "bun:test";
import { Box3, Frustum, Matrix4, PerspectiveCamera, Vector3 } from "three";
import type { PrismBuilding, PrismPayload } from "../src/IsometricCityWorld";
import {
  buildingDetailDistricts,
  buildingDetailViewPoints,
  MOBILE_DETAIL_BATCH_SIZE,
  MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS,
  MOBILE_DETAIL_RESIDENT_LIMIT,
  MOBILE_DETAIL_VIEW_REACH_M,
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

  test("distributes bounded detail between the ground focus, actual view and route ahead", () => {
    const local = Array.from({ length: 20 }, (_, index) => district(index + 1, index * 10));
    const view = Array.from({ length: 20 }, (_, index) => district(index + 21, 2_000 + index * 10));
    const route = Array.from({ length: 20 }, (_, index) => district(index + 41, -2_000 - index * 10));
    const districts = [...local, ...view, ...route];
    const ids = selectBuildingDetailDistricts(districts, [5, 5], [-1_995, 5], {
      viewPoints: [[2_005, 5]],
    });
    expect(ids.slice(0, 3)).toEqual(local.slice(0, 3).map((entry) => entry.id));
    expect(ids.filter((id) => local.some((entry) => entry.id === id))).toHaveLength(3);
    expect(ids.filter((id) => view.some((entry) => entry.id === id))).toHaveLength(9);
    expect(ids.filter((id) => route.some((entry) => entry.id === id))).toHaveLength(3);
    assertBudget(districts, ids);
  });

  test("retention suppresses boundary jitter but never delays the newly entered nearest district", () => {
    const districts = Array.from({ length: 60 }, (_, index) => district(index + 1, (index - 30) * 30));
    const options = { viewPoints: [[5, 5]] as const };
    const initial = selectBuildingDetailDistricts(districts, [5, 5], [5, 5], options);
    for (const x of [4.8, 5.2, 4.9, 5.1]) {
      const wanted = selectBuildingDetailDistricts(districts, [x, 5], [x, 5], {
        viewPoints: [[x, 5]], retainedIds: initial,
      });
      expect(new Set(wanted)).toEqual(new Set(initial));
    }
    const moved = selectBuildingDetailDistricts(districts, [725, 5], [725, 5], {
      viewPoints: [[725, 5]], retainedIds: initial,
    });
    expect(moved[0]).toBe(districts.find((entry) => entry.center[0] === 725)!.id);
    expect(moved.filter((id) => initial.includes(id))).toHaveLength(0);
    assertBudget(districts, moved);
    // Irrelevant/retired cache identifiers cannot consume active capacity.
    expect(selectBuildingDetailDistricts(districts, [5, 5], [5, 5], {
      ...options, retainedIds: ["missing"],
    })).toEqual(initial);
  });

  test("view samples follow orbit, zoom and aspect without unbounded horizon intersections", () => {
    const focus = new Vector3(100, 10, -100);
    const camera = new PerspectiveCamera(16, 390 / 664, 0.25, 18_000);
    camera.position.copy(focus).add(new Vector3(0, 300, 1_000));
    camera.lookAt(focus);
    const portrait = buildingDetailViewPoints(camera, focus);
    expect(portrait).toHaveLength(5);
    expect(portrait[0][1]).toBeLessThan(focus.z);
    camera.aspect = 844 / 390;
    camera.updateProjectionMatrix();
    const landscape = buildingDetailViewPoints(camera, focus);
    expect(landscape[2][0] - landscape[1][0]).toBeGreaterThan(
      3 * (portrait[2][0] - portrait[1][0]),
    );
    camera.position.copy(focus).add(new Vector3(0, 600, 2_000));
    camera.lookAt(focus);
    expect(buildingDetailViewPoints(camera, focus)[0][1]).toBeLessThan(portrait[0][1]);
    camera.position.copy(focus).add(new Vector3(0, 300, -1_000));
    camera.lookAt(focus);
    expect(buildingDetailViewPoints(camera, focus)[0][1]).toBeGreaterThan(focus.z);
    for (const height of [0, 0.001, 1, -50, 300]) {
      camera.position.copy(focus).add(new Vector3(0, height, 1_000));
      camera.lookAt(focus);
      for (const [x, z] of buildingDetailViewPoints(camera, focus)) {
        expect(Number.isFinite(x) && Number.isFinite(z)).toBeTrue();
        expect(Math.hypot(x - focus.x, z - focus.z)).toBeLessThanOrEqual(MOBILE_DETAIL_VIEW_REACH_M + 1e-8);
      }
    }
    camera.position.copy(focus);
    camera.lookAt(focus.clone().add(new Vector3(0, 0, -1)));
    const walking = buildingDetailViewPoints(camera, focus);
    expect(walking.every(([, z]) => z < focus.z)).toBeTrue();
    expect(Math.hypot(walking[0][0] - focus.x, walking[0][1] - focus.z)).toBeCloseTo(MOBILE_DETAIL_VIEW_REACH_M);
    expect(selectBuildingDetailDistricts([], [0, 0], [0, 0], { viewPoints: walking })).toEqual([]);
  });

  test("real narrow isometric views prepare substantially more visible distant source detail at the same budget", async () => {
    const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
    const partition = splitProgressiveBuildings(payload.buildings, MOBILE_INITIAL_BUILDING_COUNT, MOBILE_DETAIL_BATCH_SIZE);
    const districts = buildingDetailDistricts(partition.remaining);
    const focus = new Vector3(317.729, 21.595, 40.477);
    const scale = Math.tan(39 * Math.PI / 360) / Math.tan(16 * Math.PI / 360);
    const offsets = [
      new Vector3(-165.967, 38.048, 67.055).multiplyScalar(scale),
      new Vector3(-2_000, 1_500, 2_000),
      new Vector3(-2_500, 300, 1_000),
    ];
    const source = partition.remaining.flatMap((batch, index) => batch.map((building) => {
      const xs = building.ring.map(([x]) => x / 10);
      const zs = building.ring.map(([, z]) => z / 10);
      return { id: `buildings-${index + 1}`, box: new Box3(
        new Vector3(Math.min(...xs), building.y0_dm / 10, Math.min(...zs)),
        new Vector3(Math.max(...xs), (building.y0_dm + building.h_dm) / 10, Math.max(...zs)),
      ) };
    }));
    for (const offset of offsets) {
      const camera = new PerspectiveCamera(16, 390 / 664, 0.25, 18_000);
      camera.position.copy(focus).add(offset);
      camera.lookAt(focus);
      const points = buildingDetailViewPoints(camera, focus);
      const selected = selectBuildingDetailDistricts(districts, [focus.x, focus.z], [focus.x, focus.z], { viewPoints: points });
      const previous = selectBuildingDetailDistricts(districts, [focus.x, focus.z]);
      assertBudget(districts, selected);
      const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      // Conservative source bounds measure selection coverage, not occlusion
      // or the performance of a physical phone. All envelopes remain present.
      const distant = source.filter(({ box }) => frustum.intersectsBox(box) && Math.hypot(
        Math.max(box.min.x - focus.x, 0, focus.x - box.max.x),
        Math.max(box.min.z - focus.z, 0, focus.z - box.max.z),
      ) > 800);
      const oldExact = distant.filter(({ id }) => previous.includes(id)).length;
      const newExact = distant.filter(({ id }) => selected.includes(id)).length;
      expect(distant.length).toBeGreaterThan(50);
      expect(newExact).toBeGreaterThan(oldExact + distant.length * 0.5);
    }
  });
});
