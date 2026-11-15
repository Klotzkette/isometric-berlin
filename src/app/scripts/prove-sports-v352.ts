/** Byte-exact preservation through the actual production decoder, both modes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from '../src/NeighbourhoodPacketV300';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309} from '../src/SourceQuarterCatalogueV309';
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329,type SurroundingOwnershipOptions} from '../src/SurroundingCityGeometry';
import {proveProductionV350} from './civic-production-proof-v350';
import {sportsLeisureSourceV352,SPORTS_LEISURE_KIND_V352} from '../src/SportsLeisureV352';
import index from '../src/data/sportsLeisureV352Index.json';
const flags: SurroundingOwnershipOptions = {
 schlossplatzV239:true, staatsoperV240:true, architectureV241:true, mitteEnsembleV281:true,
 prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,
 golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,
 wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,
 sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,
 treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,
 wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true,
};

const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const old=SOURCE_QUARTER_CATALOGUE_V309.filter(e=>e.kind!==SPORTS_LEISURE_KIND_V352);
const prior=createSourceQuarterRecipeLoaderV309(old.filter(e=>!groundOverlayKindsV329.has(e.kind)));
const ground=createSourceQuarterRecipeLoaderV309(old.filter(e=>groundOverlayKindsV329.has(e.kind)));
const dir='../public/mesh/surrounding-berlin-v159/';
const manifest=JSON.parse(readFileSync(new URL(dir+'manifest.json',import.meta.url),'utf8'));
const evidence:any[]=[];
for(const item of index.sources){
 const bytes=readFileSync(new URL('../src/data/'+item.file,import.meta.url));
 const source=sportsLeisureSourceV352(bytes,item.keys,item.decodedBytes);
 for(const key of item.keys){
  const [mode,id]=key.split(':'),native=mode==='minecraft';
  const descriptor=manifest.chunks.find((c:any)=>c.id===id);
  const raw=JSON.parse(gunzipSync(readFileSync(new URL(dir+descriptor[mode].url,import.meta.url))).toString());
  const previous=await prior(id,native);
  let prepared=drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,flags));
  for(const entry of previous){
   const ticket=entry.source.packets[key]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
   if(ticket)prepared=drain(ticket(prepared));
  }
  const start=prepared.meshes.reduce((n:number,m:any)=>n+atob(m.positions).length/6,0);
  const proof=await proveProductionV350(raw,id,native,flags,[...previous,...await ground(id,native)],source,start);
  evidence.push({key,...proof});console.log(JSON.stringify(evidence.at(-1)));Bun.gc(true);
 }
}
writeFileSync(process.argv[2],gzipSync(JSON.stringify({schemaVersion:1,production:evidence})));
if(evidence.some(r=>!r.valid))process.exitCode=1;
