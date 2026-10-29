import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Matrix4, type InstancedMesh } from "three";
import { createSonyCenterSurroundings, createMinecraftSonyCenterSurroundings } from "../src/SonyCenterSurroundings";
import { SONY_SURROUNDING_BUILDINGS, SONY_SURROUNDINGS_PROFILE } from "../src/sonyCenterSurroundingsProfile";

function digest(matrix:Float32Array,colors:Float32Array):string {
  return createHash("sha256").update(new Uint8Array(matrix.buffer,matrix.byteOffset,matrix.byteLength)).update(new Uint8Array(colors.buffer,colors.byteOffset,colors.byteLength)).digest("hex");
}
const previousDrawn = [
  "6cbe4232dda4317eb0a57d2cec4a5b362b89b7f3661f491b2f24c1662d144ff9",
  "98f0522e995af0c32bbdb549d78dde873820bfc5849249ccd5b14eb8901a6352",
  "b52db569c3b083fc69bbfa5a7ca2edb365a2224deef8eead9ad8a5ef08bdbe6d",
  "4d5e50613e57e00b879b003d8594389a4b10f93d96058b585d316754dad16104",
  "48854f43b7284f6dcf31c8ff1c3ba8ae9125bebd9bc93cf6e71562c406247785",
  "ad862387016d6ab904a77b7dadc446c8fe5a43f10c4702767865ad86fd359a60",
  "4a97f868d11d273a1c2eb1aefd1c3eb68130bbff20bcaaef95592ce0dbd4867c",
  "d6cbf7f915fb7ec7372c7b91c3927c197d5a447509ae18d5d697e751ff95c651",
  "69d3fc81baecee7d25524092b8b40405d818dc303b6f978288a6bc11df9a9765",
  "3eac7de0c69b2d39383df4f2276e54d8b37a482cd8b2b304bc2ffba4fd664a6f",
];

test("the photographed lower wing has its own complete retained source edge and datum",()=>{
  const building=SONY_SURROUNDING_BUILDINGS.find(b=>b.id==="beisheim-office")!;
  const run=building.runs.find(r=>r.ownerPhotoV284)!;
  expect(building.parentId).toBe("DEBE01YYK0002Mbg");
  expect(run.prismId).toBe("gAwitON0");
  expect(run.chain).toEqual([[321.8,922],[313.9,972.3],[308.2,972.9]]);
  expect(run.groundY).toBe(5.1);expect(run.heightM).toBe(34.6);
});

test("all ten previous drawn facades and every legacy native component remain byte-identical",()=>{
  const drawn=createSonyCenterSurroundings();
  (drawn.children as InstancedMesh[]).forEach((mesh,i)=>{
    const count=i===7?640:mesh.count;
    expect(digest((mesh.instanceMatrix.array as Float32Array).slice(0,count*16),(mesh.instanceColor!.array as Float32Array).slice(0,count*3))).toBe(previousDrawn[i]);
  });
  const native=createMinecraftSonyCenterSurroundings(),mesh=native.children[0] as InstancedMesh;
  const added=new Set<number>(native.userData.ownerPhotoV284InstanceIndices);
  const matrices:number[]=[],colors:number[]=[];
  for(let i=0;i<mesh.count;i++)if(!added.has(i)){
    matrices.push(...mesh.instanceMatrix.array.slice(i*16,i*16+16));
    colors.push(...mesh.instanceColor!.array.slice(i*3,i*3+3));
  }
  expect(matrices.length/16).toBe(3707);
  expect(digest(new Float32Array(matrices),new Float32Array(colors))).toBe("3fde3a07d677217e34d55ca179340bf76fce9cc7f0a8bd544e963e3c2c0bfdaa");
});

test("new native exterior bricks are orthogonal and both families fit their existing instance limits",()=>{
  const native=createMinecraftSonyCenterSurroundings(),mesh=native.children[0] as InstancedMesh;
  const matrix=new Matrix4();
  expect(native.userData.ownerPhotoV284InstanceIndices).toHaveLength(160);
  for(const i of native.userData.ownerPhotoV284InstanceIndices as number[]){
    mesh.getMatrixAt(i,matrix);const e=matrix.elements;
    for(const j of [1,2,4,6,8,9])expect(e[j]).toBe(0);
    expect(Math.min(e[0],e[5],e[10])).toBeGreaterThan(0);
    expect(Math.max(e[0],e[5],e[10])).toBeLessThan(5.501);
    expect(e[13]-e[5]/2).toBeGreaterThanOrEqual(5.1-1e-5);
    expect(e[13]+e[5]/2).toBeLessThan(39.7);
  }
  const drawn=createSonyCenterSurroundings();
  expect(drawn.children).toHaveLength(10);expect(native.children).toHaveLength(1);
  expect(drawn.userData.instanceCount).toBeLessThanOrEqual(SONY_SURROUNDINGS_PROFILE.performance.drawnInstanceBudget);
  expect(native.userData.instanceCount).toBeLessThanOrEqual(SONY_SURROUNDINGS_PROFILE.performance.minecraftInstanceBudget);
});
