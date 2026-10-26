import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/streetCurvesV276.json";
import { applyStreetCurveLinesV276, prepareStreetCurvesV276, streetCurveExtraLineVerticesV276, STREET_CURVES_KIND_V276, type StreetCurvesSourceV276 } from "../src/streetCurvesV276";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
const root = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
const source = data as StreetCurvesSourceV276;
function packet(id: string, native = false): SurroundingCityChunk {
  const d = manifest.chunks.find((r: {id:string})=>r.id===id);
  return JSON.parse(gunzipSync(readFileSync(new URL(d[native ? "minecraft" : "drawn"].url,root))).toString());
}
function finish<T>(steps: Generator<void,T>): T { for (;;) { const next=steps.next(); if(next.done)return next.value; } }
function u16(s:string): Uint16Array { const b=Uint8Array.fromBase64(s); return new Uint16Array(b.buffer,b.byteOffset,b.length/2); }

describe("v276 exact road-arc ownership",()=>{
  test("all plans preserve originals and retire only their proven chords in the existing ink buffer",()=>{
    let arcs=0;
    for (const id of source.keys) {
      const original=packet(id), snapshot=JSON.stringify(original), plan=source.chunks[id];
      const prepared=finish(prepareStreetCurvesV276(original,id));
      expect(prepared).not.toBe(original);
      expect(prepared.lines).toBe(original.lines);
      original.meshes.forEach((m,i)=>expect(prepared.meshes[i]).toBe(m));
      for (const field of ["buildings","ground","water","bridges"] as const) expect(prepared.nav[field]).toBe(original.nav[field]);
      expect(prepared.nav.roads?.slice(0,original.nav.roads?.length)).toEqual(original.nav.roads);
      expect(prepared.nav.roads?.slice(original.nav.roads?.length)).toEqual(plan.roads);
      expect(JSON.stringify(original)).toBe(snapshot);
      expect(finish(prepareStreetCurvesV276(prepared,id))).toBe(prepared);
      const old=u16(original.lines!.positions), colours=Uint8Array.fromBase64(original.lines!.colors!);
      const count=old.length/3, extra=streetCurveExtraLineVerticesV276(prepared);
      const values=new Uint16Array((count+extra)*6);
      for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++) {values[i*6+axis]=old[i*3+axis];values[i*6+axis+3]=colours[i*3+axis]*257;}
      expect(finish(applyStreetCurveLinesV276(prepared,values,6,count))).toBe(plan.segments.length);
      const selected=new Set(plan.segments);
      let untouched=true;
      for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++) {
        const sourceAt=(i%2===1&&selected.has(Math.floor(i/2))?i-1:i)*3+axis;
        if(values[i*6+axis]!==old[sourceAt] || values[i*6+axis+3]!==colours[i*3+axis]*257)untouched=false;
      }
      expect(untouched).toBe(true);
      const added=u16(plan.lines.positions), addedColours=Uint8Array.fromBase64(plan.lines.colors!);
      let exact=true;
      for(let i=0;i<extra;i++)for(let axis=0;axis<3;axis++)if(values[(count+i)*6+axis]!==added[i*3+axis]||values[(count+i)*6+axis+3]!==addedColours[i*3+axis]*257)exact=false;
      expect(exact).toBe(true);
      expect(prepared.meshes.at(-1)?.kind).toBe(STREET_CURVES_KIND_V276);
      expect(prepared.meshes.length).toBeLessThanOrEqual(16);
      arcs+=plan.segments.length;
    }
    expect(source.keys.length).toBe(210);
    expect(arcs).toBe(764);
  },30000);

  test("unknown and native requests never decode constructor recipes",()=>{
    const inaccessible=new Proxy({} as SurroundingCityChunk,{get(){throw new Error("unexpected source access");}});
    expect(finish(prepareStreetCurvesV276(inaccessible,"unknown"))).toBe(inaccessible);
    expect(finish(prepareStreetCurvesV276(inaccessible,source.keys[0],true))).toBe(inaccessible);
    for(const id of [source.keys[0],source.keys.at(-1)!]) {
      const original=packet(id,true);
      expect(finish(prepareStreetCurvesV276(original,id,true))).toBe(original);
      expect(streetCurveExtraLineVerticesV276(original)).toBe(0);
    }
  });

  test("changed origin, original meshes, ink, navigation and exhausted capacity fail closed",()=>{
    const id=source.keys.find(id=>packet(id).nav.buildings.length>0)!;
    for(const mutate of [
      (p:SurroundingCityChunk)=>{p.origin[0]+=.01;},
      (p:SurroundingCityChunk)=>{p.meshes[0].colors="AAAA"+p.meshes[0].colors.slice(4);},
      (p:SurroundingCityChunk)=>{p.lines!.positions="AAAA"+p.lines!.positions.slice(4);},
      (p:SurroundingCityChunk)=>{p.nav.groundY+=.01;},
      (p:SurroundingCityChunk)=>{p.nav.buildings[0].height+=.01;},
      (p:SurroundingCityChunk)=>{p.nav.roads![0].ring[0][0]+=.01;},
      (p:SurroundingCityChunk)=>{while(p.meshes.length<16)p.meshes.push(p.meshes[0]);},
    ]) {
      const input=packet(id);mutate(input);const snapshot=JSON.stringify(input);
      expect(finish(prepareStreetCurvesV276(input,id))).toBe(input);
      expect(JSON.stringify(input)).toBe(snapshot);
      expect(streetCurveExtraLineVerticesV276(input)).toBe(0);
    }
    for(const mutate of [
      (s:StreetCurvesSourceV276)=>{s.chunks[id].segments[0]=-1;},
      (s:StreetCurvesSourceV276)=>{s.chunks[id].segments.push(s.chunks[id].segments[0]);},
      (s:StreetCurvesSourceV276)=>{s.chunks[id].roads[0].ring[0][0]=Infinity;},
      (s:StreetCurvesSourceV276)=>{s.chunks[id].records[0].fingerprint++;},
      (s:StreetCurvesSourceV276)=>{s.chunks[id].lineFingerprint++;},
    ]) {
      const fixture=structuredClone(source);mutate(fixture);const input=packet(id);
      expect(finish(prepareStreetCurvesV276(input,id,false,fixture))).toBe(input);
    }
  });

  test("existing append-only preparations survive, yielding is bounded, incorrect destinations are rejected",()=>{
    const id=source.keys[0],original=packet(id);
    const prior={...original,meshes:[...original.meshes,{kind:"other-authored-addition",positionType:"u16cm" as const,positions:"",colors:"",indices:""}]};
    const steps=prepareStreetCurvesV276(prior,id);let yields=0,prepared:SurroundingCityChunk=prior;
    for(;;){const n=steps.next();if(n.done){prepared=n.value;break;}yields++;}
    expect(yields).toBeGreaterThan(1);expect(yields).toBeLessThan(600);
    prior.meshes.forEach((m,i)=>expect(prepared.meshes[i]).toBe(m));
    expect(()=>finish(applyStreetCurveLinesV276(prepared,new Uint16Array(6),6,1))).toThrow("destination");
    expect(streetCurveExtraLineVerticesV276({...prepared,meshes:prepared.meshes.slice(0,-1)})).toBe(0);
  });
});

