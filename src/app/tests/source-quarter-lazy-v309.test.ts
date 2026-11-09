import {describe,expect,test,spyOn} from "bun:test";
import {BufferGeometry,Mesh,OrthographicCamera} from "three";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {gunzipSync} from "node:zlib";
import {createSourceQuarterRecipeLoaderV309,loadSourceQuarterRecipesV309,SOURCE_QUARTER_CATALOGUE_V309,type SourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {createSurroundingCity,type SurroundingCityManifest} from "../src/SurroundingCity";
import {SOURCE_QUARTERS_V303} from "../src/SourceQuartersV303";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303} from "../src/SourceQuarterPacketV303";
import {prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";

function gate<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function until(check:()=>boolean){for(let i=0;i<500;i++){if(check())return;await new Promise(r=>setTimeout(r,2));}throw Error("Bounded lazy loader did not settle");}
const b64=(a:Uint8Array|Uint16Array|Uint32Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
const rect=(x:number)=>({ring:[[x,0],[x+512,0],[x+512,512],[x,512]],holes:[] as number[][][]});
function packet(x=0):SurroundingCityChunk{return{schemaVersion:1,origin:[x,-10,0],meshes:[{kind:"ground",positionType:"u16cm",positions:b64(new Uint16Array([0,1300,0,51200,1300,0,0,1300,51200])),colors:b64(new Uint8Array([128,64,32,128,64,32,128,64,32])),indices:b64(new Uint32Array([0,1,2]))}],nav:{groundY:3,ground:[rect(0)],water:[],buildings:[]}};}
function manifest(two=false):SurroundingCityManifest{return{schemaVersion:1,groundY:3,footprint:[rect(0),...(two?[rect(2048)]:[])],chunks:(two?[0,2048]:[0]).map(x=>({id:`lazy-${x}`,bounds:[x,0,x+512,512],drawn:{url:`${x}.drawn.json`,bytes:JSON.stringify(packet(x)).length},minecraft:{url:`${x}.minecraft.json`,bytes:JSON.stringify(packet(x)).length}}))};}
function camera(){const c=new OrthographicCamera(-275,275,300,-300,1,3000);c.position.set(256,500,256);c.up.set(0,0,-1);c.lookAt(256,0,256);c.updateMatrixWorld();return c;}
const response=(value:unknown)=>new Response(JSON.stringify(value));
const fetcher=(source:SurroundingCityManifest,onPacket?:(signal:AbortSignal,url:URL)=>Promise<Response>|Response):typeof fetch=>(async(input:URL|RequestInfo,init?:RequestInit)=>{const url=new URL(String(input));return url.pathname.endsWith("manifest.json")?response(source):onPacket?.(init!.signal!,url)??response(packet(url.pathname.includes("2048")?2048:0));}) as typeof fetch;
function done<T>(g:Generator<void,T>):T{let r=g.next();while(!r.done)r=g.next();return r.value;}

describe("exact lazy source-quarter recipes v309",()=>{
 test("unmatched IDs import nothing; matching family shares one complete in-flight recipe",async()=>{
  const wait=gate<{default:unknown}>();let calls=0;
  const source={schemaVersion:1,keys:["drawn:exact","minecraft:exact"],packets:{"drawn:exact":{},"minecraft:exact":{}}};
  const load=createSourceQuarterRecipeLoaderV309([{keys:source.keys,kind:"bounded",requiredReplacement:true,load:()=>{calls++;return wait.promise;}}]);
  expect(await load("almost-exact")).toEqual([]);expect(calls).toBe(0);
  const a=load("exact"),b=load("exact",true);await until(()=>calls===1);wait.resolve({default:source});
  const [aa,bb]=await Promise.all([a,b]);expect(aa[0].source).toBe(source);expect(bb[0].source).toBe(source);expect(aa[0].requiredReplacement).toBe(true);expect(calls).toBe(1);
 });
 test("rejected or incomplete imports clear only their cache entry and can retry",async()=>{
  let calls=0;const source={schemaVersion:1,keys:["drawn:exact"],packets:{"drawn:exact":{}}};
  const load=createSourceQuarterRecipeLoaderV309([{keys:source.keys,kind:"bounded",load:async()=>{calls++;if(calls===1)throw Error("offline");return{default:calls===2?{...source,packets:{}}:source};}}]);
  await expect(load("exact")).rejects.toThrow("offline");await expect(load("exact")).rejects.toThrow("Incomplete exact");expect((await load("exact"))[0].source).toBe(source);expect(calls).toBe(3);
 });
 test("all exact catalogue keys and full immutable recipes equal the existing static path",async()=>{
  expect(SOURCE_QUARTER_CATALOGUE_V309.filter(entry=>entry.admission===undefined)).toHaveLength(48);
  expect(await loadSourceQuarterRecipesV309("unmapped-source-id")).toEqual([]);
  const legacyLoader=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>SOURCE_QUARTERS_V303.some(old=>old.kind===e.kind)));
  for(const old of SOURCE_QUARTERS_V303){const catalogue=SOURCE_QUARTER_CATALOGUE_V309.find(e=>e.kind===old.kind)!;expect([...catalogue.keys].sort()).toEqual([...old.source.keys].sort());for(const key of old.source.keys){const [mode,id]=key.split(":"),loaded=await legacyLoader(id,mode==="minecraft");const entry=loaded.find(e=>e.kind===old.kind)!;expect(entry.source).toEqual(old.source);expect(entry.requiredReplacement).toBe(old.requiredReplacement);}}
 });
 test("actual full predecessor admission is identical with lazy and static recipe sources",async()=>{
  const legacyLoader=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>SOURCE_QUARTERS_V303.some(old=>old.kind===e.kind)));
  const ownership={neighbourhoodV300:true,westKiezV302:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,tachelesFrontsV270:true};
  for(const old of SOURCE_QUARTERS_V303)for(const native of [false,true]){
   const mode=native?"minecraft":"drawn",key=old.source.keys.find(k=>k.startsWith(mode+":")&&old.source.packets[k]?.preparedRecords)!;expect(key).toBeDefined();const id=key.split(":")[1];
   const raw=JSON.parse(gunzipSync(readFileSync(resolve(import.meta.dir,`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`))).toString()) as SurroundingCityChunk;
   const lazy=(await legacyLoader(id,native)).find(e=>e.kind===old.kind)!;
   const a=done(captureSourceQuarterPacketV303(raw,id,native,true,old.source,old.kind,old.requiredReplacement));const b=done(captureSourceQuarterPacketV303(raw,id,native,true,lazy.source,lazy.kind,lazy.requiredReplacement));expect(!!b).toBe(!!a);expect(b).toBeDefined();const prior=done(prepareSurroundingQuarterPredecessorV303(raw,id,native,ownership));expect(done(prepareSourceQuarterPacketV303(prior,b))).toEqual(done(prepareSourceQuarterPacketV303(prior,a)));
  }
 });
 for(const first of ["transport","recipe"])test(`transport and recipe overlap, geometry waits for both (${first} first)`,async()=>{
  const transport=gate<Response>(),recipe=gate<SourceQuarterRecipesV309>();let fetchCalls=0,imports=0;const allocations=spyOn(BufferGeometry.prototype,"setAttribute");
  const city=createSurroundingCity({camera:camera(),manifestUrl:new URL("https://example.test/manifest.json"),sourceQuartersV303:true,loadSourceQuarterSourcesV309:()=>{imports++;return recipe.promise;},fetch:fetcher(manifest(),()=>{fetchCalls++;return transport.promise;})});
  try{await city.ready;await until(()=>fetchCalls===1&&imports===1);if(first==="transport")transport.resolve(response(packet()));else recipe.resolve([]);await new Promise(r=>setTimeout(r,10));expect(city.residentChunkCount).toBe(0);expect(allocations).not.toHaveBeenCalled();if(first==="transport")recipe.resolve([]);else transport.resolve(response(packet()));await until(()=>city.residentChunkCount===1&&!city.pending);expect((city.root.children[0].children[0] as Mesh).geometry.index!.count).toBe(3);}finally{allocations.mockRestore();city.dispose();transport.resolve(response(packet()));recipe.resolve([]);}
 });
 test("a stale unabortable recipe cannot block a newly desired region or publish late",async()=>{
  const old=gate<SourceQuarterRecipesV309>(),view=camera();let clock=0;const imports:string[]=[];
  const city=createSurroundingCity({camera:view,manifestUrl:new URL("https://example.test/manifest.json"),sourceQuartersV303:true,now:()=>clock,retireMs:0,loadSourceQuarterSourcesV309:async id=>{imports.push(id);return id==="lazy-0"?old.promise:[];},fetch:fetcher(manifest(true))});
  try{await city.ready;await until(()=>imports.length===1);clock=1000;view.position.x=2304;view.lookAt(2304,0,256);city.refresh(clock);await until(()=>city.residentChunkCount===1&&!city.pending);expect(imports).toEqual(["lazy-0","lazy-2048"]);expect(city.navigationTiles.map(t=>t.origin[0])).toEqual([2048]);old.resolve([]);await new Promise(r=>setTimeout(r,10));expect(city.navigationTiles.map(t=>t.origin[0])).toEqual([2048]);}finally{old.resolve([]);city.dispose();}
 });
 test("native switch and disposal reject late recipe completion",async()=>{
  const old=gate<SourceQuarterRecipesV309>();const modes:boolean[]=[];
  const city=createSurroundingCity({camera:camera(),manifestUrl:new URL("https://example.test/manifest.json"),sourceQuartersV303:true,loadSourceQuarterSourcesV309:async(_id,native)=>{modes.push(native);return native?[]:old.promise;},fetch:fetcher(manifest())});
  try{await city.ready;await until(()=>modes.length===1);city.setMode("minecraft");await until(()=>city.residentChunkCount===1&&!city.pending);expect(modes).toEqual([false,true]);expect(city.root.children[0].userData.nativeMinecraft).toBe(true);city.dispose();old.resolve([]);await new Promise(r=>setTimeout(r,10));expect(city.root.children).toHaveLength(0);}finally{old.resolve([]);city.dispose();}
 });
 test("failed imports use the existing bounded retry cadence and abort pending transport",async()=>{
  let calls=0,clock=0;const errors:string[]=[],signals:AbortSignal[]=[];
  const city=createSurroundingCity({camera:camera(),manifestUrl:new URL("https://example.test/manifest.json"),sourceQuartersV303:true,now:()=>clock,loadSourceQuarterSourcesV309:async()=>{calls++;if(calls===1)throw Error("offline recipe");return[];},fetch:fetcher(manifest(),signal=>{signals.push(signal);return response(packet());}),onError:error=>errors.push(error)});
  try{await city.ready;await until(()=>errors.length===1&&!city.pending);expect(signals[0].aborted).toBe(true);for(clock=500;clock<5000;clock+=500)city.refresh(clock);await new Promise(r=>setTimeout(r,10));expect(calls).toBe(1);clock=31000;city.refresh(clock);await until(()=>city.residentChunkCount===1&&!city.pending);expect(calls).toBe(2);expect(errors).toEqual(["offline recipe"]);}finally{city.dispose();}
 });
 test("disabled source quarters never invoke optional lazy imports and retain static compatibility",async()=>{
  let imports=0;const city=createSurroundingCity({camera:camera(),manifestUrl:new URL("https://example.test/manifest.json"),sourceQuartersV303:false,sourceQuarterSourcesV303:[],loadSourceQuarterSourcesV309:async()=>{imports++;return[];},fetch:fetcher(manifest())});
  try{await city.ready;await until(()=>city.residentChunkCount===1&&!city.pending);expect(imports).toBe(0);}finally{city.dispose();}
 });
});
