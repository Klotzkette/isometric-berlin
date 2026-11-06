/** Internal complete-root construction shared only by the finite v307 factories. */
import {BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import type {Material,Object3D,Side} from 'three';
import {decodeBase64Bytes} from './decodeBase64Bytes';
import {decodeLosslessWordStreamV309,decodeLosslessWordPlanesV309} from './losslessWordStreamV309';
import {staticStorageInfo} from './losslessStaticStorage';
import {isSceneGeometryGpuRetirementV309} from './sceneGeometryGpuResidency';
import {isSceneMaterialProgramRetirementV321} from './sceneMaterialPrograms';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {schwellenraumMaterialFor} from './visual-modes/schwellenraum/materialGrade';
import {hasMinecraftMaterialProvenance}from'./visual-modes/minecraft/materialMode';

export type RequiredPackedV307={key:string;field?:string;native:boolean;positionType:'u16cm'|'f32';positionsCodec?:'u32-delta-varint-stride3-v1'|'u32-delta-byteplanes-stride3-v1';indicesCodec?:'u32-delta-varint-stride1-v1'|'u32-delta-byteplanes-stride1-v1';colorType:'u16linear'|'f32linear';normals?:string;materials?:{day:{color:number[];type:string;side:number;roughness?:number;metalness?:number;flatShading?:boolean};night:{color:number[];type:string;side:number;roughness?:number;metalness?:number;flatShading?:boolean}};origin:number[];positions:string;colors:string;indices:string;vertices:number;triangles:number};
/** Explicit new-data codecs; old packed sources retain their raw path. */
export function readRequiredPackedWordsV307(encoded:string,count:number,stride:1|3,codec?:string):Uint32Array {
 if(codec===undefined){const bytes=decodeBase64Bytes(encoded);if(bytes.byteLength!==count*4)throw Error('Incomplete exact raw words');return new Uint32Array(bytes.buffer,bytes.byteOffset,count);}
 if(codec===`u32-delta-varint-stride${stride}-v1`)return decodeLosslessWordStreamV309(encoded,count,stride);
 if(codec===`u32-delta-byteplanes-stride${stride}-v1`)return decodeLosslessWordPlanesV309(encoded,count,stride);
 throw Error('Unknown finite v309 word codec');
}
type AttributePin={attribute:BufferAttribute;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;itemSize:number;normalized:boolean};
type Pose={matrix:number[];position:number[];quaternion:number[];scale:number[];auto:boolean;worldAuto:boolean};
type Pin={mesh:Mesh;geometry:BufferGeometry;attributes:Map<string,AttributePin>;index:AttributePin;day:Material;night:Material;grade:Material;pose:Pose};
type Receipt={owner:symbol;native:boolean;children:Pin[];pose:Pose;disposed:boolean};
const pose=(o:Object3D):Pose=>({matrix:o.matrix.elements.slice(),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),auto:o.matrixAutoUpdate,worldAuto:o.matrixWorldAutoUpdate});
const poseMatches=(o:Object3D,p:Pose)=>o.matrixAutoUpdate===p.auto&&o.matrixWorldAutoUpdate===p.worldAuto&&o.position.x===p.position[0]&&o.position.y===p.position[1]&&o.position.z===p.position[2]&&o.quaternion.x===p.quaternion[0]&&o.quaternion.y===p.quaternion[1]&&o.quaternion.z===p.quaternion[2]&&o.quaternion.w===p.quaternion[3]&&o.scale.x===p.scale[0]&&o.scale.y===p.scale[1]&&o.scale.z===p.scale[2]&&o.matrix.elements.every((v,i)=>v===p.matrix[i]);
const receipts=new WeakMap<Group,Receipt>();
const pin=(a:BufferAttribute):AttributePin=>({attribute:a,storage:staticStorageInfo(a),version:a.version,count:a.count,itemSize:a.itemSize,normalized:a.normalized});
function matches(a:BufferAttribute|null|undefined,p:AttributePin):boolean{
 if(!a||a!==p.attribute||a.version!==p.version||a.count!==p.count||a.itemSize!==p.itemSize||a.normalized!==p.normalized)return false;
 const q=staticStorageInfo(a);return q.arrayIdentity===p.storage.arrayIdentity&&q.bufferIdentity===p.storage.bufferIdentity&&q.byteLength===p.storage.byteLength&&q.bufferBytes===p.storage.bufferBytes;
}
/** Owner symbols are private to the public finite factories. Public labels,
 * copied buffers, changed transforms and disposed resources never admit a root. */
export function completePackedRootV307(root:Group,owner:symbol,native?:boolean):boolean{
 const r=receipts.get(root);if(!r||r.owner!==owner||r.disposed||!root.visible||native!==undefined&&native!==r.native||root.children.length!==r.children.length||!poseMatches(root,r.pose))return false;
 return r.children.every((p,i)=>root.children[i]===p.mesh&&p.mesh.parent===root&&p.mesh.visible&&p.mesh.geometry===p.geometry&&poseMatches(p.mesh,p.pose)&&p.geometry.drawRange.start===0&&(p.geometry.drawRange.count===Infinity||p.geometry.drawRange.count===p.index.count)&&Object.keys(p.geometry.attributes).length===p.attributes.size&&[...p.attributes].every(([key,a])=>matches(p.geometry.getAttribute(key) as BufferAttribute,a))&&matches(p.geometry.index,p.index)&&(p.mesh.material===p.day||p.mesh.material===p.night||p.mesh.material===p.grade||hasMinecraftMaterialProvenance(p.mesh,p.day,p.mesh.material)||hasMinecraftMaterialProvenance(p.mesh,p.night,p.mesh.material)||hasMinecraftMaterialProvenance(p.mesh,p.grade,p.mesh.material))&&p.mesh.userData.dayMaterial===p.day&&p.mesh.userData.nightMaterial===p.night&&p.mesh.userData.schwellenraumMaterial===p.grade);
}
/** Every source buffer is decoded once; the constructor owns all allocations
 * until full admission and records no second strong copy of parked arrays. */
