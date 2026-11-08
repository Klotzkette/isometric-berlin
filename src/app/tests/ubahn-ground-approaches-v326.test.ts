import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {Mesh} from 'three';
import index from '../src/data/ubahnGroundApproachesV326Index.json';
import source from '../src/data/ubahnAccessV326.json';
import {hasUbahnGroundApproachSourceV326,ubahnGroundApproachAtV326} from '../src/UbahnGroundApproachesV326';
import {buildSurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {attachPacketUbahnAccessV326Steps} from '../src/UbahnGroundRuntimeV326';
import {disposeSurroundingCityRoot} from '../src/disposeSurroundingCityRootV323';

const drain=<T>(g:Generator<void,T>):T=>{let n=g.next();while(!n.done)n=g.next();return n.value;};
const bytes=(meshes:Mesh[])=>{const h=createHash('sha256');for(const m of meshes)for(const a of[m.geometry.getAttribute('position'),m.geometry.index])if(a){const storage='data'in a?a.data:a;h.update(new Uint8Array(storage.array.buffer,storage.array.byteOffset,storage.array.byteLength));}return h.digest('hex');};
const ranked=index.chunks.map(c=>({c,n:index.entries.filter(e=>e.drawnPoint&&e.hasSourceStair&&e.key===c.id.replace('ubahnApproach326-','')).length})).sort((a,b)=>b.n-a.n);

test('real original ordinary packet → actual DGM getter → private access runtime, both families/full/touch',()=>{
 const desc=ranked[0].c;expect(ranked[0].n).toBeGreaterThan(1);
 for(const native of[false,true])for(const mobileLike of[false,true]){
  const file=join(import.meta.dir,'../public/mesh/surrounding-berlin-v159',desc[native?'minecraft':'drawn'].url);
  const packet=JSON.parse(gunzipSync(readFileSync(file)).toString());
  const entry=drain(buildSurroundingCityChunk(packet,desc.id,native,mobileLike));
  const hosts=entry.root.children.filter((o):o is Mesh=>o instanceof Mesh),before=bytes(hosts),oldNav=JSON.stringify(entry.nav);
  const key=desc.id.replace('ubahnApproach326-','');
  const ids=index.entries.filter(e=>e.key===key&&(native?e.nativePoint:e.drawnPoint)).map(e=>e.id);
  const pure=hasUbahnGroundApproachSourceV326(desc.id,native,desc[native?'minecraft':'drawn']);expect(pure).toBe(true);
  const live=drain(attachPacketUbahnAccessV326Steps(entry,native,(x,z)=>ubahnGroundApproachAtV326(x,z,native),pure));
  expect(live).not.toBeNull();expect(live!.complete()).toBe(true);expect(live!.openingIds.length).toBeGreaterThan(0);
  expect(live!.geometryBytes).toBeGreaterThan(0);expect(live!.geometryBytes).toBeLessThan(2_000_000);expect(live!.bufferCount).toBeGreaterThan(0);
  for(const id of ids){const e=source.entries.find(e=>e.id===id)!;expect(ubahnGroundApproachAtV326(...e.point as[number,number],native)).not.toBeNull();}
  expect(bytes(hosts)).toBe(before);expect(JSON.stringify(entry.nav)).toBe(oldNav);
  live!.dispose();live!.dispose();expect(live!.complete()).toBe(false);expect(bytes(hosts)).toBe(before);
  expect(hosts.every(m=>!m.geometry.getAttribute('ubahnGroundEligibleV326'))).toBe(true);
  disposeSurroundingCityRoot(entry.root);
 }
});

test('pure-ground authority requires all five own descriptor words and the exact private source identity',()=>{
 const d=index.chunks[0];
 for(const native of[false,true]){
  const asset=d[native?'minecraft':'drawn'];expect(hasUbahnGroundApproachSourceV326(d.id,native,asset)).toBe(true);
  for(const key of['url','sha256','bytes','decodedBytes','encoding']as const){const changed={...asset,[key]:typeof asset[key]==='number'?Number(asset[key])+1:String(asset[key])+'x'};expect(hasUbahnGroundApproachSourceV326(d.id,native,changed)).toBe(false);const partial={...asset}as Record<string,unknown>;delete partial[key];expect(hasUbahnGroundApproachSourceV326(d.id,native,partial)).toBe(false);}
  expect(hasUbahnGroundApproachSourceV326(d.id,!native,asset)).toBe(false);expect(hasUbahnGroundApproachSourceV326('ubahnApproach326-fake',native,asset)).toBe(false);
  expect(hasUbahnGroundApproachSourceV326(d.id,native,Object.create(asset))).toBe(false);
  const accessor={...asset};Object.defineProperty(accessor,'url',{get(){throw Error('Accessor must not be evaluated');}});expect(hasUbahnGroundApproachSourceV326(d.id,native,accessor)).toBe(false);
 }
});

test('finite source ground does not supply paper, old Core or closed external station bodies',()=>{
 expect(ubahnGroundApproachAtV326(0,0)).toBeNull();expect(ubahnGroundApproachAtV326(1e6,1e6,true)).toBeNull();
 const blocked=index.entries.filter(e=>!e.drawnPoint);expect(blocked.length).toBeGreaterThan(0);
 for(const row of blocked){const e=source.entries.find(e=>e.id===row.id)!;expect(ubahnGroundApproachAtV326(...e.point as[number,number])).toBeNull();}
 expect(index.entries.length).toBe(148);expect(index.entries.every(e=>!!e.reason)).toBe(true);
});
