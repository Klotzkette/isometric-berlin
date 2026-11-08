import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {InterleavedBufferAttribute,Mesh,LineSegments} from "three";
import {NORTH_EAST_PUBLIC_SITES_KIND_V326 as kind,northEastPublicSiteGroundAtV326 as ground,northEastPublicSiteWaterAtV326 as water,northEastPublicSiteSolidAtV326 as solid} from "../src/NorthEastPublicSitesV326";
import data from "../src/data/northEastPublicSitesV326Packets.json";
import field from "../src/data/northEastPublicSitesV326Terrain.json";
import index from "../src/data/northEastPublicSitesV326Index.json";
import {buildSurroundingCityChunk,type SurroundingCityChunk,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {captureSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
const source=data as unknown as SourceQuarterSourceV303;
const done=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const options:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true,wilhelmStreetFrontsV325:true};
function raw(key:string):SurroundingCityChunk{const [mode,id]=key.split(":");return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());}
function buffers(root:Mesh){const p=root.geometry.getAttribute("position");if(!(p instanceof InterleavedBufferAttribute))throw Error("Changed actual decoder");return {words:p.data.array,index:root.geometry.index!.array};}
test("all four actual prepared packets add complete HQ/HSH fronts and preserve every old vertex, index, navigation and line word",async()=>{
 for(const key of source.keys){const [mode,id]=key.split(":"),native=mode==="minecraft",input=raw(key),snapshot=JSON.stringify(input),oldRecipes=(await loadSourceQuarterRecipesV309(id,native)).filter(r=>r.kind!==kind),oldOptions={...options,sourceQuarterSourcesV303:oldRecipes},before=done(buildSurroundingCityChunk(structuredClone(input),id,native,false,oldOptions));
  const after=done(buildSurroundingCityChunk(input,id,native,false,{...oldOptions,sourceQuarterSourcesV303:[...oldRecipes,{source,kind}]}));
  try{expect(after.root.userData.sourceKinds).toContain(kind);expect(JSON.stringify(input)).toBe(snapshot);expect(after.nav).toEqual(before.nav);
   const a=buffers(before.root.children.find(c=>c instanceof Mesh) as Mesh),b=buffers(after.root.children.find(c=>c instanceof Mesh) as Mesh),append=source.packets[key].append!;
   expect(b.words.subarray(0,a.words.length)).toEqual(a.words);expect([...b.index.subarray(0,a.index.length)]).toEqual([...a.index]);
   expect(b.words.byteLength-a.words.byteLength).toBe(Buffer.from(append.positions,"base64").byteLength*2);
   const ix=Buffer.from(append.indices,"base64"),indices=new Uint32Array(ix.buffer.slice(ix.byteOffset,ix.byteOffset+ix.byteLength));
   expect(b.index.length-a.index.length).toBe(indices.length);expect(b.index.subarray(a.index.length).every((n,i)=>n===indices[i]+a.words.length/6)).toBeTrue();
   const al=before.root.children.filter(c=>c instanceof LineSegments) as LineSegments[],bl=after.root.children.filter(c=>c instanceof LineSegments) as LineSegments[];expect(bl.length).toBe(al.length);
   for(let i=0;i<al.length;i++){for(const name of Object.keys(al[i].geometry.attributes)){const a=al[i].geometry.getAttribute(name),b=bl[i].geometry.getAttribute(name);expect(b instanceof InterleavedBufferAttribute?b.data.array:b.array).toEqual(a instanceof InterleavedBufferAttribute?a.data.array:a.array);}expect(bl[i].geometry.index?.array).toEqual(al[i].geometry.index?.array);}
  }finally{disposeSurroundingCityRoot(before.root);disposeSurroundingCityRoot(after.root);}
 }
},30000);
test("closed capture and changed/cancelled original packets never acquire a new owner",()=>{
 const key=source.keys[0],[mode,id]=key.split(":"),native=mode==="minecraft",input=raw(key),snapshot=JSON.stringify(input);
 expect(done(captureSourceQuarterPacketV303(input,id,native,false,source,kind))).toBeUndefined();
 const changed=structuredClone(input);changed.meshes[0].colors="AAAA"+changed.meshes[0].colors.slice(4);expect(done(captureSourceQuarterPacketV303(changed,id,native,true,source,kind))).toBeUndefined();
 const steps=captureSourceQuarterPacketV303(input,id,native,true,source,kind);expect(steps.next().done).toBeFalse();steps.return(undefined);expect(JSON.stringify(input)).toBe(snapshot);
});
test("all 26 new normal packets use the actual bounded decoder and independent native roof caps",()=>{
 for(const entry of index.chunks)for(const native of [false,true]){const packet=raw(`${native?"minecraft":"drawn"}:${entry.id}`),snapshot=JSON.stringify(packet),built=done(buildSurroundingCityChunk(packet,entry.id,native,false,options));
  try{expect(built.geometryBytes).toBeLessThanOrEqual(24*1024*1024);expect(built.root.children.some(c=>c instanceof Mesh)).toBeTrue();expect(JSON.stringify(packet)).toBe(snapshot);
   for(const building of built.nav.buildings){if(native){expect(building.nativeRoofCaps?.length).toBeGreaterThan(0);expect(building.roofTriangles).toBeUndefined();for(const cap of building.nativeRoofCaps!){expect(cap[2]-cap[0]).toBe(1);expect(cap[3]-cap[1]).toBe(1);expect(cap[4]).toBeGreaterThan(0);}}else{expect(building.roofTriangles?.length).toBeGreaterThan(0);expect(building.nativeRoofCaps).toBeUndefined();}}
  }finally{disposeSurroundingCityRoot(built.root);}
 }
},30000);
test("official triangle terrain, lake identity, all eight actual steps and granular fountain/trunk collision agree in both families",()=>{
 expect(ground(0,0)).toBeNull();expect(water(0,0)).toBeNull();expect(solid(0,0,0)).toBeFalse();
 const lake=field.lake[0].ring;let lx=0,lz=0;for(const p of lake){lx+=p[0];lz+=p[1];}lx/=lake.length;lz/=lake.length;
 expect(water(lx,lz)).toBe(1.18);expect(ground(lx,lz)).toBeNull();
 for(const native of [false,true]){const rows=native?field.fountainSteps.native:field.fountainSteps.drawn;expect(rows.length).toBe(8);
  for(const step of rows){const x=step.ring.reduce((s,p)=>s+p[0],0)/step.ring.length,z=step.ring.reduce((s,p)=>s+p[1],0)/step.ring.length;expect(ground(x,z,native)).toBe(step.top);expect(ground(x,z,native,true)).toBe(step.top);}
  const t=field.trees[0],y=(native?t.nativeY:t.drawnY)+1;expect(solid(t.x,y,t.z,0,native)).toBeTrue();expect(solid(t.x+4,y,t.z,0,native)).toBeFalse();
  const parts=field.fountainSolids[native?"native":"drawn"],p=parts.find(p=>p.ring.length===4&&p.high-p.low>.15)!;expect(p).toBeDefined();const x=p.ring.reduce((s,q)=>s+q[0],0)/4,z=p.ring.reduce((s,q)=>s+q[1],0)/4;expect(solid(x,(p.low+p.high)/2,z,0,native)).toBeTrue();
 }
});
