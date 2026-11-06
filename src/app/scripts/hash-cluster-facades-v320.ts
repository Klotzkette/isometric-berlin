/** Finalize exact raw/prepared guards using the actual retained packet pipeline.
 * No city/GPU geometry is created, no original public packet is written. */
import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync,gzipSync} from "node:zlib";
import path from "node:path";
import {prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk,
  type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303,
  type SourceQuarterTicketV303} from "../src/SourceQuarterPacketV303";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";

const repo=path.resolve(import.meta.dir,"../../..");
const runtimePath=process.argv[2]??path.join(repo,"src/app/src/data/clusterFacadesV320.json");
const proofPath=process.argv[3]??path.join(repo,"geo_data/regierungsviertel/cluster-facades-v320-evidence.json.gz");
const publicDir=path.join(repo,"src/app/public/mesh/surrounding-berlin-v159");
const runtime=JSON.parse(readFileSync(runtimePath,"utf8")) as NeighbourhoodSourceV300;
const proof=JSON.parse(gunzipSync(readFileSync(proofPath)).toString());
const descriptors=new Map(JSON.parse(readFileSync(path.join(publicDir,"manifest.json"),"utf8")).chunks.map((c:any)=>[c.id,c]));
const fnv=(texts:string[])=>{let h=2166136261;for(const s of texts)for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
function drain<T>(steps:Generator<void,T>):T{let r=steps.next();while(!r.done)r=steps.next();return r.value;}
const reports=[];
for(const key of runtime.keys){
  const separator=key.indexOf(":"),mode=key.slice(0,separator),id=key.slice(separator+1);
  const native=mode==="minecraft",descriptor=descriptors.get(id) as any;
  if(!descriptor?.[mode])throw Error(`Missing exact source descriptor ${key}`);
  const raw=JSON.parse(gunzipSync(readFileSync(path.join(publicDir,descriptor[mode].url))).toString()) as SurroundingCityChunk;
  const plan=runtime.packets[key];
  plan.navGuard=fnv([JSON.stringify(raw.nav)]);
  plan.lineGuard=raw.lines?fnv([raw.lines.positions,raw.lines.colors??""]):null;
  const recipes=await loadSourceQuarterRecipesV309(id,native);
  const ownership:SurroundingOwnershipOptions={neighbourhoodV300:true,westKiezV302:true,
    stralauSisyphosV299:true,sourceQuartersV303:true,sourceQuarterSourcesV303:recipes,
    northFidelityV309:true,treptowWaterfrontV317:true,neukoellnLandmarksV305:true,
    southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true};
  const tickets:SourceQuarterTicketV303[]=[];
  for(const entry of recipes){
    const predecessor=entry.source.packets[key];
    if(!predecessor)continue;
    const ticket=predecessor.preparedRecords
      ?drain(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement))
      :drain(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
    if(ticket)tickets.push(ticket);
  }
  let prepared=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,ownership));
  for(const ticket of tickets)prepared=drain(prepareSourceQuarterPacketV303(prepared,ticket));
  plan.preparedNavGuard=fnv([JSON.stringify(prepared.nav)]);
  plan.preparedLineGuard=prepared.lines?fnv([prepared.lines.positions,prepared.lines.colors??""]):null;
  reports.push({key,rawNavGuard:plan.navGuard,preparedNavGuard:plan.preparedNavGuard,
    rawLineGuard:plan.lineGuard,preparedLineGuard:plan.preparedLineGuard,preparedParts:prepared.meshes.length,preparedKinds:prepared.meshes.map(part=>part.kind)});
}
proof.pendingBunPrimaryGuards=[];
proof.actualPreparedGuards=reports;
writeFileSync(runtimePath,JSON.stringify(runtime)+"\n");
writeFileSync(proofPath,gzipSync(JSON.stringify(proof)+"\n",{mtime:0} as any));
console.log(JSON.stringify({plans:reports.length,navChanged:reports.filter(r=>r.rawNavGuard!==r.preparedNavGuard).map(r=>r.key),lineChanged:reports.filter(r=>r.rawLineGuard!==r.preparedLineGuard).map(r=>r.key)}));
