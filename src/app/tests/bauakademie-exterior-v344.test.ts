import { expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4 } from "three";
import { createBauakademieExteriorV344 } from "../src/BauakademieExteriorV344";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import receipt from "../src/data/bauakademieExteriorV344.json";

const source=await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url)).json() as PrismPayload;
const voxels=await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url)).json() as VoxelPayload;

for(const native of [false,true]) test(`Bauakademie ${native?"Native":"Drawn"}: two present remnants, source preserved`,()=>{
  const original=JSON.stringify([source.buildings,voxels.building_rows]);
  const model=createBauakademieExteriorV344(source.buildings,native?voxels:undefined);
  expect(model.userData.admittedIds).toEqual(["45095631","14046275"]);
  expect(model.userData.futureReconstruction).toBe(false);
  expect(model.userData.originalSourcePreserved).toBe(true);
  expect(model.userData.fullMobileIdentical).toBe(true);
  expect(JSON.stringify([source.buildings,voxels.building_rows])).toBe(original);
  expect(model.userData.windowCount).toBeGreaterThan(20);
  expect(model.children.length).toBeLessThanOrEqual(3);
  const bounds=new Box3().setFromObject(model);
  expect(bounds.min.x).toBeGreaterThan(1847);expect(bounds.max.x).toBeLessThan(1877);
  expect(bounds.min.z).toBeGreaterThan(335);expect(bounds.max.z).toBeLessThan(378);
  expect(bounds.max.y).toBeLessThan(native?29.5:26.5);
  let count=0;const matrix=new Matrix4();
  model.traverse(o=>{if(o instanceof InstancedMesh){
    count+=o.count;expect(o.geometry.getAttribute("uv")).toBeUndefined();
    expect(o.userData.nightMaterial).toBeDefined();
    if(native)for(let i=0;i<o.count;i++){
      o.getMatrixAt(i,matrix);
      for(const start of [0,4,8])expect(matrix.elements.slice(start,start+3).filter(v=>Math.abs(v)>1e-6).length).toBe(1);
    }
  }});
  expect(count).toBeLessThan(7000);
  console.log({mode:native?"Native":"Drawn",instances:count,windows:model.userData.windowCount,instanceBytes:count*76});
});

test("Bauakademie source/height/tone/column edits and absent sources admit no affected remnant",()=>{
  expect(createBauakademieExteriorV344([]).children).toHaveLength(0);
  for(const r of receipt.records){
    for(const patch of [{h_dm:r.source.h_dm+1},{tone:[0,0,0]},{ring:[]}])
      expect(createBauakademieExteriorV344(source.buildings.map(p=>p.id===r.source.id?{...p,...patch}:p))
        .userData.admittedIds).not.toContain(r.source.id);
    const rows=[...voxels.building_rows!];rows[r.nativeColumns[0][1]-voxels.grid.min_z_idx]=[];
    expect(createBauakademieExteriorV344(source.buildings,{...voxels,building_rows:rows}).userData.admittedIds).not.toContain(r.source.id);
  }
  expect(createBauakademieExteriorV344(source.buildings,{...voxels,cell_m:2}).children).toHaveLength(0);
});
