/** Exercise complete receipts and the actual triangle/navigation decoder gates. */
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fuelStationSourceV351} from '../src/FuelStationsV351';
import {captureSourceQuarterPacketV303,applySourceQuarterTrianglesV303,sourceQuarterNavigationV303} from '../src/SourceQuarterPacketV303';
import index from '../src/data/fuelStationsV351Index.json';
import {buildSurroundingCityChunk,surroundingBuildingSolidAt,surroundingPolygonContains,type SurroundingOwnershipOptions} from '../src/SurroundingCityGeometry';
import {createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309} from '../src/SourceQuarterCatalogueV309';
import {productionOptionsV350} from './civic-production-proof-v350';
const previous=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>e.kind!=='fuel-stations-v351'&&e.kind!=='mcdonalds-v351'));
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
function dispose(root:any){root.traverse((o:any)=>{o.geometry?.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.groundOverlayDayV329,o.userData.groundOverlayNightV329].flat()))(m as any)?.dispose?.();});root.clear();}
function words(geometry:any){const a=geometry.getAttribute('position');return a?.data?.array??a?.array??[];}

const directory=process.argv[2];if(!directory)throw Error('Supply bounded capture directory');
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const invariant=(x:unknown,message:string)=>{if(!x)throw Error(message);};
let count=0,retired=0,nav=0,production=0;
for(const group of index.sources){
 const compressed=new Uint8Array(readFileSync(new URL('../src/data/'+group.file,import.meta.url)));
 const source=fuelStationSourceV351(compressed,group.keys,group.decodedBytes);
 for(const key of group.keys){
  const [mode,id]=key.split(':'),native=mode==='minecraft',plan=source.packets[key];
  const {raw,prepared}=JSON.parse(gunzipSync(readFileSync(`${directory}/${mode}-${id}.json.gz`)).toString());
  const ticket=drain(captureSourceQuarterPacketV303(raw,id,native,true,source,'fuel-stations-v351'));
  invariant(ticket,`raw receipt rejected ${key}`);
  const admitted=drain(ticket!(prepared));invariant(admitted!==prepared,`prepared receipt rejected ${key}`);
  invariant(admitted.meshes.length===prepared.meshes.length+1,`missing append ${key}`);
  for(let mi=0;mi<prepared.meshes.length;mi++){
   const part=prepared.meshes[mi],bytes=Buffer.from(part.indices,'base64');const original=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),actual=original.slice();
   const removed=new Set(plan.retire.find(r=>r.mesh===mi)?.triangles??[]);
   const changed=drain(applySourceQuarterTrianglesV303(admitted,mi,actual,0));invariant(changed===removed.size,`retirement count ${key}`);
   for(let t=0;t<original.length/3;t++)for(let a=0;a<3;a++)invariant(actual[t*3+a]===(removed.has(t)?original[t*3]:original[t*3+a]),`outside complement changed ${key}/${mi}/${t}`);
   retired+=changed;
  }
  const finalNav=sourceQuarterNavigationV303(admitted,prepared.nav);
  const complement=prepared.nav.buildings.filter((b:any)=>!plan.retireNav.some(r=>JSON.stringify(r)===JSON.stringify(b)));
  invariant(JSON.stringify(finalNav.buildings)===JSON.stringify([...complement,...plan.appendNav]),`navigation complement changed ${key}`);
  for(const roof of plan.appendNav.filter(b=>plan.retireNav.some(old=>old.sourceId===b.sourceId))){invariant(roof.minHeight>=2.5,`roof blocks passage ${key}`);invariant(roof.height>=roof.minHeight,`negative slab ${key}`);}
  for(const solid of plan.appendNav)invariant(solid.height>solid.minHeight,`zero solid ${key}`);
  const mismatch=structuredClone(raw);mismatch.origin[0]+=.01;
  invariant(!drain(captureSourceQuarterPacketV303(mismatch,id,native,true,source,'fuel-stations-v351')),`changed origin admitted ${key}`);
  invariant(!drain(captureSourceQuarterPacketV303(raw,id,native,false,source,'fuel-stations-v351')),`disabled admitted ${key}`);
  const missing=structuredClone(prepared);missing.meshes.pop();invariant(drain(ticket!(missing))===missing,`partial prepared predecessor admitted ${key}`);

  const prior=await previous(id,native),options=await productionOptionsV350(id,flags);
  const before=drain(buildSurroundingCityChunk(structuredClone(raw),id,native,false,{...options,sourceQuarterSourcesV303:prior}));
  const after=drain(buildSurroundingCityChunk(structuredClone(raw),id,native,false,{...options,sourceQuarterSourcesV303:[...prior,{kind:'fuel-stations-v351',source}]}));
  try{
   invariant(after.root.userData.sourceKinds.includes('fuel-stations-v351'),`not admitted in production ${key}`);
   const oldNav=before.nav.buildings.filter((b:any)=>!plan.retireNav.some(r=>JSON.stringify(r)===JSON.stringify(b)));
   invariant(JSON.stringify(after.nav.buildings)===JSON.stringify([...oldNav,...plan.appendNav]),`production nav complement differs ${key}`);
   invariant(before.root.children.length===after.root.children.length,`production child count ${key}`);
   const start=prepared.meshes.reduce((n:number,m:any)=>n+Buffer.from(m.positions,'base64').length/6,0),added=Buffer.from(plan.append!.positions,'base64').length/6;
   const allowed=new Set<number>();let indexOffset=0;
   for(let mi=0;mi<prepared.meshes.length;mi++){for(const r of plan.retire.filter(r=>r.mesh===mi))for(const t of r.triangles)allowed.add(indexOffset/3+t);indexOffset+=Buffer.from(prepared.meshes[mi].indices,'base64').length/4;}
   for(let child=0;child<before.root.children.length;child++){
    const a=before.root.children[child] as any,b=after.root.children[child] as any,av=words(a.geometry),bv=words(b.geometry);
    if(a.isMesh){
     invariant(bv.length===av.length+added*6,`production vertex total ${key}`);
     for(let i=0;i<av.length;i++)invariant(av[i]===bv[i<start*6?i:i+added*6],`old position/color differs ${key}/${i}`);
     const ai=a.geometry.getIndex().array,bi=b.geometry.getIndex().array;let oi=0;
     for(let i=0;i<bi.length;i+=3){
      const values=[bi[i],bi[i+1],bi[i+2]],inside=values.map(n=>n>=start&&n<start+added);
      if(inside.every(Boolean))continue;invariant(!inside.some(Boolean),`mixed new/old triangle ${key}`);
      const normalized=values.map(n=>n>=start+added?n-added:n),retired=allowed.has(oi/3);
      for(let a=0;a<3;a++)invariant(normalized[a]===(retired?ai[oi]:ai[oi+a]),`production outside index differs ${key}/${oi}/${a}`);
      oi+=3;
     }
     invariant(oi===ai.length,`production outside index accounting ${key}`);
    }else{invariant(av.length===bv.length&&Array.from(av).every((v,i)=>v===bv[i]),`production ink changed ${key}`);}
   }
   production++;
  }finally{dispose(before.root);dispose(after.root);}
  nav+=plan.retireNav.length;count++;
 }
}
console.log(JSON.stringify({packets:count,retiredWallTriangles:retired,correctedNavigationOwners:nav,productionDecodes:production,outsideGeometry:'identical',outsideNavigation:'identical',negativeGuards:'pass'}));

