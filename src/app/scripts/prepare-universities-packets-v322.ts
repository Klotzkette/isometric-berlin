/** Exact ordinary predecessor stage. Raw published bytes are read-only. */
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {gunzipSync,gzipSync} from "node:zlib";
import {prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
const input=JSON.parse(readFileSync(Bun.argv[2],"utf8")) as {tasks:{mode:string;id:string;path:string;output:string}[]};
const fnv=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const pins=(p:SurroundingCityChunk)=>({records:p.meshes.map((m,mesh)=>({mesh,kind:m.kind,fingerprint:fnv(m.positions+m.colors+m.indices)})),nav:fnv(JSON.stringify(p.nav)),lines:p.lines?fnv(p.lines.positions+(p.lines.colors??"")):null});
const options:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true};
for(const task of input.tasks){
 if(existsSync(task.output))throw Error("Fresh external packet snapshot required");
 const bytes=readFileSync(task.path),packet=JSON.parse((bytes[0]===31?gunzipSync(bytes):bytes).toString()) as SurroundingCityChunk,raw=pins(packet);
 const steps=prepareSurroundingQuarterPredecessorV303(packet,task.id,task.mode==="minecraft",options);let n=steps.next();while(!n.done)n=steps.next();
 writeFileSync(task.output,gzipSync(JSON.stringify({raw,prepared:pins(n.value),packet:n.value})),{flag:"wx"});
 console.log(task.mode+":"+task.id,n.value.meshes.length);
}
