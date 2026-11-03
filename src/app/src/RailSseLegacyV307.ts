import {isSceneInstanceGpuRetirementV309} from "./sceneGpuResidency";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
/** Full actual v190 station receipts, with live restoration on any revocation. */
import {BufferAttribute,Group,InstancedMesh,InterleavedBufferAttribute,Mesh,Object3D}from'three';
import type{Material}from'three';
import source from'./data/railSseLegacyV307.json';
import {hasCompleteRailSseArchitectureV307}from'./RailSseArchitectureV307';
import {hasCompleteRailTerrainContactV307,hasCompleteRailTerrainContactApproachV309}from'./RailTerrainContactV307';
import {hasMinecraftMaterialProvenance}from'./visual-modes/minecraft/materialMode';
import {staticStorageInfo}from'./losslessStaticStorage';
import {schwellenraumMaterialFor,hasSchwellenraumMaterialProvenance}from'./visual-modes/schwellenraum/materialGrade';
const bytes=(a:ArrayBufferView)=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
type Attribute=BufferAttribute|InterleavedBufferAttribute;
const backing=(a:Attribute)=>a instanceof InterleavedBufferAttribute?a.data:a;
/** Production mobile packing copies Float32 words verbatim. Hash only the
 * original logical stream, never the repeated interleaved backing buffer. */
function attributeBytes(a:Attribute):number|null{
 if(!(a instanceof InterleavedBufferAttribute))return bytes(a.array);
 const array=a.data.array;if(!(array instanceof Float32Array)||!Number.isSafeInteger(a.offset)||!Number.isSafeInteger(a.data.stride)||a.offset<0||a.data.stride<a.offset+a.itemSize||array.length!==a.count*a.data.stride)return null;
 const raw=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=2166136261;
 for(let v=0;v<a.count;v++)for(let c=0;c<a.itemSize;c++){const at=(v*a.data.stride+a.offset+c)*4;for(let b=0;b<4;b++)h=Math.imul(h^raw[at+b],16777619)>>>0;}return h;
}
type AttributePin={attribute:Attribute;data:ReturnType<typeof backing>;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;itemSize:number;normalized:boolean;stride:number;offset:number};
const pin=(a:Attribute):AttributePin=>({attribute:a,data:backing(a),storage:staticStorageInfo(backing(a)),version:backing(a).version,count:a.count,itemSize:a.itemSize,normalized:a.normalized,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,offset:a instanceof InterleavedBufferAttribute?a.offset:0});
function match(a:Attribute|null|undefined,p:AttributePin):boolean{if(!a||a!==p.attribute||backing(a)!==p.data||backing(a).version!==p.version||a.count!==p.count||a.itemSize!==p.itemSize||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?(a.offset!==p.offset||a.data.stride!==p.stride):p.offset!==0||p.stride!==a.itemSize))return false;const s=staticStorageInfo(backing(a));return s.arrayIdentity===p.storage.arrayIdentity&&s.bufferIdentity===p.storage.bufferIdentity&&s.byteLength===p.storage.byteLength&&s.bufferBytes===p.storage.bufferBytes;}

type ChildPin={child:Mesh;parent:Object3D|null;geometry:Mesh['geometry'];attributes:Map<string,AttributePin>;index:AttributePin|null;matrix?:AttributePin;color?:AttributePin;count?:number;day:Material;night:Material;grade:Material;transform:number[];pose:number[];auto:boolean;worldAuto:boolean;disposed:boolean};
type Mask={architecture:Group;contact:Group;children:ChildPin[]};
const states=new WeakMap<Object3D,Map<boolean,Mask>>(),grades=new WeakMap<Mesh,Material>();
function stillMatches(p:ChildPin):boolean{
 const c=p.child;if(p.disposed||c.parent!==p.parent||c.geometry!==p.geometry||c.matrix.elements.some((v,i)=>v!==p.transform[i])||[...c.position.toArray(),...c.quaternion.toArray(),...c.scale.toArray()].some((v,i)=>v!==p.pose[i])||c.matrixAutoUpdate!==p.auto||c.matrixWorldAutoUpdate!==p.worldAuto||Object.keys(c.geometry.attributes).length!==p.attributes.size||![...p.attributes].every(([k,a])=>match(c.geometry.getAttribute(k)as Attribute,a))||(p.index?!match(c.geometry.index,p.index):!!c.geometry.index)||c.userData.dayMaterial!==p.day||c.userData.nightMaterial!==p.night||c.userData.schwellenraumMaterial!==p.grade||(![p.day,p.night,p.grade].includes(c.material as Material)&&!hasMinecraftMaterialProvenance(c,p.day,c.material)&&!hasMinecraftMaterialProvenance(c,p.night,c.material)&&!hasMinecraftMaterialProvenance(c,p.grade,c.material)))return false;
 return !(c instanceof InstancedMesh)||c.count===p.count&&!!p.matrix&&match(c.instanceMatrix,p.matrix)&&(!p.color?!c.instanceColor:match(c.instanceColor,p.color));
}
/** The caller attaches the entire v309 required ensemble before admission.
 * Normal visibility changes, malformed predecessors and partial replacements
 * retain or restore all old station geometry. No original buffer is changed. */
