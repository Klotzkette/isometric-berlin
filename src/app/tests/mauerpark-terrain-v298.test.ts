import { describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BufferGeometry, Raycaster, Vector3, type Mesh } from "three";
import data from "../src/data/mauerparkTerrainV298.json";
import { prepareMauerparkTerrainV298, applyMauerparkTerrainTrianglesV298, applyMauerparkTerrainLinesV298, mauerparkTerrainAdmittedV298, mauerparkTerrainExtraLineVerticesV298, type MauerparkTerrainEvidenceV298 } from "../src/MauerparkTerrainV298Packets";
import { prepareNordMauerparkV266 } from "../src/NordMauerparkV266";
import { prepareRoofHouseV233 } from "../src/roofHouseV233";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareCityStreetsV249 } from "../src/CityStreetsV249";
import { prepareStreetCurvesV276, applyStreetCurveLinesV276, streetCurveExtraLineVerticesV276 } from "../src/streetCurvesV276";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { wallGalleryHillDeltaV298 } from "../src/wallGalleryV298Profile";
const source=data as unknown as MauerparkTerrainEvidenceV298;
const root=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const finish=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const u16=(s:string)=>{const b=Uint8Array.fromBase64(s);return new Uint16Array(b.buffer,b.byteOffset,b.byteLength/2);};
const u32=(s:string)=>{const b=Uint8Array.fromBase64(s);return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);};
function raw(id:string,native=false):SurroundingCityChunk{const d=manifest.chunks.find((p:{id:string})=>p.id===id);return JSON.parse(gunzipSync(readFileSync(new URL(d[native?"minecraft":"drawn"].url,root))).toString());}
function packet(id:string,native=false):SurroundingCityChunk{let p=raw(id,native);for(const f of[prepareNordMauerparkV266,prepareRoofHouseV233,prepareHouseDoorsV233,prepareCityStreetsV249,prepareStreetCurvesV276])p=finish(f(p,id,native));return p;}
const all=Object.entries(source.packets).flatMap(([id,modes])=>[false,true].filter(native=>modes[native?"minecraft":"drawn"]).map(native=>({id,native,plan:modes[native?"minecraft":"drawn"]!})));

