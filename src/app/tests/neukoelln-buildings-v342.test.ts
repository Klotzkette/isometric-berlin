import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {InterleavedBufferAttribute, Mesh, LineSegments} from "three";
import data from "../src/data/neukoellnBuildingsV342Packets.json";
import {buildSurroundingCityChunk, type SurroundingCityChunk, type SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";
import {createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {prepareNeukoellnBuildingsV342, NEUKOELLN_BUILDINGS_KIND_V342 as kind} from "../src/NeukoellnBuildingsV342";
import {sourceQuarterOwnersV303, type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {doneV342 as done, optionsV342, predecessorV342} from "./helpers/neukoellnPredecessorV342";
import {transformLosslessJsonData} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";

const source=data as unknown as SourceQuarterSourceV303;
const publicRoot=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const proof=JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/neukoelln-buildings-v342-packet-evidence.json",import.meta.url),"utf8"));
function raw(key:string):SurroundingCityChunk {
  const pin=proof.packets.find((p:any)=>p.key===key), wire=readFileSync(new URL(pin.before.url,publicRoot));
  expect(createHash("sha256").update(wire).digest("hex")).toBe(pin.before.sha256);
  return JSON.parse(gunzipSync(wire).toString());
}
const count=(s:string,stride:number)=>Buffer.from(s,"base64").byteLength/stride;
function aggregate(entry:SurroundingChunkGeometry) {
  const mesh=entry.root.children.find(c=>c instanceof Mesh) as Mesh;
  const attr=mesh.geometry.getAttribute("position");
  if(!(attr instanceof InterleavedBufferAttribute))throw Error("Expected compact production aggregate");
  return {vertices:attr.data.array, indices:mesh.geometry.index!.array};
}
function lineValues(entry:SurroundingChunkGeometry) {
  const line=entry.root.children.find(c=>c instanceof LineSegments) as LineSegments|undefined;
  if(!line)return undefined;
  const attr=line.geometry.getAttribute("position");
  if(!(attr instanceof InterleavedBufferAttribute))throw Error("Expected compact ink");
  return {values:attr.data.array,stride:attr.data.stride};
}

test("six real packets retain all earlier vertices, unrelated indices, ink and navigation, with V305 admitted or absent",async()=>{
  expect(source.keys).toHaveLength(6);
  for(const key of source.keys)for(const admitV305 of [true,false]) {
    const [mode,id]=key.split(":"), native=mode==="minecraft", input=raw(key), snapshot=JSON.stringify(input);
    const options=await optionsV342(id,native,admitV305), prepared=await predecessorV342(input,id,native,admitV305), plan=source.packets[key];
    const preV=prepared.meshes.reduce((n,p)=>n+count(p.positions,6),0), preI=prepared.meshes.reduce((n,p)=>n+count(p.indices,4),0);
    const addV=count(plan.append!.positions,6), addI=count(plan.append!.indices,4);
    let baseline:SurroundingChunkGeometry|undefined, current:SurroundingChunkGeometry|undefined;
    try {
      baseline=done(buildSurroundingCityChunk(structuredClone(input),id,native,false,options));
      current=done(buildSurroundingCityChunk(input,id,native,false,{...options,neukoellnBuildingsV342:source}));
      expect(current.root.userData.sourceKinds).toContain(kind);
      expect(baseline.root.userData.sourceKinds).not.toContain(kind);
      expect(JSON.stringify(input)).toBe(snapshot);
      const a=aggregate(baseline),b=aggregate(current);
      expect(b.vertices.subarray(0,preV*6)).toEqual(a.vertices.subarray(0,preV*6));
      // Existing ground overlays follow the late replacement; none is lost.
      expect(b.vertices.subarray((preV+addV)*6)).toEqual(a.vertices.subarray(preV*6));
      const indices=a.indices.slice(0,preI), offsets:number[]=[];let offset=0;
      for(const part of prepared.meshes){offsets.push(offset);offset+=count(part.indices,4);}
      for(const retirement of plan.retire)for(const t of retirement.triangles){
        const at=offsets[retirement.mesh]+t*3;indices[at+1]=indices[at];indices[at+2]=indices[at];
      }
      expect(b.indices.subarray(0,preI).every((n,i)=>n===indices[i])).toBeTrue();
      expect(b.indices.subarray(preI+addI).every((n,i)=>n===a.indices[preI+i]+addV)).toBeTrue();
      expect(b.indices.length-a.indices.length).toBe(addI);
      expect(b.vertices.length-a.vertices.length).toBe(addV*6);
      const afterNav=structuredClone(baseline.nav);
      for(const retired of plan.retireNav){
        const at=afterNav.buildings.findIndex(b=>JSON.stringify(b)===JSON.stringify(retired));
        expect(at).toBeGreaterThanOrEqual(0);afterNav.buildings.splice(at,1);
      }
      afterNav.buildings.push(...plan.appendNav);
      expect(current.nav).toEqual(afterNav);
      const priorOwners=baseline.root.userData.sourceQuarterOwnersV303 as string[];
      expect(current.root.userData.sourceQuarterOwnersV303).toEqual([...priorOwners,...plan.owners]);
      const oldPlan=options.sourceQuarterSourcesV303?.find(p=>p.kind==="neukoelln-landmarks-v305")?.source.packets[key];
      for(const owner of oldPlan?.owners??[])expect(priorOwners.includes(owner)).toBe(admitV305);
      expect(current.root.userData.sourceQuarterTrianglesV303-baseline.root.userData.sourceQuarterTrianglesV303)
        .toBe(plan.retire.reduce((n,r)=>n+r.triangles.length,0));
      const la=lineValues(baseline),lb=lineValues(current);
      if(la&&lb){
        const expected=la.values.slice();
        for(const line of plan.retireLines){const at=line*2*la.stride;for(let axis=0;axis<3;axis++)expected[at+la.stride+axis]=expected[at+axis];}
        expect(lb.values.subarray(0,expected.length)).toEqual(expected);
        expect(lb.values.length-expected.length).toBe(plan.appendLines?count(plan.appendLines.positions,6)*lb.stride:0);
      }else expect(la).toBe(lb);
    }finally{if(baseline)disposeSurroundingCityRoot(baseline.root);if(current)disposeSurroundingCityRoot(current.root);}
  }
},180000);

test("production streaming lazy import admits complete buildings without disabling the earlier private owner",async()=>{
  for(const native of [false,true])for(const admitV305 of [true,false]){
    const id="ring182-8_8", input=raw(`${native?"minecraft":"drawn"}:${id}`),options=await optionsV342(id,native,admitV305);
    expect(options.neukoellnBuildingsV342).toBeUndefined();
    const entry=await createStreamedSurroundingCityChunkV255(input,id,native,{budgetMs:0,yield:async()=>{}},options);
    try{
      expect(entry.root.userData.sourceKinds).toContain(kind);
      expect(entry.root.userData.sourceQuarterOwnersV303).toContain("DEBE08YYF00003Pp");
      expect(entry.nav.buildings.some(b=>b.sourceId==="OSM-way-132238037")).toBeFalse();
      expect(entry.nav.buildings.some(b=>b.sourceId.includes("DEBE08YYF00003Pp"))).toBeTrue();
    }finally{disposeSurroundingCityRoot(entry.root);}
  }
},90000);

test("late hook rejects changed whole predecessors and incomplete recipes, and cancellation cannot mutate sources",async()=>{
  const id="ring182-8_8",input=raw(`drawn:${id}`), prepared=await predecessorV342(input,id,false,true),before=JSON.stringify(prepared);
  expect(done(prepareNeukoellnBuildingsV342(prepared,id,false))).toBe(prepared);
  expect(done(prepareNeukoellnBuildingsV342(prepared,"foreign",false,source))).toBe(prepared);
  for(const mutate of [
    (c:SurroundingCityChunk)=>{c.meshes[0].colors="AAAA"+c.meshes[0].colors.slice(4);},
    (c:SurroundingCityChunk)=>{c.nav.buildings[0].height+=1;},
    (c:SurroundingCityChunk)=>{c.origin[0]+=1;},
    (c:SurroundingCityChunk)=>{c.lines!.positions="AAAA"+c.lines!.positions.slice(4);},
  ]){
    const changed=structuredClone(prepared);mutate(changed);
    expect(done(prepareNeukoellnBuildingsV342(changed,id,false,source))===changed).toBeTrue();
  }
  const broken=structuredClone(source);broken.packets[`drawn:${id}`].append!.indices="AQAA"+broken.packets[`drawn:${id}`].append!.indices.slice(4);
  expect(done(prepareNeukoellnBuildingsV342(prepared,id,false,broken))===prepared).toBeTrue();
  const steps=prepareNeukoellnBuildingsV342(prepared,id,false,source);expect(steps.next().done).toBeFalse();steps.return(prepared);
  expect(JSON.stringify(prepared)).toBe(before);
  const current=done(prepareNeukoellnBuildingsV342(prepared,id,false,source));
  expect(current).not.toBe(prepared);
  expect(sourceQuarterOwnersV303(current)).toEqual([...sourceQuarterOwnersV303(prepared),...source.packets[`drawn:${id}`].owners]);
  expect(done(prepareNeukoellnBuildingsV342(current,id,false,source))).toBe(current);
  const control=new AbortController();control.abort();
  await expect(createStreamedSurroundingCityChunkV255(input,id,false,{signal:control.signal},await optionsV342(id,false))).rejects.toMatchObject({name:"AbortError"});
});

test("catalogue is lossless per-packet weak data with eager six keys",()=>{
  const text=readFileSync(new URL("../src/data/neukoellnBuildingsV342Packets.json",import.meta.url),"utf8");
  const transformed=transformLosslessJsonData(text,"/project/src/app/src/data/neukoellnBuildingsV342Packets.json");
  expect(transformed).toBeTruthy();
  const code=transformed!.code.replace(/^import[^\n]*\n/,"").replace(/^export \{.*\};$/m,"").replace("export default __source;","return __source;");
  let reads=0;
  const decoded=new Function("__decodeLosslessGzip",code)((s:string)=>{reads++;return decodeLosslessGzipJson(s)});
  expect(reads).toBe(0);
  expect(decoded.keys).toEqual(source.keys);
  for(const key of source.keys)expect(decoded.packets[key]).toEqual(source.packets[key]);
  expect(transformed!.code).toContain("WeakRef");
});
