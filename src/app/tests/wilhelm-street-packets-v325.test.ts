/** Decode the actual old pipeline with both sequential retirement-only tickets. */
import {expect,test}from"bun:test";
import {readFileSync}from"node:fs";
import {gunzipSync}from"node:zlib";
import {Mesh}from"three";
import source from"../src/data/wilhelmStreetFrontsV325Packets.json";
import previous from"../src/data/wilhelmHousingV324Packets.json";
import {createSurroundingCityChunk,type SurroundingCityChunk}from"../src/SurroundingCityGeometry";
import {loadSourceQuarterRecipesV309}from"../src/SourceQuarterCatalogueV309";
function release(root:ReturnType<typeof createSurroundingCityChunk>){const all=new Set<any>();root.root.traverse((o:any)=>{if(o.geometry)all.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)all.add(m);});for(const r of all)r.dispose();root.root.clear();}
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
test("both actual tiles preserve every source word and old admission while retiring only the additional exact6288 facets",async()=>{
 for(const key of source.keys){
  const id=key.slice(6),raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.drawn.json.gz`,import.meta.url))).toString())as SurroundingCityChunk;
  const json=JSON.stringify(raw),recipes=await loadSourceQuarterRecipesV309(id,false),options={sourceQuartersV303:true,sourceQuarterSourcesV303:recipes,neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,wilhelmHousingV324:true};
  const baseline=createSurroundingCityChunk(raw,id,false,options),actual=createSurroundingCityChunk(raw,id,false,{...options,wilhelmStreetFrontsV325:true});
  try{
   const plan=source.packets[key as keyof typeof source.packets],old=previous.packets[key as keyof typeof previous.packets];
   expect(plan.append).toBeNull();expect(plan.retireLines).toHaveLength(0);expect(plan.retireNav).toHaveLength(0);expect(plan.appendNav).toHaveLength(0);
   const oldRetire=new Set(old.retire.flatMap(r=>r.triangles));expect(plan.retire.flatMap(r=>r.triangles).some(i=>oldRetire.has(i))).toBeFalse();
   const mesh=(r:typeof baseline)=>{const found:Mesh[]=[];r.root.traverse(o=>{if(o instanceof Mesh)found.push(o);});expect(found).toHaveLength(1);return found[0];},a=mesh(actual),b=mesh(baseline);
   for(const[k,v]of Object.entries(b.geometry.attributes)){expect(bytes(a.geometry.getAttribute(k).array)).toBe(bytes(v.array));}
   const ai=a.geometry.index!.array,bi=b.geometry.index!.array,selected=new Set(plan.retire.flatMap(r=>r.triangles));expect(ai.length).toBe(bi.length);
   for(let i=0;i<bi.length/3;i++){expect(ai[i*3]).toBe(bi[i*3]);expect(ai[i*3+1]).toBe(selected.has(i)?bi[i*3]:bi[i*3+1]);expect(ai[i*3+2]).toBe(selected.has(i)?bi[i*3]:bi[i*3+2]);}
   expect(actual.root.userData.sourceQuarterTrianglesV303-baseline.root.userData.sourceQuarterTrianglesV303).toBe(selected.size);
   for(const owner of plan.owners)expect(actual.root.userData.sourceQuarterOwnersV303).toContain(owner);
   expect(JSON.stringify(raw)).toBe(json);expect(actual.nav).toEqual(baseline.nav);
  }finally{release(actual);release(baseline);}
 }
},30000);
