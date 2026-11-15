import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import index from '../src/data/sportsLeisureV352Index.json';
import {sportsLeisureSourceV352,SPORTS_LEISURE_KIND_V352} from '../src/SportsLeisureV352';
import {captureNeighbourhoodPacketV300} from '../src/NeighbourhoodPacketV300';
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const data=(file:string)=>readFileSync(new URL('../src/data/'+file,import.meta.url));
test('finite real lazy sources retain independent mode geometry and append only',()=>{
 let compressed=0;
 for(const item of index.sources){
  const bytes=data(item.file);compressed+=bytes.length;
  expect(item.keys).toHaveLength(2);
  expect(item.decodedBytes).toBe(gunzipSync(bytes).length);
  const source=sportsLeisureSourceV352(bytes,item.keys,item.decodedBytes);
  for(const key of item.keys){
   expect(Object.getOwnPropertyDescriptor(source.packets,key)?.get).toBeDefined();
   const plan=source.packets[key];
   expect(plan.retire).toHaveLength(0);expect(plan.append.kind).toBe(SPORTS_LEISURE_KIND_V352);
   expect(plan.records.length).toBeLessThan(16);
   const vertices=Buffer.from(plan.append.positions,'base64').length/6;
   const indices=new Uint32Array(Uint8Array.from(Buffer.from(plan.append.indices,'base64')).buffer);
   expect(vertices).toBeGreaterThan(0);expect(indices.length%3).toBe(0);
   expect(Math.max(...indices)).toBeLessThan(vertices);
   expect(Buffer.from(plan.append.colors,'base64').length).toBe(vertices*3);
  }
  expect(source.packets[item.keys[0]].append.positions).not.toBe(source.packets[item.keys[1]].append.positions);
 }
 expect(compressed).toBeLessThan(400_000);
});
test('actual original host admits raw guards and refuses stale navigation or another host',()=>{
 const item=index.sources[0],bytes=data(item.file),source=sportsLeisureSourceV352(bytes,item.keys,item.decodedBytes);
 const key=item.keys[0],[mode,id]=key.split(':');
 const dir='../public/mesh/surrounding-berlin-v159/';
 const manifest=JSON.parse(readFileSync(new URL(dir+'manifest.json',import.meta.url),'utf8'));
 const descriptor=manifest.chunks.find((c:any)=>c.id===id);
 const raw=JSON.parse(gunzipSync(readFileSync(new URL(dir+descriptor[mode].url,import.meta.url))).toString());
 expect(drain(captureNeighbourhoodPacketV300(raw,id,false,true,source,SPORTS_LEISURE_KIND_V352))).toBeDefined();
 expect(drain(captureNeighbourhoodPacketV300(raw,'unrelated',false,true,source,SPORTS_LEISURE_KIND_V352))).toBeUndefined();
 const stale=structuredClone(raw);stale.nav.groundY+=.1;
 expect(drain(captureNeighbourhoodPacketV300(stale,id,false,true,source,SPORTS_LEISURE_KIND_V352))).toBeUndefined();
});
test('bounded source rejects mismatched decoded size and foreign kinds before use',()=>{
 const item=index.sources[0],bytes=data(item.file);
 expect(()=>sportsLeisureSourceV352(bytes,item.keys,3_000_000)).toThrow();
 const source=sportsLeisureSourceV352(bytes,item.keys,item.decodedBytes+1);
 expect(()=>source.packets[item.keys[0]]).toThrow('decoded size');
 expect(()=>sportsLeisureSourceV352(bytes,[...item.keys,item.keys[0]],item.decodedBytes)).toThrow();
});
