/** Finite missing documented pavement memorials. Other memorial subtypes remain
 * individually accounted for in the source ledger, never generic new figures. */
import {BufferAttribute,BufferGeometry,Group,InstancedMesh,InterleavedBufferAttribute,Material,MeshBasicMaterial,MeshStandardMaterial,type Object3D} from 'three';
import profile from './data/publicMonumentsV326.json';
import namedProfile from './data/oberschoeneweideMemorialV326.json';
import {justicePalaceV183Boxes} from './justicePalaceV183Batches';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {interleaveStaticGeometry} from './interleaveStaticGeometry';
import {isParkedStaticStorageV321,staticStorageInfo} from './losslessStaticStorage';
import {isSceneGeometryGpuRetirementV309} from './sceneGeometryGpuResidency';
import {isSceneInstanceGpuRetirementV309} from './sceneGpuResidency';
import {isSceneMaterialProgramRetirementV321} from './sceneMaterialPrograms';
import {schwellenraumMaterialFor} from './visual-modes/schwellenraum/materialGrade';
import {hasMinecraftMaterialProvenance} from './visual-modes/minecraft/materialMode';

type Entry={id:string;key:string;point:number[];name:string;inscription?:string|null;sourceDirection?:string|null};
type Options={native:boolean;keys?:readonly string[];sourceIds?:readonly string[];terrainAt:(x:number,z:number)=>number|null;mobileLike?:boolean;origin?:readonly[number,number,number]};
const source=profile as {schemaVersion:number;sourceSha256:string;widthM:number;depthM:number;keys:string[];entries:Entry[];references:unknown[]};
const hash=(v:unknown)=>{const s=JSON.stringify(v);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const CONTROL=3248741895;
const metadata=()=>[source.schemaVersion,source.sourceSha256,source.widthM,source.depthM,source.keys,source.references];
const recipe=()=>[metadata(),source.entries];
type Attr=BufferAttribute|InterleavedBufferAttribute;
const storage=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
function words(a:Attr):number{const v=storage(a).array,b=new Uint8Array(v.buffer,v.byteOffset,v.byteLength),w=new Uint32Array(b.buffer,b.byteOffset,Math.floor(b.length/4));let h=2166136261;for(let i=0;i<w.length;i++)h=Math.imul(h^w[i],16777619)>>>0;for(let i=w.length*4;i<b.length;i++)h=Math.imul(h^b[i],16777619)>>>0;return h;}
type Pin={a:Attr;version:number;count:number;size:number;normalized:boolean;stride:number;offset:number;info:ReturnType<typeof staticStorageInfo>;hash:number};
const pin=(a:Attr):Pin=>({a,version:storage(a).version,count:a.count,size:a.itemSize,normalized:a.normalized,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,offset:a instanceof InterleavedBufferAttribute?a.offset:0,info:staticStorageInfo(storage(a)),hash:words(a)});
function intact(a:Attr|null|undefined,p:Pin):boolean{if(!a||a!==p.a||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset)return false;const s=storage(a),q=staticStorageInfo(s);return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes&&(isParkedStaticStorageV321(s)||words(a)===p.hash);}
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:number[])=>pose(o).every((n,i)=>Object.is(n,p[i]));
const shape=(m:Material)=>JSON.stringify([m.type,m.opacity,m.transparent,m.alphaTest,m.depthWrite,m.depthTest,m.side,(m as MeshBasicMaterial).vertexColors,(m as MeshBasicMaterial).wireframe,(m as MeshStandardMaterial).roughness,(m as MeshStandardMaterial).metalness]);
type Receipt={native:boolean;rootPose:number[];mesh:InstancedMesh;meshPose:number[];geometry:BufferGeometry;attrs:[string,Pin][];index:Pin;matrix:Pin;color:Pin;count:number;day:Material;night:Material;grade:Material;shapes:string[];entries:{index:number;value:Entry;text:string}[];meta:string;sourceGuard?:()=>boolean;invalid:boolean;resources:Set<{dispose():void}>};
const receipts=new WeakMap<Group,Receipt>();

