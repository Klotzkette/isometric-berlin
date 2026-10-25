import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Box3,Mesh} from 'three';
import data from '../src/data/tachelesFrontsV270Profile.json';
import receipts from '../src/data/tachelesFrontsV270Receipts.json';
import {createTachelesFrontsV270} from '../src/TachelesFrontsV270';
import {isTachelesFrontSourceV270,createTachelesFrontColumnTesterV270,tachelesFrontSolidsV270} from '../src/TachelesFrontsV270Profile';
import {prepareTachelesFrontsV270,applyTachelesFrontsV270Triangles} from '../src/TachelesFrontsV270Receipts';
import {buildSurroundingCityChunk,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {disposeSurroundingCityRoot} from '../src/SurroundingCity';
import {createPedestrianEnvironment,createPedestrianState,stepPedestrian,PEDESTRIAN_WALK_SPEED_MPS} from '../src/pedestrianNavigation';
const actual=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));
const manifest=JSON.parse(readFileSync('public/mesh/surrounding-berlin-v159/manifest.json','utf8'));
const packet=(native=false):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync('public/mesh/surrounding-berlin-v159/'+manifest.chunks.find((d:{id:string})=>d.id==='2_-2')[native?'minecraft':'drawn'].url)).toString());
function finish<T>(g:Generator<void,T>):T{for(;;){const n=g.next();if(n.done)return n.value;}}
const decode=(s:string)=>{const b=Uint8Array.fromBase64(s);return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);};

test('only five exact source records and unique native owners yield; partial QA subsets work',()=>{
 expect(actual.buildings.filter(isTachelesFrontSourceV270).map((p:{id:string})=>p.id).sort()).toEqual(data.sites.map(s=>s.prism).sort());
 for(const s of data.sites){
  const c=s.columns[0] as [number,number,number,number,number];expect(c).toBeDefined();
  expect(isTachelesFrontSourceV270({...s.previousPrism,h_dm:151})).toBe(false);
  expect(createTachelesFrontColumnTesterV270([s.previousPrism],data.cellM)(...c)).toBe(true);
  expect(createTachelesFrontColumnTesterV270([...actual.buildings,s.previousPrism],data.cellM)(...c)).toBe(false);
  expect(createTachelesFrontColumnTesterV270(actual.buildings,data.cellM)(...c)).toBe(true);
  expect(createTachelesFrontColumnTesterV270(actual.buildings,data.cellM+1)(...c)).toBe(false);
  const x=c[0]*data.cellM*10,z=c[1]*data.cellM*10;
  expect(createTachelesFrontColumnTesterV270([...actual.buildings,{id:'changed-neighbour',ring:[[x,z],[x+40,z],[x+40,z+40],[x,z+40]]}],data.cellM)(...c)).toBe(false);
 }
 expect(isTachelesFrontSourceV270({id:'unrelated',get ring(){throw Error('unexpected');}})).toBe(false);
});

test('required full-mobile model keeps five complete heights in both modes',()=>{
 for(const native of [false,true]){
  const root=createTachelesFrontsV270(native);expect(root.children.length).toBe(5);expect(root.userData.fullStaticDetailOnTouch).toBe(true);root.updateMatrixWorld(true);let bytes=0;
  for(const child of root.children){const m=child as Mesh,s=data.sites.find(s=>s.key===m.userData.siteKey)!,b=new Box3().setFromObject(m);
   expect(b.min.y).toBeCloseTo(s.groundY,2);expect(Math.abs(b.max.y-s.topY)).toBeLessThan(.011);expect(m.matrixAutoUpdate).toBe(false);expect(m.geometry.getAttribute('uv')).toBeUndefined();
   for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;bytes+=m.geometry.index!.array.byteLength;
  }expect(bytes).toBeLessThan(1_600_000);disposeSurroundingCityRoot(root);
 }
});

test('exact source meshes/nav/lines retained until complete required replacement is ready',()=>{
 for(const native of [false,true]){
  const p=packet(native),snapshot=JSON.stringify(p);
  expect(finish(prepareTachelesFrontsV270(p,'2_-2',native))).toBe(p);
  const result=finish(prepareTachelesFrontsV270(p,'2_-2',native,true));expect(result).not.toBe(p);
  expect(result.meshes).toBe(p.meshes);expect(result.nav).toBe(p.nav);expect(result.lines).toBe(p.lines);expect(result.origin).toBe(p.origin);expect(JSON.stringify(p)).toBe(snapshot);
  expect(result.meshes.length).toBeLessThanOrEqual(16);expect(finish(prepareTachelesFrontsV270(result,'2_-2',native,true))).toBe(result);
  const rec=receipts.packets[native?'minecraft:2_-2':'drawn:2_-2'];let retired=0;
  p.meshes.forEach((m,mesh)=>{const src=decode(m.indices),dst=Uint32Array.from(src),selected=new Set(rec.records.filter(r=>r.mesh===mesh).flatMap(r=>r.triangles));retired+=finish(applyTachelesFrontsV270Triangles(result,mesh,dst,0));
   for(let i=0;i<src.length;i+=3)expect(Array.from(dst.subarray(i,i+3))).toEqual(selected.has(i/3)?[src[i],src[i],src[i]]:Array.from(src.subarray(i,i+3)));
  });expect(retired).toBe(native?6272:3788);
 }
});

