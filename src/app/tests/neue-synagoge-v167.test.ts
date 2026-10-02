import { expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createNeueSynagogeV167, createMinecraftNeueSynagogeV167 } from "../src/NeueSynagogeV167";
import { NEUE_SYNAGOGE_V167_PROFILE, NEUE_SYNAGOGE_V167_PARTS,
  neueSynagogeV167Contains, neueSynagogeV167RoofAt, neueSynagogeV167SourceColumn } from "../src/neueSynagogeV167Profile";
import nav from "../src/data/neueSynagogeV167Navigation.json";
import data from "../src/data/neueSynagogeV167Source.json";

function bytes(mesh: Mesh): number {
  return Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) +
    (mesh.geometry.index?.array.byteLength ?? 0) + (mesh instanceof InstancedMesh ?
      mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0) : 0);
}
test("Neue Synagoge keeps exact identity, previous owner and present building", () => {
  expect(NEUE_SYNAGOGE_V167_PROFILE.osmWayId).toBe("24054915");
  expect(NEUE_SYNAGOGE_V167_PROFILE.monumentId).toBe("09080249");
  expect(NEUE_SYNAGOGE_V167_PROFILE.historicalRearHallRebuilt).toBe(false);
  expect(NEUE_SYNAGOGE_V167_PARTS).toHaveLength(4);
  expect(neueSynagogeV167Contains(1558.769,-635.551)).toBe(true);
  expect(neueSynagogeV167Contains(1560,-700)).toBe(false);
  expect(neueSynagogeV167SourceColumn(1558.769,-635.551,5.2,29.2)).toBe(true);
  expect(neueSynagogeV167SourceColumn(1558.769,-635.551,5.2,25.2)).toBe(false);
  expect(neueSynagogeV167SourceColumn(1558.769,-635.551,3,27)).toBe(false);
  expect(neueSynagogeV167SourceColumn(1540,-610,5.2,29.2)).toBe(false);
});
test("measured and authored dome roofs plus exact native cells remain queryable", () => {
  for (const [a,b,c] of nav.roofTriangles) {
    const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;
    const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
    if(Math.abs(area)>.001) expect(neueSynagogeV167RoofAt(x,z)!).toBeGreaterThanOrEqual((a[1]+b[1]+c[1])/3-.001);
  }
  for (const dome of nav.domes) expect(neueSynagogeV167RoofAt(...dome.center as [number,number])).toBe(dome.finialTopY);
  for (const [ix,iz,y] of nav.nativeRoofCells) expect(neueSynagogeV167RoofAt(ix*.5+.25,iz*.5+.25,true)).toBe(y);
  expect(neueSynagogeV167RoofAt(1560,-700)).toBeNull();
});
test("full-touch drawn detail uses exactly three bounded GPU batches", () => {
  const a=createNeueSynagogeV167(),b=createNeueSynagogeV167({mobileLike:true});
  expect(a.children).toHaveLength(3); let total=0;
  for(let i=0;i<a.children.length;i++){
    const x=a.children[i] as Mesh,y=b.children[i] as Mesh;total+=bytes(x);
    expect(x.matrixAutoUpdate).toBe(false);
    expect(x.geometry.getAttribute("position").array).toEqual(y.geometry.getAttribute("position").array);
    if(x instanceof InstancedMesh && y instanceof InstancedMesh) expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  }
  expect(total).toBeLessThan(2000000);
  expect((a.children[1] as InstancedMesh).count).toBe(data.facadeBoxes.length);
  expect((a.children[2] as InstancedMesh).count).toBe(data.detailRods.length);
  console.log({synagogueDrawnBytes:total,drawnBatches:3});
});
test("native counterpart is one independent orthogonal surface batch",()=>{
  const a=createMinecraftNeueSynagogeV167(),b=createMinecraftNeueSynagogeV167({mobileLike:true});
  expect(a.children).toHaveLength(1);
  const x=a.children[0] as InstancedMesh,y=b.children[0] as InstancedMesh;
  expect(x.count).toBe(data.nativeBlocks.length);
  expect(x.count).toBeLessThan(22000);expect(bytes(x)).toBeLessThan(1700000);
  expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  for(let i=0;i<x.count;i++){
    const m=x.instanceMatrix.array;
    expect([m[i*16+1],m[i*16+2],m[i*16+4],m[i*16+6],m[i*16+8],m[i*16+9]]).toEqual([0,0,0,0,0,0]);
    expect(m[i*16]).toBe(m[i*16+5]); expect(m[i*16]).toBe(m[i*16+10]);
  }
  console.log({synagogueNativeBytes:bytes(x),blocks:x.count});
});
