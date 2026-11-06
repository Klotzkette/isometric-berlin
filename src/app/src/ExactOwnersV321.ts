/** Exact finite owner transfers. Catalogues remain in their main-thread callers.
 * Source vertices and all outside index words are borrowed unchanged; only one
 * copied index/matrix per affected host is published, in one synchronous step. */
import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedMesh,
  InterleavedBufferAttribute, LineSegments, Material, Mesh, type Object3D } from "three";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { staticStorageInfo, isParkedStaticStorageV321, parkStaticAttribute } from "./losslessStaticStorage";
import { isSceneGeometryGpuRetirementV309 } from "./sceneGeometryGpuResidency";
import { isSceneInstanceGpuRetirementV309 } from "./sceneGpuResidency";
import { isSceneMaterialProgramRetirementV321 } from "./sceneMaterialPrograms";
import { hasSchwellenraumMaterialProvenance } from "./visual-modes/schwellenraum/materialGrade";
import { hasMinecraftMaterialProvenance, minecraftOriginalMaterialFor } from "./visual-modes/minecraft/materialMode";
import { verifiedFederalMinistryPressQuarterSourceV321 } from "./FederalMinistryPressQuarterV321";
import { verifiedMemorialPreviousSourceV322 } from "./MemorialPreviousV322";

export type ExactAttributeV321 = { type:string; itemSize:number; normalized:boolean; bytes:string };
export type ExactComponentV321 = { name:string; kind:"mesh"|"lines"|"instances";
  attributes:Record<string,ExactAttributeV321>; index:{type:string;bytes:string}|null;
  instances:{count:number;matrix:string;color:string|null}|null; retire:boolean|number[] };
export type ExactOwnersPlanV321 = { schemaVersion:1; native:boolean; sourceBasename?:string;
  owners:{id:string;sourcePrism:Record<string,unknown>;components:ExactComponentV321[];retireBody?:boolean}[];
  nativeSource?:{cell:number;grid:Record<string,number>;columns:{source:number[];contributors:string[];retireBody?:boolean}[]} };
export type ExactOwnersSourceV321 = { readonly source:true };
export type ExactOwnersGateV321 = boolean|(()=>boolean);
export type ExactOwnersHooksV321 = { beforeSwap?:(object:Object3D,kind:"geometry"|"instances")=>boolean|void;
  afterSwap?:()=>void };
export type ExactOwnersTransactionV321 = { prepared:()=>boolean; commit:(liveGate:ExactOwnersGateV321)=>boolean;
  complete:()=>boolean; rollback:()=>void; parkRetiredSourcesSteps:()=>Generator<void,number>; readonly activeOwners:readonly string[] };
type Attr=BufferAttribute|InterleavedBufferAttribute;
type Renderable=Mesh|LineSegments;
type Pin={attribute:Attr;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;
  size:number;normalized:boolean;offset:number;stride:number};
type GP={geometry:BufferGeometry;attributes:Map<string,Pin>;index:Pin|null;start:number;count:number};
type Pose={object:Object3D;parent:Object3D|null;values:number[]};
type MaterialPin={day:Material;night:Material};
type Decoded={component:ExactComponentV321;owner:number;attrs:Record<string,BufferAttribute>;
  index:BufferAttribute|null;tuples:string[];anchors:Set<number>;primitive:string|null;rows:Map<Renderable,number[]>};
type Host={object:Renderable;old:GP;live:GP;matrix:Pin|null;nextMatrix:Pin|null;color:Pin|null;
  instanceCount:number|null;
  pose:Pose[];material:MaterialPin;selected:{record:Decoded;ordinals:number[]}[];retire:Set<number>;
  oldIndexHash:number|null;liveIndexHash:number|null;oldMatrixHash:number|null;liveMatrixHash:number|null;
  outsideHash:number|null;liveSelected:Map<number,number[]>};
type Binding={plan:ExactOwnersPlanV321;text:string;buildings:readonly unknown[];length:number;
  rows:{index:number;row:unknown;text:string;fast?:DataPin[]}[];nativeValid?:()=>boolean};
type DataPin={object:object;key:string;value:unknown};
const bindings=new WeakMap<ExactOwnersSourceV321,Binding>();
const active=new WeakMap<Object3D,ExactOwnersTransactionV321>();
const pending=new WeakMap<Object3D,ExactOwnersTransactionV321>();
const epochs=new WeakMap<Object3D,number>();
const decodedPlans=new WeakMap<ExactOwnersPlanV321,Decoded[]>();
const sourceCache=new WeakMap<ExactOwnersPlanV321,WeakMap<readonly unknown[],{voxels:unknown;control:number;receipt:ExactOwnersSourceV321}>>();
const compositions=new WeakMap<readonly unknown[],{parts:readonly {plan:ExactOwnersPlanV321;control:number}[];voxels:unknown;receipt:ExactOwnersSourceV321}[]>();
const scalar=new Float32Array(1),word=new Uint32Array(scalar.buffer);
const LITTLE_ENDIAN=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
const storage=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
function pin(a:Attr):Pin {return {attribute:a,storage:staticStorageInfo(storage(a)),version:storage(a).version,
  count:a.count,size:a.itemSize,normalized:a.normalized,offset:a instanceof InterleavedBufferAttribute?a.offset:0,
  stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize};}
function matches(a:Attr|undefined|null,p:Pin):boolean {if(!a||a!==p.attribute||storage(a).version!==p.version||a.count!==p.count||
  a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||
  (a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;
  const s=staticStorageInfo(storage(a));return s.arrayIdentity===p.storage.arrayIdentity&&s.bufferIdentity===p.storage.bufferIdentity&&
    s.byteLength===p.storage.byteLength&&s.bufferBytes===p.storage.bufferBytes;}
function gp(g:BufferGeometry):GP{return {geometry:g,attributes:new Map(Object.entries(g.attributes).map(([k,a])=>[k,pin(a)])),
  index:g.index?pin(g.index):null,start:g.drawRange.start,count:g.drawRange.count};}
function geometryMatches(g:BufferGeometry,p:GP):boolean{return g===p.geometry&&g.drawRange.start===p.start&&g.drawRange.count===p.count&&
  Object.keys(g.attributes).length===p.attributes.size&&[...p.attributes].every(([k,a])=>matches(g.getAttribute(k),a))&&
  (p.index?matches(g.index,p.index):!g.index);}
function pose(o:Object3D):Pose{return {object:o,parent:o.parent,values:[...o.matrix.elements,...o.position.toArray(),
  ...o.quaternion.toArray(),...o.scale.toArray(),+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate]};}
function poseMatches(p:Pose,boundary=false):boolean {const q=pose(p.object);return (boundary||p.object.parent===p.parent)&&q.values.every((v,i)=>Object.is(v,p.values[i]));}
function lineage(o:Object3D,root:Object3D):Pose[]|null {const result:Pose[]=[];for(let p:Object3D|null=o;p;p=p.parent){result.push(pose(p));if(p===root)return result;}return null;}
const admitted=(g:ExactOwnersGateV321)=>{try{return typeof g==="function"?g()===true:g===true;}catch{return false;}};
function ownJSON(value:unknown,seen=new Set<object>()):string|null {
  if(value===null||typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number")return Number.isFinite(value)?Object.is(value,-0)?"-0":String(value):null;
  if(!value||typeof value!=="object"||seen.has(value))return null;
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return null;
  seen.add(value);const keys=Object.keys(value),parts:string[]=[];
  if(Reflect.ownKeys(value).length!==keys.length+(Array.isArray(value)?1:0)||Array.isArray(value)&&(keys.length!==value.length||keys.some((k,i)=>k!==String(i))))return null;
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!("value"in d))return null;
    const s=ownJSON(d.value,seen);if(s===null)return null;parts.push(Array.isArray(value)?s:JSON.stringify(k)+":"+s);}
  seen.delete(value);return Array.isArray(value)?"["+parts.join(",")+"]":"{"+parts.join(",")+"}";
}
function freeze(value:unknown):void {if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const x of Object.values(value))freeze(x);Object.freeze(value);}}
function control(value:unknown):number {const text=JSON.stringify(value);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;}
function dataPins(value:unknown,out:DataPin[]=[]):DataPin[]{if(value&&typeof value==="object"){for(const key of Object.getOwnPropertyNames(value)){const d=Object.getOwnPropertyDescriptor(value,key)!;if(!("value"in d))throw Error("Unexpected source accessor");out.push({object:value,key,value:d.value});if(key!=="length")dataPins(d.value,out);}}return out;}
function pinsMatch(pins:DataPin[]):boolean{return pins.every(p=>{const d=Object.getOwnPropertyDescriptor(p.object,p.key);return !!d&&"value"in d&&Object.is(d.value,p.value);});}
function sameSource(binding:Binding,full=false):boolean {return binding.buildings.length===binding.length&&
  binding.rows.every(r=>binding.buildings[r.index]===r.row&&(full?ownJSON(r.row)===r.text:pinsMatch(r.fast!)))&&(binding.nativeValid?.()??true);}
