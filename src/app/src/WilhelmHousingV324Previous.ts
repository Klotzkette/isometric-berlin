/** Finite reversible old-fitting complements; shared Core belongs to Government. */
import {Group,Mesh,InstancedMesh,InterleavedBufferAttribute,type Object3D}from'three';
import recipes from'./data/wilhelmHousingV324Previous.json';
import{createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309,type NorthCoreTerrainRebindV309}from'./NorthCoreTerrainV309';
import{hasWilhelmHousingV324Sources,type WilhelmHousingSourcesV324Receipt}from'./WilhelmHousingV324Sources';
import{hasCompleteWilhelmHousingV324}from'./WilhelmHousingV324';
import{parkStaticAttribute}from'./losslessStaticStorage';
import{composeWilhelmStreetFrontsPreviousV325,type WilhelmStreetFrontsPreviousV325Input}from'./WilhelmStreetFrontsV325Previous';
export type WilhelmHousingPreviousV324Hooks={beforeSwap?:NorthCoreTerrainRebindV309;afterSwap?:()=>void};
export type WilhelmHousingPreviousV324Transaction={prepared():boolean;commit(liveGate:()=>boolean):boolean;complete():boolean;rollback():void;parkRetiredSourcesSteps():Generator<void,number>};
const previous=createNorthCoreTerrainControllerV309({"drawn-initial":131461733,"minecraft":1369046150});
const legacy=createNorthCoreTerrainControllerV309({"drawn-initial":863678863});
function allowed(gate:()=>boolean):boolean{try{return gate()===true;}catch{return false;}}
function* prepare(target:Object3D,native:boolean,model:Group,source:WilhelmHousingSourcesV324Receipt,hooks:WilhelmHousingPreviousV324Hooks,which:'previous'|'legacy',additional?:WilhelmStreetFrontsPreviousV325Input):Generator<void,WilhelmHousingPreviousV324Transaction|null>{
 if(!(target instanceof Group))return null;
 const baseGate=()=>hasWilhelmHousingV324Sources(source,native)&&hasCompleteWilhelmHousingV324(model,native);
 if(!baseGate())return null;
 const original=recipes[which]as unknown as NorthCoreTerrainRecipesV309;
 const extension=additional&&native&&which==='previous'?composeWilhelmStreetFrontsPreviousV325(original,additional,target):undefined;
 if(additional&&!extension)return null;
 const gate=()=>baseGate()&&(extension?.gate()??true);
 const controller=extension?.controller??(which==='legacy'?legacy:previous),data=extension?.data??original;
 const originals=new Set<Parameters<typeof parkStaticAttribute>[0]>();
 target.traverse(o=>{if(!(o instanceof Mesh))return;const part=data.variants[native?'minecraft':'drawn-initial']?.parts.find(p=>p.name===o.name&&p.parentName===o.parent?.name);if(!part)return;if(part.retireKind==='instances'&&o instanceof InstancedMesh)originals.add(o.instanceMatrix);else for(const a of[...Object.values(o.geometry.attributes),o.geometry.index])if(a)originals.add(a instanceof InterleavedBufferAttribute?a.data:a);});
 const tx=yield*controller.prepareSteps(target,native,gate,data);if(!tx)return null;
 let live=true,published=false,parked=false;const liveGate=()=>live&&gate();
 return{prepared:()=>live&&!published&&liveGate(),commit(external){if(!live||!allowed(external)||!liveGate())return false;const ok=tx.commit(()=>liveGate()&&allowed(external),hooks.beforeSwap);if(!ok){live=false;tx.rollback();}else published=true;hooks.afterSwap?.();return ok;},complete:()=>live&&published&&liveGate()&&tx.complete(),rollback(){if(!live)return;live=false;tx.rollback();originals.clear();hooks.afterSwap?.();},*parkRetiredSourcesSteps(){if(!live||!published||parked||!tx.complete())return 0;parked=true;let bytes=0;for(const storage of originals){if(!live||!tx.complete())return bytes;bytes+=yield*parkStaticAttribute(storage,false);yield;}originals.clear();return bytes;}};
}
export function* prepareWilhelmHousingPreviousV324Steps(world:Object3D,native:boolean,model:Group,sourceReceipt:WilhelmHousingSourcesV324Receipt,hooks:WilhelmHousingPreviousV324Hooks={},additional?:WilhelmStreetFrontsPreviousV325Input):Generator<void,WilhelmHousingPreviousV324Transaction|null>{return yield*prepare(world,native,model,sourceReceipt,hooks,'previous',additional);}
export function* prepareWilhelmHousingLegacyV324Steps(authorSignaturesTarget:Object3D,model:Group,sourceReceipt:WilhelmHousingSourcesV324Receipt,hooks:WilhelmHousingPreviousV324Hooks={}):Generator<void,WilhelmHousingPreviousV324Transaction|null>{return yield*prepare(authorSignaturesTarget,false,model,sourceReceipt,hooks,'legacy');}
