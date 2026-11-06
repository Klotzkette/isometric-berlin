/** Pin the complete real raw and prepared pipeline; source packets stay exact. */
import {readFileSync,writeFileSync}from"node:fs";
import {gunzipSync}from"node:zlib";
import {resolve}from"node:path";
import {prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk}from"../src/SurroundingCityGeometry";
const repo=resolve(import.meta.dir,"../../.."),path=resolve(repo,"src/app/src/data/wilhelmStreetFrontsV325Packets.json");
const source=JSON.parse(readFileSync(path,"utf8"));
const hash=(v:unknown)=>{let h=2166136261;for(const c of typeof v==="string"?v:JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const next=g.next();if(next.done)return next.value;}};
const records=(c:SurroundingCityChunk)=>c.meshes.map((m,mesh)=>({mesh,kind:m.kind,fingerprint:hash(m.positions+m.colors+m.indices)}));
const proof=[];
for(const key of source.keys){
 const id=key.slice(6),chunk=JSON.parse(gunzipSync(readFileSync(resolve(repo,"src/app/public/mesh/surrounding-berlin-v159",id+".drawn.json.gz"))).toString())as SurroundingCityChunk,snapshot=JSON.stringify(chunk),p=source.packets[key];
 p.records=records(chunk);p.navGuard=hash(chunk.nav);p.lineGuard=chunk.lines?hash(chunk.lines.positions+(chunk.lines.colors??"")):null;
 const prepared=drain(prepareSurroundingQuarterPredecessorV303(chunk,id,false,{neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true}));
 p.preparedRecords=records(prepared);p.preparedNavGuard=hash(prepared.nav);p.preparedLineGuard=prepared.lines?hash(prepared.lines.positions+(prepared.lines.colors??"")):null;
 if(snapshot!==JSON.stringify(chunk))throw Error("Original packet mutated");
 proof.push({key,records:p.records.length,preparedRecords:p.preparedRecords.length,nav:p.navGuard,preparedNav:p.preparedNavGuard,lines:p.lineGuard,preparedLines:p.preparedLineGuard});
}
writeFileSync(path,JSON.stringify(source)+"\n");console.log(JSON.stringify(proof));