function clipArea(ring:number[][],x0:number,z0:number,x1:number,z1:number):number {
 let p=ring.map(q=>[q[0]/10,q[1]/10]);for(const[axis,value,sign]of[[0,x0,1],[0,x1,-1],[1,z0,1],[1,z1,-1]]){
  const out:number[][]=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],fa=(a[axis]-value)*sign,fb=(b[axis]-value)*sign;
   if(fa>=0)out.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}
  p=out;if(p.length<3)return 0;
 }let sum=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];sum+=a[0]*b[1]-b[0]*a[1];}return Math.abs(sum)/2;
}
function* bindNativeSteps(plan:ExactOwnersPlanV321,buildings:readonly unknown[],voxels:unknown,rows:Binding["rows"]):Generator<void,(()=>boolean)|null> {
 const spec=plan.nativeSource,v=voxels as {cell_m:number;grid:Record<string,number>;building_rows?:number[][][];buildings?:number[][]};
 if(!spec||!v||spec.cell!==v.cell_m||ownJSON(v.grid)!==ownJSON(spec.grid)||!spec.columns.length)return null;
 // A real voxel cell can contain several original vertical RLE intervals.
 // Require every full five-word source signature, including class and heights.
 const columns=new Map<string,typeof spec.columns[number]>(),cells=new Map<string,typeof spec.columns>();
 for(const c of spec.columns){const key=ownJSON(c.source),cell=c.source.slice(0,2).join(",");if(c.source.length!==5||c.source.some(n=>!Number.isSafeInteger(n))||!c.contributors.length||new Set(c.contributors).size!==c.contributors.length||!key||columns.has(key))return null;columns.set(key,c);const group=cells.get(cell)??[];group.push(c);cells.set(cell,group);}
 const sourceRows:{get:()=>unknown;row:unknown;text:string}[]=[],found=new Set<string>();
 const take=(source:number[],row:number[],get:()=>unknown)=>{if(!cells.has(source.slice(0,2).join(",")))return true;const key=ownJSON(source),expected=key?columns.get(key):undefined;if(!key||!expected||found.has(key))return false;
  found.add(key);sourceRows.push({get,row,text:ownJSON(row)!});return true;};
 const topologyPins:DataPin[]=[];
 if(v.building_rows){const wantedZ=new Map<number,Set<number>>();for(const c of spec.columns){const z=c.source[1]-v.grid.min_z_idx,xs=wantedZ.get(z)??new Set<number>();xs.add(c.source[0]);wantedZ.set(z,xs);}
  for(const[z,xs]of wantedZ){const row=v.building_rows[z];if(!row)return null;for(let j=0;j<row.length;j++){const r=row[j],lo=v.grid.min_x_idx+r[0],hi=lo+r[1];for(const x of xs)if(x>=lo&&x<hi&&!take([x,v.grid.min_z_idx+z,r[2],r[3],r[4]],r,()=>v.building_rows?.[z]?.[j]))return null;}}}
 else if(v.buildings){for(let i=0;i<v.buildings.length;i++)if(!take(v.buildings[i],v.buildings[i],()=>v.buildings?.[i]))return null;}else return null;
 if(found.size!==columns.size)return null;
 // Multi-interval cells additionally pin their complete containing row-list
 // topology, so appending/replacing an interval cannot bypass the live gate.
 const multi=[...cells.values()].filter(group=>group.length>1);
 const lists=multi.length&&v.building_rows?[...new Set(spec.columns.map(column=>column.source[1]-v.grid.min_z_idx))].map(z=>({parent:v.building_rows!,key:String(z),list:v.building_rows![z]}))
   :multi.length&&v.buildings?[{parent:v,key:"buildings",list:v.buildings}]:[];
 for(const {parent,key,list}of lists){if(!Array.isArray(list)||Object.getPrototypeOf(list)!==Array.prototype||Reflect.ownKeys(list).length!==list.length+1)return null;
  topologyPins.push({object:parent,key,value:list});for(const k of Object.getOwnPropertyNames(list)){const d=Object.getOwnPropertyDescriptor(list,k);if(!d||!("value"in d))return null;topologyPins.push({object:list,key:k,value:d.value});
   if(k!=="length"){if(!Array.isArray(d.value))return null;for(const coordinate of["0","1","length"]){const q=Object.getOwnPropertyDescriptor(d.value,coordinate);if(!q||!("value"in q))return null;topologyPins.push({object:d.value,key:coordinate,value:q.value});}}}}
 const sourceArray=v.building_rows??v.buildings,sourceField=v.building_rows?"building_rows":"buildings";
 if(multi.length)topologyPins.push({object:v,key:sourceField,value:sourceArray});
 for(const owner of plan.owners)for(const c of owner.components)if(c.name==="Voxel building columns"&&c.instances){
  const retired=c.retire===true?Array.from({length:c.instances.count},(_,i)=>i):c.retire===false?[]:c.retire;
  if(retired.length&&!owner.retireBody)return null;const bytes=decodeBase64Bytes(c.instances.matrix);if(bytes.byteLength!==c.instances.count*64)return null;
  const matrix=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
  for(const row of retired){if(!Number.isSafeInteger(row)||row<0||row>=c.instances.count)return null;const x=Math.round(matrix[row*16+12]/spec.cell-.5),z=Math.round(matrix[row*16+14]/spec.cell-.5),cell=cells.get(x+","+z);
   if(!cell?.length||cell.some(column=>!column.retireBody||!column.contributors.includes(owner.id))||Math.abs(matrix[row*16+12]-(x+.5)*spec.cell)>.001||Math.abs(matrix[row*16+14]-(z+.5)*spec.cell)>.001)return null;}
 }
 // One bounded spatial index, not a selected-column by whole-city nested scan.
 const buckets=new Map<string,number[]>(),prisms=buildings as {id:string;ring:number[][];holes?:number[][][];h_dm:number}[];
 for(let i=0;i<prisms.length;i++){if(i%512===511)yield;const p=prisms[i];if(!p||!Array.isArray(p.ring)||p.ring.length<3||!p.ring.every(q=>Array.isArray(q)&&q.length===2&&q.every(Number.isFinite)))return null;
  if(p.h_dm<=0)continue;const x0=Math.floor(Math.min(...p.ring.map(q=>q[0]))/2560),x1=Math.floor(Math.max(...p.ring.map(q=>q[0]))/2560),z0=Math.floor(Math.min(...p.ring.map(q=>q[1]))/2560),z1=Math.floor(Math.max(...p.ring.map(q=>q[1]))/2560);
  if((x1-x0+1)*(z1-z0+1)>4096)return null;for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+","+z,a=buckets.get(k)??[];a.push(i);buckets.set(k,a);}}
 const pinned=new Set(rows.map(r=>r.index));
 let checked=0;for(const c of spec.columns){if(++checked%32===0)yield;const[x,z]=c.source,x0=x*spec.cell,z0=z*spec.cell,x1=x0+spec.cell,z1=z0+spec.cell,near=new Set<number>();
  for(let bx=Math.floor(x0/256);bx<=Math.floor(x1/256);bx++)for(let bz=Math.floor(z0/256);bz<=Math.floor(z1/256);bz++)for(const i of buckets.get(bx+","+bz)??[])near.add(i);
  const contributors:string[]=[];for(const i of near){const p=prisms[i],area=clipArea(p.ring,x0,z0,x1,z1)-(p.holes??[]).reduce((sum,h)=>sum+clipArea(h,x0,z0,x1,z1),0);
   if(area<=1e-7)continue;contributors.push(p.id);if(!pinned.has(i)){const text=ownJSON(p);if(!text)return null;rows.push({index:i,row:p,text});pinned.add(i);}}
  if(ownJSON(contributors.sort())!==ownJSON(c.contributors.slice().sort())||c.retireBody===true&&!contributors.every(id=>plan.owners.some(o=>o.id===id&&o.retireBody===true)))return null;
 }
 if(sourceRows.some(r=>r.get()!==r.row||ownJSON(r.row)!==r.text)||ownJSON(v.grid)!==ownJSON(spec.grid))return null;
 const grid=v.grid,gridPins=dataPins(grid),rlePins=sourceRows.map(r=>({get:r.get,row:r.row,pins:dataPins(r.row)}));
 return()=>v.cell_m===spec.cell&&v.grid===grid&&pinsMatch(gridPins)&&pinsMatch(topologyPins)&&rlePins.every(r=>r.get()===r.row&&pinsMatch(r.pins));
}
/** Only complete own-data source rows can create this private receipt. The
 * caller must provide the actual complete retained constructor input. */
