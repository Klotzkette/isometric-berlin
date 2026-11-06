import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Group,InstancedMesh,InterleavedBufferAttribute,LineSegments,Mesh,Material} from "three";
import data from "../src/data/federalMinistriesV321.json";
import previous from "../src/data/federalMinistriesV321Previous.json";
import packets from "../src/data/federalMinistriesV321Packets.json";
import {createFederalMinistriesV321,createFederalMinistriesV321Steps,hasCompleteFederalMinistriesV321,
 federalMinistryNavigationV321,federalMinistryPreviousPrismV321,federalMinistryPreviousPlanV321,
 federalMinistryPreviewPlanV321,federalMinistryCentralPlanV321} from "../src/FederalMinistriesV321";
import {createExactOwnersSourceV321Steps,stageExactOwnersV321} from "../src/ExactOwnersV321";
import {createIsometricCityCore,setIsoNightPresentation} from "../src/IsometricCityWorld";
import {compactStaticGeometry} from "../src/compactStaticGeometry";
import {runtimeConstructorOptionsV310} from "./helpers/northRuntimeActualV310";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from "../src/losslessStaticStorage";
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,disposeMinecraftMaterialState} from "../src/visual-modes/minecraft/materialMode";
import {schwellenraumMaterialFor} from "../src/visual-modes/schwellenraum/materialGrade";
import {buildSurroundingCityChunk,type SurroundingChunkGeometry,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import type {SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {clusterFacadesSourceV320} from "../src/ClusterFacadesV320";
const p=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
const v=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8"));
const plans=packets as unknown as SourceQuarterSourceV303;
function drain<T>(g:Generator<void,T>):T{for(;;){const r=g.next();if(r.done)return r.value;}}
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){resources.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);if(o instanceof InstancedMesh)resources.add(o);}});for(const r of resources)r.dispose();root.clear();}

test.each([false,true])("complete current public exteriors, real touch preparation and six-mode materials, native=%s",native=>{
 const root=createFederalMinistriesV321(native,{sourcePrisms:p.buildings,voxels:v});
 try{
  expect(hasCompleteFederalMinistriesV321(root,native)).toBeTrue();expect(hasCompleteFederalMinistriesV321(root,!native)).toBeFalse();expect(hasCompleteFederalMinistriesV321(root.clone(),native)).toBeFalse();
  expect(root.children).toHaveLength(3);expect(root.children[0].children).toHaveLength(10);
  const members=root.children.slice(1)as InstancedMesh[],mesh=members[0],countAll=members.reduce((n,m)=>n+m.count,0);
  expect(countAll).toBe(root.userData.instances);expect(countAll).toBeGreaterThan(40000);expect(countAll).toBeLessThan(60000);expect(members[1].count).toBeGreaterThan(1000);
  const count=mesh.count,original=mesh.instanceMatrix;
  interleaveStaticGeometry(root);drain(parkStaticGeometrySteps(root));drain(parkStaticInstancesSteps(root));
  expect(hasCompleteFederalMinistriesV321(root,native)).toBeTrue();expect(mesh.instanceMatrix).toBe(original);expect(mesh.count).toBe(count);
  root.traverse(o=>{if(o instanceof Mesh)o.material=o.userData.nightMaterial;});expect(hasCompleteFederalMinistriesV321(root,native)).toBeTrue();
  root.traverse(o=>{if(o instanceof Mesh)o.material=schwellenraumMaterialFor(o,o.userData.dayMaterial);});expect(hasCompleteFederalMinistriesV321(root,native)).toBeTrue();
  const toon=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,toon,true);expect(hasCompleteFederalMinistriesV321(root,native)).toBeTrue();setMinecraftMaterialPresentation(root,toon,false);disposeMinecraftMaterialState(toon);
  if(native)for(const part of members){const matrix=part.instanceMatrix.array;expect(Array.from({length:part.count},(_,i)=>[1,2,4,6,8,9].every(k=>matrix[i*16+k]===0)).every(Boolean)).toBeTrue();}
  const nav=federalMinistryNavigationV321(root,native)!;expect(nav.solidAt(1600,7,761)).toBeFalse();expect(nav.groundAt(1600,761,5.2)).toBeCloseTo(native?5.2:4.922,3);expect(nav.groundAt(1600,761,10)).toBeNull();
  const arch=data.justiceColonnade;expect(nav.solidAt(arch.a[0]+.23,7,arch.a[1])).toBeTrue();
  mesh.position.x=.01;expect(hasCompleteFederalMinistriesV321(root,native)).toBeFalse();mesh.position.x=0;expect(hasCompleteFederalMinistriesV321(root,native)).toBeTrue();
  mesh.userData.dayMaterial=new Material();expect(hasCompleteFederalMinistriesV321(root,native)).toBeFalse();
 }finally{dispose(root);}
});

