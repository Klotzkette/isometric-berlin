/** Reversible, source-bound placement of retained global trees and park paths. */
import {Box3,BufferAttribute,BufferGeometry,InstancedBufferAttribute,InstancedMesh,InterleavedBuffer,InterleavedBufferAttribute,Mesh,Object3D,Sphere,Vector3} from "three";
import source from "./data/northTerrainPropsV309.json";
import {staticStorageInfo} from "./losslessStaticStorage";
import {releaseScratchBuffer} from "./releaseScratchBuffer";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
type Attribute=BufferAttribute|InterleavedBufferAttribute;
type Storage=BufferAttribute|InterleavedBuffer;
type Ground=(x:number,z:number,native:boolean)=>number|null;
export type NorthTerrainDrapingV309Options={enabled?:boolean;native?:boolean;
 parkOffsetAt?:(x:number,z:number,native:boolean)=>number;
 railGroundAt?:Ground;oldGroundAt?:Ground};
type AttributePin={attribute:Attribute;count:number;size:number;normalized:boolean;hash:number;storage:Storage;version:number;info:ReturnType<typeof staticStorageInfo>};
type Change={at:number;before:number;after:number};
type Entry={mesh:Mesh;parent:Object3D|null;geometry:BufferGeometry;attribute:Attribute;
 storage:Storage;version:number;info:ReturnType<typeof staticStorageInfo>;hash:number;
 attributes:Map<string,AttributePin>;index:BufferAttribute|null;indexHash:number|null;indexPin:AttributePin|null;colorPin:AttributePin|null;
 count:number|null;colors:BufferAttribute|null;colorHash:number|null;changes:Change[];disposed:boolean;onDispose:()=>void;pose:number[];
 afterHash:number;afterAttributes:Map<string,number>;afterBox:Box3|null;afterSphere:Sphere|null;lineage:{object:Object3D;parent:Object3D|null}[]};
