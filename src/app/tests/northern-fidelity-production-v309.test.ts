/** The actual settled Core, actual retained hospital/station constructors and
 * real five-model factory must cross one reversible publication boundary. */
import {expect,test} from "bun:test";
import {Group,InstancedMesh,InterleavedBufferAttribute,Mesh,Line,Points,type Object3D} from "three";
import {createNorthernFidelityStepsV309,type NorthernFidelityBundleV309} from "../src/NorthernFidelityV309";
import {hasCompleteNorthSitesV306} from "../src/NorthSitesV306";
import {hasCompleteRailTerrainContactApproachV309 as hasCompleteRailTerrainContactV307} from "../src/RailTerrainContactV307";
import {hasCompleteRailSseArchitectureV307} from "../src/RailSseArchitectureV307";
import {hasCompleteHospitalArchitectureV308} from "../src/HospitalArchitectureV308";
import {hasCompleteGesundbrunnenRoadBridgesV309} from "../src/GesundbrunnenRoadBridgesV309";
import {gesundbrunnenRoadBridgeAtV309,gesundbrunnenRoadGroundAtV309} from "../src/gesundbrunnenRoadBridgeNavigationV309";
import type {NorthCoreTerrainRecipesV309} from "../src/NorthCoreTerrainV309";
import {hasCompleteNorthCoreEnginesV311 as hasCompleteNorthCoreTerrainV309,prepareNorthCoreEnginesV311Steps,type CoreWorkerV8ProfileV311} from "../src/NorthCoreEnginesV311";
import type {NorthCoreActualDeltaV310} from "../src/NorthCoreActualTerrainV310";
import type {NorthCoreBridgeDeltaV309} from "../src/NorthCoreBridgeTerrainV309";
import bridgeReceipt from "../src/data/gesundbrunnenBridgeCoreV309Delta.json";
import actualReceipt from "../src/data/coreTerrainActualV310.json";
import v8Profile from "../src/data/coreWorkerV8V311.json";
import {actualDrawnRuntimeV310,actualNativeRuntimeV310} from "./helpers/northRuntimeActualV310";
import {installActualV8Park1V311} from "./helpers/coreWorkerV8V311";
import {assignStableInkRenderOrder} from "../src/stableInkRenderOrderV310";
import {createCoreHumboldtNavigationV307} from "../src/coreTerrainNavigationV307";
import {createHospitalRecognitionV228} from "../src/HospitalRecognitionV228";
import {createHospitalEnvelopesV228} from "../src/HospitalEnvelopesV228";
import {createBundeswehrHospitalV214} from "../src/BundeswehrHospitalV214";
import {createRailStationsV190} from "../src/RailStationsV190";
import {northSitesV306Solids,northSchoolGroundAtV306} from "../src/northSitesV306Navigation";
import {setIsoNightPresentation} from "../src/IsometricCityWorld";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {freezeStaticSceneTransforms} from "../src/staticSceneTransforms";
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from "../src/losslessStaticStorage";
import {createMinecraftMaterialState,disposeMinecraftMaterialState,setMinecraftMaterialPresentation} from "../src/visual-modes/minecraft/materialMode";
import schoolFloor from "../src/data/northSchoolGroundV306.json";
import previousHospitals from "../src/data/hospitalArchitectureV308Previous.json";
import {northGpuHostV309}from"./helpers/northGpuHostV309";
import {actualDrawn,actualNative,dispose,upload,oldReferences,expectUnchanged,stage,done} from "./helpers/northCoreActualV309";

