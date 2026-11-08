import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {InterleavedBufferAttribute,Mesh} from "three";
import index from "../src/data/networkFidelityV326Index.json";
import {buildSurroundingCityChunk,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {captureSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
const KIND="network-fidelity-v326",root=new URL("../../../",import.meta.url),pub=new URL("src/app/public/mesh/surrounding-berlin-v159/",root);
const manifest=JSON.parse(gunzipSync(readFileSync(new URL("geo_data/regierungsviertel/public-fidelity-v326-published206-manifest.json.gz",root))).toString()),descriptors=new Map<string,any>(manifest.chunks.map((d:any)=>[d.id,d]));
const flags:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true};
const done=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function raw(key:string):SurroundingCityChunk{const [mode,id]=key.split(":"),url=descriptors.get(id)?.[mode]?.url;if(!url)throw Error("Foreign actual source");const p=new URL(url,pub),b=readFileSync(p);return JSON.parse((p.pathname.endsWith(".gz")?gunzipSync(b):b).toString());}
async function sourceFor(key:string):Promise<SourceQuarterSourceV303>{const entry=index.sources.find(e=>e.keys.includes(key));if(!entry)throw Error("Missing finite source key");return(await import("../src/data/"+entry.file)).default as SourceQuarterSourceV303;}
function words(root:Mesh){const a=root.geometry.getAttribute("position");if(!(a instanceof InterleavedBufferAttribute))throw Error("Changed actual compact decoder");return{v:a.data.array,i:root.geometry.index!.array};}
test("actual prepared network additions preserve every old vertex/index/nav word and fit the unchanged live caps",async()=>{
 const advertised=(index as unknown as {samples?:Record<string,string>}).samples;
 const samples=advertised?[...new Set(Object.values(advertised))]:index.sources.slice(0,2).flatMap(s=>s.keys.slice(0,2));expect(samples.length).toBeGreaterThan(0);
 for(const key of samples){const [mode,id]=key.split(":"),native=mode==="minecraft",source=await sourceFor(key),plan=source.packets[key];expect(plan.navGuard).toBeGreaterThan(0);expect(plan.preparedRecords.length).toBeGreaterThan(0);
  const input=raw(key),snapshot=JSON.stringify(input),old=(await loadSourceQuarterRecipesV309(id,native)).filter(e=>e.kind!==KIND),options={...flags,sourceQuarterSourcesV303:old};
  const before=done(buildSurroundingCityChunk(structuredClone(input),id,native,false,options)),after=done(buildSurroundingCityChunk(input,id,native,false,{...options,sourceQuarterSourcesV303:[...old,{source,kind:KIND}]}));
  try{expect(after.root.userData.sourceKinds).toContain(KIND);expect(JSON.stringify(input)).toBe(snapshot);expect(after.nav).toEqual(before.nav);
   const a=words(before.root.children.find(o=>o instanceof Mesh) as Mesh),b=words(after.root.children.find(o=>o instanceof Mesh) as Mesh);
   expect(b.v.subarray(0,a.v.length)).toEqual(a.v);expect([...b.i.subarray(0,a.i.length)]).toEqual([...a.i]);expect(after.geometryBytes).toBeLessThanOrEqual(24*1024*1024);
   const append=plan.append!,ib=Buffer.from(append.indices,"base64"),ii=new Uint32Array(ib.buffer.slice(ib.byteOffset,ib.byteOffset+ib.byteLength));expect(b.v.byteLength-a.v.byteLength).toBe(Buffer.from(append.positions,"base64").byteLength*2);expect(b.i.length-a.i.length).toBe(ii.length);expect(b.i.subarray(a.i.length).every((v,i)=>v===ii[i]+a.v.length/6)).toBeTrue();
  }finally{disposeSurroundingCityRoot(before.root);disposeSurroundingCityRoot(after.root);}
 }
},60000);
test("closed default, a foreign source word/origin, corrupted append and cancellation preserve all originals",async()=>{
 const key=index.sources[0].keys[0],[mode,id]=key.split(":"),native=mode==="minecraft",source=await sourceFor(key),input=raw(key),snapshot=JSON.stringify(input);
 expect(done(captureSourceQuarterPacketV303(input,id,native,false,source,KIND))).toBeUndefined();
 for(const changed of [{...input,origin:[input.origin[0]+1,input.origin[1],input.origin[2]]},structuredClone(input)]){
  if(changed.origin[0]===input.origin[0])changed.meshes[0].positions="AAAA"+changed.meshes[0].positions.slice(4);
  expect(done(captureSourceQuarterPacketV303(changed,id,native,true,source,KIND))).toBeUndefined();
 }
 const altered=structuredClone(source),append=altered.packets[key].append!;append.colors="AAAA"+append.colors.slice(4);expect(done(captureSourceQuarterPacketV303(input,id,native,true,altered,KIND))).toBeUndefined();
 const pending=captureSourceQuarterPacketV303(input,id,native,true,source,KIND);expect(pending.next().done).toBeFalse();pending.return(undefined);expect(JSON.stringify(input)).toBe(snapshot);
});
