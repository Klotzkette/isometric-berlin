/** Exact actual-constructor v227 receipts; unrelated townhalls stay untouched. */
import {Group,InstancedMesh,Mesh,Object3D}from "three";
import type {Material}from "three";
import receipt from "./data/neukoellnLandmarksV305Previous.json";
import {hasCompleteNeukoellnLandmarksV305}from "./NeukoellnLandmarksV305";
import {schwellenraumMaterialFor}from "./visual-modes/schwellenraum/materialGrade";
function bytes(a:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
type Mask={replacement:Group;children:{child:Mesh;parent:Object3D|null}[]};
const masks=new WeakMap<Object3D,Map<boolean,Mask>>();
const legacyGrades=new WeakMap<Mesh,Material>();
/** Caller attaches the whole source replacement first. A changed legacy batch,
 * partial replacement or closed default retains every old fitting. */
export function applyNeukoellnLegacyV227V305(root:Object3D,native=false,enabled=false,replacement?:Group):boolean {
 const states=masks.get(root),before=states?.get(native);
 const admitted=enabled&&!!replacement&&!!replacement.parent&&replacement.visible&&hasCompleteNeukoellnLandmarksV305(replacement,native)&&receipt.schemaVersion===1;
 if(before){
  if(admitted&&before.replacement===replacement&&before.children.every(r=>r.child.parent===r.parent&&!r.child.visible))return true;
  for(const r of before.children)if(r.child.parent===r.parent&&!r.child.visible)r.child.visible=true;
  states!.delete(native);
 }
 if(!admitted)return false;
 const plan=receipt.batches.find(b=>b.native===native);if(!plan)return false;
 const selected:Mesh[]=[];
 root.traverse(o=>{if(o instanceof Mesh&&o.userData.siteKey==="neukoelln")selected.push(o);});
 if(selected.length!==plan.children.length)return false;
 for(const p of plan.children){
  const choices=selected.filter(c=>c.name===p.name);if(choices.length!==1)return false;
  const child=choices[0],g=child.geometry;
  if(!child.visible||Object.keys(g.attributes).length!==Object.keys(p.attributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity&&g.drawRange.count!==(g.index?.count??g.getAttribute("position").count))return false;
  for(const[k,pin]of Object.entries(p.attributes)){
   const a=g.getAttribute(k);if(!a||a.count!==pin.count||a.itemSize!==pin.itemSize||a.normalized!==pin.normalized||bytes(a.array)!==pin.bytes)return false;
  }
  if(p.index?(!g.index||g.index.count!==p.index.count||bytes(g.index.array)!==p.index.bytes):!!g.index)return false;
  if(p.instanceCount?(!(child instanceof InstancedMesh)||child.count!==p.instanceCount||bytes(child.instanceMatrix.array)!==p.matrix||(p.color===null?!!child.instanceColor:!child.instanceColor||bytes(child.instanceColor.array)!==p.color)):child instanceof InstancedMesh)return false;
  const grade=legacyGrades.get(child);
  if(grade?child.userData.schwellenraumMaterial!==grade:child.userData.schwellenraumMaterial!==undefined)return false;
  if(child.material!==child.userData.dayMaterial&&child.material!==child.userData.nightMaterial&&child.material!==grade)return false;
 }
 // This first exact all-buffer admission precedes ordinary presentation. Only
 // a fresh grade produced here is privately owned; an arbitrary public cached
 // clone can never authorize a later mask or masquerade as a known material.
 for(const c of selected)if(!legacyGrades.has(c))legacyGrades.set(c,schwellenraumMaterialFor(c,c.userData.dayMaterial));
 // Whole identified old batches contain only the obsolete Neukölln profile.
 // Their original buffers and all foreign child/material identities survive.
 for(const c of selected)c.visible=false;
 const next=states??new Map<boolean,Mask>();next.set(native,{replacement:replacement!,children:selected.map(child=>({child,parent:child.parent}))});masks.set(root,next);
 return true;
}
