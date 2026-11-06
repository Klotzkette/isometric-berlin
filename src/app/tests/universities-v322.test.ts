import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {Group,InstancedMesh,Mesh,LineSegments,InterleavedBufferAttribute} from "three";
import data from "../src/data/universitiesArchitectureV322.json";
import {createUniversitiesArchitectureV322,hasCompleteUniversitiesArchitectureV322,universitiesNavigationV322,universitiesPreviousPrismV322,uniExactPlansV322} from "../src/UniversitiesArchitectureV322";
import {createExactOwnersSourceV321Steps} from "../src/ExactOwnersV321";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from "../src/losslessStaticStorage";
import {setIsoNightPresentation} from "../src/IsometricCityWorld";
import {retireSceneMaterialPrograms} from "../src/sceneMaterialPrograms";
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,disposeMinecraftMaterialState} from "../src/visual-modes/minecraft/materialMode";
const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
const voxels=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8"));
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function dispose(root:Group){const set=new Set<{dispose():void}>();root.traverse((o:any)=>{if(o.geometry)set.add(o.geometry);if(o.isInstancedMesh)set.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)set.add(m);});for(const r of set)r.dispose();root.clear();}

test("all named colleges are represented with complete official leaves and explicit current ASH",()=>{
 expect(data.sites).toHaveLength(18);expect(data.models).toHaveLength(45);expect(data.oldBodies).toHaveLength(21);
 expect(data.sites.map(s=>s.key)).toEqual(expect.arrayContaining(["fu-holzlaube","hu-adlershof","hu-grimm-hegel","tu-mathematik","bht-wedding","udk-hardenberg","weissensee","ash-extension"]));
 const ids=data.sites.flatMap(s=>s.partIds);expect(new Set(ids).size).toBe(ids.length);expect(ids).toHaveLength(485);
 expect(data.sites.find(s=>s.key==="fu-holzlaube")!.partIds).toHaveLength(16);
 expect(data.sites.find(s=>s.key==="bht-wedding")!.partIds).toHaveLength(76);
 expect(data.sites.flatMap(s=>s.parents)).not.toContain("DEBE01YYK00007Xu");
 expect(data.sites.flatMap(s=>s.parents)).not.toContain("DEBE04YY500006Rw");
 expect(data.sites.flatMap(s=>s.parents)).not.toContain("DEBE06YYB00009Fd");
 for(const model of data.models)if(!model.native){expect(model.positionType).toBe("f32");expect(model.normals).toBeString();}
 for(const row of data.oldBodies){expect(universitiesPreviousPrismV322(row)).toBeTrue();expect(universitiesPreviousPrismV322({...row,h_dm:row.h_dm+1})).toBeFalse();}
});

test("every exact Drawn, preview and real Full/Touch native source plan binds; mixed columns never retire",()=>{
 for(const [native,touch,preview]of[[false,false,false],[false,false,true],[true,false,false],[true,true,false]]){
  const entry=uniExactPlansV322(native,touch,preview);expect(entry.control).toBeGreaterThan(0);
  expect(drain(createExactOwnersSourceV321Steps(entry.plan,prisms.buildings,entry.control,voxels))).not.toBeNull();
  if(native)for(const c of entry.plan.nativeSource!.columns)if(c.retireBody)expect(c.contributors.every(id=>entry.plan.owners.some(o=>o.id===id&&o.retireBody))).toBeTrue();
 }
});

test.each([false,true])("actual finite model, idempotent touch interleave, parking and material lifetimes native=%s",native=>{
 const empty=createUniversitiesArchitectureV322(native);expect(empty.children).toHaveLength(0);expect(hasCompleteUniversitiesArchitectureV322(empty,native)).toBeFalse();
 const root=createUniversitiesArchitectureV322(native,{sourcePrisms:prisms.buildings,voxels});
 try{
  expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();expect(hasCompleteUniversitiesArchitectureV322(root.clone(),native)).toBeFalse();
  const members=root.children.filter(c=>c instanceof InstancedMesh)as InstancedMesh[];
  const count=members.reduce((n,m)=>n+m.count,0);expect(count).toBe(native?242548:95310);
  interleaveStaticGeometry(root);drain(parkStaticGeometrySteps(root));drain(parkStaticInstancesSteps(root));expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();
  for(const mode of["night","snowstorm","schwellenraum","flood","day","minecraft"]){setIsoNightPresentation(root,mode==="night",true,mode as any);expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();}
  expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();
  const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();setMinecraftMaterialPresentation(root,state,false);disposeMinecraftMaterialState(state);
  if(native)for(const m of members){const a=m.instanceMatrix.array;expect(Array.from({length:m.count},(_,i)=>[1,2,4,6,8,9].every(k=>a[i*16+k]===0)).every(Boolean)).toBeTrue();}
  const nav=universitiesNavigationV322(root,native);expect(nav.solidAt(999999,8,999999)).toBeFalse();expect(nav.groundAt(999999,999999)).toBeNull();
  const source=data.navigation.find(p=>p.id.startsWith("ehb-new-ground"))!;const a=source.roofTriangles[0],x=(a[0][0]+a[1][0]+a[2][0])/3,z=(a[0][2]+a[1][2]+a[2][2])/3;
  if(!native)expect(nav.groundAt(x,z,3.2)).toBe(3);
  const member=members[0];member.position.x=.01;expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeFalse();member.position.x=0;expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();
  member.userData.dayMaterial.dispose();expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeFalse();
  console.log(JSON.stringify({universitiesV322:native?"native":"drawn",instances:count,members:members.length}));
 }finally{dispose(root);}
},30000);

test("an altered original record or actual native grid closes only the optional replacement",()=>{
 const old=data.oldBodies[0],foreign=prisms.buildings.map((p:any)=>p.id===old.id?{...p,h_dm:p.h_dm+1}:p);
 expect(createUniversitiesArchitectureV322(false,{sourcePrisms:foreign}).children).toHaveLength(0);
 const root=createUniversitiesArchitectureV322(true,{sourcePrisms:prisms.buildings,voxels:{...voxels,grid:{...voxels.grid,min_x_idx:voxels.grid.min_x_idx+1}}});expect(root.children).toHaveLength(0);
});
