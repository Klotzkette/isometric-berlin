import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Group, Mesh } from "three";
import data from "../src/data/scheunenV265.json";
import { prepareScheunenV265, SCHEUNEN_KIND_V265, type ScheunenSourceV265 } from "../src/ScheunenV265";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";

const root=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const source=data as ScheunenSourceV265;
function packet(id: string,native=false): SurroundingCityChunk {
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

describe("v265 mapped Scheunenviertel entrances and measured eaves",()=>{
  test("all original geometry/navigation remain identical through bounded serial preparation",()=>{
    let total=0;
    for (const [id,modes] of Object.entries(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native), snapshot=JSON.stringify(original), plan=modes[native?"minecraft":"drawn"];
      const result=finish(prepareScheunenV265(original,id,native));
      expect(result).not.toBe(original);
      expect(result.nav).toBe(original.nav);
      expect(result.lines).toBe(original.lines);
      expect(result.origin).toBe(original.origin);
      expect(result.meshes.slice(0,-1)).toEqual(original.meshes);
      result.meshes.slice(0,-1).forEach((m,i)=>expect(m).toBe(original.meshes[i]));
      expect(JSON.stringify(original)).toBe(snapshot);
      const added=result.meshes.at(-1)!;
      expect(added.kind).toBe(SCHEUNEN_KIND_V265);
      const points=uint16(added.positions);
      expect(points.length).toBe(plan.boxes.length*24*3);
      const bytes=Uint8Array.fromBase64(added.indices), indices=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
      expect(indices.length).toBe(plan.boxes.length*36);
      expect(Math.max(...indices)).toBe(plan.boxes.length*24-1);
      expect(result.meshes.length).toBeLessThanOrEqual(16);
      expect(result.meshes.reduce((n,m)=>n+uint16(m.positions).length/3,0)).toBeLessThanOrEqual(400_000);
      expect(finish(prepareScheunenV265(result,id,native))).toBe(result);
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
    expect(total).toBe(597);
  });

  test("unknown tiles do not touch any encoded recipe or city data",()=>{
    const inaccessible=new Proxy({} as SurroundingCityChunk,{get(){throw new Error("unexpected decode");}});
    expect(finish(prepareScheunenV265(inaccessible,"not-a-scheunen-tile"))).toBe(inaccessible);
  });

  test("changed mesh, missing mesh, altered navigation, malformed rows and capacity fail closed",()=>{
    const id="4_-2";
    for (const mutate of [
      (p: SurroundingCityChunk)=>{p.meshes[0].colors="AAAA"+p.meshes[0].colors.slice(4);},
      (p: SurroundingCityChunk)=>{p.meshes.pop();},
      (p: SurroundingCityChunk)=>{p.nav.buildings[0].height+=.01;},
      (p: SurroundingCityChunk)=>{p.origin[0]+=.01;},
      (p: SurroundingCityChunk)=>{while(p.meshes.length<16)p.meshes.push(p.meshes[0]);},
    ]) {
      const input=packet(id);mutate(input);
      expect(finish(prepareScheunenV265(input,id))).toBe(input);
    }
    for (const mutate of [
      (p: ScheunenSourceV265)=>{p.chunks[id].drawn.boxes[0][3]=.5;},
      (p: ScheunenSourceV265)=>{p.chunks[id].drawn.boxes[0][7]=-1;},
      (p: ScheunenSourceV265)=>{p.chunks[id].drawn.boxes=Array(901).fill(p.chunks[id].drawn.boxes[0]);},
      (p: ScheunenSourceV265)=>{p.chunks[id].drawn.records[0].fingerprint++;},
    ]) {
      const fixture=structuredClone(source);mutate(fixture);const input=packet(id);
      expect(finish(prepareScheunenV265(input,id,false,fixture))).toBe(input);
    }
  });

  test("source hashing and construction yield to the existing scheduler",()=>{
    const steps=prepareScheunenV265(packet("4_-2"),"4_-2");let yields=0;
    for (;;) { const next=steps.next();if(next.done)break;yields++; }
    expect(yields).toBeGreaterThan(30);
    expect(yields).toBeLessThan(200);
  });

  test("the production stream pipeline preserves every original object and applies the complete additions once in both modes",async()=>{
    for (const id of Object.keys(source.chunks)) for (const native of [false,true]) {
      const original=packet(id,native),snapshot=JSON.stringify(original);
      const meshes=original.meshes,parts=[...meshes],nav=original.nav,lines=original.lines,origin=original.origin;
      const prepared=finish(prepareScheunenV265(original,id,native));
      const schedule={budgetMs:0,yield:async()=>{}};
      const streamed=await createStreamedSurroundingCityChunkV255(original,id,native,schedule);
      let explicit: Awaited<ReturnType<typeof createStreamedSurroundingCityChunkV255>> | undefined;
      try {
        explicit=await createStreamedSurroundingCityChunkV255(prepared,id,native,schedule);
        expect(streamed.root.userData.sourceKinds.filter((kind:string)=>kind===SCHEUNEN_KIND_V265)).toHaveLength(1);
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
