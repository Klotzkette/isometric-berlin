/** The retained world facades coexist; the real shared outline rebuilds its
 * single Ward/station family on each Day <-> Minecraft transition. */
import {afterAll,describe,expect,test} from "bun:test";
import {Group,InstancedMesh,Line,Mesh,type Object3D} from "three";
import {createNorthernFidelityStepsV309,type NorthernFidelityBundleV309} from "../src/NorthernFidelityV309";
import {createOutlineLandmarksV182,disposeOutlineConstruction} from "../src/OutlineLandmarksV182";
import {createHospitalRecognitionV228} from "../src/HospitalRecognitionV228";
import {createHospitalEnvelopesV228} from "../src/HospitalEnvelopesV228";
import {assignStableInkRenderOrder} from "../src/stableInkRenderOrderV310";
import {freezeStaticSceneTransforms} from "../src/staticSceneTransforms";
import {setIsoNightPresentation} from "../src/IsometricCityWorld";
import {createMinecraftMaterialState,disposeMinecraftMaterialState,releaseMinecraftMaterialBindings,restoreMinecraftMaterialPresentation,setMinecraftMaterialPresentation} from "../src/visual-modes/minecraft/materialMode";
import type {NorthCoreTerrainRecipesV309} from "../src/NorthCoreTerrainV309";
import previous from "../src/data/hospitalArchitectureV308Previous.json";
import {actualDrawnRuntimeV310,actualNativeRuntimeV310} from "./helpers/northRuntimeActualV310";
import {dispose,stage,oldReferences,expectUnchanged} from "./helpers/northCoreActualV309";

function ward(root:Object3D){const all:InstancedMesh[]=[];root.traverse(o=>{if(o instanceof InstancedMesh&&o.name===previous.batches[0].bundeswehr.name)all.push(o);});expect(all).toHaveLength(1);return all[0];}
function stations(root:Object3D){const all:Group[]=[];root.traverse(o=>{if(o instanceof Group&&["Gesundbrunnen","Landsberger Allee"].includes(o.userData.stationName))all.push(o);});expect(all).toHaveLength(2);return all;}
function facades(world:Group,native:boolean){const names=previous.batches.find(p=>p.native===native)!.children.map(p=>p.name),all:Mesh[]=[];world.traverse(o=>{if(o instanceof Mesh&&names.includes(o.name))all.push(o);});expect(all).toHaveLength(names.length);return all;}

