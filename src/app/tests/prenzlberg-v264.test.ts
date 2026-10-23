import { expect,test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { InstancedMesh,Mesh,Matrix4 } from 'three';
import { createPrenzlbergV264 } from '../src/PrenzlbergV264';
import { createPrenzlbergEnvelopesV264 } from '../src/PrenzlbergEnvelopesV264';
import { prenzlbergV264GroundAt,prenzlbergV264SolidAt,prenzlbergV264RoofAt } from '../src/prenzlbergV264Navigation';
import { transferPrenzlbergNavigationV264 } from '../src/prenzlbergPacketNavigationV264';
import { transferExactPacketLines,transferExactPacketTriangles } from '../src/exactPacketTransfer';
import receipt from '../src/data/prenzlbergV264Ownership.json';
import nativeData from '../src/data/prenzlbergV264Native.json';
import drawnData from '../src/data/prenzlbergV264Envelopes.json';
import { disposeStaticAudit } from './helpers/staticGeometryAudit';
function complete<T>(g:Generator<void,T>):T {let r=g.next();while(!r.done)r=g.next();return r.value;}
function packet(mode:string){return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/7_-6.${mode}.json.gz`,import.meta.url))).toString());}

test('three independently bounded accents and one documented dome shell keep full mobile detail',()=>{
 for(const native of [false,true]) {
  let totalBytes=0,renderables=0;
  for(const [root,count] of [[createPrenzlbergV264(native),3],[createPrenzlbergEnvelopesV264(native),1]] as const)try{
   expect(root.children.length).toBe(count);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
   root.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);if(!(o instanceof Mesh))return;
    renderables++;expect(o.frustumCulled).toBe(true);expect(o.userData.siteKey).toBeTruthy();
    expect(o.userData.requiredBeforeNavigation).toBe(true);expect(o.geometry.getAttribute('uv')).toBeUndefined();
    for(const a of Object.values(o.geometry.attributes))totalBytes+=a.array.byteLength;
    if(o instanceof InstancedMesh){
     expect(o.instanceMatrix.array.length).toBe(o.count*16);totalBytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
     const m=new Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of [1,2,4,6,8,9])expect(Math.abs(m.elements[j])).toBeLessThan(1e-7);}
    }
   });
  }finally{disposeStaticAudit(root);}
  expect(renderables).toBe(4);expect(totalBytes).toBeLessThan(native?350000:600000);
 }
});

test('documented reconstruction has exact published buffers and curved-dome shading',()=>{
 const root=createPrenzlbergEnvelopesV264();try{
  const mesh=root.children[0] as Mesh,positions=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');let vertex=0;const tones=new Set<string>();
  for(const s of drawnData.sites[0].surfaces)for(const t of s.triangles){
   if(s.sourceKind==='ReconstructedDome')tones.add(colors.getX(vertex).toFixed(5));
   for(const p of t){expect([positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex)]).toEqual(p.map(Math.fround));vertex++;}
  }
  expect(vertex).toBe(2575*3);expect(root.userData.originalSourceSheetsRetained).toBe(true);expect(root.userData.originalSourceSheetsRendered).toBe(false);expect(tones.size).toBeGreaterThan(3);
 }finally{disposeStaticAudit(root);}
});

test('corrected drawn/native roofs support walking without upward teleport',()=>{
 const x=3895.4,z=-2594.85,roof=prenzlbergV264RoofAt(x,z)!;
 expect(roof).toBeGreaterThan(30);expect(prenzlbergV264GroundAt(x,z,3)).toBeNull();expect(prenzlbergV264GroundAt(x,z,roof)).toBeCloseTo(roof,5);
 expect(prenzlbergV264SolidAt(x,6,z)).toBe(true);expect(prenzlbergV264SolidAt(x+50,6,z)).toBe(false);
 for(const r of nativeData.sites[0].blocks.filter((_,i)=>i%71===0)){
  const x=r[0],z=r[2],top=Math.max(...nativeData.sites[0].blocks.filter(q=>Math.abs(q[0]-x)<=q[3]/2+.00001&&Math.abs(q[2]-z)<=q[5]/2+.00001).map(q=>q[1]+q[4]/2));
  expect(prenzlbergV264RoofAt(x,z,true)).toBeCloseTo(top,2);
 }
 expect(prenzlbergV264GroundAt(x,z,3,true)).toBeNull();expect(prenzlbergV264RoofAt(3880.2,-2595)).toBeCloseTo(8.4,5);expect(prenzlbergV264SolidAt(3880.2,14,-2595)).toBe(false);expect(prenzlbergV264RoofAt(0,0)).toBeNull();
});

test('two exact receipts preserve every unowned triangle, line and navigation row',()=>{
 const authorized=new Set(receipt.authorizedOwners);
 const groups=[...new Set(receipt.records.map(r=>`${r.tile}/${r.mode}/${r.kind}`))];
 for(const key of groups){
  const records=receipt.records.filter(r=>`${r.tile}/${r.mode}/${r.kind}`===key),r=records[0];
  const payload=packet(r.mode),part=payload.meshes.find((p:{kind:string})=>p.kind===r.kind),raw=Buffer.from(part.indices,'base64');
  const indices=new Uint32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),before=indices.slice(),removed=new Set(records.flatMap(r=>r.triangles));
  expect(complete(transferExactPacketTriangles(receipt.records,r.tile,r.mode==='minecraft',part,indices,0))).toBe(removed.size);
  for(let i=0;i<indices.length;i+=3)expect(Array.from(indices.slice(i,i+3))).toEqual(removed.has(i/3)?[before[i],before[i],before[i]]:Array.from(before.slice(i,i+3)));
  const changed=before.slice();expect(complete(transferExactPacketTriangles(receipt.records,r.tile,r.mode==='minecraft',{...part,colors:part.colors+'A'},changed,0))).toBe(0);expect(changed).toEqual(before);
  const filtered=transferPrenzlbergNavigationV264(r.tile,payload.nav);
  expect(filtered.buildings).toEqual(payload.nav.buildings.filter((b:{sourceId:string})=>!authorized.has(b.sourceId)));
  const altered={...payload.nav,buildings:payload.nav.buildings.map((b:{sourceId:string;height:number})=>authorized.has(b.sourceId)?{...b,height:b.height+.01}:b)};
  expect(transferPrenzlbergNavigationV264(r.tile,altered)).toBe(altered);
  // A changed main owner remains; the independently exact arc still transfers.
  const partiallyAltered={...payload.nav,buildings:payload.nav.buildings.map((b:{sourceId:string;height:number})=>b.sourceId==='DEBE03YY6000044a'?{...b,height:b.height+.01}:b)};
  expect(transferPrenzlbergNavigationV264(r.tile,partiallyAltered).buildings).toEqual(partiallyAltered.buildings.filter((b:{sourceId:string})=>b.sourceId!=='DEBE00YYMM000010'));
 }
 const lineGroups=[...new Set(receipt.lineRecords.map(r=>r.tile))];
 for(const tile of lineGroups){
  const records=receipt.lineRecords.filter(r=>r.tile===tile),lines=packet('drawn').lines,raw=Buffer.from(lines.positions,'base64'),values=new Uint16Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),old=values.slice(),removed=new Set(records.flatMap(r=>r.segments));
  expect(complete(transferExactPacketLines(receipt.lineRecords,tile,lines,values,3))).toBe(215);
  for(let i=0;i<values.length;i+=6)if(!removed.has(i/6))expect(Array.from(values.slice(i,i+6))).toEqual(Array.from(old.slice(i,i+6)));
 }
});