function bytes(array:ArrayBufferView){return new Bun.CryptoHasher("sha256").update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest("hex");}
function fingerprint(root:Object3D){
 const rows:unknown[]=[];
 root.traverse(o=>{if((o instanceof Mesh||o instanceof Line||o instanceof Points)&&!o.userData.northCoreOutsideV309){
  rows.push([o.uuid,o.visible,o.geometry.uuid,Object.entries(o.geometry.attributes).map(([k,a])=>[k,bytes(a instanceof InterleavedBufferAttribute?a.data.array:a.array)]),o.geometry.index?bytes(o.geometry.index.array):null,o instanceof InstancedMesh?[o.count,bytes(o.instanceMatrix.array),o.instanceColor?bytes(o.instanceColor.array):null]:null]);
 }});return JSON.stringify(rows);
}
function inside(ring:readonly number[][],x:number,z:number){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function solidProbe(native:boolean){
 for(const s of northSitesV306Solids(native)){
  const xs=s.ring.map(p=>p[0]),zs=s.ring.map(p=>p[1]),w=Math.min(...xs),e=Math.max(...xs),n=Math.min(...zs),b=Math.max(...zs);
  for(let x=w+.25;x<e;x+=.5)for(let z=n+.25;z<b;z+=.5){if(!inside(s.ring,x,z)||s.holes.some(h=>inside(h,x,z)))continue;const top=s.topAt(x,z);if(top!==null&&top>s.minY+.1)return{x,z,y:(s.minY+top)/2,top};}
 }throw Error("Actual northern solid has no interior navigation probe");
}
function expectPrivateModels(bundle:NorthernFidelityBundleV309,native:boolean){
 expect(bundle.root.children).toHaveLength(5);
 expect(hasCompleteNorthSitesV306(bundle.root.children[0]as Group,native)).toBe(true);
 expect(hasCompleteRailTerrainContactV307(bundle.contact,native)).toBe(true);
 expect(hasCompleteRailSseArchitectureV307(bundle.architecture,native)).toBe(true);
 expect(hasCompleteHospitalArchitectureV308(bundle.hospital,native)).toBe(true);
 expect(bundle.root.children[4]).toBe(bundle.bridges);expect(hasCompleteGesundbrunnenRoadBridgesV309(bundle.bridges,native)).toBe(true);
}
function terrainProbe(bundle:NorthernFidelityBundleV309,native:boolean){
 const sample=createCoreHumboldtNavigationV307(bundle.contact,native);
 // The retained Flakturm footprint is deliberately a hole in this terrain
 // transfer; select an actual measured hill face, not that excluded building.
 for(let x=850.25;x<1110;x+=4)for(let z=-3229.75;z<-2970;z+=4){const y=sample(x,z);if(y!==null&&y>25)return{x,z,y};}
 throw Error("Actual complete Humboldthain contact contains no measured hill face");
}

for(const family of ["drawn","native","v8"]){const native=family==="native";test(`real northern publication stages without mutation, then admits every model and live navigation (${native?"native Toon":family==="v8"?"actual Node/V8 worker + mobile grade + GPU parking":"mobile Drawn grade + GPU parking"})`,async()=>{
 const source=await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309;
 const nativeStages:{name:string;count:number}[]=[];
 const gpu=northGpuHostV309(),world=native?await actualNativeRuntimeV310((name,count)=>nativeStages.push({name,count})):await actualDrawnRuntimeV310(source,true),legacy=new Group(),scene=gpu.scene;
 if(native)expect(nativeStages).toEqual([{name:"first-ground-yield",count:184983},{name:"complete-constructor",count:184956},{name:"complete-required-sites",count:184956},{name:"instance-parking",count:184956}]);
 expect((world.getObjectByName(native?"Voxel ground runs":"Drawn ground slabs")as InstancedMesh).count).toBe(native?184956:125364);
 if(family==="v8"){
  const proof=installActualV8Park1V311(world,source);expect(proof.retiredTriangles).toBe(184049);expect(proof.shifted).toBe(918);
  let park:Mesh|undefined;world.traverse(o=>{if(o instanceof Mesh&&o.name==="smooth parkland lawns"&&o.parent?.userData.progressiveWorldBatchId==="surface-parks-1")park=o;});
  const a=park!.geometry.getAttribute("position").array,words=new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4),original=words[0],refs=oldReferences(world);
  words[0]^=1;
  try{const unknown=await stage(prepareNorthCoreEnginesV311Steps(world,false,true,source,bridgeReceipt as unknown as NorthCoreBridgeDeltaV309,actualReceipt as unknown as NorthCoreActualDeltaV310,v8Profile as unknown as CoreWorkerV8ProfileV311));expect(unknown).toBeNull();unknown?.rollback();expect(hasCompleteNorthCoreTerrainV309(world,false)).toBe(false);expectUnchanged(refs);}finally{words[0]=original;}
 }
 legacy.add(createHospitalRecognitionV228(native),createHospitalEnvelopesV228(native),createBundeswehrHospitalV214(native),createRailStationsV190(native));world.add(legacy);scene.add(world);
 interleaveStaticGeometry(world);freezeStaticSceneTransforms(world);const rankedInk:Line[]=[];world.traverse(o=>{if(o instanceof Line)rankedInk.push(o);});assignStableInkRenderOrder(rankedInk);
 const toon=native?createMinecraftMaterialState():null;let provisional:Group|null=null,bundle:NorthernFidelityBundleV309|null=null;
 try{
  if(toon)setMinecraftMaterialPresentation(world,toon,true);else setIsoNightPresentation(world,false,true,"schwellenraum");
  world.traverse(o=>{if(o instanceof Mesh)o.geometry.userData.losslessStaticBacking=true;});done(parkStaticGeometrySteps(world,true));done(parkStaticInstancesSteps(world));upload(world);
  const refs=oldReferences(world);gpu.register();const sourceGpu=refs.filter(r=>r.mesh.name===(native?"Voxel ground runs":"Drawn ground slabs")||!native&&(r.mesh instanceof Line&&r.mesh.name.includes("kerb")||r.mesh.parent?.userData.progressiveWorldBatchId==="restored-asphalt-2--7")).map(r=>r.mesh),ink=sourceGpu.find(m=>{if(!(m instanceof Line)||!m.name.includes("kerb"))return false;for(let p=m.parent;p;p=p.parent)if(p.userData.progressiveWorldBatchId==="restored-kerbs-2--7")return true;return false;});expect(sourceGpu.length).toBeGreaterThan(0);if(!native)expect(ink).toBeDefined();for(const m of sourceGpu)gpu.draw(m);gpu.uploads.length=0;const before=fingerprint(world),probe=solidProbe(native),cell=schoolFloor.nativeCells[0],schoolX=(cell[0]+cell[2])/2,schoolZ=(cell[1]+cell[3])/2;
  expect(northSchoolGroundAtV306(schoolX,schoolZ,native)).toBe(schoolFloor.groundY);
  const visible=new Map(refs.map(r=>[r.mesh,r.mesh.visible])),parents=new Map<Object3D,readonly Object3D[]>();world.traverse(o=>{if(o.children.length)parents.set(o,o.children.slice());});let checkpoints=0;
  bundle=await stage(createNorthernFidelityStepsV309(native,true,{world,props:()=>[],originalGroundAt:()=>3,beforeSwap:(o,k)=>k==="instances"?gpu.instances.retireForRebind(o as InstancedMesh):gpu.geometry.retireForRebind(o),afterSwap:()=>gpu.register()},root=>{provisional=root;}),()=>{
   checkpoints++;
   for(const r of refs)if(r.mesh.geometry!==r.geometry||r.mesh.geometry.index!==r.index||Object.keys(r.mesh.geometry.attributes).length!==Object.keys(r.attributes).length||Object.entries(r.attributes).some(([k,a])=>r.mesh.geometry.getAttribute(k)!==a)||[...r.mesh.position.toArray(),...r.mesh.quaternion.toArray(),...r.mesh.scale.toArray(),...r.mesh.matrix.elements,Number(r.mesh.matrixAutoUpdate),Number(r.mesh.matrixWorldAutoUpdate)].some((v,i)=>v!==r.pose[i])||r.mesh.visible!==visible.get(r.mesh)||r.mesh instanceof InstancedMesh&&(r.mesh.instanceMatrix!==r.matrix||r.mesh.instanceColor!==r.color))throw Error("A visible predecessor changed during cooperative preparation");
   for(const[parent,children]of parents)if(parent.children.length!==children.length||parent.children.some((c,i)=>c!==children[i]))throw Error("Preparation inserted or removed a predecessor scene member");
  });expect(checkpoints).toBeGreaterThan(50);const hill=terrainProbe(bundle,native),bridgeTop=gesundbrunnenRoadBridgeAtV309(1510,-3328,native),bridgeGround=gesundbrunnenRoadGroundAtV309(1510,-3328,native);expect(bridgeTop).not.toBeNull();expect(bridgeGround).not.toBeNull();expect(bridgeGround!).toBeLessThan(bridgeTop!-2);
  expect(bundle.root).toBe(provisional);expectPrivateModels(bundle,native);expect(bundle.prepared()).toBe(true);expect(bundle.complete()).toBe(false);expectUnchanged(refs);expect(fingerprint(world)).toBe(before);
  expect(hasCompleteNorthCoreTerrainV309(world,native)).toBe(false);expect(bundle.terrainAt(schoolX,schoolZ)).toBeNull();expect(bundle.terrainAt(1510,-3328)).toBeNull();expect(bundle.floorAt(probe.x,probe.z,probe.top)).toBeNull();expect(bundle.solidAt(probe.x,probe.y,probe.z)).toBe(false);expect(bundle.overridesOldHospitalAt(-3600,8400)).toBe(false);
  // The publisher performs residency, upload and private presentation before
  // attaching the complete replacement, without interleaving new receipts.
  if(toon)setMinecraftMaterialPresentation(bundle.root,toon,true);else setIsoNightPresentation(bundle.root,false,true,"schwellenraum");
  done(parkStaticGeometrySteps(bundle.root,true));done(parkStaticInstancesSteps(bundle.root));upload(bundle.root);expect(bundle.prepared()).toBe(true);
  world.add(bundle.root);expect(bundle.complete()).toBe(false);expect(bundle.syncPrevious(scene,true)).toBe(true);expectPrivateModels(bundle,native);expect(bundle.complete()).toBe(true);expect(hasCompleteNorthCoreTerrainV309(world,native)).toBe(true);if(ink)expect(ink.geometry).not.toBe(refs.find(r=>r.mesh===ink)!.geometry);
  const gpuSamples:(Mesh|Line|Points)[]=[];for(const child of bundle.root.children){let chosen:Mesh|Line|Points|undefined;child.traverse(o=>{if(!chosen&&(o instanceof Mesh||o instanceof Line||o instanceof Points))chosen=o;});if(chosen)gpuSamples.push(chosen);}expect(gpuSamples).toHaveLength(5);gpu.register();for(const m of gpuSamples)gpu.draw(m);gpu.uploads.length=0;expect(gpu.retire().geometry).toBeGreaterThan(0);expect(bundle.complete()).toBe(true);for(const m of gpuSamples)gpu.draw(m);expectPrivateModels(bundle,native);expect(bundle.complete()).toBe(true);gpu.uploads.length=0;
  expect(bundle.terrainAt(schoolX,schoolZ)).toBe(schoolFloor.groundY);expect(bundle.terrainAt(hill.x,hill.z)).toBeCloseTo(hill.y,5);expect(bundle.solidAt(probe.x,probe.y,probe.z)).toBe(true);expect(bundle.floorAt(probe.x,probe.z,probe.top)).toBeCloseTo(probe.top,5);expect(bundle.overridesOldHospitalAt(-3600,8400)).toBe(true);
  expect(bundle.terrainAt(1510,-3328)).toBeCloseTo(bridgeGround!,5);expect(bundle.floorAt(1510,-3328,bridgeGround!)).toBeCloseTo(bridgeGround!,5);expect(bundle.floorAt(1510,-3328,bridgeTop!)).toBeCloseTo(bridgeTop!,5);
  const stations:Object3D[]=[];legacy.traverse(o=>{if(o instanceof Group&&["Gesundbrunnen","Landsberger Allee"].includes(o.userData.stationName))stations.push(o);});expect(stations).toHaveLength(2);expect(stations.every(g=>g.children.every(c=>!c.visible))).toBe(true);
  const previousNames=previousHospitals.batches.find(p=>p.native===native)!.children.map(p=>p.name),hospitalMembers:Mesh[]=[];legacy.traverse(o=>{if(o instanceof Mesh&&previousNames.includes(o.name))hospitalMembers.push(o);});expect(hospitalMembers).toHaveLength(previousNames.length);expect(hospitalMembers.every(o=>!o.visible)).toBe(true);
  const retained=toon?.originals.size;expect(bundle.syncPrevious(scene,true)).toBe(true);if(toon)expect(toon.originals.size).toBe(retained);
  if(family==="v8"){expect(await stage(prepareNorthCoreEnginesV311Steps(world,true,true,source,bridgeReceipt as unknown as NorthCoreBridgeDeltaV309,actualReceipt as unknown as NorthCoreActualDeltaV310,v8Profile as unknown as CoreWorkerV8ProfileV311))).toBeNull();expect(bundle.complete()).toBe(true);}
  if(native){bundle.bridges.visible=false;expect(bundle.complete()).toBe(false);expect(bundle.terrainAt(1510,-3328)).toBeNull();expect(bundle.syncPrevious(scene,true)).toBe(false);}
  else if(family==="v8"){let owner:Mesh|undefined;world.traverse(o=>{if(o instanceof Mesh&&o.name==="smooth parkland lawns"&&o.parent?.userData.progressiveWorldBatchId==="surface-parks-1")owner=o;});expect(owner!==undefined).toBe(true);owner!.geometry.dispose();expect(bundle.complete()).toBe(false);expect(bundle.syncPrevious(scene,true)).toBe(false);}
  else expect(bundle.syncPrevious(scene,false)).toBe(true);
  expect(bundle.complete()).toBe(false);expect(hasCompleteNorthCoreTerrainV309(world,native)).toBe(false);expect(bundle.terrainAt(schoolX,schoolZ)).toBeNull();expect(bundle.solidAt(probe.x,probe.y,probe.z)).toBe(false);bundle.root.removeFromParent();expectUnchanged(refs);expect(fingerprint(world)).toBe(before);expect(stations.every(g=>g.children.every(c=>c.visible))).toBe(true);
 }finally{
  if(bundle)bundle.syncPrevious(scene,false);
  if(toon)disposeMinecraftMaterialState(toon);
  if(provisional){provisional.removeFromParent();dispose(provisional);}
  gpu.dispose();dispose(world);scene.clear();expect(gpu.live.size).toBe(0);
 }
},60000);
}
