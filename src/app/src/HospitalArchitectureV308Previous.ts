/** Exact delivered v228 batches and only v214's corrected six-storey wall rows. */
import {BufferAttribute,BufferGeometry,Group,InstancedMesh,InterleavedBufferAttribute,Mesh,Object3D} from "three";
import type {Material} from "three";
import {staticStorageInfo} from "./losslessStaticStorage";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
import {isSceneInstanceGpuRetirementV309} from "./sceneGpuResidency";
import {hasMinecraftMaterialProvenance} from "./visual-modes/minecraft/materialMode";
import rawReceipt from "./data/hospitalArchitectureV308Previous.json";
import {hasCompleteHospitalArchitectureV308} from "./HospitalArchitectureV308";
import {hasSchwellenraumMaterialProvenance,schwellenraumMaterialFor} from "./visual-modes/schwellenraum/materialGrade";
type Pin={name:string;attributes:Record<string,{count:number;itemSize:number;normalized:boolean;bytes:number}>;
 index:{count:number;bytes:number}|null;instanceCount:number|null;matrix:number|null;color:number|null};
type Plan={native:boolean;children:Pin[];bundeswehr:Pin&{rows:{index:number;matrix:number[]}[]}};
const receipt=rawReceipt as unknown as {schemaVersion:number;batches:Plan[]};
type State={replacement:Group;family:Object3D;children:{mesh:Mesh;parent:Object3D|null}[];
  ward:InstancedMesh;parent:Object3D|null;before:Float32Array[];hidden:Float32Array[];
  rows:number[];maskedHash:number;invalid:boolean;invalidResources:Set<object>;hooks:(()=>void)[];pins:LivePin[];lineage:Pose[];wardLineage:Pose[];outlineHost:Object3D|null};
