import { prepareNordMauerparkV266 } from "../src/NordMauerparkV266";
import { prepareFriedrichshainV266 } from "../src/FriedrichshainV266";
import { prepareScheunenV265 } from "../src/ScheunenV265";
import { prepareFeuerwacheKreuzbergV267, FEUERWACHE_KREUZBERG_V267_KIND } from "../src/FeuerwacheKreuzbergV267";
import { prepareAllotmentsV264 } from "../src/AllotmentsV264";
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
import data from "../src/data/kreuzbergStreetsV267.json";
import { prepareKreuzbergStreetsV267, KREUZBERG_STREETS_KIND_V267, type KreuzbergStreetsSourceV267 } from "../src/KreuzbergStreetsV267";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";

const root=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const source=data as KreuzbergStreetsSourceV267;
function packet(id: string,native=false): SurroundingCityChunk {
  const descriptor=manifest.chunks.find((d: { id: string })=>d.id===id);
  return JSON.parse(gunzipSync(readFileSync(new URL(descriptor[native?"minecraft":"drawn"].url,root))).toString());
}
function finish<T>(steps: Generator<void,T>): T {
  for (;;) { const next=steps.next(); if (next.done) return next.value; }
}
const prior=[prepareNordMauerparkV266,prepareFriedrichshainV266,prepareScheunenV265,prepareAllotmentsV264,prepareRoofHouseV233,prepareOuterRoofsV262,prepareOuterFacadesV262,prepareGreyFacadesV263,prepareHouseDoorsV233,prepareHouseCurbsV233,prepareBoulevardArchitectureV235,prepareWestShopfrontsV254,prepareCitywestStreetsV235,prepareCityStreetsV249,prepareMainStreetEdgesV254,prepareNamedSiteV238,prepareEurefTransfersV262];
function earlier(p: SurroundingCityChunk,id: string,native: boolean) {
  for (const prepare of prior) p=finish(prepare(p,id,native));
  return p;
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

describe("v267 source-bound KreuzbergStreets shopfronts and public equipment",()=>{
  test("all original geometry/navigation remain identical through bounded serial preparation",()=>{
    let total=0;
    for (const [id,modes] of Object.entries(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native), snapshot=JSON.stringify(original), plan=modes[native?"minecraft":"drawn"];
      const result=finish(prepareKreuzbergStreetsV267(original,id,native));
      expect(result).not.toBe(original);
      expect(result.nav).toBe(original.nav);
      expect(result.lines).toBe(original.lines);
      expect(result.origin).toBe(original.origin);
      expect(result.meshes.slice(0,-1)).toEqual(original.meshes);
      result.meshes.slice(0,-1).forEach((m,i)=>expect(m).toBe(original.meshes[i]));
      expect(JSON.stringify(original)).toBe(snapshot);
      const added=result.meshes.at(-1)!;
      expect(added.kind).toBe(KREUZBERG_STREETS_KIND_V267);
      const points=uint16(added.positions);
      expect(points.length).toBe(plan.boxes.length*24*3);
      const bytes=Uint8Array.fromBase64(added.indices), indices=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
      expect(indices.length).toBe(plan.boxes.length*36);
      expect(Math.max(...indices)).toBe(plan.boxes.length*24-1);
      expect(result.meshes.length).toBeLessThanOrEqual(16);
      expect(result.meshes.reduce((n,m)=>n+uint16(m.positions).length/3,0)).toBeLessThanOrEqual(400_000);
      expect(finish(prepareKreuzbergStreetsV267(result,id,native))).toBe(result);
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
    expect(total).toBeGreaterThan(300);
  });

  test("unknown tiles do not touch any encoded recipe or city data",()=>{
    const inaccessible=new Proxy({} as SurroundingCityChunk,{get(){throw new Error("unexpected decode");}});
    expect(finish(prepareKreuzbergStreetsV267(inaccessible,"not-a-kreuzbergStreets-tile"))).toBe(inaccessible);
  });

  test("changed mesh, missing mesh, altered navigation, malformed rows and capacity fail closed",()=>{
    const id="7_4";
    for (const mutate of [
      (p: SurroundingCityChunk)=>{p.meshes[0].colors="AAAA"+p.meshes[0].colors.slice(4);},
      (p: SurroundingCityChunk)=>{p.meshes.pop();},
      (p: SurroundingCityChunk)=>{p.nav.buildings[0].height+=.01;},
      (p: SurroundingCityChunk)=>{p.origin[0]+=.01;},
      (p: SurroundingCityChunk)=>{while(p.meshes.length<16)p.meshes.push(p.meshes[0]);},
    ]) {
      const input=packet(id);mutate(input);
      expect(finish(prepareKreuzbergStreetsV267(input,id))).toBe(input);
    }
    for (const mutate of [
      (p: KreuzbergStreetsSourceV267)=>{p.chunks[id].drawn.boxes[0][3]=.5;},
      (p: KreuzbergStreetsSourceV267)=>{p.chunks[id].drawn.boxes[0][7]=-1;},
      (p: KreuzbergStreetsSourceV267)=>{p.chunks[id].drawn.boxes=Array(651).fill(p.chunks[id].drawn.boxes[0]);},
      (p: KreuzbergStreetsSourceV267)=>{p.chunks[id].drawn.records[0].fingerprint++;},
      (p: KreuzbergStreetsSourceV267)=>{p.chunks[id].drawn.records=[];},
    ]) {
      const fixture=structuredClone(source);mutate(fixture);const input=packet(id);
      expect(finish(prepareKreuzbergStreetsV267(input,id,false,fixture))).toBe(input);
    }
  });

  test("source hashing and construction yield to the existing scheduler",()=>{
    const steps=prepareKreuzbergStreetsV267(packet("7_4"),"7_4");let yields=0;
    for (;;) { const next=steps.next();if(next.done)break;yields++; }
    expect(yields).toBeGreaterThan(4);
    expect(yields).toBeLessThan(600);
  });

  test("the production stream pipeline preserves every original object and applies the complete additions once in both modes",async()=>{
    for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native),snapshot=JSON.stringify(original);
      const meshes=original.meshes,parts=[...meshes],nav=original.nav,lines=original.lines,origin=original.origin;
      const prepared=finish(prepareKreuzbergStreetsV267(earlier(original,id,native),id,native));
      const schedule={budgetMs:0,yield:async()=>{}};
      const streamed=await createStreamedSurroundingCityChunkV255(original,id,native,schedule);
      let explicit: Awaited<ReturnType<typeof createStreamedSurroundingCityChunkV255>> | undefined;
      try {
        explicit=await createStreamedSurroundingCityChunkV255(prepared,id,native,schedule);
        expect(streamed.root.userData.sourceKinds.filter((kind:string)=>kind===KREUZBERG_STREETS_KIND_V267)).toHaveLength(1);
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


test("every earlier source-bound fitting/roof transaction still applies unchanged after v267",()=>{

  for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
    const original=packet(id,native);
    let baseline=original, supplemented=finish(prepareKreuzbergStreetsV267(original,id,native));
    for (const prepare of prior) {
      baseline=finish(prepare(baseline,id,native));
      supplemented=finish(prepare(supplemented,id,native));
      expect(supplemented.meshes.filter(m=>m.kind!==KREUZBERG_STREETS_KIND_V267)).toEqual(baseline.meshes);
      expect(supplemented.nav).toEqual(baseline.nav);
      expect(supplemented.lines).toEqual(baseline.lines);
    }
    const last=finish(prepareKreuzbergStreetsV267(baseline,id,native));
    expect(last.meshes.at(-1)?.kind).toBe(KREUZBERG_STREETS_KIND_V267);
    baseline.meshes.forEach((m,i)=>expect(last.meshes[i]).toBe(m));
  }
},30_000);


test("original-prefix guards accept an earlier append-only transaction without losing any old object",()=>{
  for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
    const original=packet(id,native);
    const prefix={...original,meshes:[...original.meshes,{...original.meshes[0],kind:"independent-v267-append-fixture"}]};
    const result=finish(prepareKreuzbergStreetsV267(prefix,id,native));
    expect(result.meshes.length).toBe(prefix.meshes.length+1);
    prefix.meshes.forEach((m,i)=>expect(result.meshes[i]).toBe(m));
    expect(result.nav).toBe(prefix.nav);
  }
});


test("Wiener street fittings and complete fire-station replacement coexist in both packet orders",()=>{
  for (const native of [false,true]) {
    const original=packet("7_4",native), old=earlier(original,"7_4",native);
    const streetsFirst=finish(prepareFeuerwacheKreuzbergV267(finish(prepareKreuzbergStreetsV267(old,"7_4",native)),"7_4",native));
    const stationFirst=finish(prepareKreuzbergStreetsV267(finish(prepareFeuerwacheKreuzbergV267(old,"7_4",native)),"7_4",native));
    for (const result of [streetsFirst,stationFirst]) {
      expect(result.meshes.filter(m=>m.kind===KREUZBERG_STREETS_KIND_V267)).toHaveLength(1);
      expect(result.meshes.filter(m=>m.kind===FEUERWACHE_KREUZBERG_V267_KIND)).toHaveLength(1);
      old.meshes.forEach((m,i)=>expect(result.meshes[i]).toBe(m));
      expect(result.nav).toBe(old.nav);
    }
    const byKind=(p: SurroundingCityChunk)=>p.meshes.slice().sort((a,b)=>a.kind.localeCompare(b.kind));
    expect(byKind(streetsFirst)).toEqual(byKind(stationFirst));
  }
});
