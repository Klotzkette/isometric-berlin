/** One delta on the already owned native Alt-Mitte transaction, never a second
 * index mutator. Original V324 controls, parts and outside objects stay intact. */
import {Group,type Object3D} from "three";
import source from "./data/wilhelmStreetFrontsV325Previous.json";
import {createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309} from "./NorthCoreTerrainV309";
import {hasCompleteWilhelmStreetFrontsV325} from "./WilhelmStreetFrontsV325";
import {hasWilhelmStreetFrontsV325Sources,type WilhelmStreetFrontsSourcesV325Receipt} from "./WilhelmStreetFrontsV325Sources";
export type WilhelmStreetFrontsPreviousV325Input={model:Group;sourceReceipt:WilhelmStreetFrontsSourcesV325Receipt};
const BASE=1369046150,CONTROL=3405649452,COMBINED=976873875;
const controller=createNorthCoreTerrainControllerV309({minecraft:COMBINED});
function hash(v:unknown):number{let h=2166136261;for(const c of JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
export function hasWilhelmStreetFrontsPreviousInputV325(input:WilhelmStreetFrontsPreviousV325Input,target:Object3D):boolean{
 return input.model instanceof Group&&input.model.parent===target&&hasWilhelmStreetFrontsV325Sources(input.sourceReceipt,true)&&hasCompleteWilhelmStreetFrontsV325(input.model,true);
}
/** Fresh private model/source admission plus fixed full source/variant controls.
 * No caller-supplied recipe, hash, public marker or changed owner is accepted. */
export function composeWilhelmStreetFrontsPreviousV325(base:NorthCoreTerrainRecipesV309,input:WilhelmStreetFrontsPreviousV325Input,target:Object3D):{data:NorthCoreTerrainRecipesV309;controller:ReturnType<typeof createNorthCoreTerrainControllerV309>;gate:()=>boolean}|null{
 try{
  if(!hasWilhelmStreetFrontsPreviousInputV325(input,target))return null;
  const delta=source.previous,original=base.variants.minecraft;
  if(hash(delta)!==CONTROL||delta.baseControl!==BASE||delta.combinedControl!==COMBINED||hash(original)!==BASE)return null;
  const seen=new Set<string>();
  const parts=original.parts.map(p=>{
   const key=p.parentName+"\0"+p.name,updates=delta.parts.filter(q=>q.name===p.name&&q.parentName===p.parentName);
   if(!updates.length)return p;if(updates.length!==1||seen.has(key))throw Error("Duplicate native fitting delta");seen.add(key);
   const q=updates[0];if(hash(p)!==q.basePartControl||q.retire.some(t=>p.retire.includes(t))||new Set(q.retire).size!==q.retire.length)throw Error("Changed native fitting predecessor");
   return {...p,retire:[...p.retire,...q.retire].sort((a,b)=>a-b),outsideAdditions:[...(p.outsideAdditions??[]),...q.outsideAdditions]};
  });
  if(seen.size!==delta.parts.length)return null;
  const variant={...original,parts};if(hash(variant)!==COMBINED)return null;
  const data:NorthCoreTerrainRecipesV309={schemaVersion:1,variants:{minecraft:variant}};
  return {data,controller,gate:()=>hasWilhelmStreetFrontsPreviousInputV325(input,target)};
 }catch{return null;}
}
