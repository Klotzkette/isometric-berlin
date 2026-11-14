import {expect,test} from "bun:test";
import {Box3, InstancedMesh, Matrix4, Quaternion, Raycaster, Vector3} from "three";
import {createPetriExteriorV344} from "../src/PetriExteriorV344";
import type {PrismPayload} from "../src/IsometricCityWorld";
import type {VoxelPayload} from "../src/terrainPayload";
import receipt from "../src/data/petriExteriorV344.json";

const source=await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url)).json() as PrismPayload;
const voxels=await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url)).json() as VoxelPayload;

test("PETRI gains its completed exterior without altering the source footprint or neighbours",()=>{
  const before=JSON.stringify(source.buildings),model=createPetriExteriorV344(source.buildings)!;
  expect(model).not.toBeNull();
  expect(model.userData.originalSourcePreserved).toBe(true);
  expect(model.userData.groundArcadeWalkable).toBe(false);
  const bounds=new Box3().setFromObject(model);
  expect(bounds.max.y).toBeCloseTo(29.25,2);
  expect(bounds.min.x).toBeGreaterThan(2156);expect(bounds.max.x).toBeLessThan(2197);
  expect(JSON.stringify(source.buildings)).toBe(before);
  expect(createPetriExteriorV344(source.buildings.filter(p=>p.id!==receipt.source.id))).toBeNull();
  expect(createPetriExteriorV344(source.buildings.map(p=>p.id===receipt.source.id?{...p,h_dm:91}:p))).toBeNull();
});

test("PETRI Native uses actual pinned columns and wholly cardinal instance matrices",()=>{
  const model=createPetriExteriorV344(source.buildings,voxels)!;
  expect(model).not.toBeNull();expect(model.userData.blockNative).toBe(true);
  model.updateMatrixWorld(true);
  const m=new Matrix4(),p=new Vector3(),q=new Quaternion(),s=new Vector3(),normal=new Vector3();
  let count=0;
  model.traverse(o=>{if(o instanceof InstancedMesh)for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,m);m.decompose(p,q,s);normal.set(0,0,1).applyQuaternion(q);
    expect(Math.abs(normal.x)<1e-5||Math.abs(normal.z)<1e-5).toBe(true);count++;
  }});
  expect(count).toBeGreaterThan(200);expect(count).toBeLessThan(1800);
  const rows=[...voxels.building_rows!];rows[receipt.nativeColumns[0][1]-voxels.grid.min_z_idx]=[];
  expect(createPetriExteriorV344(source.buildings,{...voxels,building_rows:rows})).toBeNull();
});

test("Native upper loggia opens the measured front only, with both return elevations closed",()=>{
  const model=createPetriExteriorV344(source.buildings,voxels)!;model.updateMatrixWorld(true);
  const front=new Raycaster(new Vector3(2194,27.2,698),new Vector3(0,0,-1),0,3);
  expect(front.intersectObject(model,true)).toHaveLength(0);
  for(const [origin,direction] of [
    [[2194,27.2,690],[-1,0,0]],
    [[2182,27.2,702],[0,0,-1]],
  ]) {
    const side=new Raycaster(new Vector3(...origin),new Vector3(...direction),0,3);
    expect(side.intersectObject(model,true).length).toBeGreaterThan(0);
  }
});
