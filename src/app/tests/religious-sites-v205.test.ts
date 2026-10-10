import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createReligiousSitesV205, RELIGIOUS_SITES_V205_GROUP } from "../src/ReligiousSitesV205";
import source from "../src/data/religiousSitesV205.json";

describe("six exact religious source owner refinements", () => {
  test("drawn sheets retain complete source geometry with six local bounds", () => {
    const root = createReligiousSitesV205();
    expect(root.name).toBe(RELIGIOUS_SITES_V205_GROUP);
    expect(root.children.length).toBe(6);
    root.children.forEach((site, i) => {
      expect(site.children.length).toBe(3);
      const [exact, estimates, members] = site.children as Mesh[];
      expect(exact.geometry.getAttribute("position").count).toBe((source.sites[i].triangles.length - source.sites[i].suppressedSourceTriangleIndices.length + source.sites[i].clippedSourceTriangles.length) * 3);
      expect(estimates.userData.displayEstimate).toBe(true);
      expect(members).toBeInstanceOf(InstancedMesh);
      const batch = members as InstancedMesh;
      expect(batch.instanceMatrix.count).toBe(batch.count);
      expect(batch.instanceColor?.count).toBe(batch.count);
      for (const mesh of [exact, estimates, members]) {
        expect(mesh.geometry.boundingSphere?.radius).toBeLessThan(90);
        expect(mesh.userData.dayMaterial).toBeTruthy();
        expect(mesh.userData.nightMaterial).toBeTruthy();
      }
      expect(site.userData.fullStaticDetailOnTouch).toBe(true);
    });
  });
  test("native mode has only final-size axis-aligned surface batches", () => {
    const root = createReligiousSitesV205(true);
    expect(root.children.length).toBe(6);
    let count = 0;
    root.children.forEach((site, i) => {
      expect(site.children.length).toBe(1);
      const batch = site.children[0] as InstancedMesh;
      expect(batch.count).toBe(source.sites[i].nativeBlocks.length);
      expect(batch.instanceMatrix.count).toBe(batch.count);
      expect(batch.instanceColor?.count).toBe(batch.count);
      expect(batch.userData.blockNative).toBe(true);
      expect(batch.boundingSphere?.radius).toBeLessThan(90);
      const matrices = batch.instanceMatrix.array;
      for (let j = 0; j < batch.count; j++) {
        for (const k of [1, 2, 4, 6, 8, 9]) expect(matrices[j * 16 + k]).toBe(0);
      }
      count += batch.count;
    });
    expect(count).toBeLessThan(45000);
  });
});
