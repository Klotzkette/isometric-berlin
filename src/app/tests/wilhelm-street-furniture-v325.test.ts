import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Group,InstancedMesh,MeshBasicMaterial} from 'three';
import profile from '../src/data/wilhelmStreetFurnitureV325.json';
import {createWilhelmStreetFurnitureV325,disposeWilhelmStreetFurnitureV325,
 hasCompleteWilhelmStreetFurnitureV325,wilhelmStreetFurnitureReplacementSourceIdsV325} from '../src/WilhelmStreetFurnitureV325';
import type {StreetLight} from '../src/ParkDetails';
import {interleaveStaticGeometry} from '../src/interleaveStaticGeometry';
import {freezeStaticSceneTransforms} from '../src/staticSceneTransforms';
import {indexGeometryExactly} from '../src/exactGeometryIndex';
import {partitionStaticSpatialInstancesSteps} from '../src/staticSpatialInstances';
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from '../src/losslessStaticStorage';
import {retireSceneMaterialPrograms} from '../src/sceneMaterialPrograms';
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,restoreMinecraftMaterialPresentation,disposeMinecraftMaterialState} from '../src/visual-modes/minecraft/materialMode';

const park=JSON.parse(readFileSync(resolve(import.meta.dir,'../public/mesh/regierungsviertel/park-details.json'),'utf8'));
const lights=park.street_lights as StreetLight[],terrain=()=>3;
const make=()=>createWilhelmStreetFurnitureV325(false,lights,terrain)!;
function hash(root:Group):string{const h=createHash('sha256');for(const m of root.children as InstancedMesh[])for(const a of[m.instanceMatrix,m.instanceColor!,...Object.values(m.geometry.attributes),m.geometry.index!]){const v=('data'in a?a.data:a).array;h.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}return h.digest('hex');}
const drain=(g:Generator<void,unknown>)=>{for(;;)if(g.next().done)return;};

