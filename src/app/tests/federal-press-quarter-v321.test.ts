import{expect,test}from"bun:test";
import{readFileSync}from"node:fs";
import{gunzipSync}from"node:zlib";
import ts from"typescript";
import{createPressQuarterV272}from"../src/PressQuarterV272";
import{prepareFederalMinistryPressQuarterSourceV321,federalMinistryPressQuarterPlanV321,verifiedFederalMinistryPressQuarterSourceV321}from"../src/FederalMinistryPressQuarterV321";
import{createExactOwnersSourceV321,stageExactOwnersV321}from"../src/ExactOwnersV321";
import{interleaveStaticGeometry}from"../src/interleaveStaticGeometry";
import{parkStaticInstancesSteps}from"../src/losslessStaticStorage";
import{createMinecraftMaterialState,setMinecraftMaterialPresentation,disposeMinecraftMaterialState}from"../src/visual-modes/minecraft/materialMode";
import{setIsoNightPresentation}from"../src/IsometricCityWorld";
import{transformLosslessJsonData}from"../losslessJsonData";
import{decodeLosslessGzipJson}from"../src/losslessGzipBase85";
const p=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")).buildings;
const proof=JSON.parse(gunzipSync(readFileSync(new URL("../../../geo_data/regierungsviertel/federal-press-quarter-v321-evidence.json.gz",import.meta.url))).toString());
const drain=(g:any)=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function dispose(r:any){const q=new Set<any>();r.traverse((o:any)=>{if(o.geometry)q.add(o.geometry);if(o.isInstancedMesh)q.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)q.add(m);});for(const x of q)x.dispose();r.clear();}
for(const native of[false,true])for(const mobileLike of[false,true])test(`actual Press constructor exact owner retirement/outside/parking/night/rollback native=${native} touch=${mobileLike}`,async()=>{
 expect(await prepareFederalMinistryPressQuarterSourceV321(native)).toBeTrue();const{plan,control}=federalMinistryPressQuarterPlanV321(native),receipt=createExactOwnersSourceV321(plan,p,control)!;expect(receipt).not.toBeNull();
 const root=createPressQuarterV272(native,{mobileLike}),mesh=root.children.find((o:any)=>o.isInstancedMesh)as any,record=proof.records.find((r:any)=>r.native===native),selected=new Set<number>(record.selectedGlobalRows),old=mesh.instanceMatrix,color=mesh.instanceColor;
 const oldWords=new Uint32Array(old.array.buffer.slice(old.array.byteOffset,old.array.byteOffset+old.array.byteLength)),oldColors=new Uint32Array(color.array.buffer.slice(color.array.byteOffset,color.array.byteOffset+color.array.byteLength)),body=root.children.find((o:any)=>!o.isInstancedMesh)as any,bodyGeometry=body?.geometry;
 let tx:any,state:any;try{
  if(mobileLike)interleaveStaticGeometry(root);const t=stageExactOwnersV321(root,receipt,true)!;tx=t;expect(t).not.toBeNull();expect(t.activeOwners).toEqual(["32698095"]);expect(t.commit(true)).toBeTrue();expect(t.complete()).toBeTrue();
  const live=mesh.instanceMatrix.array,w=new Uint32Array(live.buffer,live.byteOffset,live.length);let changed=0,bad=0;
  for(let i=0;i<w.length;i++){const row=Math.floor(i/16),k=i%16,retire=selected.has(row)&&[0,1,2,4,5,6,8,9,10].includes(k);if(w[i]!==oldWords[i])changed++;if(w[i]!== (retire?0:oldWords[i]))bad++;}
  expect(bad).toBe(0);expect(changed).toBeGreaterThan(selected.size);expect(selected.size).toBe(native?1936:616);expect(mesh.instanceColor).toBe(color);expect(new Uint32Array(color.array.buffer,color.array.byteOffset,color.array.length)).toEqual(oldColors);expect(body?.geometry).toBe(bodyGeometry);
  drain(t.parkRetiredSourcesSteps());drain(parkStaticInstancesSteps(root));state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);expect(t.complete()).toBeTrue();setMinecraftMaterialPresentation(root,state,false);
  for(const night of[false,true,false]){setIsoNightPresentation(root,night,true,night?"night":"day");expect(t.complete()).toBeTrue();}
  t.rollback();expect(mesh.instanceMatrix).toBe(old);expect(new Uint32Array(old.array.buffer,old.array.byteOffset,old.array.length)).toEqual(oldWords);expect(mesh.instanceColor).toBe(color);expect(body?.geometry).toBe(bodyGeometry);
 }finally{tx?.rollback();if(state)disposeMinecraftMaterialState(state);dispose(root);}
});
test("private authored admission rejects clone, modified prism, corrupted selected tuple and duplicate actual host",async()=>{
 await prepareFederalMinistryPressQuarterSourceV321(false);const{plan,control}=federalMinistryPressQuarterPlanV321(false);expect(verifiedFederalMinistryPressQuarterSourceV321(structuredClone(plan))).toBeNull();expect(createExactOwnersSourceV321(structuredClone(plan),p,control)).toBeNull();
 const altered=p.map((r:any)=>r.id==="32698095"?{...r,h_dm:r.h_dm+1}:r);expect(createExactOwnersSourceV321(plan,altered,control)).toBeNull();
 const receipt=createExactOwnersSourceV321(plan,p,control)!;for(const duplicate of[false,true]){const r=createPressQuarterV272(),m=r.children.find((o:any)=>o.isInstancedMesh)as any;try{if(duplicate)r.add(m.clone());else m.instanceMatrix.array[proof.records[0].selectedGlobalRows[0]*16+12]+=.1;expect(stageExactOwnersV321(r,receipt,true)).toBeNull();}finally{dispose(r);}}
});
test("changed actual source field descriptors and metadata close the authored proof",async()=>{
 const old=(await import("../src/data/pressQuarterV272.json")).default;await prepareFederalMinistryPressQuarterSourceV321(false);const{plan}=federalMinistryPressQuarterPlanV321(false),callback=verifiedFederalMinistryPressQuarterSourceV321(plan)!;expect(callback()).toBeTrue();
 const descriptor=Object.getOwnPropertyDescriptor(old,"facadeBoxes")!,parts=old.counts.parts;
 try{old.counts.parts++;expect(callback()).toBeFalse();expect(await prepareFederalMinistryPressQuarterSourceV321(false)).toBeFalse();old.counts.parts=parts;
  Object.defineProperty(old,"facadeBoxes",{...descriptor,value:old.facadeBoxes.slice(0,-4)+"AAAA"});expect(callback()).toBeFalse();expect(verifiedFederalMinistryPressQuarterSourceV321(plan)).toBeNull();
 }finally{Object.defineProperty(old,"facadeBoxes",descriptor);old.counts.parts=parts;}
 expect(callback()).toBeTrue();
});
test("production lossless weak-parent recreation reissues only genuine private plans after early source preparation",async()=>{
 const text=readFileSync(new URL("../src/data/federalMinistryPressQuarterV321.json",import.meta.url),"utf8"),code=transformLosslessJsonData(text,"/project/src/app/src/data/federalMinistryPressQuarterV321.json")!.code;expect(code).toContain("WeakRef");
 const refs:any[]=[];class CollectedWeakRef{value:any;constructor(value:any){this.value=value;refs.push(this);}deref(){return this.value;}}
 let decodes=0;const js=code.replace(/^import[^\n]*\n/,"").replace(/^export \{.*\};$/m,"").replace("export default", "return");const transformed=new Function("__decodeLosslessGzip","WeakRef",js)((s:string)=>{decodes++;return decodeLosslessGzipJson(s);},CollectedWeakRef);
 const provider=readFileSync(new URL("../src/FederalMinistryPressQuarterV321.ts",import.meta.url),"utf8").replace(/^import[^\n]*\n/gm,"").replace(/^export /gm,"").replace('import("./data/pressQuarterV272.json")','__importOriginal()');
 const actual=new Function("source","__importOriginal",ts.transpileModule(provider,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+";return {prepare:prepareFederalMinistryPressQuarterSourceV321,get:federalMinistryPressQuarterPlanV321,verified:verifiedFederalMinistryPressQuarterSourceV321};")(transformed,()=>import("../src/data/pressQuarterV272.json"));
 expect(await actual.prepare(false)).toBeTrue();const a=actual.get(false).plan;for(const ref of refs)ref.value=undefined;const b=actual.get(false).plan;expect(b).not.toBe(a);const callback=actual.verified(b);expect(callback).not.toBeNull();const before=decodes;for(let i=0;i<100;i++)expect(callback()).toBeTrue();expect(decodes).toBe(before);expect(actual.verified(structuredClone(b))).toBeNull();b.owners[0].components[0].instances.count--;expect(actual.verified(b)).toBeNull();
});
