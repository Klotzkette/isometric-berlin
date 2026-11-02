import { expect, test } from "bun:test";
import { applyNeighbourhoodTrianglesV300, captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300, neighbourhoodPacketAdmittedV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

function done<T>(g: Generator<void, T>): T { let n = g.next(); while (!n.done) n = g.next(); return n.value; }
const hash=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619)>>>0;return n;};
const b64=(a:Uint16Array|Uint32Array|Uint8Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function fixture() {
  const part:SurroundingPackedMesh={kind:"source-body-and-old-fittings",positionType:"u16cm",positions:b64(new Uint16Array([0,0,0,100,0,0,0,100,0,100,100,0])),colors:b64(new Uint8Array(12).fill(80)),indices:b64(new Uint32Array([0,1,2,1,3,2]))};
  const append={...part,kind:"complete-new-front"};
  const raw={schemaVersion:1,origin:[0,0,0],meshes:[part],nav:{ground:[],buildings:[],water:[],groundY:0}} as SurroundingCityChunk;
  const source:NeighbourhoodSourceV300={schemaVersion:1,keys:["drawn:test"],packets:{"drawn:test":{origin:[0,0,0],navGuard:hash(JSON.stringify(raw.nav)),records:[{mesh:0,kind:part.kind,fingerprint:hash(part.positions+part.colors+part.indices)}],lineGuard:null,append,appendFingerprint:hash(append.positions+append.colors+append.indices),retire:[{mesh:0,triangles:[1]}],owners:["exact-source-owner"]}}};
  return {raw,source};
}
test("whole source guards and complete append precede exactly receipted fitting retirement",()=>{
  const {raw,source}=fixture(),snapshot=JSON.stringify(raw);
  expect(done(captureNeighbourhoodPacketV300(raw,"test",false,false,source,"complete-new-front"))).toBeUndefined();
  const ticket=done(captureNeighbourhoodPacketV300(raw,"test",false,true,source,"complete-new-front"));expect(typeof ticket).toBe("function");
  const prepared=done(prepareNeighbourhoodPacketV300(raw,ticket));expect(neighbourhoodPacketAdmittedV300(prepared)).toBeTrue();
  expect(prepared.nav).toBe(raw.nav);expect(prepared.meshes[0]).toBe(raw.meshes[0]);expect(JSON.stringify(raw)).toBe(snapshot);
  const indices=new Uint32Array([0,1,2,1,3,2]);expect(done(applyNeighbourhoodTrianglesV300(prepared,0,indices,0))).toBe(1);expect([...indices]).toEqual([0,1,2,1,1,1]);
  expect(done(prepareNeighbourhoodPacketV300(prepared,ticket))).toBe(prepared);
  expect(neighbourhoodPacketAdmittedV300(JSON.parse(JSON.stringify(prepared)))).toBeFalse();
  const missing={...prepared,meshes:[prepared.meshes[0]]};expect(neighbourhoodPacketAdmittedV300(missing)).toBeFalse();
  const intact=new Uint32Array([0,1,2,1,3,2]);expect(done(applyNeighbourhoodTrianglesV300(missing,0,intact,0))).toBe(0);
});
test("foreign packets never read heavy plans; changed source, invalid topology and duplicate receipts fail closed",()=>{
  const {raw,source}=fixture();let reads=0;const plan=source.packets["drawn:test"];
  Object.defineProperty(source.packets,"drawn:test",{get(){reads++;return plan;}});
  expect(done(captureNeighbourhoodPacketV300(raw,"foreign",false,true,source,"complete-new-front"))).toBeUndefined();expect(reads).toBe(0);
  for(const mutate of [(r:SurroundingCityChunk)=>r.origin[0]++, (r:SurroundingCityChunk)=>r.nav.groundY++, (r:SurroundingCityChunk)=>r.meshes[0].colors="AAAA"+r.meshes[0].colors.slice(4)]){
    const r=structuredClone(raw);mutate(r);expect(done(captureNeighbourhoodPacketV300(r,"test",false,true,source,"complete-new-front"))).toBeUndefined();
  }
  for(const mutate of [(s:NeighbourhoodSourceV300)=>s.packets["drawn:test"].retire[0].triangles.push(1), (s:NeighbourhoodSourceV300)=>s.packets["drawn:test"].append.indices=b64(new Uint32Array([0,1,99])), (s:NeighbourhoodSourceV300)=>s.packets["drawn:test"].records[0].fingerprint++]){
    const s=structuredClone({schemaVersion:source.schemaVersion,keys:source.keys,packets:{"drawn:test":plan}});mutate(s);expect(done(captureNeighbourhoodPacketV300(raw,"test",false,true,s,"complete-new-front"))).toBeUndefined();
  }
  const ticket=done(captureNeighbourhoodPacketV300(raw,"test",false,true,source,"complete-new-front"));raw.meshes[0].colors="AAAA"+raw.meshes[0].colors.slice(4);expect(done(prepareNeighbourhoodPacketV300(raw,ticket))).toBe(raw);
});