describe('finite exact Wilhelm public-lighting and sparse furniture v325',()=>{
 test('all89 actual source receipts precede exactly14 replacements and27 complete lamps; no source word changes',()=>{
  const before=JSON.stringify(lights),start=performance.now(),root=make();
  try{
   expect(root).not.toBeNull();expect(performance.now()-start).toBeLessThan(500);
   expect(profile.sourceReceipts).toHaveLength(89);expect(profile.lamps).toHaveLength(27);
   expect(profile.smallFurniture).toHaveLength(5);expect(profile.smallFurniture.filter(q=>q.kind==='bench').every(q=>(q as {backrest?:boolean}).backrest===false)).toBe(true);
   expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);expect(root.children).toHaveLength(3);
   const ids=wilhelmStreetFurnitureReplacementSourceIdsV325(root);expect(ids).toHaveLength(14);expect(new Set(ids).size).toBe(14);
   expect(ids).toContain('181253');expect(ids).not.toContain('177967');
   expect(root.children.reduce((n,q)=>n+(q as InstancedMesh).count,0)).toBeLessThan(1500);
   expect(JSON.stringify(lights)).toBe(before);
  }finally{disposeWilhelmStreetFurnitureV325(root);}
 });
 test('missing, changed, duplicate, inherited/getter sources, unknown metadata and new south double poles close',()=>{
  const target=lights.find(q=>q.id==='96378')!;
  expect(createWilhelmStreetFurnitureV325(false,undefined,terrain)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,lights)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,lights.filter(q=>q!==target),terrain)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,[...lights,target],terrain)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,lights.map((q,i)=>i===0?target:q),terrain)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,profile.sourceReceipts as StreetLight[],terrain)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,lights.map(q=>q===target?{...q,height_m:q.height_m+.01}:q),terrain)).toBeNull();
  const getter={...target};Object.defineProperty(getter,'height_m',{get:()=>target.height_m,enumerable:true});
  expect(createWilhelmStreetFurnitureV325(false,lights.map(q=>q===target?getter:q),terrain)).toBeNull();
  const foreign=profile.lamps.find(q=>q.source==='osm')!;
  expect(createWilhelmStreetFurnitureV325(false,lights.map((q,i)=>i===0?{...target,id:'foreign',position:[...foreign.position] as [number,number,number]}:q),terrain)).toBeNull();
  expect(createWilhelmStreetFurnitureV325(false,lights,()=>NaN)).toBeNull();
  const value=profile.styles['green-arch'].reach;profile.styles['green-arch'].reach+=.01;
  try{expect(make()).toBeNull();}finally{profile.styles['green-arch'].reach=value;}
  const fake=new Group();fake.userData={complete:true,replacementSourceIds:['96378']};expect(hasCompleteWilhelmStreetFurnitureV325(fake,false)).toBe(false);expect(wilhelmStreetFurnitureReplacementSourceIdsV325(fake)).toHaveLength(0);
 });
 test('native is separately cardinal, needs no park payload, keeps all anchors and identical full/touch detail',()=>{
  const a=createWilhelmStreetFurnitureV325(true,undefined,terrain)!,b=createWilhelmStreetFurnitureV325(true,undefined,terrain)!;
  try{
   expect(a).not.toBeNull();expect(hasCompleteWilhelmStreetFurnitureV325(a,true)).toBe(true);expect(hasCompleteWilhelmStreetFurnitureV325(a,false)).toBe(false);
   expect(a.children).toHaveLength(2);expect(wilhelmStreetFurnitureReplacementSourceIdsV325(a)).toHaveLength(0);expect(hash(a)).toBe(hash(b));
   let words=0;for(const m of a.children as InstancedMesh[]){const matrix=m.instanceMatrix.array;for(let i=0;i<matrix.length;i+=16)for(const k of[1,2,3,4,6,7,8,9,11]){expect(matrix[i+k]).toBe(0);words++;}}
   expect(words).toBeGreaterThan(2000);expect(profile.lamps.filter(q=>q.source==='osm').every(q=>q.position[2]>2200)).toBe(true);
  }finally{disposeWilhelmStreetFurnitureV325(a);disposeWilhelmStreetFurnitureV325(b);}
 });
 test('real static freeze/interleave, lighting families, private Toon, lossless parking and program retirement preserve admission',async()=>{
  const root=make();try{
   // Exact real ParkDetails postpasses: pre-interleaved tiny primitives and
   // bounded batches remain privately the same authored family.
   for(const m of root.children as InstancedMesh[])indexGeometryExactly(m.geometry);
   drain(partitionStaticSpatialInstancesSteps(root,{cellM:512}));
   freezeStaticSceneTransforms(root);interleaveStaticGeometry(root);expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);
   for(const key of['nightMaterial','schwellenraumMaterial','dayMaterial']){for(const m of root.children as InstancedMesh[])m.material=m.userData[key];expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);}
   const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);restoreMinecraftMaterialPresentation(state);disposeMinecraftMaterialState(state);
   expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);
   drain(parkStaticGeometrySteps(root,true));drain(parkStaticInstancesSteps(root));for(const m of root.children as InstancedMesh[])m.instanceMatrix.onUploadCallback();await new Promise(r=>setTimeout(r,1));
   expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);
  }finally{disposeWilhelmStreetFurnitureV325(root);}expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);
 });
 test('actual output raw edits, source edits, material/pose changes and authored disposal revoke replacement IDs',()=>{
  const root=make(),m=root.children[0]as InstancedMesh;try{
   const raw=m.instanceMatrix.array[0];m.instanceMatrix.array[0]=raw+.01;expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);expect(wilhelmStreetFurnitureReplacementSourceIdsV325(root)).toHaveLength(0);m.instanceMatrix.array[0]=raw;
   const source=lights.find(q=>q.id==='96378')!,y=source.position[1];source.position[1]+=.01;expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);source.position[1]=y;
   expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(true);m.position.x=.01;expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);m.position.x=0;
   const old=m.material,foreign=new MeshBasicMaterial();m.material=foreign;expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);m.material=old;foreign.dispose();
   m.userData.dayMaterial.opacity=0;expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);m.userData.dayMaterial.opacity=1;
   m.geometry.dispose();expect(hasCompleteWilhelmStreetFurnitureV325(root,false)).toBe(false);
  }finally{disposeWilhelmStreetFurnitureV325(root);}
  const second=make();(second.children[0]as InstancedMesh).userData.nightMaterial.dispose();expect(hasCompleteWilhelmStreetFurnitureV325(second,false)).toBe(false);disposeWilhelmStreetFurnitureV325(second);
 });
});
