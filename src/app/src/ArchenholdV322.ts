/** Complete measured observatory and independently cardinal giant refractor. */
import {Group,Mesh,type Material}from"three";
import data from"./data/youthTheatresV322.json";
import{createPackedRootStepsV309,completePackedRootV307,type RequiredPackedV307}from"./requiredPackedRootV307";
const OWNER=Symbol("complete Archenhold V322"),MODEL_CONTROL=805605763;
const receipts=new WeakMap<Group,{native:boolean;proof:()=>boolean}>();
function ownJSON(value:unknown):string|null{
 if(value===null||typeof value==="boolean"||typeof value==="string")return JSON.stringify(value);
 if(typeof value==="number")return Number.isFinite(value)?JSON.stringify(value):null;
 if(!value||typeof value!=="object"||Object.getOwnPropertySymbols(value).length)return null;
 const array=Array.isArray(value),keys=Object.keys(value);
 if(array){if(Object.getPrototypeOf(value)!==Array.prototype||keys.length!==value.length||keys.some((k,i)=>k!==String(i)))return null;}
 else if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return null;
 const fields:string[]=[];for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!("value"in d))return null;const text=ownJSON(d.value);if(text===null)return null;fields.push(array?text:JSON.stringify(key)+":"+text);}
 return array?"["+fields.join(",")+"]":"{"+fields.join(",")+"}";
}
function* ownJSONSteps(value:unknown,budget={nodes:0}):Generator<void,string|null>{
 if(++budget.nodes%2048===0)yield;
 if(value===null||typeof value!=="object")return ownJSON(value);
 const array=Array.isArray(value),keys=Object.keys(value);
 if(Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).length!==keys.length+(array?1:0))return null;
 if(array?(Object.getPrototypeOf(value)!==Array.prototype||keys.length!==value.length||keys.some((k,i)=>k!==String(i))):(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))return null;
 const fields:string[]=[];for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!("value"in d))return null;const text=yield*ownJSONSteps(d.value,budget);if(text===null)return null;fields.push(array?text:JSON.stringify(key)+":"+text);}
 return array?"["+fields.join(",")+"]":"{"+fields.join(",")+"}";
}
function* control(value:unknown,expected:number,trustedData=false):Generator<void,boolean>{const s=trustedData?JSON.stringify(value):yield*ownJSONSteps(value);if(s===null)return false;let h=2166136261;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;if(i%32768===32767)yield;}return h===expected;}
/** Entire exact old authored owner, including every roof run, centre and ring. */
export function archenholdPreviousBuildingV322(value:unknown):boolean{const s=ownJSON(value);return s!==null&&data.oldArchenholdBuildings.some(expected=>s===ownJSON(expected));}
function completeSources(values:readonly unknown[]|undefined):values is readonly unknown[]{if(!Array.isArray(values))return false;return data.oldArchenholdBuildings.every(expected=>{const rows=values.filter(v=>v&&typeof v==="object"&&Object.getOwnPropertyDescriptor(v,"id")?.value===expected.id);return rows.length===1&&archenholdPreviousBuildingV322(rows[0]);});}
/** One exact source binding; hot checks read private descriptors, never serialize. */
export function bindArchenholdSourcesV322(values:readonly unknown[]|undefined):(()=>boolean)|null{
 if(!completeSources(values))return null;
 const rows=values.slice(),selected=rows.filter(archenholdPreviousBuildingV322),pins:{o:object;k:PropertyKey;d:PropertyDescriptor}[]=[];
 const walk=(o:object)=>{for(const k of Reflect.ownKeys(o)){const d=Object.getOwnPropertyDescriptor(o,k)!;if(!("value"in d))throw Error("Unexpected source accessor");pins.push({o,k,d});if(d.value&&typeof d.value==="object")walk(d.value);}};
 try{for(const row of selected)walk(row as object);}catch{return null;}
 return()=>values.length===rows.length&&rows.every((v,i)=>{const d=Object.getOwnPropertyDescriptor(values,String(i));return !!d&&"value"in d&&d.value===v;})&&pins.every(({o,k,d})=>{const q=Object.getOwnPropertyDescriptor(o,k);return !!q&&"value"in q&&Object.is(q.value,d.value)&&q.enumerable===d.enumerable&&q.configurable===d.configurable&&q.writable===d.writable;});
}
export function* createArchenholdV322Steps(native=false,options:{sourceBuildings?:readonly unknown[];mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group|null>{
 const proof=bindArchenholdSourcesV322(options.sourceBuildings);if(!proof||!(yield*control(data,MODEL_CONTROL,true)))return null;
 const models=data.models.filter(q=>q.native===native&&q.key.startsWith("archenhold-"))as RequiredPackedV307[];if(models.length!==2)return null;
 const root=yield*createPackedRootStepsV309(OWNER,"Archenhold complete source and giant refractor V322",native,models,{archenholdV322:true,opticalLengthM:21,objectiveDiameterM:.68,staticPoseEstimated:true},onCreate);
 if(!proof()){disposeArchenholdV322(root);return null;}receipts.set(root,{native,proof});return root;
}
export function createArchenholdV322(native=false,options:{sourceBuildings?:readonly unknown[];mobileLike?:boolean}={}):Group|null{const g=createArchenholdV322Steps(native,options);for(;;){const n=g.next();if(n.done)return n.value;}}
export function hasCompleteArchenholdV322(root:Group,native?:boolean):boolean{const p=receipts.get(root);return !!p&&(native===undefined||native===p.native)&&p.proof()&&completePackedRootV307(root,OWNER,native);}
export function disposeArchenholdV322(root:Group):void{const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m)resources.add(m as Material);}});for(const r of resources)r.dispose();root.clear();receipts.delete(root);}
export {ownJSON as youthTheatreOwnJSONV322,control as youthTheatreControlStepsV322};