export function* createExactOwnersSourceV321Steps(plan:ExactOwnersPlanV321,buildings:readonly unknown[],expectedPlanControl:number,voxels?:unknown):Generator<void,ExactOwnersSourceV321|null> {
 try{
  const cached=sourceCache.get(plan)?.get(buildings);if(cached&&cached.control===expectedPlanControl&&cached.voxels===voxels&&sameSource(bindings.get(cached.receipt)!,true))return cached.receipt;
  const text=ownJSON(plan);if(!text||!Number.isSafeInteger(expectedPlanControl)||control(plan)!==expectedPlanControl||plan.schemaVersion!==1||!Array.isArray(plan.owners)||!plan.owners.length||!Array.isArray(buildings))return null;
  // These two private literal authored-fitting plans have an independent
  // original V272 source proof; they neither claim a Core body nor voxel rows.
  const authoredFittings=verifiedFederalMinistryPressQuarterSourceV321(plan)??verifiedMemorialPreviousSourceV322(plan);
  const wanted=new Map<string,number>();for(let i=0;i<plan.owners.length;i++){const o=plan.owners[i];if(!o||typeof o.id!=="string"||wanted.has(o.id)||
    !o.components.length||!authoredFittings&&!o.components.some(c=>c.kind==="mesh"||c.name==="Voxel building columns"))return null;wanted.set(o.id,i);}
  const rows:Binding["rows"]=[],found=new Set<string>();
  for(let i=0;i<buildings.length;i++){if(i%1024===1023)yield;const row=buildings[i];if(!row||typeof row!=="object")return null;
    const d=Object.getOwnPropertyDescriptor(row,"id");if(!d||!("value"in d)||typeof d.value!=="string")return null;
    if(!wanted.has(d.value))continue;if(found.has(d.value))return null;found.add(d.value);
    const actual=ownJSON(row),expected=ownJSON(plan.owners[wanted.get(d.value)!].sourcePrism);if(actual===null||actual!==expected)return null;
    rows.push({index:i,row,text:actual});}
  if(found.size!==wanted.size)return null;
  const nativeValid=authoredFittings??(plan.native?yield*bindNativeSteps(plan,buildings,voxels,rows):undefined);if(plan.native&&!nativeValid)return null;
  if(ownJSON(plan)!==text||rows.some(r=>buildings[r.index]!==r.row||ownJSON(r.row)!==r.text))return null;
  for(const row of rows)row.fast=dataPins(row.row);freeze(plan);const receipt=Object.freeze({source:true as const});bindings.set(receipt,{plan,text,buildings,length:buildings.length,rows,nativeValid:nativeValid??undefined});
  let cache=sourceCache.get(plan);if(!cache){cache=new WeakMap();sourceCache.set(plan,cache);}cache.set(buildings,{voxels,control:expectedPlanControl,receipt});return receipt;
 }catch{return null;}
}
export function createExactOwnersSourceV321(plan:ExactOwnersPlanV321,buildings:readonly unknown[],expectedPlanControl:number,voxels?:unknown):ExactOwnersSourceV321|null {
 const steps=createExactOwnersSourceV321Steps(plan,buildings,expectedPlanControl,voxels);for(;;){const r=steps.next();if(r.done)return r.value;}
}
/** Compose only separately literal-pinned catalogues before touching a shared
 * host. Original owner/component objects are reused, never copied or resigned. */
