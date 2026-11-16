import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Box3, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from 'three';
import { hasParisMoskauDrawnOwnerV354, isParisMoskauPrismV354, prepareParisMoskauV354 } from '../src/ParisMoskauV354';
import { buildMinecraftVoxelWorldSteps, decodeVoxelBuildingColumns } from '../src/MinecraftVoxelWorld';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';
import type { VoxelPayload } from '../src/terrainPayload';
import { createCityRecognitionRefinements } from '../src/CityRecognitionRefinements';
import { createIsometricCityCore, type PrismPayload } from '../src/IsometricCityWorld';
import prisms from '../public/mesh/regierungsviertel/lod2-prisms.json';
import voxels from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import data from '../src/data/parisMoskauV354.json';
import { splitProgressiveBuildings, MOBILE_INITIAL_BUILDING_COUNT, DESKTOP_INITIAL_BUILDING_COUNT } from '../src/progressiveWorld';

const payload = voxels as unknown as VoxelPayload;
const source = prisms.buildings.find(p => p.id === data.sourcePrism.id)!;
const hash = (a: ArrayBufferView) => createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function snapshot(root: Group) {
 const out: unknown[] = [];
 root.traverse(o => {
  const mesh = o as Mesh;
  if (!mesh.geometry) return;
  out.push({name:o.name,pose:o.matrix.elements,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a]) => [k,hash(a.array)])),index:mesh.geometry.index ? hash(mesh.geometry.index.array) : null});
 });
 return out;
}
function inside(ring: number[][],x: number,z: number) {
 let yes=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i], [c,d]=ring[j];
  if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)yes=!yes;
 }
 return yes;
}

test('only complete measured source + six exclusive old Native columns admit the replacement', () => {
 expect(source).toEqual(data.sourcePrism);
 expect(isParisMoskauPrismV354(source)).toBe(true);
 expect(prepareParisMoskauV354([])).toBeNull();
 expect(prepareParisMoskauV354([source,source])).toBeNull();
 expect(prepareParisMoskauV354([{...source,h_dm:107}])).toBeNull();
 expect(prepareParisMoskauV354([source],true)).toBeNull();
 const columns=decodeVoxelBuildingColumns(payload);
 const local=columns.filter(q=>q[0]>=-118&&q[0]<=-116&&q[1]>=-106&&q[1]<=-105);
 expect(local).toEqual(data.nativeColumns);
 for(const q of local){
  const [x,z]=[(q[0]+.5)*40,(q[1]+.5)*40];
  expect(prisms.buildings.filter(p=>inside(p.ring,x,z)).map(p=>p.id)).toEqual([source.id]);
 }
 const changed={...payload,building_rows:undefined,buildings:local.map(q=>[...q])} as VoxelPayload;
 changed.buildings![0][3]++;
 expect(prepareParisMoskauV354([source],true,changed)).toBeNull();
 const admitted=prepareParisMoskauV354([source],true,payload)!;
 expect(admitted).not.toBeNull();
 expect(admitted.replacesColumn(...local[0])).toBe(false);
 const parent=new Group();parent.add(admitted.group);
 expect(columns.filter(q=>admitted.replacesColumn(...q))).toEqual(local);
 expect(admitted.replacesPrism(source)).toBe(false);
 parent.remove(admitted.group);
 expect(admitted.replacesColumn(...local[0])).toBe(false);
});