type State={parent:Object3D|null;options:NorthTerrainDrapingV309Options;entries:Entry[];candidates:Mesh[]};
export type NorthTerrainDrapingV309Transaction={commit(gate?:boolean|(()=>boolean)):number;rollback():number;complete():boolean;adoptParent(parent:Object3D):boolean};
const states=new WeakMap<Object3D,State>();
const banks=source.rows as Record<string,Record<string,number[]>>;
const store=(a:Attribute):Storage=>a instanceof InterleavedBufferAttribute?a.data:a;
const values=(a:Attribute)=>store(a).array;
const stride=(a:Attribute)=>a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize;
const start=(a:Attribute)=>a instanceof InterleavedBufferAttribute?a.offset:0;
function bytes(array:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
function componentHash(a:Attribute,override?:BufferAttribute["array"]){const array=override??values(a),width=array.BYTES_PER_ELEMENT,view=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=2166136261;for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++){const at=(i*stride(a)+start(a)+j)*width;for(let b=0;b<width;b++)h=Math.imul(h^view[at+b],16777619)>>>0;}return h;}
function attributePin(a:Attribute):AttributePin{const storage=store(a);return{attribute:a,count:a.count,size:a.itemSize,normalized:a.normalized,hash:componentHash(a),storage,version:storage.version,info:staticStorageInfo(storage)};}
function sameInfo(a:ReturnType<typeof staticStorageInfo>,b:ReturnType<typeof staticStorageInfo>){return a.arrayIdentity===b.arrayIdentity&&a.bufferIdentity===b.bufferIdentity&&a.byteLength===b.byteLength&&a.bufferBytes===b.bufferBytes;}
function sameAttribute(a:Attribute|null|undefined,p:AttributePin){return a===p.attribute&&a.count===p.count&&a.itemSize===p.size&&a.normalized===p.normalized&&store(a)===p.storage&&p.storage.version===p.version&&sameInfo(staticStorageInfo(p.storage),p.info);}
function rowKey(array:ArrayLike<number>,offset:number){const row=new Float32Array(16);for(let j=0;j<16;j++)row[j]=array[offset+j];let a=2166136261,b=0x9e3779b9;for(const byte of new Uint8Array(row.buffer)){a=Math.imul(a^byte,16777619)>>>0;b=Math.imul(b^byte,2246822519)>>>0;}return `${a}:${b}`;}
function baseName(mesh:Mesh){return mesh.name.replace(/ \[cell -?\d+,-?\d+\]$/u,"");}
function parkAncestor(mesh:Mesh,root:Object3D){for(let p=mesh.parent;p;p=p.parent){if(p.name==="Additive open-data park and civic surface details")return true;if(p===root)break;}return false;}
function eligible(mesh:Mesh,root:Object3D){const name=baseName(mesh);return mesh instanceof InstancedMesh?(!!banks[name]&&(name.startsWith("Voxel tree ")||parkAncestor(mesh,root))):parkAncestor(mesh,root)&&/^Berlin park .+ batched path ribbons$/u.test(name);}
function localPose(mesh:Object3D){return[...mesh.position.toArray(),...mesh.quaternion.toArray(),...mesh.scale.toArray(),...mesh.matrix.elements,...mesh.matrixWorld.elements,Number(mesh.matrixAutoUpdate),Number(mesh.matrixWorldAutoUpdate)];}
function axisTranslation(mesh:Mesh):number[]|null{
 const a=mesh.matrixWorld.elements;
 if([0,5,10,15].some(i=>a[i]!==1)||[1,2,3,4,6,7,8,9,11].some(i=>a[i]!==0))return null;
 return [a[12],a[13],a[14]];
}
function changeAt(x:number,z:number,oldY:number,options:NorthTerrainDrapingV309Options,anchor=false):number|null{
 const native=options.native===true,old=options.oldGroundAt!(x,z,native),rail=options.railGroundAt!(x,z,native),park=options.parkOffsetAt!(x,z,native);
 if(old===null||!Number.isFinite(old)||!Number.isFinite(park)||rail!==null&&!Number.isFinite(rail))return null;
 if(rail===null&&park===0)return null;
 // Exact catalogue trees are planted by their real original source base, even
 // if an older source base was wrong. Path clearances stay unchanged; bridges
 // and high mounted paths must never be pulled down to an unrelated floor.
 if(!anchor&&Math.abs(oldY-old)>1.25)return null;
 const target=rail===null?old+park:rail,delta=target-(anchor?oldY:old);
 return Number.isFinite(delta)&&Math.abs(delta)<120&&Math.abs(delta)>1e-7?delta:null;
}
function capture(mesh:Mesh,attribute:Attribute,changes:Change[]):Entry{
 const lineage:{object:Object3D;parent:Object3D|null}[]=[];for(let object:Object3D|null=mesh;object;object=object.parent)lineage.push({object,parent:object.parent});
 const storage=store(attribute),entry:Entry={mesh,parent:mesh.parent,geometry:mesh.geometry,attribute,storage,
 version:storage.version,info:staticStorageInfo(storage),hash:bytes(storage.array),
 attributes:new Map(Object.entries(mesh.geometry.attributes).map(([key,a])=>[key,attributePin(a)])),
 index:mesh.geometry.index,indexHash:mesh.geometry.index?bytes(mesh.geometry.index.array):null,indexPin:mesh.geometry.index?attributePin(mesh.geometry.index):null,
 count:mesh instanceof InstancedMesh?mesh.count:null,colors:mesh instanceof InstancedMesh?mesh.instanceColor:null,
 colorHash:mesh instanceof InstancedMesh&&mesh.instanceColor?bytes(mesh.instanceColor.array):null,colorPin:mesh instanceof InstancedMesh&&mesh.instanceColor?attributePin(mesh.instanceColor):null,changes,disposed:false,onDispose:()=>{},pose:localPose(mesh),afterHash:0,afterAttributes:new Map(),afterBox:null,afterSphere:null,lineage};
 entry.onDispose=()=>{if(!isSceneGeometryGpuRetirementV309(entry.geometry))entry.disposed=true;};mesh.geometry.addEventListener("dispose",entry.onDispose);
 return entry;
}
function metadataCheck(e:Entry,adoption?:{root:Object3D;parent:Object3D}){
 e.mesh.updateWorldMatrix(true,false);
 if(localPose(e.mesh).some((v,i)=>!Object.is(v,e.pose[i])))return false;
 if(e.lineage.some(r=>r.object.parent!==r.parent&&!(adoption&&r.object===adoption.root&&r.parent===null&&r.object.parent===adoption.parent)))return false;
 if(e.disposed||e.mesh.parent!==e.parent||e.mesh.geometry!==e.geometry||store(e.attribute)!==e.storage||e.storage.version!==e.version)return false;
 const info=staticStorageInfo(e.storage);
 if(info.arrayIdentity!==e.info.arrayIdentity||info.bufferIdentity!==e.info.bufferIdentity||info.byteLength!==e.info.byteLength||info.bufferBytes!==e.info.bufferBytes)return false;
 if(Object.keys(e.geometry.attributes).length!==e.attributes.size||e.geometry.index!==e.index||e.indexPin&&!sameAttribute(e.geometry.index,e.indexPin))return false;
 for(const[key,p]of e.attributes)if(!sameAttribute(e.geometry.getAttribute(key),p))return false;
 return e.count===null||e.mesh instanceof InstancedMesh&&e.mesh.count===e.count&&e.mesh.instanceColor===e.colors&&(!e.colorPin||sameAttribute(e.mesh.instanceColor,e.colorPin));
}
function metadataIntact(e:Entry){return metadataCheck(e);}
function intact(e:Entry){
 return metadataIntact(e)&&bytes(e.storage.array)===e.hash&&(!e.index||bytes(e.index.array)===e.indexHash)&&
  (!e.colors||bytes(e.colors.array)===e.colorHash)&&[...e.attributes.values()].every(p=>componentHash(p.attribute)===p.hash);
}
function refresh(e:Entry){
 e.version=e.storage.version;e.info=staticStorageInfo(e.storage);e.hash=bytes(e.storage.array);
 for(const p of e.attributes.values()){p.hash=componentHash(p.attribute);p.version=p.storage.version;p.info=staticStorageInfo(p.storage);}
 if(e.mesh instanceof InstancedMesh){e.mesh.computeBoundingBox();e.mesh.computeBoundingSphere();}
 else{e.geometry.computeBoundingBox();e.geometry.computeBoundingSphere();}
}
function* stageEntrySteps(e:Entry):Generator<void>{
 const array=e.storage.array.slice();
 try{
  for(const c of e.changes)array[c.at]=c.after;
  e.afterHash=bytes(array);yield;
  for(const[key,p]of e.attributes){e.afterAttributes.set(key,p.storage===e.storage?componentHash(p.attribute,array):p.hash);yield;}
  if(e.mesh instanceof InstancedMesh){
   const scratch=new InstancedMesh(e.geometry,e.mesh.material,0);scratch.count=e.mesh.count;
   scratch.instanceMatrix=new InstancedBufferAttribute(array,16);
   try{scratch.computeBoundingBox();yield;scratch.computeBoundingSphere();
    e.afterBox=scratch.boundingBox?.clone()??null;e.afterSphere=scratch.boundingSphere?.clone()??null;
   }finally{scratch.dispose();}
  }else{
   const p=e.attribute,s=stride(p),offset=start(p),bound=new Box3(),point=new Vector3();
   for(let i=0;i<p.count;i++){const at=i*s+offset;point.set(array[at],array[at+1],array[at+2]);bound.expandByPoint(point);if(i%4096===4095)yield;}
   const centre=bound.getCenter(new Vector3());let radius=0;
   for(let i=0;i<p.count;i++){const at=i*s+offset;point.set(array[at],array[at+1],array[at+2]);radius=Math.max(radius,centre.distanceToSquared(point));if(i%4096===4095)yield;}
   e.afterBox=bound;e.afterSphere=new Sphere(centre,Math.sqrt(radius));
  }
 }finally{releaseScratchBuffer(array.buffer as ArrayBuffer);}
}
/** All numeric audits and culling-bound work completed during stage. The live
 * publisher writes only owned Y slots and refreshes scalar metadata. */
