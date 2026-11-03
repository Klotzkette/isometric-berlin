/** Actual retained main raster and separately transferred worker regression. */
import {expect,test}from"bun:test";
import {Group,InstancedMesh,Mesh}from"three";
import {setIsoNightPresentation}from"../src/IsometricCityWorld";
import {interleaveStaticGeometry}from"../src/interleaveStaticGeometry";
import {parkStaticGeometrySteps,parkStaticInstancesSteps}from"../src/losslessStaticStorage";
import {createMinecraftMaterialState,disposeMinecraftMaterialState,setMinecraftMaterialPresentation}from"../src/visual-modes/minecraft/materialMode";
import {createRailTerrainContactV307,hasCompleteRailTerrainContactV307}from"../src/RailTerrainContactV307";
import {prepareNorthCoreTerrainV309Steps,hasCompleteNorthCoreTerrainV309,revokeNorthCoreTerrainV309,type NorthCoreTerrainRecipesV309}from"../src/NorthCoreTerrainV309";
import {actualDrawn,actualNative,dispose,upload,oldReferences,expectUnchanged,stage,done}from"./helpers/northCoreActualV309";

test("actual desktop/mobile client raster+all transferred worker skins admit only as one complete two-phase source",async()=>{
 const source=await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309;
 const root=await actualDrawn(source);let required:Group|null=null;
 try{
  expect((root.getObjectByName("Drawn ground slabs")as InstancedMesh).count).toBe(203849);
  const batch=root.children.find(o=>o.userData.progressiveWorldBatchId===source.variants["drawn-worker"].parts[0].batchId)!;root.remove(batch);expect(await stage(prepareNorthCoreTerrainV309Steps(root,false,true,source))).toBeNull();root.add(batch);
  for(const mobile of[false,true]){
   if(mobile)interleaveStaticGeometry(root);
   setIsoNightPresentation(root,false,true,mobile?"schwellenraum":"day");
   if(mobile){root.traverse(o=>{if(o instanceof Mesh)o.geometry.userData.losslessStaticBacking=true;});done(parkStaticGeometrySteps(root,true));done(parkStaticInstancesSteps(root));upload(root);}
   const before=oldReferences(root);required=createRailTerrainContactV307(false,{mobileLike:mobile});expect(hasCompleteRailTerrainContactV307(required,false)).toBe(true);
   const replacement=required,tx=await stage(prepareNorthCoreTerrainV309Steps(root,false,()=>hasCompleteRailTerrainContactV307(replacement,false),source));expect(tx).not.toBeNull();expectUnchanged(before);expect(hasCompleteNorthCoreTerrainV309(root,false)).toBe(false);
   // The actual publisher adds all replacement geometry before the synchronous
   // old-source retirement. A false live ownership gate still closes admission.
   root.add(replacement);expect(tx!.commit(()=>replacement.parent===root&&hasCompleteRailTerrainContactV307(replacement,false))).toBe(true);expect(tx!.complete()).toBe(true);
   for(const mode of["day","night","flood","snowstorm","schwellenraum"]as const){setIsoNightPresentation(root,mode==="night",true,mode);expect(tx!.commit(()=>replacement.parent===root&&hasCompleteRailTerrainContactV307(replacement,false))).toBe(true);}
   tx!.rollback();root.remove(replacement);expectUnchanged(before);expect(hasCompleteNorthCoreTerrainV309(root,false)).toBe(false);dispose(replacement);required=null;
  }
 }finally{revokeNorthCoreTerrainV309(root);if(required){required.removeFromParent();dispose(required);}dispose(root);}
},60000);

test("actual native source after all client apertures and private Toon state preserves every untouched matrix row",async()=>{
 const source=await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309;const root=await actualNative();interleaveStaticGeometry(root);
 const state=createMinecraftMaterialState();let required:Group|null=null;
 try{const ground=root.getObjectByName("Voxel ground runs")as InstancedMesh;expect(ground.count).toBe(185262);setMinecraftMaterialPresentation(root,state,true);done(parkStaticGeometrySteps(root,true));done(parkStaticInstancesSteps(root));upload(root);const before=oldReferences(root);required=createRailTerrainContactV307(true);setMinecraftMaterialPresentation(required,state,true);const replacement=required;
  const tx=await stage(prepareNorthCoreTerrainV309Steps(root,true,()=>hasCompleteRailTerrainContactV307(replacement,true),source));expect(tx).not.toBeNull();expectUnchanged(before);root.add(replacement);expect(tx!.commit(()=>replacement.parent===root&&hasCompleteRailTerrainContactV307(replacement,true))).toBe(true);expect(tx!.complete()).toBe(true);const retainedCount=state.originals.size;expect(tx!.commit(()=>replacement.parent===root&&hasCompleteRailTerrainContactV307(replacement,true))).toBe(true);expect(state.originals.size).toBe(retainedCount);tx!.rollback();root.remove(replacement);expectUnchanged(before);expect(state.originals.size).toBeLessThan(retainedCount);
 }finally{revokeNorthCoreTerrainV309(root);disposeMinecraftMaterialState(state);if(required){required.removeFromParent();dispose(required);}dispose(root);}
},60000);