test("source defaults close, exact full original records and failed native signatures retain legacy",()=>{
 const empty=createFederalMinistriesV321();expect(empty.children).toHaveLength(0);expect(hasCompleteFederalMinistriesV321(empty)).toBeFalse();
 expect(data.oldBodies).toHaveLength(5);for(const old of data.oldBodies){expect(federalMinistryPreviousPrismV321(old)).toBeTrue();expect(federalMinistryPreviousPrismV321({...old,h_dm:old.h_dm+1})).toBeFalse();}
 const altered=p.buildings.map((r:any)=>r.id===data.oldBodies[0].id?{...r,h_dm:r.h_dm+1}:r);
 expect(createFederalMinistriesV321(false,{sourcePrisms:altered}).children).toHaveLength(0);
 const foreign={...v,grid:{...v.grid,min_x_idx:v.grid.min_x_idx+1}};expect(createFederalMinistriesV321(true,{sourcePrisms:p.buildings,voxels:foreign}).children).toHaveLength(0);
 const selected=data.nativeColumns.records[0].tuple,zi=selected[1]-v.grid.min_z_idx,row=v.building_rows[zi],run=row.find((r:number[])=>selected[0]>=v.grid.min_x_idx+r[0]&&selected[0]<v.grid.min_x_idx+r[0]+r[1]),height=run[3];
 try{run[3]++;expect(createFederalMinistriesV321(true,{sourcePrisms:p.buildings,voxels:v}).children).toHaveLength(0);}finally{run[3]=height;}
});

test("all actual Drawn/full/touch/preview/central catalogues bind complete current sources cooperatively",()=>{
 for(const [native,mobile]of [[false,false],[true,false],[true,true]]){const{plan,control}=federalMinistryPreviousPlanV321(native,mobile);expect(control).toBeGreaterThan(0);expect(drain(createExactOwnersSourceV321Steps(plan,p.buildings,control,v))).not.toBeNull();}
 for(const provider of[federalMinistryPreviewPlanV321,federalMinistryCentralPlanV321]){const{plan,control}=provider();expect(drain(createExactOwnersSourceV321Steps(plan,p.buildings,control))).not.toBeNull();}
 for(const key of["nativeFull","nativeTouch"]as const){const plan=previous.plans[key];for(const column of plan.nativeSource.columns)if(column.retireBody)expect(column.contributors.every(id=>plan.owners.some(o=>o.id===id&&o.retireBody))).toBeTrue();}
});

test("cooperative cancellation disposes unpublished geometry and authored disposal closes the private model",()=>{
 let partial:Group|undefined;const steps=createFederalMinistriesV321Steps(false,{sourcePrisms:p.buildings},r=>partial=r);expect(steps.next().done).toBeFalse();steps.return(partial!);expect(hasCompleteFederalMinistriesV321(partial!)).toBeFalse();expect(partial!.children).toHaveLength(0);
 const root=createFederalMinistriesV321(false,{sourcePrisms:p.buildings});(root.children[1]as InstancedMesh).geometry.dispose();expect(hasCompleteFederalMinistriesV321(root)).toBeFalse();dispose(root);
});

test("actual Drawn constructor's initially hidden night strips admit, survive Day/Night and restore exact source refs",()=>{
 const {plan,control}=federalMinistryPreviousPlanV321(),owner=plan.owners.find(o=>o.id==="TGyeCGjY")!;
 expect(owner.components.some(c=>c.name==="LoD2 facade night strips")).toBeTrue();
 const prism=p.buildings.find((r:any)=>r.id===owner.id),root=createIsometricCityCore(p,null,null,null,{...runtimeConstructorOptionsV310(false,false,p),buildings:[prism],includeContext:false,moabitMitteV300:false,westKiezV302:false});
 try{root.traverse(compactStaticGeometry);interleaveStaticGeometry(root);
  const strips=root.getObjectByName("LoD2 facade night strips")as InstancedMesh;expect(strips.visible).toBeFalse();
  const snapshot=root.children.filter(o=>o instanceof Mesh||o instanceof LineSegments).map((o:any)=>({o,g:o.geometry,m:o.instanceMatrix,c:o.instanceColor,matrix:o.instanceMatrix?Buffer.from(o.instanceMatrix.array.buffer,o.instanceMatrix.array.byteOffset,o.instanceMatrix.array.byteLength).toString("base64"):null}));
  const receipt=drain(createExactOwnersSourceV321Steps(plan,p.buildings,control))!,tx=stageExactOwnersV321(root,receipt,true)!;
  expect(tx).not.toBeNull();expect(tx.activeOwners).toEqual([owner.id]);expect(tx.commit(true)).toBeTrue();
  for(const night of[false,true,false]){setIsoNightPresentation(root,night,true,night?"night":"day");expect(strips.visible).toBe(night);expect(tx.complete()).toBeTrue();}
  tx.rollback();for(const s of snapshot){expect(s.o.geometry).toBe(s.g);expect(s.o.instanceMatrix).toBe(s.m);expect(s.o.instanceColor).toBe(s.c);if(s.matrix)expect(Buffer.from(s.o.instanceMatrix.array.buffer,s.o.instanceMatrix.array.byteOffset,s.o.instanceMatrix.array.byteLength).toString("base64")).toBe(s.matrix);}
 }finally{dispose(root);}
});