export function* composeExactOwnersSourcesV321Steps(parts:readonly {plan:ExactOwnersPlanV321;control:number}[],buildings:readonly unknown[],voxels?:unknown):Generator<void,ExactOwnersSourceV321|null> {
  const prior=compositions.get(buildings)?.find(p=>p.voxels===voxels&&p.parts.length===parts.length&&p.parts.every((q,i)=>q.plan===parts[i].plan&&q.control===parts[i].control));
  if(prior&&sameSource(bindings.get(prior.receipt)!,true))return prior.receipt;
  const receipts:(ExactOwnersSourceV321|null)[]=[];for(const p of parts)receipts.push(yield*createExactOwnersSourceV321Steps(p.plan,buildings,p.control,voxels));
  if(!parts.length||receipts.some(p=>!p)||parts.some(p=>p.plan.native!==parts[0].plan.native))return null;
  const owners=parts.flatMap(p=>p.plan.owners);if(new Set(owners.map(o=>o.id)).size!==owners.length)return null;
  const plan:ExactOwnersPlanV321={schemaVersion:1,native:parts[0].plan.native,owners};
  if(plan.native){const all=parts.map(p=>p.plan.nativeSource!);if(all.some(p=>p.cell!==all[0].cell||ownJSON(p.grid)!==ownJSON(all[0].grid)))return null;
   const columns=new Map<string,typeof all[number]["columns"][number]>();for(const item of all)for(const c of item.columns){const k=ownJSON(c.source);if(!k)return null;const old=columns.get(k);if(old&&ownJSON(old)!==ownJSON(c))return null;columns.set(k,c);}plan.nativeSource={cell:all[0].cell,grid:all[0].grid,columns:[...columns.values()]};}
  // Each constituent already proved its complete actual source, grid, columns
  // and every positive-area contributor. Composition reuses those private
  // proofs instead of scanning the same city a second time.
  freeze(plan);const sourceBindings=receipts.map(r=>bindings.get(r!)!),rowMap=new Map<number,Binding["rows"][number]>();for(const b of sourceBindings)for(const row of b.rows)rowMap.set(row.index,row);
  const receipt=Object.freeze({source:true as const});bindings.set(receipt,{plan,text:ownJSON(plan)!,buildings,length:buildings.length,rows:[...rowMap.values()],nativeValid:()=>sourceBindings.every(b=>b.nativeValid?.()??true)});
  const list=compositions.get(buildings)??[];list.push({parts:parts.map(p=>({...p})),voxels,receipt});compositions.set(buildings,list);return receipt;
}
export function composeExactOwnersSourcesV321(parts:readonly {plan:ExactOwnersPlanV321;control:number}[],buildings:readonly unknown[],voxels?:unknown):ExactOwnersSourceV321|null {
 const steps=composeExactOwnersSourcesV321Steps(parts,buildings,voxels);for(;;){const r=steps.next();if(r.done)return r.value;}
}
function decode(a:ExactAttributeV321):BufferAttribute {
  const types={Float32Array,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array};
  const Type=types[a.type as keyof typeof types];if(!Type||!Number.isSafeInteger(a.itemSize)||a.itemSize<1||a.itemSize>16||typeof a.normalized!=="boolean")throw Error("Unknown exact source attribute");
  const b=decodeBase64Bytes(a.bytes);if(b.byteLength%Type.BYTES_PER_ELEMENT||b.byteLength/Type.BYTES_PER_ELEMENT%a.itemSize)throw Error("Incomplete exact source attribute");
  return new BufferAttribute(new Type(b.slice().buffer),a.itemSize,a.normalized);
}
function componentWord(a:Attr,vertex:number,c:number):number {
  const array=storage(a).array,offset=a instanceof InterleavedBufferAttribute?vertex*a.data.stride+a.offset+c:vertex*a.itemSize+c;
  const raw=array[offset];let v=raw;
  if(a.normalized){if(array instanceof Uint8Array)v=raw/255;else if(array instanceof Uint16Array)v=raw/65535;else if(array instanceof Uint32Array)v=raw/4294967295;
    else if(array instanceof Int8Array)v=Math.max(raw/127,-1);else if(array instanceof Int16Array)v=Math.max(raw/32767,-1);else if(array instanceof Int32Array)v=Math.max(raw/2147483647,-1);else throw Error("Unknown normalized source");}
  if(!Number.isFinite(v))throw Error("Nonfinite exact source");scalar[0]=v;return word[0];
}
/** Private ephemeral fingerprints only: no catalogue/source control uses this
 * representation. Every backing bit is included, including unaligned ends and
 * byte tails; no numeric Float32 conversion can erase negative zero/NaN bits.
 * Read the existing storage once per pass, retaining that same view across the
 * cooperative slices rather than repeatedly inflating its complete backing. */
function hashRange(bytes:Uint8Array,start:number,end:number,h:number):number {
 let cursor=start;while(cursor<end&&cursor%4)h=Math.imul(h^bytes[cursor++],16777619);
 const count=Math.floor((end-cursor)/4);if(count){if((bytes.byteOffset+cursor)%4===0){const words=new Int32Array(bytes.buffer,bytes.byteOffset+cursor,count);
   for(let i=0;i<count;i++)h=Math.imul(h^words[i],16777619);
  }else{const view=new DataView(bytes.buffer,bytes.byteOffset+cursor,count*4);for(let i=0;i<count;i++)h=Math.imul(h^view.getInt32(i*4,LITTLE_ENDIAN),16777619);}cursor+=count*4;}
 while(cursor<end)h=Math.imul(h^bytes[cursor++],16777619);return h>>>0;
}
function hashRanges(array:Attr["array"],retired?:Set<number>,size=1):[number,number][] {
 if(!retired?.size)return [[0,array.byteLength]];const result:[number,number][]=[],stride=size*array.BYTES_PER_ELEMENT;let from=0;
 for(const row of [...retired].sort((a,b)=>a-b)){if(row*stride>from)result.push([from,row*stride]);from=(row+1)*stride;}if(from<array.byteLength)result.push([from,array.byteLength]);return result;
}
function* backingHashSteps(a:Attr|null,retired?:Set<number>,size=1):Generator<void,number|null> {
 if(!a)return null;const backing=storage(a),array=backing.array,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),length=bytes.length,
  cooperative=!Object.getOwnPropertyDescriptor(backing,"array")?.get;let h=Math.imul(2166136261^length,16777619)>>>0,work=0;
 for(const [start,end]of hashRanges(array,retired,size)){let from=start;
  while(from<end){let to=end;if(cooperative&&to-from>524288)to=Math.floor((from+524288)/4)*4;
   h=hashRange(bytes,from,to,h);work+=to-from;from=to;
   if(cooperative&&work>=524288){work=0;yield;if(bytes.byteLength!==length)throw Error("Exact backing retired during source proof");}
  }
 }return h;
}
function rawHash(a:Attr|null):number|null {if(!a)return null;const array=storage(a).array,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);return hashRange(bytes,0,bytes.length,Math.imul(2166136261^bytes.length,16777619)>>>0);}
function outsideHash(a:BufferAttribute|null,retired:Set<number>,size:number):number|null {if(!a)return null;const array=a.array,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=Math.imul(2166136261^bytes.length,16777619)>>>0;
 for(const[start,end]of hashRanges(array,retired,size))h=hashRange(bytes,start,end,h);return h;}
function liveSelectedMatches(h:Host):boolean {const attr=h.object instanceof InstancedMesh?h.object.instanceMatrix:h.object.geometry.index;
 if(!attr)return h.liveSelected.size===0;if(isParkedStaticStorageV321(storage(attr)))return true;
 const size=h.object instanceof InstancedMesh?16:h.object instanceof LineSegments?2:3,array=attr.array;
 return [...h.liveSelected].every(([row,values])=>values.every((v,i)=>Object.is(v,array[row*size+i])));}
