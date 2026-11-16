import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {railwayParksSourceV354,RAILWAY_PARKS_KIND_V354} from '../src/RailwayParksV354';
import index from '../src/data/railwayParksV354Index.json';
import {SOURCE_QUARTER_CATALOGUE_V309,createSourceQuarterRecipeLoaderV309} from '../src/SourceQuarterCatalogueV309';
import {groundOverlayKindsV329,prepareSurroundingQuarterPredecessorV303} from '../src/SurroundingCityGeometry';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {captureNeighbourhoodPacketV300} from '../src/NeighbourhoodPacketV300';
import {proveProductionV350} from '../scripts/railway-production-proof-v354';
import {optionsV342} from './helpers/neukoellnPredecessorV342';
import manifest from '../public/mesh/surrounding-berlin-v159/manifest.json';
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const prior=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>e.kind!==RAILWAY_PARKS_KIND_V354));
for(const row of index.sources)test(`V354 complete railway-park production retention ${row.keys[0]}`,async()=>{
 const wire=readFileSync(new URL('../src/data/'+row.file,import.meta.url));
 const source=railwayParksSourceV354(wire,row.keys,row.decodedBytes);
 expect(()=>railwayParksSourceV354(wire,row.keys,1).packets[row.keys[0]]).toThrow();
 const [mode,id]=row.keys[0].split(':');const native=mode==='minecraft',plan=source.packets[row.keys[0]];
 const desc=manifest.chunks.find(c=>c.id===id)!;
 const raw=JSON.parse(gunzipSync(readFileSync(new URL('../public/mesh/surrounding-berlin-v159/'+desc[native?'minecraft':'drawn'].url,import.meta.url))).toString());
 const options=await optionsV342(id,native);const entries=await prior(id,native);
 let prepared=drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,options));
 for(const e of entries.filter(e=>!groundOverlayKindsV329.has(e.kind))){
  const ticket=e.source.packets[row.keys[0]]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,e.source as any,e.kind));
  if(ticket)prepared=drain(ticket(prepared));
 }
 expect(plan.retire).toEqual([]);expect(plan.retireNav).toEqual([]);expect(plan.retireLines).toEqual([]);
 const start=prepared.meshes.reduce((n,m)=>n+Buffer.from(m.positions,'base64').length/6,0);
 const proof=await proveProductionV350(raw,id,native,options,entries,source as any,start);
 expect(proof).toMatchObject({valid:true});expect(plan.owners.length).toBeGreaterThan(0);
},120000);
