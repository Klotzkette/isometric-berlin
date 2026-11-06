/** Complete finite, source-bound joinery. Existing buildings remain the owners
 * of every wall, roof, courtyard and walking surface. No body is drawn here. */
import {
  BoxGeometry, BufferAttribute, Color, Group, InstancedBufferAttribute,
  InstancedMesh, InterleavedBufferAttribute, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Vector3, type Material, type Object3D,
} from 'three';
import data from './data/wilhelmHousingV324.json';
import { bindWilhelmHousingV324SourcesSteps, hasWilhelmHousingV324Sources,
  type WilhelmHousingSourcesV324Receipt } from './WilhelmHousingV324Sources';
import { interleaveStaticGeometry } from './interleaveStaticGeometry';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { isParkedStaticStorageV321, staticStorageInfo } from './losslessStaticStorage';
import { isSceneGeometryGpuRetirementV309 } from './sceneGeometryGpuResidency';
import { isSceneInstanceGpuRetirementV309 } from './sceneGpuResidency';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';
import { schwellenraumMaterialFor } from './visual-modes/schwellenraum/materialGrade';
import { hasMinecraftMaterialProvenance } from './visual-modes/minecraft/materialMode';

type Row = [number,number,number,number,number,number,number,number,string,number];
type Profile = {schemaVersion:number;families:{id:string;parts:string[];style:string}[];
  references:string[];estimates:object;runs:{id:number;family:string;windowCount:number}[];drawn:Row[];native:Row[]};
const source = data as unknown as Profile;
// Generated over the complete finite recipe. Unknown, changed or partial input
// cannot acquire a private model receipt, even if public labels are copied.
const METADATA_CONTROL = 2242021758, DRAWN_ROWS_CONTROL = 1983764761, NATIVE_ROWS_CONTROL = 2118526591;
const jsonHash=(q:unknown):number=>{let h=2166136261;for(const c of JSON.stringify(q))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const META_KEYS=['schemaVersion','references','families','runs','estimates']as const;
const metadata=()=>Object.fromEntries(META_KEYS.map(k=>{const d=Object.getOwnPropertyDescriptor(source,k);return[k,d&&'value'in d?d.value:undefined];}));
type MetaPin={object:object;prototype:object|null;keyCount:number;fields:[PropertyKey,PropertyDescriptor][]};
function metaPins(value:unknown,pins:MetaPin[]=[],seen=new Set<object>()):MetaPin[]|null {
  if(value===null||typeof value!=='object')return pins;
  if(seen.has(value))return null;seen.add(value);
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value);
  if(array?proto!==Array.prototype||keys.length!==value.length+1||Array.from({length:value.length},(_,i)=>String(i)).some(k=>!Object.hasOwn(value,k)):proto!==Object.prototype&&proto!==null)return null;
  const fields:MetaPin['fields']=[];
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key)!;if(!('value'in d)||typeof key!=='string'||key!=='length'&&!d.enumerable)return null;fields.push([key,d]);if(!metaPins(d.value,pins,seen))return null;}
  pins.push({object:value,prototype:proto,keyCount:keys.length,fields});return pins;
}
const sameMetadata=(pins:MetaPin[])=>pins.every(p=>Object.getPrototypeOf(p.object)===p.prototype&&Reflect.ownKeys(p.object).length===p.keyCount&&p.fields.every(([key,d])=>{const q=Object.getOwnPropertyDescriptor(p.object,key);return q&&'value'in q&&Object.is(q.value,d.value)&&q.writable===d.writable&&q.enumerable===d.enumerable&&q.configurable===d.configurable;}));
type Attr=BufferAttribute|InterleavedBufferAttribute;
const storage=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:number[])=>pose(o).every((v,i)=>Object.is(v,p[i]));
function words(a:Attr):number {
  const s=storage(a),values=s.array,b=new Uint8Array(values.buffer,values.byteOffset,values.byteLength);
  let h=2166136261;const w=new Uint32Array(b.buffer,b.byteOffset,Math.floor(b.byteLength/4));
  for(let i=0;i<w.length;i++)h=Math.imul(h^w[i],16777619)>>>0;
  for(let i=w.length*4;i<b.length;i++)h=Math.imul(h^b[i],16777619)>>>0;
  return h;
}
type Pin={a:Attr;version:number;count:number;size:number;normalized:boolean;offset:number;stride:number;
  info:ReturnType<typeof staticStorageInfo>;hash:number};
const pin=(a:Attr):Pin=>({a,version:storage(a).version,count:a.count,size:a.itemSize,normalized:a.normalized,
  offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,
  info:staticStorageInfo(storage(a)),hash:words(a)});
