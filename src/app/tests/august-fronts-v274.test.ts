import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/augustFrontsV274.json";
import { prepareAugustFrontsV274, AUGUST_FRONTS_KIND_V274, type AugustFrontsSourceV274 } from "../src/AugustFrontsV274";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";
const root=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const source=data as AugustFrontsSourceV274;
function packet(id: string,native=false): SurroundingCityChunk {
  const descriptor=manifest.chunks.find((d: { id: string })=>d.id===id);
  return JSON.parse(gunzipSync(readFileSync(new URL(descriptor[native?"minecraft":"drawn"].url,root))).toString());
}
function finish<T>(steps: Generator<void,T>): T {
  for (;;) { const next=steps.next(); if (next.done) return next.value; }
}
function uint16(s: string): Uint16Array { const b=Uint8Array.fromBase64(s); return new Uint16Array(b.buffer,b.byteOffset,b.byteLength/2); }
describe("v274 retained August-/Oranienburger upper window heads and reveals",()=>{
  test("all original geometry/navigation remain identical through bounded serial preparation",()=>{
    let total=0;
    for (const [id,modes] of Object.entries(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native), snapshot=JSON.stringify(original), plan=modes[native?"minecraft":"drawn"];
      const result=finish(prepareAugustFrontsV274(original,id,native));
      if (!plan.boxes.length) { expect(result===original).toBe(true); continue; }
      expect(result!==original).toBe(true);
      expect(result.nav).toBe(original.nav);
      expect(result.lines).toBe(original.lines);
      expect(result.origin).toBe(original.origin);
      expect(result.meshes.slice(0,-1)).toEqual(original.meshes);
      result.meshes.slice(0,-1).forEach((m,i)=>expect(m).toBe(original.meshes[i]));
      expect(JSON.stringify(original)).toBe(snapshot);
      const added=result.meshes.at(-1)!;
      expect(added.kind).toBe(AUGUST_FRONTS_KIND_V274);
      const points=uint16(added.positions);
      expect(points.length).toBe(plan.boxes.length*24*3);
      const bytes=Uint8Array.fromBase64(added.indices), indices=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
      expect(indices.length).toBe(plan.boxes.length*36);
      expect(Math.max(...indices)).toBe(plan.boxes.length*24-1);
      expect(result.meshes.length).toBeLessThanOrEqual(16);
      expect(result.meshes.reduce((n,m)=>n+uint16(m.positions).length/3,0)).toBeLessThanOrEqual(400_000);
      expect(finish(prepareAugustFrontsV274(result,id,native))).toBe(result);
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
    expect(finish(prepareAugustFrontsV274(inaccessible,"not-a-augustFronts-tile"))).toBe(inaccessible);
  });

  test("changed mesh, missing mesh, altered navigation, malformed rows and capacity fail closed",()=>{
    const id="3_-2";
    for (const mutate of [
      (p: SurroundingCityChunk)=>{p.meshes[0].colors="AAAA"+p.meshes[0].colors.slice(4);},
      (p: SurroundingCityChunk)=>{p.meshes.pop();},
      (p: SurroundingCityChunk)=>{p.nav.buildings[0].height+=.01;},
      (p: SurroundingCityChunk)=>{p.origin[0]+=.01;},
      (p: SurroundingCityChunk)=>{while(p.meshes.length<16)p.meshes.push(p.meshes[0]);},
    ]) {
      const input=packet(id);mutate(input);
      expect(finish(prepareAugustFrontsV274(input,id))).toBe(input);
    }
    for (const mutate of [
      (p: AugustFrontsSourceV274)=>{p.chunks[id].drawn.boxes[0][3]=.5;},
      (p: AugustFrontsSourceV274)=>{p.chunks[id].drawn.boxes[0][7]=-1;},
      (p: AugustFrontsSourceV274)=>{p.chunks[id].drawn.boxes=Array(901).fill(p.chunks[id].drawn.boxes[0]);},
      (p: AugustFrontsSourceV274)=>{p.chunks[id].drawn.records[0].fingerprint++;},
      (p: AugustFrontsSourceV274)=>{p.chunks[id].drawn.records=[];},
    ]) {
      const fixture=structuredClone(source);mutate(fixture);const input=packet(id);
      expect(finish(prepareAugustFrontsV274(input,id,false,fixture))).toBe(input);
    }
  });

  test("source hashing and construction yield to the existing scheduler",()=>{
    const steps=prepareAugustFrontsV274(packet("3_-2"),"3_-2");let yields=0;
    for (;;) { const next=steps.next();if(next.done)break;yields++; }
    expect(yields).toBeGreaterThan(4);
    expect(yields).toBeLessThan(600);
  });

});

test("append-only previous preparations remain by identity",()=>{
  for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
    const original=packet(id,native);
    const prefix={...original,meshes:[...original.meshes,{...original.meshes[0],kind:"retained-addition-fixture",positions:"",colors:"",indices:""}]};
    const result=finish(prepareAugustFrontsV274(prefix,id,native));
    expect(result.meshes.length).toBe(prefix.meshes.length+1);
    prefix.meshes.forEach((m,i)=>expect(result.meshes[i]).toBe(m));
    expect(result.nav).toBe(prefix.nav);
  }
});

test("production construction retains every original kind and adds upper fittings once",async()=>{
  for(const id of Object.keys(source.chunks)) for(const native of [false,true]){
    const original=packet(id,native), snapshot=JSON.stringify(original);
    const result=await createStreamedSurroundingCityChunkV255(original,id,native,{budgetMs:0,yield:async()=>{}});
    try {
      expect(result.root.userData.sourceKinds.filter((k:string)=>k===AUGUST_FRONTS_KIND_V274)).toHaveLength(1);
      for(const part of original.meshes) expect(result.root.userData.sourceKinds).toContain(part.kind);
      expect(JSON.stringify(original)).toBe(snapshot);
    } finally { disposeSurroundingCityRoot(result.root); }
  }
},30000);
