/** Explicit actual-runtime Main source derivative over frozen v307 receipts.
 * All Worker, geometry, paint, outside and native/drawn floor streams survive. */
import type {Group} from "three";
import {createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309,type NorthCoreTerrainRebindV309} from "./NorthCoreTerrainV309";
import {createNorthCoreBridgeTerrainControllerV309,type NorthCoreBridgeDeltaV309} from "./NorthCoreBridgeTerrainV309";
type Gate=boolean|(()=>boolean);
type Variant=NorthCoreTerrainRecipesV309["variants"][string];
type Part=Variant["parts"][number];
export type NorthCoreActualDeltaV310={schemaVersion:number;baseVariantControls:Record<string,number>;variants:Record<string,{basePartControl:number;captureSha256:string;instances:NonNullable<Part["instances"]>;retire:number[]}>};
const OLD=Object.freeze({"drawn-initial":691981172,"drawn-worker":2745148416,minecraft:398998653});
const BRIDGE=Object.freeze({delta:1522445275,variants:{"drawn-initial":691981172,"drawn-worker":1893277644,minecraft:398998653}});
const admitted=(gate:Gate)=>{try{return typeof gate==="function"?gate()===true:gate===true;}catch{return false;}};
function* checked(value:unknown,expected:number):Generator<void,boolean>{const text=JSON.stringify(value);let h=2166136261;for(let at=0;at<text.length;at+=65536){for(let i=at;i<Math.min(at+65536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}return h===expected&&JSON.stringify(value)===text;}
function freeze(value:unknown):void{if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}}
/** Controls are reviewed literals supplied by the isolated factory caller,
 * never hashes read from an incoming source object. */
export function createNorthCoreActualTerrainControllerV310(controls:{delta:number;variants:Readonly<Record<string,number>>}){
 const bridge=createNorthCoreBridgeTerrainControllerV309(BRIDGE),controller=createNorthCoreTerrainControllerV309(controls.variants,true);
 type Receipt={source:NorthCoreTerrainRecipesV309;originals:Record<string,Variant>;bridge:NorthCoreBridgeDeltaV309;actual:NorthCoreActualDeltaV310};
 const cache=new WeakMap<NorthCoreTerrainRecipesV309,WeakMap<NorthCoreBridgeDeltaV309,WeakMap<NorthCoreActualDeltaV310,Receipt>>>();
 const intact=(base:NorthCoreTerrainRecipesV309,r:Receipt)=>base.schemaVersion===1&&!!base.variants&&Object.keys(base.variants).length===3&&Object.entries(r.originals).every(([key,value])=>base.variants[key]===value)&&r.bridge.schemaVersion===1&&Object.isFrozen(r.bridge)&&r.actual.schemaVersion===1&&Object.isFrozen(r.actual);
 function* compose(base:NorthCoreTerrainRecipesV309,bridgeDelta:NorthCoreBridgeDeltaV309,actual:NorthCoreActualDeltaV310):Generator<void,Receipt|null>{
  const prior=cache.get(base)?.get(bridgeDelta)?.get(actual);if(prior&&intact(base,prior))return prior;
  const joined=yield*bridge.composeSteps(base,bridgeDelta);if(!joined||actual?.schemaVersion!==1||!actual.baseVariantControls||Object.keys(actual.baseVariantControls).length!==3||Object.entries(OLD).some(([key,value])=>actual.baseVariantControls[key]!==value)||!(yield*checked(actual,controls.delta)))return null;
  if(Object.keys(actual.variants).length!==2||!actual.variants["drawn-initial"]||!actual.variants.minecraft)return null;
  const variants={...joined.source.variants};
  for(const[key,row]of Object.entries(actual.variants)){
   const old=base.variants[key];if(!old||old.parts.length!==1)return null;const part=old.parts[0];
   if(part.retireKind!=="instances"||!part.instances||!(yield*checked(part,row.basePartControl))||!row.captureSha256.match(/^[a-f0-9]{64}$/)||!Number.isSafeInteger(row.instances.count)||row.instances.count<=0||row.retire.length!==part.retire.length||row.retire.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>=row.instances.count||i>0&&n<=row.retire[i-1]))return null;
   // Offline evidence proves all retired source rows survive word-for-word.
   // Reuse the complete original inside/outside attributes and source paint;
   // only full-source guards and their exact source ordinals differ.
   variants[key]={captureSha256:row.captureSha256,parts:[{...part,instances:row.instances,retire:row.retire}]};
  }
  freeze(actual);freeze(variants);
  const receipt:Receipt={source:{schemaVersion:1,variants},originals:{...base.variants},bridge:bridgeDelta,actual};
  const byBridge=cache.get(base)??new WeakMap(),byActual=byBridge.get(bridgeDelta)??new WeakMap();byActual.set(actual,receipt);byBridge.set(bridgeDelta,byActual);cache.set(base,byBridge);return receipt;
 }
 return{
  composeSteps:compose,
  *prepareSteps(root:Group,native:boolean,gate:Gate,base:NorthCoreTerrainRecipesV309,bridgeDelta:NorthCoreBridgeDeltaV309,actual:NorthCoreActualDeltaV310){
   if(!admitted(gate))return null;const receipt=yield*compose(base,bridgeDelta,actual);if(!receipt)return null;
   const tx=yield*controller.prepareSteps(root,native,()=>admitted(gate)&&intact(base,receipt),receipt.source);if(!tx)return null;
   return{commit:(live:Gate,beforeSwap?:NorthCoreTerrainRebindV309)=>tx.commit(()=>admitted(live)&&intact(base,receipt),beforeSwap),rollback:tx.rollback,complete:tx.complete};
  },complete:controller.complete,revoke:controller.revoke,
 };
}

const production=createNorthCoreActualTerrainControllerV310({delta:4273494300,variants:{"drawn-initial":513866325,"drawn-worker":1893277644,minecraft:4230670502}});
export const prepareNorthCoreActualTerrainV310Steps=production.prepareSteps;
export const hasCompleteNorthCoreActualTerrainV310=production.complete;
export const revokeNorthCoreActualTerrainV310=production.revoke;
