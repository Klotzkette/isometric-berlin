/** Exact small source-line transaction; no Core mesh shares this geometry. */
import {BufferAttribute,BufferGeometry,Group,InterleavedBufferAttribute,LineBasicMaterial,LineSegments,Matrix4,Object3D,Quaternion,Vector3}from'three';
import type{NorthCoreTerrainRebindV309}from'./NorthCoreTerrainV309';
import source from'./data/gesundbrunnenBridgeInkV309.json';
import{decodeBase64Bytes}from'./decodeBase64Bytes';
import{staticStorageInfo}from'./losslessStaticStorage';
import{freezeStaticSceneTransforms}from'./staticSceneTransforms';
import{markArchitecturalInk}from'./architecturalInk';
import{isSceneGeometryGpuRetirementV309}from'./sceneGeometryGpuResidency';
import{hasAuthoredOrStableInkRenderOrderV310}from'./stableInkRenderOrderV310';
import{hasCompleteGesundbrunnenRoadBridgesV309}from'./GesundbrunnenRoadBridgesV309';
type A=BufferAttribute|InterleavedBufferAttribute;
type AP={attribute:A;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;size:number;normalized:boolean;stride:number;offset:number};
type Pose={object:Object3D;parent:Object3D|null;matrix:number[];position:number[];quaternion:number[];scale:number[];auto:boolean;worldAuto:boolean};
type GP={geometry:BufferGeometry;attributes:Map<string,AP>;index:AP|null;start:number;count:number};
type Model={native:boolean;children:LineSegments[];geometry:GP[];materials:LineBasicMaterial[];pose:Pose[];disposed:boolean};
const models=new WeakMap<Group,Model>();
const watchedGeometry=new WeakSet<BufferGeometry>(),deadGeometry=new WeakSet<BufferGeometry>(),watchedMaterial=new WeakSet<LineBasicMaterial>(),deadMaterial=new WeakSet<LineBasicMaterial>();
function watchSourceLifetime(geometry:BufferGeometry,material:LineBasicMaterial):void{
 if(!watchedGeometry.has(geometry)){watchedGeometry.add(geometry);geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(geometry))deadGeometry.add(geometry);});}
 if(!watchedMaterial.has(material)){watchedMaterial.add(material);material.addEventListener('dispose',()=>deadMaterial.add(material));}
}
const store=(a:A)=>a instanceof InterleavedBufferAttribute?a.data:a;
const pin=(a:A):AP=>({attribute:a,storage:staticStorageInfo(store(a)),version:store(a).version,count:a.count,size:a.itemSize,normalized:a.normalized,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,offset:a instanceof InterleavedBufferAttribute?a.offset:0});
const pose=(object:Object3D):Pose=>({object,parent:object.parent,matrix:object.matrix.elements.slice(),position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),auto:object.matrixAutoUpdate,worldAuto:object.matrixWorldAutoUpdate});
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const poseMatches=(p:Pose)=>p.object.parent===p.parent&&same(p.object.matrix.elements,p.matrix)&&same(p.object.position.toArray(),p.position)&&same(p.object.quaternion.toArray(),p.quaternion)&&same(p.object.scale.toArray(),p.scale)&&p.object.matrixAutoUpdate===p.auto&&p.object.matrixWorldAutoUpdate===p.worldAuto;
function attributeMatches(a:A|null|undefined,p:AP){if(!a||a!==p.attribute||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||store(a).version!==p.version||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset)return false;const q=staticStorageInfo(store(a));return q.arrayIdentity===p.storage.arrayIdentity&&q.bufferIdentity===p.storage.bufferIdentity&&q.byteLength===p.storage.byteLength&&q.bufferBytes===p.storage.bufferBytes;}
const gp=(geometry:BufferGeometry):GP=>({geometry,attributes:new Map(Object.entries(geometry.attributes).map(([k,a])=>[k,pin(a)])),index:geometry.index?pin(geometry.index):null,start:geometry.drawRange.start,count:geometry.drawRange.count});
const geometryMatches=(g:BufferGeometry,p:GP)=>g===p.geometry&&g.drawRange.start===p.start&&g.drawRange.count===p.count&&Object.keys(g.attributes).length===p.attributes.size&&[...p.attributes].every(([k,a])=>attributeMatches(g.getAttribute(k),a))&&(p.index?attributeMatches(g.index,p.index):!g.index);
const belongs=(object:Object3D,root:Object3D)=>{for(let q:Object3D|null=object;q;q=q.parent)if(q===root)return true;return false;};
function canonicalHash(a:A){const array=store(a).array,width=array.BYTES_PER_ELEMENT,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),stride=a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,offset=a instanceof InterleavedBufferAttribute?a.offset:0;let h=2166136261;for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)for(let b=0;b<width;b++)h=Math.imul(h^bytes[((i*stride+offset+c)*width)+b],16777619)>>>0;return h;}
/** Independent native source has no smooth Worker curb-ink family. */
export function createGesundbrunnenBridgeInkModelV309(native=false):Group{
 if(source.schemaVersion!==1||source.retireSegments.length!==6||source.drawn.high.vertices<=0)throw Error('Incomplete exact source curb ink schema');
 const root=new Group();root.name='Required exact Badstraße curb ink v309';root.userData={nativeMinecraft:native,blockNative:native,keepInMinecraft:native,textureFree:true,fullStaticDetailOnTouch:true};
 const receipt:Model={native,children:[],geometry:[],materials:[],pose:[],disposed:false};
 if(!native)for(const[key,q]of Object.entries(source.drawn)){
  if(!q.vertices)continue;const bytes=decodeBase64Bytes(q.positions);if(q.vertices%2||bytes.byteLength!==q.vertices*12)throw Error('Incomplete exact bridge ink');
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),3));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.losslessStaticBacking=true;
  const material=markArchitecturalInk(new LineBasicMaterial(),'detail'),line=new LineSegments(geometry,material);line.name='Source curb ink '+key+' v309';line.renderOrder=source.source.renderOrder;line.userData={textureFree:true,fullStaticDetailOnTouch:true};root.add(line);
  geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(geometry))receipt.disposed=true;});material.addEventListener('dispose',()=>{receipt.disposed=true;});receipt.children.push(line);receipt.geometry.push(gp(geometry));receipt.materials.push(material);
 }
 if(!native&&!receipt.children.length)throw Error('Missing exact required high curb ink');freezeStaticSceneTransforms(root);receipt.pose=[pose(root),...root.children.map(pose)];models.set(root,receipt);return root;
}
/** Root parent belongs to the full bridge factory and may attach once there. */
export function adoptGesundbrunnenBridgeInkModelV309(root:Group):boolean{const r=models.get(root);if(!r||r.pose[0].parent!==null||!root.parent)return false;r.pose[0]=pose(root);return true;}
export function hasCompleteGesundbrunnenBridgeInkModelV309(root:Group,native?:boolean):boolean{const r=models.get(root);return !!r&&!r.disposed&&(native===undefined||native===r.native)&&root.visible&&root.children.length===r.children.length&&r.pose.every(poseMatches)&&r.children.every((c,i)=>root.children[i]===c&&c.parent===root&&c.visible&&hasAuthoredOrStableInkRenderOrderV310(c,source.source.renderOrder)&&c.material===r.materials[i]&&geometryMatches(c.geometry,r.geometry[i]));}
type Gate=boolean|(()=>boolean);
const ready=(gate:Gate)=>{try{return typeof gate==='function'?gate()===true:gate===true;}catch{return false;}};
export type GesundbrunnenBridgeInkTransactionV309={commit(gate:Gate,beforeSwap?:NorthCoreTerrainRebindV309):boolean;rollback():void;complete():boolean};
/** Cooperative staging owns only a private index clone. The source reference
 * stays unchanged until one final caller-controlled synchronous commit. */
