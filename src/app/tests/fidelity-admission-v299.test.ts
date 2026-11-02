import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {PerspectiveCamera} from "three";
import {createSurroundingCity} from "../src/SurroundingCity";
import type {SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import {wallGalleryHillGroundAtV298} from "../src/wallGalleryV298Profile";
import {installFidelityNavigationV296} from "../src/FidelityNavigationV296";
import type {PedestrianEnvironment} from "../src/pedestrianNavigation";

const settle=async(p:()=>boolean)=>{for(let i=0;i<1200;i++){if(p())return;await new Promise(r=>setTimeout(r,5));}throw Error("bounded v299 admission did not settle");};
test("late complete owners affect only the exact requested receipt tile and revoke without resetting neighbours",async()=>{
 for(const [id,native,kind] of [["4_-6",false,"hill"],["4_-6",true,"hill"],["5_0",false,"litten"]] as const){
  const raw=gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${native?"minecraft":"drawn"}.json.gz`,import.meta.url))),body=raw.toString(),packet=JSON.parse(body) as SurroundingCityChunk;
  const x=packet.origin[0],z=packet.origin[2],bounds=[x,z,x+512,z+512];
  const foreign={schemaVersion:1,origin:[x,-10,z],meshes:[],nav:{groundY:3,ground:[{ring:[[0,0],[32,0],[32,32],[0,32]],holes:[]}],water:[],buildings:[]}};
  const foreignBody=JSON.stringify(foreign),asset={url:"owner.json",bytes:raw.length},other={url:"foreign.json",bytes:Buffer.byteLength(foreignBody)};
  const manifest={schemaVersion:1,groundY:3,footprint:[{ring:[[x,z],[x+512,z],[x+512,z+512],[x,z+512]],holes:[]}],chunks:[{id,bounds,drawn:asset,minecraft:asset},{id:"unrelated-v299",bounds,drawn:other,minecraft:other}]};
  const camera=new PerspectiveCamera(45,1,1,10000);camera.position.set(x+256,700,z+256);camera.lookAt(x+256,0,z+257);camera.updateMatrixWorld();
  const calls=new Map<string,number>();let ready=false;
  const city=createSurroundingCity({manifestUrl:new URL("https://example.test/manifest.json"),camera,mode:native?"minecraft":"day",wallGalleryV298:()=>kind==="hill"&&ready,littenStadthausV297:()=>kind==="litten"&&ready,fetch:(async input=>{const name=new URL(String(input)).pathname;calls.set(name,(calls.get(name)??0)+1);return new Response(name.endsWith("manifest.json")?JSON.stringify(manifest):name.endsWith("owner.json")?body:foreignBody);}) as typeof fetch});
  try{
   await city.ready;await settle(()=>city.residentChunkCount===2&&!city.pending);
   const owner=()=>city.root.children.find(g=>g.name.includes(` ${id}`))!,neighbour=city.root.children.find(g=>g.name.includes(" unrelated-v299"))!,old=owner();
   expect(old).toBeDefined();expect(neighbour).toBeDefined();expect(calls.get("/owner.json")).toBe(1);
   const admitted=()=>kind==="hill"?owner()?.userData.mauerparkTerrainV298===true:owner()?.userData.littenStadthausTrianglesV297===200;
   expect(admitted()).toBe(false);ready=true;city.refresh(performance.now()+1000);await settle(()=>city.residentChunkCount===2&&!city.pending&&admitted());
   expect(owner()).not.toBe(old);expect(city.root.children).toContain(neighbour);expect(calls.get("/foreign.json")).toBe(1);
   if(kind==="hill")expect(city.groundAt(2250,-2630)).toBeCloseTo(wallGalleryHillGroundAtV298(2250,-2630,native,3)!,3);
   city.refresh(performance.now()+2000);await new Promise(r=>setTimeout(r,10));expect(calls.get("/owner.json")).toBe(2);
   ready=false;city.refresh(performance.now()+3000);await settle(()=>city.residentChunkCount===2&&!city.pending&&!admitted());
   expect(calls.get("/owner.json")).toBe(3);expect(calls.get("/foreign.json")).toBe(1);expect(city.root.children).toContain(neighbour);
   if(kind==="hill")expect(city.groundAt(2250,-2630)).toBe(3);
  }finally{city.dispose();}
 }
});

test("the preserved wall is physical only with its completed current representation",()=>{
 let ready=false;
 const environment={groundAt:()=>5.2,solidAt:()=>false} as unknown as PedestrianEnvironment;
 installFidelityNavigationV296(environment,()=>({wallGallery:ready}));
 // Exact retained East Side polygon anchor, not a district-wide blocking box.
 expect(environment.interiorSolidAt?.(4881.199941,6,1826.512364,.2)).toBe(false);
 ready=true;expect(environment.interiorSolidAt?.(4881.199941,6,1826.512364,.2)).toBe(true);
 expect(environment.interiorSolidAt?.(4870,6,1850,.2)).toBe(false);
 ready=false;expect(environment.interiorSolidAt?.(4881.199941,6,1826.512364,.2)).toBe(false);
});
