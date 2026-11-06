/** Finite source admission only. No model, Worker, fetch or owner retirement. */
import data from './data/wilhelmHousingV324Sources.json';
import {surroundingPacketFingerprint} from './surroundingPacketFingerprint';
const CONTROL=3025656564;
export type WilhelmHousingSourcesV324Receipt={readonly source:true};
type Pin={object:object;keys:number;fields:{key:PropertyKey;descriptor:PropertyDescriptor}[]};
type ListPin={weak:WeakRef<unknown[]>;index:number;length:number;rows:{weak:WeakRef<unknown[]>;index:number;x:number;length:number;words?:number[]}[]};
const receipts=new WeakMap<WilhelmHousingSourcesV324Receipt,{native:boolean;proof:()=>boolean}>();
let trusted=false;
const alwaysTrue=()=>true;
const own=(o:unknown,k:PropertyKey):unknown=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&'value'in d&&d.enumerable?d.value:undefined;};
function pin(value:unknown,result:Pin[]=[],seen=new Set<object>()):Pin[]|null{
 if(value===null||typeof value!=='object')return result;
 if(seen.has(value))return null;seen.add(value);
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return null;
 const keys=Reflect.ownKeys(value),fields:Pin['fields']=[];
 if(keys.some(k=>typeof k!=='string')||array&&keys.length!==(value as unknown[]).length+1)return null;
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key)!;if(!('value'in d)||key!=='length'&&!d.enumerable)return null;fields.push({key,descriptor:d});if(!pin(d.value,result,seen))return null;}
 result.push({object:value,keys:keys.length,fields});return result;
}
function samePins(pins:readonly Pin[]):boolean{return pins.every(p=>Reflect.ownKeys(p.object).length===p.keys&&p.fields.every(({key,descriptor:d})=>{const q=Object.getOwnPropertyDescriptor(p.object,key);return !!q&&'value'in q&&Object.is(q.value,d.value)&&q.writable===d.writable&&q.enumerable===d.enumerable&&q.configurable===d.configurable;}));}
function ownEqual(actual:unknown,expected:unknown):boolean{
 if(actual===null||expected===null||typeof actual!=='object'||typeof expected!=='object')return Object.is(actual,expected);
 const a=pin(actual);if(!a)return false;
 const keys=Reflect.ownKeys(expected);return Reflect.ownKeys(actual).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(actual,k),e=Object.getOwnPropertyDescriptor(expected,k);return !!d&&!!e&&'value'in d&&'value'in e&&d.enumerable===e.enumerable&&ownEqual(d.value,e.value);});
}
function freeze(o:unknown):void{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}}
function* hash(text:string):Generator<void,number>{let h=2166136261;for(let i=0;i<text.length;i++){h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;if(i%65536===65535)yield;}return h;}
function list(v:unknown):v is unknown[]{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1;}
function weakField(parent:object,key:string,child:object):()=>boolean{
 const d=Object.getOwnPropertyDescriptor(parent,key)!;
 return makeWeakFieldProof(new WeakRef(parent),key,new WeakRef(child),d.writable,d.enumerable,d.configurable);
}
function makeWeakFieldProof(p:WeakRef<object>,key:string,c:WeakRef<object>,writable:boolean|undefined,enumerable:boolean|undefined,configurable:boolean|undefined):()=>boolean{
 return()=>{const object=p.deref(),expected=c.deref(),q=object&&Object.getOwnPropertyDescriptor(object,key);return !!expected&&!!q&&'value'in q&&q.value===expected&&q.writable===writable&&q.enumerable===enumerable&&q.configurable===configurable;};
}