type Vertex=BufferAttribute|InterleavedBufferAttribute;
type AttributePin={attribute:Vertex;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;size:number;normalized:boolean;stride:number;offset:number};
type LivePin={mesh:Mesh;geometry:BufferGeometry;attributes:Map<string,AttributePin>;index:AttributePin|null;matrix:AttributePin|null;color:AttributePin|null;count:number|null;day:Material;night:Material;grade:Material;pose:Pose;drawStart:number;drawCount:number};
type Pose={object:Object3D;parent:Object3D|null;matrix:number[];position:number[];quaternion:number[];scale:number[];auto:boolean;worldAuto:boolean};
const storage=(a:Vertex)=>a instanceof InterleavedBufferAttribute?a.data:a;
const pinAttribute=(a:Vertex):AttributePin=>({attribute:a,storage:staticStorageInfo(storage(a)),version:storage(a).version,count:a.count,size:a.itemSize,normalized:a.normalized,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,offset:a instanceof InterleavedBufferAttribute?a.offset:0});
const pinPose=(object:Object3D):Pose=>({object,parent:object.parent,matrix:object.matrix.elements.slice(),position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),auto:object.matrixAutoUpdate,worldAuto:object.matrixWorldAutoUpdate});
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const belongs=(object:Object3D,root:Object3D)=>{for(let parent:Object3D|null=object;parent;parent=parent.parent)if(parent===root)return true;return false;};
function poseMatches(p:Pose){const o=p.object;return o.parent===p.parent&&same(o.matrix.elements,p.matrix)&&same(o.position.toArray(),p.position)&&same(o.quaternion.toArray(),p.quaternion)&&same(o.scale.toArray(),p.scale)&&o.matrixAutoUpdate===p.auto&&o.matrixWorldAutoUpdate===p.worldAuto;}
function attributeMatches(a:Vertex|null|undefined,p:AttributePin):boolean{
 if(!a||a!==p.attribute||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset)return false;
 const q=staticStorageInfo(storage(a));return q.arrayIdentity===p.storage.arrayIdentity&&q.bufferIdentity===p.storage.bufferIdentity&&q.byteLength===p.storage.byteLength&&q.bufferBytes===p.storage.bufferBytes;
}
function livePin(mesh:Mesh):LivePin {return{mesh,geometry:mesh.geometry,attributes:new Map(Object.entries(mesh.geometry.attributes).map(([key,a])=>[key,pinAttribute(a)])),index:mesh.geometry.index?pinAttribute(mesh.geometry.index):null,matrix:mesh instanceof InstancedMesh?pinAttribute(mesh.instanceMatrix):null,color:mesh instanceof InstancedMesh&&mesh.instanceColor?pinAttribute(mesh.instanceColor):null,count:mesh instanceof InstancedMesh?mesh.count:null,day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:grades.get(mesh)!,pose:pinPose(mesh),drawStart:mesh.geometry.drawRange.start,drawCount:mesh.geometry.drawRange.count};}
function liveMatches(p:LivePin):boolean {
 const m=p.mesh,g=m.geometry;
 return g===p.geometry&&poseMatches(p.pose)&&g.drawRange.start===p.drawStart&&g.drawRange.count===p.drawCount&&Object.keys(g.attributes).length===p.attributes.size&&[...p.attributes].every(([k,a])=>attributeMatches(g.getAttribute(k),a))&&(p.index?attributeMatches(g.index,p.index):!g.index)&&
 (p.matrix?m instanceof InstancedMesh&&m.count===p.count&&attributeMatches(m.instanceMatrix,p.matrix)&&(p.color?attributeMatches(m.instanceColor,p.color):!m.instanceColor):!(m instanceof InstancedMesh))&&m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&hasSchwellenraumMaterialProvenance(m,p.day,p.grade)&&(m.material===p.day||m.material===p.night||m.material===p.grade||hasMinecraftMaterialProvenance(m,p.day,m.material)||hasMinecraftMaterialProvenance(m,p.night,m.material)||hasMinecraftMaterialProvenance(m,p.grade,m.material));
}
function observe(state:State,resource:BufferGeometry|InstancedMesh|Material){
 const invalid=()=>{if(resource instanceof BufferGeometry&&isSceneGeometryGpuRetirementV309(resource))return;if(resource instanceof InstancedMesh&&isSceneInstanceGpuRetirementV309(resource))return;authoredDisposed.add(resource);state.invalid=true;state.invalidResources.add(resource);};
 const event=resource as unknown as{addEventListener(type:"dispose",listener:()=>void):void;removeEventListener(type:"dispose",listener:()=>void):void};event.addEventListener("dispose",invalid);state.hooks.push(()=>event.removeEventListener("dispose",invalid));
}
const authoredDisposed=new WeakSet<object>();
const states=new WeakMap<Object3D,Map<boolean,State>>();
const grades=new WeakMap<Mesh,Material>();
function bytes(a:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
/** Exact component word bytes in original vertex order. Legal interleaving
 * changes the backing stride, never the canonical attribute byte stream. */
function attributeBytes(a:BufferAttribute|InterleavedBufferAttribute){
 const array=a instanceof InterleavedBufferAttribute?a.data.array:a.array,
  stride=a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,
  offset=a instanceof InterleavedBufferAttribute?a.offset:0,
  width=array.BYTES_PER_ELEMENT,view=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
 let h=2166136261;
 for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++){
  const at=(i*stride+offset+j)*width;
  for(let b=0;b<width;b++)h=Math.imul(h^view[at+b],16777619)>>>0;
 }
 return h;
}
function equal(a:ArrayLike<number>,offset:number,b:Float32Array){return b.every((v,i)=>a[offset+i]===v);}
function matches(mesh:Mesh,pin:Pin,matrixHash=pin.matrix){
 const g=mesh.geometry,cached=mesh.userData.schwellenraumMaterial,
  grade=grades.get(mesh)??(hasSchwellenraumMaterialProvenance(mesh,mesh.userData.dayMaterial,cached)?cached:undefined);
 if(authoredDisposed.has(g)||authoredDisposed.has(mesh)||authoredDisposed.has(mesh.userData.dayMaterial)||authoredDisposed.has(mesh.userData.nightMaterial)||grade&&authoredDisposed.has(grade))return false;
 if(Object.keys(g.attributes).length!==Object.keys(pin.attributes).length||g.drawRange.start!==0||
   g.drawRange.count!==Infinity&&g.drawRange.count!==(g.index?.count??g.getAttribute("position").count))return false;
 for(const[k,p]of Object.entries(pin.attributes)){
  const a=g.getAttribute(k);if(!a||a.count!==p.count||a.itemSize!==p.itemSize||a.normalized!==p.normalized||attributeBytes(a)!==p.bytes)return false;
 }
 if(pin.index?(!g.index||g.index.count!==pin.index.count||bytes(g.index.array)!==pin.index.bytes):!!g.index)return false;
 if(pin.instanceCount?(!(mesh instanceof InstancedMesh)||mesh.count!==pin.instanceCount||bytes(mesh.instanceMatrix.array)!==matrixHash||
   (pin.color===null?!!mesh.instanceColor:!mesh.instanceColor||bytes(mesh.instanceColor.array)!==pin.color)):mesh instanceof InstancedMesh)return false;
 if(grade?mesh.userData.schwellenraumMaterial!==grade:mesh.userData.schwellenraumMaterial!==undefined)return false;
 if(grade&&!hasSchwellenraumMaterialProvenance(mesh,mesh.userData.dayMaterial,grade))return false;
 return mesh.material===mesh.userData.dayMaterial||mesh.material===mesh.userData.nightMaterial||mesh.material===grade||hasMinecraftMaterialProvenance(mesh,mesh.userData.dayMaterial,mesh.material)||hasMinecraftMaterialProvenance(mesh,mesh.userData.nightMaterial,mesh.material)||!!grade&&hasMinecraftMaterialProvenance(mesh,grade,mesh.material);
}
function restore(state:State){
 for(const release of state.hooks)release();state.hooks=[];
 for(const {mesh,parent}of state.children)if(mesh.parent===parent&&!mesh.visible)mesh.visible=true;
 if(state.ward.parent!==state.parent)return;
 const matrix=state.ward.instanceMatrix;
 if(state.rows.some((row,i)=>!equal(matrix.array,row*16,state.hidden[i])))return;
 matrix.needsUpdate=true;
 state.rows.forEach((row,i)=>(matrix.array as Float32Array).set(state.before[i],row*16));
 matrix.needsUpdate=true;
}
/** Closed by default. Every original row returns on missing, damaged or evicted
 * replacement; foreign pavilions, pad markings and helicopter remain unchanged. */
