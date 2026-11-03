/** Actual parked tree rows must follow whichever deferred park owns the scene
 * when the complete northern ensemble is published. */
import {expect,test} from "bun:test";
import {Group,InstancedMesh} from "three";
import {createNorthernFidelityStepsV309,type NorthernFidelityBundleV309} from "../src/NorthernFidelityV309";
import {createNorthernLoaderV309} from "../src/northernLoaderV309";
import {createHospitalRecognitionV228} from "../src/HospitalRecognitionV228";
import {createHospitalEnvelopesV228} from "../src/HospitalEnvelopesV228";
import {createBundeswehrHospitalV214} from "../src/BundeswehrHospitalV214";
import {createRailStationsV190} from "../src/RailStationsV190";
import {createParkDetails,decodeTrees,type ParkDetailsPayload} from "../src/ParkDetails";
import {northParkTerrainOffsetV306} from "../src/northParkTerrainV306";
import {parkStaticInstancesSteps} from "../src/losslessStaticStorage";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import type {NorthCoreTerrainRecipesV309} from "../src/NorthCoreTerrainV309";
import propsSource from "../src/data/northTerrainPropsV309.json";
import {actualDrawnRuntimeV310} from "./helpers/northRuntimeActualV310";
import {assignStableInkRenderOrder} from "../src/stableInkRenderOrderV310";
import {Line} from "three";
import {dispose,stage,done,oldReferences,expectUnchanged} from "./helpers/northCoreActualV309";

function rows(root:Group){const result=new Map<InstancedMesh,Float32Array>();root.traverse(o=>{if(o instanceof InstancedMesh)result.set(o,new Float32Array(o.instanceMatrix.array));});return result;}
function changed(before:Map<InstancedMesh,Float32Array>){let words=0;for(const[m,array]of before)for(let i=0;i<array.length;i++)if(array[i]!==m.instanceMatrix.array[i])words++;return words;}

test("actual deferred park replacement is restaged and final-job publication has no park microtask gap",async()=>{
 const source=await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309;
 const payload=await Bun.file(new URL("../public/mesh/regierungsviertel/park-details.json",import.meta.url)).json()as ParkDetailsPayload;
 const tree=decodeTrees(payload.trees,payload.tree_vocabulary).find(t=>propsSource.treeIds.includes(t.id)&&Math.abs(northParkTerrainOffsetV306(t.position[0],t.position[2]))>.05);
 expect(tree?.id).toBe("tree-42687");if(!tree)throw Error("Actual measured source tree missing");
 const makeDetails=()=>{const details=createParkDetails({...payload,trees:[tree],tree_vocabulary:undefined,paths:[],playgrounds:[],street_lights:[],wall_traces:[],hedges:[],shrub_patches:[]},{detailProfile:"full",settledDetail:true,exactPrimitiveIndex:false});done(parkStaticInstancesSteps(details));interleaveStaticGeometry(details);return details;};
 const details=makeDetails(),lateDetails=makeDetails(),firstRows=rows(details),lateRows=rows(lateDetails),scene=new Group(),world=await actualDrawnRuntimeV310(source,true),oldPark=new Group();
 world.add(createHospitalRecognitionV228(),createHospitalEnvelopesV228(),createBundeswehrHospitalV214(),createRailStationsV190());scene.add(world,oldPark);const ranked:Line[]=[];world.traverse(o=>{if(o instanceof Line)ranked.push(o);});assignStableInkRenderOrder(ranked);const predecessor=oldReferences(world);
 let currentPark=oldPark,captured=false,swapped=false,clock=0,provisional:Group|undefined,published:NorthernFidelityBundleV309|undefined;
 let finishLate!:()=>void,failLate!:(error:unknown)=>void;const lateDone=new Promise<void>((resolve,reject)=>{finishLate=resolve;failLate=reject;});void lateDone.catch(()=>{});
 const loader=createNorthernLoaderV309({load:async()=>true,world:()=>world,active:()=>true,now:()=>clock+=10,
  build:function*(_module,_native,onCreate){
   const bundle=yield*createNorthernFidelityStepsV309(false,true,{world,originalGroundAt:()=>3,props:()=>{captured=true;return[world,currentPark];}},root=>{provisional=root;onCreate(root);});
   // This park continuation was already queued when the generator returns.
   // It must find the whole live bundle, never an unpublished prepared root.
   queueMicrotask(()=>{void(async()=>{
    try{
     const owner=loader.current(false);expect(owner===bundle).toBe(true);expect(owner?.complete()).toBe(true);
     const transaction=await stage(bundle.preparePropsSteps(lateDetails),()=>expect(bundle.complete()).toBe(true));
     expect(bundle.complete()).toBe(true);expect(changed(lateRows)).toBe(0);
     currentPark=lateDetails;scene.add(lateDetails);
     expect(bundle.complete()).toBe(false);expect(transaction.adoptParent(scene)).toBe(true);
     expect(transaction.commit(()=>loader.current(false)===bundle&&bundle.complete())).toBe(8);
     expect(transaction.complete()).toBe(true);expect(bundle.complete()).toBe(true);expect(changed(lateRows)).toBe(8);
     bundle.retireProps(details);details.removeFromParent();expect(bundle.complete()).toBe(true);
     finishLate();
    }catch(error){failLate(error);}
   })();});
   return bundle;
  },
  publish:bundle=>{expect(swapped).toBe(true);expect(changed(firstRows)).toBe(0);expect(bundle.prepared()).toBe(true);expect(bundle.syncPrevious(scene,true)).toBe(true);published=bundle;expect(changed(firstRows)).toBe(8);},
  rollback:bundle=>{bundle.syncPrevious(scene,false);},release:root=>dispose(root),
  yieldTask:async()=>{clock+=10;if(captured&&!swapped){expect(changed(firstRows)).toBe(0);oldPark.removeFromParent();currentPark=details;scene.add(details);swapped=true;}},
 });
 try{
  const bundle=await loader.ensure(false);await lateDone;expect(bundle).toBe(published);expect(bundle?.complete()).toBe(true);expect(loader.current(false)).toBe(bundle);
  const rogue=new Group();currentPark=rogue;expect(bundle?.prepared()).toBe(false);expect(bundle?.complete()).toBe(false);currentPark=lateDetails;expect(bundle?.complete()).toBe(true);
  currentPark=rogue;let synced:boolean|undefined;expect(()=>{synced=bundle?.syncPrevious(scene,true);}).not.toThrow();expect(synced).toBe(false);expectUnchanged(predecessor);expect(changed(lateRows)).toBe(0);expect(bundle?.complete()).toBe(false);
 }finally{
  loader.dispose();published?.syncPrevious(scene,false);provisional?.removeFromParent();if(provisional)dispose(provisional);dispose(details);dispose(lateDetails);dispose(world);scene.clear();
 }
},60000);
