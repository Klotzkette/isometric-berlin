import { describe, expect, test } from "bun:test";
import { InstancedMesh } from "three";
import { createPotsdamerContextV214 } from "../src/PotsdamerContextV214";
import { POTSDAMER_CONTEXT_V214_PROFILE as profile } from "../src/potsdamerContextV214Profile";

describe("bounded Potsdamer / Nationalgalerie context", () => {
  test("retains all existing owners with no replacement contract", () => {
    expect(profile.sourceParts).toBe(26);
    expect(new Set(profile.owners.map(o => o.parentId)).size).toBe(7);
    for (const native of [false, true]) {
      const root = createPotsdamerContextV214(native);
      expect(root.userData.additiveOnly).toBe(true);
      expect(root.userData.newCourtWalls).toBe(false);
      expect(root.userData.newPassageClosures).toBe(false);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.children).toHaveLength(1);
      const mesh = root.children[0] as InstancedMesh;
      expect(mesh.count).toBe(native ? profile.nativeBoxes : profile.drawnBoxes);
      expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(1100000);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.userData.dayMaterial.map).toBeNull();
      expect(mesh.matrixAutoUpdate).toBe(false);
    }
  });
  test("native is orthogonal and independent; drawn rebuilds are exact", () => {
    const a = createPotsdamerContextV214(), b = createPotsdamerContextV214();
    const am = a.children[0] as InstancedMesh, bm = b.children[0] as InstancedMesh;
    expect(am.instanceMatrix.array).toEqual(bm.instanceMatrix.array);
    expect(am.geometry).not.toBe(bm.geometry);
    expect(am.material).not.toBe(bm.material);
    const native = createPotsdamerContextV214(true).children[0] as InstancedMesh;
    for (let i=0;i<native.count;i++) for (const j of [1,2,4,6,8,9])
      expect(native.instanceMatrix.array[i*16+j]).toBe(0);
  });
});
