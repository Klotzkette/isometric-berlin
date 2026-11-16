import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../../../..');
const previousCommit='4bb88fa3d836f0313407bbe0abeef32dca20f63e';
const digest=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
type Receipt={additions:Record<string,string>;changes:Record<string,{before:string;after:string}>};
const proof=readFileSync(new URL('../fixtures/source-history-v354.json',import.meta.url));
if (digest(proof) !== "bf3c2f7e84c5f3dd0a4010a62652996a3eece84e24aa08f88fed48e56278f327") throw Error('Changed immutable v354 source proof');
const receipt=JSON.parse(proof.toString()) as Receipt;
const predecessors=new Map<string,Buffer>();
const ancestors=new Map<string,Buffer[]>();
export function assertSourceLayerV354(previous:Readonly<Record<string,string>>,files:readonly string[]):void{
 for(const [path,{before,after}]of Object.entries(receipt.changes)){
  if(previous[path]!==before||before===after)throw Error('Unexpected v354 source change: '+path);
  const raw=execFileSync('git',['show',`${previousCommit}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
  if(digest(raw)!==before)throw Error('Changed v354 predecessor: '+path);predecessors.set(path,raw);
 }
 for(const [path,hash]of Object.entries(receipt.additions))if(Object.hasOwn(previous,path)||!files.includes(path)||digest(readFileSync(resolve(root,path)))!==hash)throw Error('Changed v354 addition: '+path);
 // Re-entered older normalizers may already carry these exact immutable v231/v232 bytes.
 for(const [v,pinned,commit]of [
  ['352','4bd6c3bd0e35c1228862712a8a8da78b052811b1754411264d714484187d3e52','69810478315fb30ab5ded23f8bde39c51cb1ca20'],
  ['353','3778ff7d0da25dbcf8ed329dd0bdb654fd388b89398aeb508f9c23be27e57dc3','68aafb0a'],
 ]){
  const bytes=readFileSync(new URL(`../fixtures/source-history-v${v}.json`,import.meta.url));if(digest(bytes)!==pinned)throw Error('Changed exact ancestor proof');
  const old=JSON.parse(bytes.toString()) as Receipt;
  for(const path of ['src/app/package.json','src/app/src/SourceQuarterCatalogueV309.ts']){
   const raw=execFileSync('git',['show',`${commit}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
   if(digest(raw)!==old.changes[path].before)throw Error('Changed normalized ancestor');
   ancestors.set(path,[...(ancestors.get(path)??[]),raw]);
  }
 }
}
export function isSourceAdditionV354(path:string):boolean{return Object.hasOwn(receipt.additions,path);}
export function sourceAtBeforeV354(path:string,raw:Uint8Array):Uint8Array{
 const row=receipt.changes[path];if(!row)return raw;const hash=digest(raw);
 if(hash===row.before||(ancestors.get(path)??[]).some(a=>a.equals(raw)))return raw;
 const old=predecessors.get(path);if(hash!==row.after||!old)throw Error('Unknown exact v354 source bytes: '+path);return old;
}
export function projectSourceBeforeV354(source:string):string{
 const hash=digest(source);const path=Object.keys(receipt.changes).find(p=>receipt.changes[p].after===hash);if(!path)return source;
 const old=predecessors.get(path);if(!old)throw Error('Unverified v354 predecessor: '+path);return old.toString();
}