test("every selected production packet admits the arc after all older preparations, with navigation and the same batches",async()=>{
  const {createSurroundingCityChunk}=await import("../src/SurroundingCityGeometry");
  const {disposeSurroundingCityRoot}=await import("../src/SurroundingCity");
  let total=0;
  for(const id of source.keys) {
    const input=packet(id),snapshot=JSON.stringify(input),plan=source.chunks[id];
    const result=createSurroundingCityChunk(input,id,false);
    try {
      expect(result.root.userData.sourceKinds.filter((v:string)=>v===STREET_CURVES_KIND_V276)).toHaveLength(1);
      expect(result.root.userData.streetCurveSegmentsV276).toBe(plan.segments.length);
      expect(result.root.children).toHaveLength(2);
      expect(result.bufferCount).toBe(3);
      for(const road of plan.roads)expect(result.nav.roads).toContainEqual(road);
      expect(JSON.stringify(input)).toBe(snapshot);
      total+=plan.segments.length;
    }finally{disposeSurroundingCityRoot(result.root);}
  }
  expect(total).toBe(764);
  // Both native construction and source failure retain the delivered street
  // family; no smooth overlay or partially retired chord may survive.
  for(const native of [false,true]) {
    const id=source.keys[0],input=packet(id,native);
    if(!native) input.nav.groundY+=.01;
    const result=createSurroundingCityChunk(input,id,native);
    try {
      expect(result.root.userData.sourceKinds).not.toContain(STREET_CURVES_KIND_V276);
      expect(result.root.userData.streetCurveSegmentsV276??0).toBe(0);
    }finally{disposeSurroundingCityRoot(result.root);}
  }
},120000);