function* nativeProof(input:unknown):Generator<void,(()=>boolean)|null>{
 const core=own(input,'core'),voxels=own(input,'voxels');if(!core||typeof core!=='object'||!voxels||typeof voxels!=='object')return null;
 const chunks=own(core,'minecraftChunks'),rows=own(voxels,'building_rows'),grid=own(voxels,'grid'),classes=own(voxels,'classes'),spec=data.nativeVoxels;
 if(!list(chunks)||!list(rows)||!ownEqual(grid,spec.grid)||!ownEqual(classes,spec.classes)||own(voxels,'cell_m')!==spec.cellM||own(voxels,'schema_version')!==spec.schemaVersion)return null;
 const gridPins=pin(grid),classPins=pin(classes);if(!gridPins||!classPins)return null;
 const packetPins:Pin[]=[],packetRows:{index:number;row:object;packet:object}[]=[],wanted=new Map(data.nativePackets.map(p=>[p.id,p])),found=new Set<string>();
 for(let i=0;i<chunks.length;i++){
  const item=own(chunks,String(i)),id=own(item,'id');if(typeof id!=='string')return null;const expected=wanted.get(id);if(!expected)continue;
  if(found.has(id)||!item||typeof item!=='object')return null;found.add(id);
  const packet=own(item,'packet'),meshes=own(packet,'meshes');if(!packet||typeof packet!=='object'||!list(meshes)||meshes.length!==expected.meshCount||own(packet,'schemaVersion')!==expected.schemaVersion||own(packet,'id')!==expected.packetId||!ownEqual(own(packet,'origin'),expected.origin))return null;
  const pins=pin(packet);if(!pins)return null;packetPins.push(...pins);packetRows.push({index:i,row:item,packet});
  if((yield*hash(JSON.stringify(own(packet,'nav'))))!==expected.navControl||(expected.lineControl===null?own(packet,'lines')!==undefined:(yield*hash(JSON.stringify(own(packet,'lines'))))!==expected.lineControl))return null;
  for(let m=0;m<meshes.length;m++){
   const part=own(meshes,String(m)),control=expected.meshes[m];
   if(!part||typeof part!=='object'||own(part,'kind')!==control.kind||own(part,'positionType')!==control.positionType||(own(part,'colorType')??null)!==control.colorType)return null;
   for(const [field,bytes]of[['positions',control.positionBytes],['colors',control.colorBytes],['indices',control.indexBytes]]as const){const s=own(part,field);if(typeof s!=='string'||s.length/4*3-(s.endsWith('==')?2:s.endsWith('=')?1:0)!==bytes)return null;}
   if((yield*surroundingPacketFingerprint(part as{positions:string;colors:string;indices:string}))!==control.fingerprint)return null;
  }
 }
 if(found.size!==data.nativePackets.length)return null;
 const byZ=new Map<number,typeof spec.cells>();for(const c of spec.cells){const a=byZ.get(c.z)??[];a.push(c);byZ.set(c.z,a);}
 const lists:ListPin[]=[];
 for(const[z,cells]of byZ){
  const index=z-spec.grid.min_z_idx,row=own(rows,String(index));if(!list(row))return null;
  const selected=new Set(cells.map(c=>c.x)),actual=new Map<number,number[][]>(),items:ListPin['rows']=[];
  for(let i=0;i<row.length;i++){
   const run=own(row,String(i));if(!list(run)||run.length!==5)return null;
   const words=Array.from({length:5},(_,j)=>own(run,String(j)));if(!words.every(n=>typeof n==='number'&&Number.isInteger(n))||Number(words[1])<=0)return null;
   const w=words as number[],x0=spec.grid.min_x_idx+w[0],x1=x0+w[1];let touches=false;
   for(const x of selected)if(x>=x0&&x<x1){const a=actual.get(x)??[];a.push([x,z,w[2],w[3],w[4]]);actual.set(x,a);touches=true;}
   items.push({weak:new WeakRef(run),index:i,x:w[0],length:w[1],...(touches?{words:w}:{} )});
  }
  for(const c of cells)if(!ownEqual(actual.get(c.x)??[],c.intervals))return null;
  lists.push({weak:new WeakRef(row),index,length:row.length,rows:items});yield;
 }
 const chunksWeak=new WeakRef(chunks),rowsWeak=new WeakRef(rows),coreWeak=new WeakRef(core),voxelWeak=new WeakRef(voxels),chunksLength=chunks.length,rowsLength=rows.length;
 const links=[weakField(core,'minecraftChunks',chunks),weakField(voxels,'building_rows',rows),weakField(voxels,'grid',grid as object),weakField(voxels,'classes',classes as object)];
 return makeNativeProof({chunksWeak,rowsWeak,coreWeak,voxelWeak,chunksLength,rowsLength,links,gridPins,classPins,packetPins,packetRows,lists,cellM:spec.cellM,schemaVersion:spec.schemaVersion});
}
type NativeProofState={chunksWeak:WeakRef<unknown[]>;rowsWeak:WeakRef<unknown[]>;coreWeak:WeakRef<object>;voxelWeak:WeakRef<object>;chunksLength:number;rowsLength:number;links:Array<()=>boolean>;gridPins:Pin[];classPins:Pin[];packetPins:Pin[];packetRows:{index:number;row:object;packet:object}[];lists:ListPin[];cellM:number;schemaVersion:number};
function makeNativeProof(state:NativeProofState):()=>boolean{
 const{chunksWeak,rowsWeak,coreWeak,voxelWeak,chunksLength,rowsLength,links,gridPins,classPins,packetPins,packetRows,lists,cellM,schemaVersion}=state;
 return()=>{
  const cs=chunksWeak.deref(),rs=rowsWeak.deref(),v=voxelWeak.deref();if(!cs||!rs||!coreWeak.deref()||!v||cs.length!==chunksLength||rs.length!==rowsLength||!links.every(p=>p())||!samePins(gridPins)||!samePins(classPins)||own(v,'cell_m')!==cellM||own(v,'schema_version')!==schemaVersion||!samePins(packetPins))return false;
  if(!packetRows.every(p=>own(cs,String(p.index))===p.row&&own(p.row,'packet')===p.packet))return false;
  return lists.every(p=>{const row=p.weak.deref();return !!row&&own(rs,String(p.index))===row&&row.length===p.length&&p.rows.every(r=>{const run=r.weak.deref();if(!run||own(row,String(r.index))!==run||run.length!==5||own(run,'0')!==r.x||own(run,'1')!==r.length)return false;return !r.words||r.words.every((n,i)=>Object.is(own(run,String(i)),n));});});
 };
}
/** Complete current input only. Selected rows stay small/strong; full source
 * containers and RLE lists are weakly referenced, never cloned or retained. */
