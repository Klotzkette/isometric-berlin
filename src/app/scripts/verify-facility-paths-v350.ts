/** Verify every admitted route through the complete production city decoder. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309} from '../src/SourceQuarterCatalogueV309';
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from '../src/NeighbourhoodPacketV300';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329,type SurroundingOwnershipOptions} from '../src/SurroundingCityGeometry';
import {facilityPathSourceV350} from '../src/FacilityPathsV350';
import {proveProductionV350} from './civic-production-proof-v350';
const root=resolve(import.meta.dir,'../../..'),data=resolve(root,'src/app/src/data'),publicDir=resolve(root,'src/app/public/mesh/surrounding-berlin-v159');
const index=JSON.parse(readFileSync(resolve(data,'facilityPathsV350Index.json'),'utf8'));
const manifest=JSON.parse(readFileSync(resolve(publicDir,'manifest.json'),'utf8'));
const descriptors=new Map(manifest.chunks.map((r:any)=>[r.id,r]));
const previous=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>e.kind!=='facility-paths-v350'));
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,sourceQuartersV303:true,northFidelityV309:true,treptowWaterfrontV317:true,neukoellnLandmarksV305:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
function drain<T>(work:Generator<void,T>):T{for(;;){const result=work.next();if(result.done)return result.value;}}
const reports:any[]=[],timings:number[]=[];let maxVertices=0,maxBytes=0;
const dump=process.argv.includes('--dump-meshes');const meshes:Record<string,unknown>={};
for(const module of index.sources){
 const source=facilityPathSourceV350({schemaVersion:1,keys:module.keys,decodedBytes:module.decodedBytes,compressed:new Uint8Array(readFileSync(resolve(data,module.file)))});
 for(const key of source.keys){
  const [mode,id]=key.split(':'),native=mode==='minecraft',desc=descriptors.get(id)as any;
  const raw=JSON.parse(gunzipSync(readFileSync(resolve(publicDir,desc[mode].url))).toString());
  const all=await previous(id,native),prior=all.filter(e=>!groundOverlayKindsV329.has(e.kind));
  let prepared=drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,{...flags,sourceQuarterSourcesV303:prior}));
  for(const entry of prior){
   const ticket=entry.source.packets[key]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
   if(ticket)prepared=drain(ticket(prepared));
  }
  const startVertex=prepared.meshes.reduce((n,p)=>n+Buffer.from(p.positions,'base64').length/6,0);
  const started=performance.now(),plan=source.packets[key],append=plan.append;
  timings.push(performance.now()-started);maxVertices=Math.max(maxVertices,Buffer.from(append.positions,'base64').length/6);maxBytes=Math.max(maxBytes,append.positions.length+append.indices.length+append.colors.length);
  if(dump)meshes[key]=append;
  const result=await proveProductionV350(raw,id,native,flags,all,source,startVertex);
  reports.push({key,...result});
  if(!result.valid)console.log(JSON.stringify({key,...result}));
 }
 console.log(module.file,reports.length,'checked');Bun.gc(true);
}
timings.sort((a,b)=>a-b);
const summary={schemaVersion:1,checked:reports.length,failures:reports.filter(r=>!r.valid),expansion:{medianMs:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.floor(timings.length*.95)],maxMs:timings.at(-1),maxVertices,maxEncodedBytes:maxBytes},reports};
writeFileSync(resolve(root,'geo_data/regierungsviertel/education-v350-paths-production.json.gz'),gzipSync(JSON.stringify(summary)+'\n'));
if(dump)writeFileSync(resolve(root,'geo_data/regierungsviertel/raw/facility-paths-v350/expanded-meshes.json.gz'),gzipSync(JSON.stringify(meshes)+'\n'));
console.log(JSON.stringify({...summary,reports:undefined}));
if(summary.failures.length)process.exitCode=1;
