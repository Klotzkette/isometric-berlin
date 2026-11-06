/** Private, exact original authored-member sources. No city body/RLE bypass. */
import data from "./data/memorialPreviousV322.json";
import type {ExactOwnersPlanV321} from "./ExactOwnersV321";

export type MemorialSiteKeyV322="berlin"|"schoenholz"|"treptow"|"pyramide"|"cadillacs"|"french"|"british";
type Row=Record<string,unknown>;
type PropertyPin={object:object;key:string;value:unknown;enumerable:boolean;configurable:boolean;writable:boolean;shape?:boolean};
type Source={native:boolean;key:MemorialSiteKeyV322;rows:readonly Row[];proof:()=>boolean};
type PlanRow={groupName:string;sourceRecord:Row;input:{module?:string;cellsControl?:number;cellIndex?:number;cellId?:string;rowIndices?:number[];cenotaphsControl?:number;ownerCount?:number;retiredCount?:number};plan:ExactOwnersPlanV321;control:number};
const profile=data as unknown as {schemaVersion:number;families:Record<Exclude<MemorialSiteKeyV322,"cadillacs"|"french"|"british">,Partial<Record<"drawn"|"native",PlanRow>>>;additions:Record<"cadillacs"|"french"|"british",Row>};
const CONTROLS={profile:3445727099,berlin:4069159606,pyramide:3749085787,schoenholz:{drawn:2697958808,native:662384451},treptow:{drawn:3181214313,native:1123886048}};
const hash=(v:unknown)=>{const s=JSON.stringify(v);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
function pins(value:unknown,result:PropertyPin[]=[]):PropertyPin[]{
 if(value&&typeof value==="object"){result.push({object:value,key:"",value:Reflect.ownKeys(value),enumerable:false,configurable:false,writable:false,shape:true});for(const key of Object.getOwnPropertyNames(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!("value"in d))throw Error("Unexpected authored source accessor");result.push({object:value,key,value:d.value,enumerable:!!d.enumerable,configurable:!!d.configurable,writable:!!d.writable});if(key!=="length")pins(d.value,result);}}return result;
}
const intact=(p:PropertyPin[],allowFreeze=false)=>p.every(({object,key,value,enumerable,configurable,writable,shape})=>{if(shape){const keys=Reflect.ownKeys(object),expected=value as PropertyKey[];return keys.length===expected.length&&keys.every((k,i)=>k===expected[i]);}const d=Object.getOwnPropertyDescriptor(object,key);return !!d&&"value"in d&&Object.is(d.value,value)&&d.enumerable===enumerable&&(d.configurable===configurable&&d.writable===writable||allowFreeze&&d.configurable===false&&d.writable===false);});
let profilePins:PropertyPin[]|undefined;
function profileReady():boolean{
 if(profilePins)return intact(profilePins,true);
 if(profile.schemaVersion!==1||hash(profile)!==CONTROLS.profile)return false;
 profilePins=pins(profile);return true;
}
const safeSources=new WeakSet<Source>();
const sources=new Map<string,Source>(),verified=new WeakMap<ExactOwnersPlanV321,()=>boolean>();
const issuedRows=new WeakMap<readonly unknown[],{native:boolean;keys:readonly MemorialSiteKeyV322[];rows:readonly unknown[];proof:()=>boolean}>();
const keyFor=(key:MemorialSiteKeyV322,native:boolean)=>key+":"+Number(native);
function selection(keys:readonly string[]):keys is readonly MemorialSiteKeyV322[]{return Array.isArray(keys)&&Object.getPrototypeOf(keys)===Array.prototype&&keys.length>0&&Reflect.ownKeys(keys).length===keys.length+1&&new Set(keys).size===keys.length&&keys.every((k,i)=>{const d=Object.getOwnPropertyDescriptor(keys,String(i));return !!d&&"value"in d&&(k==="berlin"||k==="schoenholz"||k==="treptow"||k==="pyramide"||k==="cadillacs"||k==="french"||k==="british");});}
function same(a:unknown,b:unknown):boolean{
 if(a===null||b===null||typeof a!=="object"||typeof b!=="object")return Object.is(a,b);
 if(Array.isArray(a)!==Array.isArray(b)||Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return false;
 const aa=Reflect.ownKeys(a),bb=Reflect.ownKeys(b);return aa.length===bb.length&&bb.every(key=>{const x=Object.getOwnPropertyDescriptor(a,key),y=Object.getOwnPropertyDescriptor(b,key);return !!x&&!!y&&"value"in x&&"value"in y&&same(x.value,y.value);});
}
function descriptorProof(object:object,key:string):()=>boolean{
 const p=Object.getOwnPropertyDescriptor(object,key);if(!p)throw Error("Missing exact source field");
 return()=>{const q=Object.getOwnPropertyDescriptor(object,key);return !!q&&q.enumerable===p.enumerable&&q.configurable===p.configurable&&
  ("value"in p?"value"in q&&q.writable===p.writable&&q.value===p.value:!("value"in q)&&q.get===p.get&&q.set===p.set);};
}
/** No closure retains the old terrain/list payload through a value descriptor. */
function weakDescriptorProof(object:object,key:string):()=>boolean{
 const p=Object.getOwnPropertyDescriptor(object,key);if(!p||!("value"in p))throw Error("Missing ordinary exact source field");
 const weakObject=new WeakRef(object),isObject=!!p.value&&typeof p.value==="object",weakValue=isObject?new WeakRef(p.value):null;
 const scalar=isObject?undefined:p.value,flags=[p.enumerable,p.configurable,p.writable];
 return()=>{const o=weakObject.deref();if(!o)return true;const d=Object.getOwnPropertyDescriptor(o,key);return !!d&&"value"in d&&d.enumerable===flags[0]&&d.configurable===flags[1]&&d.writable===flags[2]&&Object.is(d.value,weakValue?weakValue.deref():scalar);};
}
function berlinSource(native:boolean,street:unknown,ground:unknown,key:"berlin"|"pyramide"="berlin"):Source|null{
 const expected=profile.families[key].drawn!.sourceRecord as {id:string;poi:Row;ground:{cell_m:number;grid:Row;height:Row;sampleIndex:number;valueDm:number}};
 // Native-first has no old named Berlin body. Its compiled authoring source
 // retains the exact original POI and terrain sample, proven by the dual-engine
 // source capture/finalizer; this never authorizes an authored retirement plan.
 if(native&&!street&&!ground){const row=expected as unknown as Row,rowPins=pins(row);const proof=()=>profileReady()&&intact(rowPins,true);return proof()?{key,native,rows:[row],proof}:null;}
 if(!street||!ground||typeof street!=="object"||typeof ground!=="object")return null;
 const ownData=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return !!d&&"value"in d;};
 const s=street as {monuments?:Row[]},g=ground as {cell_m:number;grid:Row;ground_height:{cols:number;rows:number;stride_cells:number;y_dm:number[]}};
 if(!ownData(s,"monuments")||!["cell_m","grid","ground_height"].every(k=>ownData(g,k))||!Array.isArray(s.monuments)||!g.grid||!g.ground_height||!["cols","rows","stride_cells","y_dm"].every(k=>ownData(g.ground_height,k))||!Array.isArray(g.ground_height.y_dm)||!ownData(g.ground_height.y_dm,String(expected.ground.sampleIndex)))return null;
 const containerProofs=[weakDescriptorProof(s,"monuments"),...["cell_m","grid","ground_height"].map(k=>weakDescriptorProof(g,k)),...["cols","rows","stride_cells","y_dm"].map(k=>weakDescriptorProof(g.ground_height,k)),weakDescriptorProof(g.ground_height.y_dm,String(expected.ground.sampleIndex))];
 const matches=s.monuments.filter(p=>p.osm_key===expected.id);if(matches.length!==1||!same(matches[0],expected.poi))return null;
 const h=g.ground_height,meta={cell_m:g.cell_m,grid:g.grid,height:{cols:h.cols,rows:h.rows,stride_cells:h.stride_cells},sampleIndex:expected.ground.sampleIndex,valueDm:h.y_dm[expected.ground.sampleIndex]};
 if(!same(meta,expected.ground))return null;
 const poi=matches[0],weakStreet=new WeakRef(s),weakMonuments=new WeakRef(s.monuments),weakGround=new WeakRef(g),weakHeight=new WeakRef(h),weakHeights=new WeakRef(h.y_dm);
 const poiPins=pins(poi),index=s.monuments.indexOf(poi),listLength=s.monuments.length,oldGrid=g.grid,metaPins=pins(meta);
 const row={id:expected.id,poi,ground:meta},rowPins=pins(row);
 const proof=()=>{const source=weakStreet.deref(),list=weakMonuments.deref(),terrain=weakGround.deref(),height=weakHeight.deref(),values=weakHeights.deref();
  return containerProofs.every(p=>p())&&(!source||source.monuments===list)&&(!list||list.length===listLength&&list[index]===poi)&&
   (!terrain||terrain.cell_m===expected.ground.cell_m&&terrain.grid===oldGrid&&terrain.ground_height===height)&&
   (!height||height.y_dm===values&&height.cols===expected.ground.height.cols&&height.rows===expected.ground.height.rows&&height.stride_cells===expected.ground.height.stride_cells)&&
   (!values||values[expected.ground.sampleIndex]===expected.ground.valueDm)&&
   intact(poiPins)&&intact(metaPins)&&intact(rowPins)&&profileReady();};
 return proof()?{key,native,rows:[row],proof}:null;
}
async function northSource(native:boolean):Promise<Source|null>{
 const mode=native?"native":"drawn",expected=profile.families.schoenholz[mode]!,input=expected.input;
 const original=native?(await import("./data/northParksV198Native0.json")).default:(await import("./data/northParksV198Drawn0.json")).default;
 const descriptors=descriptorProof(original,"cells"),cells=original.cells;
 if(hash(cells)!==input.cellsControl)return null;
 const cell=cells[input.cellIndex!];if(!cell||cell.id!==input.cellId||!input.rowIndices)return null;
 const selected=input.rowIndices.map(i=>cell.boxes[i]);
 if(!same(selected,expected.sourceRecord.sourceRows))return null;
 const weakCells=new WeakRef(cells),weakCell=new WeakRef(cell),weakBoxes=new WeakRef(cell.boxes),rowPins=selected.map(p=>pins(p));
 const row={...expected.sourceRecord,sourceRows:selected},ownedPins=pins(row);
 // Only three small original rows survive consumption. Weak parent arrays
 // remain collectible and are never read again merely for a frame gate.
 const proof=()=>{const liveCells=weakCells.deref(),liveCell=weakCell.deref(),liveBoxes=weakBoxes.deref();
  return descriptors()&&profileReady()&&rowPins.every(p=>intact(p))&&intact(ownedPins)&&
   (!liveCells||liveCells[input.cellIndex!]===liveCell)&&(!liveCell||liveCell.id===input.cellId&&liveCell.boxes===liveBoxes)&&
   (!liveBoxes||input.rowIndices!.every((id,i)=>liveBoxes[id]===selected[i]));};
 return proof()?{key:"schoenholz",native,rows:[row],proof}:null;
}

function compiledCadillacs(native:boolean,key:"cadillacs"|"french"|"british"="cadillacs"):Source|null{const row=profile.additions[key],rowPins=pins(row);const proof=()=>profileReady()&&intact(rowPins,true);return proof()?{key,native,rows:[row],proof}:null;}
async function treptowSource(native:boolean):Promise<Source|null>{
 const expected=profile.families.treptow[native?"native":"drawn"]!,original=(await import("./data/eastParksV198.json")).default;
 if(original.memorialId!==expected.sourceRecord.id||hash(original.cenotaphs)!==expected.input.cenotaphsControl||!same(original.cenotaphs,expected.sourceRecord.cenotaphs)||original.cenotaphs.length!==16)return null;
 const checks=[descriptorProof(original,"memorialId"),descriptorProof(original,"cenotaphs")],actual=original.cenotaphs,actualPins=pins(actual),row={id:original.memorialId,cenotaphs:actual},ownedPins=pins(row);
 const proof=()=>profileReady()&&checks.every(p=>p())&&intact(actualPins)&&intact(ownedPins);return proof()?{key:"treptow",native,rows:[row],proof}:null;
}

/** Supply existing actual Viewer inputs, never fetch duplicate public assets.
 * keys may defer a park until its original required family is being built. */
export async function prepareMemorialPreviousV322(native=false,options:{keys?:readonly MemorialSiteKeyV322[];street?:unknown;ground?:unknown}={}):Promise<boolean>{
 try{
  const keys=options.keys??["berlin","pyramide","cadillacs","french","british","schoenholz","treptow"];if(!selection(keys)||!profileReady())return false;
  const next:Source[]=[];
  for(const key of keys){const prior=sources.get(keyFor(key,native));if(prior?.proof()&&(key!=="berlin"&&key!=="pyramide"||!options.street&&!options.ground)){next.push(prior);continue;}
   const source=key==="berlin"||key==="pyramide"?berlinSource(native,options.street,options.ground,key):key==="cadillacs"||key==="french"||key==="british"?compiledCadillacs(native,key):key==="schoenholz"?await northSource(native):await treptowSource(native);if(!source)return false;next.push(source);}
  for(const source of next){if(!safeSources.has(source)){const check=source.proof;source.proof=()=>{try{return check()===true;}catch{return false;}};safeSources.add(source);}sources.set(keyFor(source.key,native),source);}return true;
 }catch{return false;}
}

export function memorialPreviousPlansV322(native=false,keys:readonly MemorialSiteKeyV322[]=["berlin","pyramide","cadillacs","french","british","schoenholz","treptow"]):readonly {key:MemorialSiteKeyV322;groupName:string;plan:ExactOwnersPlanV321;control:number;sourceRows:readonly Row[]}[]{
 if(!selection(keys)||!profileReady())return [];
 const result=[];
 for(const key of keys){const source=sources.get(keyFor(key,native));if(!source?.proof())return [];
  if(key==="cadillacs"||key==="french"||key==="british"||native&&(key==="berlin"||key==="pyramide"))continue;
  const entry=profile.families[key][native?"native":"drawn"]!,expected=key==="berlin"?CONTROLS.berlin:key==="pyramide"?CONTROLS.pyramide:CONTROLS[key][native?"native":"drawn"];
  if(entry.control!==expected||hash(entry.plan)!==expected)return [];
  verified.set(entry.plan,source.proof);result.push({key,groupName:entry.groupName,plan:entry.plan,control:expected,sourceRows:source.rows});
 }
 return result;
}
/** A native-only additive figure has source proof without a fictitious plan. */
export function memorialAccuracySourceRowsV322(native:boolean,keys:readonly MemorialSiteKeyV322[]):readonly Row[]|null{
 if(!selection(keys)||!profileReady())return null;
 const selected=keys.map(key=>sources.get(keyFor(key,native)));if(selected.some(s=>!s?.proof()))return null;
 const rows=selected.flatMap(s=>s!.rows),proof=()=>profileReady()&&selected.every(s=>s!.proof());
 issuedRows.set(rows,{native,keys:[...keys],rows:[...rows],proof});return rows;
}
export function hasMemorialAccuracySourceRowsV322(rows:readonly unknown[],native:boolean,keys:readonly MemorialSiteKeyV322[]):boolean{
 const r=issuedRows.get(rows);return !!r&&r.native===native&&same(r.keys,keys)&&r.proof()&&Object.getPrototypeOf(rows)===Array.prototype&&
  Reflect.ownKeys(rows).length===r.rows.length+1&&rows.length===r.rows.length&&r.rows.every((row,i)=>{const d=Object.getOwnPropertyDescriptor(rows,String(i));return !!d&&"value"in d&&d.value===row;});
}
/** Only privately issued literal plans can authorize authored-member binding. */
export function verifiedMemorialPreviousSourceV322(plan:ExactOwnersPlanV321):(()=>boolean)|null{
 const proof=verified.get(plan);if(!proof?.()||!profileReady())return null;
 const entry=Object.values(profile.families).flatMap(f=>Object.values(f)).find(p=>p?.plan===plan);
 return entry&&hash(plan)===entry.control?proof:null;
}
