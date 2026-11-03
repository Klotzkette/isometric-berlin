/** Two finite exact source layouts: retained JSC and measured browser V8.
 * No source geometry is rewritten and no engine/user-agent flag is consulted. */
import type {Group}from"three";
import{createNorthCoreActualTerrainControllerV310,type NorthCoreActualDeltaV310}from"./NorthCoreActualTerrainV310";
import{createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309,type NorthCoreTerrainRebindV309,type NorthCoreTerrainTransactionV309}from"./NorthCoreTerrainV309";
import type{NorthCoreBridgeDeltaV309}from"./NorthCoreBridgeTerrainV309";
type Gate=boolean|(()=>boolean);
type Variant=NorthCoreTerrainRecipesV309["variants"][string];
type Part=Variant["parts"][number];
export type CoreWorkerV8ProfileV311={schemaVersion:number;baseVariantControls:Record<string,number>;variant:string;part:{name:string;parentName:string;batchId:string;basePartControl:number;attributes:Part["attributes"];index:NonNullable<Part["index"]>;oldTriangleInterval:number[];actualTriangleInterval:number[];retireShift:{fromOrdinal:number;delta:number;count:number}}};
const JSC=Object.freeze({delta:4273494300,variants:{"drawn-initial":513866325,"drawn-worker":1893277644,minecraft:4230670502}});
const accepted=(g:Gate)=>{try{return typeof g==="function"?g()===true:g===true;}catch{return false;}};
function* checked(value:unknown,expected:number):Generator<void,boolean>{const text=JSON.stringify(value);let h=2166136261;for(let start=0;start<text.length;start+=65536){for(let i=start;i<Math.min(start+65536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}return h===expected&&JSON.stringify(value)===text;}
function freeze(value:unknown):void{if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const q of Object.values(value))freeze(q);Object.freeze(value);}}
export function createNorthCoreEnginesControllerV311(controls:{profile:number;variants:Readonly<Record<string,number>>}){
 const jsc=createNorthCoreActualTerrainControllerV310(JSC),v8=createNorthCoreTerrainControllerV309(controls.variants,true),epochs=new WeakMap<Group,number>();
 type Receipt={source:NorthCoreTerrainRecipesV309;originals:Record<string,Variant>;bridge:NorthCoreBridgeDeltaV309;actual:NorthCoreActualDeltaV310;profile:CoreWorkerV8ProfileV311};
 const cache=new WeakMap<NorthCoreTerrainRecipesV309,WeakMap<CoreWorkerV8ProfileV311,Receipt>>();
 const intact=(base:NorthCoreTerrainRecipesV309,r:Receipt)=>base?.schemaVersion===1&&!!base.variants&&Object.keys(base.variants).length===3&&Object.entries(r.originals).every(([k,v])=>base.variants[k]===v)&&Object.isFrozen(r.bridge)&&Object.isFrozen(r.actual)&&Object.isFrozen(r.profile);
 function* compose(base:NorthCoreTerrainRecipesV309,bridge:NorthCoreBridgeDeltaV309,actual:NorthCoreActualDeltaV310,profile:CoreWorkerV8ProfileV311):Generator<void,Receipt|null>{
  const prior=cache.get(base)?.get(profile);if(prior&&prior.bridge===bridge&&prior.actual===actual&&intact(base,prior))return prior;
  const initial=yield*jsc.composeSteps(base,bridge,actual);if(!initial||profile?.schemaVersion!==1||profile.variant!=="drawn-worker"||!profile.baseVariantControls||typeof profile.baseVariantControls!=="object"||Object.keys(profile.baseVariantControls).length!==3||Object.entries(JSC.variants).some(([k,v])=>profile.baseVariantControls[k]!==v)||!(yield*checked(profile,controls.profile)))return null;
  const variant=initial.source.variants[profile.variant],row=profile.part,parts=variant.parts.slice(),found=parts.map((p,i)=>({p,i})).filter(({p})=>p.name===row.name&&p.parentName===row.parentName&&p.batchId===row.batchId);if(found.length!==1)return null;
  const{p,i}=found[0];if(p.retireKind!=="triangles"||p.instances||!p.index||!(yield*checked(p,row.basePartControl)))return null;
  const[a,b]=row.oldTriangleInterval,[c,d]=row.actualTriangleInterval,shift=row.retireShift;
  if(row.oldTriangleInterval.length!==2||row.actualTriangleInterval.length!==2||![a,b,c,d,shift.fromOrdinal,shift.delta,shift.count].every(Number.isSafeInteger)||a<0||b<=a||c!==a||d<=c||shift.fromOrdinal!==b||shift.delta!==d-b||row.index.count!==p.index.count+shift.delta*3||p.retire.some(n=>n>=a&&n<b))return null;
  let changed=0;const retire=p.retire.map(n=>{if(n<shift.fromOrdinal)return n;changed++;return n+shift.delta;});
  if(changed!==shift.count||retire.some((n,j)=>n<0||n>=row.index.count/3||j>0&&n<=retire[j-1])||Object.keys(row.attributes).length!==Object.keys(p.attributes).length)return null;
  parts[i]={...p,attributes:row.attributes,index:row.index,retire};
  const variants={...initial.source.variants,[profile.variant]:{...variant,parts}};freeze(profile);freeze(variants);
  const receipt:Receipt={source:{schemaVersion:1,variants},originals:{...base.variants},bridge,actual,profile};const map=cache.get(base)??new WeakMap();map.set(profile,receipt);cache.set(base,map);return receipt;
 }
 const complete=(root:Group,native?:boolean)=>jsc.complete(root,native)||v8.complete(root,native);
 const revoke=(root:Group)=>{epochs.set(root,(epochs.get(root)??0)+1);jsc.revoke(root);v8.revoke(root);};
 function* prepareSteps(root:Group,native:boolean,gate:Gate,base:NorthCoreTerrainRecipesV309,bridge:NorthCoreBridgeDeltaV309,actual:NorthCoreActualDeltaV310,profile:CoreWorkerV8ProfileV311):Generator<void,NorthCoreTerrainTransactionV309|null>{
  if(!accepted(gate)||complete(root))return null;revoke(root);const epoch=epochs.get(root)!;
  let tx=yield*jsc.prepareSteps(root,native,gate,base,bridge,actual);
  if(epochs.get(root)!==epoch){tx?.rollback();return null;}
  if(!tx&&!native&&accepted(gate)){
   const receipt=yield*compose(base,bridge,actual,profile);if(!receipt||epochs.get(root)!==epoch||!accepted(gate))return null;
   const staged=yield*v8.prepareSteps(root,false,()=>accepted(gate)&&intact(base,receipt),receipt.source);
   if(staged)tx={commit:(live,before)=>staged.commit(()=>accepted(live)&&intact(base,receipt),before),rollback:staged.rollback,complete:staged.complete};
  }
  if(!tx)return null;if(epochs.get(root)!==epoch){tx.rollback();return null;}
  const owner=tx;
  return{commit:(live:Gate,before?:NorthCoreTerrainRebindV309)=>epochs.get(root)===epoch&&owner.commit(()=>accepted(live)&&epochs.get(root)===epoch,before),rollback(){owner.rollback();if(epochs.get(root)===epoch)revoke(root);},complete:()=>epochs.get(root)===epoch&&owner.complete()};
 }
 return{prepareSteps,composeSteps:compose,complete,revoke};
}

const production=createNorthCoreEnginesControllerV311({profile:2735151910,variants:{"drawn-initial":513866325,"drawn-worker":2911124795,minecraft:4230670502}});
export const prepareNorthCoreEnginesV311Steps=production.prepareSteps;
export const hasCompleteNorthCoreEnginesV311=production.complete;
export const revokeNorthCoreEnginesV311=production.revoke;