function intact(a:Attr|null|undefined,p:Pin):boolean {
  if(!a||a!==p.a||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||
    (a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;
  const s=storage(a),q=staticStorageInfo(s);
  return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes&&
    (isParkedStaticStorageV321(s)||words(a)===p.hash);
}
type Member={mesh:InstancedMesh;geometry:InstancedMesh['geometry'];attributes:[string,Pin][];index:Pin;
  matrix:Pin;color:Pin;pose:number[];count:number;day:Material;night:Material;grade:Material;materialShapes:string[];lit:boolean};
// Mode grading and the authored light toggle may change color/emission or
// shader callbacks. They never change opaque joinery's visibility/topology.
const materialShape=(m:Material)=>JSON.stringify([m.type,m.opacity,m.transparent,m.alphaTest,m.depthWrite,m.depthTest,m.side,
  (m as MeshBasicMaterial).vertexColors,(m as MeshBasicMaterial).wireframe,
  (m as MeshStandardMaterial).roughness,(m as MeshStandardMaterial).metalness]);
type Receipt={native:boolean;source:WilhelmHousingSourcesV324Receipt;metadata:MetaPin[];members:Member[];pose:number[];invalid:boolean;resources:Set<{dispose():void}>};
const receipts=new WeakMap<Group,Receipt>();
export type WilhelmHousingV324Options={native:boolean;sourcePrisms?:readonly unknown[];nativeSource?:unknown;
  sourceReceipt?:WilhelmHousingSourcesV324Receipt;mobileLike?:boolean};

/** No public tag is an admission proof. Raw unversioned word changes, authored
 * disposal, transforms, foreign materials and incomplete source families close. */
export function hasCompleteWilhelmHousingV324(root:Group,native?:boolean):boolean {
  const r=receipts.get(root);
  if(!r||r.invalid||native!==undefined&&native!==r.native||!root.visible||!samePose(root,r.pose)||
    !hasWilhelmHousingV324Sources(r.source,r.native)||!sameMetadata(r.metadata)||root.children.length!==r.members.length)return false;
  return r.members.every((p,i)=>{
    const m=p.mesh;
    return root.children[i]===m&&m.parent===root&&m.visible&&samePose(m,p.pose)&&m.geometry===p.geometry&&m.count===p.count&&
      m.geometry.drawRange.start===0&&m.geometry.drawRange.count===Infinity&&Object.keys(m.geometry.attributes).length===p.attributes.length&&
      p.attributes.every(([k,a])=>intact(m.geometry.getAttribute(k)as Attr,a))&&intact(m.geometry.index,p.index)&&intact(m.instanceMatrix,p.matrix)&&intact(m.instanceColor,p.color)&&
      m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&
      [p.day,p.night,p.grade].every((q,j)=>materialShape(q)===p.materialShapes[j])&&m.morphTexture===null&&Object.keys(m.geometry.morphAttributes).length===0&&
      (m.material===p.day||m.material===p.night||m.material===p.grade||hasMinecraftMaterialProvenance(m,p.day,m.material as Material)||
        hasMinecraftMaterialProvenance(m,p.night,m.material as Material)||hasMinecraftMaterialProvenance(m,p.grade,m.material as Material))&&
      (!p.lit||p.night.userData.nightEmissive===0xE6C782&&p.night.userData.nightEmissiveIntensity===.42);
  });
}

/** Bound each unpublished slice; mobile receives every complete fitting. */
export function* createWilhelmHousingV324Steps(options:WilhelmHousingV324Options,onCreate?:(root:Group)=>void):Generator<void,Group|null> {
  const meta=metadata(),pins=metaPins(meta);
  if(!pins||jsonHash(meta)!==METADATA_CONTROL||source.schemaVersion!==1||source.families.length!==19||source.families.reduce((n,q)=>n+q.parts.length,0)!==83)return null;
  pins.push({object:source,prototype:Object.getPrototypeOf(source),keyCount:Reflect.ownKeys(source).length,fields:META_KEYS.map(k=>[k,Object.getOwnPropertyDescriptor(source,k)!])});
  const bound=options.sourceReceipt??(yield*bindWilhelmHousingV324SourcesSteps(options.sourcePrisms,options.native?options.nativeSource:undefined,options.native));
  if(!bound||!hasWilhelmHousingV324Sources(bound,options.native))return null;
  const rows=options.native?source.native:source.drawn;
  const rowsControl=options.native?NATIVE_ROWS_CONTROL:DRAWN_ROWS_CONTROL;
  if(!rows.length||rows.length>100000||jsonHash(rows)!==rowsControl)return null;
  const root=new Group(),resources=new Set<{dispose():void}>();root.name='Complete Wilhelm housing facade fittings v324';
  const receipt:Receipt={native:options.native,source:bound,metadata:pins,members:[],pose:[],invalid:false,resources};
  let delivered=false;
  const invalidate=()=>{receipt.invalid=true;};
  try{
    onCreate?.(root);
    const batches:Row[][]=[[],[]];
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(r.length!==10||!r.slice(0,8).every(v=>typeof v==='number'&&Number.isFinite(v))||Math.min(r[3],r[4],r[5])<=0||
        !Number.isSafeInteger(r[7])||r[7]<0||r[7]>0xFFFFFF||!Number.isInteger(r[9])||!source.runs.some(q=>q.id===r[9])||options.native&&r[6]!==0)throw Error('Incomplete Wilhelm fitting recipe');
      const occupied=r[8]==='glazing'&&((Math.imul(Math.round(r[0]*10),73856093)^Math.imul(Math.round(r[1]*10),19349663)^Math.imul(Math.round(r[2]*10),83492791))>>>0)%100<38;
      batches[+occupied].push(r);if(i%1024===1023)yield;
    }
    const primitive=new BoxGeometry(1,1,1);primitive.deleteAttribute('uv');resources.add(primitive);
    // Full native boxes have cardinal matrices. Drawn boxes follow each actual
    // measured plane; primitive normals carry restrained baked face shading.
    const normals=primitive.getAttribute('normal'),shades=new Float32Array(normals.count*3);
    for(let i=0;i<normals.count;i++){const shade=normals.getY(i)>.5?1:normals.getY(i)<-.5?.68:normals.getX(i)>.5?.83:normals.getX(i)<-.5?.74:normals.getZ(i)>.5?.92:.79;shades.fill(shade,i*3,i*3+3);}
    primitive.setAttribute('color',new BufferAttribute(shades,3));primitive.userData.exactIndexPending=false;
    for(let batch=0;batch<batches.length;batch++){
      const list=batches[batch];if(!list.length)continue;
      const matrices=new Float32Array(list.length*16),colors=new Float32Array(list.length*3),matrix=new Matrix4(),scale=new Vector3(),color=new Color();
      for(let i=0;i<list.length;i++){
        const [x,y,z,w,h,d,angle,rgb]=list[i];
        if(options.native)matrix.makeScale(w,h,d);else matrix.makeRotationY(angle).scale(scale.set(w,h,d));
        matrix.setPosition(x,y,z);matrix.toArray(matrices,i*16);color.setHex(rgb).toArray(colors,i*3);
        if(i%1024===1023)yield;
      }
      const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.86});
      if(batch){night.userData.nightEmissive=0xE6C782;night.userData.nightEmissiveIntensity=.42;}
      const mesh=new InstancedMesh(primitive,day,0);mesh.count=list.length;
      mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
      mesh.name=batch?'Wilhelm source-supported warm glazing':'Wilhelm source-supported joinery and French rails';
      mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:options.native,blockNative:options.native,keepInMinecraft:options.native};
      resources.add(mesh);resources.add(day);resources.add(night);root.add(mesh);interleaveStaticGeometry(mesh);
      const grade=schwellenraumMaterialFor(mesh,day);resources.add(grade);
      for(const m of[day,night,grade])m.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(m))invalidate();});
      mesh.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(mesh))invalidate();});
      mesh.computeBoundingBox();mesh.computeBoundingSphere();yield;
    }
    primitive.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(primitive))invalidate();});
    root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:options.native,blockNative:options.native,keepInMinecraft:options.native};
    freezeStaticSceneTransforms(root);receipt.pose=pose(root);
    receipt.members=(root.children as InstancedMesh[]).map((mesh,i)=>({mesh,geometry:mesh.geometry,
      attributes:Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:pin(mesh.geometry.index!),matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),
      pose:pose(mesh),count:mesh.count,day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:mesh.userData.schwellenraumMaterial,
      materialShapes:[mesh.userData.dayMaterial,mesh.userData.nightMaterial,mesh.userData.schwellenraumMaterial].map(materialShape),lit:i===1}));
    receipts.set(root,receipt);
    if(jsonHash(rows)!==rowsControl||!hasCompleteWilhelmHousingV324(root,options.native))throw Error('Incomplete complete Wilhelm source family');
    delivered=true;return root;
  }finally{if(!delivered){receipt.invalid=true;receipts.delete(root);root.removeFromParent();for(const r of resources)r.dispose();root.clear();}}
}

export function disposeWilhelmHousingV324(root:Group):void {
  const r=receipts.get(root);if(!r)return;r.invalid=true;receipts.delete(root);
  root.removeFromParent();for(const resource of r.resources)resource.dispose();root.clear();
}
