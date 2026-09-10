import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, Color, Frustum, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PerspectiveCamera, Sphere, Vector3,
} from "three";
import { partitionStaticSpatialInstances } from "../src/staticSpatialInstances";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";
import { setParkDetailsFocus, setParkSettledDetail, setParkSnowPresentation } from "../src/ParkDetails";

function fixture(): { root: Group; source: InstancedMesh } {
  const root = new Group();
  const source = new InstancedMesh(new BoxGeometry(4, 6, 8), new MeshStandardMaterial(), 8);
  source.name = "static crowns";
  source.position.set(12, 2, 9);
  source.rotation.set(0.2, -0.3, 0.1);
  source.scale.set(1.2, 0.7, 2);
  source.layers.set(2);
  source.castShadow = true;
  source.receiveShadow = true;
  source.renderOrder = 7;
  source.userData = { dayMaterial: source.material, sourceId: "retained source", metadata: [1, 2] };
  for (let index = 0; index < source.count; index += 1) {
    const matrix = new Matrix4().makeRotationY(index * 0.31);
    matrix.scale(new Vector3(1 + index * 0.5, 2, 0.8));
    matrix.setPosition(index % 2 === 0 ? index * 4 : 1200 + index * 4, 5, -index);
    source.setMatrixAt(index, matrix);
    source.setColorAt(index, new Color(index / 9, 0.4, 0.9));
  }
  root.add(source);
  return { root, source };
}

function batches(root: Group): InstancedMesh[] {
  const result: InstancedMesh[] = [];
  root.traverse((object) => { if (object instanceof InstancedMesh) result.push(object); });
  return result;
}

function instanceRecords(meshes: InstancedMesh[]): string[] {
  const result: string[] = [];
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.count; index += 1) {
      result.push(JSON.stringify([
        ...mesh.instanceMatrix.array.slice(index * 16, index * 16 + 16),
        ...(mesh.instanceColor?.array.slice(index * 3, index * 3 + 3) ?? []),
      ]));
    }
  }
  return result.sort();
}

