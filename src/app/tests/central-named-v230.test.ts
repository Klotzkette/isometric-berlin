import { expect,test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { InstancedMesh,Mesh,Matrix4 } from 'three';
import { createCentralNamedV230 } from '../src/CentralNamedV230';
import { createCentralNamedEnvelopesV230 } from '../src/CentralNamedEnvelopesV230';
import { centralNamedV230GroundAt,centralNamedV230SolidAt,centralNamedV230RoofAt } from '../src/centralNamedV230Navigation';
import { transferCentralNamedNavigationV230 } from '../src/centralNamedPacketNavigationV230';
import { transferExactPacketLines,transferExactPacketTriangles } from '../src/exactPacketTransfer';
import receipt from '../src/data/centralNamedV230Ownership.json';
import nativeData from '../src/data/centralNamedV230Native.json';
import drawnData from '../src/data/centralNamedV230Envelopes.json';
import { disposeStaticAudit } from './helpers/staticGeometryAudit';

function complete<T>(g:Generator<void,T>):T {let r=g.next();while(!r.done)r=g.next();return r.value;}

test('five complete static groups and water shell use exact-sized independently culled drawn/native buffers',()=>{
 for(const native of [false,true])for(const [root,count] of [[createCentralNamedV230(native),5],[createCentralNamedEnvelopesV230(native),1]] as const){
  try{
   expect(root.children.length).toBe(count);let instances=0,bytes=0;
   root.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);
    if(!(o instanceof Mesh))return;
    expect(o.frustumCulled).toBe(true);expect(o.userData.siteKey).toBeTruthy();
    expect(o.userData.requiredBeforeNavigation).toBe(true);expect(o.geometry.getAttribute('uv')).toBeUndefined();
    if(o instanceof InstancedMesh){
     expect(o.instanceMatrix.array.length).toBe(o.count*16);instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
     const m=new Matrix4();for(let i=0;i<o.count;i+=23){o.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of [1,2,4,6,8,9])expect(Math.abs(m.elements[j])).toBeLessThan(1e-7);}
    }
   });
   expect(instances).toBeLessThan(5200);expect(bytes).toBeLessThan(500000);
  }finally{disposeStaticAudit(root);}
 }
});

test('all water tower source positions survive and roof slope facing remains legible',()=>{
 const root=createCentralNamedEnvelopesV230();
 try{
  const mesh=root.children[0] as Mesh,positions=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');let vertex=0;const tones=new Set<string>();
  for(const s of drawnData.sites[0].surfaces)for(const t of s.triangles){
   if(s.sourceKind==='RoofSurface')tones.add(colors.getX(vertex).toFixed(5));
   for(const p of t){expect([positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex)]).toEqual(p.map(Math.fround));vertex++;}
  }
  expect(tones.size).toBeGreaterThan(2);
 }finally{disposeStaticAudit(root);}
});

test('roof collision follows the actual slope, never teleports walkers upward, and matches native cells',()=>{
 const x=3236.36,z=-1629.52;const roof=centralNamedV230RoofAt(x,z)!;
 expect(roof).toBeGreaterThan(42);expect(centralNamedV230RoofAt(x+10,z)!).toBeLessThan(roof-4);
 expect(centralNamedV230GroundAt(x,z,3)).toBeNull();expect(centralNamedV230GroundAt(x,z,roof)).toBeCloseTo(roof,5);
 expect(centralNamedV230SolidAt(x,6,z)).toBe(true);expect(centralNamedV230SolidAt(x+30,6,z)).toBe(false);
 for(const r of nativeData.sites[0].blocks.filter((_,i)=>i%31===0)){
  const x=r[0],z=r[2];const top=Math.max(...nativeData.sites[0].blocks.filter(q=>Math.abs(q[0]-x)<=q[3]/2+.00001&&Math.abs(q[2]-z)<=q[5]/2+.00001).map(q=>q[1]+q[4]/2));
  expect(centralNamedV230RoofAt(x,z,true)).toBeCloseTo(top,2);
 }
 expect(centralNamedV230GroundAt(x,z,3,true)).toBeNull();expect(centralNamedV230RoofAt(0,0)).toBeNull();
});

test('exact packet ownership retains every unrelated triangle and line; changed packets fail open',()=>{
 for(const r of receipt.records){
  const filename=`${r.tile}.${r.mode}.json.gz`;
  const payload=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${filename}`,import.meta.url))).toString());
  const part=payload.meshes.find((p:{kind:string})=>p.kind===r.kind);
  const raw=Buffer.from(part.indices,'base64');const indices=new Uint32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  const before=indices.slice();const removed=new Set(r.triangles);
  expect(complete(transferExactPacketTriangles(receipt.records,r.tile,r.mode==='minecraft',part,indices,0))).toBe(r.triangles.length);
  for(let i=0;i<indices.length;i+=3){if(removed.has(i/3))expect([indices[i],indices[i+1],indices[i+2]]).toEqual([before[i],before[i],before[i]]);else expect(Array.from(indices.slice(i,i+3))).toEqual(Array.from(before.slice(i,i+3)));}
  const changed=before.slice();expect(complete(transferExactPacketTriangles(receipt.records,r.tile,r.mode==='minecraft',{...part,colors:part.colors+'A'},changed,0))).toBe(0);expect(changed).toEqual(before);
  const filtered=transferCentralNamedNavigationV230(r.tile,payload.nav);expect(filtered.buildings.length).toBe(payload.nav.buildings.length-1);
  const row=payload.nav.buildings.find((b:{sourceId:string})=>b.sourceId==='DEBE03YY600002e7');const altered={...payload.nav,buildings:payload.nav.buildings.map((b:unknown)=>b===row?{...row,height:row.height+.01}:b)};
  expect(transferCentralNamedNavigationV230(r.tile,altered)).toBe(altered);
 }
 for(const r of receipt.lineRecords){
  const payload=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${r.tile}.drawn.json.gz`,import.meta.url))).toString());const raw=Buffer.from(payload.lines.positions,'base64');
  const values=new Uint16Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),old=values.slice();const removed=new Set(r.segments);
  expect(complete(transferExactPacketLines(receipt.lineRecords,r.tile,payload.lines,values,3))).toBe(r.segments.length);
  for(let i=0;i<values.length;i+=6)if(!removed.has(i/6))expect(Array.from(values.slice(i,i+6))).toEqual(Array.from(old.slice(i,i+6)));
 }
});
