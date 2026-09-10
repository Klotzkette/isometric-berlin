import { describe, expect, test } from "bun:test";
import {
  Frustum, Group, InstancedMesh, Matrix4, Mesh,
  OrthographicCamera, Raycaster, Vector3,
  type Object3D,
} from "three";
import {
  createIsometricCity, isFriedrichstrasseStationFootprintSuppressed,
  isHauptbahnhofFootprintSuppressed, isInterimOfficeFootprintSuppressed,
  PRISM_GLASSED_IDS, PRISM_SUPPRESSED_IDS, setIsoNightPresentation,
  type PrismBuilding, type PrismPayload,
} from "../src/IsometricCityWorld";
import { MOBILE_DETAIL_BATCH_SIZE, buildingDetailDistricts, selectBuildingDetailDistricts } from "../src/buildingDetailStreaming";
import { createProgressiveBuildingCoverage } from "../src/progressiveBuildingCoverage";
import {
  DESKTOP_INITIAL_BUILDING_COUNT, DESKTOP_TOTAL_BUILDING_LIMIT,
  MOBILE_INITIAL_BUILDING_COUNT, MOBILE_TOTAL_BUILDING_LIMIT,
  PROGRESSIVE_BUILDING_BATCH_SIZE, progressiveWorldTransition,
  splitProgressiveBuildings, type ProgressiveWorldWorkerOutput,
} from "../src/progressiveWorld";
import { serializeObject3DForTransfer } from "../src/transferableObject3D";
import { progressiveCoverageHost } from "./helpers/progressiveCoverageHost";
import type { VisualMode } from "../src/visualMode";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const viewerSource = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();

// Suppressed source prisms already have authored hero geometry. They must not
// reappear as closed boxes (especially the two walk-through train stations).
function representable(building: PrismBuilding): boolean {
  return building.ring.length >= 3 && !PRISM_SUPPRESSED_IDS.has(building.id) &&
    !isInterimOfficeFootprintSuppressed(building) &&
    !isFriedrichstrasseStationFootprintSuppressed(building) &&
    (PRISM_GLASSED_IDS.has(building.id) || !isHauptbahnhofFootprintSuppressed(building));
}

function meshes(root: Object3D): Mesh[] {
  const result: Mesh[] = [];
  root.traverseVisible((object) => { if (object instanceof Mesh) result.push(object); });
  return result;
}

function retainedBytes(root: Object3D): number {
  const buffers = new Set<ArrayBufferLike>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const attribute of Object.values(object.geometry.attributes)) buffers.add(attribute.array.buffer);
    if (object.geometry.index) buffers.add(object.geometry.index.array.buffer);
    if (object instanceof InstancedMesh) {
      buffers.add(object.instanceMatrix.array.buffer);
      if (object.instanceColor) buffers.add(object.instanceColor.array.buffer);
    }
  });
  return [...buffers].reduce((total, buffer) => total + buffer.byteLength, 0);
}

function packet(buildings: PrismBuilding[], index: number): Extract<ProgressiveWorldWorkerOutput, { type: "batch" }> {
  const exact = createIsometricCity(payload, null, null, null, {
    buildings, includeContext: false, smoothSurfaces: null,
  });
  const transfer = serializeObject3DForTransfer(exact);
  return {
    type: "batch", id: `buildings-${index + 1}`, kind: "buildings", build_ms: 0,
    replaces: `buildings-preview-${index + 1}`,
    object: structuredClone(transfer.object, { transfer: transfer.transfers }),
  };
}

function fixture() {
  // Small actual source footprints keep lifecycle tests fast while exercising
  // real LoD2 generation and transferred building materials.
  const buildings = [10000, 10010, 10100, 10200].map((index) => payload.buildings[index]);
  expect(buildings.every(representable)).toBeTrue();
  const partition = { initial: [], remaining: [[buildings[0]], [buildings[1]]], omitted: buildings.slice(2) };
  const world = new Group();
  const coverage = createProgressiveBuildingCoverage(payload, partition);
  world.add(coverage);
  const previews = coverage.children.slice(1);
  const host = progressiveCoverageHost(viewerSource, world);
  function assertCoverage() {
    world.updateMatrixWorld(true);
    for (const [index, batch] of partition.remaining.entries()) {
      const exact = world.children.filter((child) => child.userData.progressiveWorldBatchId === `buildings-${index + 1}` && child.visible);
      expect(Number(previews[index].visible) + exact.length).toBe(1);
      // A downward ray must still encounter a real represented roof at the
      // mapped building location after every observable lifecycle transition.
      const building = batch[0];
      const x = building.ring.reduce((sum, point) => sum + point[0], 0) / building.ring.length / 10;
      const z = building.ring.reduce((sum, point) => sum + point[1], 0) / building.ring.length / 10;
      const ray = new Raycaster(new Vector3(x, 500, z), new Vector3(0, -1, 0));
      expect(ray.intersectObjects(meshes(world), false).length).toBeGreaterThan(0);
    }
    expect(coverage.children[0].visible).toBeTrue();
  }
  return { host, world, coverage, previews, partition, assertCoverage };
}

