import { prepareAllotmentsV264 } from "../src/AllotmentsV264";
import { prepareFriedrichshainV266 } from "../src/FriedrichshainV266";
import { prepareScheunenV265 } from "../src/ScheunenV265";
import { prepareRoofHouseV233 } from "../src/roofHouseV233";
import { prepareOuterRoofsV262 } from "../src/outerRoofsV262";
import { prepareOuterFacadesV262 } from "../src/outerFacadesV262";
import { prepareGreyFacadesV263 } from "../src/greyFacadesV263";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareHouseCurbsV233 } from "../src/houseCurbsV233";
import { prepareBoulevardArchitectureV235 } from "../src/boulevardArchitectureV235";
import { prepareWestShopfrontsV254 } from "../src/westShopfrontsV254";
import { prepareCitywestStreetsV235 } from "../src/CitywestStreetsV235";
import { prepareCityStreetsV249 } from "../src/CityStreetsV249";
import { prepareMainStreetEdgesV254 } from "../src/MainStreetEdgesV254";
import { prepareNamedSiteV238 } from "../src/namedSiteReplacementsV238";
import { prepareEurefTransfersV262 } from "../src/eurefTransfersV262";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Group, Mesh } from "three";
import data from "../src/data/nordMauerparkV266.json";
import { prepareNordMauerparkV266, NORD_MAUERPARK_KIND_V266, type NordMauerparkSourceV266 } from "../src/NordMauerparkV266";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";

const root=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const source=data as NordMauerparkSourceV266;
function packet(id: string,native=false): SurroundingCityChunk {
  if (id.startsWith("alt-mitte-v169-")) {
    const folder=new URL("../src/data/",import.meta.url);
    const index=JSON.parse(readFileSync(new URL(native?"altMitteNativeV169Source.json":"altMitteDrawnV169Source.json",folder),"utf8"));
    const entry=index.chunkFiles.find((v:{id:string})=>"alt-mitte-v169-"+v.id===id);
    return JSON.parse(readFileSync(new URL(entry.file,folder),"utf8"));
  }
  const descriptor=manifest.chunks.find((d: { id: string })=>d.id===id);
  return JSON.parse(gunzipSync(readFileSync(new URL(descriptor[native?"minecraft":"drawn"].url,root))).toString());
}
function finish<T>(steps: Generator<void,T>): T {
  for (;;) { const next=steps.next(); if (next.done) return next.value; }
}
function uint16(s: string): Uint16Array { const b=Uint8Array.fromBase64(s); return new Uint16Array(b.buffer,b.byteOffset,b.byteLength/2); }
function geometryDigest(root: Group): string {
  const hash=new Bun.CryptoHasher("sha256");
  root.traverse(object=>{
    const mesh=object as Mesh;
    hash.update(JSON.stringify([object.name,object.position.toArray(),object.scale.toArray()]));
    if (!mesh.geometry) return;
    for (const [name,attribute] of Object.entries(mesh.geometry.attributes)) {
      const values="data" in attribute?attribute.data.array:attribute.array;
      hash.update(name);
      hash.update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength));
    }
    const indices=mesh.geometry.index?.array;
    if (indices) hash.update(new Uint8Array(indices.buffer,indices.byteOffset,indices.byteLength));
  });
  return hash.digest("hex");
}

