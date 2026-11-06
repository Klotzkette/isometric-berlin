/** Two exact untouched v198 hosts; every outside triangle/instance word survives. */
import type{Group}from"three";
import source from"./data/archenholdPreviousV322.json";
import{createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309,type NorthCoreTerrainTransactionV309,type NorthCoreTerrainRebindV309}from"./NorthCoreTerrainV309";
import{hasCompleteArchenholdV322,archenholdPreviousBuildingV322,youthTheatreOwnJSONV322,bindArchenholdSourcesV322}from"./ArchenholdV322";
const SOURCE_CONTROL=2832891587;
const CONTROLS={"drawn-worker":2922002608,minecraft:1535700886};
const controller=createNorthCoreTerrainControllerV309(CONTROLS);
const hash=(q:unknown)=>{const s=JSON.stringify(q);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
function sourcesMatch(values:readonly unknown[]):boolean{return source.sourceBuildings.every(expected=>{const found=values.filter(q=>q&&typeof q==="object"&&Object.getOwnPropertyDescriptor(q,"id")?.value===expected.id);return found.length===1&&archenholdPreviousBuildingV322(found[0])&&youthTheatreOwnJSONV322(found[0])===youthTheatreOwnJSONV322(expected);});}
/** Staging never changes the visible v198 group. Commit is synchronous and
 * revalidates full host/source words through the established controller. */
export function* prepareArchenholdPreviousV322Steps(oldRoot:Group,native:boolean,replacement:Group,sourceBuildings:readonly unknown[]):Generator<void,NorthCoreTerrainTransactionV309|null>{
 if(!Array.isArray(sourceBuildings)||hash(source)!==SOURCE_CONTROL||!sourcesMatch(sourceBuildings)||!hasCompleteArchenholdV322(replacement,native))return null;
 const proof=bindArchenholdSourcesV322(sourceBuildings);if(!proof)return null;const gate=()=>proof()&&hasCompleteArchenholdV322(replacement,native);
 const tx=yield*controller.prepareSteps(oldRoot,native,gate,source.recipes as unknown as NorthCoreTerrainRecipesV309);if(!tx)return null;
 return{commit(liveGate: boolean|(()=>boolean)=true,beforeSwap?:NorthCoreTerrainRebindV309){return tx.commit(()=>gate()&&(typeof liveGate==="function"?liveGate():liveGate),beforeSwap);},rollback(){tx.rollback();},complete(){if(!gate()||!tx.complete()){tx.rollback();return false;}return true;}};
}
export function restoreArchenholdPreviousV322(oldRoot:Group):void{controller.revoke(oldRoot);}