describe("lossless static instance spatial batches", () => {
  test("retains every exact matrix/color, shared resources, hierarchy and authored flags", () => {
    const { root, source } = fixture();
    const expected = instanceRecords([source]);
    root.updateMatrixWorld(true);
    const originalWorld = source.matrixWorld.clone();
    partitionStaticSpatialInstances(root, { cellM: 384, minimumCount: 2 });
    freezeStaticSceneTransforms(root);
    root.updateMatrixWorld(true);
    const parts = batches(root);
    expect(parts.length).toBeGreaterThan(1);
    expect(instanceRecords(parts)).toEqual(expected);
    const container = root.getObjectByName(source.name)!;
    expect(container).toBeInstanceOf(Object3D);
    expect(container).not.toBeInstanceOf(Group);
    expect(container.userData).toEqual(source.userData);
    expect(container.userData.dayMaterial).toBe(source.material);
    expect(container.matrixWorld.equals(originalWorld)).toBeTrue();
    for (const part of parts) {
      expect(part.geometry).toBe(source.geometry);
      expect(part.material).toBe(source.material);
      expect(part.matrixWorld.equals(originalWorld)).toBeTrue();
      expect(part.userData.dayMaterial).toBe(source.material);
      expect(part.layers.mask).toBe(source.layers.mask);
      expect(part.renderOrder).toBe(7);
      expect(part.castShadow && part.receiveShadow).toBeTrue();
      expect(part.frustumCulled).toBeTrue();
      expect(part.matrixAutoUpdate).toBeFalse();
    }
    expect(parts.reduce((total, part) => total + part.instanceMatrix.array.byteLength +
      (part.instanceColor?.array.byteLength ?? 0), 0)).toBe(
      source.instanceMatrix.array.byteLength + source.instanceColor!.array.byteLength);
    const nodes = root.children[0].children.slice();
    partitionStaticSpatialInstances(root, { cellM: 384, minimumCount: 2 });
    expect(root.children[0].children).toEqual(nodes);
  });

  test("conservative bounds include rotated, nonuniformly scaled and sheared geometry", () => {
    const { root, source } = fixture();
    const shear = new Matrix4().set(1, 4, 2, -30, 0, 2, 3, 8, 0, 0, 1, 20, 0, 0, 0, 1);
    source.setMatrixAt(0, shear);
    partitionStaticSpatialInstances(root, { cellM: 384, minimumCount: 2 });
    const position = source.geometry.getAttribute("position");
    const matrix = new Matrix4();
    const vertex = new Vector3();
    for (const part of batches(root)) {
      expect(part.boundingSphere).toBeInstanceOf(Sphere);
      for (let index = 0; index < part.count; index += 1) {
        part.getMatrixAt(index, matrix);
        for (let point = 0; point < position.count; point += 1) {
          vertex.fromBufferAttribute(position, point).applyMatrix4(matrix);
          expect(part.boundingBox!.containsPoint(vertex)).toBeTrue();
          expect(vertex.distanceTo(part.boundingSphere!.center)).toBeLessThanOrEqual(
            part.boundingSphere!.radius + 1e-10);
        }
      }
    }
  });

  test("rejects offscreen cells while preserving visible instances across boundaries", () => {
    const root = new Group();
    const source = new InstancedMesh(new BoxGeometry(40, 10, 40), new MeshBasicMaterial(), 4);
    for (const [index, x] of [370, 390, 1200, 1600].entries()) {
      source.setMatrixAt(index, new Matrix4().makeTranslation(x, 0, 0));
    }
    root.add(source);
    source.computeBoundingSphere();
    partitionStaticSpatialInstances(root, { cellM: 384, minimumCount: 2 });
    root.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(60, 1, 1, 250);
    camera.position.set(384, 40, 100);
    camera.lookAt(384, 0, 0);
    camera.updateMatrixWorld(true);
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    expect(frustum.intersectsObject(source)).toBeTrue();
    const visible = batches(root).filter((part) => frustum.intersectsObject(part));
    expect(visible.reduce((total, part) => total + part.count, 0)).toBe(2);
    expect(batches(root).reduce((total, part) => total + part.count, 0)).toBe(4);
  });

  test("preserves snow, focus and settled-detail transitions on every partition", () => {
    const { root, source } = fixture();
    source.userData.snowOnly = true;
    source.userData.snowActive = false;
    source.userData.focusCutawayFor = "Playground";
    source.visible = false;
    partitionStaticSpatialInstances(root, { minimumCount: 2 });
    const parts = batches(root);
    expect(parts.every((part) => !part.visible)).toBeTrue();
    setParkSnowPresentation(root, true);
    expect(parts.every((part) => part.visible)).toBeTrue();
    setParkDetailsFocus(root, "Playground");
    expect(parts.every((part) => !part.visible)).toBeTrue();
    setParkSnowPresentation(root, true);
    expect(parts.every((part) => !part.visible)).toBeTrue();
    setParkDetailsFocus(root, "Other");
    expect(parts.every((part) => part.visible)).toBeTrue();
    setParkSnowPresentation(root, false);
    expect(parts.every((part) => !part.visible)).toBeTrue();
    for (const part of parts) { part.userData.snowOnly = false; part.userData.settledOnly = true; }
    setParkSettledDetail(root, true);
    expect(parts.every((part) => part.visible)).toBeTrue();
    setParkSettledDetail(root, false);
    expect(parts.every((part) => !part.visible)).toBeTrue();
  });

  test("leaves small, single-cell, transparent, animated and custom-hook batches intact", () => {
    for (const kind of ["small", "local", "transparent", "night-transparent", "hook", "animation", "unculled"] as const) {
      const { root, source } = fixture();
      if (kind === "small") source.count = 1;
      if (kind === "local") for (let index = 0; index < source.count; index++) {
        source.setMatrixAt(index, new Matrix4().makeTranslation(index, 0, 0));
      }
      if (kind === "transparent") (source.material as MeshStandardMaterial).transparent = true;
      if (kind === "night-transparent") source.userData.nightMaterial = new MeshBasicMaterial({ transparent: true });
      if (kind === "hook") source.onBeforeRender = () => {};
      if (kind === "animation") source.animations.push({} as never);
      if (kind === "unculled") source.frustumCulled = false;
      partitionStaticSpatialInstances(root, { minimumCount: 2 });
      expect(root.children).toEqual([source]);
    }
  });
});
