import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {roteInselCorridorsSourceV354,ROTE_INSEL_CORRIDORS_KIND_V354} from '../src/RoteInselCorridorsV354';
import index from '../src/data/roteInselCorridorsV354Index.json';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {proveAllRoteInselCorridorsV354} from '../scripts/prove-rote-insel-corridors-v354';
const done=<T>(g:Generator<void,T>)=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const bytes=(f:string)=>new Uint8Array(readFileSync(new URL('../src/data/'+f,import.meta.url)));

test('actual decoder preserves every older word, unrelated index, material hook, navigation and wire outside receipted replacements in both modes',async()=>{
 const proof=await proveAllRoteInselCorridorsV354();expect(proof.length).toBe(18);
 for(const row of proof)expect(row).toMatchObject({valid:true});
},30000);

test('changed raw packet, missing replacement and stale bounded gzip close each whole transfer',()=>{
 for(const row of index.sources){
  const packed=bytes(row.file),source=roteInselCorridorsSourceV354(packed,row.keys,row.decodedBytes);
  for(const key of row.keys){
   const [mode,id]=key.split(':'),raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
   expect(done(captureSourceQuarterPacketV303(raw,id,mode==='minecraft',true,source,ROTE_INSEL_CORRIDORS_KIND_V354))).toBeDefined();
   const changed=structuredClone(raw);changed.origin[0]+=.01;
   expect(done(captureSourceQuarterPacketV303(changed,id,mode==='minecraft',true,source,ROTE_INSEL_CORRIDORS_KIND_V354))).toBeUndefined();
   const missing=JSON.parse(gunzipSync(packed).toString());delete missing.packets[key].append;
   expect(done(captureSourceQuarterPacketV303(raw,id,mode==='minecraft',true,missing,ROTE_INSEL_CORRIDORS_KIND_V354))).toBeUndefined();
   expect(()=>roteInselCorridorsSourceV354(packed,row.keys,row.decodedBytes+1).packets[key]).toThrow();
   const corrupt=JSON.parse(gunzipSync(packed).toString());corrupt.keys=['wrong'];const blob=gzipSync(JSON.stringify(corrupt));
   expect(()=>roteInselCorridorsSourceV354(blob,row.keys,Buffer.byteLength(JSON.stringify(corrupt))).packets[key]).toThrow();
  }
 }
});
