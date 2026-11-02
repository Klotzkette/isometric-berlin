import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import data from "../src/data/rixdorfV304.json";
import {buildSurroundingCityChunk,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import type {SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";

const source=data as unknown as SourceQuarterSourceV303;
const options={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,sourceQuarterSourcesV303:[{source,kind:"rixdorf-v304"}]};
function done<T>(g:Generator<void,T>):T{let s=g.next();while(!s.done)s=g.next();return s.value;}
function packet(key:string):SurroundingCityChunk{const [mode,id]=key.split(":");return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());}
function dispose(root:any){const gs=new Set<any>(),ms=new Set<any>();root.traverse((o:any)=>{if(o.geometry)gs.add(o.geometry);for(const v of [o.material,o.userData.dayMaterial,o.userData.nightMaterial])if(v){if(Array.isArray(v))v.forEach(m=>ms.add(m));else ms.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}

test("all eight real Rixdorf packets publish complete body, roofs, ink and matching navigation",()=>{
  expect(source.keys.length).toBe(8);
  for(const key of source.keys){
    const [mode,id]=key.split(":"),raw=packet(key),before=JSON.stringify(raw),plan=source.packets[key];
    const baseline=done(buildSurroundingCityChunk(raw,id,mode==="minecraft",false,{...options,sourceQuartersV303:false}));
    const priorNav=baseline.nav;dispose(baseline.root);
    const result=done(buildSurroundingCityChunk(raw,id,mode==="minecraft",false,options));
    try{
      expect(result.root.userData.sourceQuarterOwnersV303).toEqual(plan.owners);
      expect(result.root.userData.sourceQuarterTrianglesV303).toBe(plan.retire.reduce((n,r)=>n+r.triangles.length,0));
      expect(result.nav.buildings.filter(b=>plan.retireNav.some(o=>o.sourceId===b.sourceId))).toEqual([]);
      expect(result.nav.buildings.slice(-plan.appendNav.length)).toEqual(plan.appendNav);
      const outside=priorNav.buildings.filter(b=>!plan.retireNav.some(o=>JSON.stringify(o)===JSON.stringify(b)));
      expect(result.nav.buildings.slice(0,outside.length)).toEqual(outside);
      expect(result.nav.ground).toBe(priorNav.ground);expect(result.nav.water).toBe(priorNav.water);
      expect(JSON.stringify(raw)).toBe(before);
      expect(result.geometryBytes).toBeGreaterThan(0);
    }finally{dispose(result.root);}
  }
},60000);
