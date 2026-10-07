import { describe, expect, test } from "bun:test";
import { BufferGeometry, InstancedMesh, LineSegments, Material } from "three";
import { createCityRecognitionV182 } from "../src/CityRecognitionV182";

describe("additive city recognition v182", () => {
  for (const native of [false, true]) test(`bounded complete ${native ? "native" : "drawn"} skin`, () => {
    const root = createCityRecognitionV182(native);
    expect(root.userData.additiveOnly).toBe(true);
    expect(root.children.length).toBe(2);
    expect(root.children[0]).toBeInstanceOf(LineSegments);
    const detail = root.children[1] as InstancedMesh;
    expect(detail).toBeInstanceOf(InstancedMesh);
    expect(detail.count).toBeGreaterThan(7000);
    expect(detail.count).toBeLessThan(8000);
    expect(detail.userData.blockNative).toBe(native);
    const materials = new Set<Material>();
    for (const child of root.children) {
      expect(child.matrixAutoUpdate).toBe(false);
      const geometry = (child as unknown as {geometry: BufferGeometry}).geometry;
      expect(geometry.boundingSphere).not.toBeNull();
      expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);
      geometry.dispose();
      for (const candidate of [(child as LineSegments).material, child.userData.dayMaterial, child.userData.nightMaterial]) {
        for (const material of Array.isArray(candidate) ? candidate : [candidate]) {
          if (material instanceof Material) materials.add(material);
        }
      }
    }
    detail.dispose();
    for (const material of materials) material.dispose();
    root.clear();
  });
});