const fresh=JSON.parse(gunzipSync(readFileSync(new URL('../../../geo_data/regierungsviertel/fuel-v351-new-hosts.json.gz',import.meta.url))).toString());
let newDecodes=0;
for(const descriptor of fresh.chunks)for(const mode of ['drawn','minecraft']){
 const raw=JSON.parse(gunzipSync(readFileSync(new URL('../public/mesh/surrounding-berlin-v159/'+descriptor[mode].url,import.meta.url))).toString());
 const native=mode==='minecraft',decoded=drain(buildSurroundingCityChunk(structuredClone(raw),descriptor.id,native,false,{...await productionOptionsV350(descriptor.id,flags),sourceQuarterSourcesV303:await previous(descriptor.id,native)}));
 try{
  invariant(decoded.root.userData.sourceKinds.includes('fuel-stations-v351'),'new host missing body '+descriptor.id);
  invariant(JSON.stringify(decoded.nav)===JSON.stringify(raw.nav),'new host navigation changed '+descriptor.id);
  for(const part of raw.meshes){const bytes=Buffer.from(part.positions,'base64'),p=new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2);for(let i=0;i<p.length;i+=3){const x=p[i]/100+raw.origin[0],z=p[i+2]/100+raw.origin[2];invariant(x>=descriptor.bounds[0]-1e-6&&x<=descriptor.bounds[2]+1e-6&&z>=descriptor.bounds[1]-1e-6&&z<=descriptor.bounds[3]+1e-6,'new host escaped descriptor '+descriptor.id);}}
  for(const roof of decoded.nav.buildings.filter(b=>b.sourceId.includes(':roof:'))){
   const xs=roof.ring.map(p=>p[0]),zs=roof.ring.map(p=>p[1]);let clear=false,solid=false;
   for(let x=Math.min(...xs)+.25;x<Math.max(...xs);x+=.5)for(let z=Math.min(...zs)+.25;z<Math.max(...zs);z+=.5){
    if(!surroundingPolygonContains(roof,x,z))continue;
    if(!surroundingBuildingSolidAt(decoded.nav,x,decoded.nav.groundY+1.7,z,.1))clear=true;
    if(surroundingBuildingSolidAt(decoded.nav,x,decoded.nav.groundY+roof.minHeight+.1,z))solid=true;
   }
   invariant(clear&&solid,'new roof lacks clear passage or roof collision '+descriptor.id);
  }
  for(const post of decoded.nav.buildings.filter(b=>b.sourceId.includes(':post:'))){const x=(Math.min(...post.ring.map(p=>p[0]))+Math.max(...post.ring.map(p=>p[0])))/2,z=(Math.min(...post.ring.map(p=>p[1]))+Math.max(...post.ring.map(p=>p[1])))/2;invariant(surroundingBuildingSolidAt(decoded.nav,x,decoded.nav.groundY+1.5,z),'post has no collision '+descriptor.id);}
  newDecodes++;
 }finally{dispose(decoded.root);}
}
console.log(JSON.stringify({newHosts:fresh.chunks.length,newProductionDecodes:newDecodes,descriptorBounds:'pass',underRoofPassage:'pass',roofAndPostCollision:'pass'}));
