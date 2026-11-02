/** Small exact ownership receipts; no Three.js or construction geometry. */
import data from "./data/moabitMitteV300Owners.json";
type Part={id:string;[key:string]:unknown};
const source=data as unknown as {schemaVersion:number;oldPrisms:Part[];retainedPrisms:Part[];nativeClasses:string[];nativeGrid:Record<string,number>;nativeRows:{index:number;row:number[][]}[];nativeColumns:number[][]};
const oldIds=new Set(source.oldPrisms.map(p=>p.id));
const columns=new Set(source.nativeColumns.map(r=>r.join(",")));
function own(value:object,key:PropertyKey):unknown{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&"value"in d?d.value:undefined;}
function exact(value:unknown,expected:unknown):boolean{
 if(!expected||typeof expected!=="object")return value===expected;
 if(!value||typeof value!=="object"||Array.isArray(value)!==Array.isArray(expected))return false;
 const a=Reflect.ownKeys(value),b=Reflect.ownKeys(expected);if(a.length!==b.length||a.some(k=>!b.includes(k)))return false;
 return b.every(k=>k==="length"&&Array.isArray(expected)?Object.getOwnPropertyDescriptor(value,"length")?.value===expected.length:exact(own(value,k),own(expected,k)));
}
export function isMoabitMitteV300OldCore(part:unknown):boolean{
 try{if(!part||typeof part!=="object")return false;const id=own(part,"id");return typeof id==="string"&&oldIds.has(id)&&exact(part,source.oldPrisms.find(p=>p.id===id));}catch{return false;}
}
/** Exact retained measured owner, for per-batch fitting receipts only. */
export function isMoabitMitteV300RetainedCore(part:unknown):boolean{
 try{if(!part||typeof part!=="object")return false;const id=own(part,"id");if(typeof id!=="string")return false;const expected=source.retainedPrisms.find(p=>p.id===id);return !!expected&&exact(part,expected);}catch{return false;}
}
export function admitsMoabitMitteV300Core(payload:unknown):boolean{
 try{if(!payload||typeof payload!=="object")return false;const parts=own(payload,"buildings");if(!Array.isArray(parts)||parts.length>100000)return false;const required=[...source.oldPrisms,...source.retainedPrisms],requiredIds=new Set(required.map(p=>p.id));const seen=new Set<string>();for(let i=0;i<parts.length;i++){const p=own(parts,String(i));if(!p||typeof p!=="object")continue;const id=own(p,"id");if(typeof id!=="string"||!requiredIds.has(id))continue;if(seen.has(id)||!exact(p,required.find(e=>e.id===id)))return false;seen.add(id);}return seen.size===requiredIds.size&&seen.size>0;}catch{return false;}
}
export function admitsMoabitMitteV300Native(payload:unknown):boolean{
 try{if(!payload||typeof payload!=="object"||own(payload,"schema_version")!==2||own(payload,"cell_m")!==4||!exact(own(payload,"grid"),source.nativeGrid)||!exact(own(payload,"classes"),source.nativeClasses))return false;const rows=own(payload,"building_rows");return Array.isArray(rows)&&source.nativeRows.length>0&&source.nativeRows.every(r=>exact(own(rows,String(r.index)),r.row));}catch{return false;}
}
/** Caller has attached the complete admitted native source replacement first. */
export function isMoabitMitteV300OldNativeColumn(column:readonly number[]):boolean{return column.length===5&&columns.has(column.join(","));}
export const MOABIT_MITTE_V300_OLD_CORE_IDS:ReadonlySet<string>=oldIds;
