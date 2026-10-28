import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import data from '../src/data/citywestTransportV281.json';
import streetCurves from '../src/data/streetCurvesV276.json';
import type {StreetCurvesSourceV276} from '../src/streetCurvesV276';
import {prepareCityWestTransportV281,applyCityWestTransportV281Triangles,applyCityWestTransportV281Lines,cityWestTransportNavigationV281,CITYWEST_TRANSPORT_V281_KIND,type CityWestSourceV281} from '../src/CityWestTransportV281';
import type {SurroundingCityChunk} from '../src/SurroundingCityGeometry';
const complete=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const load=(native:boolean)=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/outer187--13_2.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;

test('ZOB transfer retains previous encoded streams and every unrelated navigation record',()=>{
 for(const native of [false,true]){
  const raw=load(native),before=JSON.stringify(raw),prepared=complete(prepareCityWestTransportV281(raw,'outer187--13_2',native));
  expect(prepared).not.toBe(raw);expect(prepared.meshes.length).toBe(raw.meshes.length+1);
  expect(prepared.meshes.slice(0,-1)).toEqual(raw.meshes);expect(prepared.lines).toBe(raw.lines);expect(prepared.nav).toBe(raw.nav);
  expect(prepared.meshes.at(-1)?.kind).toBe(CITYWEST_TRANSPORT_V281_KIND);
  expect(complete(prepareCityWestTransportV281(prepared,'outer187--13_2',native))).toBe(prepared);
  const nav=cityWestTransportNavigationV281(prepared,raw.nav),owners=new Set(['OSM-way-693733275','OSM-way-671765756']);
  expect(nav.buildings.filter(b=>!owners.has(b.sourceId??''))).toEqual(raw.nav.buildings.filter(b=>!owners.has(b.sourceId??'')));
  expect(nav.roads).toBe(raw.nav.roads);expect(nav.ground).toBe(raw.nav.ground);
  const receipt=data.packets[native?'minecraft:outer187--13_2':'drawn:outer187--13_2'];
  expect(nav.buildings.filter(b=>owners.has(b.sourceId??''))).toEqual(receipt.buildings);
  expect({...nav,buildings:raw.nav.buildings}).toEqual(raw.nav);
  expect(JSON.stringify(raw)).toBe(before);
 }
});

test('only exactly receipted original triangles and roof ink retire',()=>{
 for(const native of [false,true]){
  const raw=load(native),prepared=complete(prepareCityWestTransportV281(raw,'outer187--13_2',native));
  const r=data.packets[native?'minecraft:outer187--13_2':'drawn:outer187--13_2'];
  for(const [m,p] of raw.meshes.entries()){
   const old=new Uint32Array(decode(p.indices)),indices=old.slice(),chosen=new Set(r.records.filter(r=>r.mesh===m).flatMap(r=>r.triangles));
   expect(complete(applyCityWestTransportV281Triangles(raw,m,indices,0))).toBe(0);
   expect(complete(applyCityWestTransportV281Triangles(prepared,m,indices,0))).toBe(chosen.size);
   for(let t=0;t<indices.length/3;t++){
    if(chosen.has(t)){expect(indices[t*3+1]).toBe(indices[t*3]);expect(indices[t*3+2]).toBe(indices[t*3]);}
    else expect(indices.subarray(t*3,t*3+3)).toEqual(old.subarray(t*3,t*3+3));
   }
  }
  if(raw.lines){
   const old=new Uint16Array(decode(raw.lines.positions)),values=old.slice(),chosen=new Set(r.segments);
   expect(complete(applyCityWestTransportV281Lines(prepared,values,3))).toBe(chosen.size);
   for(let s=0;s<values.length/6;s++)if(!chosen.has(s))expect(values.subarray(s*6,s*6+6)).toEqual(old.subarray(s*6,s*6+6));
  }
 }
});

test('modified sources, unauthorized owners, missing replacement and unknown cells fail closed',()=>{
 const raw=load(false),key='drawn:outer187--13_2',r=data.packets[key];
 expect(complete(prepareCityWestTransportV281(raw,'not-a-known-cell'))).toBe(raw);
 const moved={...raw,origin:[raw.origin[0]+.01,...raw.origin.slice(1)]};
 expect(complete(prepareCityWestTransportV281(moved,'outer187--13_2'))).toBe(moved);
 const changed={...raw,nav:{...raw.nav,groundY:3.1}};
 expect(complete(prepareCityWestTransportV281(changed,'outer187--13_2'))).toBe(changed);
 for(const replacement of [{...r,retiredOwners:['unrelated-building']},{...r,buildings:[]},{...r,replacementFingerprint:0}]){
  const source={schema:1,keys:[key],packets:{[key]:replacement}} as CityWestSourceV281;
  expect(complete(prepareCityWestTransportV281(raw,'outer187--13_2',false,source))).toBe(raw);
 }
});

test('real decoder installs complete CityWest detail with unchanged previous sources in both families',async()=>{
 const {createSurroundingCityChunk}=await import('../src/SurroundingCityGeometry');
 const {Mesh,LineSegments}=await import('three');
 const manifest=JSON.parse(readFileSync(new URL('../public/mesh/surrounding-berlin-v159/manifest.json',import.meta.url),'utf8'));
 for(const key of data.keys){
  const [family,id]=key.split(':'),native=family==='minecraft';
  const entry=manifest.chunks.find((c:{id:string})=>c.id===id);
  const raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${entry[family].url}`,import.meta.url))).toString()) as SurroundingCityChunk;
  const before=JSON.stringify(raw),result=createSurroundingCityChunk(raw,id,native);
  expect(result.root.userData.sourceKinds).toContain(CITYWEST_TRANSPORT_V281_KIND);
  for(const m of raw.meshes)expect(result.root.userData.sourceKinds).toContain(m.kind);
  if(id==='outer187--13_2'){
   expect(result.root.userData.cityWestTransferredTrianglesV281).toBe(native?782:164);
   if(!native)expect(result.root.userData.cityWestTransferredLineSegmentsV281).toBe(56);
   const receipt=data.packets[native?'minecraft:outer187--13_2':'drawn:outer187--13_2'],owners=new Set(receipt.retiredOwners);
   expect(result.nav.buildings.filter(b=>owners.has(b.sourceId))).toEqual(receipt.buildings);
   expect(result.nav.buildings.filter(b=>!owners.has(b.sourceId))).toEqual(raw.nav.buildings.filter(b=>!owners.has(b.sourceId)));
   const curve=native?undefined:(streetCurves as StreetCurvesSourceV276).chunks[id];
   expect(result.nav.roads).toEqual(curve?[...(raw.nav.roads??[]),...curve.roads]:raw.nav.roads);
   expect({...result.nav,buildings:raw.nav.buildings,roads:raw.nav.roads}).toEqual(raw.nav);
  }
  expect(JSON.stringify(raw)).toBe(before);expect(result.geometryBytes).toBeLessThan(12*1024*1024);
  const materials=new Set<any>();
  result.root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(m)materials.add(m);}});
  for(const m of materials)m.dispose();
 }
});