function geometryWithIndex(old:BufferGeometry,index:BufferAttribute):BufferGeometry {const g=new BufferGeometry();for(const[k,a]of Object.entries(old.attributes))g.setAttribute(k,a);
 g.groups=old.groups.map(p=>({...p}));g.boundingBox=old.boundingBox?.clone()??null;g.boundingSphere=old.boundingSphere?.clone()??null;g.setDrawRange(old.drawRange.start,old.drawRange.count);
 g.setIndex(index);g.userData={...old.userData,losslessStaticBacking:true};return g;}
function cloneMatrix(source:InstancedBufferAttribute):InstancedBufferAttribute {if(!(source.array instanceof Float32Array)||source.itemSize!==16||source.normalized)throw Error("Invalid source instance matrix");
 const result=new InstancedBufferAttribute(new Float32Array(source.array),16,false,source.meshPerAttribute);result.setUsage(source.usage);result.name=source.name;result.gpuType=source.gpuType;return result;}
function tuple(attrs:Record<string,Attr>,keys:string[],vertices:readonly number[]):string {
  const parts:number[]=[];for(const vertex of vertices)for(const k of keys){const a=attrs[k];for(let c=0;c<a.itemSize;c++)parts.push(componentWord(a,vertex,c));}return parts.join(",");
}
// A collision only requests the unchanged full canonical tuple comparison; it
// cannot admit a foreign row. Avoid millions of temporary XYZ strings.
const anchor=(a:Attr,row:number,instance=false)=>Math.imul(Math.imul(Math.imul(2166136261^componentWord(a,row,instance?12:0),16777619)^componentWord(a,row,instance?13:1),16777619)^componentWord(a,row,instance?14:2),16777619)>>>0;
function attributesMatch(actual:BufferGeometry,expected:Record<string,BufferAttribute>):boolean {
  return Object.keys(actual.attributes).length===Object.keys(expected).length&&Object.entries(expected).every(([k,e])=>{
    const a=actual.getAttribute(k);return !!a&&a.itemSize===e.itemSize&&a.count===actual.getAttribute("position").count&&
      (storage(a).array instanceof Float32Array||storage(a).array instanceof Uint8Array||storage(a).array instanceof Uint16Array||storage(a).array instanceof Uint32Array||storage(a).array instanceof Int8Array||storage(a).array instanceof Int16Array||storage(a).array instanceof Int32Array);});
}
function indices(g:BufferGeometry,ordinal:number,size:number):number[]{const out:number[]=[];for(let j=0;j<size;j++)out.push(g.index?g.index.getX(ordinal*size+j):ordinal*size+j);return out;}
function materialPin(o:Renderable):MaterialPin|null {const original=o instanceof Mesh?minecraftOriginalMaterialFor(o):null;
  const day=o.userData.dayMaterial??original??o.material,night=o.userData.nightMaterial??day;
  return day instanceof Material&&night instanceof Material?{day,night}:null;}
function materialMatches(o:Renderable,m:MaterialPin):boolean {return o.material===m.day||o.material===m.night||
  hasSchwellenraumMaterialProvenance(o,m.day,o.material)||o instanceof Mesh&&(hasMinecraftMaterialProvenance(o,m.day,o.material)||hasMinecraftMaterialProvenance(o,m.night,o.material));}
function objectKind(o:Object3D,c:ExactComponentV321):o is Renderable {return o.name===c.name&&(c.kind==="lines"?o instanceof LineSegments:
  c.kind==="instances"?o instanceof InstancedMesh:o instanceof Mesh&&!(o instanceof InstancedMesh));}
function instanceTuple(o:InstancedMesh,row:number,matrix:Attr=o.instanceMatrix):string {const out:number[]=[];for(let c=0;c<16;c++)out.push(componentWord(matrix,row,c));
  if(o.instanceColor)for(let c=0;c<o.instanceColor.itemSize;c++)out.push(componentWord(o.instanceColor,row,c));return out.join(",");}
function* decodePlan(plan:ExactOwnersPlanV321):Generator<void,Decoded[]> {
 const cached=decodedPlans.get(plan);if(cached)return cached.map(r=>({...r,rows:new Map()}));
 const out:Decoded[]=[];for(let owner=0;owner<plan.owners.length;owner++)for(const component of plan.owners[owner].components){
  const attrs=Object.fromEntries(Object.entries(component.attributes).map(([k,a])=>[k,decode(a)]));if(!attrs.position)throw Error("Missing exact source position");
  const ix=component.index?decode({type:component.index.type,itemSize:1,normalized:false,bytes:component.index.bytes}):null;
  const keys=Object.keys(attrs).sort(),size=component.kind==="lines"?2:3,count=ix?.count??attrs.position.count;
  if(count%size||Object.values(attrs).some(a=>a.count!==attrs.position.count)||ix&&(!(ix.array instanceof Uint8Array||ix.array instanceof Uint16Array||ix.array instanceof Uint32Array)||Array.from(ix.array).some(i=>i>=attrs.position.count)))throw Error("Invalid exact source topology");
  const tuples:string[]=[],anchors=new Set<number>();let primitive:string|null=null;
  if(component.kind==="instances"){
   if(!component.instances||component.instances.count<=0)throw Error("Incomplete exact source instances");
   primitive=Array.from({length:count/3},(_,i)=>tuple(attrs,keys,Array.from({length:3},(_,j)=>ix?ix.getX(i*3+j):i*3+j))).join(";");
   const matrix=decode({type:"Float32Array",itemSize:16,normalized:false,bytes:component.instances.matrix});
   const color=component.instances.color?decode({type:"Float32Array",itemSize:3,normalized:false,bytes:component.instances.color}):null;
   if(matrix.count!==component.instances.count||color&&color.count!==matrix.count)throw Error("Incomplete exact source matrices");
   for(let i=0;i<matrix.count;i++){const a:Record<string,Attr>={matrix};if(color)a.color=color;tuples.push(tuple(a,Object.keys(a),[i]));anchors.add(anchor(matrix,i,true));}
  }else{if(component.instances!==null)throw Error("Unexpected source instances");for(let i=0;i<count/size;i++){tuples.push(tuple(attrs,keys,Array.from({length:size},(_,j)=>ix?ix.getX(i*size+j):i*size+j)));anchors.add(anchor(attrs.position,ix?ix.getX(i*size):i*size));}}
  out.push({component,owner,attrs,index:ix,tuples,anchors,primitive,rows:new Map()});yield;
 }decodedPlans.set(plan,out.map(r=>({...r,rows:new Map()})));return out;
}
function hostOriginal(h:Host,root:Object3D,live:boolean):boolean {return !!lineage(h.object,root)&&h.pose.every(p=>poseMatches(p,p.object===root))&&
  // These already fully matched captured instance components alone have real
  // constructor-controlled Day/Night visibility. Public names/tags without the
  // complete owner/body/primitive/material/word receipt never reach this host.
  (h.object.visible||h.object instanceof InstancedMesh&&h.selected.length>0&&h.selected.every(s=>s.record.component.kind==="instances"&&s.record.component.name==="LoD2 facade night strips"))&&
  h.selected.every(s=>objectKind(h.object,s.record.component))&&geometryMatches(h.object.geometry,live?h.live:h.old)&&materialMatches(h.object,h.material)&&materialPin(h.object)?.day===h.material.day&&materialPin(h.object)?.night===h.material.night&&
  (!(h.object instanceof InstancedMesh)||h.object.count===h.instanceCount&&matches(h.object.instanceMatrix,live?h.nextMatrix!:h.matrix!)&&
    (h.color?matches(h.object.instanceColor,h.color):!h.object.instanceColor));}
