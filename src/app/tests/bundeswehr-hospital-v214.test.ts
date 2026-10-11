import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createBundeswehrHospitalV214, BUNDESWEHR_HELIPAD_V214 } from "../src/BundeswehrHospitalV214";

test("hospital detail stays batched, texture free and native; pad is ground-level", () => {
  expect(BUNDESWEHR_HELIPAD_V214.centre).toEqual([-184.229947, 5.32, -1849.876398]);
  expect(Math.hypot(...BUNDESWEHR_HELIPAD_V214.approach)).toBeCloseTo(1);
  for (const native of [false, true]) {
    const root = createBundeswehrHospitalV214(native), matrix = new Matrix4();
    expect(root.userData.sourceBodiesSuppressed).toBe(0);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.children.length).toBe(native ? 1 : 2);
    let bytes = 0;
    for (const child of root.children as Mesh[]) {
      expect(child.matrixAutoUpdate).toBe(false);
      expect(child.geometry.getAttribute("uv")).toBeUndefined();
      expect(child.userData.dayMaterial.map).toBeNull();
      expect(child.userData.nightMaterial.map).toBeNull();
      for (const a of Object.values(child.geometry.attributes)) bytes += a.array.byteLength;
      bytes += child.geometry.index?.array.byteLength ?? 0;
      if (child instanceof InstancedMesh) {
        bytes += child.instanceMatrix.array.byteLength + (child.instanceColor?.array.byteLength ?? 0);
        if (native) for (let i=0;i<child.count;i++) {
          child.getMatrixAt(i,matrix);
          for (const k of [1,2,4,6,8,9]) expect(matrix.elements[k]).toBe(0);
        }
      }
    }
    expect(bytes).toBeLessThan(native ? 720_000 : 515_000);
  }
});
