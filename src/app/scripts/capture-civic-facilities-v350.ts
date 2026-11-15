/** Capture the real preceding city recipes without changing a public packet. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { civicFacilitySourceV350, type CivicCompactSourceV350, CIVIC_FACILITIES_KIND_V350 } from '../src/CivicFacilitiesV350';
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from '../src/SourceQuarterCatalogueV309';
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from '../src/NeighbourhoodPacketV300';
import { captureSourceQuarterPacketV303, sourceQuarterNavigationV303 } from '../src/SourceQuarterPacketV303';
import { supportMeshesV350, clearPlateV350 } from './civic-facility-support-v350';
import { proveProductionV350, productionOptionsV350, productionSupportV350 } from './civic-production-proof-v350';
import { clusterFacadesSourceV320 } from '../src/ClusterFacadesV320';
import { berlinSenateSourceV321 } from '../src/BerlinSenateV321';
import { groundOverlayKindsV329, prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingOwnershipOptions } from '../src/SurroundingCityGeometry';
const [recipePath,receiptPath,startText='0',countText='100000']=process.argv.slice(2);
if(!recipePath||!receiptPath)throw Error('Supply compact recipe and evidence paths');
const compact=JSON.parse(readFileSync(recipePath,'utf8')) as CivicCompactSourceV350;
const receipt=JSON.parse(gunzipSync(readFileSync(receiptPath)).toString());
const root=resolve(import.meta.dir,'../public/mesh/surrounding-berlin-v159');
const descriptors=new Map(JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8')).chunks.map((r:any)=>[r.id,r]));
const load=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>!['civic-facilities-v350','facility-paths-v350'].includes(e.kind)&&!groundOverlayKindsV329.has(e.kind)));
const ground=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>groundOverlayKindsV329.has(e.kind)));
const settings:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,sourceQuartersV303:true,northFidelityV309:true,treptowWaterfrontV317:true,neukoellnLandmarksV305:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
function drain<T>(g:Generator<void,T>):T{for(;;){const n=g.next();if(n.done)return n.value;}}
function hash(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;}
const lines=(p:SurroundingCityChunk)=>p.lines?hash(p.lines.positions+(p.lines.colors??'')):null;
const hosts=[...new Set(receipt.pendingBunPrimaryGuards.map((k:string)=>k.split(':')[1]))].sort() as string[];
const reports=receipt.actualPreparedGuards??[],rejects=receipt.runtimeAdmissionRejections??[];
for(const id of hosts.slice(+startText,+startText + +countText)){
 let accepted=true;const hostReports=[],preparedByMode:Record<string,SurroundingCityChunk>={},rawByMode:Record<string,SurroundingCityChunk>={};
 const sourceRows=receipt.sourceOwners.filter((r:any)=>r.host===id), keep=new Set(sourceRows.map((_:any,i:number)=>i));
 for(const mode of ['drawn','minecraft']){
  const key=mode+':'+id,native=mode==='minecraft',plan=compact.packets[key];
  const descriptor=descriptors.get(id) as any;
  const raw=JSON.parse(gunzipSync(readFileSync(resolve(root,descriptor[mode].url))).toString()) as SurroundingCityChunk;
  plan.navGuard=hash(JSON.stringify(raw.nav));plan.lineGuard=lines(raw);
  const prior=await load(id,native);
  const tickets=prior.map(e=>e.source.packets[key]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,e.source as unknown as NeighbourhoodSourceV300,e.kind)));
  let prepared=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,{...settings,sourceQuarterSourcesV303:prior}));
  for(const ticket of tickets)if(ticket)prepared=drain(ticket(prepared));
  rawByMode[mode]=raw;preparedByMode[mode]=prepared;
  plan.preparedNavGuard=hash(JSON.stringify(prepared.nav));plan.preparedLineGuard=lines(prepared);
  const known=new Set(sourceQuarterNavigationV303(prepared,prepared.nav).buildings.map(b=>b.sourceId));
  const missing=plan.owners.filter(owner=>!known.has(owner));
  const lateOptions=await productionOptionsV350(id,settings);
  const later=[...([clusterFacadesSourceV320,berlinSenateSourceV321].flatMap(s=>s.packets[key]?.append??[])),...(lateOptions.namedTransportSourceV334?.packets[key]?.replacement?[lateOptions.namedTransportSourceV334.packets[key].replacement]:[]),...(lateOptions.neukoellnBuildingsV342?.packets[key]?.append?[lateOptions.neukoellnBuildingsV342.packets[key].append!]:[])];
  const support=supportMeshesV350(prepared);
  if(later.length)support.push(...supportMeshesV350({...raw,meshes:later}));
  const actual=await productionSupportV350(raw,id,native,settings,[...prior,...await ground(id,native)]);
  const actualOwners=new Set(actual.nav.buildings.map(b=>b.sourceId));
  plan.plates=plan.plates.map((p,index)=>{
   const row=sourceRows[index],face=mode==='drawn'?row.drawnFace:row.nativeFace;
   const decoded=clearPlateV350(support,p,Math.hypot(face.a[0]-face.b[0],face.a[1]-face.b[1]),actual.meshes);
   if(!decoded||!known.has(row.owner)||!actualOwners.has(row.owner))keep.delete(index);
   return decoded??p;
  });
  if(missing.length)rejects.push({key,missingOwners:missing,reason:'retired-navigation-host'});
 }
 // Admit a facility only if its actual wall is clear in both independent modes.
 for(let i=0;i<sourceRows.length;i++)if(!keep.has(i))for(const fid of sourceRows[i].facilityIds)receipt.outcomes[fid]={...receipt.outcomes[fid],status:'existing-fitting-or-retired-wall-preserved'};
 for(const mode of ['drawn','minecraft']){
  const key=mode+':'+id,native=mode==='minecraft',plan=compact.packets[key],prepared=preparedByMode[mode],raw=rawByMode[mode];
  plan.plates=plan.plates.filter((_,i)=>keep.has(i));
  plan.facilityIds=sourceRows.flatMap((r:any,i:number)=>keep.has(i)?r.facilityIds:[]);
  plan.owners=[...new Set(sourceRows.flatMap((r:any,i:number)=>keep.has(i)?[r.owner]:[]))] as string[];
  if(!plan.plates.length){accepted=false;continue;}
  const source=civicFacilitySourceV350({schemaVersion:1,keys:[key],packets:{[key]:plan}});
  const ticket=drain(captureNeighbourhoodPacketV300(raw,id,native,true,source,CIVIC_FACILITIES_KIND_V350));
  const result=ticket?drain(ticket(prepared)):prepared;
  const future=[...([clusterFacadesSourceV320,berlinSenateSourceV321].map((s,i)=>({source:s,kind:i?'berlin-senate-v321':'cluster-facades-v320'})).filter(e=>e.source.keys.includes(key))),...await ground(id,native)];
  let beforeLater=prepared,afterLater=result;
  for(const old of future){
   const oldTicket=drain(captureNeighbourhoodPacketV300(raw,id,native,true,old.source as unknown as NeighbourhoodSourceV300,old.kind));
   if(oldTicket){beforeLater=drain(oldTicket(beforeLater));afterLater=drain(oldTicket(afterLater));}
  }
  const oldMissing=beforeLater.meshes.filter(p=>!afterLater.meshes.some(q=>q.kind===p.kind)).map(p=>p.kind);
  const proof=await proveProductionV350(raw,id,native,settings,[...await load(id,native),...await ground(id,native)],source,prepared.meshes.reduce((n,p)=>n+atob(p.positions).length/6,0),plan.plates);
  if(!ticket||!result.meshes.some(p=>p.kind===CIVIC_FACILITIES_KIND_V350)||oldMissing.length||!proof.valid){
   accepted=false;rejects.push({key,preparedParts:prepared.meshes.length,facilityIds:plan.facilityIds});
   receipt.reservedCompanionPlans??={};receipt.reservedCompanionPlans[key]=plan;
   if(oldMissing.length)rejects[rejects.length-1].oldMissing=oldMissing;
   if(!proof.valid)rejects[rejects.length-1].productionProof=proof;
  }else hostReports.push({key,preparedParts:prepared.meshes.length,preparedKinds:prepared.meshes.map(p=>p.kind),plateCount:plan.plates.length,appendVertices:atob(source.packets[key].append.positions).length/6,navGuard:plan.navGuard,preparedNavGuard:plan.preparedNavGuard,productionWordsAndNavigationUnchanged:true});
 }
 if(accepted)reports.push(...hostReports);
 else{
  for(const mode of ['drawn','minecraft']){
   const key=mode+':'+id;
   for(const fid of compact.packets[key].facilityIds)receipt.outcomes[fid]={...receipt.outcomes[fid],status:'current-prepared-host-not-admitted'};
   delete compact.packets[key];
  }
  compact.keys=compact.keys.filter(k=>!k.endsWith(':'+id));
 }
 receipt.pendingBunPrimaryGuards=receipt.pendingBunPrimaryGuards.filter((k:string)=>!k.endsWith(':'+id));
 console.log(id,accepted?'admitted':'rejected');
 Bun.gc(true);
}
receipt.actualPreparedGuards=reports;receipt.runtimeAdmissionRejections=rejects;
receipt.counts.statuses={};for(const value of Object.values(receipt.outcomes) as any[])receipt.counts.statuses[value.status]=(receipt.counts.statuses[value.status]??0)+1;
receipt.counts.admittedHosts=compact.keys.length/2;
receipt.counts.admittedPlates=Object.entries(compact.packets).filter(([k])=>k.startsWith('drawn:')).reduce((n,[,p])=>n+p.plates.length,0);
writeFileSync(recipePath,JSON.stringify(compact)+'\n');writeFileSync(receiptPath,gzipSync(JSON.stringify(receipt)+'\n'));
