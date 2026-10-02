import { expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createHumboldtMainV168Details, createMinecraftHumboldtMainV168Details } from "../src/HumboldtMainV168Details";
import { HUMBOLDT_MAIN_V168_PROFILE } from "../src/humboldtMainV168Profile";
import source from "../src/data/humboldtMainV168Source.json";

function bytes(mesh:Mesh):number{return Object.values(mesh.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(mesh.geometry.index?.array.byteLength??0)+(mesh instanceof InstancedMesh?mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0):0);}
test("HU detail owns no previous building, gateway, courtyard or roof",()=>{
 expect(HUMBOLDT_MAIN_V168_PROFILE.lod2ParentId).toBe("DEBE01YYK0000Cm9");
 expect(HUMBOLDT_MAIN_V168_PROFILE.osmIdentity).toBe("relation/6647");
 expect(HUMBOLDT_MAIN_V168_PROFILE.sourceBoundaryPolygons).toBe(95);
 expect(HUMBOLDT_MAIN_V168_PROFILE.newReplacedOwners).toEqual([]);
 expect(HUMBOLDT_MAIN_V168_PROFILE.newCollisionSolids).toEqual([]);
 expect(HUMBOLDT_MAIN_V168_PROFILE.newRoofSupport).toEqual([]);
 expect(HUMBOLDT_MAIN_V168_PROFILE.sourceTopY).toBe(25.018);
});
test("HU full and touch use identical bounded static ornament",()=>{
 const a=createHumboldtMainV168Details(),b=createHumboldtMainV168Details({mobileLike:true});
 expect(a.children).toHaveLength(3);let total=0;
 for(let i=0;i<3;i++){
  const x=a.children[i] as InstancedMesh,y=b.children[i] as InstancedMesh;
  expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  expect(x.instanceColor!.array).toEqual(y.instanceColor!.array);
  expect(x.geometry.getAttribute("position").array).toEqual(y.geometry.getAttribute("position").array);
  expect(x.matrixAutoUpdate).toBe(false);total+=bytes(x);
 }
 expect((a.children[0] as InstancedMesh).count).toBe(source.boxes.length);
 expect((a.children[1] as InstancedMesh).count).toBe(source.rods.length);
 expect((a.children[2] as InstancedMesh).count).toBe(source.beads.length);
 expect(total).toBeLessThan(450000);console.log({huDrawnBytes:total,batches:3});
});
test("HU native overlay is one separate orthogonal batch",()=>{
 const a=createMinecraftHumboldtMainV168Details(),b=createMinecraftHumboldtMainV168Details({mobileLike:true});
 expect(a.children).toHaveLength(1);const x=a.children[0] as InstancedMesh,y=b.children[0] as InstancedMesh;
 expect(x.count).toBe(source.nativeBoxes.length);expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
 expect(x.instanceColor!.array).toEqual(y.instanceColor!.array);expect(bytes(x)).toBeLessThan(250000);
 for(let i=0;i<x.count;i++){
  const m=x.instanceMatrix.array;
  expect([m[i*16+1],m[i*16+2],m[i*16+4],m[i*16+6],m[i*16+8],m[i*16+9]]).toEqual([0,0,0,0,0,0]);
 }
 console.log({huNativeBytes:bytes(x),blocks:x.count});
});