test('both complete models have an open north loggia; Native faces are independently cardinal', () => {
 for(const native of [false,true]){
  const admission=prepareParisMoskauV354([source],native,payload)!;
  new Group().add(admission.group);admission.group.updateMatrixWorld(true);
  const mesh=admission.group.children[0] as Mesh, pos=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index!;
  expect(idx.count/3).toBe(native?data.minecraft.triangles:data.drawn.triangles);
  if(native){
   let noncardinal=0;
   for(let i=0;i<idx.count;i+=3){
    const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
    if(![0,1,2].some(axis=>pos.array[a*3+axis]===pos.array[b*3+axis]&&pos.array[a*3+axis]===pos.array[c*3+axis]))noncardinal++;
   }
   expect(noncardinal).toBe(0);
  }
  const angle=-Math.atan2(2.7,11.8),c=Math.cos(angle),s=Math.sin(angle);
  const world=(x:number,y:number,z:number)=>new Vector3(-466.2+x*c+z*s,y,-420.575-x*s+z*c);
  // Clear middle of balcony, above rails and beneath the roof: first opaque
  // hit must be the recessed rear door/wall, never the old front glass proxy.
  const ray=new Raycaster(world(.4,9.35,-6),new Vector3(s,0,c));
  const hits=ray.intersectObject(admission.group,true);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0].distance).toBeGreaterThan(3.0);
  expect(hits[0].distance).toBeLessThan(3.7);
  const bounds=new Box3().setFromObject(admission.group);
  expect(bounds.min.y).toBeCloseTo(3.9,4);
  expect(bounds.max.y).toBeLessThan(16);
  expect(admission.group.userData.fullStaticDetailOnTouch).toBe(true);
  expect(admission.group.userData.nativeMinecraft).toBe(native);
 }
});

test('actual Drawn core attaches the complete owner before removing the exact old prism', () => {
 const p={...prisms,buildings:[source]} as unknown as PrismPayload;
 const world=createIsometricCityCore(p,null,null,null,{includeContext:false,buildings:[source]});
 expect(world.getObjectByName('Restaurant Paris-Moskau v354')).toBeDefined();
 expect(world.getObjectByName('LoD2 prism buildings')).toBeUndefined();
 const fallback=createIsometricCityCore({...p,buildings:[{...source,h_dm:107}]},null,null,null,{includeContext:false});
 expect(fallback.getObjectByName('Restaurant Paris-Moskau v354')).toBeUndefined();
 expect(fallback.getObjectByName('LoD2 prism buildings')).toBeDefined();
});

test('actual Native constructor attaches the complete house before filtering its six tuples', async () => {
 await preloadAltMitteNativeV169Source();
 const finite={...payload,grid:{min_x_idx:-119,min_z_idx:-107,cols:5,rows:4},building_rows:undefined,buildings:data.nativeColumns.map(q=>[...q]),ground_rows:[],tree_rows:[],trees:[]} as VoxelPayload;
 const original=JSON.stringify(finite), root=new Group();
 const steps=buildMinecraftVoxelWorldSteps(root,finite,null,null,{sourcePrisms:[source]});
 try {
  let done=false;
  for(let i=0;i<20_000;i++){
   const state=steps.next();
   if(root.getObjectByName('Voxel building columns')){done=true;break;}
   if(state.done)break;
  }
  expect(done).toBe(true);
  expect(root.getObjectByName('Restaurant Paris-Moskau v354')).toBeDefined();
  expect((root.getObjectByName('Voxel building columns') as InstancedMesh).count).toBe(0);
  expect(JSON.stringify(finite)).toBe(original);
 } finally {steps.return(undefined as never);}
},30_000);