export function hasCompletePublicMonumentsV326(root:Group,native?:boolean):boolean{
 const r=receipts.get(root);if(!r||r.invalid||r.sourceGuard?.()===false||native!==undefined&&native!==r.native||source.entries.length!==6475||JSON.stringify(metadata())!==r.meta||!r.entries.every(p=>source.entries[p.index]===p.value&&JSON.stringify(p.value)===p.text))return false;
 const m=r.mesh;return root.visible&&samePose(root,r.rootPose)&&root.children.length===1&&root.children[0]===m&&m.parent===root&&m.visible&&samePose(m,r.meshPose)&&m.children.length===0&&m.geometry===r.geometry&&m.geometry.drawRange.start===0&&m.geometry.drawRange.count===Infinity&&m.geometry.groups.length===0&&Object.keys(m.geometry.morphAttributes).length===0&&Object.keys(m.geometry.attributes).length===r.attrs.length&&r.attrs.every(([k,p])=>intact(m.geometry.getAttribute(k)as Attr,p))&&intact(m.geometry.index,r.index)&&m.count===r.count&&m.morphTexture===null&&intact(m.instanceMatrix,r.matrix)&&intact(m.instanceColor,r.color)&&m.userData.dayMaterial===r.day&&m.userData.nightMaterial===r.night&&m.userData.schwellenraumMaterial===r.grade&&[r.day,r.night,r.grade].every((q,i)=>shape(q)===r.shapes[i])&&(m.material===r.day||m.material===r.night||m.material===r.grade||hasMinecraftMaterialProvenance(m,r.day,m.material as Material)||hasMinecraftMaterialProvenance(m,r.night,m.material as Material)||hasMinecraftMaterialProvenance(m,r.grade,m.material as Material));
}

/** Require a finite actual packet key selection and current rendered-surface
 * sampler. No all-city default, missing height, plaque wall guess or timer. */
export function* createPublicMonumentsV326Steps(options:Options,onCreate?:(root:Group)=>void):Generator<void,Group|null>{
 const{keys,sourceIds}=options,origin=options.origin??[0,0,0];if(origin.length!==3||!origin.every(Number.isFinite)||!options.terrainAt||!!keys===!!sourceIds||keys&&(!keys.length||keys.length>8||new Set(keys).size!==keys.length)||sourceIds&&(!sourceIds.length||sourceIds.length>256||new Set(sourceIds).size!==sourceIds.length)||hash(recipe())!==CONTROL)return null;
 const wanted=new Set(keys??sourceIds),selected:{index:number;value:Entry;text:string}[]=[];
 for(let i=0;i<source.entries.length;i++){const q=source.entries[i];if(wanted.has(keys?q.key:q.id))selected.push({index:i,value:q,text:JSON.stringify(q)});}
 if(!selected.length||selected.length>2048||Array.from(wanted).some(k=>!selected.some(q=>(keys?q.value.key:q.value.id)===k)))return null;
 const root=new Group(),resources=new Set<{dispose():void}>(),rows:number[][]=[],meta=JSON.stringify(metadata());let delivered=false;
 root.name='Documented mapped Stolpersteine: finite packet supplement V326';root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:options.native,blockNative:options.native,keepInMinecraft:options.native,sourceIds:selected.map(q=>q.value.id),schwellenraumGeschuetzt:true};
 try{
  onCreate?.(root);
  for(const q of selected){const[x,z]=q.value.point,y=options.terrainAt(x,z);if(y===null||!Number.isFinite(y)||Math.abs(y)>1000)return null;rows.push([x-origin[0],y+.0015-origin[1],z-origin[2],.1,.003,.1,0,0xc49a36]);if(rows.length%32===0)yield;}
  const mesh=justicePalaceV183Boxes(rows.map(q=>options.native?[...q.slice(0,6),q[7]]:q),options.native);mesh.geometry.clearGroups();mesh.castShadow=false;mesh.name='10cm brass pavement tops: exact mapped identities';root.add(mesh);
  const day=mesh.userData.dayMaterial as Material,night=mesh.userData.nightMaterial as Material,grade=schwellenraumMaterialFor(mesh,day);for(const r of[mesh,mesh.geometry,day,night,grade])resources.add(r);interleaveStaticGeometry(root);freezeStaticSceneTransforms(root);yield;
  const receipt:Receipt={native:options.native,rootPose:pose(root),mesh,meshPose:pose(mesh),geometry:mesh.geometry,attrs:Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:pin(mesh.geometry.index!),matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),count:mesh.count,day,night,grade,shapes:[day,night,grade].map(shape),entries:selected,meta,invalid:false,resources};
  const invalidate=()=>{receipt.invalid=true;};for(const m of[day,night,grade])m.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(m))invalidate();});mesh.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(mesh.geometry))invalidate();});mesh.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(mesh))invalidate();});
  if(hash(recipe())!==CONTROL||JSON.stringify(metadata())!==meta||!selected.every(p=>source.entries[p.index]===p.value&&JSON.stringify(p.value)===p.text))return null;
  receipts.set(root,receipt);if(!hasCompletePublicMonumentsV326(root,options.native))return null;delivered=true;return root;
 }finally{if(!delivered){receipts.delete(root);root.removeFromParent();for(const r of resources)r.dispose();root.clear();}}
}

