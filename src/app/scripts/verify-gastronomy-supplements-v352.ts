/** Execute each finite restaurant host through the actual two-mode decoder. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildSurroundingCityChunk,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {drain} from './mcdonalds-support-v351';
const root=resolve(import.meta.dir,'../../..'),publicDir=resolve(root,'src/app/public/mesh/surrounding-berlin-v159');
const report=JSON.parse(gunzipSync(readFileSync(resolve(root,'geo_data/regierungsviertel/gastronomy-v352-supplements.json.gz'))).toString());
const proofs=[];
for(const d of report.descriptors)for(const mode of ['drawn','minecraft']){
 const bytes=readFileSync(resolve(publicDir,d[mode].url));
 if(createHash('sha256').update(bytes).digest('hex')!==d[mode].sha256)throw Error('Changed source bytes');
 const p=JSON.parse(gunzipSync(bytes).toString()) as SurroundingCityChunk;
 const built=drain(buildSurroundingCityChunk(structuredClone(p),d.id,mode==='minecraft',false,{}));
 try{
  if(!built.root.userData.sourceKinds.includes('gastronomy-buildings-v352')||!built.root.userData.sourceKinds.includes('gastronomy-v352'))throw Error('Missing actual rendered body/sign');
  if(built.nav.buildings.length!==1||!built.nav.ground.length)throw Error('Missing source floor or body navigation');
  let vertices=0,triangles=0;
  built.root.traverse((obj:any)=>{if(!obj.isMesh)return;const a=obj.geometry.getAttribute('position'),ix=obj.geometry.getIndex();if(!a||!ix)throw Error('Empty rendered source');vertices+=a.count;triangles+=ix.count/3;for(let i=0;i<a.count;i++){const x=p.origin[0]+a.getX(i)/100,z=p.origin[2]+a.getZ(i)/100;if(x<d.bounds[0]-.011||x>d.bounds[2]+.011||z<d.bounds[1]-.011||z>d.bounds[3]+.011)throw Error('Descriptor clips actual geometry');}});
  if(!vertices||!triangles)throw Error('No rendered geometry');
  proofs.push({key:mode+':'+d.id,valid:true,vertices,triangles,bodyNavigation:built.nav.buildings[0].sourceId,groundPolygons:built.nav.ground.length,sourceKinds:built.root.userData.sourceKinds});
 }finally{built.root.traverse((obj:any)=>{obj.geometry?.dispose();for(const material of new Set([obj.material,obj.userData.dayMaterial,obj.userData.nightMaterial].flat()))material?.dispose?.();});built.root.clear();}
}
writeFileSync(resolve(root,'geo_data/regierungsviertel/gastronomy-v352-supplement-production.json.gz'),gzipSync(JSON.stringify({schemaVersion:1,proofs})+'\n'));
console.log(proofs.length,'actual production mode/host proofs passed');
