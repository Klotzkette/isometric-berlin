import { prepareKoepenickerLandmarksV268 } from "../src/KoepenickerLandmarksV268";
import { prepareKraftwerkBerlinV268 } from "../src/KraftwerkBerlinV268";
import { prepareKreuzbergStreetsV267 } from "../src/KreuzbergStreetsV267";
import { prepareNordMauerparkV266 } from "../src/NordMauerparkV266";
import { prepareFriedrichshainV266 } from "../src/FriedrichshainV266";
import { prepareScheunenV265 } from "../src/ScheunenV265";
import { prepareFeuerwacheKreuzbergV267 } from "../src/FeuerwacheKreuzbergV267";
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
import data from "../src/data/moabitHousesV269.json";
import { prepareMoabitHousesV269, MOABIT_HOUSES_KIND_V269, type MoabitHousesSourceV269 } from "../src/MoabitHousesV269";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";

const root=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const source=data as MoabitHousesSourceV269;
function packet(id: string,native=false): SurroundingCityChunk {
  const descriptor=manifest.chunks.find((d: { id: string })=>d.id===id);
  return JSON.parse(gunzipSync(readFileSync(new URL(descriptor[native?"minecraft":"drawn"].url,root))).toString());
}
function finish<T>(steps: Generator<void,T>): T {
  for (;;) { const next=steps.next(); if (next.done) return next.value; }
}
const prior=[prepareNordMauerparkV266,prepareFriedrichshainV266,prepareScheunenV265,prepareAllotmentsV264,prepareRoofHouseV233,prepareOuterRoofsV262,prepareOuterFacadesV262,prepareGreyFacadesV263,prepareHouseDoorsV233,prepareHouseCurbsV233,prepareBoulevardArchitectureV235,prepareWestShopfrontsV254,prepareCitywestStreetsV235,prepareCityStreetsV249,prepareMainStreetEdgesV254,prepareNamedSiteV238,prepareEurefTransfersV262,prepareKreuzbergStreetsV267,prepareFeuerwacheKreuzbergV267,prepareKoepenickerLandmarksV268];
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

