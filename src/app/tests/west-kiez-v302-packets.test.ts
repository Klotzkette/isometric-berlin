import { expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import sourceData from "../src/data/westKiezV302.json";
import { captureNeighbourhoodPacketV300,prepareNeighbourhoodPacketV300,applyNeighbourhoodTrianglesV300,neighbourhoodPacketAdmittedV300,type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { prepareBoulevardArchitectureV235 } from "../src/boulevardArchitectureV235";
import { prepareWestShopfrontsV254 } from "../src/westShopfrontsV254";
import { prepareStreetCurvesV276 } from "../src/streetCurvesV276";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
const source=sourceData as NeighbourhoodSourceV300;
const done=<T>(g:Generator<void,T>):T=>{let n=g.next();while(!n.done)n=g.next();return n.value;};
const dir=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",dir),"utf8"));
function packet(key:string):SurroundingCityChunk {const [mode,id]=key.split(":"),descriptor=manifest.chunks.find((c:any)=>c.id===id);return JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url,dir))).toString());}
const rawIndices=(s:string)=>new Uint32Array(Uint8Array.from(Buffer.from(s,"base64")).buffer);

test("all eighteen bounded owner plans preserve complete original bytes and retire only their exact fitting triangles",()=>{
 expect(source.keys).toHaveLength(18);let retired=0;
 for(const key of source.keys){
  const [mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key),snapshot=JSON.stringify(raw),plan=source.packets[key];
  expect(done(captureNeighbourhoodPacketV300(raw,id,native,false,source,"west-kiez-v302"))).toBeUndefined();
  const ticket=done(captureNeighbourhoodPacketV300(raw,id,native,true,source,"west-kiez-v302"));expect(typeof ticket).toBe("function");
  const older=done(prepareStreetCurvesV276(done(prepareWestShopfrontsV254(done(prepareBoulevardArchitectureV235(raw,id,native)),id,native)),id,native));
  const prepared=done(prepareNeighbourhoodPacketV300(older,ticket));
  expect(neighbourhoodPacketAdmittedV300(prepared)).toBeTrue();expect(prepared.nav).toBe(older.nav);expect(prepared.meshes.slice(0,older.meshes.length)).toEqual(older.meshes);
  expect(prepared.meshes.at(-1)).toEqual(plan.append);expect(JSON.stringify(raw)).toBe(snapshot);
  expect(prepared.meshes.length).toBeLessThanOrEqual(16);
  expect(prepared.meshes.reduce((n,p)=>n+Buffer.from(p.positions,"base64").length/6,0)).toBeLessThanOrEqual(400000);
  expect(prepared.meshes.reduce((n,p)=>n+Buffer.from(p.indices,"base64").length/4,0)).toBeLessThanOrEqual(2400000);
  for(const [mesh,part]of raw.meshes.entries()){
   const original=rawIndices(part.indices),indices=original.slice(),receipt=plan.retire.find(r=>r.mesh===mesh),selected=new Set(receipt?.triangles??[]);
   retired+=done(applyNeighbourhoodTrianglesV300(prepared,mesh,indices,0));
   if(selected.size)expect(["district-facades-v188","city-west-street-fronts-v163"]).toContain(part.kind);
   for(let t=0;t<original.length/3;t++){
    const at=t*3;if(selected.has(t)){expect(indices[at+1]).toBe(indices[at]);expect(indices[at+2]).toBe(indices[at]);}
    else expect(indices.subarray(at,at+3)).toEqual(original.subarray(at,at+3));
   }
  }
  expect(done(prepareNeighbourhoodPacketV300(prepared,ticket))).toBe(prepared);
  const revoked={...prepared,meshes:prepared.meshes.slice(0,-1)};
  expect(neighbourhoodPacketAdmittedV300(revoked)).toBeFalse();
  for(const r of plan.retire){const indices=rawIndices(raw.meshes[r.mesh].indices),before=indices.slice();expect(done(applyNeighbourhoodTrianglesV300(revoked,r.mesh,indices,0))).toBe(0);expect(indices).toEqual(before);}
 }
 // 552 v188 triangles plus the full 866 drawn / 2312 native v163 receipts.
 expect(retired).toBe(3730);
});

test("capture cancellation and source/append corruption cannot retire an old front",()=>{
 for(const key of source.keys){
  const [mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key),snapshot=JSON.stringify(raw);
  const capture=captureNeighbourhoodPacketV300(raw,id,native,true,source,"west-kiez-v302");capture.next();capture.return(undefined);
  expect(JSON.stringify(raw)).toBe(snapshot);
  for(const mutate of [(r:SurroundingCityChunk)=>r.nav.groundY++, (r:SurroundingCityChunk)=>r.meshes[0].colors="AAAA"+r.meshes[0].colors.slice(4)]){
   const bad=structuredClone(raw);mutate(bad);expect(done(captureNeighbourhoodPacketV300(bad,id,native,true,source,"west-kiez-v302"))).toBeUndefined();
  }
  const bad=structuredClone(source);bad.packets[key].appendFingerprint++;
  expect(done(captureNeighbourhoodPacketV300(raw,id,native,true,bad,"west-kiez-v302"))).toBeUndefined();
 }
});

test("actual complete historical decoder chain admits every West packet within unchanged allocation limits",async()=>{
 const {buildSurroundingCityChunk}=await import("../src/SurroundingCityGeometry");
 for(const key of source.keys){
  const [mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key),snapshot=JSON.stringify(raw);
  const options={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,westKiezV302:true};
  const old=done(buildSurroundingCityChunk(raw,id,native,false,options));
  const actual=done(buildSurroundingCityChunk(raw,id,native,false,{...options,neighbourhoodV300:true,westKiezV302:true}));
  expect(actual.root.userData.neighbourhoodV300,key).toBeTrue();
  expect(actual.root.userData.sourceKinds).toContain("west-kiez-v302");
  expect(JSON.stringify(raw)).toBe(snapshot);expect(actual.nav).toEqual(old.nav);
  expect(actual.bufferCount).toBe(old.bufferCount);
  expect(actual.geometryBytes).toBeGreaterThan(old.geometryBytes);
  for(const result of [old,actual])result.root.traverse(object=>{if(object instanceof Mesh)object.geometry.dispose();});
 }
});
