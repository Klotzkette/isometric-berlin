import {expect,test} from "bun:test";
import {applySourceQuarterLinesV303,applySourceQuarterTrianglesV303,captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303,sourceQuarterNavigationV303,sourceQuarterOwnersV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {surroundingBuildingSolidAt,type SurroundingCityChunk,type SurroundingPackedMesh} from "../src/SurroundingCityGeometry";
const done=<T>(g:Generator<void,T>):T=>{let s=g.next();while(!s.done)s=g.next();return s.value;};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const b64=(a:Uint16Array|Uint32Array|Uint8Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function fixture(){
  const part:SurroundingPackedMesh={kind:"city",positionType:"u16cm",positions:b64(new Uint16Array([0,0,0,100,0,0,0,100,0,100,100,0])),colors:b64(new Uint8Array(12).fill(80)),indices:b64(new Uint32Array([0,1,2,1,3,2]))};
  const old={ring:[[0,0],[1,0],[1,1],[0,1]],holes:[],height:2,minHeight:0,sourceId:"old-false-cap"};
  const foreign={...old,sourceId:"foreign",ring:[[3,0],[4,0],[4,1],[3,1]]};
  const lines={positions:b64(new Uint16Array([0,200,0,100,200,0,300,200,0,400,200,0])),colors:b64(new Uint8Array(12).fill(70))};
  const raw:SurroundingCityChunk={schemaVersion:1,origin:[0,0,0],meshes:[part],lines,nav:{ground:[],water:[],buildings:[old,foreign],groundY:0}};
  const append={...part,kind:"new-quarter"},pin={mesh:0,kind:part.kind,fingerprint:hash(part.positions+part.colors+part.indices)};
  const next={...old,sourceId:"complete-official-family",height:3,roofTriangles:[[[0,2,0],[1,3,0],[0,2,1]],[[1,3,0],[1,3,1],[0,2,1]]]};
  const source:SourceQuarterSourceV303={schemaVersion:1,keys:["drawn:test"],packets:{"drawn:test":{origin:[0,0,0],records:[pin],preparedRecords:[pin],navGuard:hash(JSON.stringify(raw.nav)),preparedNavGuard:hash(JSON.stringify(raw.nav)),lineGuard:hash(lines.positions+lines.colors),preparedLineGuard:hash(lines.positions+lines.colors),append,appendFingerprint:hash(append.positions+append.colors+append.indices),retire:[{mesh:0,triangles:[0]}],retireLines:[0],appendLines:{positions:b64(new Uint16Array([0,200,0,100,300,0])),colors:b64(new Uint8Array(6).fill(90))},retireNav:[old],appendNav:[next],owners:[next.sourceId]}}};
  return {raw,source,foreign};
}
test("complete body, roof ink and granular roof collision transfer preserve the outside complement",()=>{
  const {raw,source,foreign}=fixture(),snapshot=JSON.stringify(raw);
  const ticket=done(captureSourceQuarterPacketV303(raw,"test",false,true,source,"new-quarter"));expect(ticket).toBeFunction();
  const chunk=done(prepareSourceQuarterPacketV303(raw,ticket));
  expect(sourceQuarterOwnersV303(chunk)).toEqual(["complete-official-family"]);
  const indices=new Uint32Array([0,1,2,1,3,2]);expect(done(applySourceQuarterTrianglesV303(chunk,0,indices,0))).toBe(1);expect([...indices]).toEqual([0,0,0,1,3,2]);
  const ink=new Uint16Array(6*6);for(let i=0;i<4;i++){ink.set([i*100,200,0,70,70,70],i*6);}const foreignInk=[...ink.slice(12,24)];
  expect(done(applySourceQuarterLinesV303(chunk,ink,6,4))).toBe(1);expect([...ink.slice(0,3)]).toEqual([...ink.slice(6,9)]);expect([...ink.slice(12,24)]).toEqual(foreignInk);expect([...ink.slice(24,36)]).toEqual([0,200,0,23130,23130,23130,100,300,0,23130,23130,23130]);
  const nav=sourceQuarterNavigationV303(chunk,raw.nav);expect(nav.buildings[0]).toBe(foreign);expect(nav.buildings[1].sourceId).toBe("complete-official-family");
  expect(surroundingBuildingSolidAt(nav,.25,2.2,.25)).toBeTrue();expect(surroundingBuildingSolidAt(nav,.25,2.6,.25)).toBeFalse();
  expect(JSON.stringify(raw)).toBe(snapshot);
});
test("closed defaults, complete old/prepared pins, replacement topology and changed late navigation",()=>{
  const {raw,source}=fixture();let reads=0;const p=source.packets["drawn:test"];Object.defineProperty(source.packets,"drawn:test",{get(){reads++;return p;}});
  expect(done(captureSourceQuarterPacketV303(raw,"test",false,false,source,"new-quarter"))).toBeUndefined();expect(done(captureSourceQuarterPacketV303(raw,"foreign",false,true,source,"new-quarter"))).toBeUndefined();expect(reads).toBe(0);
  for(const mutate of [(s:SourceQuarterSourceV303)=>s.packets["drawn:test"].preparedRecords[0].fingerprint++, (s:SourceQuarterSourceV303)=>s.packets["drawn:test"].retireLines.push(0),(s:SourceQuarterSourceV303)=>s.packets["drawn:test"].retireNav[0].height++]){
    const changed=structuredClone({schemaVersion:1,keys:source.keys,packets:{"drawn:test":p}});mutate(changed);const t=done(captureSourceQuarterPacketV303(raw,"test",false,true,changed,"new-quarter"));expect(done(prepareSourceQuarterPacketV303(raw,t))).toBe(raw);
  }
  const t=done(captureSourceQuarterPacketV303(raw,"test",false,true,source,"new-quarter")),chunk=done(prepareSourceQuarterPacketV303(raw,t));
  expect(()=>sourceQuarterNavigationV303(chunk,{...raw.nav,buildings:[]})).toThrow();
  const missing={...chunk,meshes:[chunk.meshes[0]]};expect(()=>done(applySourceQuarterTrianglesV303(missing,0,new Uint32Array(6),0))).toThrow();
  expect(sourceQuarterOwnersV303(JSON.parse(JSON.stringify(chunk)))).toEqual([]);
});
test("independent native stepped caps and courtyard holes stay physically open",()=>{
  const {raw}=fixture();raw.nav.buildings=[{...raw.nav.buildings[0],height:4,holes:[[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]],nativeRoofCaps:[[0,0,.5,1,2],[.5,0,1,1,4]]}];
  expect(surroundingBuildingSolidAt(raw.nav,.1,2.1,.1)).toBeFalse();expect(surroundingBuildingSolidAt(raw.nav,.9,3.9,.1)).toBeTrue();expect(surroundingBuildingSolidAt(raw.nav,.6,1,.6)).toBeFalse();
});
test("recipe snapshots precede hashing yields and cannot leak mutable replacement nav",()=>{
  const {raw,source}=fixture(),original=structuredClone(source.packets["drawn:test"]);
  const capture=captureSourceQuarterPacketV303(raw,"test",false,true,source,"new-quarter");
  expect(capture.next().done).toBe(false);
  source.packets["drawn:test"].append!.indices="AAAA";
  source.packets["drawn:test"].retire=[{mesh:0,triangles:[1]}];
  source.packets["drawn:test"].appendNav[0].height=100;
  const ticket=done(capture),ready=done(prepareSourceQuarterPacketV303(raw,ticket));
  expect(sourceQuarterOwnersV303(ready)).toEqual(original.owners);
  expect(ready.meshes.at(-1)!.indices).toBe(original.append!.indices);
  const ix=new Uint32Array([0,1,2,1,3,2]);done(applySourceQuarterTrianglesV303(ready,0,ix,0));expect([...ix]).toEqual([0,0,0,1,3,2]);
  const nav=sourceQuarterNavigationV303(ready,raw.nav),replacement=nav.buildings.at(-1)!;
  expect(replacement.height).toBe(3);expect(Object.isFrozen(replacement)).toBeTrue();expect(Object.isFrozen(replacement.roofTriangles)).toBeTrue();
});
test("raw and prepared mutation during hashing cannot acquire an ownership ticket",()=>{
  {const {raw,source}=fixture(),g=captureSourceQuarterPacketV303(raw,"test",false,true,source,"new-quarter");g.next();raw.meshes[0].colors=raw.meshes[0].colors.slice(0,-4)+"AAAA";expect(done(g)).toBeUndefined();}
  {const {raw,source}=fixture(),ticket=done(captureSourceQuarterPacketV303(raw,"test",false,true,source,"new-quarter")),prepared={...raw,meshes:raw.meshes.map(p=>({...p}))},g=prepareSourceQuarterPacketV303(prepared,ticket);g.next();prepared.meshes[0].colors=prepared.meshes[0].colors.slice(0,-4)+"AAAA";const ready=done(g);expect(ready).toBe(prepared);expect(sourceQuarterOwnersV303(ready)).toEqual([]);}
  {const {raw,source}=fixture(),ticket=done(captureSourceQuarterPacketV303(raw,"test",false,true,source,"new-quarter")),prepared={...raw,nav:structuredClone(raw.nav)},g=prepareSourceQuarterPacketV303(prepared,ticket);g.next();prepared.nav.buildings[0].height++;const ready=done(g);expect(ready).toBe(prepared);expect(sourceQuarterOwnersV303(ready)).toEqual([]);}
});
test("pitched roof walls retain horizontal radius clearance at their actual nearest edge height",()=>{
  const {raw,source}=fixture();raw.nav.buildings=[source.packets["drawn:test"].appendNav[0]];
  expect(surroundingBuildingSolidAt(raw.nav,-.1,1,.5,.2)).toBeTrue();
  expect(surroundingBuildingSolidAt(raw.nav,-.21,1,.5,.2)).toBeFalse();
  expect(surroundingBuildingSolidAt(raw.nav,-.1,2.15,.5,.2)).toBeTrue();
  expect(surroundingBuildingSolidAt(raw.nav,-.1,2.25,.5,.2)).toBeFalse();
  expect(surroundingBuildingSolidAt(raw.nav,.75,2.8,-.1,.2)).toBeTrue();
  expect(surroundingBuildingSolidAt(raw.nav,.75,2.98,-.1,.2)).toBeFalse();
  raw.nav.buildings[0]={...raw.nav.buildings[0],holes:[[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]]};
  expect(surroundingBuildingSolidAt(raw.nav,.5,1,.5,.2)).toBeFalse();
  expect(surroundingBuildingSolidAt(raw.nav,.25,1,.5,.1)).toBeTrue();
});
