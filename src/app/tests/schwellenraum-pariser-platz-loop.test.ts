import { describe, expect, test } from "bun:test";
import {
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";

import {
  PARISER_PLATZ_ENTITY_LOOP_PROFILE,
  PARISER_PLATZ_ENTITY_ROUTES,
  createPariserPlatzEntityLoop,
  createPariserPlatzLoopScreenScratch,
  isPariserPlatzEntityLoopOnScreen,
  pariserPlatzEntityLoopFromRoot,
  samplePariserPlatzEntityRoute,
  updatePariserPlatzEntityLoop,
} from "../src/visual-modes/schwellenraum/pariserPlatzEntityLoop";
import {
  createSchwellenraumPraesentation,
  setSchwellenraumPraesentation,
} from "../src/visual-modes/schwellenraum/presentation";

function instanceMatrices(field: ReturnType<typeof createPariserPlatzEntityLoop>) {
  const matrix = new Matrix4();
  return field.batches.map((batch) =>
    Array.from({ length: batch.mesh.count }, (_, index) => {
      batch.mesh.getMatrixAt(index, matrix);
      return matrix.toArray();
    }),
  );
}

describe("Schwellenraum Pariser Platz entity loop", () => {
  test("keeps the owner video as non-bundled motion evidence only", () => {
    const source = PARISER_PLATZ_ENTITY_LOOP_PROFILE.ownerMotionReference;
    expect(source.fileLabel).toBe("IMG_1184.MOV");
    expect(source.durationSeconds).toBe(94.813);
    expect(source.bundled).toBeFalse();
    expect(source.runtimeAsset).toBeFalse();
    expect(source.frameTextureCount).toBe(0);
  });

  test("stays within Pariser Platz and never routes movers through either garden", () => {
    const bounds = PARISER_PLATZ_ENTITY_LOOP_PROFILE.boundsLocalM;
    const sample = { tangentX: 0, tangentZ: 1, x: 0, z: 0 };
    for (const route of PARISER_PLATZ_ENTITY_ROUTES) {
      for (let step = 0; step < 512; step += 1) {
        samplePariserPlatzEntityRoute(route.id, step / 512, sample);
        expect(sample.x, route.id).toBeGreaterThanOrEqual(bounds.x[0]);
        expect(sample.x, route.id).toBeLessThanOrEqual(bounds.x[1]);
        expect(sample.z, route.id).toBeGreaterThanOrEqual(bounds.z[0]);
        expect(sample.z, route.id).toBeLessThanOrEqual(bounds.z[1]);
        for (const garden of PARISER_PLATZ_ENTITY_LOOP_PROFILE.gardens) {
          const insideExpandedGarden =
            Math.abs(sample.x - garden.centreLocalM[0]) <
              garden.sizeM[0] / 2 + 1.5 &&
            Math.abs(sample.z - garden.centreLocalM[1]) <
              garden.sizeM[1] / 2 + 1.5;
          expect(insideExpandedGarden, `${route.id} crosses a garden`).toBeFalse();
        }
      }
    }
  });

  test("contains the requested traffic mix in seven texture-free batches", () => {
    for (const detailProfile of ["full", "mobile"] as const) {
      const field = createPariserPlatzEntityLoop(detailProfile);
      const budget = PARISER_PLATZ_ENTITY_LOOP_PROFILE.budgets[detailProfile];
      const expected = PARISER_PLATZ_ENTITY_LOOP_PROFILE.counts[detailProfile];
      const geometries = new Set();
      const materials = new Set();
      let renderedVertices = 0;
      let instances = 0;
      const entityColors = new Set<number>();
      expect(field.batches).toHaveLength(7);
      for (const batch of field.batches) {
        expect(batch.mesh).toBeInstanceOf(InstancedMesh);
        expect(batch.mesh.count).toBe(expected[batch.kind]);
        expect(batch.mesh.userData.runtimeTexture).toBeFalse();
        expect(batch.mesh.material).toBeInstanceOf(MeshBasicMaterial);
        const material = batch.mesh.material as MeshBasicMaterial;
        expect(material.map).toBeNull();
        expect(material.fog).toBeFalse();
        expect(batch.mesh.instanceColor).toBeNull();
        if (batch.kind !== "fountain") entityColors.add(material.color.getHex());
        geometries.add(batch.mesh.geometry);
        materials.add(batch.mesh.material);
        renderedVertices +=
          batch.mesh.geometry.getAttribute("position").count * batch.mesh.count;
        instances += batch.mesh.count;
      }
      expect(field.movingInstanceCount).toBe(budget.movingInstances);
      expect(instances).toBe(budget.totalInstances);
      expect(field.fountainInstanceCount).toBe(2);
      expect(geometries.size).toBeLessThanOrEqual(budget.geometries);
      expect(materials.size).toBeLessThanOrEqual(budget.materials);
      expect(entityColors.size).toBe(6);
      expect(field.batches.length).toBeLessThanOrEqual(budget.drawCalls);
      expect(renderedVertices).toBeLessThanOrEqual(budget.renderedVertices);
    }
  });

  test("closes the complete video-length seam and still changes between samples", () => {
    const field = createPariserPlatzEntityLoop("full");
    updatePariserPlatzEntityLoop(field, 0);
    const start = instanceMatrices(field);
    updatePariserPlatzEntityLoop(field, 27.4);
    expect(instanceMatrices(field)).not.toEqual(start);
    updatePariserPlatzEntityLoop(
      field,
      PARISER_PLATZ_ENTITY_LOOP_PROFILE.loopDurationSeconds,
    );
    const end = instanceMatrices(field);
    for (const [batchIndex, batch] of start.entries()) {
      for (const [instanceIndex, matrix] of batch.entries()) {
        for (const [elementIndex, value] of matrix.entries()) {
          expect(end[batchIndex][instanceIndex][elementIndex]).toBeCloseTo(
            value,
            6,
          );
        }
      }
    }
  });

  test("is inherited by the Schwellenraum root and frustum-gated to the square", () => {
    const root = createSchwellenraumPraesentation("mobile");
    const field = pariserPlatzEntityLoopFromRoot(root);
    expect(field).not.toBeNull();
    expect(field?.group.parent).toBe(root);
    expect(field?.group.userData.onlyAt).toBe("Pariser Platz");
    expect(root.visible).toBeFalse();

    const camera = new PerspectiveCamera(50, 1, 0.1, 4_000);
    camera.position.set(497.05, 135, 475);
    camera.lookAt(new Vector3(497.05, 5.03, 294.5));
    camera.updateProjectionMatrix();
    const scratch = createPariserPlatzLoopScreenScratch();
    expect(isPariserPlatzEntityLoopOnScreen(field, camera, scratch)).toBeFalse();

    setSchwellenraumPraesentation(root, "schwellenraum", false);
    root.updateMatrixWorld(true);
    expect(isPariserPlatzEntityLoopOnScreen(field, camera, scratch)).toBeTrue();
    setSchwellenraumPraesentation(root, "day", false);
    expect(isPariserPlatzEntityLoopOnScreen(field, camera, scratch)).toBeFalse();
  });
});
