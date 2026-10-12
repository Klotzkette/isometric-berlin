import { expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh } from "three";
import { createLegolandEntranceV216, LEGOLAND_V216_GIRAFFE } from "../src/LegolandEntranceV216";

for (const native of [false, true]) test(`LEGOLAND street entrance: ${native ? "native" : "drawn"}`, () => {
  const root = createLegolandEntranceV216(native);
  expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
  expect(root.userData.nativeMinecraft).toBe(native);
  const p = root.getObjectByName("LEGOLAND glazed entrance pavilion")!;
  const bounds = new Box3().setFromObject(root);
  expect(bounds.min.x).toBeGreaterThan(55);
  expect(bounds.max.x).toBeLessThan(72);
  expect(bounds.min.z).toBeGreaterThan(1034);
  expect(bounds.max.z).toBeLessThan(1058);
  expect(LEGOLAND_V216_GIRAFFE[0]).toBeGreaterThan(55);
  expect(p.getObjectByName("LEGOLAND transparent entry glazing")).toBeDefined();
  let meshes = 0, instances = 0;
  root.traverse(o => {
    if (o instanceof Mesh) {
      meshes++;
      expect(Array.isArray(o.material)).toBeFalse();
      expect((o.material as any).map).toBeFalsy();
      expect(o.matrixAutoUpdate).toBeFalse();
      expect(o.geometry.attributes.position.array.every(Number.isFinite)).toBeTrue();
    }
    if (o instanceof InstancedMesh) {
      instances += o.count;
      expect(o.instanceMatrix.array.length).toBe(o.count * 16);
      expect(o.instanceMatrix.array.every(Number.isFinite)).toBeTrue();
    }
  });
  expect(meshes).toBeLessThanOrEqual(5);
  expect(instances).toBeLessThan(3400);
});
