import {letteringLayout} from '../src/drawnLettering';
import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Group,InstancedMesh,MeshBasicMaterial} from 'three';
import profile from '../src/data/ubahnAccessV326.json';
import index from '../src/data/ubahnAccessV326Index.json';
import {createUbahnAccessV326,createUbahnAccessV326Steps,hasCompleteUbahnAccessV326,
 disposeUbahnAccessV326,ubahnAccessOpeningsV326,ubahnAccessGroundAtV326,ubahnAccessSolidAtV326} from '../src/UbahnAccessV326';
import {freezeStaticSceneTransforms} from '../src/staticSceneTransforms';
import {interleaveStaticGeometry} from '../src/interleaveStaticGeometry';
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from '../src/losslessStaticStorage';
import {retireSceneMaterialPrograms} from '../src/sceneMaterialPrograms';
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,restoreMinecraftMaterialPresentation,disposeMinecraftMaterialState} from '../src/visual-modes/minecraft/materialMode';

const entry=profile.entries.find(e=>e.stair&&e.stair.points.length===2)!,terrain=()=>7.25;
const make=(native=false)=>createUbahnAccessV326({native,sourceIds:[entry.id],terrainAt:terrain})!;
const drain=(g:Generator<void,unknown>)=>{for(;;)if(g.next().done)return;};
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('source-exact signs survive unsupported ground without invented underground floors',()=>{
 const root=createUbahnAccessV326({native:false,stairs:false,sourceIds:[entry.id],terrainAt:terrain})!;
 try{
  expect(root).not.toBeNull();expect(hasCompleteUbahnAccessV326(root,false)).toBe(true);
  expect(ubahnAccessOpeningsV326(root)).toHaveLength(0);
  expect(ubahnAccessGroundAtV326(root,...entry.stair!.points[0])).toBeNull();
  expect(ubahnAccessSolidAtV326(root,entry.point[0],7,entry.point[1],.4)).toBe(false);
  expect(root.children.map(m=>m.name)).not.toContain('BVG source accesses stairs and rails V326');
  expect(root.userData.entranceIds).toEqual([entry.id]);
 }finally{disposeUbahnAccessV326(root);}
});

test('all175 current BVG names, complete finite membership and explicit exclusions; no S-only U labels',()=>{
 for(const s of profile.stations)expect(letteringLayout(s.name.toUpperCase(),.16).totalWidthM).toBeGreaterThan(0);
 expect(profile.stations).toHaveLength(175);expect(new Set(profile.stations.map(s=>s.id)).size).toBe(175);
 expect(profile.stations.filter(s=>s.temporaryU6Closure)).toHaveLength(5);
 expect(profile.stations.some(s=>s.name.includes('Anton-Wilhelm-Amo'))).toBe(true);
 expect(profile.stations.some(s=>s.name.includes('Campus für Demokratie'))).toBe(true);
 expect(profile.stations.some(s=>s.name==='Mohrenstraße')).toBe(false);
 expect(profile.stations.some(s=>s.name==='Französische Straße')).toBe(false);
 expect(profile.entries).toHaveLength(622);expect(profile.entries.filter(e=>e.stair)).toHaveLength(317);
 expect(profile.entries.filter(e=>e.stair?.mappedStepCount)).toHaveLength(280);
 expect(index.keys).toHaveLength(208);expect(index.entries.map(e=>e.id)).toEqual(profile.entries.map(e=>e.id));
 for(const e of profile.entries){expect(profile.stations.some(s=>s.id===e.station)).toBe(true);expect(index.keys).toContain(e.key);expect(Math.hypot(...e.axis)).toBeCloseTo(1,10);}
 expect(profile.entries.some(e=>['node/414950979','node/1947340026','node/1769645471','node/1223731363'].includes(e.id))).toBe(false);
 expect(profile.omitted.filter(e=>e.reason==='retained-authored')).toHaveLength(22);
 const evidence=readFileSync(new URL('../../../geo_data/regierungsviertel/ubahn-access-v326-source.json.gz',import.meta.url));expect(sha(evidence)).toBe(profile.evidenceSha256);
});

test('selection is exact/bounded/default closed; missing terrain and changed compiled source close',()=>{
 expect(createUbahnAccessV326({native:false,terrainAt:terrain})).toBeNull();
 expect(createUbahnAccessV326({native:false,keys:['unknown'],terrainAt:terrain})).toBeNull();
 expect(createUbahnAccessV326({native:false,sourceIds:[entry.id,entry.id],terrainAt:terrain})).toBeNull();
 expect(createUbahnAccessV326({native:false,keys:[entry.key],sourceIds:[entry.id],terrainAt:terrain})).toBeNull();
 expect(createUbahnAccessV326({native:false,sourceIds:[entry.id],terrainAt:()=>NaN})).toBeNull();
 const x=entry.point[0];try{entry.point[0]+=.001;expect(make()).toBeNull();}finally{entry.point[0]=x;}
 const root=make();expect(root).not.toBeNull();disposeUbahnAccessV326(root);
});

