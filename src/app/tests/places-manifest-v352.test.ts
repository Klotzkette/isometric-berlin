import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {validateSurroundingManifest,SURROUNDING_CITY_MAX_DESCRIPTORS,SURROUNDING_CITY_MAX_MANIFEST_BYTES,SURROUNDING_CITY_RESIDENT_BUDGET_BYTES,SURROUNDING_CITY_MAX_CHUNK_BYTES,SURROUNDING_CITY_PREFETCH_BYTES,SURROUNDING_CITY_MAX_FOOTPRINTS} from '../src/SurroundingCity';

test('seven finite V352 hosts extend the actual manifest with every prior descriptor and ground footprint intact',()=>{
 const path='src/app/public/mesh/surrounding-berlin-v159/manifest.json';
 const root=new URL('../../..',import.meta.url);
 const wire=readFileSync(new URL(path,root));
 const current=JSON.parse(wire.toString());
 const before=JSON.parse(execFileSync('git',['show',`69810478:${path}`],{cwd:root,maxBuffer:8*1024*1024}).toString());
 expect(before.chunks).toHaveLength(3080);
 expect(current.chunks).toHaveLength(3087);
 expect(validateSurroundingManifest(current)).toBe(current);
 expect(current.chunks.slice(0,3080)).toEqual(before.chunks);
 expect({...current,chunks:before.chunks}).toEqual(before);
 const added=current.chunks.slice(3080);
 expect(added.filter((c:any)=>c.id.startsWith('civic352-'))).toHaveLength(2);
 expect(added.filter((c:any)=>c.id.startsWith('gastronomy352-'))).toHaveLength(5);
 for(const descriptor of added)for(const mode of ['drawn','minecraft']){
  const asset=descriptor[mode];
  const bytes=readFileSync(new URL('src/app/public/mesh/surrounding-berlin-v159/'+asset.url,root));
  expect(bytes.length).toBe(asset.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
  expect(gunzipSync(bytes).length).toBe(asset.decodedBytes);
 }
 expect(wire.length).toBeLessThanOrEqual(SURROUNDING_CITY_MAX_MANIFEST_BYTES);
 expect(()=>validateSurroundingManifest({...current,chunks:[...current.chunks,{...added[0],id:'unbounded-extra'}]})).toThrow('Invalid surrounding-city manifest');
 expect(SURROUNDING_CITY_MAX_DESCRIPTORS).toBe(3087);
 expect(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES).toBe(24*1024*1024);
 expect(SURROUNDING_CITY_MAX_CHUNK_BYTES).toBe(12*1024*1024);
 expect(SURROUNDING_CITY_PREFETCH_BYTES).toBe(4*1024*1024);
 expect(SURROUNDING_CITY_MAX_FOOTPRINTS).toBe(2935);
});
