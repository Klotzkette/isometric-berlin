import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import data from '../src/data/kraftwerkBerlinV268.json';
import {prepareKraftwerkBerlinV268,applyKraftwerkBerlinV268Triangles,kraftwerkBerlinNavigationV268,KRAFTWERK_BERLIN_V268_KIND} from '../src/KraftwerkBerlinV268';
import type {SurroundingCityChunk} from '../src/SurroundingCityGeometry';
const complete=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const load=(native:boolean)=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/6_1.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
const decoded=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;

test('exact same-packet facade transaction retains old source objects and tolerates earlier added meshes',()=>{
 for(const native of [false,true]){
  const raw=load(native),extra={...raw.meshes[0],kind:'earlier-test-detail'};
  const before={...raw,meshes:[...raw.meshes,extra]};
  const p=complete(prepareKraftwerkBerlinV268(before,'6_1',native));
  expect(p).not.toBe(before);expect(p.meshes.at(-1)!.kind).toBe(KRAFTWERK_BERLIN_V268_KIND);
  for(let i=0;i<before.meshes.length;i++)expect(p.meshes[i]).toBe(before.meshes[i]);
  expect(p.nav).toBe(raw.nav);expect(p.lines).toBe(raw.lines);
  expect(complete(prepareKraftwerkBerlinV268(p,'6_1',native))).toBe(p);
  expect(complete(prepareKraftwerkBerlinV268(raw,'6_2',native))).toBe(raw);
  const changed={...raw,nav:{...raw.nav,groundY:4}};
  expect(complete(prepareKraftwerkBerlinV268(changed,'6_1',native))).toBe(changed);
  const bad={...raw,meshes:raw.meshes.map(m=>m.kind==='alt-mitte-v169'?{...m,colors:m.colors+'A'}:m)};
  expect(complete(prepareKraftwerkBerlinV268(bad,'6_1',native))).toBe(bad);
 }
});

test('source sheets and every triangle outside the exact old recipe survive',()=>{
 for(const native of [false,true]){
  const raw=load(native),prepared=complete(prepareKraftwerkBerlinV268(raw,'6_1',native));
  const r=data.packets[native?'minecraft:6_1':'drawn:6_1'];let total=0;
  for(const [mi,m]of raw.meshes.entries()){
   const old=new Uint32Array(decoded(m.indices)),actual=old.slice();
   expect(complete(applyKraftwerkBerlinV268Triangles(raw,mi,actual,0))).toBe(0);
   total+=complete(applyKraftwerkBerlinV268Triangles(prepared,mi,actual,0));
   const selected=new Set(r.records.filter(r=>r.mesh===mi).flatMap(r=>r.triangles));
   let unchanged=true,retired=true;
   for(let t=0;t<old.length/3;t++)if(selected.has(t))retired&&=actual[t*3]===actual[t*3+1]&&actual[t*3]===actual[t*3+2];
   else for(let j=0;j<3;j++)unchanged&&=actual[t*3+j]===old[t*3+j];
   expect(unchanged).toBe(true);expect(retired).toBe(true);
  }
  expect(total).toBe(native?5152:5216);
 }
});

test('both hollow full-height stacks append once, retaining every existing navigation owner and surface',()=>{
 for(const native of [false,true]){
  const raw=load(native),p=complete(prepareKraftwerkBerlinV268(raw,'6_1',native));
  const nav=kraftwerkBerlinNavigationV268(p,raw.nav);
  expect(nav.buildings.slice(0,-2)).toEqual(raw.nav.buildings);
  expect(nav.ground).toBe(raw.nav.ground);expect(nav.water).toBe(raw.nav.water);
  expect(nav.buildings.slice(-2).map(b=>[b.height,b.minHeight])).toEqual([[100,42],[100,42]]);
  expect(nav.buildings.slice(-2).map(b=>b.holes.length)).toEqual([1,1]);
  expect(kraftwerkBerlinNavigationV268(p,nav)).toBe(nav);
  expect(kraftwerkBerlinNavigationV268(raw,raw.nav)).toBe(raw.nav);
 }
});

test('production decoder preserves both open chimney mouths and solid rims alongside earlier preparations',async()=>{
 const {createSurroundingCityChunk,surroundingBuildingSolidAt,surroundingPolygonContains}=await import('../src/SurroundingCityGeometry');
 const {Mesh,LineSegments}=await import('three');
 for(const native of [false,true]){
  const raw=load(native),before=JSON.stringify(raw),result=createSurroundingCityChunk(raw,'6_1',native);
  expect(result.root.userData.sourceKinds).toContain(KRAFTWERK_BERLIN_V268_KIND);
  expect(result.root.userData.kraftwerkBerlinTransferredTrianglesV268).toBe(native?5152:5216);
  for(const m of raw.meshes)expect(result.root.userData.sourceKinds).toContain(m.kind);
  const stacks=result.nav.buildings.filter(b=>b.sourceId.startsWith('kraftwerk-v268-way/'));
  expect(stacks.length).toBe(2);
  for(const stack of stacks){
   expect(stack.holes.length).toBe(1);
   const mapped=data.profile.stacks.find(s=>`kraftwerk-v268-${s.id}`===stack.sourceId)!;
   const centre=[0,1].map(axis=>mapped.ring.reduce((sum,p)=>sum+p[axis],0)/mapped.ring.length-result.origin[axis===0?0:2]);
   expect(surroundingPolygonContains(stack,centre[0],centre[1])).toBe(false);
   // Real production collision must leave the flue open throughout its exposed
   // height, including a standing person's radius, with no invisible top deck.
   for(const y of [70,102.9,103])expect(surroundingBuildingSolidAt(result.nav,centre[0],y,centre[1],0.3)).toBe(false);
   const edge=[0,1].map(axis=>(stack.ring[0][axis]+stack.ring[1][axis])/2);
   const length=Math.hypot(centre[0]-edge[0],centre[1]-edge[1]);
   const wall=edge.map((v,axis)=>v+0.1*(centre[axis]-v)/length);
   expect(surroundingPolygonContains(stack,wall[0],wall[1])).toBe(true);
   for(const y of [70,102.9,103])expect(surroundingBuildingSolidAt(result.nav,wall[0],y,wall[1])).toBe(true);
  }
  expect(result.nav.buildings.filter(b=>b.sourceId===data.profile.owner)).toEqual(raw.nav.buildings.filter(b=>b.sourceId===data.profile.owner));
  expect(JSON.stringify(raw)).toBe(before);
  expect(result.geometryBytes).toBeLessThan(12*1024*1024);
  const materials=new Set<import('three').Material>();
  result.root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(m)materials.add(m);}});
  for(const m of materials)m.dispose();
 }
});
