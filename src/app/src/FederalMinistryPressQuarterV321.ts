/** Main-thread-only exact obsolete X8 street-fitting family; Core is separate. */
import source from "./data/federalMinistryPressQuarterV321.json";
import type {ExactOwnersPlanV321} from "./ExactOwnersV321";
const CONTROLS={drawn:3476949557,native:437814675};
const BOX_CONTROLS={drawn:719402188,native:974468106};
const METADATA_CONTROL=619899977;
const hash=(value:unknown)=>{const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const prepared=new Map<"drawn"|"native",()=>boolean>();
const verified=new WeakMap<ExactOwnersPlanV321,{proof:()=>boolean;control:number}>();
export function federalMinistryPressQuarterPlanV321(native=false):{plan:ExactOwnersPlanV321;control:number}{
 const key=native?"native":"drawn",plan=source.plans[key] as unknown as ExactOwnersPlanV321,control=CONTROLS[key],proof=prepared.get(key);
 // The outer lossless .plans object may legitimately be collected between
 // prepare and the later world constructor. Issue each genuinely decoded
 // private plan again; retain no large plan/payload in the preparation cache.
 if(proof?.()&&hash(plan)===control)verified.set(plan,{proof,control});
 return {plan,control};
}
/** Run after required sites loaded the actual old module, never in a Worker.
 * Only the selected mode's immutable box payload is read/hashed. No legacy
 * positions or the opposite mode's weak payload are retained or decoded. */
export async function prepareFederalMinistryPressQuarterSourceV321(native=false):Promise<boolean>{
 try{
  const key=native?"native":"drawn",{plan,control}=federalMinistryPressQuarterPlanV321(native),prior=prepared.get(key);
  if(hash(plan)!==control||plan.sourceBasename!=="press-quarter-v272-source.json.gz"||plan.owners.length!==1||plan.owners[0].id!=="32698095")return false;
  if(prior?.())return true;
  const original=(await import("./data/pressQuarterV272.json")).default;
  const payloadKey=native?"nativeBoxes":"facadeBoxes";
  if(hash(original[payloadKey])!==BOX_CONTROLS[key]||hash({schema:original.schema,sourcePartIds:original.sourcePartIds,counts:original.counts})!==METADATA_CONTROL)return false;
  const descriptors=[payloadKey,"schema","sourcePartIds","counts"].map(key=>[key,Object.getOwnPropertyDescriptor(original,key)!]as const);
  const scalars:{object:object;key:string;value:unknown}[]=[],metadataObjects=[original.sourcePartIds,original.counts].map(object=>({object,keys:Object.getOwnPropertyNames(object).length}));
  for(const {object} of metadataObjects)for(const key of Object.getOwnPropertyNames(object)){
   const d=Object.getOwnPropertyDescriptor(object,key);if(!d||!("value"in d))return false;scalars.push({object,key,value:d.value});
  }
  const proof=()=>descriptors.every(([key,p])=>{const d=Object.getOwnPropertyDescriptor(original,key);return !!d&&d.enumerable===p.enumerable&&d.configurable===p.configurable&&
   ("value"in p?"value"in d&&d.value===p.value&&d.writable===p.writable:!("value"in d)&&d.get===p.get&&d.set===p.set);})&&metadataObjects.every(p=>Object.getOwnPropertyNames(p.object).length===p.keys)&&scalars.every(p=>{
    const d=Object.getOwnPropertyDescriptor(p.object,p.key);return !!d&&"value"in d&&d.value===p.value;
   });
  if(!proof())return false;prepared.set(key,proof);verified.set(plan,{proof,control});return true;
 }catch{return false;}
}
/** A clone/public tag cannot bypass ordinary Core body/RLE admission. Only a
 * separately prepared, private-identity V272 plan receives this exact proof. */
export function verifiedFederalMinistryPressQuarterSourceV321(plan:ExactOwnersPlanV321):(()=>boolean)|null{
 const entry=verified.get(plan);return entry&&entry.proof()&&hash(plan)===entry.control?entry.proof:null;
}