export function createPublicMonumentsV326(options:Options):Group|null{const g=createPublicMonumentsV326Steps(options);for(;;){const n=g.next();if(n.done)return n.value;}}
export function disposePublicMonumentsV326(root:Group):void{const r=receipts.get(root);if(!r)return;r.invalid=true;receipts.delete(root);root.removeFromParent();for(const q of r.resources)q.dispose();r.resources.clear();root.clear();}
export function hasPublicMonumentsRuntimeV326(world:Object3D,root:Group|null|undefined,native:boolean):boolean{if(!root||!hasCompletePublicMonumentsV326(root,native))return false;for(let p:Object3D|null=root.parent;p;p=p.parent)if(p===world)return true;return false;}

const NAMED_CONTROL=613473274;
/** Individually dimensioned clinker architecture, not a generic memorial type.
 * Four panels and relief cues are reference interpretations. Facing is estimated. */
export function createOberschoeneweideMemorialV326(native:boolean,groundY:number,origin:readonly[number,number,number]=[0,0,0]):Group|null{
 if(hash(namedProfile)!==NAMED_CONTROL||!Number.isFinite(groundY)||origin.length!==3||!origin.every(Number.isFinite))return null;
 const root=new Group(),rows:number[][]=[],resources=new Set<{dispose():void}>();let delivered=false;
 const put=(x:number,y:number,z:number,w:number,h:number,d:number,rgb:number)=>rows.push([namedProfile.point[0]+x-origin[0],groundY+y-origin[1],namedProfile.point[1]+z-origin[2],w,h,d,0,rgb]);
 // The complete overall source envelope is2.5×.7×.63m. All relief and joints
 // remain inside that envelope; there is no invented plinth or adjacent paving.
 put(0,1.25,0,.664,2.48,.594,0x89644c);put(0,.01,0,.7,.02,.63,0x927056);put(0,2.49,0,.7,.02,.63,0x927056);
 for(let row=1;row<35;row++){const y=row*.071;put(0,y,-.298,.664,.006,.003,0xaca18a);put(0,y,.298,.664,.006,.003,0xaca18a);put(-.333,y,0,.003,.006,.594,0xaca18a);put(.333,y,0,.003,.006,.594,0xaca18a);
  for(const x of(row%2?[-.22,0,.22]:[-.11,.11])){put(x,y-.033,-.298,.005,.064,.003,0xa59880);put(x,y-.033,.298,.005,.064,.003,0xa59880);}}
 // Four inset stoneware panels, matching the catalogue's four-sided upper band.
 for(const side of[-1,1]){put(0,1.95,side*.302,.51,.46,.012,0x665548);put(side*.338,1.95,0,.012,.46,.45,0x665548);}
 // The source documents an oath-hand before a flag/red-triangle emblem. Flat
 // narrow independent bars form a bounded relief interpretation in each family.
 for(let i=0;i<(native?14:24);i++){const t=(i+.5)/(native?14:24);put(-.09,1.78+t*.24,.311,.26*t,.24/(native?14:24),.006,0x9c5544);}
 put(.055,1.95,.311,.12,.15,.006,0xb99571);for(let i=0;i<3;i++)put(.014+i*.037,2.075+(i===1?.015:0),.311,.028,.13,.006,0xb99571);put(.133,1.975,.311,.047,.053,.006,0xb99571);
 try{const mesh=justicePalaceV183Boxes(rows.map(q=>native?[...q.slice(0,6),q[7]]:q),native);mesh.geometry.clearGroups();root.add(mesh);const day=mesh.userData.dayMaterial as Material,night=mesh.userData.nightMaterial as Material,grade=schwellenraumMaterialFor(mesh,day);for(const q of[mesh,mesh.geometry,day,night,grade])resources.add(q);interleaveStaticGeometry(root);freezeStaticSceneTransforms(root);
  root.name=namedProfile.name+' — individually measured clinker stele V326';root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,schwellenraumGeschuetzt:true,sourceIds:[namedProfile.id],orientationStatus:namedProfile.orientation,reliefStatus:namedProfile.reliefStatus};
  const r:Receipt={native,rootPose:pose(root),mesh,meshPose:pose(mesh),geometry:mesh.geometry,attrs:Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:pin(mesh.geometry.index!),matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),count:mesh.count,day,night,grade,shapes:[day,night,grade].map(shape),entries:[],meta:JSON.stringify(metadata()),sourceGuard:()=>hash(namedProfile)===NAMED_CONTROL,invalid:false,resources};
  const invalidate=()=>{r.invalid=true;};for(const m of[day,night,grade])m.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(m))invalidate();});mesh.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(mesh.geometry))invalidate();});mesh.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(mesh))invalidate();});receipts.set(root,r);if(!hasCompletePublicMonumentsV326(root,native))return null;delivered=true;return root;
 }finally{if(!delivered){receipts.delete(root);for(const r of resources)r.dispose();root.clear();}}
}
