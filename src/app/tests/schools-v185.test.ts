import { expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Vector3 } from "three";
import { createSchoolsV185 } from "../src/SchoolsV185";
import source from "../src/data/schoolsV185.json";

test("five schools retain bounded, source-owned static details without another shell", () => {
  const drawn = createSchoolsV185();
  expect(drawn.children.filter(o => !o.userData.schoolPlaceV205)).toHaveLength(6); // Kastanienbaum's separate front/main houses.
  expect(new Set(source.schools.map(s => s.owner)).size).toBe(6);
  expect(source.boxes.length).toBeGreaterThan(30);
  expect(source.boxes.length).toBeLessThan(300);
  let bytes = 0;
  for (const object of drawn.children.filter(o => !o.userData.schoolPlaceV205)) {
    expect(object).toBeInstanceOf(InstancedMesh);
    const mesh = object as InstancedMesh;
    expect(mesh.userData.sourceOwner).toBeTruthy();
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
    expect(mesh.boundingBox!.isEmpty()).toBe(false);
  }
  expect(bytes).toBeLessThan(24_000);
});

test("native school refinement is only a finite axis-aligned skin", () => {
  const root = createSchoolsV185(true);
  const matrix = new Matrix4(), p = new Vector3(), scale = new Vector3();
  expect(root.userData.blockNative).toBe(true);
  expect(source.nativeRows.length).toBeLessThan(1200);
  for (const object of root.children.filter(o => !o.userData.schoolPlaceV205)) {
    const mesh = object as InstancedMesh;
    expect(mesh.userData.blockNative).toBe(true);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      for (const element of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[element]).toBe(0);
      p.setFromMatrixPosition(matrix); scale.setFromMatrixScale(matrix);
      expect([...p.toArray(), ...scale.toArray()].every(Number.isFinite)).toBe(true);
      expect(Math.min(scale.x, scale.z)).toBeLessThanOrEqual(.91);
    }
  }
  expect(new Box3().setFromObject(root).isEmpty()).toBe(false);
});
