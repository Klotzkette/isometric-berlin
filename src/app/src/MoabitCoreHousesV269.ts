// Core additions use the existing axis/window batches. Exact signatures refuse
// changed source parts instead of extending a district-wide rectangle.
import coreData from './data/moabitHousesCoreV269.json';
type CorePart = {id:string;y0_dm:number;h_dm:number;roof?:number;class:number;ring:readonly (readonly number[])[];holes?:readonly (readonly (readonly number[])[])[]};
type CoreWall = {index:number;x1:number;z1:number;dirX:number;dirZ:number;length:number;isCourtyard:boolean};
const corePlans=coreData.core as Record<string,{guard:number;wall:number;a:number[];b:number[]}>;
const nativePlans=coreData.native as unknown as Record<string,[number,number,string]>;
export function moabitCoreSourceGuardV269(b:CorePart):number {
  let hash=2166136261;
  const feed=(text:string)=>{for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;};
  feed([b.y0_dm,b.h_dm,b.roof??0,b.class].join(',')+';');
  for(const ring of [b.ring,...b.holes??[]]){feed('[');for(const p of ring)feed(p.join(',')+';');feed(']');}
  return hash;
}
/** Add a missing head stroke only on this exact ordinary public source wall.
 * Caller preserves its existing mapped-storey/plaza/hero rules and deduplicates
 * by OR-ing this predicate with the existing head condition. */
export function moabitCoreFacadeHeadV269(building:CorePart,wall:CoreWall):boolean {
  const p=corePlans[building.id];
  return !!p && !wall.isCourtyard && p.wall===wall.index &&
    Math.abs(wall.x1-p.a[0])<1e-7 && Math.abs(wall.z1-p.a[1])<1e-7 &&
    Math.abs(wall.x1+wall.dirX*wall.length-p.b[0])<1e-7 &&
    Math.abs(wall.z1+wall.dirZ*wall.length-p.b[1])<1e-7 &&
    moabitCoreSourceGuardV269(building)===p.guard;
}
/** Independent actual cardinal voxel face; caller adds a head only when its
 * existing pane survives all neighbour, source-storey and authored-site guards. */
export function moabitCoreNativeHeadV269(sourceId:string|undefined|(()=>string|undefined),xIdx:number,zIdx:number,dx:number,dz:number,y0dm:number,y1dm:number):boolean {
  const p=nativePlans[`${xIdx},${zIdx},${dx},${dz}`];
  return !!p && p[0]===y0dm && p[1]===y1dm && p[2]===(typeof sourceId==='function'?sourceId():sourceId);
}
