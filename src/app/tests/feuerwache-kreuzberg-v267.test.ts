import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import data from '../src/data/feuerwacheKreuzbergV267.json';
import previous from '../src/data/feuerwacheKreuzbergV267PreviousProfiles.json';
import v185 from '../src/data/southKiezV185.json';
import v185native from '../src/data/southKiezV185Native.json';
import {prepareFeuerwacheKreuzbergV267,applyFeuerwacheKreuzbergV267Triangles,applyFeuerwacheKreuzbergV267Lines,feuerwacheKreuzbergNavigationV267,correctFeuerwacheProfilesV267,FEUERWACHE_KREUZBERG_V267_KIND} from '../src/FeuerwacheKreuzbergV267';
import type {SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import type {Material} from 'three';
const complete=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const load=(native:boolean)=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/7_4.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
const decoded=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;

test('complete same-packet replacement preserves every earlier stream and tolerates prior added meshes',()=>{
 for(const native of [false,true]){
  const raw=load(native),extra={...data.packets['drawn:7_4'].replacement,kind:'earlier-test-detail'};
  const before={...raw,meshes:[...raw.meshes,extra]};
  const prepared=complete(prepareFeuerwacheKreuzbergV267(before,'7_4',native));
  expect(prepared).not.toBe(before);expect(prepared.meshes.length).toBe(before.meshes.length+1);
  expect(prepared.meshes.slice(0,-1)).toEqual(before.meshes);expect(prepared.lines).toBe(before.lines);expect(prepared.nav).toBe(before.nav);
  expect(prepared.meshes.at(-1)!.kind).toBe(FEUERWACHE_KREUZBERG_V267_KIND);
  expect(complete(prepareFeuerwacheKreuzbergV267(prepared,'7_4',native))).toBe(prepared);
  const nav=feuerwacheKreuzbergNavigationV267(prepared,raw.nav);
  expect(nav.buildings.filter(b=>b.sourceId!==data.profile.owner)).toEqual(raw.nav.buildings.filter(b=>b.sourceId!==data.profile.owner));
  expect(nav.buildings.filter(b=>b.sourceId===data.profile.owner).length).toBeGreaterThan(1);
  expect(complete(prepareFeuerwacheKreuzbergV267(raw,'8_4',native))).toBe(raw);
  const changed={...raw,nav:{...raw.nav,groundY:raw.nav.groundY+.1}};
  expect(complete(prepareFeuerwacheKreuzbergV267(changed,'7_4',native))).toBe(changed);
  const changedMesh={...raw,meshes:raw.meshes.map((p,i)=>i===0?{...p,colors:p.colors+'A'}:p)};
  expect(complete(prepareFeuerwacheKreuzbergV267(changedMesh,'7_4',native))).toBe(changedMesh);
 }
});

test('only exact old triangle and ink indices yield after successful preparation',()=>{
 for(const native of [false,true]){
  const raw=load(native),prepared=complete(prepareFeuerwacheKreuzbergV267(raw,'7_4',native));
  const r=data.packets[native?'minecraft:7_4':'drawn:7_4'];let total=0;
  for(const [i,p] of raw.meshes.entries()){
   const original=new Uint32Array(decoded(p.indices)),indices=original.slice();
   expect(complete(applyFeuerwacheKreuzbergV267Triangles(raw,i,indices,0))).toBe(0);
   total+=complete(applyFeuerwacheKreuzbergV267Triangles(prepared,i,indices,0));
   const chosen=new Set(r.records.filter(r=>r.mesh===i).flatMap(r=>r.triangles));
   for(let t=0;t<indices.length/3;t++){
    if(chosen.has(t)){expect(indices[t*3+1]).toBe(indices[t*3]);expect(indices[t*3+2]).toBe(indices[t*3]);}
    else expect(indices.subarray(t*3,t*3+3)).toEqual(original.subarray(t*3,t*3+3));
   }
  }
  expect(total).toBe(native?376:337);
  if(raw.lines){
   const original=new Uint16Array(decoded(raw.lines.positions)),indices=original.slice();
   expect(complete(applyFeuerwacheKreuzbergV267Lines(raw,indices,3))).toBe(0);
   expect(complete(applyFeuerwacheKreuzbergV267Lines(prepared,indices,3))).toBe(r.segments.length);
   const chosen=new Set(r.segments);for(let i=0;i<indices.length/6;i++)if(!chosen.has(i))expect(indices.subarray(i*6,i*6+6)).toEqual(original.subarray(i*6,i*6+6));
  }
 }
});

test('only the exact upper v185 profile rows move; source and all complements remain intact',()=>{
 for(const native of [false,true]){
  const rows=native?v185native.nativeRows:v185.boxes;
  const corrected=correctFeuerwacheProfilesV267(rows,native),records=previous.records.filter(r=>r.native===native),chosen=new Set(records.map(r=>r.index));
  expect(corrected.length).toBe(rows.length);
  for(let i=0;i<rows.length;i++)if(!chosen.has(i))expect(corrected[i]).toEqual(rows[i]);
  for(const r of records){expect(rows[r.index]).toEqual(r.before);expect(corrected[r.index]).toEqual(r.after);}
  const changed=rows.map(r=>[...r]);changed[records[0].index][0]+=.01;
  expect(correctFeuerwacheProfilesV267(changed,native)).toBe(changed);
 }
});

test('production decoder retains older preparations and performs exact replacement in both families',async()=>{
 const {createSurroundingCityChunk}=await import('../src/SurroundingCityGeometry');
 const {Mesh,LineSegments}=await import('three');
 for(const native of [false,true]){
  const raw=load(native),original=JSON.stringify(raw);
  const result=createSurroundingCityChunk(raw,'7_4',native);
  expect(result.root.userData.sourceKinds).toContain(FEUERWACHE_KREUZBERG_V267_KIND);
  for(const m of raw.meshes)expect(result.root.userData.sourceKinds).toContain(m.kind);
  expect(result.root.userData.feuerwacheTransferredTrianglesV267).toBe(native?376:337);
  if(!native)expect(result.root.userData.feuerwacheTransferredLineSegmentsV267).toBe(113);
  expect(result.nav.buildings.filter(b=>b.sourceId===data.profile.owner).length).toBe(native?28:6);
  expect(JSON.stringify(raw)).toBe(original);
  expect(result.geometryBytes).toBeLessThan(12*1024*1024);
  const mats=new Set<Material>();
  result.root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(m)mats.add(m);}});
  for(const m of mats)m.dispose();
 }
});
