import { expect, test } from "bun:test";
import { Group, InstancedMesh } from "three";
import { appendSchoolPlaceV205 } from "../src/schoolsPlacesV205Batches";

test("school and square refinements keep full static detail in small finite batches",()=>{
  for(const native of [false,true]) {
    const root=new Group();appendSchoolPlaceV205(root,"schools",native);appendSchoolPlaceV205(root,"places",native);
    expect(root.children.length).toBe(9);
    let count=0,bytes=0;
    for(const child of root.children) {
      const mesh=child as InstancedMesh;
      expect(mesh.userData.fullStaticDetailOnTouch).toBe(true);
      expect(mesh.userData.sourceGeometryRetained).toBe(true);
      expect(mesh.userData.sourceOwner).toBeTruthy();
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.boundingBox!.isEmpty()).toBe(false);
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      count+=mesh.count;bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;
      if(native)for(let i=0;i<mesh.count;i++)for(const k of [1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+k]).toBe(0);
      mesh.geometry.dispose();mesh.userData.dayMaterial.dispose();mesh.userData.nightMaterial.dispose();mesh.dispose();
    }
    expect(count).toBeLessThan(native?4600:3300);expect(bytes).toBeLessThan(360_000);
  }
});
