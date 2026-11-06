/** Exact subsets of the already admitted Oranienstraße glazing, with the
 * shared artificial-light contract. No old coarse windows are replayed. */
import {Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,type Material} from "three";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {createPackedRootStepsV309,completePackedRootV307,readRequiredPackedWordsV307,type RequiredPackedV307} from "./requiredPackedRootV307";
const OWNER=Symbol("Oranienstraße exact glazing light v321");
type Receipt={parent:Mesh;root:Group;day:MeshBasicMaterial;night:MeshStandardMaterial;native:boolean};
const receipts=new WeakMap<Group,Receipt>();
function encode(words:Uint32Array):string{const bytes=new Uint8Array(words.buffer,words.byteOffset,words.byteLength);let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
export function* createBerlinSenateNightV321Steps(parent:Mesh,source:RequiredPackedV307,native:boolean):Generator<void,Group>{
 const rgb=native?[4366,7666,9072]:[3788,6395,7500],triangles=native?428:1012;
 if(source.key!==(native?"oranien-cardinal-source":"oranien-complete-source")||source.native!==native||source.colorType!=="u16linear")throw Error("Unknown Oranienstraße source glazing");
 const colorBytes=decodeBase64Bytes(source.colors),colors=new Uint16Array(colorBytes.buffer,colorBytes.byteOffset,colorBytes.byteLength/2);
 const indices=readRequiredPackedWordsV307(source.indices,source.triangles*3,1,source.indicesCodec),selected:number[]=[];
 for(let i=0;i<indices.length;i+=3){if([0,1,2].every(j=>rgb.every((v,k)=>colors[indices[i+j]*3+k]===v)))selected.push(indices[i],indices[i+1],indices[i+2]);if(i%3072===0)yield;}
 if(selected.length!==triangles*3)throw Error("Incomplete exact Oranienstraße glazing subset");
 const subset:RequiredPackedV307={...source,key:"Oranienstraße source glazing light v321",indices:encode(new Uint32Array(selected)),indicesCodec:undefined,triangles};
 const root=yield*createPackedRootStepsV309(OWNER,"Oranienstraße source glazing light v321",native,[subset],{sourceGlazingOnlyV321:true},r=>parent.add(r));
 const mesh=root.children[0]as Mesh,day=mesh.userData.dayMaterial as MeshBasicMaterial,night=mesh.userData.nightMaterial as MeshStandardMaterial;
 day.transparent=true;day.opacity=0;day.depthWrite=false;day.colorWrite=false;
 night.polygonOffset=true;night.polygonOffsetFactor=-1;night.polygonOffsetUnits=-1;
 night.userData.nightEmissive=0xffc47e;night.userData.nightEmissiveIntensity=.52;
 receipts.set(root,{parent,root,day,night,native});return root;
}
export function completeBerlinSenateNightV321(root:Group,parent:Mesh,native?:boolean):boolean{
 const r=receipts.get(root);return !!r&&r.parent===parent&&root.parent===parent&&parent.children.length===1&&parent.children[0]===root&&
  (native===undefined||native===r.native)&&completePackedRootV307(root,OWNER,native)&&r.day.transparent&&r.day.opacity===0&&!r.day.depthWrite&&!r.day.colorWrite&&
  r.night.polygonOffset&&r.night.polygonOffsetFactor===-1&&r.night.polygonOffsetUnits===-1&&r.night.userData.nightEmissive===0xffc47e&&r.night.userData.nightEmissiveIntensity===.52;
}
/** Own only an unpublished constructor's resources. */
export function disposeBerlinSenateUnpublishedV321(root:Group):void{
 const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if((m as Material|undefined)?.dispose)resources.add(m);}});for(const q of resources)q.dispose();root.clear();
}