describe("finite receipted Mauerpark ground, bodies and ink",()=>{
 test("foreign tiles never touch the weak compressed evidence graph",()=>{
  const chunk=new Proxy({}as SurroundingCityChunk,{get(){throw Error('unexpected source read');}});
  const evidence=new Proxy({}as MauerparkTerrainEvidenceV298,{get(){throw Error('unexpected compressed evidence read');}});
  for(const native of[false,true])for(const id of['unknown','3_-4','5_-5','03_-6','3_-6-extra','../3_-6','__proto__','']){
   const g=prepareMauerparkTerrainV298(chunk,id,native,true,evidence),first=g.next();expect(first.done).toBe(true);expect(first.value).toBe(chunk);
  }
 });
 test("all eight preparations preserve sources and admit once across shallow copies",()=>{
  expect(all).toHaveLength(8);
  for(const{id,native,plan}of all){const p=packet(id,native),snapshot=JSON.stringify(p),n=finish(prepareMauerparkTerrainV298(p,id,native,true));
   expect(n!==p).toBe(true);expect(mauerparkTerrainAdmittedV298(n)).toBe(true);expect(n.lines).toBe(p.lines);expect(n.origin).toBe(p.origin);
   p.meshes.forEach((m,i)=>expect(n.meshes[i]).toBe(m));expect(n.meshes).toHaveLength(p.meshes.length+plan.parts.length);
   expect(JSON.stringify(p)).toBe(snapshot);expect(finish(prepareMauerparkTerrainV298(n,id,native,true))).toBe(n);
   const copy={...n};expect(mauerparkTerrainAdmittedV298(copy)).toBe(true);expect(finish(prepareMauerparkTerrainV298(copy,id,native,true))).toBe(copy);
   expect(finish(prepareMauerparkTerrainV298(copy,id,native,false))).toBe(p);expect(mauerparkTerrainAdmittedV298(JSON.parse(JSON.stringify(n)))).toBe(false);
   for(let i=0;i<p.nav.buildings.length;i++){const a=p.nav.buildings[i],b=n.nav.buildings[i];expect(b.ring).toBe(a.ring);expect(b.holes).toBe(a.holes);expect(b.height).toBe(a.height);expect(b.minHeight).toBe(a.minHeight);expect(b.groundOffset??0).toBeCloseTo((a.groundOffset??0)+plan.navOffsets[i],9);}
  }
 });
 test("unknown/default-off/source changes and malformed/capacity plans fail closed",()=>{
  const opaque=new Proxy({}as SurroundingCityChunk,{get(){throw Error('unexpected source read');}});expect(finish(prepareMauerparkTerrainV298(opaque,'unknown',false,true))).toBe(opaque);
  const id='4_-5';for(const mutate of[
   (p:SurroundingCityChunk)=>{p.meshes[0].colors='AAAA'+p.meshes[0].colors.slice(4);},
   (p:SurroundingCityChunk)=>{p.nav.roads![0].ring[0][0]+=.01;},
   (p:SurroundingCityChunk)=>{p.lines!.positions='AAAA'+p.lines!.positions.slice(4);},
   (p:SurroundingCityChunk)=>{p.nav.groundY+=.01;},
   (p:SurroundingCityChunk)=>{p.origin[0]+=.01;},
   (p:SurroundingCityChunk)=>{p.meshes.push(p.meshes[0]);},
  ]){const p=packet(id);mutate(p);const snapshot=JSON.stringify(p);expect(finish(prepareMauerparkTerrainV298(p,id,false,true))===p).toBe(true);expect(JSON.stringify(p)).toBe(snapshot);}
  for(const mutate of[
   (e:MauerparkTerrainEvidenceV298)=>{e.packets[id].drawn!.parts[0].remove.push(-1);},
   (e:MauerparkTerrainEvidenceV298)=>{e.packets[id].drawn!.parts[0].appendFingerprint++;},
   (e:MauerparkTerrainEvidenceV298)=>{e.packets[id].drawn!.lines!.sourceFingerprint++;},
   (e:MauerparkTerrainEvidenceV298)=>{e.packets[id].drawn!.lines!.records[0][1]++;},
   (e:MauerparkTerrainEvidenceV298)=>{e.packets[id].drawn!.lines!.curveVertices=400002;},
   (e:MauerparkTerrainEvidenceV298)=>{e.packets[id].drawn!.navOffsets[0]=NaN;},
  ]){const e=structuredClone(source),p=packet(id);mutate(e);expect(finish(prepareMauerparkTerrainV298(p,id,false,true,e))).toBe(p);}
  const p=packet(id);expect(finish(prepareMauerparkTerrainV298(p,id))).toBe(p);
 });
 test("triangle transfers change only exact destination indices and cancellation never mutates input",()=>{
  for(const{id,native,plan}of all){const p=packet(id,native),n=finish(prepareMauerparkTerrainV298(p,id,native,true));let checkpoints=0;const cancelled=prepareMauerparkTerrainV298(p,id,native,true);expect(cancelled.next().done).toBe(false);cancelled.return(p);expect(mauerparkTerrainAdmittedV298(p)).toBe(false);
   for(const part of plan.parts){const old=u32(p.meshes[part.mesh].indices),dst=new Uint32Array(old.length+6);dst.set([123,123,123]);dst.set(old,3);dst.set([456,456,456],old.length+3);const g=applyMauerparkTerrainTrianglesV298({...n},part.mesh,dst,3);for(;;){const r=g.next();if(r.done){expect(r.value).toBe(part.remove.length);break;}checkpoints++;}
    const selected=new Set(part.remove);for(let i=0;i<old.length;i++)expect(dst[i+3]).toBe(selected.has(Math.floor(i/3))&&i%3!==0?old[i-i%3]:old[i]);expect(dst[0]).toBe(123);expect(dst.at(-1)).toBe(456);
   }expect(checkpoints).toBeLessThan(1000);
  }
 });
 test("late ink keeps outside segments/colors and never resurrects earlier retired ink",()=>{
  for(const{id,native,plan}of all){if(native)continue;const p=packet(id),n=finish(prepareMauerparkTerrainV298(p,id,false,true)),ink=plan.lines!,old=u16(p.lines!.positions),colors=Uint8Array.fromBase64(p.lines!.colors!);const start=ink.sourceVertices+streetCurveExtraLineVerticesV276(n),extra=mauerparkTerrainExtraLineVerticesV298(n),values=new Uint16Array((start+extra)*6);
   for(let i=0;i<ink.sourceVertices;i++)for(let a=0;a<3;a++){values[i*6+a]=old[i*3+a];values[i*6+3+a]=colors[i*3+a]*257;}
   finish(applyStreetCurveLinesV276(n,values.subarray(0,start*6),6,ink.sourceVertices));
   const first=ink.records[0];if(first){const at=first[0]*12;for(let a=0;a<3;a++)values[at+6+a]=values[at+a];}
   const before=values.slice();expect(finish(applyMauerparkTerrainLinesV298({...n},values,6,start))).toBe(ink.records.length);const selected=new Set(ink.records.map(r=>r[0]));
   for(let segment=0;segment<start/2;segment++)for(let a=0;a<3;a++){const at=segment*12;expect(values[at+a]).toBe(before[at+a]);expect(values[at+6+a]).toBe(selected.has(segment)?before[at+a]:before[at+6+a]);expect(values[at+3+a]).toBe(before[at+3+a]);expect(values[at+9+a]).toBe(before[at+9+a]);}
   if(first)for(let segment=first[1];segment<first[1]+first[2];segment++)for(let a=0;a<3;a++)expect(values[(start+segment*2)*6+a]).toBe(values[(start+segment*2+1)*6+a]);
   expect(start+extra).toBeLessThanOrEqual(400000);expect(()=>finish(applyMauerparkTerrainLinesV298(n,new Uint16Array(12),6,start))).toThrow();
  }
 });
 test("changed triangle receipts cannot revive any source already retired by earlier production helpers",()=>{
  for(const{id,native,plan}of all){
   const original=createSurroundingCityChunk(raw(id,native),id,native,{wallGalleryV298:false});
   try{
    const mesh=original.root.children.find(o=>(o as Mesh).geometry?.index)as Mesh,indices=mesh.geometry.index!.array;
    const prepared=packet(id,native),offsets:number[]=[];let offset=0;
    for(const m of prepared.meshes){offsets.push(offset);offset+=u32(m.indices).length;}
    for(const part of plan.parts)for(const triangle of part.remove){const at=offsets[part.mesh]+triangle*3;expect(indices[at]!==indices[at+1]||indices[at]!==indices[at+2]).toBe(true);}
   }finally{disposeSurroundingCityRoot(original.root);}
  }
 });
 test("actual production decoder admits all eight pairs and ground rays match physical sampling",()=>{
  let checks=0,maxError=0;
  for(const{id,native,plan}of all){const p=raw(id,native),snapshot=JSON.stringify(p),r=createSurroundingCityChunk(p,id,native,{wallGalleryV298:true});
   try{expect(r.root.userData.mauerparkTerrainV298).toBe(true);expect(JSON.stringify(p)).toBe(snapshot);r.root.updateMatrixWorld(true);const mesh=r.root.children.find(o=>(o as Mesh).geometry?.index)as Mesh;expect(mesh).toBeDefined();let sampled=0;
    for(const part of plan.parts){const points=u16(part.append.positions),indices=u32(part.append.indices);for(let i=0;i<indices.length&&sampled<24;i+=Math.max(3,Math.floor(indices.length/150/3)*3)){
      const vs=[0,1,2].map(j=>[0,1,2].map(a=>points[indices[i+j]*3+a]/100+r.origin[a]));const cross=(vs[1][0]-vs[0][0])*(vs[2][2]-vs[0][2])-(vs[1][2]-vs[0][2])*(vs[2][0]-vs[0][0]);if(Math.abs(cross)<.03)continue;
      const x=vs.reduce((n,v)=>n+v[0],0)/3,z=vs.reduce((n,v)=>n+v[2],0)/3,y=vs.reduce((n,v)=>n+v[1],0)/3,target=3+wallGalleryHillDeltaV298(x,z,native,3);if(Math.abs(y-target)>.045)continue;
      const hits=new Raycaster(new Vector3(x,120,z),new Vector3(0,-1,0)).intersectObject(mesh,false),nearest=hits.reduce((best,h)=>Math.abs(h.point.y-target)<Math.abs(best-target)?h.point.y:best,Infinity);const error=Math.abs(nearest-target);maxError=Math.max(maxError,error);expect(error).toBeLessThan(.05);sampled++;checks++;
    }}expect(sampled).toBeGreaterThan(0);
   }finally{disposeSurroundingCityRoot(r.root);}
  }expect(checks).toBeGreaterThan(80);console.log({mauerparkTerrainPhysicalSamples:checks,maxGroundRayErrorM:maxError});
 },30000);
});

test('actual cooperative decoder cancellation disposes allocated unpublished terrain geometry',async()=>{
 const controller=new AbortController(),allocated=spyOn(BufferGeometry.prototype,'setAttribute'),disposed=spyOn(BufferGeometry.prototype,'dispose');
 try{
  await expect(createSurroundingCityChunkCooperatively(raw('4_-6'),'4_-6',false,{signal:controller.signal,budgetMs:0,yield:async()=>{if(allocated.mock.calls.length)controller.abort();}},{wallGalleryV298:true})).rejects.toThrow();
  expect(allocated.mock.calls.length).toBeGreaterThan(0);expect(disposed.mock.calls.length).toBeGreaterThan(0);
 }finally{allocated.mockRestore();disposed.mockRestore();}
});
