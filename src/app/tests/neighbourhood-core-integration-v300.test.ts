import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {Group,InstancedMesh,Material,Mesh} from "three";
import {createIsometricCityCore,type PrismPayload} from "../src/IsometricCityWorld";
import {prepareRequiredFidelityV288} from "../src/RequiredFidelityV288";
import {buildMinecraftVoxelWorldSteps,type VoxelPayload} from "../src/MinecraftVoxelWorld";
import {preloadAltMitteNativeV169Source} from "../src/AltMitteNativeCoreV169";
import moabit from "../src/data/moabitMitteV300Owners.json";
import west from "../src/data/westKiezV302CoreOwners.json";
const root=new URL("../public/mesh/regierungsviertel/",import.meta.url);
const prisms=JSON.parse(readFileSync(new URL("lod2-prisms.json",root),"utf8")) as PrismPayload;
const voxels=JSON.parse(readFileSync(new URL("minecraft-voxels.json",root),"utf8")) as VoxelPayload;
function dispose(group:Group){const geometry=new Set<any>(),materials=new Set<Material>();group.traverse(o=>{const m=o as Mesh;if(m.geometry)geometry.add(m.geometry);if(m instanceof InstancedMesh)m.dispose();for(const v of [m.material,o.userData.dayMaterial,o.userData.nightMaterial])for(const a of Array.isArray(v)?v:[v])if(a instanceof Material)materials.add(a);});group.clear();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}

test("the actual admitted initial/progressive core retires precisely the complete retained Lehrter fronts",()=>{
  const fidelity=prepareRequiredFidelityV288(prisms,voxels,false,false,false,true);
  expect(fidelity.moabitMitte).toBeTrue();expect(fidelity.westKiez).toBeTrue();
  const ids=new Set([...moabit.oldPrisms,...moabit.retainedPrisms,...west.oldPrisms].map(p=>p.id));
  const city=createIsometricCityCore(prisms,null,null,null,{buildings:prisms.buildings.filter(p=>ids.has(p.id)),includeContext:false,moabitMitteV300:fidelity.moabitMitte,westKiezV302:fidelity.westKiez});
  expect(city.userData.moabitFittingSegmentsV300).toBe(76);expect(city.userData.moabitFittingInstancesV300).toBe(70);
  dispose(city);dispose(fidelity.root);
});

test("the actual complete native world admits both new families from unmodified real prism and RLE inputs",async()=>{
  await preloadAltMitteNativeV169Source();
  const group=new Group(),iterator=buildMinecraftVoxelWorldSteps(group,voxels,null,null,{sourcePrisms:prisms.buildings,neighbourhoodV300:true});
  try{
    let next=iterator.next();while(!next.done)next=iterator.next();
    expect(group.userData.moabitMitteV300).toBeTrue();expect(group.userData.westKiezV302).toBeTrue();
    expect(group.getObjectByName("Moabit and Mitte source houses and individual street fronts v300 native")).toBeDefined();
    expect(group.getObjectByName("Complete source-bound West Kiez houses v302 native")).toBeDefined();
  }finally{iterator.return(group);dispose(group);}
},60000);
