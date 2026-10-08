import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import { createNorthV185 } from "../src/NorthV185";
import source from "../src/data/northV185.json";
import { terrainGroundAt } from "../src/weinbergTerrainV176";

describe("bounded northern v185 accents", () => {
  for (const native of [false, true]) test(`fixed batches and no textures, native=${native}`, () => {
    const root = createNorthV185(native);
    expect(root.children).toHaveLength(native ? 4 : 5);
    let bytes = 0, instances = 0;
    for (const object of root.children) {
      const mesh = object as InstancedMesh;
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) expect(material.map).toBeNull();
      instances += mesh.count;
      bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      for (const attribute of Object.values(mesh.geometry.attributes)) bytes += attribute.array.byteLength;
      bytes += mesh.geometry.index?.array.byteLength ?? 0;
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      expect(mesh.instanceColor!.count).toBe(mesh.count);
      expect(mesh.geometry.boundingBox?.isEmpty()).toBe(false);
      if (native) {
        const matrix = new Matrix4();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          for (const index of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[index]).toBe(0);
        }
      }
    }
    expect(bytes).toBeLessThan(native ? 900_000 : 430_000);
    expect(instances).toBeLessThan(native ? 12_000 : 5_500);
    expect(root.userData.additiveOnly).toBe(true);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  });

  test("all bed shrubs stay at the retained hill level in both readings", () => {
    for (const native of [false, true]) {
      const root = createNorthV185(native);
      const garden = root.children.find(m => m.userData.northV185 === "weinbergspark") as InstancedMesh;
      const matrix = new Matrix4();
      expect(garden.count).toBe(156);
      for (let i = 0; i < garden.count; i += 2) {
        garden.getMatrixAt(i, matrix);
        const [x, y, z] = matrix.elements.slice(12, 15);
        expect(y).toBeCloseTo(terrainGroundAt(x, z, 3, native) + .22, 2);
        expect(y).toBeGreaterThan(3.25);
      }
    }
  });

  test("courtyard owners stay descriptive only; no replacement or collision payload", () => {
    const root = createNorthV185();
    expect(root.userData.sourceOwnerIds).toEqual(source.owners.map(p => p.id));
    expect(root.userData.replacementIds).toBeUndefined();
    expect(root.userData.navigation).toBeUndefined();
    expect(root.userData.blockNative).toBe(false);
    expect(source.owners.filter(p => p.kind === "kulturbrauerei")).toHaveLength(20);
  });
});