export function applyRailSseLegacyV307(root:Object3D,native=false,enabled=false,architecture?:Group,contact?:Group):boolean{
 const map=states.get(root),old=map?.get(native);
 const admitted=enabled&&!!architecture&&!!contact&&!!architecture.parent&&!!contact.parent&&hasCompleteRailSseArchitectureV307(architecture,native)&&(hasCompleteRailTerrainContactV307(contact,native)||hasCompleteRailTerrainContactApproachV309(contact,native));
 if(old){
  if(admitted&&architecture===old.architecture&&contact===old.contact&&old.children.every(p=>!p.child.visible&&stillMatches(p)))return true;
  for(const p of old.children)if(p.child.parent===p.parent&&!p.child.visible)p.child.visible=true;
  map!.delete(native);
 }
 if(!admitted)return false;
 const batch=source.batches.find(b=>b.native===native);if(source.schemaVersion!==1||!batch||batch.stations.length!==2)return false;
 const groups:Group[]=[];root.traverse(q=>{if(q instanceof Group&&['Gesundbrunnen','Landsberger Allee'].includes(q.userData.stationName))groups.push(q);});
 if(groups.length!==2)return false;
 const selected:Mesh[]=[];
 for(const station of batch.stations){
  const choices=groups.filter(g=>g.userData.stationName===station.stationName&&g.name===station.name);if(choices.length!==1)return false;
  const group=choices[0];if(!group.visible||group.children.length!==station.children.length||group.position.toArray().some((v,i)=>v!==station.position[i]))return false;
  for(let i=0;i<station.children.length;i++){
   const expected=station.children[i],child=group.children[i];if(!(child instanceof Mesh)||!child.visible||child.name!==expected.name||Object.keys(child.geometry.attributes).length!==Object.keys(expected.attributes).length||child.geometry.drawRange.start!==0||child.geometry.drawRange.count!==Infinity&&child.geometry.drawRange.count!==(child.geometry.index?.count??child.geometry.getAttribute('position').count))return false;
   for(const[key,a]of Object.entries(expected.attributes)){const actual=child.geometry.getAttribute(key);if(!actual||actual.count!==a.count||actual.itemSize!==a.itemSize||actual.normalized!==a.normalized||attributeBytes(actual)!==a.bytes)return false;}
   const ix=child.geometry.index;if(expected.index?(!ix||ix.count!==expected.index.count||bytes(ix.array)!==expected.index.bytes):!!ix)return false;
   if(expected.instanceCount!==null?(!(child instanceof InstancedMesh)||child.count!==expected.instanceCount||bytes(child.instanceMatrix.array)!==expected.matrix||(expected.color===null?!!child.instanceColor:!child.instanceColor||bytes(child.instanceColor.array)!==expected.color)):child instanceof InstancedMesh)return false;
   const day=child.userData.dayMaterial,night=child.userData.nightMaterial;let grade=grades.get(child);
   if(!grade&&hasSchwellenraumMaterialProvenance(child,day,child.userData.schwellenraumMaterial)){grade=child.userData.schwellenraumMaterial;grades.set(child,grade!);}
   if(!day?.color||!night?.color||day.color.toArray().some((v:number,j:number)=>v!==expected.dayColor[j])||night.color.toArray().some((v:number,j:number)=>v!==expected.nightColor[j])||(grade?child.userData.schwellenraumMaterial!==grade:child.userData.schwellenraumMaterial!==undefined))return false;
   if(child.material!==day&&child.material!==night&&child.material!==grade&&!hasMinecraftMaterialProvenance(child,day,child.material)&&!hasMinecraftMaterialProvenance(child,night,child.material)&&!(grade&&hasMinecraftMaterialProvenance(child,grade,child.material)))return false;selected.push(child);
  }
 }
 const pins=selected.map(child=>{
  let grade=grades.get(child);if(!grade){grade=schwellenraumMaterialFor(child,child.userData.dayMaterial);grades.set(child,grade);}
  const p:ChildPin={child,parent:child.parent,geometry:child.geometry,attributes:new Map(Object.entries(child.geometry.attributes).map(([k,a])=>[k,pin(a as Attribute)])),index:child.geometry.index?pin(child.geometry.index):null,day:child.userData.dayMaterial,night:child.userData.nightMaterial,grade,transform:child.matrix.elements.slice(),pose:[...child.position.toArray(),...child.quaternion.toArray(),...child.scale.toArray()],auto:child.matrixAutoUpdate,worldAuto:child.matrixWorldAutoUpdate,disposed:false,...(child instanceof InstancedMesh?{matrix:pin(child.instanceMatrix),color:child.instanceColor?pin(child.instanceColor):undefined,count:child.count}:{})};
  const disposed=()=>{p.disposed=true;};child.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(p.geometry))disposed();});p.day.addEventListener('dispose',disposed);p.night.addEventListener('dispose',disposed);p.grade.addEventListener('dispose',disposed);if(child instanceof InstancedMesh)child.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(child))disposed();});return p;
 });
 for(const p of pins)p.child.visible=false;
 const next=map??new Map<boolean,Mask>();next.set(native,{architecture:architecture!,contact:contact!,children:pins});states.set(root,next);return true;
}
