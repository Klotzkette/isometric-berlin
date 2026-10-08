import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createNorthSitesV190 } from "../src/NorthSitesV190";
import { createMinecraftNorthSitesV190 } from "../src/MinecraftNorthSitesV190";

for (const native of [false, true]) test(`north sites v190 final-count bounded static buffers ${native}`, () => {
  const root = native ? createMinecraftNorthSitesV190() : createNorthSitesV190();
  let bytes = 0, instances = 0;
  expect(root.children.length).toBeLessThanOrEqual(42);
  expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  expect(root.userData.northSitesV190).toBe(true);
  for (const obj of root.children) {
    const mesh = obj as Mesh;
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.geometry.boundingBox?.isEmpty()).toBe(false);
    for (const attr of Object.values(mesh.geometry.attributes)) bytes += attr.array.byteLength;
    bytes += mesh.geometry.index?.array.byteLength ?? 0;
    for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) expect(material.map).toBeNull();
    if ((mesh as InstancedMesh).isInstancedMesh) {
      const inst = mesh as InstancedMesh;
      expect(inst.instanceMatrix.count).toBe(inst.count);
      expect(inst.instanceColor!.count).toBe(inst.count);
      instances += inst.count;
      bytes += inst.instanceMatrix.array.byteLength + inst.instanceColor!.array.byteLength;
      if (native) {
        const m = new Matrix4();
        for (let i = 0; i < inst.count; i++) {
          inst.getMatrixAt(i, m);
          for (const j of [1, 2, 4, 6, 8, 9]) expect(m.elements[j]).toBe(0);
        }
      }
    } else expect(native).toBe(false);
  }
  expect(instances).toBeLessThan(native ? 36000 : 8000);
  expect(bytes).toBeLessThan(native ? 2_800_000 : 1_500_000);
});
