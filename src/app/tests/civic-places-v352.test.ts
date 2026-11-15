import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validNavigation} from '../src/SurroundingCityGeometry';
import {buildActualCivicChunkV352,captureCivicPredecessorsV352,disposeCivicChunkV352} from '../scripts/capture-civic-predecessors-v352';

const root=resolve(import.meta.dir,'../../..');
const read=(file:string)=>JSON.parse(gunzipSync(readFileSync(resolve(root,file))).toString());
const evidence=read('geo_data/regierungsviertel/civic-places-v352-evidence.json.gz');

test('all four finite industrial packets decode through the complete production builder',async()=>{
 let checked=0;
 for(const descriptor of evidence.descriptors)for(const mode of ['drawn','minecraft']){
  const asset=descriptor[mode],file=resolve(root,'src/app/public/mesh/surrounding-berlin-v159',asset.url);
  const bytes=readFileSync(file),packet=JSON.parse(gunzipSync(bytes).toString());
  expect(bytes.length).toBe(asset.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
  expect(validNavigation(packet.nav)).toBeTrue();
  const built=await buildActualCivicChunkV352(packet,descriptor.id,mode==='minecraft');
  expect(built.nav).toEqual(packet.nav);
  let triangles=0,meshes=0;
  built.root.traverse((object:any)=>{
   if(!object.geometry)return;
   const positions=object.geometry.getAttribute('position'),index=object.geometry.getIndex();
   expect(positions.count).toBeGreaterThan(0);expect(index.count).toBeGreaterThan(0);
   for(let i=0;i<positions.count;i++)for(const value of [positions.getX(i),positions.getY(i),positions.getZ(i)])expect(Number.isFinite(value)).toBeTrue();
   triangles+=index.count/3;meshes++;
  });
  const site=evidence.sites.find((s:any)=>descriptor.id==='civic352-'+s.id);
  expect(triangles).toBe(site.modes[mode].triangles);expect(meshes).toBe(1);
  expect(built.root.userData.sourceKinds).toContain('civic-places-v352');
  disposeCivicChunkV352(built);checked++;
 }
 expect(checked).toBe(4);
},60000);

test('all intersecting predecessor geometry words and navigation survive current production unchanged',async()=>{
 const retained=read('geo_data/regierungsviertel/civic-places-v352-predecessors.json.gz');
 const current=await captureCivicPredecessorsV352();
 expect(current).toEqual(retained);
 expect(current.records.length).toBe(6);
 expect(current.records.every(r=>r.triangleCount>0&&r.productionWordSha256.length===64)).toBeTrue();
},60000);
