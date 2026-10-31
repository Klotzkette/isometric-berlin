import { expect,test } from "bun:test";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { prepareRequiredFidelityV288, constructUnpublishedFidelityV288 } from "../src/RequiredFidelityV288";
import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial } from "three";
import { createDistantBuildingShells } from "../src/IsometricCityWorld";
import { BERLIN_HISTORIC_DOM_V288_IDS } from "../src/BerlinHistoricCoreV288Ownership";
import { POTSDAMER_CORRIDOR_CORE_IDS_V288 } from "../src/PotsdamerCorridorV288Ownership";
test("failed detached assembly disposes instances, shared geometry and alternate materials exactly once",()=>{
  const group=new Group(),geometry=new BoxGeometry(),day=new MeshBasicMaterial(),night=new MeshBasicMaterial();
  const a=new InstancedMesh(geometry,day,1),b=new InstancedMesh(geometry,day,1);a.userData.nightMaterial=night;b.userData.nightMaterial=night;group.add(a,b);
  const counts=[0,0,0,0,0];[geometry,day,night,a,b].forEach((o,i)=>o.addEventListener('dispose',()=>counts[i]++));
  expect(()=>constructUnpublishedFidelityV288([()=>({group}),()=>{throw new Error('later constructor failed');}])).toThrow('later constructor failed');
  expect(counts).toEqual([1,1,1,1,1]);expect(group.parent).toBeNull();
});
test("both complete representations precede exact proxy retirement and all other buildings remain",()=>{
  const old=JSON.stringify(prisms), nativeOld=JSON.stringify(voxels);
  for(const native of [false,true]){
    const made=prepareRequiredFidelityV288(prisms,voxels,native);
    expect(made.historicDom).toBe(true);expect(made.potsdamerCorridor).toBe(true);expect(made.root.children).toHaveLength(4);
  }
  expect(JSON.stringify(prisms)).toBe(old);expect(JSON.stringify(voxels)).toBe(nativeOld);
  const ids=new Set([...BERLIN_HISTORIC_DOM_V288_IDS,...POTSDAMER_CORRIDOR_CORE_IDS_V288]);
  const selected=prisms.buildings.filter(p=>ids.has(p.id));expect(selected).toHaveLength(11);
  const fallback=createDistantBuildingShells(prisms,selected), replacement=createDistantBuildingShells(prisms,selected,{historicDomV288:true,potsdamerCorridorV288:true});
  expect(fallback.children.length).toBeGreaterThan(0);expect(replacement.children).toHaveLength(0);
  const changed={...prisms,buildings:prisms.buildings.map(p=>p.id===BERLIN_HISTORIC_DOM_V288_IDS[0]?{...p,h_dm:p.h_dm+1}:p)};
  expect(prepareRequiredFidelityV288(changed,voxels).historicDom).toBe(false);
  const changedNative={...voxels,cell_m:voxels.cell_m+1};const rejected=prepareRequiredFidelityV288(prisms,changedNative,true);
  expect(rejected.historicDom).toBe(false);expect(rejected.potsdamerCorridor).toBe(false);
});
