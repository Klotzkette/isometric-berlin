import {isSceneMaterialProgramRetirementV321} from "./sceneMaterialPrograms";
/** Reversible, complete-source core ground transfer. No source array is edited.
 * Preparation owns private copied buffers until one synchronous publication.
 * The matching required inside surfaces belong to the caller's full gate. */
import {BufferAttribute,BufferGeometry,Group,InstancedBufferAttribute,InstancedMesh,InterleavedBufferAttribute,Material,Mesh,MeshBasicMaterial,MeshStandardMaterial,Matrix4,Quaternion,Vector3,type Object3D} from "three";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {staticStorageInfo} from "./losslessStaticStorage";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
import {isSceneInstanceGpuRetirementV309} from "./sceneGpuResidency";
import {freezeStaticSceneTransform} from "./staticSceneTransforms";
import {hasSchwellenraumMaterialProvenance,schwellenraumMaterialFor} from "./visual-modes/schwellenraum/materialGrade";
import {hasMinecraftMaterialProvenance,copyMinecraftMaterialPresentation,releaseCopiedMinecraftMaterialPresentation,minecraftOriginalMaterialFor} from "./visual-modes/minecraft/materialMode";

type AttributeGuard={type:string;itemSize:number;count:number;normalized:boolean;hash:number};
type MaterialGuard={color:number[];type:string;vertexColors:boolean;side:number;roughness?:number;metalness?:number};
type Packed={key:string;native:boolean;positionType:string;colorType:string;origin:number[];positions:string;colors:string;normals:string;indices:string;vertices:number;triangles:number};
type Part={name:string;parentName:string;batchId?:string|null;matrix:number[];attributes:Record<string,AttributeGuard>;index:{type:string;count:number;hash:number}|null;instances:{count:number;matrixHash:number;colorHash:number|null}|null;materials:{day:MaterialGuard;night:MaterialGuard};retireKind:"instances"|"triangles";retire:number[];outside:Packed|null;outsideAdditions?:Packed[]};
type Variant={captureSha256:string;parts:Part[]};
export type NorthCoreTerrainRecipesV309={schemaVersion:number;variants:Record<string,Variant>};
type Gate=boolean|(()=>boolean);
export type NorthCoreTerrainRebindV309=(object:Object3D,kind:"geometry"|"instances")=>boolean;
export type NorthCoreTerrainTransactionV309={commit:(liveCompleteGate:Gate,beforeSwap?:NorthCoreTerrainRebindV309)=>boolean;rollback:()=>void;complete:()=>boolean};
type VertexAttribute=BufferAttribute|InterleavedBufferAttribute;
type A={attribute:VertexAttribute;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;size:number;normalized:boolean;per:number|undefined;offset:number;stride:number};
type G={geometry:BufferGeometry;attributes:Map<string,A>;index:A|null;drawStart:number;drawCount:number};
type T={matrix:number[];position:number[];quaternion:number[];scale:number[];auto:boolean;worldAuto:boolean};
type Outside={mesh:Mesh;geometry:G;transform:T;day:Material;night:Material;grade:Material};
type Stage={mesh:Mesh;parent:Object3D;transform:T;parentTransform:T;oldGeometry:G;liveGeometry:G;oldMatrix:A|null;liveMatrix:A|null;color:A|null;outsides:Outside[];day:Material;night:Material;part:Part};
type State={root:Group;native:boolean;source:NorthCoreTerrainRecipesV309;variantKey:string;variant:Variant;gate:Gate;transform:T;parts:Stage[];resources:Set<BufferGeometry|Material>;hooks:(()=>void)[];disposed:boolean;published:boolean;beforeSwap?:NorthCoreTerrainRebindV309};
const storage=(a:VertexAttribute)=>a instanceof InterleavedBufferAttribute?a.data:a;
const attrPin=(a:VertexAttribute):A=>({attribute:a,storage:staticStorageInfo(storage(a)),version:storage(a).version,count:a.count,size:a.itemSize,normalized:a.normalized,per:a instanceof InstancedBufferAttribute?a.meshPerAttribute:undefined,offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize});
const geometryPin=(geometry:BufferGeometry):G=>({geometry,attributes:new Map(Object.entries(geometry.attributes).map(([k,a])=>[k,attrPin(a)])),index:geometry.index?attrPin(geometry.index):null,drawStart:geometry.drawRange.start,drawCount:geometry.drawRange.count});
const transformPin=(o:Object3D):T=>({matrix:o.matrix.elements.slice(),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),auto:o.matrixAutoUpdate,worldAuto:o.matrixWorldAutoUpdate});
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const transformMatches=(o:Object3D,p:T)=>same(o.matrix.elements,p.matrix)&&same(o.position.toArray(),p.position)&&same(o.quaternion.toArray(),p.quaternion)&&same(o.scale.toArray(),p.scale)&&o.matrixAutoUpdate===p.auto&&o.matrixWorldAutoUpdate===p.worldAuto;
function attrMatches(a:VertexAttribute|null|undefined,p:A):boolean {if(!a||a!==p.attribute||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InstancedBufferAttribute?a.meshPerAttribute:undefined)!==p.per||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;const s=staticStorageInfo(storage(a));return s.arrayIdentity===p.storage.arrayIdentity&&s.bufferIdentity===p.storage.bufferIdentity&&s.byteLength===p.storage.byteLength&&s.bufferBytes===p.storage.bufferBytes;}
function geometryMatches(g:BufferGeometry,p:G):boolean{return g===p.geometry&&g.drawRange.start===p.drawStart&&g.drawRange.count===p.drawCount&&Object.keys(g.attributes).length===p.attributes.size&&[...p.attributes].every(([k,a])=>attrMatches(g.getAttribute(k)as BufferAttribute,a))&&(p.index?attrMatches(g.index,p.index):!g.index);}
const belongs=(o:Object3D,root:Object3D)=>{for(let p:Object3D|null=o;p;p=p.parent)if(p===root)return true;return false;};
const admitted=(gate:Gate)=>{try{return typeof gate==="function"?gate()===true:gate===true;}catch{return false;}};
const sourceMaterials=(mesh:Mesh)=>{const original=minecraftOriginalMaterialFor(mesh)??mesh.material;return{day:mesh.userData.dayMaterial??original,night:mesh.userData.nightMaterial??original};};
function freeze(value:unknown):void {if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}}
function* hash(bytes:Uint8Array):Generator<void,number>{let h=2166136261;for(let start=0;start<bytes.length;start+=65536){for(let i=start;i<Math.min(start+65536,bytes.length);i++)h=Math.imul(h^bytes[i],16777619)>>>0;yield;}return h;}
function* textHash(text:string):Generator<void,number>{let h=2166136261;for(let start=0;start<text.length;start+=65536){for(let i=start;i<Math.min(start+65536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}return h;}
function bytes(a:VertexAttribute):Uint8Array {const array=storage(a).array,source=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);if(!(a instanceof InterleavedBufferAttribute))return source;const width=array.BYTES_PER_ELEMENT,result=new Uint8Array(a.count*a.itemSize*width);for(let vertex=0;vertex<a.count;vertex++)for(let c=0;c<a.itemSize;c++){const from=(vertex*a.data.stride+a.offset+c)*width;result.set(source.subarray(from,from+width),(vertex*a.itemSize+c)*width);}return result;}
function materialMatches(m:Material,p:MaterialGuard):boolean {if(!(m instanceof MeshBasicMaterial||m instanceof MeshStandardMaterial))return false;return m.type===p.type&&same(m.color.toArray(),p.color)&&m.vertexColors===p.vertexColors&&m.side===p.side&&(p.roughness===undefined||m instanceof MeshStandardMaterial&&m.roughness===p.roughness)&&(p.metalness===undefined||m instanceof MeshStandardMaterial&&m.metalness===p.metalness);}
function kind(mesh:Mesh,day:Material,night:Material):"day"|"night"|"grade"|null {const current=mesh.material;if(Array.isArray(current))return null;const grade=mesh.userData.schwellenraumMaterial;if(current===day)return"day";if(current===night)return"night";if(hasSchwellenraumMaterialProvenance(mesh,day,current))return"grade";if(grade instanceof Material&&hasSchwellenraumMaterialProvenance(mesh,day,grade)&&hasMinecraftMaterialProvenance(mesh,grade,current))return"grade";if(hasMinecraftMaterialProvenance(mesh,night,current))return"night";return hasMinecraftMaterialProvenance(mesh,day,current)?"day":null;}
function specMatches(mesh:Mesh,p:Part):boolean {
 if(!mesh.visible||mesh.name!==p.name||mesh.parent?.name!==p.parentName||!same(mesh.matrix.elements,p.matrix)||Object.keys(mesh.geometry.attributes).length!==Object.keys(p.attributes).length)return false;
 if(p.batchId){let found=false;for(let o:Object3D|null=mesh;o;o=o.parent)if(o.userData.progressiveWorldBatchId===p.batchId){found=true;break;}if(!found)return false;}
 const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();new Matrix4().fromArray(p.matrix).decompose(position,rotation,scale);if(!same(mesh.position.toArray(),position.toArray())||!same(mesh.quaternion.toArray(),rotation.toArray())||!same(mesh.scale.toArray(),scale.toArray()))return false;
 for(const[k,g]of Object.entries(p.attributes)){const a=mesh.geometry.getAttribute(k);if(!a||storage(a).array.constructor.name!==g.type||a.count!==g.count||a.itemSize!==g.itemSize||a.normalized!==g.normalized)return false;}
 const ix=mesh.geometry.index;if(p.index?(!ix||ix.array.constructor.name!==p.index.type||ix.count!==p.index.count||ix.itemSize!==1||ix.normalized):!!ix)return false;
 const count=ix?.count??mesh.geometry.getAttribute("position").count;if(mesh.geometry.drawRange.start!==0||mesh.geometry.drawRange.count!==Infinity&&mesh.geometry.drawRange.count!==count)return false;
 if(p.instances){if(!(mesh instanceof InstancedMesh)||mesh.count!==p.instances.count||mesh.instanceMatrix.count!==p.instances.count||!(mesh.instanceMatrix.array instanceof Float32Array)||(p.instances.colorHash===null?!!mesh.instanceColor:!mesh.instanceColor))return false;}else if(mesh instanceof InstancedMesh)return false;
 const{day,night}=sourceMaterials(mesh);
 return day instanceof Material&&night instanceof Material&&materialMatches(day,p.materials.day)&&materialMatches(night,p.materials.night)&&kind(mesh,day,night)!==null;
}
function disposeState(s:State):void {for(const hook of s.hooks)hook();s.hooks=[];for(const p of s.parts){for(const outside of p.outsides){releaseCopiedMinecraftMaterialPresentation(outside.mesh);outside.mesh.removeFromParent();}if(p.mesh.geometry===p.liveGeometry.geometry&&p.liveGeometry.geometry!==p.oldGeometry.geometry){try{s.beforeSwap?.(p.mesh,"geometry");}catch{/* CPU rollback must survive a retired renderer. */}p.mesh.geometry=p.oldGeometry.geometry;}if(p.mesh instanceof InstancedMesh&&p.liveMatrix&&p.mesh.instanceMatrix===p.liveMatrix.attribute&&p.liveMatrix.attribute!==p.oldMatrix?.attribute){try{s.beforeSwap?.(p.mesh,"instances");}catch{/* Preserve the exact original CPU source on cleanup. */}p.mesh.instanceMatrix=p.oldMatrix!.attribute as InstancedBufferAttribute;}}for(const resource of s.resources)resource.dispose();s.resources.clear();s.published=false;}
function observe(s:State,geometry:BufferGeometry,day:Material,night:Material):void {const invalid=()=>{s.disposed=true;};const geometryInvalid=()=>{if(!isSceneGeometryGpuRetirementV309(geometry))invalid();};geometry.addEventListener("dispose",geometryInvalid);const dayInvalid=()=>{if(!isSceneMaterialProgramRetirementV321(day))invalid();},nightInvalid=()=>{if(!isSceneMaterialProgramRetirementV321(night))invalid();};day.addEventListener("dispose",dayInvalid);night.addEventListener("dispose",nightInvalid);s.hooks.push(()=>{geometry.removeEventListener("dispose",geometryInvalid);day.removeEventListener("dispose",dayInvalid);night.removeEventListener("dispose",nightInvalid);});}
function makeOutside(s:State,q:Packed|null,source:Mesh,day:Material,night:Material):Outside|null {
 if(!q)return null;if(q.positionType!=="f32"||q.colorType!=="f32linear"||q.native!==s.native||q.origin.length!==3||q.origin.some(v=>v!==0)||!Number.isSafeInteger(q.vertices)||!Number.isSafeInteger(q.triangles)||q.vertices<=0||q.triangles<=0)throw Error("Invalid complete core outside complement");
 const ps=decodeBase64Bytes(q.positions),cs=decodeBase64Bytes(q.colors),ns=decodeBase64Bytes(q.normals),ix=decodeBase64Bytes(q.indices);if(ps.byteLength!==q.vertices*12||cs.byteLength!==q.vertices*12||ns.byteLength!==q.vertices*12||ix.byteLength!==q.triangles*12)throw Error("Incomplete core outside attributes");
 const position=new Float32Array(ps.buffer,ps.byteOffset,ps.byteLength/4),color=new Float32Array(cs.buffer,cs.byteOffset,cs.byteLength/4),normal=new Float32Array(ns.buffer,ns.byteOffset,ns.byteLength/4),indices=new Uint32Array(ix.buffer,ix.byteOffset,ix.byteLength/4);if(position.some(v=>!Number.isFinite(v))||color.some(v=>!Number.isFinite(v))||normal.some(v=>!Number.isFinite(v))||indices.some(i=>i>=q.vertices))throw Error("Invalid core outside values");
 const g=new BufferGeometry();s.resources.add(g);g.setAttribute("position",new BufferAttribute(position,3));g.setAttribute("color",new BufferAttribute(color,3));g.setAttribute("normal",new BufferAttribute(normal,3));g.setIndex(new BufferAttribute(indices,1));g.computeBoundingBox();g.computeBoundingSphere();g.userData.losslessStaticBacking=true;
 const d=day.clone()as MeshBasicMaterial|MeshStandardMaterial,n=night.clone()as MeshBasicMaterial|MeshStandardMaterial;d.vertexColors=true;n.vertexColors=true;s.resources.add(d);s.resources.add(n);
 const mesh=new Mesh(g,d);mesh.name=source.name;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;mesh.matrix.copy(source.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.userData={dayMaterial:d,nightMaterial:n,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:s.native,blockNative:s.native,keepInMinecraft:s.native,northCoreOutsideV309:true,northCoreOutsideKeyV309:q.key};const grade=schwellenraumMaterialFor(mesh,d);s.resources.add(grade);freezeStaticSceneTransform(mesh);observe(s,g,d,n);
 return{mesh,geometry:geometryPin(g),transform:transformPin(mesh),day:d,night:n,grade};
}
function syncOutside(p:Stage,out:Outside):boolean {const k=kind(p.mesh,p.day,p.night);if(!k)return false;if(p.day instanceof MeshStandardMaterial&&out.day instanceof MeshStandardMaterial){out.day.emissive.copy(p.day.emissive);out.day.emissiveIntensity=p.day.emissiveIntensity;}if(p.night instanceof MeshStandardMaterial&&out.night instanceof MeshStandardMaterial){out.night.emissive.copy(p.night.emissive);out.night.emissiveIntensity=p.night.emissiveIntensity;}const voxel=hasMinecraftMaterialProvenance(p.mesh,p.day,p.mesh.material)||hasMinecraftMaterialProvenance(p.mesh,p.night,p.mesh.material);if(voxel&&kind(out.mesh,out.day,out.night)===k&&copyMinecraftMaterialPresentation(p.mesh,out.mesh))return true;releaseCopiedMinecraftMaterialPresentation(out.mesh);out.mesh.material=k==="grade"?out.grade:k==="night"?out.night:out.day;return voxel?copyMinecraftMaterialPresentation(p.mesh,out.mesh):true;}

function sync(p:Stage):boolean{return p.outsides.every(out=>syncOutside(p,out));}

/** The factory isolates synthetic source tests from the fixed production
 * catalogue. Its private receipts never admit the default production helper. */
export function createNorthCoreTerrainControllerV309(controls:Readonly<Record<string,number>>,joinDrawnInitial=false) {
 const expected=Object.freeze({...controls}),states=new WeakMap<Group,State>(),pending=new WeakMap<Group,State>(),epochs=new WeakMap<Group,number>(),validated=new WeakMap<object,Map<string,Variant>>(),joined=new WeakMap<object,{initial:Variant;worker:Variant;value:Variant}>();
 const variantFor=(source:NorthCoreTerrainRecipesV309,key:string):Variant|undefined=>{if(source?.schemaVersion!==1||!source.variants||typeof source.variants!=="object")return undefined;if(!joinDrawnInitial||key!=="drawn-worker")return source.variants[key];const initial=source.variants["drawn-initial"],worker=source.variants["drawn-worker"];if(!initial||!worker)return undefined;let cached=joined.get(source);if(!cached||cached.initial!==initial||cached.worker!==worker){cached={initial,worker,value:{captureSha256:initial.captureSha256+":"+worker.captureSha256,parts:[...initial.parts,...worker.parts]}};joined.set(source,cached);}return cached.value;};
 function intact(s:State):boolean {return s.published&&!s.disposed&&admitted(s.gate)&&transformMatches(s.root,s.transform)&&variantFor(s.source,s.variantKey)===s.variant&&s.parts.every(p=>p.mesh.visible&&p.mesh.parent===p.parent&&belongs(p.mesh,s.root)&&transformMatches(p.mesh,p.transform)&&transformMatches(p.parent,p.parentTransform)&&geometryMatches(p.oldGeometry.geometry,p.oldGeometry)&&geometryMatches(p.mesh.geometry,p.liveGeometry)&&(!p.oldMatrix||p.mesh instanceof InstancedMesh&&p.mesh.count===p.part.instances?.count&&attrMatches(p.mesh.instanceMatrix,p.liveMatrix!))&&(!p.color||p.mesh instanceof InstancedMesh&&attrMatches(p.mesh.instanceColor,p.color))&&sourceMaterials(p.mesh).day===p.day&&sourceMaterials(p.mesh).night===p.night&&materialMatches(p.day,p.part.materials.day)&&materialMatches(p.night,p.part.materials.night)&&kind(p.mesh,p.day,p.night)!==null&&p.outsides.every(out=>out.mesh.parent===p.parent&&out.mesh.visible&&transformMatches(out.mesh,out.transform)&&geometryMatches(out.mesh.geometry,out.geometry)&&out.mesh.userData.dayMaterial===out.day&&out.mesh.userData.nightMaterial===out.night&&out.mesh.userData.schwellenraumMaterial===out.grade&&kind(out.mesh,out.day,out.night)!==null));}
 const revoke=(root:Group):void=>{epochs.set(root,(epochs.get(root)??0)+1);for(const map of [states,pending]){const s=map.get(root);if(s){map.delete(root);disposeState(s);s.disposed=true;}}};
 const complete=(root:Group,native?:boolean):boolean=>{const s=states.get(root);return !!s&&(native===undefined||native===s.native)&&intact(s);};
 const originalStillPresent=(s:State)=>!s.disposed&&admitted(s.gate)&&variantFor(s.source,s.variantKey)===s.variant&&transformMatches(s.root,s.transform)&&s.parts.every(p=>p.mesh.visible&&p.mesh.parent===p.parent&&belongs(p.mesh,s.root)&&transformMatches(p.mesh,p.transform)&&transformMatches(p.parent,p.parentTransform)&&geometryMatches(p.mesh.geometry,p.oldGeometry)&&(!p.oldMatrix||p.mesh instanceof InstancedMesh&&p.mesh.count===p.part.instances?.count&&attrMatches(p.mesh.instanceMatrix,p.oldMatrix))&&(!p.color||p.mesh instanceof InstancedMesh&&attrMatches(p.mesh.instanceColor,p.color))&&sourceMaterials(p.mesh).day===p.day&&sourceMaterials(p.mesh).night===p.night&&materialMatches(p.day,p.part.materials.day)&&materialMatches(p.night,p.part.materials.night)&&kind(p.mesh,p.day,p.night)!==null);
 function* prepareSteps(root:Group,native=false,gate:Gate=false,source:NorthCoreTerrainRecipesV309):Generator<void,NorthCoreTerrainTransactionV309|null> {
  if(states.has(root))return null;
  const epoch=(epochs.get(root)??0)+1;epochs.set(root,epoch);
  const previous=pending.get(root);if(previous){pending.delete(root);disposeState(previous);previous.disposed=true;}
  if(!admitted(gate)||source?.schemaVersion!==1||!source.variants)return null;
  const candidates=[];
  for(const key of native?["minecraft"]:joinDrawnInitial?["drawn-worker"]:["drawn-initial","drawn-worker"]){const v=variantFor(source,key);if(!v||!v.parts.length)continue;const meshes:Mesh[]=[];let valid=true;for(const p of v.parts){const found:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh&&specMatches(o,p))found.push(o);});if(found.length!==1){valid=false;break;}meshes.push(found[0]);}if(valid)candidates.push({key,v,meshes});}
  if(candidates.length!==1)return null;
  const{key,v,meshes}=candidates[0];let seen=validated.get(source);const rawKeys=joinDrawnInitial&&key==="drawn-worker"?["drawn-initial","drawn-worker"]:[key];for(const rawKey of rawKeys){const rawVariant=source.variants[rawKey];if(seen?.get(rawKey)!==rawVariant){const text=JSON.stringify(rawVariant);if((yield*textHash(text))!==expected[rawKey]||JSON.stringify(source.variants[rawKey])!==text||!admitted(gate))return null;freeze(rawVariant);if(!seen){seen=new Map();validated.set(source,seen);}seen.set(rawKey,rawVariant);}}freeze(v);
  if(epochs.get(root)!==epoch)return null;
  const s:State={root,native,source,variantKey:key,variant:v,gate,transform:transformPin(root),parts:[],resources:new Set(),hooks:[],disposed:false,published:false};
  let retained=false;pending.set(root,s);
  try{
   for(let i=0;i<v.parts.length;i++){
    if(!admitted(gate)||s.disposed||!specMatches(meshes[i],v.parts[i]))return null;
    const mesh=meshes[i],p=v.parts[i],parent=mesh.parent!,{day,night}=sourceMaterials(mesh),oldGeometry=geometryPin(mesh.geometry),oldMatrix=mesh instanceof InstancedMesh?attrPin(mesh.instanceMatrix):null,color=mesh instanceof InstancedMesh&&mesh.instanceColor?attrPin(mesh.instanceColor):null;
    observe(s,mesh.geometry,day,night);
    if(mesh instanceof InstancedMesh){const instanceInvalid=()=>{if(!isSceneInstanceGpuRetirementV309(mesh))s.disposed=true;};mesh.addEventListener("dispose",instanceInvalid);s.hooks.push(()=>mesh.removeEventListener("dispose",instanceInvalid));}
    // A parked borrowed array may detach at the end of the current JS job.
    // Owned clones are made synchronously before any cooperative checkpoint.
    const cloned=mesh.geometry.clone();s.resources.add(cloned);
    for(const[name,g]of Object.entries(p.attributes)){const a=cloned.getAttribute(name)as BufferAttribute;if((yield*hash(bytes(a)))!==g.hash)return null;}
    if(p.index&&(yield*hash(bytes(cloned.index!)))!==p.index.hash)return null;
    let liveGeometry=oldGeometry,liveMatrix=oldMatrix;
    if(p.retireKind==="instances"){
     if(!(mesh instanceof InstancedMesh)||!p.instances)return null;
     const matrix=mesh.instanceMatrix.clone();if((yield*hash(bytes(matrix)))!==p.instances.matrixHash)return null;
     if(p.instances.colorHash!==null){const c=mesh.instanceColor?.clone();if(!c||(yield*hash(bytes(c)))!==p.instances.colorHash)return null;}
     if(p.retire.some((n,j)=>!Number.isSafeInteger(n)||n<0||n>=mesh.count||j>0&&n<=p.retire[j-1]))return null;
     for(const n of p.retire){(matrix.array as Float32Array).fill(0,n*16,n*16+16);matrix.array[n*16+15]=1;}matrix.needsUpdate=true;liveMatrix=attrPin(matrix);s.resources.delete(cloned);cloned.dispose();
    }else{
     if(mesh instanceof InstancedMesh||p.instances)return null;
     if(!cloned.index)cloned.setIndex(new BufferAttribute(Uint32Array.from({length:cloned.getAttribute("position").count},(_,j)=>j),1));const ix=cloned.index!;
     if(p.retire.some((n,j)=>!Number.isSafeInteger(n)||n<0||n>=ix.count/3||j>0&&n<=p.retire[j-1]))return null;
     for(const n of p.retire){ix.array[n*3+1]=ix.array[n*3];ix.array[n*3+2]=ix.array[n*3];}ix.needsUpdate=true;liveGeometry=geometryPin(cloned);observe(s,cloned,day,night);
    }
    const stage:Stage={mesh,parent,transform:transformPin(mesh),parentTransform:transformPin(parent),oldGeometry,liveGeometry,oldMatrix,liveMatrix,color,outsides:[],day,night,part:p};s.parts.push(stage);for(const q of[p.outside,...p.outsideAdditions??[]]){const outside=makeOutside(s,q,mesh,day,night);if(outside)stage.outsides.push(outside);}
   }
   if(!originalStillPresent(s))return null;
   retained=true;
   return{commit(liveCompleteGate:Gate,beforeSwap?:NorthCoreTerrainRebindV309):boolean{
    if(s.published){if(states.get(root)===s&&admitted(liveCompleteGate)&&intact(s)){s.gate=liveCompleteGate;return s.parts.every(sync)&&intact(s);}revoke(root);return false;}
    if(pending.get(root)!==s||!admitted(liveCompleteGate)||!originalStillPresent(s)){if(pending.get(root)===s)pending.delete(root);disposeState(s);s.disposed=true;return false;}
    pending.delete(root);s.gate=liveCompleteGate;s.beforeSwap=beforeSwap;s.published=true;states.set(root,s);
    try{for(const p of s.parts){if(p.liveGeometry.geometry!==p.oldGeometry.geometry&&beforeSwap?.(p.mesh,"geometry")===false)throw Error("Shared Core geometry cannot rebind");if(p.liveMatrix?.attribute!==p.oldMatrix?.attribute&&beforeSwap?.(p.mesh,"instances")===false)throw Error("Shared Core instance storage cannot rebind");}for(const p of s.parts){p.mesh.geometry=p.liveGeometry.geometry;if(p.mesh instanceof InstancedMesh)p.mesh.instanceMatrix=p.liveMatrix!.attribute as InstancedBufferAttribute;for(const outside of p.outsides)p.parent.add(outside.mesh);}if(!s.parts.every(sync)||!intact(s)){revoke(root);return false;}return true;}catch{revoke(root);return false;}
   },rollback(){if(states.get(root)===s)states.delete(root);if(pending.get(root)===s)pending.delete(root);disposeState(s);s.disposed=true;},complete:()=>states.get(root)===s&&intact(s)};
  }catch{return null;}
  finally{if(!retained){if(pending.get(root)===s)pending.delete(root);disposeState(s);s.disposed=true;}}
 }
 function* steps(root:Group,native=false,gate:Gate=false,source:NorthCoreTerrainRecipesV309):Generator<void,boolean>{const prior=states.get(root);if(prior){if(prior.native===native&&prior.source===source&&admitted(gate)&&intact(prior)){prior.gate=gate;if(prior.parts.every(sync)&&intact(prior))return true;}revoke(root);}const tx=yield*prepareSteps(root,native,gate,source);return tx?.commit(gate)??false;}
 return{prepareSteps,steps,complete,revoke,apply(root:Group,native=false,gate:Gate=false,source:NorthCoreTerrainRecipesV309):boolean{const g=steps(root,native,gate,source);let r=g.next();while(!r.done)r=g.next();return r.value;}};
}

const production=createNorthCoreTerrainControllerV309({"drawn-initial":691981172,"drawn-worker":2745148416,minecraft:398998653},true);
export const applyNorthCoreTerrainV309=production.apply;
export const applyNorthCoreTerrainV309Steps=production.steps;
export const prepareNorthCoreTerrainV309Steps=production.prepareSteps;
export const hasCompleteNorthCoreTerrainV309=production.complete;
export const revokeNorthCoreTerrainV309=production.revoke;