test('every non-Paris word and edge in all five existing recognition batches is unchanged', async () => {
 const app=resolve(import.meta.dir,'..'), repo=resolve(app,'../..');
 const baseline=execFileSync('git',['show','4bb88fa3d836f0313407bbe0abeef32dca20f63e:src/app/src/CityRecognitionRefinements.ts'],{cwd:repo,encoding:'utf8'});
 const call='  addParisMoskau(\n    north,\n    groundAt(...CITY_REFINEMENT_PROFILES.parisMoskau.centreWorldM),\n  );\n';
 expect(baseline.split(call)).toHaveLength(2);
 const tmp=mkdtempSync(join(tmpdir(),'paris-v354-'));
 try {
  const input=join(tmp,'old.ts'), output=join(tmp,'old.js');
  const code=baseline.replace('createCityRecognitionRefinements(ground: VoxelPayload)', 'createCityRecognitionRefinements(ground: VoxelPayload, omitParis=false)').replace(call,'  if (!omitParis) '+call.trimStart()).replace(/from "\.\/(.*?)"/g,(_,p)=>`from ${JSON.stringify(resolve(app,'src',p))}`).replace('from "three"',`from ${JSON.stringify(resolve(app,'node_modules/three/build/three.module.js'))}`);
  await Bun.write(input,code);
  const built=await Bun.build({entrypoints:[input],target:'bun',format:'esm',minify:false});
  expect(built.success).toBe(true);await Bun.write(output,built.outputs[0]);
  const previous=await import(output);
  const original=snapshot(previous.createCityRecognitionRefinements(payload));
  expect(snapshot(createCityRecognitionRefinements(payload))).toEqual(original);
  const world=new Group(), model=prepareParisMoskauV354([source])!;
  world.add(model.group);
  expect(hasParisMoskauDrawnOwnerV354(world)).toBe(true);
  expect(snapshot(createCityRecognitionRefinements(payload,world))).toEqual(snapshot(previous.createCityRecognitionRefinements(payload,true)));
  world.remove(model.group);
  expect(hasParisMoskauDrawnOwnerV354(world)).toBe(false);
  expect(snapshot(createCityRecognitionRefinements(payload,world))).toEqual(original);
  const fake=new Group();fake.name=model.group.name;fake.userData={...model.group.userData};world.add(fake);
  expect(snapshot(createCityRecognitionRefinements(payload,world))).toEqual(original);
  world.add(model.group);(model.group.children[0] as Mesh).geometry.dispose();
  expect(hasParisMoskauDrawnOwnerV354(world)).toBe(false);
  expect(snapshot(createCityRecognitionRefinements(payload,world))).toEqual(original);
 } finally {rmSync(tmp,{recursive:true,force:true});}
},30_000);

test('both unchanged initial budgets preserve all old required sources and keep Paris out of Worker/distant districts', async () => {
 const app=resolve(import.meta.dir,'..'),repo=resolve(app,'../..'),tmp=mkdtempSync(join(tmpdir(),'paris-partition-v354-'));
 try {
  const baseline=execFileSync('git',['show','4bb88fa3d836f0313407bbe0abeef32dca20f63e:src/app/src/progressiveWorld.ts'],{cwd:repo,encoding:'utf8'});
  const code=baseline.replace('const REQUIRED_INITIAL_SOURCE_PARTS =','export const REQUIRED_INITIAL_SOURCE_PARTS =').replace(/from "\.\/(.*?)"/g,(_,p)=>`from ${JSON.stringify(resolve(app,'src',p))}`);
  const input=join(tmp,'old.ts'),output=join(tmp,'old.js');await Bun.write(input,code);
  const built=await Bun.build({entrypoints:[input],target:'bun',format:'esm',external:['*']});expect(built.success).toBe(true);await Bun.write(output,built.outputs[0]);
  const previous=await import(output);
  for(const n of [MOBILE_INITIAL_BUILDING_COUNT,DESKTOP_INITIAL_BUILDING_COUNT]){
   const a=previous.splitProgressiveBuildings(prisms.buildings,n,180,Infinity),b=splitProgressiveBuildings(prisms.buildings,n,180,Infinity);
   const ids=(x:{id:string}[])=>x.map(p=>p.id),oldIds=new Set(ids(a.initial)),newIds=new Set(ids(b.initial));
   expect(a.initial).toHaveLength(n);expect(b.initial).toHaveLength(n);
   expect([...newIds].filter(id=>!oldIds.has(id))).toEqual([source.id]);
   const moved=[...oldIds].filter(id=>!newIds.has(id));expect(moved).toHaveLength(1);
   expect(b.remaining.flat().some(p=>p.id===moved[0])).toBe(true);
   expect(b.remaining.flat().some(p=>p.id===source.id)).toBe(false);
   expect(b.omitted.some(p=>p.id===source.id)).toBe(false);
   expect(ids([...b.initial,...b.remaining.flat(),...b.omitted]).sort()).toEqual(ids([...a.initial,...a.remaining.flat(),...a.omitted]).sort());
   expect(previous.REQUIRED_INITIAL_SOURCE_PARTS.has(moved[0])).toBe(false);
   expect([...previous.REQUIRED_INITIAL_SOURCE_PARTS].filter((id)=>oldIds.has(id)).every(id=>newIds.has(id))).toBe(true);
  }
 } finally {rmSync(tmp,{recursive:true,force:true});}
},30_000);
