/** Small additive bridge delta over the immutable original Core receipts. */
import type {Group}from"three";
import {createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309,type NorthCoreTerrainRebindV309}from"./NorthCoreTerrainV309";
type Part=NorthCoreTerrainRecipesV309["variants"][string]["parts"][number];
type Gate=boolean|(()=>boolean);
export type NorthCoreBridgeDeltaV309={schemaVersion:number;baseVariantControls:Record<string,number>;variants:Record<string,{parts:{name:string;parentName:string;batchId?:string|null;basePartControl:number;retire:number[];outsideAdditions:NonNullable<Part["outside"]>[]}[]}>};
const ORIGINAL=Object.freeze({"drawn-initial":691981172,"drawn-worker":2745148416,minecraft:398998653});
const accepted=(g:Gate)=>{try{return typeof g==="function"?g()===true:g===true;}catch{return false;}};
function* checked(value:unknown,control:number):Generator<void,boolean>{const text=JSON.stringify(value);let hash=2166136261;for(let at=0;at<text.length;at+=65536){for(let i=at;i<Math.min(text.length,at+65536);i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;yield;}return hash===control&&JSON.stringify(value)===text;}
function freeze(value:unknown):void{if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const q of Object.values(value))freeze(q);Object.freeze(value);}}
/** The caller supplies reviewed literal controls, never values read from the
 * delta itself. Base/outside objects are reused, not copied into a second file. */
export function createNorthCoreBridgeTerrainControllerV309(controls:{delta:number;variants:Readonly<Record<string,number>>}){
 const deltaControl=controls.delta;
 const controller=createNorthCoreTerrainControllerV309(controls.variants,true);
 type Receipt={source:NorthCoreTerrainRecipesV309;originals:NorthCoreTerrainRecipesV309["variants"];delta:NorthCoreBridgeDeltaV309};
 const cache=new WeakMap<NorthCoreTerrainRecipesV309,WeakMap<NorthCoreBridgeDeltaV309,Receipt>>();
 const intact=(base:NorthCoreTerrainRecipesV309,r:Receipt)=>base.schemaVersion===1&&!!base.variants&&Object.keys(base.variants).length===3&&Object.entries(r.originals).every(([k,v])=>base.variants[k]===v)&&r.delta.schemaVersion===1&&Object.isFrozen(r.delta);
 function* compose(base:NorthCoreTerrainRecipesV309,delta:NorthCoreBridgeDeltaV309):Generator<void,Receipt|null>{
  const old=cache.get(base)?.get(delta);if(old&&intact(base,old))return old;
  if(base?.schemaVersion!==1||!base.variants||delta?.schemaVersion!==1||!delta.variants||!delta.baseVariantControls||Object.keys(base.variants).length!==3||Object.keys(delta.baseVariantControls).length!==3)return null;
  for(const[k,v]of Object.entries(ORIGINAL))if(delta.baseVariantControls[k]!==v||!base.variants[k]||!(yield*checked(base.variants[k],v)))return null;
  if(!(yield*checked(delta,deltaControl)))return null;
  const variants={...base.variants};
  for(const[k,change]of Object.entries(delta.variants)){
   const original=base.variants[k];if(!original||!Array.isArray(change.parts))return null;const parts=original.parts.slice(),selected=new Set<number>();
   for(const row of change.parts){const matches=parts.map((p,i)=>({p,i})).filter(({p})=>p.name===row.name&&p.parentName===row.parentName&&(p.batchId??null)===(row.batchId??null));if(matches.length!==1)return null;const{p,i}=matches[0];
    if(selected.has(i)||!row.retire.length||!row.outsideAdditions.length||p.outsideAdditions?.length||!(yield*checked(p,row.basePartControl)))return null;selected.add(i);
    const existing=new Set(p.retire);if(row.retire.some((n,j)=>!Number.isSafeInteger(n)||n<0||existing.has(n)||j>0&&n<=row.retire[j-1]))return null;
    parts[i]={...p,retire:[...p.retire,...row.retire].sort((a,b)=>a-b),outsideAdditions:row.outsideAdditions};
   }
   variants[k]={...original,parts};
  }
  freeze(delta);for(const v of Object.values(base.variants))freeze(v);
  const receipt:Receipt={source:{schemaVersion:1,variants},originals:{...base.variants},delta};const byDelta=cache.get(base)??new WeakMap();byDelta.set(delta,receipt);cache.set(base,byDelta);return receipt;
 }
 return{
  composeSteps:compose,
  *prepareSteps(root:Group,native:boolean,gate:Gate,base:NorthCoreTerrainRecipesV309,delta:NorthCoreBridgeDeltaV309){if(!accepted(gate))return null;const receipt=yield*compose(base,delta);if(!receipt)return null;const transaction=yield*controller.prepareSteps(root,native,()=>accepted(gate)&&intact(base,receipt),receipt.source);if(!transaction)return null;return{commit:(liveGate:Gate,beforeSwap?:NorthCoreTerrainRebindV309)=>transaction.commit(()=>accepted(liveGate)&&intact(base,receipt),beforeSwap),rollback:transaction.rollback,complete:transaction.complete};},
  complete:controller.complete,revoke:controller.revoke,
 };
}

const production=createNorthCoreBridgeTerrainControllerV309({delta:1522445275,variants:{"drawn-initial":691981172,"drawn-worker":1893277644,minecraft:398998653}});
export const prepareNorthCoreBridgeTerrainV309Steps=production.prepareSteps;
export const hasCompleteNorthCoreBridgeTerrainV309=production.complete;
export const revokeNorthCoreBridgeTerrainV309=production.revoke;
