/** Exact production predecessors for two bounded Grunewald excursion venues. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from '../src/NeighbourhoodPacketV300';
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from '../src/SourceQuarterCatalogueV309';
import { captureSourceQuarterPacketV303 } from '../src/SourceQuarterPacketV303';
import { prepareSurroundingQuarterPredecessorV303, groundOverlayKindsV329, type SurroundingOwnershipOptions } from '../src/SurroundingCityGeometry';
import { productionSupportV350 } from './civic-production-proof-v350';
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
const previous=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>!groundOverlayKindsV329.has(e.kind)&&e.kind!=='grunewald-venues-v354'));
const ground=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>groundOverlayKindsV329.has(e.kind)));
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const directory=process.argv[2];mkdirSync(directory,{recursive:true});
const rows=JSON.parse(await Bun.stdin.text());
for(const {id,path,mode,windows,featureIds}of rows){
 const raw=JSON.parse(gunzipSync(readFileSync(path)).toString()),native=mode==='minecraft';
 let prepared=drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,flags));const declined:string[]=[];
 for(const entry of await previous(id,native)){
  const ticket=entry.source.packets[`${mode}:${id}`]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
  if(!ticket){declined.push(entry.kind+':raw');continue;}const next=drain(ticket(prepared));if(next===prepared)declined.push(entry.kind+':prepared');prepared=next;
 }
 const pins=(p:typeof raw)=>p.meshes.map((m:any,mesh:number)=>({mesh,kind:m.kind,fingerprint:drain(surroundingPacketFingerprint(m))}));
 const ink=(p:typeof raw)=>p.lines?hash(p.lines.positions+(p.lines.colors??'')):null;
 const plan={origin:raw.origin,records:pins(raw),preparedRecords:pins(prepared),navGuard:hash(JSON.stringify(raw.nav)),preparedNavGuard:hash(JSON.stringify(prepared.nav)),lineGuard:ink(raw),preparedLineGuard:ink(prepared)};
 const actual=await productionSupportV350(raw,id,native,flags,[...await previous(id,native),...await ground(id,native)]);
 const triangles:number[][]=[];
 for(const m of actual.meshes)for(let t=0;t<m.i.length;t+=3){
  const ids=[m.i[t],m.i[t+1],m.i[t+2]];if(new Set(ids).size!==3)continue;
  const p=ids.map(i=>[m.p[i*3]/100+raw.origin[0],m.p[i*3+1]/100+raw.origin[1],m.p[i*3+2]/100+raw.origin[2]]);
  const minX=Math.min(...p.map(v=>v[0])),maxX=Math.max(...p.map(v=>v[0])),minZ=Math.min(...p.map(v=>v[2])),maxZ=Math.max(...p.map(v=>v[2]));
  if(windows.some((w:number[])=>maxX>=w[0]-1&&minX<=w[2]+1&&maxZ>=w[1]-1&&minZ<=w[3]+1))triangles.push(p.flat().map(v=>Math.round(v*100)/100));
 }
 writeFileSync(`${directory}/${mode}-${id}.json.gz`,gzipSync(JSON.stringify({plan,declined,featureIds,nav:actual.nav,triangles,prepared,raw})));
 Bun.gc(true);
 console.log(JSON.stringify({key:`${mode}:${id}`,declined,parts:prepared.meshes.length}));
}