test('changed receipts fail closed, unrelated additions accepted, cancellation never mutates source',()=>{
 for(const native of [false,true]){
  const p=packet(native),r=receipts.packets[native?'minecraft:2_-2':'drawn:2_-2'],index=r.records[0].mesh;
  for(const mutate of [(c:SurroundingCityChunk)=>{c.origin[0]++;},(c:SurroundingCityChunk)=>{c.meshes[index].positions='AAAA'+c.meshes[index].positions.slice(4);},(c:SurroundingCityChunk)=>{c.meshes.splice(index,1);}]){
   const c=structuredClone(p);mutate(c);expect(finish(prepareTachelesFrontsV270(c,'2_-2',native,true))).toBe(c);
  }
  const appended={...p,meshes:[...p.meshes,p.meshes[0]]};expect(finish(prepareTachelesFrontsV270(appended,'2_-2',native,true))).not.toBe(appended);
  const bad=structuredClone(receipts);bad.packets[native?'minecraft:2_-2':'drawn:2_-2'].records[0].triangles.push(-1);expect(finish(prepareTachelesFrontsV270(p,'2_-2',native,true,bad))).toBe(p);
  const snap=JSON.stringify(p),steps=prepareTachelesFrontsV270(p,'2_-2',native,true);expect(steps.next().done).toBe(false);steps.return(p);expect(JSON.stringify(p)).toBe(snap);
 }
});

test('production preparation respects ready flag and bounded mesh lifecycle',()=>{
 for(const native of [false,true]){
  const p=packet(native),old=finish(buildSurroundingCityChunk(p,'2_-2',native)),complete=finish(buildSurroundingCityChunk(p,'2_-2',native,false,{tachelesFrontsV270:true}));
  expect(old.root.userData.tachelesFrontTransferredTrianglesV270).toBeUndefined();expect(complete.root.userData.tachelesFrontTransferredTrianglesV270).toBe(native?6272:3788);
  expect(complete.root.children.length).toBe(old.root.children.length);expect(complete.nav).toEqual(old.nav);disposeSurroundingCityRoot(old.root);disposeSurroundingCityRoot(complete.root);
 }
});

test('street walking and roof heights remain stable across drawn/native/day switches',()=>{
 const ground=JSON.parse(readFileSync('public/mesh/regierungsviertel/ground-context.json','utf8'));
 const voxel=JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json','utf8'));
 const env=createPedestrianEnvironment({...voxel,...ground},{water:[]},null,actual,undefined,{replaceTachelesFrontPrisms:true});let native=false;env.visualMode=()=>native?'minecraft':'day';
 const routes=[{a:[1188,-757],b:[1222,-743]},{a:[1267,-730],b:[1295,-717]},{a:[1236.0,-759.9],b:[1252.3,-753.3]}];
 for(const mode of [false,true,false]){native=mode;for(const {a,b} of routes){
  const floor=env.groundAt(a[0],a[1])!,dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz);let state=createPedestrianState(env,{x:a[0],z:a[1],yaw:Math.atan2(dx,-dz),groundYHint:floor,preserveHorizontalPosition:true});
  for(let i=0;i<80;i++){const r=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},distance/(80*PEDESTRIAN_WALK_SPEED_MPS),env);expect(r.respawned).toBe(false);expect(r.state.jumpOffset).toBe(0);expect(Math.abs(r.state.groundY-state.groundY)).toBeLessThan(.35);state=r.state;}
  expect(Math.hypot(state.x-b[0],state.z-b[1])).toBeLessThan(.2);
 }
 const solids=tachelesFrontSolidsV270(native);for(const s of data.sites){const roof=s.roofTriangles[0],x=roof.reduce((a,p)=>a+p[0],0)/3,z=roof.reduce((a,p)=>a+p[2],0)/3;const solid=solids.find(p=>p.sourceId===s.prism)!;expect(solid.topAt(x,z)).not.toBeNull();}
 }
});
