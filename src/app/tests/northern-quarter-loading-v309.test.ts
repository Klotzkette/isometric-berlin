import{expect,test}from"bun:test";
import{Mesh,OrthographicCamera}from"three";
import{createNorthernQuarterLoadingV309}from"../src/northernQuarterLoadingV309";
import{createSurroundingCity,type SurroundingCity,type SurroundingCityManifest}from"../src/SurroundingCity";
import type{SurroundingCityChunk}from"../src/SurroundingCityGeometry";
import type{SourceQuarterSourceV303}from"../src/SourceQuarterPacketV303";
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
const fnv=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const rect=(x:number)=>({ring:[[x,0],[x+512,0],[x+512,512],[x,512]],holes:[]as number[][][]});
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function until(p:()=>boolean){for(let i=0;i<500;i++){if(p())return;await new Promise(r=>setTimeout(r,2));}throw Error("bounded northern queue did not settle");}
function fixture(){
 const packets=new Map<string,SurroundingCityChunk>(),source:SourceQuarterSourceV303={schemaVersion:1,keys:[],packets:{}},manifest:SurroundingCityManifest={schemaVersion:1,groundY:3,footprint:[],chunks:[]};
 for(const[id,x]of[["north-preview",0],["ordinary-preview",2048]]as const){
  const part={kind:"city",positionType:"u16cm"as const,positions:b64(new Uint16Array([0,1300,0,100,1300,0,0,1400,0])),colors:b64(new Uint8Array(9).fill(80)),indices:b64(new Uint32Array([0,1,2]))},old={...rect(50),height:20,minHeight:0,sourceId:"exact-original"};
  const packet:SurroundingCityChunk={schemaVersion:1,origin:[x,-10,0],meshes:[part],nav:{groundY:3,ground:[rect(x)],water:[],buildings:[old]}};packets.set(id,packet);manifest.footprint.push(rect(x));manifest.chunks.push({id,bounds:[x,0,x+512,512],drawn:{url:`${id}.drawn.json`,bytes:JSON.stringify(packet).length},minecraft:{url:`${id}.minecraft.json`,bytes:JSON.stringify(packet).length}});
  if(id==="north-preview")for(const native of[false,true]){const key=`${native?"minecraft":"drawn"}:${id}`,pin={mesh:0,kind:part.kind,fingerprint:fnv(part.positions+part.colors+part.indices)},append={...part,kind:"north-test"};source.keys.push(key);source.packets[key]={origin:packet.origin,records:[pin],preparedRecords:[pin],navGuard:fnv(JSON.stringify(packet.nav)),preparedNavGuard:fnv(JSON.stringify(packet.nav)),lineGuard:null,preparedLineGuard:null,append,appendFingerprint:fnv(append.positions+append.colors+append.indices),retire:[{mesh:0,triangles:[0]}],retireLines:[],retireNav:[old],appendNav:[{...old,height:24,sourceId:"complete-northern-source"}],owners:["complete-northern-source"]};}
 }
 const camera=new OrthographicCamera(-2200,2200,600,-600,1,3000);camera.position.set(1280,500,256);camera.up.set(0,0,-1);camera.lookAt(1280,0,256);camera.updateMatrixWorld();
 const fetches:string[]=[];const fetcher=(async(input:URL|RequestInfo)=>{const url=new URL(String(input));if(url.pathname.endsWith("manifest.json"))return new Response(JSON.stringify(manifest));const id=url.pathname.split("/").at(-1)!.replace(/\.(drawn|minecraft)\.json$/,"");fetches.push(id);return new Response(JSON.stringify(packets.get(id)));})as typeof fetch;
 return{source,packets,camera,fetcher,fetches,recipes:async(id:string,_native:boolean)=>id==="north-preview"?[{source,kind:"north-test",requiredReplacement:true,admission:"north-v309"as const}]:[]};
}
test("pending northern models do not block exact original north or unrelated packets; completion reloads only affected residents",async()=>{
 const f=fixture(),pending=deferred<void>(),errors:unknown[]=[];let native=false,active=true,ready=false,requests=0,city!:SurroundingCity,clock=0;
 const load=createNorthernQuarterLoadingV309({loadRecipes:f.recipes,active:n=>active&&n===native,requestNorthern:()=>{requests++;return pending.promise.then(()=>{if(active){ready=true;city.refresh(++clock);}});},onError:e=>errors.push(e)});
 city=createSurroundingCity({camera:f.camera,manifestUrl:new URL("https://example.test/manifest.json"),fetch:f.fetcher,now:()=>clock,sourceQuartersV303:true,loadSourceQuarterSourcesV309:load,northFidelityV309:()=>ready});
 try{await city.ready;await until(()=>city.residentChunkCount===2&&!city.pending);expect(requests).toBe(1);const old=city.root.children.find(c=>c.name.includes("north-preview"))!,other=city.root.children.find(c=>c.name.includes("ordinary-preview"))!,mesh=old.children[0]as Mesh;expect(old.userData.sourceQuarterOwnersV303).toEqual([]);expect(Array.from(mesh.geometry.index!.array)).toEqual([0,1,2]);expect(city.navigationTiles.flatMap(t=>t.nav.buildings).every(b=>b.sourceId==="exact-original")).toBe(true);
  pending.resolve();await until(()=>city.residentChunkCount===2&&!city.pending&&city.root.children.some(c=>c.userData.sourceQuarterOwnersV303?.includes("complete-northern-source")));expect(city.root.children.includes(other)).toBe(true);expect(city.root.children.includes(old)).toBe(false);expect(f.fetches.filter(id=>id==="ordinary-preview")).toHaveLength(1);expect(f.fetches.filter(id=>id==="north-preview")).toHaveLength(2);const replacement=city.root.children.find(c=>c.name.includes("north-preview"))!;expect(Array.from((replacement.children[0]as Mesh).geometry.index!.array).slice(0,3)).toEqual([0,0,0]);expect(errors).toEqual([]);
 }finally{active=false;city.dispose();pending.resolve();}
});
test("model failure never rejects or retires an exact closed source packet",async()=>{
 const f=fixture(),pending=deferred<void>(),errors:unknown[]=[];let city!:SurroundingCity;const load=createNorthernQuarterLoadingV309({loadRecipes:f.recipes,active:()=>true,requestNorthern:()=>pending.promise,onError:e=>errors.push(e)});
 city=createSurroundingCity({camera:f.camera,manifestUrl:new URL("https://example.test/manifest.json"),fetch:f.fetcher,sourceQuartersV303:true,loadSourceQuarterSourcesV309:load,northFidelityV309:()=>false});
 try{await city.ready;await until(()=>city.residentChunkCount===2&&!city.pending);pending.reject(Error("model transport failed"));await until(()=>errors.length===1);expect(city.residentChunkCount).toBe(2);expect(city.root.children.every(c=>!c.userData.sourceQuarterOwnersV303?.length)).toBe(true);}finally{city.dispose();}
});
test("unmatched and late inactive recipe completion starts no northern construction; native requests are independent",async()=>{
 const f=fixture(),imports=deferred<Awaited<ReturnType<typeof f.recipes>>>(),old=deferred<void>(),calls:boolean[]=[];let mode=false,active=true;
 const load=createNorthernQuarterLoadingV309({loadRecipes:()=>imports.promise,active:n=>active&&n===mode,requestNorthern:n=>{calls.push(n);return old.promise;},onError:()=>{}});
 const late=load("north-preview",false);mode=true;imports.resolve(await f.recipes("north-preview",false));await late;await Promise.resolve();expect(calls).toEqual([]);await load("north-preview",true);await Promise.resolve();expect(calls).toEqual([true]);mode=false;await load("north-preview",false);await Promise.resolve();expect(calls).toEqual([true,false]);active=false;old.resolve();
});