function finishApplied(e:Entry):void{
 e.version=e.storage.version;e.info=staticStorageInfo(e.storage);e.hash=e.afterHash;
 for(const[key,p]of e.attributes){p.hash=e.afterAttributes.get(key)!;p.version=p.storage.version;p.info=staticStorageInfo(p.storage);}
 if(e.mesh instanceof InstancedMesh){e.mesh.boundingBox=e.afterBox;e.mesh.boundingSphere=e.afterSphere;}
 else{e.geometry.boundingBox=e.afterBox;e.geometry.boundingSphere=e.afterSphere;}
}
/** Restore only privately owned exact Y slots; never overwrite a foreign row. */
export function restoreNorthTerrainDrapingV309(root:Object3D):number{
 const state=states.get(root);if(!state)return 0;let count=0;
 for(const e of state.entries){
  e.geometry.removeEventListener("dispose",e.onDispose);
  if(!intact(e))continue;
  e.storage.needsUpdate=true;const array=e.storage.array;
  for(const c of e.changes){array[c.at]=c.before;count++;}
  e.storage.needsUpdate=true;refresh(e);
 }
 states.delete(root);return count;
}
function closedTransaction():NorthTerrainDrapingV309Transaction{return{commit:()=>0,rollback:()=>0,complete:()=>false,adoptParent:()=>false};}
function sameCandidates(root:Object3D,expected:Mesh[]){const current:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh&&eligible(o,root))current.push(o);});return current.length===expected.length&&current.every((m,i)=>m===expected[i]);}
function transaction(root:Object3D,options:NorthTerrainDrapingV309Options,entries:Entry[],candidates:Mesh[]):NorthTerrainDrapingV309Transaction{
 let parent=root.parent;const detached=parent===null,rootPose=localPose(root);let applied:State|undefined,closed=false,adopted=false;
 return {
  adoptParent(next){
   if(closed||applied||adopted||!detached||parent!==null||root.parent!==next)return false;
   root.updateWorldMatrix(true,true);
   if(localPose(root).some((v,i)=>!Object.is(v,rootPose[i]))||!sameCandidates(root,candidates)||
     !entries.every(e=>metadataCheck(e,{root,parent:next})))return false;
   for(const e of entries){const link=e.lineage.find(r=>r.object===root);if(!link||link.parent!==null)return false;}
   for(const e of entries){e.lineage.find(r=>r.object===root)!.parent=next;for(let object:Object3D|null=next;object;object=object.parent)e.lineage.push({object,parent:object.parent});}
   parent=next;adopted=true;return true;
  },
  commit(gate=false){
   if(closed||applied)return 0;
   const ready=typeof gate==="function"?gate():gate;
   if(!ready||root.parent!==parent||states.has(root)||!sameCandidates(root,candidates)||!entries.every(metadataIntact))return 0;
   let count=0;for(const e of entries){e.storage.needsUpdate=true;const array=e.storage.array;for(const c of e.changes){array[c.at]=c.after;count++;}e.storage.needsUpdate=true;finishApplied(e);}
   applied={parent,options:{...options},entries,candidates};states.set(root,applied);return count;
  },
  rollback(){
   if(closed)return 0;closed=true;
   if(applied&&states.get(root)===applied)return restoreNorthTerrainDrapingV309(root);
   for(const e of entries)e.geometry.removeEventListener("dispose",e.onDispose);
   return 0;
  },
  complete(){return !closed&&!!applied&&states.get(root)===applied&&root.parent===parent&&entries.every(metadataIntact);},
 };
}
/** A complete external v309 gate is required. No public model flag is read.
 * Preparation can be cancelled before the first mutation; all batches commit
 * together only after every original attribute/lifetime guard still matches. */
