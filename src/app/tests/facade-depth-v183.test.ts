import { expect, test } from "bun:test";
import { InstancedMesh, Material } from "three";
import { createScheunenFacadesV183 } from "../src/ScheunenFacadesV183";
import { createMinecraftScheunenFacadesV183 } from "../src/MinecraftScheunenFacadesV183";
import { GendarmenmarktFacadeBuilder } from "../src/GendarmenmarktFacadeBuilder";

test("Scheunen facade addition is one finite frozen surface batch per representation", () => {
  for (const native of [false, true]) {
    const root=native ? createMinecraftScheunenFacadesV183() : createScheunenFacadesV183();
    expect(root.userData.additiveOnly).toBe(true);
    expect(root.children.length).toBe(1);
    const mesh=root.children[0] as InstancedMesh;
    expect(mesh.count).toBe(native ? 2262 : 370);
    expect(mesh.instanceMatrix.count).toBe(mesh.count);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(175000);
    if (native) for (let i=0;i<mesh.count;i++) for (const n of [1,2,4,6,8,9]) expect(mesh.instanceMatrix.array[i*16+n]).toBe(0);
    mesh.geometry.dispose();mesh.dispose();
    for (const material of new Set([mesh.material,mesh.userData.dayMaterial,mesh.userData.nightMaterial])) if (material instanceof Material) material.dispose();
    root.clear();
  }
});

test("Gendarmenmarkt retains its window and adds a shallow separate sill undercut", () => {
  const b=new GendarmenmarktFacadeBuilder(false, true);
  b.window({startXZ:[0,0],endXZ:[8,0],outwardSide:1,wallBaseY:3,wallTopY:20,street:"source",prismId:"source"},4,10,1.5,2.0,0xeeeecc,0x333333,0x666677);
  expect(b.windowProbes.length).toBe(1);
  const undercut=b.batches.get("stone")!.filter(instance=>instance.color===0x79786e);
  expect(undercut.length).toBe(1);
  expect(undercut[0].matrix[13]).toBeCloseTo(8.82,5);
  expect(undercut[0].matrix[5]).toBeCloseTo(.045,5);
});
