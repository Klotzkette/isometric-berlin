/** Exact final older-pipeline metadata only. Every append word is immutable. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {buildSurroundingCityChunk,prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {captureSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
const repo=resolve(import.meta.dir,"../../.."),pub=resolve(repo,"src/app/public/mesh/surrounding-berlin-v159"),indexPath=resolve(repo,"src/app/src/data/networkFidelityV326Index.json"),index=JSON.parse(readFileSync(indexPath,"utf8")),KIND="network-fidelity-v326";
const baselineBytes=gunzipSync(readFileSync(resolve(repo,"geo_data/regierungsviertel/public-fidelity-v326-published206-manifest.json.gz")));if(createHash("sha256").update(baselineBytes).digest("hex")!=="a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e")throw Error("Changed frozen206 source");
const descriptors=new Map<string,any>(JSON.parse(baselineBytes.toString()).chunks.map((d:any)=>[d.id,d]));
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
const done=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const hash=(v:unknown)=>{let h=2166136261;for(const c of typeof v==="string"?v:JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const records=(c:SurroundingCityChunk)=>c.meshes.map((p,mesh)=>({mesh,kind:p.kind,fingerprint:hash(p.positions+p.colors+p.indices)}));
let count=0;const changed:string[]=[],failures:unknown[]=[],kindFailures:string[]=[];
for(const entry of index.sources){const path=resolve(repo,"src/app/src/data",entry.file),source=JSON.parse(readFileSync(path,"utf8")) as SourceQuarterSourceV303;
 for(const key of source.keys){const [mode,id]=key.split(":"),native=mode==="minecraft",descriptor=descriptors.get(id);if(!descriptor)throw Error("Foreign source key "+key);
  const rawPath=resolve(pub,descriptor[mode].url),bytes=readFileSync(rawPath),raw=JSON.parse((rawPath.endsWith(".gz")?gunzipSync(bytes):bytes).toString())as SurroundingCityChunk,snapshot=JSON.stringify(raw),plan=source.packets[key],appendBefore=JSON.stringify(plan.append);
  const older=(await loadSourceQuarterRecipesV309(id,native)).filter(r=>r.kind!==KIND),options={...flags,sourceQuarterSourcesV303:older};
  const tickets=older.map(e=>e.source.packets[key]?.preparedRecords?done(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):done(captureNeighbourhoodPacketV300(raw,id,native,true,e.source as unknown as NeighbourhoodSourceV300,e.kind))).filter(t=>!!t);
  let prepared=done(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,options));for(const ticket of tickets)prepared=done(ticket!(prepared));
  const before=JSON.stringify([plan.records,plan.preparedRecords,plan.navGuard,plan.preparedNavGuard,plan.lineGuard,plan.preparedLineGuard]);
  plan.records=records(raw);plan.preparedRecords=records(prepared);plan.navGuard=hash(raw.nav);plan.preparedNavGuard=hash(prepared.nav);plan.lineGuard=raw.lines?hash(raw.lines.positions+(raw.lines.colors??"")):null;plan.preparedLineGuard=prepared.lines?hash(prepared.lines.positions+(prepared.lines.colors??"")):null;
  if(before!==JSON.stringify([plan.records,plan.preparedRecords,plan.navGuard,plan.preparedNavGuard,plan.lineGuard,plan.preparedLineGuard]))changed.push(key);
  try{const actual=done(buildSurroundingCityChunk(structuredClone(raw),id,native,false,{...options,sourceQuarterSourcesV303:[...older,{source,kind:KIND}]}));try{if(!actual.root.userData.sourceKinds?.includes(KIND))kindFailures.push(key);if(actual.geometryBytes>24*1024*1024)throw Error("Changed residency limit");}finally{disposeSurroundingCityRoot(actual.root);}}
  catch(error){failures.push({key,error:String(error)});}
  if(snapshot!==JSON.stringify(raw)||appendBefore!==JSON.stringify(plan.append))throw Error("Original or new append geometry changed");count++;if(count%100===0)console.log(JSON.stringify({checked:count,changed:changed.length,failures:failures.length,kindFailures:kindFailures.length}));
 }
 const output=JSON.stringify(source)+"\n";writeFileSync(path,output);entry.rawBytes=Buffer.byteLength(output);entry.rawSha256=createHash("sha256").update(output).digest("hex");Bun.gc(true);
}
writeFileSync(indexPath,JSON.stringify(index)+"\n");console.log(JSON.stringify({complete:true,count,changed,failures,kindFailures}));if(failures.length||kindFailures.length)process.exitCode=1;
