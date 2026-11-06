/** Finite photo interpretations on exact existing public-lighting/OSM anchors.
 * The retained source provides positions; small unmeasured sections are estimates. */
import {
  BoxGeometry, BufferAttribute, CylinderGeometry, Color, Group, InstancedBufferAttribute,
  InstancedMesh, InterleavedBufferAttribute, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3, type Material, type Object3D,
} from 'three';
import profile from './data/wilhelmStreetFurnitureV325.json';
import type { StreetLight } from './ParkDetails';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { interleaveStaticGeometry } from './interleaveStaticGeometry';
import { isParkedStaticStorageV321, staticStorageInfo } from './losslessStaticStorage';
import { isSceneGeometryGpuRetirementV309 } from './sceneGeometryGpuResidency';
import { isSceneInstanceGpuRetirementV309 } from './sceneGpuResidency';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';
import { schwellenraumMaterialFor } from './visual-modes/schwellenraum/materialGrade';
import { hasMinecraftMaterialProvenance } from './visual-modes/minecraft/materialMode';

type Vec=[number,number,number];
type Lamp={id:string;source:string;position:number[];height:number;yaw:number;style:string};
type Item={id:string;kind:string;position:number[];yaw:number;backrest?:boolean};
type Style={reach:number;rise:number;steel:number;photo:string};
type Source={schemaVersion:number;sourceReceipts:StreetLight[];lamps:Lamp[];smallFurniture:Item[];
  styles:Record<string,Style>;estimates:object;references:object[]};