export function* stageNorthTerrainDrapingV309Steps(root:Object3D,options:NorthTerrainDrapingV309Options={}):Generator<void,NorthTerrainDrapingV309Transaction>{
 const old=states.get(root),ready=options.enabled===true&&!!options.parkOffsetAt&&!!options.railGroundAt&&!!options.oldGroundAt&&source.schemaVersion===1;
 if(old||!ready)return closedTransaction();
 root.updateWorldMatrix(true,true);
 const candidates:Mesh[]=[],geometryOwners=new Map<BufferGeometry,number>();
 root.traverse(o=>{if(o instanceof Mesh){geometryOwners.set(o.geometry,(geometryOwners.get(o.geometry)??0)+1);if(eligible(o,root))candidates.push(o);}});
 const prepared:Entry[]=[];
 let delivered=false;
 try{
 for(const mesh of candidates){
  const pose=axisTranslation(mesh);if(!pose||mesh.animations.length||mesh.userData.animated===true)continue;
  const changes:Change[]=[];
  if(mesh instanceof InstancedMesh){
   const array=mesh.instanceMatrix.array,bank=banks[baseName(mesh)];
   for(let row=0;row<mesh.count;row++){
    const anchor=bank[rowKey(array,row*16)];
    if(anchor){const delta=changeAt(anchor[0]+pose[0],anchor[2]+pose[2],anchor[1]+pose[1],options,true);if(delta!==null){const at=row*16+13,before=array[at];changes.push({at,before,after:Math.fround(before+delta)});}}
    if(row%1024===1023)yield;
   }
   if(changes.length){const entry=capture(mesh,mesh.instanceMatrix,changes);prepared.push(entry);yield*stageEntrySteps(entry);}
  }else{
   const position=mesh.geometry.getAttribute("position");
   if(geometryOwners.get(mesh.geometry)!==1||!position||position.itemSize!==3||position.normalized||!(values(position)instanceof Float32Array))continue;
   const array=values(position),s=stride(position),offset=start(position);
   for(let row=0;row<position.count;row++){
    const at=row*s+offset,x=array[at]+pose[0],y=array[at+1]+pose[1],z=array[at+2]+pose[2],delta=changeAt(x,z,y,options);
    if(delta!==null)changes.push({at:at+1,before:array[at+1],after:Math.fround(array[at+1]+delta)});
    if(row%1024===1023)yield;
   }
   if(changes.length){const entry=capture(mesh,position,changes);prepared.push(entry);yield*stageEntrySteps(entry);}
  }
  yield;
 }
 if(!prepared.every(intact))return closedTransaction();
 const result=transaction(root,options,prepared,candidates);delivered=true;return result;
 }finally{
  if(!delivered)for(const e of prepared)e.geometry.removeEventListener("dispose",e.onDispose);
 }
}
/** Convenience for an unpublished deferred props root. Existing live trees
 * use stage... first and commit only in the one final bundle publisher. */
export function* prepareNorthTerrainDrapingV309Steps(root:Object3D,options:NorthTerrainDrapingV309Options={}):Generator<void,number>{
 const old=states.get(root);
 if(old){
  if(options.enabled===true&&old.parent===root.parent&&sameCandidates(root,old.candidates)&&old.options.native===options.native&&old.options.parkOffsetAt===options.parkOffsetAt&&old.options.railGroundAt===options.railGroundAt&&old.options.oldGroundAt===options.oldGroundAt&&old.entries.every(intact))return 0;
  restoreNorthTerrainDrapingV309(root);
 }
 const staged=yield*stageNorthTerrainDrapingV309Steps(root,options);
 const count=staged.commit(options.enabled===true);
 if(!staged.complete())staged.rollback();
 return count;
}
export function syncNorthTerrainDrapingV309(root:Object3D,options:NorthTerrainDrapingV309Options={}):number{
 const work=prepareNorthTerrainDrapingV309Steps(root,options);let step=work.next();while(!step.done)step=work.next();return step.value;
}