describe("actual retained-world and rebuilt shared-outline lifecycle",()=>{
 const scene=new Group(),toon=createMinecraftMaterialState(),worlds:Group[]=[],bundles:NorthernFidelityBundleV309[]=[],owned:Group[]=[];
 let outline:Group,drawn:Group,native:Group,day:NorthernFidelityBundleV309,blocks:NorthernFidelityBundleV309,releases=0;
 let dayWard:InstancedMesh,nativeWard:InstancedMesh,dayStations:Group[],nativeStations:Group[],dayFacades:Mesh[],nativeFacades:Mesh[],drawnBefore:ReturnType<typeof oldReferences>,nativeBefore:ReturnType<typeof oldReferences>;
 afterAll(()=>{
  for(const bundle of bundles)bundle.syncPrevious(scene,false);
  for(const root of owned){root.removeFromParent();dispose(root);}
  disposeMinecraftMaterialState(toon);if(outline)disposeOutlineConstruction(outline);for(const world of worlds)dispose(world);scene.clear();
 });
 test("actual Day world admits with the single real shared Ward and station family",async()=>{
  const recipes=await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309;
  outline=createOutlineLandmarksV182("day",old=>{releaseMinecraftMaterialBindings(old,toon);releases++;},{architectureV241:true,bayerCampusV277:true});scene.add(outline);
  drawn=await actualDrawnRuntimeV310(recipes);drawn.add(createHospitalRecognitionV228(false),createHospitalEnvelopesV228(false));scene.add(drawn);worlds.push(drawn);
  const lines:Line[]=[];drawn.traverse(o=>{if(o instanceof Line)lines.push(o);});assignStableInkRenderOrder(lines);freezeStaticSceneTransforms(drawn);
  drawnBefore=oldReferences(drawn);dayWard=ward(scene);dayStations=stations(scene);dayFacades=facades(drawn,false);
  day=await stage(createNorthernFidelityStepsV309(false,false,{world:drawn,props:()=>[],originalGroundAt:()=>3},root=>owned.push(root)));bundles.push(day);drawn.add(day.root);
  expect(day.syncPrevious(scene,true)).toBe(true);expect(day.complete()).toBe(true);expect(dayFacades.every(o=>!o.visible)).toBe(true);expect(dayStations.every(g=>g.children.every(o=>!o.visible))).toBe(true);
 },60000);
 test("warm Minecraft keeps Day facades and admits after actual shared-outline disposal and rebuild",async()=>{
  expect(day.complete()).toBe(true);let wardDisposals=0;dayWard.addEventListener("dispose",()=>{wardDisposals++;});
  outline.userData.setMode("minecraft");expect(releases).toBe(1);expect(wardDisposals).toBe(1);nativeWard=ward(scene);nativeStations=stations(scene);expect(nativeWard).not.toBe(dayWard);expect(nativeStations.every(g=>!dayStations.includes(g))).toBe(true);
  drawn.visible=false;
  native=await actualNativeRuntimeV310();native.add(createHospitalRecognitionV228(true),createHospitalEnvelopesV228(true));scene.add(native);worlds.push(native);freezeStaticSceneTransforms(native);setMinecraftMaterialPresentation(native,toon,true);setMinecraftMaterialPresentation(outline,toon,true);
  nativeBefore=oldReferences(native);nativeFacades=facades(native,true);
  blocks=await stage(createNorthernFidelityStepsV309(true,false,{world:native,props:()=>[],originalGroundAt:()=>3},root=>owned.push(root)));bundles.push(blocks);native.add(blocks.root);
  expect(blocks.prepared()).toBe(true);expect(blocks.complete()).toBe(false);expect(blocks.syncPrevious(scene,true)).toBe(true);expect(blocks.complete()).toBe(true);expect(nativeFacades.every(o=>!o.visible)).toBe(true);expect(dayFacades.every(o=>!o.visible)).toBe(true);expect(nativeStations.every(g=>g.children.every(o=>!o.visible))).toBe(true);
 },60000);
 test("returning Day rebinds exact new shared owners and either family rolls back without changing the other",()=>{
  expect(blocks.complete()).toBe(true);restoreMinecraftMaterialPresentation(toon);outline.userData.setMode("day");expect(releases).toBe(2);native.visible=false;drawn.visible=true;setIsoNightPresentation(drawn,false,true,"day");
  const returnedWard=ward(scene),returnedStations=stations(scene);expect(returnedWard).not.toBe(dayWard);expect(returnedWard).not.toBe(nativeWard);expect(returnedStations.every(g=>!dayStations.includes(g)&&!nativeStations.includes(g))).toBe(true);
  expect(day.syncPrevious(scene,true)).toBe(true);expect(day.complete()).toBe(true);expect(returnedStations.every(g=>g.children.every(o=>!o.visible))).toBe(true);expect(dayFacades.every(o=>!o.visible)).toBe(true);
  expect(day.syncPrevious(scene,false)).toBe(true);expect(day.complete()).toBe(false);expect(dayFacades.every(o=>o.visible)).toBe(true);expect(returnedStations.every(g=>g.children.every(o=>o.visible))).toBe(true);expectUnchanged(drawnBefore);
  // Rolling back an inactive family cannot change the newly rebuilt shared
  // owners or the other world's source geometry.
  const returnedWords=new Float32Array(returnedWard.instanceMatrix.array);expect(blocks.syncPrevious(scene,false)).toBe(true);expect(nativeFacades.every(o=>o.visible)).toBe(true);expectUnchanged(nativeBefore);expect(Array.from(returnedWard.instanceMatrix.array)).toEqual(Array.from(returnedWords));expect(returnedStations.every(g=>g.children.every(o=>o.visible))).toBe(true);
 },60000);
});
