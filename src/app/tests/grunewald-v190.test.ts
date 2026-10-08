import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createGrunewaldLandmarksV190 } from "../src/GrunewaldLandmarksV190";
import { grunewaldGroundAt, grunewaldTerrainOffset } from "../src/grunewaldTerrainV190";

test("Grunewald groups retain source detail and bounded static buffers", () => {
  const group=createGrunewaldLandmarksV190();
  expect(group.children.map(g=>g.userData.siteKey)).toEqual(["museum","tower"]);
  let bytes=0,meshes=0;
  group.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);
    if(!(o instanceof Mesh))return;
    meshes++;
    expect(o.frustumCulled).toBe(true);
    expect(o.geometry.getAttribute("uv")).toBeUndefined();
    for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
    if(o instanceof InstancedMesh)bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
  });
  expect(meshes).toBe(4);
  expect(bytes).toBeLessThan(140_000);
});

test("native landmarks use independent exterior volumes and matching measured relief", () => {
  const group=createGrunewaldLandmarksV190(true), matrix=new Matrix4();
  expect(group.userData.blockNative).toBe(true);
  let count=0;
  for(const site of group.children){
    expect(site.children.length).toBe(1);
    const mesh=site.children[0] as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    count+=mesh.count;
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);
      for(const j of [1,2,4,6,8,9])expect(matrix.elements[j]).toBe(0);
      expect(matrix.elements.every(Number.isFinite)).toBe(true);
    }
  }
  expect(count).toBeLessThan(2_000);
  expect(grunewaldGroundAt(-11966.52,4245.25)).toBeCloseTo(47.996,2);
  expect(grunewaldGroundAt(-6700,5626)).toBeGreaterThan(16);
  expect(grunewaldTerrainOffset(0,0)).toBe(0);
  expect(grunewaldGroundAt(-11966.52,4245.25,3,true)).toBe(grunewaldGroundAt(-11964,4244));
});
