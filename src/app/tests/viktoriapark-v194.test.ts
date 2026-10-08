import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Box3 } from "three";
import { createViktoriaparkV194 } from "../src/ViktoriaparkV194";
import { viktoriaparkWaterAtV194 } from "../src/viktoriaparkWaterV194";

describe("Kreuzberg measured base and mapped cascade",()=>{
 test("eighteen-metre iron crown and full source detail stay bounded in both representations",()=>{
  for(const native of [false,true]){
   const root=createViktoriaparkV194(native);
   expect(root.userData.genii).toBe(12);expect(root.userData.mappedSteps).toBe(135);
   expect(root.userData.fullStaticDetailOnTouch).toBe(true);
   expect(root.children.length).toBe(native?1:3);
   const bounds=new Box3().setFromObject(root);
   expect(bounds.max.y).toBeGreaterThan(63.9);expect(bounds.max.y).toBeLessThan(64.2);
   let bytes=0;
   for(const child of root.children){const mesh=child as Mesh;
    expect(mesh.matrixAutoUpdate).toBe(false);expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
    for(const a of Object.values(mesh.geometry.attributes))bytes+=a.array.byteLength;
    bytes+=mesh.geometry.index?.array.byteLength??0;
    expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
    if(mesh instanceof InstancedMesh){bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;expect(mesh.boundingSphere!.radius).toBeGreaterThan(20);
     if(native)for(let i=0;i<mesh.count;i++)for(const j of [1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+j]).toBe(0);
    } else expect(mesh.geometry.boundingSphere!.radius).toBeGreaterThan(10);
   }
   expect(bytes).toBeLessThan(1024*1024);
  }
 });
 test("foam uses the corrected pond and downhill water datums",()=>{
  for(const native of [false,true]){
   expect(viktoriaparkWaterAtV194(642,3280,native)).toBeLessThan(8);
   expect(viktoriaparkWaterAtV194(625,3415,native)).toBeGreaterThan(29);
   expect(viktoriaparkWaterAtV194(632,3350,native)).toBeLessThan(viktoriaparkWaterAtV194(625,3415,native));
  }
 });
});