describe("complete buildings before worker refinement", () => {
  for (const mobile of [true, false]) {
    test(`${mobile ? "mobile" : "desktop"}: all source buildings have permanent colored envelopes within the memory budget`, () => {
      const partition = splitProgressiveBuildings(
        payload.buildings,
        mobile ? MOBILE_INITIAL_BUILDING_COUNT : DESKTOP_INITIAL_BUILDING_COUNT,
        mobile ? MOBILE_DETAIL_BATCH_SIZE : PROGRESSIVE_BUILDING_BATCH_SIZE,
        mobile ? Number.POSITIVE_INFINITY : DESKTOP_TOTAL_BUILDING_LIMIT,
        !mobile,
      );
      const all = [...partition.initial, ...partition.omitted, ...partition.remaining.flat()];
      expect(all.length).toBe(payload.buildings.length);
      expect(new Set(all).size).toBe(payload.buildings.length);
      const coverage = createProgressiveBuildingCoverage(payload, partition);
      const host = progressiveCoverageHost(viewerSource, new Group().add(coverage), mobile);
      try {
        expect(coverage.children.length).toBe(1 + partition.remaining.length);
        expect(meshes(coverage).length).toBeLessThanOrEqual(coverage.children.length);
        let represented = partition.initial.filter(representable).length;
        for (const [index, buildings] of [partition.omitted, ...partition.remaining].entries()) {
          const group = coverage.children[index];
          const visible = buildings.filter(representable);
          expect(group.userData.sourceBuildingCount).toBe(buildings.length);
          expect(group.userData.visibleBuildingCount).toBe(visible.length);
          represented += visible.length;
          if (visible.length === 0) { expect(group.children).toHaveLength(0); continue; }
          const shell = group.children[0] as Mesh;
          expect(shell).toBeInstanceOf(Mesh);
          expect(shell.geometry.index).not.toBeNull();
          expect(shell.geometry.getAttribute("color").count).toBe(shell.geometry.getAttribute("position").count);
          shell.updateWorldMatrix(true, false);
          // Accurate bounds keep the permanent envelopes drawable after a fast
          // jump to either end of every spatial source district.
          for (const building of [visible[0], visible[Math.floor(visible.length / 2)], visible.at(-1)!]) {
            const target = new Vector3(building.ring[0][0] / 10, building.y0_dm / 10, building.ring[0][1] / 10);
            const camera = new OrthographicCamera(-160, 160, 160, -160, 0.1, 10000);
            camera.position.copy(target).add(new Vector3(300, 300, 300));
            camera.lookAt(target); camera.updateMatrixWorld(true);
            const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
            expect(frustum.intersectsObject(shell)).toBeTrue();
          }
        }
        expect(represented).toBe(payload.buildings.filter(representable).length);
        expect(retainedBytes(coverage)).toBeLessThan(32 * 1024 * 1024);
        if (mobile) {
          expect(partition.omitted).toHaveLength(0);
          expect(partition.remaining.every((batch) => batch.length <= MOBILE_DETAIL_BATCH_SIZE)).toBeTrue();
        }
        expect(host.acknowledged).toHaveLength(0);
      } finally { host.dispose(); }
    });
  }
});

