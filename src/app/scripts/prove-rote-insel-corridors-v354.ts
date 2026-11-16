import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {SOURCE_QUARTER_CATALOGUE_V309,createSourceQuarterRecipeLoaderV309} from '../src/SourceQuarterCatalogueV309';
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329} from '../src/SurroundingCityGeometry';
import {proveCorridorProductionV354} from './rote-insel-corridors-production-v354';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {captureNeighbourhoodPacketV300} from '../src/NeighbourhoodPacketV300';
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const read=(p:string)=>JSON.parse(p.endsWith('.gz')?gunzipSync(readFileSync(p)).toString():readFileSync(p,'utf8'));
const flags={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
const previous=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>!groundOverlayKindsV329.has(e.kind)&&!['rote-insel-corridors-v354','railway-parks-v354'].includes(e.kind)));
const ground=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>groundOverlayKindsV329.has(e.kind)));
export async function proveAllRoteInselCorridorsV354(){
const proof=[];
const index=read(fileURLToPath(new URL('../src/data/roteInselCorridorsV354Index.json',import.meta.url)));
const rows=index.sources.flatMap((s:any)=>s.keys.map((key:string)=>{const [mode,id]=key.split(':');return {id,mode,path:fileURLToPath(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))};}));
for(const row of rows){
 const key=`${row.mode}:${row.id}`,file=index.sources.find((s:any)=>s.keys.includes(key)).file;
 const source=read(fileURLToPath(new URL('../src/data/'+file,import.meta.url))),plan=source.packets[key];
 const raw=read(row.path),native=row.mode==='minecraft',priorMain=await previous(row.id,native);
 let prepared=drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),row.id,native,flags));
 for(const entry of priorMain){
 const ticket=entry.source.packets[key]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,row.id,native,true,entry.source,entry.kind,entry.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,row.id,native,true,entry.source as any,entry.kind));
 if(!ticket)continue;const next=drain(ticket(prepared));prepared=next;
 }
 const retired=new Set<string>();let offset=0;
 for(let mi=0;mi<prepared.meshes.length;mi++){
  const m=prepared.meshes[mi];
  const buffer=Buffer.from(m.indices,'base64'),ix=new Uint32Array(buffer.buffer,buffer.byteOffset,buffer.length/4);
  for(const ti of plan.retire.find((r:any)=>r.mesh===mi)?.triangles??[])retired.add([ix[ti*3]+offset,ix[ti*3+1]+offset,ix[ti*3+2]+offset].join(','));
  offset+=Buffer.from(m.positions,'base64').length/6;
 }
 const prior=[...await previous(row.id,row.mode==='minecraft'),...await ground(row.id,row.mode==='minecraft')];
 const r=await proveCorridorProductionV354(raw,row.id,row.mode==='minecraft',flags,prior,source,offset,retired);
 proof.push({key,retired:retired.size,...r});Bun.gc(true);
}
return proof;
}
if(import.meta.main){const proof=await proveAllRoteInselCorridorsV354();console.log(JSON.stringify(proof,null,2));if(process.argv[2])writeFileSync(`${process.argv[2]}/actual-production-proof.json`,JSON.stringify(proof,null,2));if(proof.some(p=>!p.valid))throw Error('Corridor production proof failed');}