export function* prepareGesundbrunnenBridgeInkV309Steps(world:Object3D,native:boolean,gate:Gate,replacement:Group):Generator<void,GesundbrunnenBridgeInkTransactionV309|null>{
 if(!ready(gate)||!hasCompleteGesundbrunnenRoadBridgesV309(replacement,native))return null;
 if(native){let unexpected=false;world.traverse(o=>{if(o instanceof LineSegments&&o.name===source.source.name&&o.parent?.name===source.source.parentName)unexpected=true;});if(unexpected)return null;let active=false,closed=false;return{commit(live){active=!closed&&ready(live)&&belongs(replacement,world)&&hasCompleteGesundbrunnenRoadBridgesV309(replacement,native);return active;},rollback(){active=false;closed=true;},complete:()=>active&&!closed&&belongs(replacement,world)&&hasCompleteGesundbrunnenRoadBridgesV309(replacement,native)};}
 const candidates:LineSegments[]=[];world.traverse(o=>{if(o instanceof LineSegments&&o.name===source.source.name&&o.parent?.name===source.source.parentName){let found=false;for(let p:Object3D|null=o;p;p=p.parent)if(p.userData.progressiveWorldBatchId===source.source.batchId)found=true;if(found)candidates.push(o);}});
 if(candidates.length!==1)return null;const line=candidates[0],original=line.geometry,material=line.material;if(!(material instanceof LineBasicMaterial)||deadGeometry.has(original)||deadMaterial.has(material)||!hasAuthoredOrStableInkRenderOrderV310(line,source.source.renderOrder)||!same(line.matrix.elements,source.source.matrix)||Object.keys(original.attributes).length!==Object.keys(source.source.attributes).length)return null;
 const expectedPosition=new Vector3(),expectedQuaternion=new Quaternion(),expectedScale=new Vector3();new Matrix4().fromArray(source.source.matrix).decompose(expectedPosition,expectedQuaternion,expectedScale);
 if(!same(line.position.toArray(),expectedPosition.toArray())||!same(line.quaternion.toArray(),expectedQuaternion.toArray())||!same(line.scale.toArray(),expectedScale.toArray())||original.drawRange.start!==0||original.drawRange.count!==Infinity&&original.drawRange.count!==source.source.index.count)return null;
 const guards=source.source.attributes as Record<string,{type:string;itemSize:number;count:number;normalized:boolean;hash:number}>;
 for(const[k,p]of Object.entries(guards)){const a=original.getAttribute(k);if(!a||store(a).array.constructor.name!==p.type||a.itemSize!==p.itemSize||a.count!==p.count||a.normalized!==p.normalized||canonicalHash(a)!==p.hash)return null;yield;}
 if(!original.index||original.index.array.constructor.name!==source.source.index.type||original.index.count!==source.source.index.count||canonicalHash(original.index)!==source.source.index.hash)return null;
 watchSourceLifetime(original,material);const old=gp(original),linePose=pose(line),lineage:Pose[]=[];for(let p=line.parent;p;p=p.parent)lineage.push(pose(p));const cloned=original.clone();if(!cloned.index){cloned.dispose();return null;}
 for(const segment of source.retireSegments){const at=segment*2;if(at+1>=cloned.index.count){cloned.dispose();return null;}cloned.index.array[at+1]=cloned.index.array[at];}cloned.index.needsUpdate=true;
 const live=gp(cloned);let invalid=false,closed=false,published=false,rebind:NorthCoreTerrainRebindV309|undefined;
 const invalidateGeometry=(geometry:BufferGeometry)=>{if(!isSceneGeometryGpuRetirementV309(geometry))invalid=true;},oldDisposed=()=>invalidateGeometry(original),newDisposed=()=>invalidateGeometry(cloned),materialDisposed=()=>{invalid=true;};original.addEventListener('dispose',oldDisposed);cloned.addEventListener('dispose',newDisposed);material.addEventListener('dispose',materialDisposed);
 const base=()=>!closed&&!invalid&&!deadGeometry.has(original)&&!deadMaterial.has(material)&&ready(gate)&&hasAuthoredOrStableInkRenderOrderV310(line,source.source.renderOrder)&&line.material===material&&line.visible&&belongs(line,world)&&poseMatches(linePose)&&lineage.every(poseMatches)&&hasCompleteGesundbrunnenRoadBridgesV309(replacement,native);
 const cleanup=()=>{original.removeEventListener('dispose',oldDisposed);cloned.removeEventListener('dispose',newDisposed);material.removeEventListener('dispose',materialDisposed);};
 const rollback=()=>{if(closed)return;closed=true;if(published&&line.geometry===cloned){try{rebind?.(line,'geometry');}catch{/* Exact CPU restoration also applies after a renderer was retired. */}line.geometry=original;}cleanup();cloned.dispose();published=false;};
 let delivered=false;try{
 if(!base()||!geometryMatches(line.geometry,old)){rollback();return null;}yield;
 delivered=true;return{commit(liveGate,beforeSwap){if(published){if(base()&&ready(liveGate)&&geometryMatches(line.geometry,live)&&belongs(replacement,world))return true;rollback();return false;}if(!base()||!ready(liveGate)||!belongs(replacement,world)||!geometryMatches(line.geometry,old)){rollback();return false;}rebind=beforeSwap;try{if(beforeSwap?.(line,'geometry')===false){rollback();return false;}line.geometry=cloned;published=true;if(!base()||!geometryMatches(line.geometry,live)){rollback();return false;}return true;}catch{rollback();return false;}},rollback,complete:()=>published&&base()&&belongs(replacement,world)&&geometryMatches(line.geometry,live)};
 }finally{if(!delivered)rollback();}
}
