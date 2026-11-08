/** Final raw/prepared guards from the real unchanged complete predecessor. */
import {readFileSync,writeFileSync}from"node:fs";
import {gunzipSync}from"node:zlib";
import {resolve}from"node:path";
import{prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk}from"../src/SurroundingCityGeometry";
const repo=resolve(import.meta.dir,"../../.."),path=resolve(repo,"src/app/src/data/northEastPublicSitesV326Packets.json");
const source=JSON.parse(readFileSync(path,"utf8"));
const hash=(v:unknown)=>{let h=2166136261;for(const c of typeof v==="string"?v:JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const records=(c:SurroundingCityChunk)=>c.meshes.map((p,mesh)=>({mesh,kind:p.kind,fingerprint:hash(p.positions+p.colors+p.indices)}));
const result=[];
for(const key of source.keys){
 const [mode,id]=key.split(":"),native=mode==="minecraft",raw=JSON.parse(gunzipSync(readFileSync(resolve(repo,"src/app/public/mesh/surrounding-berlin-v159",id+"."+mode+".json.gz"))).toString())as SurroundingCityChunk,before=JSON.stringify(raw),p=source.packets[key];
 p.records=records(raw);p.navGuard=hash(raw.nav);p.lineGuard=raw.lines?hash(raw.lines.positions+(raw.lines.colors??"")):null;
 const prepared=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,{neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true}));
 p.preparedRecords=records(prepared);p.preparedNavGuard=hash(prepared.nav);p.preparedLineGuard=prepared.lines?hash(prepared.lines.positions+(prepared.lines.colors??"")):null;
 if(before!==JSON.stringify(raw))throw Error("Original packet mutated");result.push({key,rawMeshes:p.records.length,preparedMeshes:p.preparedRecords.length,rawNav:p.navGuard,preparedNav:p.preparedNavGuard});
}
writeFileSync(path,JSON.stringify(source)+"\n");console.log(JSON.stringify(result));
