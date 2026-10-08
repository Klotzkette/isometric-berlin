import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import { createPublicPlacesV185 } from "../src/PublicPlacesV185";

test("small source-bound additions have finite buffers and an independent native reading",()=>{
  for(const native of [false,true]) {
    const root=createPublicPlacesV185(native);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.children.length).toBe(1);
    const mesh=root.children[0] as InstancedMesh;
    expect(mesh.count).toBeLessThan(native?1900:400);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(160_000);
    if(native) for(let i=0;i<mesh.count;i++) for(const k of [1,2,4,6,8,9]) expect(mesh.instanceMatrix.array[i*16+k]).toBe(0);
    mesh.dispose();mesh.geometry.dispose();
  }
});