export function applyHospitalPreviousV308(root:Object3D,native=false,enabled=false,replacement?:Group,sourceFamilyRoot:Object3D=root):boolean{
 const map=states.get(root),before=map?.get(native),plan=receipt.batches.find(p=>p.native===native);
 const admitted=enabled&&belongs(sourceFamilyRoot,root)&&!!replacement?.parent&&replacement.visible&&hasCompleteHospitalArchitectureV308(replacement,native)&&receipt.schemaVersion===1&&!!plan;
 let rebindHost:Object3D|undefined;
 if(before){
  const sameFacades=admitted&&before.replacement===replacement&&before.family===sourceFamilyRoot&&before.children.every(({mesh,parent})=>mesh.parent===parent&&!mesh.visible)&&before.lineage.every(poseMatches)&&before.pins.filter(p=>p.mesh!==before.ward).every(liveMatches);
  if(sameFacades&&before.ward.parent===before.parent&&!before.invalid&&before.wardLineage.every(poseMatches)&&before.pins.every(liveMatches))return true;
  // The shared outline constructor replaces its whole mode family. Cached
  // facades remain in their original world, while the old ward is detached
  // and disposed. Re-admit a fresh ward only under the exact retained host;
  // attached manual disposal and any damaged facade still close the gate.
  const oldWard=before.pins.find(p=>p.mesh===before.ward),allowed=oldWard&&new Set<object>([before.ward,oldWard.geometry,oldWard.day,oldWard.night,oldWard.grade]);
  const host=before.outlineHost,hostPose=before.wardLineage.find(p=>p.object===host);
  if(sameFacades&&!belongs(before.ward,root)&&before.ward.parent===before.parent&&host&&hostPose&&poseMatches(hostPose)&&belongs(host,root)&&allowed&&[...before.invalidResources].every(resource=>allowed.has(resource)))rebindHost=host;
  restore(before);map!.delete(native);if(!rebindHost)return false;
 }
 if(!admitted)return false;
 const selected:Mesh[]=[],wards:InstancedMesh[]=[];
 root.traverse(o=>{
  if(o instanceof Mesh&&belongs(o,sourceFamilyRoot)&&plan!.children.some(p=>p.name===o.name))selected.push(o);
  if(o instanceof InstancedMesh&&o.name===plan!.bundeswehr.name)wards.push(o);
 });
 if(selected.length!==plan!.children.length||wards.length!==1)return false;
 const children=plan!.children.map(pin=>selected.filter(m=>m.name===pin.name));
 if(children.some(list=>list.length!==1))return false;
 const ward=wards[0];
 if(rebindHost&&ward.parent?.parent!==rebindHost)return false;
 if(!ward.visible||!matches(ward,plan!.bundeswehr)||children.some((list,i)=>!list[0].visible||!matches(list[0],plan!.children[i])))return false;
 const rows=plan!.bundeswehr.rows.map(r=>r.index),original=plan!.bundeswehr.rows.map(r=>new Float32Array(r.matrix));
 if(rows.some((r,i)=>!equal(ward.instanceMatrix.array,r*16,original[i])))return false;
 const hidden=original.map(r=>{const copy=r.slice();copy.fill(0,0,12);return copy;});
 for(const mesh of [...selected,ward])if(!grades.has(mesh))grades.set(mesh,schwellenraumMaterialFor(mesh,mesh.userData.dayMaterial));
 // Mark mutable before writing so legal GPU parking cannot detach these rows.
 ward.instanceMatrix.needsUpdate=true;
 rows.forEach((r,i)=>(ward.instanceMatrix.array as Float32Array).set(hidden[i],r*16));
 ward.instanceMatrix.needsUpdate=true;
 for(const mesh of selected)mesh.visible=false;
 const state:State={replacement:replacement!,family:sourceFamilyRoot,children:selected.map(mesh=>({mesh,parent:mesh.parent})),
  ward,parent:ward.parent,before:original,hidden,rows,maskedHash:bytes(ward.instanceMatrix.array),invalid:false,invalidResources:new Set(),hooks:[],pins:[...selected,ward].map(livePin),lineage:[],wardLineage:[],outlineHost:ward.parent?.parent??null};
 const ancestors=new Set<Object3D>();for(const mesh of selected)for(let parent=mesh.parent;parent;parent=parent.parent)ancestors.add(parent);state.lineage=[...ancestors].map(pinPose);
 const wardAncestors=new Set<Object3D>();for(let parent=ward.parent;parent;parent=parent.parent)wardAncestors.add(parent);state.wardLineage=[...wardAncestors].map(pinPose);
 const resources=new Set<BufferGeometry|InstancedMesh|Material>();for(const p of state.pins){resources.add(p.geometry);if(p.mesh instanceof InstancedMesh)resources.add(p.mesh);resources.add(p.day);resources.add(p.night);resources.add(p.grade);}for(const resource of resources)observe(state,resource);
 const next=map??new Map<boolean,State>();next.set(native,state);states.set(root,next);
 return true;
}
