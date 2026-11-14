import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {transformLosslessJsonData} from '../losslessJsonData';
import {decodeLosslessGzipJson} from '../src/losslessGzipJson';

test('new airport constructor fields and one-packet terrain recipes use existing lazy lossless storage',()=>{
 let totalRaw=0,totalEncoded=0;
 for(const [name,fields] of [['airportExteriorsV345.json',['boxes','blocks']],['tempelhoferFieldV345.json',['plans']]] as const){
  const url=new URL(`../src/data/${name}`,import.meta.url),raw=readFileSync(url,'utf8'),expected=JSON.parse(raw);
  const transformed=transformLosslessJsonData(raw,url.pathname)!;expect(transformed).toBeDefined();
  totalRaw+=raw.length;totalEncoded+=transformed.code.length;
  for(const field of fields)expect(transformed.code).toContain(`get ["${field}"]`);
  // Evaluate the existing build transform with forced weak expiry. No browser
  // runtime fetch, alternate codec or metadata lifetime change is involved.
  let code=transformed.code.replace(/^import[^\n]+\n/,'').replace(/export \{[^}]*\};?\n/g,'');
  code=code.replace('export default','return');
  class ExpiredWeakRef {deref(){return undefined;}}
  const result=new Function('__decodeLosslessGzip','WeakRef',code)(decodeLosslessGzipJson,ExpiredWeakRef);
  expect(Object.keys(result)).toEqual(Object.keys(expected));
  for(const field of fields){const first=result[field];expect(first).toEqual(expected[field]);const next=result[field];expect(next).not.toBe(first);expect(next).toEqual(first);}
  if(name==='tempelhoferFieldV345.json'){
   expect(Object.getOwnPropertyDescriptor(result,'offsets')?.get).toBeUndefined();expect(result.offsets).toBe(result.offsets);
  }
 }
 expect(totalRaw-totalEncoded).toBeGreaterThan(800_000);
 console.log({airportFieldRaw:totalRaw,airportFieldEncoded:totalEncoded});
});
