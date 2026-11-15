/** Recheck frozen recipes against the full renderer including procedural finishes. */
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync,gzipSync } from 'node:zlib';
import { mcdonaldsSourceV351,type McdonaldsCompactSourceV351 } from '../src/McdonaldsV351';
import index from '../src/data/mcdonaldsV351Index.json';
import { createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309 } from '../src/SourceQuarterCatalogueV309';
import { groundOverlayKindsV329,prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk,type SurroundingOwnershipOptions } from '../src/SurroundingCityGeometry';
import { captureSourceQuarterPacketV303 } from '../src/SourceQuarterPacketV303';
import { captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300 } from '../src/NeighbourhoodPacketV300';
import { drain } from './civic-facility-support-v350';
import { proveProductionV350, productionSupportV350 } from './civic-production-proof-v350';
import { mcdonaldsSignClearV351 } from './mcdonalds-support-v351';
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,sourceQuartersV303:true,northFidelityV309:true,treptowWaterfrontV317:true,neukoellnLandmarksV305:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
const root=resolve(import.meta.dir,'../public/mesh/surrounding-berlin-v159');
const descriptors=new Map(JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8')).chunks.map((d:any)=>[d.id,d]));
const load=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>!['mcdonalds-v351'].includes(e.kind)));
const proofs=[];const limit=Number(process.argv[2]??Infinity),start=Number(process.argv[3]??0);let ordinal=0;
for(const module of index.sources){
 const compact=JSON.parse(readFileSync(resolve(import.meta.dir,'../src/data',module.file),'utf8')) as McdonaldsCompactSourceV351;
 const source=mcdonaldsSourceV351(compact);
 for(const key of compact.keys){
  if(ordinal++<start)continue;
  if(proofs.length>=limit)break;
  const[mode,id]=key.split(':'),native=mode==='minecraft',descriptor=descriptors.get(id) as any;
  const raw=JSON.parse(gunzipSync(readFileSync(resolve(root,descriptor[mode].url))).toString()) as SurroundingCityChunk;
  const prior=await load(id,native);
  const tickets=prior.filter(e=>!groundOverlayKindsV329.has(e.kind)).map(e=>e.source.packets[key]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,e.source as unknown as NeighbourhoodSourceV300,e.kind)));
  let prepared=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,{...flags,sourceQuarterSourcesV303:prior}));
  for(const ticket of tickets)if(ticket)prepared=drain(ticket(prepared));
  const startVertex=prepared.meshes.reduce((n,p)=>n+atob(p.positions).length/6,0);
  const proof=await proveProductionV350(raw,id,native,flags,prior,source,startVertex);
  const actual=await productionSupportV350(raw,id,native,flags,prior);
  const fullySupported=compact.packets[key].plates.every(sign=>mcdonaldsSignClearV351(actual.meshes,sign));
  if(!fullySupported)Object.assign(proof,{valid:false,reason:"McDonalds sign rectangle no longer supported"});
  proofs.push({key,...proof,insertionVertex:startVertex,fullyDecodedSupport:proof.valid});
  if(!proof.valid){console.error('FAILED',key,JSON.stringify(proof));process.exitCode=1;}
  else console.log(key,'words+nav+materials+metadata preserved');Bun.gc(true);
 }
}
if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify(proofs));
if(proofs.every(p=>p.valid)&&proofs.length===index.sources.reduce((n,s)=>n+s.keys.length,0)){
 const path=resolve(import.meta.dir,'../../../geo_data/regierungsviertel/mcdonalds-v351-evidence.json.gz');
 const receipt=JSON.parse(gunzipSync(readFileSync(path)).toString());
 receipt.completeProductionProof={allSourceFamiliesPassed:true,flags:{...flags,groundFinishV348:true},keys:proofs,checks:['old-position-colour-words','old-triangle-words','old-ink-words','exact-navigation','source-kind-order','older-transfer-aperture-metadata','day-night-material-hook-and-uniforms','fully-decoded-live-wall-and-fitting-clearance']};
 writeFileSync(path,gzipSync(JSON.stringify(receipt)+'\n'));
}
console.log('verified',proofs.length,'source families');

// New finite hosts must pass the same actual renderer and navigation decoder.
const supplementsPath=resolve(import.meta.dir,'../../../geo_data/regierungsviertel/mcdonalds-v351-supplements.json.gz');
const supplements=JSON.parse(gunzipSync(readFileSync(supplementsPath)).toString());
const supplementProofs=[];
for(const descriptor of supplements.descriptors)for(const mode of ['drawn','minecraft']){
 const raw=JSON.parse(gunzipSync(readFileSync(resolve(root,descriptor[mode].url))).toString()) as SurroundingCityChunk;
 const native=mode==='minecraft',prior=await load(descriptor.id,native);
 const actual=await productionSupportV350(raw,descriptor.id,native,flags,prior);
 if(JSON.stringify(actual.nav)!==JSON.stringify(raw.nav))throw Error('Supplement navigation differs: '+descriptor.id);
 for(const mesh of raw.meshes){
  const bytes=Uint8Array.from(atob(mesh.positions),c=>c.charCodeAt(0));const points=new Uint16Array(bytes.buffer);
  for(let at=0;at<points.length;at+=3){const x=points[at]/100+raw.origin[0],z=points[at+2]/100+raw.origin[2];
   if(x<descriptor.bounds[0]-.02||x>descriptor.bounds[2]+.02||z<descriptor.bounds[1]-.02||z>descriptor.bounds[3]+.02)throw Error('Supplement outside exact admission bounds: '+descriptor.id);
  }
 }
 if(!actual.meshes.length||actual.meshes.every(m=>!m.i.length))throw Error('Supplement decoded empty: '+descriptor.id);
 supplementProofs.push({key:mode+':'+descriptor.id,valid:true,exactNavigation:true,insideDescriptorBounds:true,nonEmptyProductionGeometry:true});
 Bun.gc(true);
}
supplements.completeProductionProof=supplementProofs;
writeFileSync(supplementsPath,gzipSync(JSON.stringify(supplements)+'\n'));
console.log('verified',supplementProofs.length,'new-host production decodes');