export function* createPackedRootStepsV309(owner:symbol,name:string,native:boolean,source:readonly RequiredPackedV307[],metadata:Record<string,unknown>,onCreate?:(root:Group)=>void):Generator<void,Group>{
 const root=new Group(),resources=new Set<{dispose():void}>();root.name=name;
 const receipt:Receipt={owner,native,children:[],pose:pose(root),disposed:false};
 const invalidate=()=>{receipt.disposed=true;};let delivered=false;
 try{
  onCreate?.(root);
  if(!source.length||new Set(source.map(q=>q.key)).size!==source.length)throw Error('Missing complete v307 required parts');
  for(const q of source){
   if(q.native!==native||!['u16linear','f32linear'].includes(q.colorType)||!['u16cm','f32'].includes(q.positionType)||q.origin.length!==3||q.origin.some(v=>!Number.isFinite(v))||!Number.isSafeInteger(q.vertices)||!Number.isSafeInteger(q.triangles)||q.vertices<=0||q.triangles<=0)throw Error('Invalid finite v307 required schema');
   if(q.positionsCodec!==undefined&&q.positionType!=='f32')throw Error('Word codec requires exact Float32 positions');
   const p=q.positionType==='u16cm'?decodeBase64Bytes(q.positions):readRequiredPackedWordsV307(q.positions,q.vertices*3,3,q.positionsCodec),c=decodeBase64Bytes(q.colors),indices=readRequiredPackedWordsV307(q.indices,q.triangles*3,1,q.indicesCodec);
   if(p.byteLength!==q.vertices*(q.positionType==='u16cm'?6:12)||c.byteLength!==q.vertices*(q.colorType==='u16linear'?6:12)||indices.byteLength!==q.triangles*12)throw Error('Incomplete v307 required attributes');
   const positions=q.positionType==='u16cm'?new Uint16Array(p.buffer,p.byteOffset,p.byteLength/2):new Float32Array(p.buffer,p.byteOffset,p.byteLength/4);
   const colors=q.colorType==='u16linear'?new Uint16Array(c.buffer,c.byteOffset,c.byteLength/2):new Float32Array(c.buffer,c.byteOffset,c.byteLength/4);
   if(positions.some(v=>!Number.isFinite(v))||indices.some(v=>v>=q.vertices))throw Error('Invalid v307 required geometry');
   const geometry=new BufferGeometry();resources.add(geometry);geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(geometry))invalidate();});
   geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setAttribute('color',new BufferAttribute(colors,3,q.colorType==='u16linear'));geometry.setIndex(new BufferAttribute(indices,1));if(q.normals){const n=decodeBase64Bytes(q.normals);if(n.byteLength!==q.vertices*12)throw Error('Incomplete exact source normals');geometry.setAttribute('normal',new BufferAttribute(new Float32Array(n.buffer,n.byteOffset,n.byteLength/4),3));}else geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.exactIndexPending=false;geometry.userData.losslessStaticBacking=true;
   const day=q.materials?.day.type==='MeshStandardMaterial'?new MeshStandardMaterial({vertexColors:true,side:q.materials.day.side as Side,roughness:q.materials.day.roughness??1,metalness:q.materials.day.metalness??0,flatShading:q.materials.day.flatShading??false}):new MeshBasicMaterial({vertexColors:true,side:(q.materials?.day.side??DoubleSide)as Side}),night=q.materials?.night.type==='MeshBasicMaterial'?new MeshBasicMaterial({vertexColors:true,side:q.materials.night.side as Side}):new MeshStandardMaterial({vertexColors:true,side:(q.materials?.night.side??DoubleSide)as Side,flatShading:q.materials?.night.flatShading??(q.materials?false:native),roughness:q.materials?.night.roughness??.92,metalness:q.materials?.night.metalness??0});if(q.materials){day.color.fromArray(q.materials.day.color);night.color.fromArray(q.materials.night.color);}resources.add(day);resources.add(night);day.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(day))invalidate();});night.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(night))invalidate();});
   const mesh=new Mesh(geometry,day);mesh.name=q.key;mesh.position.fromArray(q.origin);if(q.positionType==='u16cm')mesh.scale.setScalar(.01);
   mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,fieldKey:q.field,requiredV307:true};
   const grade=schwellenraumMaterialFor(mesh,day);resources.add(grade);grade.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(grade))invalidate();});root.add(mesh);
   yield;
  }
  root.userData={...metadata,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,requiredCompleteReplacement:true};freezeStaticSceneTransforms(root);
  receipt.pose=pose(root);receipt.children=(root.children as Mesh[]).map(mesh=>({mesh,geometry:mesh.geometry,attributes:new Map(Object.entries(mesh.geometry.attributes).map(([key,a])=>[key,pin(a as BufferAttribute)])),index:pin(mesh.geometry.index!),day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:mesh.userData.schwellenraumMaterial,pose:pose(mesh)}));receipts.set(root,receipt);delivered=true;return root;
 }finally{if(!delivered){receipts.delete(root);for(const r of resources)r.dispose();root.clear();}}
}

/** Existing synchronous callers drain the identical per-mesh constructor. */
export function createPackedRootV307(owner:symbol,name:string,native:boolean,source:readonly RequiredPackedV307[],metadata:Record<string,unknown>):Group{
 const steps=createPackedRootStepsV309(owner,name,native,source,metadata);
 for(;;){const step=steps.next();if(step.done)return step.value;}
}
