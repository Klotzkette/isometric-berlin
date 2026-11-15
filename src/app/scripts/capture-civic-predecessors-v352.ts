/** Actual production ownership for the finite V352 industrial domains. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309} from '../src/SourceQuarterCatalogueV309';
import {buildSurroundingCityChunk,type SurroundingOwnershipOptions} from '../src/SurroundingCityGeometry';
import {productionOptionsV350} from './civic-production-proof-v350';
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
const load=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309);
const root=resolve(import.meta.dir,'../../..'),publicRoot=resolve(root,'src/app/public/mesh/surrounding-berlin-v159');
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const r=g.next();if(r.done)return r.value;}};
export async function buildActualCivicChunkV352(packet:any,id:string,native:boolean){
 return drain(buildSurroundingCityChunk(structuredClone(packet),id,native,false,{...await productionOptionsV350(id,flags),sourceQuarterSourcesV303:await load(id,native)}));
}
export function disposeCivicChunkV352(built:any){
 built.root.traverse((o:any)=>{o.geometry?.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat()))(m as any)?.dispose?.();});built.root.clear();
}
export async function captureCivicPredecessorsV352(){
const evidence=JSON.parse(gunzipSync(readFileSync(resolve(root,'geo_data/regierungsviertel/civic-places-v352-evidence.json.gz'))).toString());
const manifest=JSON.parse(readFileSync(resolve(publicRoot,'manifest.json'),'utf8'));
const ids=[...new Set(evidence.sites.flatMap((s:any)=>Object.values(s.modes).flatMap((m:any)=>m.groundAudit.inputs.map((r:any)=>r.id))))] as string[];
const output=[];
for(const id of ids)for(const mode of ['drawn','minecraft']){
 const descriptor=manifest.chunks.find((d:any)=>d.id===id),raw=readFileSync(resolve(publicRoot,descriptor[mode].url));
 const packet=JSON.parse(gunzipSync(raw).toString()),native=mode==='minecraft';
 const built=await buildActualCivicChunkV352(packet,id,native);
 const hash=createHash('sha256');let triangles=0;
 built.root.traverse((o:any)=>{if(o.geometry){for(const n of ['position','normal','color']){const a=o.geometry.getAttribute(n);if(a){const v=a.data?.array??a.array;hash.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}}const i=o.geometry.getIndex();if(i){triangles+=i.count/3;hash.update(new Uint8Array(i.array.buffer,i.array.byteOffset,i.array.byteLength));}}});
 output.push({id,mode,rawSha256:createHash('sha256').update(raw).digest('hex'),origin:packet.origin,navigation:built.nav,triangleCount:triangles,productionWordSha256:hash.digest('hex'),sourceKinds:built.root.userData.sourceKinds});
 disposeCivicChunkV352(built);Bun.gc(true);
}
return {schemaVersion:1,records:output};
}
if(import.meta.main){
 const result=await captureCivicPredecessorsV352();
 writeFileSync(process.argv[2],gzipSync(JSON.stringify(result)+'\n'));
 console.log(`Captured ${result.records.length} actual civic predecessor packets`);
}