const source=profile as unknown as Source, CONTROL=3459169749;
const hashJSON=(q:unknown)=>{let h=2166136261;for(const c of JSON.stringify(q))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
type JSONPin={object:object;prototype:object|null;fields:[PropertyKey,PropertyDescriptor][]};
function jsonPins(q:unknown,out:JSONPin[]=[],seen=new Set<object>()):JSONPin[]|null {
  if(q===null||typeof q!=='object')return out;
  if(seen.has(q))return null;seen.add(q);
  const proto=Object.getPrototypeOf(q),keys=Reflect.ownKeys(q),array=Array.isArray(q);
  if(array?proto!==Array.prototype||keys.length!==q.length+1||Array.from({length:q.length},(_,i)=>String(i)).some(k=>!Object.hasOwn(q,k)):proto!==Object.prototype&&proto!==null)return null;
  const fields:JSONPin['fields']=[];
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(q,k)!;if(typeof k!=='string'||!('value'in d)||k!=='length'&&!d.enumerable)return null;fields.push([k,d]);if(!jsonPins(d.value,out,seen))return null;}
  out.push({object:q,prototype:proto,fields});return out;
}
const sameJSON=(pins:JSONPin[])=>pins.every(p=>Object.getPrototypeOf(p.object)===p.prototype&&Reflect.ownKeys(p.object).length===p.fields.length&&p.fields.every(([k,d])=>{const q=Object.getOwnPropertyDescriptor(p.object,k);return q&&'value'in q&&Object.is(q.value,d.value)&&q.enumerable===d.enumerable&&q.configurable===d.configurable&&q.writable===d.writable;}));
const sourceKeys=['height_m','id','light_type','position','rotation_degrees','street'] as const;
function exactSource(q:unknown,e:StreetLight):q is StreetLight {
  if(!q||typeof q!=='object'||Array.isArray(q)||Object.getPrototypeOf(q)!==Object.prototype||Reflect.ownKeys(q).length!==sourceKeys.length)return false;
  return sourceKeys.every(k=>{const d=Object.getOwnPropertyDescriptor(q,k);if(!d||!('value'in d)||!d.enumerable)return false;
    if(k!=='position')return Object.is(d.value,e[k]);
    const a=d.value;return Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype&&Reflect.ownKeys(a).length===4&&a.length===3&&e.position.every((v,i)=>{const p=Object.getOwnPropertyDescriptor(a,String(i));return p&&'value'in p&&p.enumerable&&Object.is(p.value,v);});});
}
type Attr=BufferAttribute|InterleavedBufferAttribute;
const store=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
function words(a:Attr):number {const v=store(a).array,b=new Uint8Array(v.buffer,v.byteOffset,v.byteLength),w=new Uint32Array(b.buffer,b.byteOffset,Math.floor(b.length/4));let h=2166136261;for(let i=0;i<w.length;i++)h=Math.imul(h^w[i],16777619)>>>0;for(let i=w.length*4;i<b.length;i++)h=Math.imul(h^b[i],16777619)>>>0;return h;}
type Pin={a:Attr;version:number;size:number;count:number;normalized:boolean;offset:number;stride:number;info:ReturnType<typeof staticStorageInfo>;hash:number};
const pin=(a:Attr):Pin=>({a,version:store(a).version,size:a.itemSize,count:a.count,normalized:a.normalized,offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,info:staticStorageInfo(store(a)),hash:words(a)});
function intact(a:Attr|null|undefined,p:Pin):boolean {
  if(!a||a!==p.a||store(a).version!==p.version||a.itemSize!==p.size||a.count!==p.count||a.normalized!==p.normalized||
    (a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;
  const s=store(a),q=staticStorageInfo(s);return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes&&(isParkedStaticStorageV321(s)||words(a)===p.hash);
}
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:number[])=>pose(o).every((v,i)=>Object.is(v,p[i]));
const materialShape=(m:Material)=>JSON.stringify([m.type,m.opacity,m.transparent,m.alphaTest,m.depthWrite,m.depthTest,m.side,(m as MeshBasicMaterial).vertexColors,(m as MeshBasicMaterial).wireframe,(m as MeshStandardMaterial).roughness,(m as MeshStandardMaterial).metalness]);
type Member={mesh:InstancedMesh;geometry:InstancedMesh['geometry'];attrs:[string,Pin][];index:Pin;matrix:Pin;color:Pin;pose:number[];count:number;castShadow:boolean;day:Material;night:Material;grade:Material;materials:string[]};
type Receipt={native:boolean;metadata:JSONPin[];actual:JSONPin[];members:Member[];pose:number[];invalid:boolean;ids:readonly string[];resources:Set<{dispose():void}>};
const receipts=new WeakMap<Group,Receipt>();

/** The public label is never an admission proof. Shader-only retirement and
 * genuine lossless/GPU parking retain the private authored resource lifetime. */
export function hasCompleteWilhelmStreetFurnitureV325(root:Group,native?:boolean):boolean {
  const r=receipts.get(root);if(!r||r.invalid||native!==undefined&&native!==r.native||!root.visible||!samePose(root,r.pose)||!sameJSON(r.metadata)||!sameJSON(r.actual)||root.children.length!==r.members.length)return false;
  return r.members.every((p,i)=>{const m=p.mesh;return root.children[i]===m&&m.parent===root&&m.visible&&samePose(m,p.pose)&&m.geometry===p.geometry&&m.count===p.count&&m.castShadow===p.castShadow&&m.receiveShadow&&m.geometry.drawRange.start===0&&m.geometry.drawRange.count===Infinity&&Object.keys(m.geometry.attributes).length===p.attrs.length&&p.attrs.every(([k,a])=>intact(m.geometry.getAttribute(k) as Attr,a))&&intact(m.geometry.index,p.index)&&intact(m.instanceMatrix,p.matrix)&&intact(m.instanceColor,p.color)&&m.morphTexture===null&&Object.keys(m.geometry.morphAttributes).length===0&&m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&[p.day,p.night,p.grade].every((q,j)=>materialShape(q)===p.materials[j])&&(m.material===p.day||m.material===p.night||m.material===p.grade||[p.day,p.night,p.grade].some(q=>hasMinecraftMaterialProvenance(m,q,m.material as Material)));});
}

/** Only this query may authorize the old generic loop to yield these14 IDs. */
export function wilhelmStreetFurnitureReplacementSourceIdsV325(root:Group):readonly string[] {
  return hasCompleteWilhelmStreetFurnitureV325(root,false)?receipts.get(root)!.ids:[];
}

type Part={p:Vec;s:Vec;rgb:number;quaternion:Quaternion};
export type WilhelmFurnitureTerrainAtV325=(x:number,z:number,sourceY:number)=>number;

/** No generic source changes happen here. Build all27 lamps and5 sparse mapped
 * objects first. Unknown/missing/changed municipal rows retain every old lamp.
 * New OSM anchors require a real terrain callback in both independent modes. */
export function createWilhelmStreetFurnitureV325(native:boolean,sourceLights?:readonly StreetLight[],terrainAt?:WilhelmFurnitureTerrainAtV325):Group|null {
  const metadata=jsonPins(source);if(!metadata||hashJSON(source)!==CONTROL||source.sourceReceipts.length!==89||source.lamps.length!==27||!terrainAt)return null;
  const actual:JSONPin[]=[];
  try{
    if(!native){
      if(!Array.isArray(sourceLights)||sourceLights.length!==5829)return null;
      const expected=new Map(source.sourceReceipts.map(q=>[q.id,q])),seen=new Set<string>();
      for(const q of sourceLights){
        const id=q&&typeof q==='object'?Object.getOwnPropertyDescriptor(q,'id'):undefined;
        if(!id||!('value'in id)||!expected.has(id.value))continue;
        if(seen.has(id.value)||!exactSource(q,expected.get(id.value)!))return null;
        const p=jsonPins(q);if(!p)return null;actual.push(...p);seen.add(id.value);
      }
      if(seen.size!==expected.size)return null;
      // Each new south pole was checked against all5829 original records
      // offline, and against the actual complete input again before admission.
      for(const lamp of source.lamps.filter(q=>q.source==='osm'))for(const q of sourceLights){
        const d=q&&typeof q==='object'?Object.getOwnPropertyDescriptor(q,'position'):undefined;
        if(!d||!('value'in d)||!Array.isArray(d.value))return null;
        const p=d.value;if(![p[0],p[2]].every(Number.isFinite)||Math.hypot(p[0]-lamp.position[0],p[2]-lamp.position[2])<3)return null;
      }
    }
  }catch{return null;}
  const root=new Group(),resources=new Set<{dispose():void}>();root.name='Source-bound Wilhelm street furniture v325';
  const r:Receipt={native,metadata,actual,members:[],pose:[],invalid:false,ids:Object.freeze(source.lamps.filter(q=>q.source==='municipal').map(q=>q.id)),resources};
  const invalidate=()=>{r.invalid=true;};
  const shafts:Part[]=[],bodies:Part[]=[],lights:Part[]=[],up=new Vector3(0,1,0),axis=new Vector3(0,0,1);
  const box=(target:Part[],p:Vec,s:Vec,rgb:number,yaw=0)=>{target.push({p,s,rgb,quaternion:new Quaternion().setFromAxisAngle(up,native?0:yaw)});};
  const beam=(a:Vec,b:Vec,width:number,rgb:number,round=false)=>{
    if(native){ // Independent cardinal staircase, no rotated Drawn beam.
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))/.22));
      for(let i=0;i<steps;i++){const p:Vec=[a[0]+dx*(i+.5)/steps,a[1]+dy*(i+.5)/steps,a[2]+dz*(i+.5)/steps];box(bodies,p,[Math.abs(dx)/steps+width,Math.abs(dy)/steps+width,Math.abs(dz)/steps+width],rgb);}return;
    }
    const d=new Vector3(...b).sub(new Vector3(...a)),target=round?shafts:bodies;
    target.push({p:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],s:round?[width,d.length(),width]:[width,width,d.length()],rgb,quaternion:new Quaternion().setFromUnitVectors(round?up:axis,d.normalize())});
  };
  try{
    for(const lamp of source.lamps){
      const [x,sourceY,z]=lamp.position,y=terrainAt(x,z,sourceY);if(!Number.isFinite(y))throw Error('Missing actual Wilhelm terrain');
      const style=source.styles[lamp.style],angle=lamp.yaw*Math.PI/180;
      let dx=Math.sin(angle),dz=-Math.cos(angle);
      if(native){if(Math.abs(dx)>=Math.abs(dz)){dx=Math.sign(dx);dz=0;}else{dz=Math.sign(dz);dx=0;}}
      const top=y+lamp.height,stemTop=top-style.rise;
      if(native)box(bodies,[x,y+(stemTop-y)/2,z],[.16,stemTop-y,.16],style.steel);
      else beam([x,y,z],[x,stemTop,z],.105,style.steel,true);
      box(bodies,[x,y+.15,z],[.24,.3,.24],style.steel);
      box(bodies,[x,y+.68,z],[.16,.08,.16],style.steel);
      for(const sign of lamp.style==='north-y'?[-1,1]:[1]){
        let last:Vec=[x,stemTop,z];
        const n=lamp.style==='green-arch'?8:2;
        for(let i=1;i<=n;i++){
          const t=i/n,reach=style.reach*t;
          // Only the photo-bounded green group receives this rounded neck.
          const rise=lamp.style==='green-arch'?style.rise*Math.sin(t*Math.PI/2)+.18*Math.sin(t*Math.PI):style.rise*t;
          const next:Vec=[x+dx*sign*reach,stemTop+rise,z+dz*sign*reach];beam(last,next,.085,style.steel,true);last=next;
        }
        const headP:Vec=[last[0]+dx*sign*.18,last[1]-.055,last[2]+dz*sign*.18];
        const long=lamp.style.startsWith('south')?1.04:.76;
        const size:Vec=native?(dx?[long,.15,.31]:[.31,.15,long]):[.31,.15,long];
        box(bodies,headP,size,0x424b4b,native?0:Math.atan2(dx,dz));
        box(lights,[headP[0],headP[1]-.085,headP[2]],native?(dx?[long*.84,.025,.24]:[.24,.025,long*.84]):[.24,.025,long*.84],0xf4e6c2,native?0:Math.atan2(dx,dz));
      }
    }
    for(const item of source.smallFurniture){
      const[x,sourceY,z]=item.position,y=terrainAt(x,z,sourceY);if(!Number.isFinite(y))throw Error('Missing actual street-furniture terrain');
      const angle=native?0:item.yaw*Math.PI/180,dx=Math.cos(angle),dz=-Math.sin(angle);
      if(item.kind==='bench'){
        // Actual three nodes explicitly say backrest=no; no guessed back panels.
        box(bodies,[x,y+.45,z],[1.7,.12,.48],0x8c8774,angle);
        for(const sign of[-1,1])box(bodies,[x+dx*.6*sign,y+.21,z+dz*.6*sign],[.11,.42,.33],0x555d59,angle);
      }else{
        const a:Vec=[x-dx*.42,y+.78,z-dz*.42],b:Vec=[x+dx*.42,y+.78,z+dz*.42];
        beam([a[0],y,a[2]],a,.055,0x737d7e,true);beam(a,b,.055,0x737d7e,true);beam(b,[b[0],y,b[2]],.055,0x737d7e,true);
      }
    }
    for(const [kind,parts] of [['round',shafts],['body',bodies],['light',lights]]as const){
      if(!parts.length)continue;
      const primitive=kind==='round'?new CylinderGeometry(1,1,1,8):new BoxGeometry(1,1,1);primitive.deleteAttribute('uv');resources.add(primitive);
      const normals=primitive.getAttribute('normal'),shades=new Float32Array(normals.count*3);
      for(let i=0;i<normals.count;i++){const shade=normals.getY(i)>.5?1:normals.getY(i)<-.5?.68:.82;shades.fill(shade,i*3,i*3+3);}
      primitive.setAttribute('color',new BufferAttribute(shades,3));primitive.userData.exactIndexPending=false;
      const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:kind==='light'?.05:.25});
      if(kind==='light'){night.userData.nightEmissive=0xffdf91;night.userData.nightEmissiveIntensity=3.6;}
      const matrices=new Float32Array(parts.length*16),colors=new Float32Array(parts.length*3),matrix=new Matrix4(),color=new Color();
      parts.forEach((p,i)=>{matrix.compose(new Vector3(...p.p),p.quaternion,new Vector3(...p.s));matrix.toArray(matrices,i*16);color.setHex(p.rgb).toArray(colors,i*3);});
      const mesh=new InstancedMesh(primitive,day,0);mesh.count=parts.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
      mesh.castShadow=kind!=='light';mesh.receiveShadow=true;
      mesh.name=`Wilhelm source furniture ${kind} ${native?'cardinal native':'drawn'}`;
      mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
      resources.add(mesh);resources.add(day);resources.add(night);root.add(mesh);interleaveStaticGeometry(mesh);
      const grade=schwellenraumMaterialFor(mesh,day);resources.add(grade);
      for(const m of[day,night,grade])m.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(m))invalidate();});
      primitive.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(primitive))invalidate();});
      mesh.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(mesh))invalidate();});mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
    root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,keepInMinecraft:native,lampCount:27,sourceMunicipalLampCount:14,osmLampCount:13,smallFurnitureCount:5};
    freezeStaticSceneTransforms(root);r.pose=pose(root);
    r.members=(root.children as InstancedMesh[]).map(mesh=>({mesh,geometry:mesh.geometry,attrs:Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:pin(mesh.geometry.index!),matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),pose:pose(mesh),count:mesh.count,castShadow:mesh.castShadow,day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:mesh.userData.schwellenraumMaterial,materials:[mesh.userData.dayMaterial,mesh.userData.nightMaterial,mesh.userData.schwellenraumMaterial].map(materialShape)}));
    receipts.set(root,r);if(!hasCompleteWilhelmStreetFurnitureV325(root,native))throw Error('Incomplete source-bound street-furniture family');return root;
  }catch{r.invalid=true;receipts.delete(root);for(const resource of resources)resource.dispose();root.clear();return null;}
}

export function disposeWilhelmStreetFurnitureV325(root:Group):void {const r=receipts.get(root);if(!r)return;r.invalid=true;receipts.delete(root);root.removeFromParent();for(const resource of r.resources)resource.dispose();root.clear();}
