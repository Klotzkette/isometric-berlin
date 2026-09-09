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
    test(`${mobile ? "mobile" : "desktop"}: real source is covered synchronously within the bounded box budget`, () => {
      const partition = splitProgressiveBuildings(
        payload.buildings,
        mobile ? MOBILE_INITIAL_BUILDING_COUNT : DESKTOP_INITIAL_BUILDING_COUNT,
        PROGRESSIVE_BUILDING_BATCH_SIZE,
        mobile ? MOBILE_TOTAL_BUILDING_LIMIT : DESKTOP_TOTAL_BUILDING_LIMIT,
        !mobile,
      );
      const all = [...partition.initial, ...partition.omitted, ...partition.remaining.flat()];
      expect(all.length).toBe(payload.buildings.length);
      expect(new Set(all).size).toBe(payload.buildings.length);
      const coverage = createProgressiveBuildingCoverage(payload, partition);
      const host = progressiveCoverageHost(viewerSource, new Group().add(coverage), mobile);
      try {
        expect(coverage.children.length).toBe(1 + partition.remaining.length);
        expect(meshes(coverage).length).toBeLessThanOrEqual(mobile ? 2 : 3);
        let represented = partition.initial.filter(representable).length;
        let maxOutsideMetres = 0;
        let maxVerticalError = 0;
        for (const [index, buildings] of [partition.omitted, ...partition.remaining].entries()) {
          const group = coverage.children[index];
          const visible = buildings.filter(representable);
          const shell = group.children[0] as InstancedMesh;
          expect(shell).toBeInstanceOf(InstancedMesh);
          expect(shell.count).toBe(visible.length);
          expect(group.userData.sourceBuildingCount).toBe(buildings.length);
          represented += shell.count;
          const matrix = new Matrix4();
          const local = new Vector3();
          for (const [instance, building] of visible.entries()) {
            shell.getMatrixAt(instance, matrix);
            const sizeX = new Vector3().setFromMatrixColumn(matrix, 0).length();
            const sizeZ = new Vector3().setFromMatrixColumn(matrix, 2).length();
            maxVerticalError = Math.max(maxVerticalError,
              Math.abs(matrix.elements[13] - matrix.elements[5] / 2 - building.y0_dm / 10),
              Math.abs(matrix.elements[5] - Math.max(2.5, building.h_dm / 10)));
            const inverse = matrix.clone().invert();
            for (const point of building.ring) {
              local.set(point[0] / 10, matrix.elements[13], point[1] / 10).applyMatrix4(inverse);
              maxOutsideMetres = Math.max(maxOutsideMetres,
                (Math.abs(local.x) - 0.5) * sizeX, (Math.abs(local.z) - 0.5) * sizeZ);
            }
          }
          // Teleport the isometric camera to distant ends of each real batch:
          // retained bounding volumes must still make the shell drawable.
          shell.updateWorldMatrix(true, false);
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
        expect(maxOutsideMetres).toBeLessThan(0.002);
        expect(maxVerticalError).toBeLessThan(0.001);
        // Count without reparenting: each independent fallback owns its buffers.
        const temporaryBytes = coverage.children.slice(1).reduce((sum, child) => sum + retainedBytes(child), 0);
        expect(temporaryBytes).toBeLessThanOrEqual((mobile ? 3440 : 8580) * 76 + partition.remaining.length * 840);
        expect(retainedBytes(coverage)).toBeLessThanOrEqual((payload.buildings.length - partition.initial.length) * 76 + coverage.children.length * 840);
        expect(host.acknowledged).toHaveLength(0);
      } finally { host.dispose(); }
    });
  }
});

describe("production preview replacement lifecycle", () => {
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

  test("background/Minecraft pause restores roofs before disposal and restart never duplicates a batch", () => {
    const f = fixture();
    try {
      f.host.attach(packet(f.partition.remaining[0], 0));
      const batch = f.host.runtime.progressiveWorldBatches[0];
      let disposals = 0;
      const geometry = meshes(batch)[0].geometry;
      geometry.addEventListener("dispose", () => {
        disposals += 1;
        expect(f.previews[0].visible).toBeTrue();
        expect(batch.parent).toBeNull();
        f.assertCoverage();
      });
      expect(progressiveWorldTransition("minecraft", "loading")).toBe("pause");
      f.host.pause();
      expect(disposals).toBe(1);
      expect(f.host.runtime.progressiveWorldBatches).toHaveLength(0);
      expect(f.host.runtime.progressiveWorldState).toBe("idle");
      f.assertCoverage();
      f.host.restart();
      for (const [index, buildings] of f.partition.remaining.entries()) f.host.attach(packet(buildings, index));
      f.assertCoverage();
      expect(f.host.runtime.progressiveWorldBatches).toHaveLength(2);
    } finally { f.host.dispose(); }
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