function selectedStillOriginal(h:Host):boolean {for(const s of h.selected){const c=s.record.component,size=c.kind==="lines"?2:3,keys=Object.keys(s.record.attrs).sort();
  for(let i=0;i<s.ordinals.length;i++){const actual=c.kind==="instances"?instanceTuple(h.object as InstancedMesh,s.ordinals[i],h.matrix!.attribute):
    tuple(h.object.geometry.attributes as Record<string,Attr>,keys,indices(h.old.geometry,s.ordinals[i],size));if(actual!==s.record.tuples[i])return false;}}return true;}
function localRetire(record:Decoded):Set<number> {
 const c=record.component,rows=c.retire===true?record.tuples.map((_,i)=>i):c.retire===false?[]:c.retire;
 if(!Array.isArray(rows)||rows.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>=record.tuples.length||i>0&&n<=rows[i-1]))throw Error("Invalid exact owner-local retirement");return new Set(rows);
}
const actualTuple=(r:Decoded,o:Renderable,row:number)=>r.component.kind==="instances"?instanceTuple(o as InstancedMesh,row):
 tuple(o.geometry.attributes as Record<string,Attr>,Object.keys(r.attrs).sort(),indices(o.geometry,row,r.component.kind==="lines"?2:3));
/** This stage must receive the exact current family root, not a mixed-world Scene.
 * An entirely absent owner is valid for a legitimate progressive batch. Any
 * present component requires its complete owner family, including body proof. */
