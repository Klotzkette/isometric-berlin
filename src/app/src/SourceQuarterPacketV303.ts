import { surroundingPacketFingerprint } from "./surroundingPacketFingerprint";
import type { SurroundingBuilding, SurroundingCityChunk, SurroundingNavigation, SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type RecordPin = { mesh:number; kind:string; fingerprint:number };
export type SourceQuarterPlanV303 = {
  origin:number[]; records:RecordPin[]; preparedRecords:RecordPin[];
  navGuard:number; lineGuard:number|null; preparedNavGuard:number; preparedLineGuard:number|null;
  append?:SurroundingPackedMesh; appendFingerprint?:number;
  retire:{mesh:number; triangles:number[]}[];
  retireLines:number[]; appendLines?:SurroundingPackedLines;
  retireNav:SurroundingBuilding[]; appendNav:SurroundingBuilding[]; owners:string[];
};
export type SourceQuarterSourceV303 = {schemaVersion:number; keys:string[]; packets:Record<string,SourceQuarterPlanV303>};
export type SourceQuarterTicketV303 = (chunk:SurroundingCityChunk)=>Generator<void,SurroundingCityChunk>;
type Transfer = {
  original:SurroundingPackedMesh[]; append?:SurroundingPackedMesh; origin:number[];
  navText:string; lines?:SurroundingPackedLines; plan:SourceQuarterPlanV303;
};
const marker=Symbol("Complete source quarter transaction v303");
const admissions=new WeakMap<object,readonly Transfer[]>();
const known=new WeakMap<object,ReadonlySet<string>>();
const bytes=(s:string)=>s.length/4*3-(s.endsWith("==")?2:s.endsWith("=")?1:0);
const encoded=(s:unknown):s is string=>typeof s==="string"&&s.length<=16*1024*1024&&s.length%4===0&&!/[^A-Za-z0-9+/=]/.test(s)&&(s.indexOf("=")<0||(s.indexOf("=")>=s.length-2&&/^={1,2}$/.test(s.slice(s.indexOf("=")))));
const partValid=(p:SurroundingPackedMesh)=>!!p&&p.positionType==="u16cm"&&typeof p.kind==="string"&&(p.colorType===undefined||p.colorType==="u8"||p.colorType==="u16linear")&&encoded(p.positions)&&encoded(p.colors)&&encoded(p.indices)&&bytes(p.positions)%6===0&&bytes(p.colors)===bytes(p.positions)/(p.colorType==="u16linear"?1:2)&&bytes(p.indices)%12===0;
const samePart=(a:SurroundingPackedMesh,b:SurroundingPackedMesh)=>a.kind===b.kind&&a.positionType===b.positionType&&a.colorType===b.colorType&&a.positions===b.positions&&a.colors===b.colors&&a.indices===b.indices;
const lineSame=(a:SurroundingPackedLines|undefined,b:SurroundingPackedLines|undefined)=>a?!!b&&a.positions===b.positions&&a.colors===b.colors:!b;
function freezeSnapshot<T>(value:T):T{if(value&&typeof value==="object"){for(const child of Object.values(value))freezeSnapshot(child);Object.freeze(value);}return value;}
function transfers(chunk:SurroundingCityChunk):readonly Transfer[]{const d=Object.getOwnPropertyDescriptor(chunk,marker);return d&&"value"in d?admissions.get(d.value)??[]:[];}
const complete=(t:Transfer,c:SurroundingCityChunk)=>t.original.every((p,i)=>!!c.meshes[i]&&samePart(p,c.meshes[i]))&&(!t.append||c.meshes.includes(t.append))&&c.origin.length===3&&c.origin.every((n,i)=>n===t.origin[i])&&JSON.stringify(c.nav)===t.navText&&lineSame(t.lines,c.lines);
function* hash(texts:readonly string[]):Generator<void,number>{let h=2166136261;for(const s of texts)for(let start=0;start<s.length;start+=65536){for(let i=start;i<Math.min(start+65536,s.length);i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;yield;}return h;}
function sortedOrdinals(rows:unknown,limit:number):rows is number[]{return Array.isArray(rows)&&rows.length<=limit&&rows.every((n,i)=>Number.isSafeInteger(n)&&n>=0&&n<limit&&(i===0||n>rows[i-1]));}
function buildingValid(b:SurroundingBuilding):boolean{
  const ring=(r:number[][])=>Array.isArray(r)&&r.length>=3&&r.length<=100000&&r.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
  return !!b&&ring(b.ring)&&Array.isArray(b.holes)&&b.holes.length<=1000&&b.holes.every(ring)&&Number.isFinite(b.height)&&Number.isFinite(b.minHeight)&&b.height>=b.minHeight&&typeof b.sourceId==="string"&&(b.groundOffset===undefined||Number.isFinite(b.groundOffset))&&
    (b.roofTriangles===undefined||Array.isArray(b.roofTriangles)&&b.roofTriangles.length<=100000&&b.roofTriangles.every(t=>Array.isArray(t)&&t.length===3&&t.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))))&&
    (b.nativeRoofCaps===undefined||Array.isArray(b.nativeRoofCaps)&&b.nativeRoofCaps.length<=100000&&b.nativeRoofCaps.every(r=>Array.isArray(r)&&r.length===5&&r.every(Number.isFinite)&&r[2]>r[0]&&r[3]>r[1]));
}
function replaceNav(nav:SurroundingNavigation,p:SourceQuarterPlanV303):SurroundingNavigation|undefined{
  const remaining=nav.buildings.slice();
  for(const old of p.retireNav){const key=JSON.stringify(old),at=remaining.findIndex(b=>JSON.stringify(b)===key);if(at<0)return undefined;remaining.splice(at,1);}
  if(remaining.length+p.appendNav.length>20000)return undefined;
  return {...nav,buildings:[...remaining,...p.appendNav]};
}
export function sourceQuarterCandidateV303(source:SourceQuarterSourceV303,id:string,native=false):boolean{
  let keys=known.get(source);if(!keys){if(source.schemaVersion!==1||!Array.isArray(source.keys)||source.keys.length>512||source.keys.some(k=>typeof k!=="string")||new Set(source.keys).size!==source.keys.length)return false;keys=new Set(source.keys);known.set(source,keys);}return keys.has(`${native?"minecraft":"drawn"}:${id}`);
}
/** The complete raw and prepared predecessors are pinned before any exact old
 * triangle, roof ink or navigation record can yield. Defaults remain closed. */
