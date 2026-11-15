import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Mesh,Raycaster,Vector3} from "three";
import recipe from "../src/data/schwanenwerderV346Packets.json";
import {buildSurroundingCityChunk,surroundingBuildingSolidAt,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import {captureSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";
const source=recipe as unknown as SourceQuarterSourceV303;
const done=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const packet=(key:string):SurroundingCityChunk=>{const [mode,id]=key.split(":");return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());};
const options={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,sourceQuarterSourcesV303:[{source,kind:"schwanenwerder-v346"}]};
test("eight island packets retain foreign nav and replace whole measured villas and roof navigation",()=>{
 const old=new Set<string>(),parents=new Set<string>();let maxBytes=0,samples=0;
 for(const key of source.keys){
  const [mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key),before=JSON.stringify(raw),p=source.packets[key];
  const baseline=done(buildSurroundingCityChunk(raw,id,native,false,{...options,sourceQuartersV303:false}));
  const result=done(buildSurroundingCityChunk(raw,id,native,false,options));
  try{
   expect(result.root.userData.sourceQuarterOwnersV303).toEqual(p.owners);
   expect(result.root.userData.sourceQuarterTrianglesV303).toBe(p.retire.reduce((n,r)=>n+r.triangles.length,0));
   expect(result.nav.buildings.filter(b=>p.retireNav.some(o=>o.sourceId===b.sourceId))).toEqual([]);
   expect(result.nav.buildings.slice(-p.appendNav.length)).toEqual(p.appendNav);
   const foreign=baseline.nav.buildings.filter(b=>!p.retireNav.some(o=>JSON.stringify(o)===JSON.stringify(b)));
   expect(result.nav.buildings.slice(0,foreign.length)).toEqual(foreign);
   for(const k of["ground","roads","water","bridges","groundY"]as const)expect(result.nav[k]).toEqual(baseline.nav[k]);
   expect(JSON.stringify(raw)).toBe(before);maxBytes=Math.max(maxBytes,result.geometryBytes);
   p.retireNav.forEach(b=>old.add(b.sourceId));p.owners.forEach(id=>parents.add(id));result.root.updateMatrixWorld(true);
   for(const nav of p.appendNav.filter((_,i)=>i%8===0)){
    let x:number,z:number,y:number;
    if(native){const r=nav.nativeRoofCaps?.[0];if(!r)continue;[x,z,y]=[(r[0]+r[2])/2,(r[1]+r[3])/2,r[4]];}
    else{const r=nav.roofTriangles?.[0];if(!r)continue;[x,z,y]=[(r[0][0]+r[1][0]+r[2][0])/3,(r[0][2]+r[1][2]+r[2][2])/3,(r[0][1]+r[1][1]+r[2][1])/3];}
    const hit=new Raycaster(new Vector3(x+raw.origin[0],80,z+raw.origin[2]),new Vector3(0,-1,0)).intersectObject(result.root,true).find(h=>h.object instanceof Mesh);
    expect(hit).toBeDefined();expect(hit!.point.y).toBeGreaterThanOrEqual(y+3-.08);
    expect(surroundingBuildingSolidAt(result.nav,x,y+3-.12,z)).toBeTrue();samples++;
   }
  }finally{disposeSurroundingCityRoot(result.root);disposeSurroundingCityRoot(baseline.root);}
 }
 expect(old.size).toBe(91);expect(parents.size).toBe(111);expect(samples).toBeGreaterThan(40);expect(maxBytes).toBeLessThan(6*1024*1024);console.log({parents:parents.size,oldOwners:old.size,roofSamples:samples,maxGeometryBytes:maxBytes});
},60000);
test("wrong family, missing measured body or altered old nav cannot retire island owners",()=>{
 for(const key of source.keys){const [mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key);
  expect(done(captureSourceQuarterPacketV303(raw,id,native,true,source,"schwanenwerder-v346"))).toBeDefined();
  expect(done(captureSourceQuarterPacketV303(raw,id,!native,true,source,"schwanenwerder-v346"))).toBeUndefined();
  const incomplete=structuredClone(source);delete incomplete.packets[key].append;
  expect(done(captureSourceQuarterPacketV303(raw,id,native,true,incomplete,"schwanenwerder-v346"))).toBeUndefined();
  raw.nav.buildings.pop();expect(done(captureSourceQuarterPacketV303(raw,id,native,true,source,"schwanenwerder-v346"))).toBeUndefined();
 }
});
