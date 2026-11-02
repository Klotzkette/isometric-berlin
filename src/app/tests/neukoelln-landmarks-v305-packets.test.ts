import {expect,test}from "bun:test";
import {readFileSync}from "node:fs";
import {gunzipSync}from "node:zlib";
import {Group,LineSegments,Mesh}from "three";
import data from "../src/data/neukoellnLandmarksV305Packets.json";
import {buildSurroundingCityChunk,type SurroundingCityChunk}from "../src/SurroundingCityGeometry";
import type{SourceQuarterSourceV303}from "../src/SourceQuarterPacketV303";
import {createNeukoellnLandmarksV305,hasCompleteNeukoellnLandmarksV305}from "../src/NeukoellnLandmarksV305";
const source=data as unknown as SourceQuarterSourceV303;
const options={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,sourceQuarterSourcesV303:[{source,kind:"neukoelln-landmarks-v305",requiredReplacement:true}]};
const done=<T>(g:Generator<void,T>):T=>{let r=g.next();while(!r.done)r=g.next();return r.value;};
function packet(key:string):SurroundingCityChunk{const[mode,id]=key.split(":");return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());}
function dispose(root:Group){const gs=new Set<any>(),ms=new Set<any>();root.traverse((o:any)=>{if(o.geometry)gs.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial])if(m)ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();root.clear();}
for(const key of source.keys)test(`complete required v305 model gates exact whole-body/roof/nav transfer ${key}`,()=>{
 const[mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key),original=JSON.stringify(raw),model=createNeukoellnLandmarksV305(native),host=new Group();host.add(model);
 const baseline=done(buildSurroundingCityChunk(raw,id,native,false,{...options,neukoellnLandmarksV305:false}));
 const result=done(buildSurroundingCityChunk(raw,id,native,false,{...options,neukoellnLandmarksV305:hasCompleteNeukoellnLandmarksV305(model,native)}));
 try{
  const plan=source.packets[key];expect(baseline.root.userData.sourceQuarterOwnersV303).toEqual([]);expect(result.root.userData.sourceQuarterOwnersV303).toEqual(plan.owners);expect(result.root.userData.sourceQuarterTrianglesV303).toBe(plan.retire.reduce((n,r)=>n+r.triangles.length,0));expect(result.root.userData.sourceQuarterLineSegmentsV303??0).toBe(plan.retireLines.length);
  expect(result.nav.buildings).toEqual(baseline.nav.buildings.filter(b=>!plan.retireNav.some(old=>JSON.stringify(old)===JSON.stringify(b))));expect(result.nav.ground).toBe(baseline.nav.ground);expect(result.nav.water).toBe(baseline.nav.water);expect(JSON.stringify(result.nav.roads)===JSON.stringify(baseline.nav.roads)).toBe(true);expect(JSON.stringify(result.nav.bridges)===JSON.stringify(baseline.nav.bridges)).toBe(true);
  // These four plans retire only their exactly receipted original city part.
  expect(plan.retire.every(r=>r.mesh===0)).toBe(true);
  const b=baseline.root.children.find(o=>o instanceof Mesh)as Mesh,r=result.root.children.find(o=>o instanceof Mesh)as Mesh,bi=b.geometry.index!,ri=r.geometry.index!;
  const retired=new Set(plan.retire.flatMap(row=>row.triangles));expect(ri.count).toBe(bi.count);
  expect(Array.from({length:ri.count/3},(_,i)=>i).every(t=>retired.has(t)?ri.getX(t*3)===bi.getX(t*3)&&ri.getX(t*3+1)===bi.getX(t*3)&&ri.getX(t*3+2)===bi.getX(t*3):[0,1,2].every(a=>ri.getX(t*3+a)===bi.getX(t*3+a)))).toBe(true);
  if(!native){const bl=baseline.root.children.find(o=>o instanceof LineSegments)as LineSegments,rl=result.root.children.find(o=>o instanceof LineSegments)as LineSegments,ba=bl.geometry.getAttribute("position"),ra=rl.geometry.getAttribute("position"),retiredLines=new Set(plan.retireLines);expect(ra.count).toBe(ba.count);expect(Array.from({length:ra.count/2},(_,i)=>i).every(i=>[0,1].every(endpoint=>[0,1,2].every(axis=>ra.getComponent(i*2+endpoint,axis)===ba.getComponent(i*2+(retiredLines.has(i)?0:endpoint),axis))))).toBe(true);}
  expect(JSON.stringify(raw)).toBe(original);
 }finally{dispose(baseline.root);dispose(result.root);dispose(host);}
},60000);
test("changed predecessor or absent required admission keeps the complete original site",()=>{
 const key=source.keys[0],[mode,id]=key.split(":"),raw=packet(key);raw.nav.buildings[0].height+=.01;
 const result=done(buildSurroundingCityChunk(raw,id,mode==="minecraft",false,{...options,neukoellnLandmarksV305:true}));try{expect(result.root.userData.sourceQuarterOwnersV303).toEqual([]);expect(result.nav).toBe(raw.nav);}finally{dispose(result.root);}
});
