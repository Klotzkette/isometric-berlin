/** Actual retained resident owners, both private source/model factories, and a
 * single reversible index transaction across the old and additional fronts. */
import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {Group,Mesh,type Object3D} from "three";
import oldSources from "../src/data/wilhelmHousingV324Sources.json";
import oldRecipes from "../src/data/wilhelmHousingV324Previous.json";
import delta from "../src/data/wilhelmStreetFrontsV325Previous.json";
import {createAltMitteCoreV169FromSource} from "../src/AltMitteCoreV169";
import {createMitteDdrV288} from "../src/MitteDdrV288";
import {createWilhelmHousingRuntimeV324Steps,getWilhelmHousingModelV324,prepareWilhelmHousingRuntimePreviousV324Steps,hasWilhelmHousingRuntimePreviousV324,resetWilhelmHousingRuntimePreviousV324,releaseWilhelmHousingRuntimeV324,attachWilhelmHousingCoreGateV324,hasWilhelmHousingRuntimeV324} from "../src/WilhelmHousingV324Runtime";
import {createWilhelmStreetFrontsRuntimeV325Steps,getWilhelmStreetFrontsPreviousInputV325,attachWilhelmStreetFrontsPreviousGateV325,releaseWilhelmStreetFrontsRuntimeV325,getWilhelmStreetFrontsModelV325,attachWilhelmStreetFrontsCoreGateV325,hasWilhelmStreetFrontsRuntimeV325} from "../src/WilhelmStreetFrontsV325Runtime";
import {composeWilhelmStreetFrontsPreviousV325} from "../src/WilhelmStreetFrontsV325Previous";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {retireSceneMaterialPrograms} from "../src/sceneMaterialPrograms";
const repo=new URL("../../../",import.meta.url),read=(p:string)=>JSON.parse(readFileSync(new URL(p,repo),"utf8"));
const prisms=read("src/app/public/mesh/regierungsviertel/lod2-prisms.json").buildings,voxels=read("src/app/public/mesh/regierungsviertel/minecraft-voxels.json");
const core={schemaVersion:1 as const,sourceParents:[],drawnChunks:[],minecraftChunks:oldSources.nativePackets.map(p=>({id:p.id,packet:read(p.file)}))};
function drain<T>(g:Generator<void,T>):T{for(;;){const n=g.next();if(n.done)return n.value;}}
function destroy(root:Object3D){const resources=new Set<any>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);if(o.isInstancedMesh)resources.add(o);});for(const r of resources)r.dispose();root.clear();}
function fixture(){const world=new Group();const old=drain(createWilhelmHousingRuntimeV324Steps(world,prisms,voxels,true,false,core));expect(old).not.toBeNull();const next=drain(createWilhelmStreetFrontsRuntimeV325Steps(world,prisms,voxels,true,false,core));expect(next).not.toBeNull();world.add(createMitteDdrV288({native:true,payload:voxels})!,createAltMitteCoreV169FromSource(core,true));return{world,old:old!,next:next!,input:getWilhelmStreetFrontsPreviousInputV325(world,true)!};}
function snapshot(world:Group){return oldRecipes.previous.variants.minecraft.parts.map(p=>{let mesh:Mesh|undefined;world.traverse(o=>{if(o instanceof Mesh&&o.name===p.name&&o.parent?.name===p.parentName){if(mesh)throw Error("Duplicate source");mesh=o;}});if(!mesh)throw Error("Missing actual source");return{mesh,geometry:mesh.geometry,index:mesh.geometry.index,indexWords:mesh.geometry.index?.array.slice()};});}
function restored(rows:ReturnType<typeof snapshot>){for(const r of rows){expect(r.mesh.geometry).toBe(r.geometry);expect(r.mesh.geometry.index).toBe(r.index);expect(r.mesh.geometry.index?.array).toEqual(r.indexWords);}}
function clean(f:ReturnType<typeof fixture>){resetWilhelmHousingRuntimePreviousV324(f.world,true);releaseWilhelmStreetFrontsRuntimeV325(f.world,true);releaseWilhelmHousingRuntimeV324(f.world,true);destroy(f.world);}

test("actual shared8 native hosts stage once, preserve original outsides, revoke additional fronts and restage unchanged V324",async()=>{
 const f=fixture();interleaveStaticGeometry(f.world);const original=snapshot(f.world);let before=0;try{
  const composed=composeWilhelmStreetFrontsPreviousV325(oldRecipes.previous as any,f.input,f.world)!;expect(composed).not.toBeNull();
  const prior=oldRecipes.previous.variants.minecraft.parts;
  for(const p of composed.data.variants.minecraft.parts){const b=prior.find(q=>q.name===p.name&&q.parentName===p.parentName)!;expect(p.outside).toBe(b.outside);expect(new Set(p.retire).size).toBe(p.retire.length);expect(p.retire.length).toBe(b.retire.length+(delta.previous.parts.find(q=>q.name===p.name&&q.parentName===p.parentName)?.retire.length??0));}
  expect(drain(prepareWilhelmHousingRuntimePreviousV324Steps(f.world,true,{beforeSwap:()=>{before++;return true;}},f.input))).toBeTrue();expect(before).toBe(9);
  expect(attachWilhelmStreetFrontsPreviousGateV325(f.world,true,()=>hasWilhelmHousingRuntimePreviousV324(f.world,true))).toBeTrue();
  expect(attachWilhelmStreetFrontsCoreGateV325(f.world,true,()=>true)).toBeTrue();expect(attachWilhelmHousingCoreGateV324(f.world,true,()=>true)).toBeTrue();expect(hasWilhelmStreetFrontsRuntimeV325(f.world,true)).toBeTrue();expect(hasWilhelmHousingRuntimeV324(f.world,true)).toBeTrue();
  retireSceneMaterialPrograms(f.world);await new Promise(r=>setTimeout(r,0));expect(hasWilhelmHousingRuntimePreviousV324(f.world,true)).toBeTrue();
  releaseWilhelmStreetFrontsRuntimeV325(f.world,true);restored(original);expect(getWilhelmHousingModelV324(f.world,true)).toBe(f.old);expect(hasWilhelmHousingRuntimeV324(f.world,true)).toBeFalse();
  expect(drain(prepareWilhelmHousingRuntimePreviousV324Steps(f.world,true))).toBeTrue();expect(attachWilhelmHousingCoreGateV324(f.world,true,()=>true)).toBeTrue();expect(hasWilhelmHousingRuntimeV324(f.world,true)).toBeTrue();expect(getWilhelmStreetFrontsModelV325(f.world,true)).toBeUndefined();
 }finally{clean(f);}
},30000);

test("failed, forged or cancelled optional admission preserves complete old source and old model for exact fallback",()=>{
 for(const kind of["forged","cancel","changed"]as const){const f=fixture(),original=snapshot(f.world);try{
  const input=kind==="forged"?{model:new Group(),sourceReceipt:f.input.sourceReceipt}:f.input;
  if(kind==="changed")f.next.position.x+=1;
  const g=prepareWilhelmHousingRuntimePreviousV324Steps(f.world,true,{},input);
  if(kind==="cancel"){expect(g.next().done).toBeFalse();g.return(false);}else expect(drain(g)).toBeFalse();
  restored(original);expect(getWilhelmHousingModelV324(f.world,true)).toBe(f.old);
  if(kind==="changed")f.next.position.x-=1;
  expect(drain(prepareWilhelmHousingRuntimePreviousV324Steps(f.world,true))).toBeTrue();expect(hasWilhelmHousingRuntimePreviousV324(f.world,true)).toBeTrue();
 }finally{clean(f);}}
},30000);