describe("production preview replacement lifecycle", () => {
  test("a settled district set ignores priority-only reordering while unfinished detail still reprioritizes", () => {
    const buildings: PrismBuilding[] = Array.from({ length: 3 }, (_, index) => ({
      id: `ordering-fixture-${index}`, class: 0, h_dm: 100, y0_dm: 0,
      ring: [[index * 4000, 80000], [index * 4000 + 100, 80000],
        [index * 4000 + 100, 80100], [index * 4000, 80100]],
    }));
    const partition = { initial: [], omitted: [], remaining: buildings.map((building) => [building]) };
    const coverage = createProgressiveBuildingCoverage(payload, partition);
    const world = new Group().add(coverage);
    const host = progressiveCoverageHost(viewerSource, world);
    try {
      const districts = buildingDetailDistricts(partition.remaining);
      host.runtime.mobileBuildingDistricts = districts;
      host.view(0, 8000, 1000);
      for (const [index, batch] of partition.remaining.entries()) host.attach(packet(batch, index));
      const wanted = host.runtime.mobileBuildingWanted!;
      const revision = host.runtime.mobileBuildingViewRevision!;
      host.attach({ type: "settled", viewRevision: revision });
      const resident = [...host.runtime.progressiveWorldBatches];
      let disposals = 0;
      for (const batch of resident) {
        for (const mesh of meshes(batch)) mesh.geometry.addEventListener("dispose", () => { disposals += 1; });
      }
      host.runtime.renderInvalidated = false;
      const reordered = selectBuildingDetailDistricts(districts, [800, 8000], [1280, 8000]);
      expect(reordered).not.toEqual(wanted);
      expect([...reordered].sort()).toEqual([...wanted].sort());
      host.view(800, 8000, 2000);
      expect(host.views).toHaveLength(1);
      expect(host.runtime.mobileBuildingViewRevision).toBe(revision);
      expect(host.runtime.mobileBuildingWanted).toBe(wanted);
      expect(host.runtime.progressiveWorldState).toBe("complete");
      expect(host.runtime.renderInvalidated).toBeFalse();
      expect(host.runtime.progressiveWorldBatches).toEqual(resident);
      expect(disposals).toBe(0);

      // With unfinished work, changing priority must still reach the worker;
      // equal membership is not enough to freeze its construction order.
      host.runtime.progressiveWorldState = "loading";
      host.view(800, 8000, 2300);
      expect(host.views).toHaveLength(2);
      expect(host.runtime.mobileBuildingViewRevision).toBe(revision + 1);
      expect(host.runtime.mobileBuildingWanted).toEqual(
        selectBuildingDetailDistricts(districts, [800, 8000]),
      );
      expect(host.runtime.progressiveWorldBatches).toEqual(resident);
      expect(disposals).toBe(0);
    } finally { host.dispose(); }
  });

  test("fast travel restores source roofs before evicting distant detail and accepts its return", () => {
    const buildings: PrismBuilding[] = Array.from({ length: 16 }, (_, index) => ({
      id: `stream-fixture-${index}`, class: 0, h_dm: 100, y0_dm: 0,
      ring: [[index * 4000, 80000], [index * 4000 + 100, 80000],
        [index * 4000 + 100, 80100], [index * 4000, 80100]],
    }));
    const partition = { initial: [], omitted: [], remaining: buildings.map((b) => [b]) };
    const coverage = createProgressiveBuildingCoverage(payload, partition);
    const world = new Group().add(coverage);
    const host = progressiveCoverageHost(viewerSource, world);
    try {
      host.runtime.mobileBuildingDistricts = buildingDetailDistricts(partition.remaining);
      host.view(0, 8000, 1000);
      expect(host.runtime.mobileBuildingWanted).toContain("buildings-1");
      expect(host.runtime.mobileBuildingWanted).not.toContain("buildings-16");
      host.attach(packet(partition.remaining[0], 0));
      const original = host.runtime.progressiveWorldBatches[0];
      let disposed = false;
      meshes(original)[0].geometry.addEventListener("dispose", () => {
        disposed = true;
        expect(coverage.children[1].visible).toBeTrue();
      });
      host.view(6000, 8000, 2000);
      expect(disposed).toBeTrue();
      expect(host.runtime.mobileBuildingWanted).toContain("buildings-16");
      expect(host.runtime.progressiveWorldBatches).toHaveLength(0);
      host.attach(packet(partition.remaining[15], 15));
      expect(coverage.children[16].visible).toBeFalse();
      expect(coverage.children[1].visible).toBeTrue();
      const revision = host.runtime.mobileBuildingViewRevision!;
      host.attach({ type: "settled", viewRevision: revision - 1 });
      expect(host.runtime.progressiveWorldState).toBe("loading");
      host.attach({ type: "settled", viewRevision: revision });
      expect(host.runtime.progressiveWorldState).toBe("complete");
      expect(host.terminated).toBe(0);
      expect(host.runtime.progressiveWorldInput).toBeDefined();
      host.view(0, 8000, 3000);
      host.attach(packet(partition.remaining[0], 0));
      expect(coverage.children[1].visible).toBeFalse();
      expect(coverage.children[16].visible).toBeTrue();
      expect(host.runtime.progressiveWorldBatches).toHaveLength(1);
    } finally { host.dispose(); }
  });

  test("a district finishing after the camera left is acknowledged without hiding the envelope", () => {
    const f = fixture();
    try {
      f.host.runtime.mobileBuildingWanted = ["buildings-2"];
      f.host.attach(packet(f.partition.remaining[0], 0));
      expect(f.host.acknowledged).toEqual(["buildings-1"]);
      expect(f.host.runtime.progressiveWorldBatches).toHaveLength(0);
      f.assertCoverage();
      f.host.attach(packet(f.partition.remaining[1], 1));
      f.assertCoverage();
    } finally { f.host.dispose(); }
  });

  for (const mode of ["day", "night", "snowstorm", "schwellenraum"] as VisualMode[]) {
    test(`${mode}: relights and attaches exact geometry before hiding its fallback`, () => {
      const f = fixture();
      try {
        f.host.runtime.lightingMode = mode;
        setIsoNightPresentation(f.world, mode === "night", true, mode);
        f.assertCoverage();
        let additions = 0;
        f.world.addEventListener("childadded", ({ child }) => {
          if (!child.userData.progressiveWorldBatch) return;
          additions += 1;
          const index = Number(child.userData.progressiveWorldBatchId.split("-").at(-1)) - 1;
          expect(f.previews[index].visible).toBeTrue();
          expect(child.parent).toBe(f.world);
          const bodies = child.getObjectByName("LoD2 prism buildings") as Mesh;
          expect(bodies).toBeInstanceOf(Mesh);
          expect(bodies.material).toBe(mode === "night" ? bodies.userData.nightMaterial : mode === "schwellenraum" ? bodies.userData.schwellenraumMaterial : bodies.userData.dayMaterial);
        });
        for (const [index, buildings] of f.partition.remaining.entries()) {
          f.host.attach(packet(buildings, index));
          f.assertCoverage();
        }
        expect(additions).toBe(2);
        expect(f.host.acknowledged).toEqual(["buildings-1", "buildings-2"]);
        f.host.attach({ type: "complete", batches: 2, build_ms: 0, pretriangulated: false });
        expect(f.host.runtime.progressiveWorldState).toBe("complete");
        f.assertCoverage();
        expect(progressiveWorldTransition("minecraft", "complete")).toBe("none");
      } finally { f.host.dispose(); }
    });
  }

  test("background/Minecraft pause retains exact roofs and restart requests only missing batches", () => {
    const f = fixture();
    let disposals = 0;
    try {
      f.host.attach(packet(f.partition.remaining[0], 0));
      const batch = f.host.runtime.progressiveWorldBatches[0];
      const geometry = meshes(batch)[0].geometry;
      geometry.addEventListener("dispose", () => {
        disposals += 1;
      });
      expect(progressiveWorldTransition("minecraft", "loading")).toBe("pause");
      f.host.pause();
      expect(disposals).toBe(0);
      expect(batch.parent).toBe(f.world);
      expect(meshes(batch)[0].geometry).toBe(geometry);
      expect(f.previews[0].visible).toBeFalse();
      expect(f.host.runtime.progressiveWorldBatches).toEqual([batch]);
      expect(f.host.runtime.progressiveWorldState).toBe("idle");
      f.assertCoverage();
      f.host.restart();
      expect(f.host.builds[0].completedBatchIds).toEqual(["buildings-1"]);
      f.host.attach(packet(f.partition.remaining[1], 1));
      f.assertCoverage();
      expect(f.host.runtime.progressiveWorldBatches).toHaveLength(2);
      f.host.pause();
      expect(disposals).toBe(0);
      f.assertCoverage();
      f.host.restart();
      expect(f.host.builds[1].completedBatchIds).toEqual(["buildings-1", "buildings-2"]);
      f.host.attach({ type: "complete", batches: 0, build_ms: 0, pretriangulated: false });
      expect(f.host.runtime.progressiveWorldState).toBe("complete");
      expect(f.host.runtime.progressiveWorldBatches[0]).toBe(batch);
      f.assertCoverage();
    } finally { f.host.dispose(); }
    expect(disposals).toBe(1);
  });

  test("Worker API unavailable preserves complete startup coverage", () => {
    const f = fixture();
    try {
      f.host.unavailable();
      expect(f.host.runtime.progressiveWorldState).toBe("failed");
      expect(f.host.deferredStarts).toBe(1);
      expect(f.host.warnings).toHaveLength(1);
      f.assertCoverage();
    } finally { f.host.dispose(); }
  });

  for (const failure of ["decode", "acknowledgement", "worker"]) {
    test(`${failure} failure retains successful roofs and unreplaced distant coverage`, () => {
      const f = fixture();
      try {
        f.host.attach(packet(f.partition.remaining[0], 0));
        if (failure === "decode") {
          const message = packet(f.partition.remaining[1], 1);
          message.object = null as unknown as typeof message.object;
          f.host.attach(message);
        } else if (failure === "acknowledgement") {
          f.host.failAcknowledgement();
          f.host.attach(packet(f.partition.remaining[1], 1));
        } else f.host.fail();
        expect(f.host.runtime.progressiveWorldState).toBe("failed");
        expect(f.host.runtime.progressiveWorldWorker).toBeUndefined();
        expect(f.host.warnings).toHaveLength(1);
        f.assertCoverage();
      } finally { f.host.dispose(); }
    });
  }
});