export function* stageExactOwnersV321Steps(root:Object3D,receipt:ExactOwnersSourceV321,
 replacementGate:ExactOwnersGateV321=false,hooks:ExactOwnersHooksV321={}):Generator<void,ExactOwnersTransactionV321|null> {
 const binding=bindings.get(receipt);if(!binding||!sameSource(binding,true)||!admitted(replacementGate)||active.has(root))return null;
 pending.get(root)?.rollback();
 const epoch=(epochs.get(root)??0)+1;epochs.set(root,epoch);let disposed=false,published=false,retained=false;
 const hosts:Host[]=[],resources:BufferGeometry[]=[],unwatch:(()=>void)[]=[];let gate=replacementGate;
 const cleanup=()=>{if(disposed&&resources.length===0)return;disposed=true;let changed=false;
  for(const h of hosts){if(h.live.geometry!==h.old.geometry&&h.object.geometry===h.live.geometry){let restore=h.old.geometry;
    const current=h.object.geometry.index!,size=h.object instanceof LineSegments?2:3;
    if(outsideHash(current,h.retire,size)!==h.outsideHash){const index=current.clone();for(const row of h.retire)for(let i=0;i<size;i++)index.array[row*size+i]=h.old.geometry.index?h.old.geometry.index.array[row*size+i]:row*size+i;restore=geometryWithIndex(h.old.geometry,index);}
    try{hooks.beforeSwap?.(h.object,"geometry");}catch{/* Restore CPU ownership even after renderer loss. */}h.object.geometry=restore;changed=true;}
   if(h.object instanceof InstancedMesh&&h.nextMatrix&&h.matrix&&h.nextMatrix.attribute!==h.matrix.attribute&&h.object.instanceMatrix===h.nextMatrix.attribute){let restore=h.matrix.attribute as InstancedBufferAttribute;
    if(outsideHash(h.object.instanceMatrix,h.retire,16)!==h.outsideHash){restore=cloneMatrix(h.object.instanceMatrix);for(const row of h.retire)for(let i=0;i<16;i++)restore.array[row*16+i]=h.matrix.attribute.array[row*16+i];}
    try{hooks.beforeSwap?.(h.object,"instances");}catch{/* Restore exact source on cleanup. */}h.object.instanceMatrix=restore;changed=true;}}
  for(const remove of unwatch.splice(0))remove();for(const g of resources.splice(0))g.dispose();published=false;if(changed)hooks.afterSwap?.();};
 try{
  const records=yield*decodePlan(binding.plan),objects:Renderable[]=[];root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments)objects.push(o);});
  const backingOwners=new Map<object,Set<object>>();for(const o of objects){const fields=[...Object.values(o.geometry.attributes),o.geometry.index,...(o instanceof InstancedMesh?[o.instanceMatrix,o.instanceColor]:[])];for(const a of fields){if(!a)continue;const s=storage(a),id=staticStorageInfo(s).bufferIdentity,owners=backingOwners.get(id)??new Set();owners.add(s);backingOwners.set(id,owners);}}
  const grouped=new Map<string,Decoded[]>();for(const r of records){const key=r.component.kind+":"+r.component.name;const group=grouped.get(key)??[];group.push(r);grouped.set(key,group);}
  for(const group of grouped.values()){
   const anchors=new Set(group.flatMap(r=>[...r.anchors]));
   const byTuple=new Map<string,Decoded[]>();for(const r of group)for(const key of new Set(r.tuples)){const a=byTuple.get(key)??[];a.push(r);byTuple.set(key,a);}
   const candidate=objects.filter(o=>objectKind(o,group[0].component));
   for(const o of candidate){const c=group[0].component,keys=Object.keys(group[0].attrs).sort();if(!attributesMatch(o.geometry,group[0].attrs))throw Error("Changed exact source attributes");
    const index=o.geometry.index;if(index&&(index.itemSize!==1||index.normalized||!(index.array instanceof Uint8Array||index.array instanceof Uint16Array||index.array instanceof Uint32Array)))throw Error("Unknown exact source index layout");
    const count=o.geometry.index?.count??o.geometry.getAttribute("position").count,size=c.kind==="lines"?2:3;
    if(o.geometry.drawRange.start!==0||o.geometry.drawRange.count!==Infinity&&o.geometry.drawRange.count!==count||count%size)throw Error("Partial exact source draw range");
    if(c.kind==="instances"){
      if(!(o instanceof InstancedMesh)||o.count!==o.instanceMatrix.count)throw Error("Invalid exact source instances");
      const primitive=Array.from({length:count/3},(_,i)=>tuple(o.geometry.attributes as Record<string,Attr>,keys,indices(o.geometry,i,3))).join(";");
      if(group.some(r=>r.primitive!==primitive||Boolean(r.component.instances?.color)!==Boolean(o.instanceColor)))throw Error("Changed exact source primitive");
    }
    const rows=c.kind==="instances"?(o as InstancedMesh).count:count/size;
    for(let ordinal=0;ordinal<rows;ordinal++){
      if(ordinal%4096===4095){yield;if(disposed||epochs.get(root)!==epoch||!admitted(gate))return null;}
      const token=c.kind==="instances"?anchor((o as InstancedMesh).instanceMatrix,ordinal,true):anchor(o.geometry.getAttribute("position"),o.geometry.index?o.geometry.index.getX(ordinal*size):ordinal*size);
      if(!anchors.has(token))continue;
      const key=c.kind==="instances"?instanceTuple(o as InstancedMesh,ordinal):tuple(o.geometry.attributes as Record<string,Attr>,keys,indices(o.geometry,ordinal,size));
      for(const r of byTuple.get(key)??[]){const a=r.rows.get(o)??[];a.push(ordinal);r.rows.set(o,a);}
    }
   }yield;
  }
  // The actual combined constructors emit four exactly shared ink tuples.
  // Derive their joint receipt only from complete literal-pinned captures;
  // never broaden ordinary duplicate admission or assign a shared line to an
  // arbitrary owner. Every participating local retirement must agree.
  type Joint={key:string;entries:{record:Decoded;local:number}[];retire:boolean;rows:Map<Renderable,Set<number>>};
  const ink=(r:Decoded)=>r.component.kind==="lines"&&r.component.name==="LoD2 prism ink lines";
  const inkEntries=new Map<string,{record:Decoded;local:number}[]>(),retirements=new Map(records.map(r=>[r,localRetire(r)]));
  for(const r of records)if(ink(r))for(let local=0;local<r.tuples.length;local++){const key=r.tuples[local],list=inkEntries.get(key)??[];list.push({record:r,local});inkEntries.set(key,list);}
  const joints=new Map<string,Joint>();for(const[key,entries]of inkEntries){if(new Set(entries.map(e=>e.record.owner)).size<2)continue;
   if(entries.length!==2||entries[0].record.owner===entries[1].record.owner)throw Error("Unsupported shared exact ink multiplicity");
   const retire=retirements.get(entries[0].record)!.has(entries[0].local);
   if(entries.some(e=>retirements.get(e.record)!.has(e.local)!==retire))throw Error("Ambiguous shared exact ink retirement");
   joints.set(key,{key,entries,retire,rows:new Map()});}
  const jointFor=(r:Decoded,key:string)=>ink(r)?joints.get(key):undefined;
  if(joints.size)for(const r of records)if(ink(r))for(const[o,rows]of r.rows)for(const row of rows){const joint=joints.get(actualTuple(r,o,row));if(joint){const set=joint.rows.get(o)??new Set();set.add(row);joint.rows.set(o,set);}}
  const selectedOwners:number[]=[];
  for(let owner=0;owner<binding.plan.owners.length;owner++){
   const family=records.filter(r=>r.owner===owner),present=family.some(r=>{if(!r.rows.size)return false;if(!ink(r)||!joints.size)return true;
    for(const[o,rows]of r.rows)for(const row of rows)if(!jointFor(r,actualTuple(r,o,row)))return true;return false;});if(!present)continue;
   // Shared ink alone cannot prove an otherwise absent body/family. Any unique
   // component activates the same complete body-and-fittings requirement.
   for(const r of family){if(r.rows.size!==1)throw Error("Incomplete or duplicated source host");const expected=new Map<string,number>();for(const k of r.tuples)if(!jointFor(r,k))expected.set(k,(expected.get(k)??0)+1);
    const counts=new Map<string,number>();for(const[o,ordinals]of r.rows)for(const ordinal of ordinals){const k=actualTuple(r,o,ordinal);if(!jointFor(r,k))counts.set(k,(counts.get(k)??0)+1);}
    if(counts.size!==expected.size||[...expected].some(([k,n])=>counts.get(k)!==n))throw Error("Incomplete or duplicate exact owner family");
   }selectedOwners.push(owner);
  }
  for(const joint of joints.values()){const expected=joint.entries.filter(e=>selectedOwners.includes(e.record.owner)).length,
    actual=[...joint.rows.values()].reduce((n,rows)=>n+rows.size,0);
   if(actual!==expected||expected>0&&joint.rows.size!==1)throw Error("Incomplete or duplicated joint exact ink");}
  const claimed=new Map<Renderable,Set<number>>();
  const acquire=(object:Renderable):Host=>{let h=hosts.find(h=>h.object===object);if(h)return h;
   const material=materialPin(object),poses=lineage(object,root);if(!material||!poses||!materialMatches(object,material))throw Error("Changed exact source presentation");
   h={object,old:gp(object.geometry),live:gp(object.geometry),matrix:object instanceof InstancedMesh?pin(object.instanceMatrix):null,nextMatrix:object instanceof InstancedMesh?pin(object.instanceMatrix):null,instanceCount:object instanceof InstancedMesh?object.count:null,
    color:object instanceof InstancedMesh&&object.instanceColor?pin(object.instanceColor):null,pose:poses,material,selected:[],retire:new Set(),
    oldIndexHash:null,liveIndexHash:null,oldMatrixHash:null,liveMatrixHash:null,outsideHash:null,liveSelected:new Map()};hosts.push(h);
   const invalid=()=>{disposed=true;},oldGeometry=object.geometry,geoInvalid=()=>{if(!isSceneGeometryGpuRetirementV309(oldGeometry))invalid();};oldGeometry.addEventListener("dispose",geoInvalid);
   const dayInvalid=()=>{if(!isSceneMaterialProgramRetirementV321(material.day))invalid();},nightInvalid=()=>{if(!isSceneMaterialProgramRetirementV321(material.night))invalid();};
   material.day.addEventListener("dispose",dayInvalid);material.night.addEventListener("dispose",nightInvalid);unwatch.push(()=>{oldGeometry.removeEventListener("dispose",geoInvalid);material.day.removeEventListener("dispose",dayInvalid);material.night.removeEventListener("dispose",nightInvalid);});
   if(object instanceof InstancedMesh){const fn=()=>{if(!isSceneInstanceGpuRetirementV309(object))invalid();};object.addEventListener("dispose",fn);unwatch.push(()=>object.removeEventListener("dispose",fn));}return h;
  };
  const claim=(object:Renderable,rows:readonly number[])=>{const used=claimed.get(object)??new Set();for(const row of rows){if(used.has(row))throw Error("Ambiguous exact source owner");used.add(row);}claimed.set(object,used);};
  for(const r of records.filter(r=>selectedOwners.includes(r.owner)))for(const[object,rows]of r.rows){
   const source=r.tuples.map((key,local)=>({key,local})).filter(v=>!jointFor(r,v.key));if(!source.length)continue;
   const h=acquire(object),pool=new Map<string,number[]>();for(const row of rows){const key=actualTuple(r,object,row);if(jointFor(r,key))continue;const list=pool.get(key)??[];list.push(row);pool.set(key,list);}
   const ordinals=source.map(v=>pool.get(v.key)!.shift()!);claim(object,ordinals);
   for(let i=0;i<source.length;i++)if(retirements.get(r)!.has(source[i].local))h.retire.add(ordinals[i]);
   h.selected.push({record:source.length===r.tuples.length?r:{...r,tuples:source.map(v=>v.key)},ordinals});
  }
  for(const joint of joints.values()){if(!joint.entries.some(e=>selectedOwners.includes(e.record.owner)))continue;
   const[object,rows]=[...joint.rows][0],ordinals=[...rows].sort((a,b)=>a-b),h=acquire(object);claim(object,ordinals);
   // The shared guard owns the complete multiplicity, not either individual
   // source identity. All original constituent captures remain untouched.
   const first=joint.entries[0].record,record:Decoded={...first,owner:-1,component:{...first.component,retire:joint.retire},tuples:ordinals.map(()=>joint.key)};
   if(joint.retire)for(const row of ordinals)h.retire.add(row);h.selected.push({record,ordinals});
  }
  for(const h of hosts){if(!h.retire.size){h.oldIndexHash=h.liveIndexHash=yield*backingHashSteps(h.object.geometry.index);
      h.oldMatrixHash=h.liveMatrixHash=yield*backingHashSteps(h.matrix?.attribute??null);continue;}
    if(h.object instanceof InstancedMesh){const matrix=cloneMatrix(h.object.instanceMatrix);
      h.oldIndexHash=h.liveIndexHash=yield*backingHashSteps(h.object.geometry.index);
      h.oldMatrixHash=yield*backingHashSteps(matrix);
      for(const row of h.retire)for(const c of [0,1,2,4,5,6,8,9,10])matrix.array[row*16+c]=0;matrix.needsUpdate=true;h.nextMatrix=pin(matrix);}
    else{const old=h.object.geometry;
      const ix=old.index?old.index.clone():new BufferAttribute(Uint32Array.from({length:old.getAttribute("position").count},(_,i)=>i),1),size=h.object instanceof LineSegments?2:3;
      h.oldIndexHash=old.index?yield*backingHashSteps(ix):null;
      for(const row of h.retire)for(let j=1;j<size;j++)ix.array[row*size+j]=ix.array[row*size];ix.needsUpdate=true;const g=geometryWithIndex(old,ix);h.live=gp(g);resources.push(g);
      const invalid=()=>{if(!isSceneGeometryGpuRetirementV309(g))disposed=true;};g.addEventListener("dispose",invalid);unwatch.push(()=>g.removeEventListener("dispose",invalid));
    }if(!(h.object instanceof InstancedMesh))h.liveIndexHash=yield*backingHashSteps(h.live.geometry.index);
    h.liveMatrixHash=h.nextMatrix?yield*backingHashSteps(h.nextMatrix.attribute):null;
    const attr=h.object instanceof InstancedMesh?h.nextMatrix!.attribute:h.live.geometry.index!,size=h.object instanceof InstancedMesh?16:h.object instanceof LineSegments?2:3;
    h.outsideHash=yield*backingHashSteps(attr,h.retire,size);for(const row of h.retire)h.liveSelected.set(row,Array.from(attr.array.slice(row*size,(row+1)*size)));
    if(h.object instanceof InstancedMesh&&h.nextMatrix)yield*parkStaticAttribute(h.nextMatrix.attribute as InstancedBufferAttribute,true);
    yield;
  }
  const originalState=()=>!disposed&&epochs.get(root)===epoch&&sameSource(binding,true)&&admitted(gate)&&hosts.every(h=>hostOriginal(h,root,false));
  const originalMetadata=()=>originalState()&&hosts.every(selectedStillOriginal);
  const original=()=>originalMetadata()&&hosts.every(h=>rawHash(h.object.geometry.index)===h.oldIndexHash&&
    (!(h.object instanceof InstancedMesh)||rawHash(h.object.instanceMatrix)===h.oldMatrixHash));
  // The stage's complete backing proof is cooperative. Commit independently
  // repeats the full proof synchronously after every caller hook, so no change
  // during these yields can be overwritten by a previously copied complement.
  if(!originalMetadata())return null;
  for(const h of hosts){if((yield*backingHashSteps(h.object.geometry.index))!==h.oldIndexHash||
    h.object instanceof InstancedMesh&&(yield*backingHashSteps(h.object.instanceMatrix))!==h.oldMatrixHash)return null;}
  if(!originalMetadata())return null;
  const tx:ExactOwnersTransactionV321={activeOwners:Object.freeze(selectedOwners.map(i=>binding.plan.owners[i].id)),
   prepared:()=>!published&&original(),
   complete:()=>{const valid=published&&!disposed&&active.get(root)===tx&&admitted(gate)&&sameSource(binding)&&hosts.every(h=>hostOriginal(h,root,true)&&liveSelectedMatches(h));if(published&&!valid)tx.rollback();return valid;},
   commit(liveGate){if(published){const intact=admitted(liveGate)&&tx.complete()&&hosts.every(h=>selectedStillOriginal(h)&&rawHash(h.object.geometry.index)===h.liveIndexHash&&
      (!(h.object instanceof InstancedMesh)||rawHash(h.object.instanceMatrix)===h.liveMatrixHash));if(!intact)tx.rollback();return intact;}if(!admitted(liveGate)||!originalMetadata()){cleanup();return false;}gate=liveGate;
    try{for(const h of hosts){if(h.live.geometry!==h.old.geometry&&hooks.beforeSwap?.(h.object,"geometry")===false)throw Error("Cannot rebind exact geometry");if(h.nextMatrix?.attribute!==h.matrix?.attribute&&hooks.beforeSwap?.(h.object,"instances")===false)throw Error("Cannot rebind exact instances");}
      if(!original())throw Error("Source changed during GPU retirement");
      for(const h of hosts){h.object.geometry=h.live.geometry;if(h.object instanceof InstancedMesh)h.object.instanceMatrix=h.nextMatrix!.attribute as InstancedBufferAttribute;}published=true;pending.delete(root);active.set(root,tx);hooks.afterSwap?.();if(!tx.complete()){tx.rollback();return false;}return true;
    }catch{tx.rollback();return false;}},
   *parkRetiredSourcesSteps(){let saved=0,finished=false;
    try{if(!tx.complete()){finished=true;return 0;}
     for(const h of hosts){if(!(h.object instanceof InstancedMesh)||!h.matrix||h.nextMatrix?.attribute===h.matrix.attribute)continue;
      const old=h.matrix.attribute as InstancedBufferAttribute,info=staticStorageInfo(old);
      if(old===h.object.instanceMatrix||!matches(old,h.matrix))throw Error("Changed abandoned exact source");
      // Only the now-abandoned exclusive original may detach. The publication
      // proof read its ordinary constructor backing synchronously; no full
      // source inflation is introduced at the atomic commit boundary.
      if(info.byteLength===info.bufferBytes&&backingOwners.get(info.bufferIdentity)?.size===1){
       const steps=parkStaticAttribute(old,true);try{for(;;){const result=steps.next();if(result.done){saved+=result.value;break;}
        yield;if(!tx.complete()||!matches(old,h.matrix))throw Error("Exact source parking cancelled");}}
       finally{steps.return(0);}
      }
     }finished=true;return saved;
    }finally{if(!finished)tx.rollback();}
   },
   rollback(){if(active.get(root)===tx)active.delete(root);if(pending.get(root)===tx)pending.delete(root);cleanup();},
  };
  retained=true;pending.set(root,tx);return tx;
 }catch{return null;}finally{if(!retained)cleanup();}
}
export function stageExactOwnersV321(root:Object3D,receipt:ExactOwnersSourceV321,gate:ExactOwnersGateV321=false,hooks:ExactOwnersHooksV321={}):ExactOwnersTransactionV321|null {
 const steps=stageExactOwnersV321Steps(root,receipt,gate,hooks);for(;;){const r=steps.next();if(r.done)return r.value;}
}
