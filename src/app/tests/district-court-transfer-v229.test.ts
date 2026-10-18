import { expect,test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import receipt from '../src/data/districtCourtsV229Ownership.json';
import { transferExactPacketTriangles,transferExactPacketLines } from '../src/exactPacketTransfer';
import { createProgressiveBuildingCoverage,hideReplacedBuildingPreview,restoreBuildingPreview } from '../src/progressiveBuildingCoverage';
import coreReceipt from '../src/data/districtCourtsV229CorePrevious.json';
import { staticGeometryAudit,disposeStaticAudit } from './helpers/staticGeometryAudit';
import type { PrismPayload,PrismBuilding } from '../src/IsometricCityWorld';
const path='../public/mesh/surrounding-berlin-v159/';
const manifest=JSON.parse(readFileSync(new URL(path+'manifest.json',import.meta.url),'utf8'));
const finish=(g:Generator<void,number>)=>{for(;;){const r=g.next();if(r.done)return r.value;}};
const hash=(a:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');

test('every packet transfer is exact, reversible, and safe across parked reloads',()=>{
 for(const record of receipt.records){
  const desc=manifest.chunks.find((r:any)=>r.id===record.tile);
  const bytes=readFileSync(new URL(path+desc[record.mode].url,import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(record.sha256);
  const packet=JSON.parse(gunzipSync(bytes).toString());const mesh=packet.meshes.find((m:any)=>m.kind===record.kind);
  const raw=Buffer.from(mesh.indices,'base64');const original=new Uint32Array(raw.buffer,raw.byteOffset,raw.byteLength/4).slice();
  const result=original.slice();const n=finish(transferExactPacketTriangles(receipt.records,record.tile,record.mode==='minecraft',mesh,result,0));
  expect(n).toBe(record.triangles.length);
  const retired=new Set(record.triangles);
  for(let t=0;t<original.length/3;t++)if(!retired.has(t))for(let j=0;j<3;j++)expect(result[t*3+j]).toBe(original[t*3+j]);
  const parked=new Uint32Array(result);finish(transferExactPacketTriangles(receipt.records,record.tile,record.mode==='minecraft',mesh,parked,0));
  expect(hash(parked)).toBe(hash(result));
  for(const t of retired)result.set(original.subarray(t*3,t*3+3),t*3);
  expect(hash(result)).toBe(hash(original));
  const changed=original.slice();expect(finish(transferExactPacketTriangles(receipt.records,record.tile,record.mode==='minecraft',{...mesh,colors:mesh.colors+'AA=='},changed,0))).toBe(0);expect(hash(changed)).toBe(hash(original));
 }
 for(const r of receipt.lineRecords){
  const desc=manifest.chunks.find((x:any)=>x.id===r.tile);const packet=JSON.parse(gunzipSync(readFileSync(new URL(path+desc.drawn.url,import.meta.url))).toString());
  const raw=Buffer.from(packet.lines.positions,'base64');const orig=new Uint16Array(raw.buffer,raw.byteOffset,raw.byteLength/2).slice(),next=orig.slice();
  expect(finish(transferExactPacketLines(receipt.lineRecords,r.tile,packet.lines,next,3))).toBe(r.segments.length);
  for(const i of r.segments)next.set(orig.subarray(i*6,i*6+6),i*6);
  expect(hash(next)).toBe(hash(orig));
 }
});

test('preview retirement and later restoration never resurrect the transferred courthouse prism',()=>{
 const prisms=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8')) as PrismPayload;
 const old=coreReceipt.owners[0].prism as PrismBuilding;
 const neighbour=prisms.buildings.find(p=>p.id==='30402049')!;
 const partition={omitted:[],remaining:[[old,neighbour]]} as any;
 const root=createProgressiveBuildingCoverage(prisms,partition,{includeLegacyDistrictCourtEnvelopes:false});
 const control=createProgressiveBuildingCoverage(prisms,{omitted:[],remaining:[[neighbour]]} as any);
 try{
  const before=staticGeometryAudit(root);expect(before).toEqual(staticGeometryAudit(control));
  hideReplacedBuildingPreview(root,'buildings-preview-1');restoreBuildingPreview(root,'buildings-preview-1');
  expect(staticGeometryAudit(root)).toEqual(before);
 }finally{disposeStaticAudit(root);disposeStaticAudit(control);}
});