test('actual bounded Drawn/Native share source identity, sampled datum and full independent cardinal coverage',()=>{
 const before=JSON.stringify(profile);for(const native of[false,true]){const root=make(native);try{
  expect(root).not.toBeNull();expect(hasCompleteUbahnAccessV326(root,native)).toBe(true);expect(hasCompleteUbahnAccessV326(root,!native)).toBe(false);expect(root.children.length).toBeLessThanOrEqual(3);
  const openings=ubahnAccessOpeningsV326(root);expect(openings).toHaveLength(1);const o=openings[0];expect(o.surfaceY).toBe(7.25);expect(o.bottomY).toBeCloseTo(7.25-entry.stair!.descent,10);expect(o.sourcePoints).toEqual(entry.stair!.points);expect(o.ring).toEqual(entry.stair!.ring);expect(o.sourceWay).toBe(entry.stair!.sourceWay);
  if(native){expect(o.nativeCells!.length).toBeGreaterThan(0);for(const p of o.nativeCells!){expect(p[0]*4).toBeInteger();expect(p[1]*4).toBeInteger();}}
  for(const m of root.children as InstancedMesh[]){expect(m.userData.fullStaticDetailOnTouch).toBe(true);if(native){const a=m.instanceMatrix.array;for(let i=0;i<m.count;i++)for(const k of[1,2,4,6,8,9])expect(a[i*16+k]).toBe(0);}}
  expect(ubahnAccessGroundAtV326(root,100000,100000)).toBeNull();expect(ubahnAccessSolidAtV326(root,100000,7,100000)).toBe(false);
  const s=entry.stair!,a=s.points[0],b=s.points.at(-1)!,t=.45,p:[number,number]=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];expect(ubahnAccessGroundAtV326(root,...p)).not.toBeNull();expect(ubahnAccessSolidAtV326(root,p[0],7,p[1],.1)).toBe(false);
  const last:[number,number]=[a[0]+(b[0]-a[0])*.995,a[1]+(b[1]-a[1])*.995];if(!native)expect(ubahnAccessGroundAtV326(root,...last)).toBeCloseTo(o.bottomY,8);
 }finally{disposeUbahnAccessV326(root);}}expect(JSON.stringify(profile)).toBe(before);
});

test('normal final freeze, real interleave/parking, Day/Night/grade/Toon and qualified program retirement remain admitted',async()=>{
 const root=make(true);try{
  root.traverse(interleaveStaticGeometry);freezeStaticSceneTransforms(root);expect(hasCompleteUbahnAccessV326(root,true)).toBe(true);
  for(const mode of['nightMaterial','dayMaterial','schwellenraumMaterial']){for(const m of root.children as InstancedMesh[])m.material=m.userData[mode];expect(hasCompleteUbahnAccessV326(root,true)).toBe(true);}
  const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);expect(hasCompleteUbahnAccessV326(root,true)).toBe(true);restoreMinecraftMaterialPresentation(state);disposeMinecraftMaterialState(state);
  expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteUbahnAccessV326(root,true)).toBe(true);
  drain(parkStaticGeometrySteps(root,true));drain(parkStaticInstancesSteps(root));for(const m of root.children as InstancedMesh[])m.instanceMatrix.onUploadCallback();await new Promise(r=>setTimeout(r,1));expect(hasCompleteUbahnAccessV326(root,true)).toBe(true);
 }finally{disposeUbahnAccessV326(root);}expect(hasCompleteUbahnAccessV326(root,true)).toBe(false);
});

test('raw words, source metadata, pose, foreign material and ordinary authored disposal close private admission',()=>{
 const root=make(),m=root.children[0]as InstancedMesh;try{
  const v=m.instanceMatrix.array[0];m.instanceMatrix.array[0]=v+.01;expect(hasCompleteUbahnAccessV326(root)).toBe(false);expect(ubahnAccessOpeningsV326(root)).toHaveLength(0);m.instanceMatrix.array[0]=v;
  const x=entry.point[0];entry.point[0]+=.001;expect(hasCompleteUbahnAccessV326(root)).toBe(false);entry.point[0]=x;
  root.position.y=.01;expect(hasCompleteUbahnAccessV326(root)).toBe(false);root.position.y=0;
  const mat=m.material,foreign=new MeshBasicMaterial();m.material=foreign;expect(hasCompleteUbahnAccessV326(root)).toBe(false);m.material=mat;foreign.dispose();
  m.geometry.dispose();expect(hasCompleteUbahnAccessV326(root)).toBe(false);expect(hasCompleteUbahnAccessV326(new Group())).toBe(false);
 }finally{disposeUbahnAccessV326(root);}
 const second=make();(second.children[0]as InstancedMesh).userData.dayMaterial.dispose();expect(hasCompleteUbahnAccessV326(second)).toBe(false);disposeUbahnAccessV326(second);
});

test('cooperative cancellation removes only its new unattached family, preserving the existing scene',()=>{
 const old=new Group(),foreign=new Group();old.add(foreign);let partial:Group|undefined;
 const g=createUbahnAccessV326Steps({native:false,sourceIds:[entry.id],terrainAt:terrain},r=>{partial=r;old.add(r);});expect(g.next().done).toBe(false);g.return(null);expect(old.children).toEqual([foreign]);expect(partial!.children).toHaveLength(0);expect(hasCompleteUbahnAccessV326(partial!)).toBe(false);
});

test('real packet-key selection covers its complete bounded source set within unchanged geometry limits',()=>{
 const key='-6_2',ids=profile.entries.filter(e=>e.key===key).map(e=>e.id);
 expect(ids).toHaveLength(12);for(const native of[false,true]){const root=createUbahnAccessV326({native,keys:[key],terrainAt:terrain})!;try{
  expect(root).not.toBeNull();expect(root.userData.entranceIds).toEqual(ids);expect(hasCompleteUbahnAccessV326(root,native)).toBe(true);
  const bytes=(root.children as InstancedMesh[]).reduce((n,m)=>n+m.instanceMatrix.array.byteLength+m.instanceColor!.array.byteLength,0);expect(bytes).toBeLessThan(8*1024*1024);expect(root.children.length).toBeLessThanOrEqual(3);
  for(const o of ubahnAccessOpeningsV326(root)){expect(Object.isFrozen(o)).toBe(true);expect(Object.isFrozen(o.ring)).toBe(true);}
 }finally{disposeUbahnAccessV326(root);}}
});
