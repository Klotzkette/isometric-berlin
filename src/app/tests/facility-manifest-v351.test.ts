import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateSurroundingManifest,SURROUNDING_CITY_MAX_DESCRIPTORS,SURROUNDING_CITY_MAX_MANIFEST_BYTES,SURROUNDING_CITY_RESIDENT_BUDGET_BYTES,SURROUNDING_CITY_MAX_CHUNK_BYTES,SURROUNDING_CITY_PREFETCH_BYTES,SURROUNDING_CITY_MAX_FOOTPRINTS} from '../src/SurroundingCity';

test('all 42 exact facility additions pass the actual bounded manifest validator',()=>{
 const path='src/app/public/mesh/surrounding-berlin-v159/manifest.json';
 const root=new URL('../../..',import.meta.url);
 const wire=readFileSync(new URL(path,root));
 const current=JSON.parse(wire.toString());
 const before=JSON.parse(execFileSync('git',['show',`33941dd9:${path}`],{cwd:root,maxBuffer:8*1024*1024}).toString());
 expect(validateSurroundingManifest(current)).toBe(current);
 expect(before.chunks).toHaveLength(3038);
 expect(current.chunks).toHaveLength(3080);
 expect(current.chunks.slice(0,3038)).toEqual(before.chunks);
 expect({...current,chunks:before.chunks}).toEqual(before);
 const added=current.chunks.slice(3038);
 expect(added.filter((c:any)=>c.id.startsWith('fuel351-'))).toHaveLength(33);
 expect(added.filter((c:any)=>c.id.startsWith('mcdonalds351-'))).toHaveLength(9);
 expect(wire.length).toBeLessThanOrEqual(SURROUNDING_CITY_MAX_MANIFEST_BYTES);
 expect(()=>validateSurroundingManifest({...current,chunks:[...current.chunks,{...added[0],id:'unbounded-extra'}]})).toThrow('Invalid surrounding-city manifest');
 expect(SURROUNDING_CITY_MAX_DESCRIPTORS).toBe(3080);
 expect(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES).toBe(24*1024*1024);
 expect(SURROUNDING_CITY_MAX_CHUNK_BYTES).toBe(12*1024*1024);
 expect(SURROUNDING_CITY_PREFETCH_BYTES).toBe(4*1024*1024);
 expect(SURROUNDING_CITY_MAX_FOOTPRINTS).toBe(2935);
});