describe("v269 retained Moabit window jambs/heads and mapped lower fronts",()=>{
  test("all original geometry/navigation remain identical through bounded serial preparation",()=>{
    let total=0;
    for (const [id,modes] of Object.entries(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native), snapshot=JSON.stringify(original), plan=modes[native?"minecraft":"drawn"];
      const result=finish(prepareMoabitHousesV269(original,id,native));
      if (!plan.boxes.length) { expect(result===original).toBe(true); continue; }
      expect(result!==original).toBe(true);
      expect(result.nav).toBe(original.nav);
      expect(result.lines).toBe(original.lines);
      expect(result.origin).toBe(original.origin);
      expect(result.meshes.slice(0,-1)).toEqual(original.meshes);
      result.meshes.slice(0,-1).forEach((m,i)=>expect(m).toBe(original.meshes[i]));
      expect(JSON.stringify(original)).toBe(snapshot);
      const added=result.meshes.at(-1)!;
      expect(added.kind).toBe(MOABIT_HOUSES_KIND_V269);
      const points=uint16(added.positions);
      expect(points.length).toBe(plan.boxes.length*24*3);
      const bytes=Uint8Array.fromBase64(added.indices), indices=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
      expect(indices.length).toBe(plan.boxes.length*36);
      expect(Math.max(...indices)).toBe(plan.boxes.length*24-1);
      expect(result.meshes.length).toBeLessThanOrEqual(16);
      expect(result.meshes.reduce((n,m)=>n+uint16(m.positions).length/3,0)).toBeLessThanOrEqual(400_000);
      expect(finish(prepareMoabitHousesV269(result,id,native))).toBe(result);
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
    expect(finish(prepareMoabitHousesV269(inaccessible,"not-a-moabitHouses-tile"))).toBe(inaccessible);
  });

  test("changed mesh, missing mesh, altered navigation, malformed rows and capacity fail closed",()=>{
    const id="-6_-3";
    for (const mutate of [
      (p: SurroundingCityChunk)=>{p.meshes[0].colors="AAAA"+p.meshes[0].colors.slice(4);},
      (p: SurroundingCityChunk)=>{p.meshes.pop();},
      (p: SurroundingCityChunk)=>{p.nav.buildings[0].height+=.01;},
      (p: SurroundingCityChunk)=>{p.origin[0]+=.01;},
      (p: SurroundingCityChunk)=>{while(p.meshes.length<16)p.meshes.push(p.meshes[0]);},
    ]) {
      const input=packet(id);mutate(input);
      expect(finish(prepareMoabitHousesV269(input,id))).toBe(input);
    }
    for (const mutate of [
      (p: MoabitHousesSourceV269)=>{p.chunks[id].drawn.boxes[0][3]=.5;},
      (p: MoabitHousesSourceV269)=>{p.chunks[id].drawn.boxes[0][7]=-1;},
      (p: MoabitHousesSourceV269)=>{p.chunks[id].drawn.boxes=Array(5001).fill(p.chunks[id].drawn.boxes[0]);},
      (p: MoabitHousesSourceV269)=>{p.chunks[id].drawn.records[0].fingerprint++;},
      (p: MoabitHousesSourceV269)=>{p.chunks[id].drawn.records=[];},
    ]) {
      const fixture=structuredClone(source);mutate(fixture);const input=packet(id);
      expect(finish(prepareMoabitHousesV269(input,id,false,fixture))).toBe(input);
    }
  });

  test("source hashing and construction yield to the existing scheduler",()=>{
    const steps=prepareMoabitHousesV269(packet("-6_-3"),"-6_-3");let yields=0;
    for (;;) { const next=steps.next();if(next.done)break;yields++; }
    expect(yields).toBeGreaterThan(4);
    expect(yields).toBeLessThan(600);
  });

  test("the production stream pipeline preserves every original object and applies the complete additions once in both modes",async()=>{
    for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native),snapshot=JSON.stringify(original);
      const meshes=original.meshes,parts=[...meshes],nav=original.nav,lines=original.lines,origin=original.origin;
      const prepared=finish(prepareMoabitHousesV269(earlier(original,id,native),id,native));
      const schedule={budgetMs:0,yield:async()=>{}};
      const streamed=await createStreamedSurroundingCityChunkV255(original,id,native,schedule);
      let explicit: Awaited<ReturnType<typeof createStreamedSurroundingCityChunkV255>> | undefined;
      try {
        explicit=await createStreamedSurroundingCityChunkV255(prepared,id,native,schedule);
        expect(streamed.root.userData.sourceKinds.filter((kind:string)=>kind===MOABIT_HOUSES_KIND_V269)).toHaveLength(source.chunks[id][native?"minecraft":"drawn"].boxes.length?1:0);
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


test("all earlier transactions survive by identity when Moabit follows them",()=>{
  for(const id of Object.keys(source.chunks))for(const native of [false,true]){
    const previous=earlier(packet(id,native),id,native),next=finish(prepareMoabitHousesV269(previous,id,native));
    previous.meshes.forEach((m,i)=>expect(next.meshes[i]===m).toBe(true));
    expect(next.nav).toBe(previous.nav);expect(next.lines).toBe(previous.lines);
    expect(next.meshes.length).toBeLessThanOrEqual(16);
  }
});

test("original-prefix guards accept an earlier append-only transaction without losing any old object",()=>{
  for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
    const original=packet(id,native);
    const prefix={...original,meshes:[...original.meshes,{...original.meshes[0],kind:"independent-v267-append-fixture"}]};
    const result=finish(prepareMoabitHousesV269(prefix,id,native));
    expect(result.meshes.length).toBe(prefix.meshes.length+(source.chunks[id][native?"minecraft":"drawn"].boxes.length?1:0));
    prefix.meshes.forEach((m,i)=>expect(result.meshes[i]).toBe(m));
    expect(result.nav).toBe(prefix.nav);
  }
});




test("all v269 preparations stay within the existing mesh and geometry allowances",()=>{
  for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
    const previous=earlier(packet(id,native),id,native);
    const street=finish(prepareMoabitHousesV269(previous,id,native));
    const complete=finish(prepareKraftwerkBerlinV268(street,id,native));
    expect(complete.meshes.length).toBeLessThanOrEqual(16);
    expect(complete.meshes.reduce((n,m)=>n+uint16(m.positions).length/3,0)).toBeLessThanOrEqual(400_000);
    expect(complete.meshes.reduce((n,m)=>n+Uint8Array.fromBase64(m.indices).length/4,0)).toBeLessThanOrEqual(2_400_000);
    previous.meshes.forEach((m,i)=>expect(complete.meshes[i]===m).toBe(true));
    expect(street.nav===previous.nav).toBe(true);
    expect(street.lines===previous.lines).toBe(true);
  }
});
