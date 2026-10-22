import { expect, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Mesh } from "three";
import source from "../src/data/windkanalV261.json";
import { createWindkanalV261, WINDKANAL_V261_PROFILE } from "../src/WindkanalV261";
import { windkanalV261GroundAt } from "../src/windkanalV261Navigation";

test("bounded Windkanal contour supports both independent representations",()=>{
  for(const native of [false,true]) {
    const model=createWindkanalV261(native);
    expect(model.userData.sourceGeometryRetained).toBe(true);
    expect(model.userData.fullStaticDetailOnTouch).toBe(true);
    expect(model.userData.blockNative).toBe(native);
    let bytes=0, meshCount=0;
    model.traverse(object=>{
      if(!(object instanceof Mesh))return;
      meshCount++;
      const geometry=object.geometry as BufferGeometry;
      for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
      bytes+=geometry.index?.array.byteLength??0;
      if(object instanceof InstancedMesh) {
        bytes+=object.instanceMatrix.array.byteLength;
        bytes+=object.instanceColor?.array.byteLength??0;
      }
    });
    expect(meshCount).toBeGreaterThan(0);expect(bytes).toBeLessThan(WINDKANAL_V261_PROFILE.maxRuntimeBytes);
  }
  expect(source.roofFacets).toBe(4);
  expect(source.owner).toBe("DEBE09YYO00007rF");
});

test("every drawn triangle and native cell has matching roof support",()=>{
  for(const row of source.triangles) {
    const t=row.slice(1) as number[][];
    const x=t.reduce((s,p)=>s+p[0],0)/3,z=t.reduce((s,p)=>s+p[2],0)/3;
    const y=t.reduce((s,p)=>s+p[1],0)/3;
    expect(windkanalV261GroundAt(x,z)).toBeGreaterThanOrEqual(y-.00001);
  }
  for(const b of source.blocks)expect(windkanalV261GroundAt(b[0],b[2],true)).toBeGreaterThanOrEqual(b[1]+b[4]/2);
  for(const [x,z] of [[10570,9940],[10548,9942],[10522,9924],[10637,9992]]) {
    expect(windkanalV261GroundAt(x,z)).toBeNull();
    expect(windkanalV261GroundAt(x,z,true)).toBeNull();
  }
});
