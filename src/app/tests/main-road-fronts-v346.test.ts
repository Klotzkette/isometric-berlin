import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {mainRoadFrontsEntriesV346} from "../src/MainRoadFrontsV346";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
import {captureSourceQuarterPacketV303} from "../src/SourceQuarterPacketV303";
import {createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309} from "../src/SourceQuarterCatalogueV309";
import {groundOverlayKindsV329,prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
const root=new URL("../../..",import.meta.url),kind="main-road-fronts-v346";
const receipt=JSON.parse(gunzipSync(readFileSync(new URL("geo_data/regierungsviertel/main-road-fronts-v346-receipt.json.gz",root))).toString());
const publicDir=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",publicDir),"utf8"));
const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
function drain<T>(steps:Generator<void,T>):T{for(;;){const n=steps.next();if(n.done)return n.value;}}
const settings:SurroundingOwnershipOptions={neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,sourceQuartersV303:true,northFidelityV309:true,treptowWaterfrontV317:true,neukoellnLandmarksV305:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true};
const before=SOURCE_QUARTER_CATALOGUE_V309.slice(0,SOURCE_QUARTER_CATALOGUE_V309.findIndex(e=>e.kind===kind)).filter(e=>!groundOverlayKindsV329.has(e.kind));
const loadBefore=createSourceQuarterRecipeLoaderV309(before);
test("all road fronts retain exact two-family sources and bounded lazy recipes",()=>{
 expect(receipt.counts.owners).toBe(3503);expect(receipt.actualPreparedGuards.length).toBe(946);expect(receipt.pendingBunPrimaryGuards).toEqual([]);
 expect(mainRoadFrontsEntriesV346.length).toBe(30);
 const keys=mainRoadFrontsEntriesV346.flatMap(e=>e.keys);expect(new Set(keys).size).toBe(946);expect(mainRoadFrontsEntriesV346.every(e=>e.keys.length<=32)).toBe(true);
 for(const [file,hash] of Object.entries(receipt.runtimeSources))expect(sha(readFileSync(new URL(`../src/data/${file}`,import.meta.url)))).toBe(hash);
 const distinct=new Set<string>();
 for(const r of receipt.sourceOwners){expect(distinct.has(r.owner)).toBe(false);distinct.add(r.owner);expect(r.footprintIoU).toBeGreaterThanOrEqual(.97);expect(r.modes.drawn.every((f:any)=>f.floors===r.mappedStoreys)).toBe(true);expect(r.modes.minecraft.every((f:any)=>f.floors===r.mappedStoreys)).toBe(true);expect(keys.includes(`drawn:${r.host}`)&&keys.includes(`minecraft:${r.host}`)).toBe(true);}
 for(const [key,d] of Object.entries(receipt.sourceInputs) as [string,any][]){const [mode,id]=key.split(":");expect(manifest.chunks.find((r:any)=>r.id===id)[mode]).toEqual(d);}
});
for(const native of [false,true])test(`main-road ${native?"Native":"Drawn"}: production host and changed-source rejection`,async()=>{
 for(const district of ["Mitte","Pankow","Spandau","Neukölln"]){
  const row=receipt.sourceOwners.find((r:any)=>r.district===district),id=row.host,mode=native?"minecraft":"drawn",key=`${mode}:${id}`;
  const d=manifest.chunks.find((r:any)=>r.id===id)[mode];
  const raw=JSON.parse(gunzipSync(readFileSync(new URL(d.url,publicDir))).toString()) as SurroundingCityChunk;
  const entry=mainRoadFrontsEntriesV346.find(e=>e.keys.includes(key))!;
  const source=(await entry.load()).default as NeighbourhoodSourceV300;
  const recipes=await loadBefore(id,native),tickets=recipes.map(e=>e.source.packets[key]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,e.source as unknown as NeighbourhoodSourceV300,e.kind)));
  let p=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,{...settings,sourceQuarterSourcesV303:recipes}));for(const t of tickets)if(t)p=drain(t(p));
  const t=drain(captureNeighbourhoodPacketV300(raw,id,native,true,source,kind));expect(t).toBeDefined();const result=drain(t!(p));
  expect(result.meshes.length).toBe(p.meshes.length+1);expect(result.meshes.slice(0,-1)).toEqual(p.meshes);expect(result.nav).toBe(p.nav);expect(result.lines).toBe(p.lines);expect(source.packets[key].retire).toEqual([]);
  const changed=structuredClone(raw);changed.nav.buildings[0].height+=.01;expect(drain(captureNeighbourhoodPacketV300(changed,id,native,true,source,kind))).toBeUndefined();
  const wrong=structuredClone(p);wrong.nav.groundY+=.01;expect(drain(t!(wrong))).toBe(wrong);expect(drain(t!(result))).toBe(result);
 }
},60_000);
