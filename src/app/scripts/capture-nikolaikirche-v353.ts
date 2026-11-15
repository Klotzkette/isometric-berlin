/** Complete source receipts before the exact church successor; bounded one-host output. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from '../src/NeighbourhoodPacketV300';
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from '../src/SourceQuarterCatalogueV309';
import { captureSourceQuarterPacketV303 } from '../src/SourceQuarterPacketV303';
import { prepareSurroundingQuarterPredecessorV303, groundOverlayKindsV329, type SurroundingOwnershipOptions } from '../src/SurroundingCityGeometry';
import { surroundingPacketFingerprint } from '../src/surroundingPacketFingerprint';
const flags: SurroundingOwnershipOptions = {
 schlossplatzV239:true, staatsoperV240:true, architectureV241:true, mitteEnsembleV281:true,
 prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,
 golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,
 wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,
 sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,
 treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,
 wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true,
};
const previous=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>!groundOverlayKindsV329.has(e.kind)&&e.kind!=='nikolaikirche-v353'));
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const directory=process.argv[2];mkdirSync(directory,{recursive:true});
const rows=JSON.parse(await Bun.stdin.text());
for(const {id,path,mode}of rows){
 const raw=JSON.parse(gunzipSync(readFileSync(path)).toString()),native=mode==='minecraft';
 let prepared=drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,flags));const declined:string[]=[];
 for(const entry of await previous(id,native)){
  const ticket=entry.source.packets[`${mode}:${id}`]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
  if(!ticket){declined.push(entry.kind+':raw');continue;}const next=drain(ticket(prepared));if(next===prepared)declined.push(entry.kind+':prepared');prepared=next;
 }
 const pins=(p:typeof raw)=>p.meshes.map((m:any,mesh:number)=>({mesh,kind:m.kind,fingerprint:drain(surroundingPacketFingerprint(m))}));
 const ink=(p:typeof raw)=>p.lines?hash(p.lines.positions+(p.lines.colors??'')):null;
 const plan={origin:raw.origin,records:pins(raw),preparedRecords:pins(prepared),navGuard:hash(JSON.stringify(raw.nav)),preparedNavGuard:hash(JSON.stringify(prepared.nav)),lineGuard:ink(raw),preparedLineGuard:ink(prepared)};
 const append=JSON.parse(gunzipSync(readFileSync(`${directory}/${mode}-${id==='4_0'?'body':id==='nikolai239-4_0'?'spires':'ink'}-mesh.json.gz`)).toString());
 Object.assign(plan,{append,appendFingerprint:drain(surroundingPacketFingerprint(append))});
 writeFileSync(`${directory}/${mode}-${id}.json.gz`,gzipSync(JSON.stringify({raw,prepared,plan,declined})));
 console.log(JSON.stringify({key:`${mode}:${id}`,declined,parts:prepared.meshes.length}));
}
