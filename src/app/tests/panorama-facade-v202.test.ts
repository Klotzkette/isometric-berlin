import {test,expect} from 'bun:test';
import {gunzipSync} from 'node:zlib';
import receipt from '../src/data/panoramaFacadeV202.json';
import {replacePanoramaFacadeV202} from '../src/panoramaFacadeV202';
for(const record of receipt.records)test(`only exact prior Panorama triangles transfer: ${record.tile} ${record.mode}`, async()=>{
 const bytes=await Bun.file(new URL(`../public/mesh/surrounding-berlin-v159/${record.tile}.${record.mode}.json.gz`,import.meta.url)).arrayBuffer();
 expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(record.sha256);
 const payload=JSON.parse(gunzipSync(bytes).toString());
 const part=payload.meshes.find((p:any)=>p.kind===record.kind);
 const raw=Buffer.from(part.indices,'base64'), source=new Uint32Array(raw.buffer,raw.byteOffset,raw.byteLength/4);
 const indices=source.slice(), owned=new Set(record.triangles);
 const run=(id:string,p=part)=>{const g=replacePanoramaFacadeV202(id,record.mode==='minecraft',p,indices,0);let r=g.next();while(!r.done)r=g.next();return r.value;};
 expect(run('unrelated')).toBe(0);expect(indices).toEqual(source);
 expect(run(record.tile,{...part,colors:part.colors.slice(4)+part.colors.slice(0,4)})).toBe(0);expect(indices).toEqual(source);
 expect(run(record.tile)).toBe(record.triangles.length);
 for(let i=0;i<source.length;i+=3){
  expect(indices[i]).toBe(source[i]);
  expect(indices[i+1]).toBe(owned.has(i/3)?source[i]:source[i+1]);
  expect(indices[i+2]).toBe(owned.has(i/3)?source[i]:source[i+2]);
 }
});