describe("v266 source-bound NordMauerpark venue facades and mapped park edges",()=>{
  test("all original geometry/navigation remain identical through bounded serial preparation",()=>{
    let total=0;
    for (const [id,modes] of Object.entries(source.chunks)) for (const native of [false,true]) {
      const plan=modes[native?"minecraft":"drawn"]; if (!plan) continue;
      const original=packet(id,native), snapshot=JSON.stringify(original);
      const result=finish(prepareNordMauerparkV266(original,id,native));
      expect(result).not.toBe(original);
      expect(result.nav).toBe(original.nav);
      expect(result.lines).toBe(original.lines);
      expect(result.origin).toBe(original.origin);
      expect(result.meshes.slice(0,-1)).toEqual(original.meshes);
      result.meshes.slice(0,-1).forEach((m,i)=>expect(m).toBe(original.meshes[i]));
      expect(JSON.stringify(original)).toBe(snapshot);
      const added=result.meshes.at(-1)!;
      expect(added.kind).toBe(NORD_MAUERPARK_KIND_V266);
      const points=uint16(added.positions);
      expect(points.length).toBe(plan.boxes.length*24*3);
      const bytes=Uint8Array.fromBase64(added.indices), indices=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
      expect(indices.length).toBe(plan.boxes.length*36);
      expect(Math.max(...indices)).toBe(plan.boxes.length*24-1);
      expect(result.meshes.length).toBeLessThanOrEqual(16);
      expect(result.meshes.reduce((n,m)=>n+uint16(m.positions).length/3,0)).toBeLessThanOrEqual(400_000);
      expect(finish(prepareNordMauerparkV266(result,id,native))).toBe(result);
      total+=plan.boxes.length;
      // Orthogonal native geometry is independently constructed from its
      // delivered wall planes, not the rotated smooth box transforms.
      if (native) {
        let orthogonal=true;
        for (let i=0;i<indices.length;i+=3) {
          const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
          if (![0,1,2].some(axis=>points[a+axis]===points[b+axis]&&points[a+axis]===points[c+axis])) orthogonal=false;
        }
        expect(orthogonal).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(650);
  });

  test("unknown tiles do not touch any encoded recipe or city data",()=>{
    const inaccessible=new Proxy({} as SurroundingCityChunk,{get(){throw new Error("unexpected decode");}});
    expect(finish(prepareNordMauerparkV266(inaccessible,"not-a-nord-mauerpark-tile"))).toBe(inaccessible);
  });

  test("changed mesh, missing mesh, altered navigation, malformed rows and capacity fail closed",()=>{
    const id="6_-3";
    for (const mutate of [
      (p: SurroundingCityChunk)=>{p.meshes[0].colors="AAAA"+p.meshes[0].colors.slice(4);},
      (p: SurroundingCityChunk)=>{p.meshes.pop();},
      (p: SurroundingCityChunk)=>{p.nav.buildings[0].height+=.01;},
      (p: SurroundingCityChunk)=>{p.origin[0]+=.01;},
      (p: SurroundingCityChunk)=>{while(p.meshes.length<16)p.meshes.push(p.meshes[0]);},
    ]) {
      const input=packet(id);mutate(input);
      expect(finish(prepareNordMauerparkV266(input,id))).toBe(input);
    }
    for (const mutate of [
      (p: NordMauerparkSourceV266)=>{p.chunks[id].drawn!.boxes[0][3]=.5;},
      (p: NordMauerparkSourceV266)=>{p.chunks[id].drawn!.boxes[0][7]=-1;},
      (p: NordMauerparkSourceV266)=>{p.chunks[id].drawn!.boxes=Array(901).fill(p.chunks[id].drawn!.boxes[0]);},
      (p: NordMauerparkSourceV266)=>{p.chunks[id].drawn!.records[0].fingerprint++;},
    ]) {
      const fixture=structuredClone(source);mutate(fixture);const input=packet(id);
      expect(finish(prepareNordMauerparkV266(input,id,false,fixture))).toBe(input);
    }
  });

  test("source hashing and construction yield to the existing scheduler",()=>{
    const steps=prepareNordMauerparkV266(packet("6_-3"),"6_-3");let yields=0;
    for (;;) { const next=steps.next();if(next.done)break;yields++; }
    expect(yields).toBeGreaterThan(4);
    expect(yields).toBeLessThan(600);
  });

  test("the production stream pipeline preserves every original object and applies the complete additions once in both modes",async()=>{
    for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
      if (!source.chunks[id][native?"minecraft":"drawn"]) continue;
      const original=packet(id,native),snapshot=JSON.stringify(original);
      const meshes=original.meshes,parts=[...meshes],nav=original.nav,lines=original.lines,origin=original.origin;
      const prepared=finish(prepareNordMauerparkV266(original,id,native));
      const schedule={budgetMs:0,yield:async()=>{}};
      const streamed=await createStreamedSurroundingCityChunkV255(original,id,native,schedule);
      let explicit: Awaited<ReturnType<typeof createStreamedSurroundingCityChunkV255>> | undefined;
      try {
        explicit=await createStreamedSurroundingCityChunkV255(prepared,id,native,schedule);
        expect(streamed.root.userData.sourceKinds.filter((kind:string)=>kind===NORD_MAUERPARK_KIND_V266)).toHaveLength(1);
        for (const part of parts) expect(streamed.root.userData.sourceKinds).toContain(part.kind);
        expect(streamed.geometryBytes).toBe(explicit.geometryBytes);
        expect(streamed.bufferCount).toBe(explicit.bufferCount);
        expect(streamed.nav).toEqual(explicit.nav);
        expect(geometryDigest(streamed.root)).toBe(geometryDigest(explicit.root));
        expect(original.meshes).toBe(meshes);
        parts.forEach((part,index)=>expect(original.meshes[index]).toBe(part));
        expect(original.nav).toBe(nav);
        expect(original.lines).toBe(lines);
        expect(original.origin).toBe(origin);
        expect(JSON.stringify(original)).toBe(snapshot);
      } finally {
        disposeSurroundingCityRoot(streamed.root);
        if (explicit) disposeSurroundingCityRoot(explicit.root);
      }
    }
  },30_000);
});


test("every earlier source-bound fitting/roof transaction still applies unchanged after v266",()=>{
  const prior=[prepareFriedrichshainV266,prepareScheunenV265,prepareAllotmentsV264,prepareRoofHouseV233,prepareOuterRoofsV262,prepareOuterFacadesV262,prepareGreyFacadesV263,prepareHouseDoorsV233,prepareHouseCurbsV233,prepareBoulevardArchitectureV235,prepareWestShopfrontsV254,prepareCitywestStreetsV235,prepareCityStreetsV249,prepareMainStreetEdgesV254,prepareNamedSiteV238,prepareEurefTransfersV262];
  for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
    if (!source.chunks[id][native?"minecraft":"drawn"]) continue;
    const original=packet(id,native);
    let baseline=original, supplemented=finish(prepareNordMauerparkV266(original,id,native));
    for (const prepare of prior) {
      baseline=finish(prepare(baseline,id,native));
      supplemented=finish(prepare(supplemented,id,native));
      expect(supplemented.meshes.filter(m=>m.kind!==NORD_MAUERPARK_KIND_V266)).toEqual(baseline.meshes);
      expect(supplemented.nav).toEqual(baseline.nav);
      expect(supplemented.lines).toEqual(baseline.lines);
    }
  }
},30_000);