export function* bindWilhelmHousingSourcesV324Steps(sourcePrisms:readonly unknown[]|undefined,nativeSource?:unknown,native=false):Generator<void,WilhelmHousingSourcesV324Receipt|null>{
 try{
  if(!trusted){if((yield*hash(JSON.stringify(data)))!==CONTROL)return null;freeze(data);trusted=true;}
  if(!list(sourcePrisms))return null;
  const expected=[...data.prisms,...(native?data.contributorPrisms:[])],byId=new Map(expected.map(p=>[p.id,p])),found=new Set<string>(),selected:{index:number;row:object;pins:Pin[]}[]=[];
  for(let i=0;i<sourcePrisms.length;i++){
   const row=own(sourcePrisms,String(i)),id=own(row,'id');if(typeof id!=='string')return null;
   const match=byId.get(id);if(match){if(found.has(id)||!ownEqual(row,match)||!row||typeof row!=='object')return null;const pins=pin(row);if(!pins)return null;selected.push({index:i,row,pins});found.add(id);}
   if(i%1024===1023)yield;
  }
  if(found.size!==expected.length)return null;
  const extra=native?yield*nativeProof(nativeSource):alwaysTrue;if(!extra)return null;
  const proof=makePrismProof(new WeakRef(sourcePrisms),sourcePrisms.length,selected,extra);
  if(!proof())return null;const receipt={source:true}as const;receipts.set(receipt,{native,proof});return receipt;
 }catch{return null;}
}
function makePrismProof(weak:WeakRef<unknown[]>,length:number,selected:{index:number;row:object;pins:Pin[]}[],extra:()=>boolean):()=>boolean{
 return()=>{const source=weak.deref();return !!source&&source.length===length&&selected.every(p=>own(source,String(p.index))===p.row&&samePins(p.pins))&&extra();};
}
export function hasWilhelmHousingSourcesV324(receipt:unknown,native?:boolean):receipt is WilhelmHousingSourcesV324Receipt{const p=receipt&&typeof receipt==='object'?receipts.get(receipt as WilhelmHousingSourcesV324Receipt):undefined;return !!p&&(native===undefined||native===p.native)&&p.proof();}
export const bindWilhelmHousingV324SourcesSteps=bindWilhelmHousingSourcesV324Steps;
export const hasWilhelmHousingV324Sources=hasWilhelmHousingSourcesV324;
