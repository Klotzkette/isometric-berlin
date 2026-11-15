import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fuelStationSourceV351} from '../src/FuelStationsV351';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import index from '../src/data/fuelStationsV351Index.json';
const drain=<T>(work:Generator<void,T>):T=>{for(;;){const n=work.next();if(n.done)return n.value;}};
const group=index.sources[0],bytes=new Uint8Array(readFileSync(new URL('../src/data/'+group.file,import.meta.url)));

describe('bounded source-backed fuel canopy repairs',()=>{
 test('all64 mode plans have source owners and independently retained raw/prepared guards',()=>{
  expect(index.sources.flatMap(g=>g.keys)).toHaveLength(64);
  for(const group of index.sources){
   const bytes=new Uint8Array(readFileSync(new URL('../src/data/'+group.file,import.meta.url))),source=fuelStationSourceV351(bytes,group.keys,group.decodedBytes);
   expect(group.keys.length).toBeLessThanOrEqual(16);
   for(const key of group.keys){const plan=source.packets[key];expect(plan.owners.length).toBeGreaterThan(0);expect(plan.records.length).toBeGreaterThan(0);expect(plan.preparedRecords.length).toBeLessThan(16);expect(plan.retireLines).toEqual([]);expect(plan.retireNav.length).toBeGreaterThan(0);expect(plan.append?.kind).toBe('fuel-stations-v351');}
  }
 });
 test('invalid compressed boundaries and substituted keys fail before a recipe is exposed',()=>{
  expect(()=>fuelStationSourceV351(bytes,group.keys,2*1024*1024+1)).toThrow();
  expect(()=>fuelStationSourceV351(bytes,[...group.keys,group.keys[0]],group.decodedBytes)).toThrow();
  const wrongSize=fuelStationSourceV351(bytes,group.keys,group.decodedBytes+1);
  expect(()=>wrongSize.packets[group.keys[0]]).toThrow();
  const changed=JSON.parse(gunzipSync(bytes).toString());changed.keys[0]='drawn:unrelated';const encoded=gzipSync(JSON.stringify(changed));
  const substituted=fuelStationSourceV351(encoded,group.keys,Buffer.byteLength(JSON.stringify(changed)));
  expect(()=>substituted.packets[group.keys[0]]).toThrow();
 });
 test('a changed old source cannot retire walls or replace navigation',()=>{
  const source=fuelStationSourceV351(bytes,group.keys,group.decodedBytes),key=group.keys[0],[mode,id]=key.split(':');
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('../public/mesh/surrounding-berlin-v159/'+id+'.'+mode+'.json.gz',import.meta.url))).toString());
  expect(drain(captureSourceQuarterPacketV303(raw,id,mode==='minecraft',true,source,'fuel-stations-v351'))).toBeDefined();
  const changed=structuredClone(raw);changed.nav.groundY+=.1;
  expect(drain(captureSourceQuarterPacketV303(changed,id,mode==='minecraft',true,source,'fuel-stations-v351'))).toBeUndefined();
  expect(drain(captureSourceQuarterPacketV303(raw,id,mode==='minecraft',false,source,'fuel-stations-v351'))).toBeUndefined();
 });
});
