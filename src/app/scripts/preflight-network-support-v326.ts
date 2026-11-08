/** Serial real packet decoder, not a city constructor. Only finite floor
 * unavailability/pins leave this job; every temporary root is disposed. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {Mesh,InterleavedBufferAttribute} from "three";
import {buildSurroundingCityChunk,prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {captureSourceQuarterPacketV303} from "../src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
const root=resolve(import.meta.dir,"../../.."),pub=resolve(root,"src/app/public/mesh/surrounding-berlin-v159"),output=resolve(root,"geo_data/regierungsviertel/raw/public-fidelity-v326/network-packet-support.json");
const manifestBytes=gunzipSync(readFileSync(resolve(root,"geo_data/regierungsviertel/public-fidelity-v326-published206-manifest.json.gz")));
if(createHash("sha256").update(manifestBytes).digest("hex")!=="a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e")throw Error("Changed immutable published206 manifest");
const manifest=JSON.parse(manifestBytes.toString()),requested=Bun.argv[2]?new Set<string>(JSON.parse(readFileSync(Bun.argv[2],"utf8"))):undefined;
const hash=(v:unknown)=>{let h=2166136261;for(const c of typeof v==="string"?v:JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const done=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
const result:Record<string,unknown>={};let count=0;
for(const descriptor of manifest.chunks){if(descriptor.detailCompanionOf)continue;
 for(const mode of ["drawn","minecraft"]){const key=mode+":"+descriptor.id;if(requested&&!requested.has(key))continue;
  const path=resolve(pub,descriptor[mode].url),bytes=readFileSync(path),raw=JSON.parse((path.endsWith(".gz")?gunzipSync(bytes):bytes).toString())as SurroundingCityChunk;
  if(raw.origin[1]!==-10||raw.nav.groundY!==3||!raw.meshes.some(m=>m.kind==="city"))continue;
  const native=mode==="minecraft",recipes=(await loadSourceQuarterRecipesV309(descriptor.id,native)).filter(r=>r.kind!=="network-fidelity-v326"),options={...flags,sourceQuarterSourcesV303:recipes};
  const tickets=recipes.map(entry=>entry.source.packets[key]?.preparedRecords?done(captureSourceQuarterPacketV303(raw,descriptor.id,native,true,entry.source,entry.kind,entry.requiredReplacement)):done(captureNeighbourhoodPacketV300(raw,descriptor.id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind))).filter(t=>!!t);
  let prepared=done(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),descriptor.id,native,options));for(const ticket of tickets)prepared=done(ticket!(prepared));
  const built=done(buildSurroundingCityChunk(structuredClone(raw),descriptor.id,native,false,options));
  try{const body=built.root.children.find(c=>c instanceof Mesh)as Mesh|undefined,attribute=body?.geometry.getAttribute("position"),index=body?.geometry.index?.array;
   if(!body||!(attribute instanceof InterleavedBufferAttribute)||!index)throw Error("Missing actual aggregate "+key);
   const unavailable:Record<string,number[]>={};let vertexOffset=0,indexOffset=0;
   for(let mesh=0;mesh<raw.meshes.length;mesh++){const part=raw.meshes[mesh],pbytes=Buffer.from(part.positions,"base64"),ibytes=Buffer.from(part.indices,"base64"),xyz=new Uint16Array(pbytes.buffer.slice(pbytes.byteOffset,pbytes.byteOffset+pbytes.byteLength)),ix=new Uint32Array(ibytes.buffer.slice(ibytes.byteOffset,ibytes.byteOffset+ibytes.byteLength));
    if(part.kind==="city")for(let n=0;n<ix.length;n+=3){const y=xyz[ix[n]*3+1];if(y<1300||y>1316||xyz[ix[n+1]*3+1]!==y||xyz[ix[n+2]*3+1]!==y)continue;
     let valid=true;for(let j=0;j<3;j++){const v=ix[n+j],actual=v+vertexOffset;if(index[indexOffset+n+j]!==actual||attribute.getX(actual)!==xyz[v*3]||attribute.getY(actual)!==xyz[v*3+1]||attribute.getZ(actual)!==xyz[v*3+2])valid=false;}
     if(!valid)(unavailable[String(mesh)]??=[]).push(n/3);
    }
    vertexOffset+=xyz.length/3;indexOffset+=ix.length;
   }
   const records=(c:SurroundingCityChunk)=>c.meshes.map((p,mesh)=>({mesh,kind:p.kind,fingerprint:hash(p.positions+p.colors+p.indices)}));
   result[key]={sourceSha256:createHash("sha256").update(bytes).digest("hex"),records:records(raw),preparedRecords:records(prepared),navGuard:hash(raw.nav),preparedNavGuard:hash(prepared.nav),lineGuard:raw.lines?hash(raw.lines.positions+(raw.lines.colors??"")):null,preparedLineGuard:prepared.lines?hash(prepared.lines.positions+(prepared.lines.colors??"")):null,unavailable};
  }finally{disposeSurroundingCityRoot(built.root);}
  count++;if(count%50===0){writeFileSync(output,JSON.stringify(result)+"\n");console.log(JSON.stringify({processed:count,key}));}
 }
}
writeFileSync(output,JSON.stringify(result)+"\n");console.log(JSON.stringify({complete:true,processed:count,output}));