export function* captureSourceQuarterPacketV303(raw:SurroundingCityChunk,id:string,native:boolean,enabled:boolean,source:SourceQuarterSourceV303,kind:string,requiredReplacement=false):Generator<void,SourceQuarterTicketV303|undefined>{
  if(!enabled||!sourceQuarterCandidateV303(source,id,native))return undefined;
  const key=`${native?"minecraft":"drawn"}:${id}`;
  if(!Object.hasOwn(source.packets,key))return undefined;
  if(!raw||raw.schemaVersion!==1||!Array.isArray(raw.origin)||raw.origin.length!==3||!Array.isArray(raw.meshes)||raw.meshes.length>16)return undefined;
  const input=source.packets[key];
  if(!input||typeof input!=="object")return undefined;
  // Snapshot the recipe and complete raw predecessor before the first yield.
  // Hashing never admits fields changed by the caller during a checkpoint.
  let p:SourceQuarterPlanV303;
  try{p=freezeSnapshot(JSON.parse(JSON.stringify(input))) as SourceQuarterPlanV303;}catch{return undefined;}
  const original=raw.meshes.map(part=>({...part})),origin=raw.origin.slice(),rawNav=JSON.stringify(raw.nav),rawLines=raw.lines?{...raw.lines}:undefined;
  if(!p||raw.schemaVersion!==1||!Array.isArray(p.origin)||p.origin.length!==3||raw.origin.some((n,i)=>!Number.isFinite(n)||n!==p.origin[i])||!Array.isArray(p.records)||p.records.length!==raw.meshes.length||!Array.isArray(p.preparedRecords)||p.preparedRecords.length>16||!Array.isArray(p.owners)||!p.owners.length||p.owners.length>512||p.owners.some(o=>typeof o!=="string"||!o)||!Array.isArray(p.retire)||!Array.isArray(p.retireLines)||!Array.isArray(p.retireNav)||!Array.isArray(p.appendNav)||p.retireNav.length>20000||p.appendNav.length>20000||![...p.retireNav,...p.appendNav].every(buildingValid)||(!p.append&&!requiredReplacement))return undefined;
  if(p.append&&(!partValid(p.append)||p.append.kind!==kind||!bytes(p.append.indices)||(yield*surroundingPacketFingerprint(p.append))!==p.appendFingerprint))return undefined;
  for(let i=0;i<original.length;i++){const pin=p.records[i];if(!partValid(original[i])||!pin||pin.mesh!==i||pin.kind!==original[i].kind||(yield*surroundingPacketFingerprint(original[i]))!==pin.fingerprint)return undefined;}
  if((yield*hash([rawNav]))!==p.navGuard||(p.lineGuard===null?!!rawLines:!rawLines||(yield*hash([rawLines.positions,rawLines.colors??""]))!==p.lineGuard))return undefined;
  if(p.append)for(let start=0;start<p.append.indices.length;start+=65536){const s=atob(p.append.indices.slice(start,start+65536));for(let at=0;at<s.length;at+=4)if(((s.charCodeAt(at)|s.charCodeAt(at+1)<<8|s.charCodeAt(at+2)<<16|s.charCodeAt(at+3)<<24)>>>0)>=bytes(p.append.positions)/6)return undefined;yield;}
  const rawRemains=()=>raw.origin.length===3&&raw.origin.every((n,i)=>n===origin[i])&&raw.meshes.length===original.length&&original.every((part,i)=>!!raw.meshes[i]&&samePart(part,raw.meshes[i]))&&JSON.stringify(raw.nav)===rawNav&&lineSame(raw.lines,rawLines);
  if(!rawRemains())return undefined;
  const plan=p;
  return function*(prepared:SurroundingCityChunk):Generator<void,SurroundingCityChunk>{
    if(!rawRemains()||prepared.origin.length!==3||prepared.origin.some((n,i)=>n!==origin[i])||!original.every((p,i)=>prepared.meshes[i]&&samePart(p,prepared.meshes[i]))||prepared.meshes.length!==plan.preparedRecords.length||prepared.meshes.some(p=>p.kind===kind))return prepared;
    const preparedOriginal=prepared.meshes.map(part=>({...part})),navText=JSON.stringify(prepared.nav),lines=prepared.lines?{...prepared.lines}:undefined;
    const preparedRemains=()=>rawRemains()&&prepared.origin.length===3&&prepared.origin.every((n,i)=>n===origin[i])&&prepared.meshes.length===preparedOriginal.length&&preparedOriginal.every((part,i)=>!!prepared.meshes[i]&&samePart(part,prepared.meshes[i]))&&JSON.stringify(prepared.nav)===navText&&lineSame(prepared.lines,lines);
    for(let i=0;i<preparedOriginal.length;i++){const pin=plan.preparedRecords[i],part=preparedOriginal[i];if(!partValid(part)||!pin||pin.mesh!==i||pin.kind!==part.kind||(yield*surroundingPacketFingerprint(part))!==pin.fingerprint)return prepared;}
    if((yield*hash([navText]))!==plan.preparedNavGuard||(plan.preparedLineGuard===null?!!lines:!lines||(yield*hash([lines.positions,lines.colors??""]))!==plan.preparedLineGuard)||!replaceNav(prepared.nav,plan))return prepared;
    let lastMesh=-1;for(const r of plan.retire){if(!r||!Number.isSafeInteger(r.mesh)||r.mesh<=lastMesh||!prepared.meshes[r.mesh]||!sortedOrdinals(r.triangles,bytes(prepared.meshes[r.mesh].indices)/12))return prepared;lastMesh=r.mesh;}
    if(!sortedOrdinals(plan.retireLines,prepared.lines?bytes(prepared.lines.positions)/12:0))return prepared;
    if(plan.appendLines&&(!prepared.lines||!encoded(plan.appendLines.positions)||bytes(plan.appendLines.positions)%12!==0||!!plan.appendLines.colors!==!!prepared.lines.colors||plan.appendLines.colors&&(!encoded(plan.appendLines.colors)||bytes(plan.appendLines.colors)!==bytes(plan.appendLines.positions)/2)))return prepared;
    const append=plan.append?Object.freeze({...plan.append}):undefined;
    const parts=append?[...prepared.meshes,append]:prepared.meshes;
    if(parts.length>16||parts.reduce((n,p)=>n+bytes(p.positions)/6,0)>400000||parts.reduce((n,p)=>n+bytes(p.indices)/4,0)>2400000)return prepared;
    if(!preparedRemains())return prepared;
    const token={},result={...prepared,meshes:parts,[marker]:token};
    admissions.set(token,[...transfers(prepared),{original:preparedOriginal,append,origin,navText,lines,plan}]);
    return result;
  };
}
export function* prepareSourceQuarterPacketV303(chunk:SurroundingCityChunk,ticket?:SourceQuarterTicketV303):Generator<void,SurroundingCityChunk>{return ticket?yield*ticket(chunk):chunk;}
export function* applySourceQuarterTrianglesV303(chunk:SurroundingCityChunk,mesh:number,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{let count=0;for(const t of transfers(chunk)){if(!complete(t,chunk))throw Error("Source quarter ownership changed during decode");for(const r of t.plan.retire)if(r.mesh===mesh)for(const tri of r.triangles){const at=offset+tri*3;if(at+2>=indices.length)throw Error("Source quarter triangle escaped packet");indices[at+1]=indices[at];indices[at+2]=indices[at];if(++count%1024===0)yield;}}return count;}
export function sourceQuarterExtraLineVerticesV303(chunk:SurroundingCityChunk):number{return transfers(chunk).reduce((n,t)=>n+(t.plan.appendLines?bytes(t.plan.appendLines.positions)/6:0),0);}
export function* applySourceQuarterLinesV303(chunk:SurroundingCityChunk,values:Uint16Array,stride:number,appendStart:number):Generator<void,number>{
  let count=0,to=appendStart;
  for(const t of transfers(chunk)){
    if(!complete(t,chunk))throw Error("Source quarter ink ownership changed during decode");
    for(const n of t.plan.retireLines){const at=n*2*stride;for(let axis=0;axis<3;axis++)values[at+stride+axis]=values[at+axis];if(++count%1024===0)yield;}
    const lines=t.plan.appendLines;if(!lines)continue;
    for(let start=0;start<lines.positions.length;start+=65536){const s=atob(lines.positions.slice(start,start+65536));for(let at=0;at<s.length;at+=6,to++)for(let axis=0;axis<3;axis++)values[to*stride+axis]=s.charCodeAt(at+axis*2)|s.charCodeAt(at+axis*2+1)<<8;yield;}
    if(lines.colors){let atVertex=to-bytes(lines.positions)/6;for(let start=0;start<lines.colors.length;start+=65536){const s=atob(lines.colors.slice(start,start+65536));for(let at=0;at<s.length;at+=3,atVertex++)for(let axis=0;axis<3;axis++)values[atVertex*stride+3+axis]=s.charCodeAt(at+axis)*257;yield;}}
  }return count;
}
export function sourceQuarterNavigationV303(chunk:SurroundingCityChunk,nav:SurroundingNavigation):SurroundingNavigation{
  for(const t of transfers(chunk)){if(!complete(t,chunk))throw Error("Source quarter navigation ownership changed during decode");const next=replaceNav(nav,t.plan);if(!next)throw Error("Source quarter old navigation complement changed");nav=next;}return nav;
}
export function sourceQuarterOwnersV303(chunk:SurroundingCityChunk):string[]{return transfers(chunk).flatMap(t=>complete(t,chunk)?t.plan.owners:[]);}