const publicRoot=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",publicRoot),"utf8"));
function aggregate(g:SurroundingChunkGeometry){const m=g.root.children.find(c=>c instanceof Mesh)as Mesh,position=m.geometry.getAttribute("position")as InterleavedBufferAttribute;return {vertices:position.data.array,indices:m.geometry.index!.array};}
test("ten actual raw/prepared packets preserve every XYZ/RGB/line word and the complete unretired index complement",async()=>{
 expect(plans.keys).toHaveLength(10);
 for(const key of plans.keys){const[mode,id]=key.split(":"),native=mode==="minecraft",d=manifest.chunks.find((q:any)=>q.id===id),input=JSON.parse(gunzipSync(readFileSync(new URL(d[mode].url,publicRoot))).toString())as SurroundingCityChunk,snapshot=JSON.stringify(input);
  const oldRecipes=(await loadSourceQuarterRecipesV309(id,native)).filter(e=>e.kind!=="federal-ministries-v321");
  const ownership:SurroundingOwnershipOptions={neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,sourceQuarterSourcesV303:oldRecipes,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:false,neukoellnLandmarksV305:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,clusterFacadesV320:clusterFacadesSourceV320};
  let a:SurroundingChunkGeometry|undefined,b:SurroundingChunkGeometry|undefined;
  try{a=drain(buildSurroundingCityChunk(structuredClone(input),id,native,false,ownership));b=drain(buildSurroundingCityChunk(input,id,native,false,{...ownership,governmentOfficesV321:true,sourceQuarterSourcesV303:[...oldRecipes,{source:plans,kind:"federal-ministries-v321",requiredReplacement:true,admission:"government-v321"}]}));
   expect(JSON.stringify(input)).toBe(snapshot);expect(b.root.userData.sourceKinds).toEqual(a.root.userData.sourceKinds);expect(b.root.userData.sourceQuarterTrianglesV303-(a.root.userData.sourceQuarterTrianglesV303??0)).toBe(plans.packets[key].retire.reduce((n,r)=>n+r.triangles.length,0));expect(b.root.userData.sourceQuarterOwnersV303).toEqual(expect.arrayContaining(plans.packets[key].owners));
   const aa=aggregate(a),bb=aggregate(b);expect(bb.vertices).toEqual(aa.vertices);const expected=aa.indices.slice();let offset=0;
   for(let mi=0;mi<input.meshes.length;mi++){for(const r of plans.packets[key].retire)if(r.mesh===mi)for(const t of r.triangles){const at=offset+t*3;expected[at+1]=expected[at];expected[at+2]=expected[at];}offset+=Buffer.from(input.meshes[mi].indices,"base64").byteLength/4;}
   expect(bb.indices).toEqual(expected);expect(b.nav).toEqual(a.nav);expect(b.geometryBytes).toBe(a.geometryBytes);
   const la=a.root.children.filter(c=>c instanceof LineSegments),lb=b.root.children.filter(c=>c instanceof LineSegments);expect(lb.length).toBe(la.length);
   for(let i=0;i<la.length;i++){const x=(la[i]as LineSegments).geometry,y=(lb[i]as LineSegments).geometry;expect(Object.keys(y.attributes)).toEqual(Object.keys(x.attributes));for(const name of Object.keys(x.attributes)){const q=x.getAttribute(name),r=y.getAttribute(name);expect(r instanceof InterleavedBufferAttribute?r.data.array:r.array).toEqual(q instanceof InterleavedBufferAttribute?q.data.array:q.array);}}
  }finally{if(a)disposeSurroundingCityRoot(a.root);if(b)disposeSurroundingCityRoot(b.root);}
 }
},60000);
