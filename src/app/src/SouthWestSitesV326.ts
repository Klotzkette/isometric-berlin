/** Finite source-bound southwest additions. Source packets and V190/V194 stay
 * immutable; five exact old proxies have a closed source-quarter retirement gate. */
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh,
  InterleavedBufferAttribute, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  type Object3D } from 'three';
import data from './data/southWestSitesV326.json';
import { justicePalaceV183Boxes } from './justicePalaceV183Batches';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { interleaveStaticGeometry } from './interleaveStaticGeometry';
import { isParkedStaticStorageV321, staticStorageInfo } from './losslessStaticStorage';
import { isSceneGeometryGpuRetirementV309 } from './sceneGeometryGpuResidency';
import { isSceneInstanceGpuRetirementV309 } from './sceneGpuResidency';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';
import { schwellenraumMaterialFor } from './visual-modes/schwellenraum/materialGrade';
import { hasMinecraftMaterialProvenance } from './visual-modes/minecraft/materialMode';

type Surface={color:number;triangles:number[][][]};
type Site={key:string;name:string;boxes:number[][];nativeBoxes:number[][];surfaces:Surface[];nativeSurfaces:Surface[];
  parts?:{parent:string;id:string;ring:number[][];holes:number[][][];groundY:number;topY:number}[]};
type Profile={schemaVersion:number;sourceSha256:string;sites:Site[];peacocks:unknown[];references:unknown[]};
const source=data as unknown as Profile;
const jsonHash=(v:unknown)=>{let h=2166136261;const s=JSON.stringify(v);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
// Compiler-generated exact construction controls; updated only with the finite
// verified source recipe. These never admit a changed partial model.
const DRAWN_CONTROL=557580633, NATIVE_CONTROL=2945997882, META_CONTROL=710540787;
const metadata=()=>[source.schemaVersion,source.sourceSha256,source.sites.map(s=>[s.key,s.name,s.parts?.map(p=>[p.parent,p.id,p.ring,p.holes,p.groundY,p.topY])]),source.peacocks,source.references];
const rows=(native:boolean)=>source.sites.map(s=>[native?s.nativeBoxes:s.boxes,native?s.nativeSurfaces:s.surfaces]);
type Attr=BufferAttribute|InterleavedBufferAttribute;
const storage=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
function hashWords(a:Attr):number {const v=storage(a).array,b=new Uint8Array(v.buffer,v.byteOffset,v.byteLength);let h=2166136261;const w=new Uint32Array(b.buffer,b.byteOffset,Math.floor(b.length/4));for(let i=0;i<w.length;i++)h=Math.imul(h^w[i],16777619)>>>0;for(let i=w.length*4;i<b.length;i++)h=Math.imul(h^b[i],16777619)>>>0;return h;}
type Pin={a:Attr;version:number;count:number;size:number;normal:boolean;offset:number;stride:number;info:ReturnType<typeof staticStorageInfo>;hash:number};
const pin=(a:Attr):Pin=>({a,version:storage(a).version,count:a.count,size:a.itemSize,normal:a.normalized,offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,info:staticStorageInfo(storage(a)),hash:hashWords(a)});
function intact(a:Attr|null|undefined,p:Pin):boolean {if(!a||a!==p.a||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normal||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;const s=storage(a),q=staticStorageInfo(s);return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes&&(isParkedStaticStorageV321(s)||hashWords(a)===p.hash);}
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:number[])=>pose(o).every((n,i)=>Object.is(n,p[i]));
const shape=(m:Material)=>JSON.stringify([m.type,m.opacity,m.transparent,m.alphaTest,m.depthWrite,m.depthTest,m.side,(m as MeshBasicMaterial).vertexColors,(m as MeshBasicMaterial).wireframe,(m as MeshStandardMaterial).roughness,(m as MeshStandardMaterial).metalness]);
type NodePin={o:Object3D;parent:Object3D|null;children:Object3D[];pose:number[]};
type MeshPin={m:Mesh;geometry:BufferGeometry;attrs:[string,Pin][];index:Pin|null;matrix?:Pin;color?:Pin;count?:number;day:Material;night:Material;grade:Material;shapes:string[]};
type Receipt={native:boolean;nodes:NodePin[];meshes:MeshPin[];resources:Set<{dispose():void}>;invalid:boolean;meta:string};
const receipts=new WeakMap<Group,Receipt>();
function collectResources(root:Group,resources:Set<{dispose():void}>):void {root.traverse(o=>{if(!(o instanceof Mesh))return;resources.add(o.geometry);if(o instanceof InstancedMesh)resources.add(o);for(const value of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial])for(const m of Array.isArray(value)?value:[value])if(m instanceof Material)resources.add(m);});}

/** Hidden mode ancestors are legitimate; own model transforms, source metadata,
 * geometry words, topology and all members must stay exact. */
export function hasCompleteSouthWestSitesV326(root:Group,native?:boolean):boolean {
  const r=receipts.get(root);if(!r||r.invalid||native!==undefined&&native!==r.native||JSON.stringify(metadata())!==r.meta)return false;
  if(!r.nodes.every(p=>p.o.visible&&samePose(p.o,p.pose)&&(p.o===root||p.o.parent===p.parent)&&p.o.children.length===p.children.length&&p.o.children.every((q,i)=>q===p.children[i])))return false;
  return r.meshes.every(p=>{const m=p.m;return m.geometry===p.geometry&&m.geometry.drawRange.start===0&&m.geometry.drawRange.count===Infinity&&m.geometry.groups.length===0&&Object.keys(m.geometry.morphAttributes).length===0&&Object.keys(m.geometry.attributes).length===p.attrs.length&&p.attrs.every(([k,a])=>intact(m.geometry.getAttribute(k)as Attr,a))&&(p.index?intact(m.geometry.index,p.index):m.geometry.index===null)&&(!p.matrix||m instanceof InstancedMesh&&m.count===p.count&&m.morphTexture===null&&intact(m.instanceMatrix,p.matrix)&&intact(m.instanceColor,p.color!))&&m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&[p.day,p.night,p.grade].every((q,i)=>shape(q)===p.shapes[i])&&(m.material===p.day||m.material===p.night||m.material===p.grade||hasMinecraftMaterialProvenance(m,p.day,m.material as Material)||hasMinecraftMaterialProvenance(m,p.night,m.material as Material)||hasMinecraftMaterialProvenance(m,p.grade,m.material as Material));});
}

function surfaceMesh(surfaces:Surface[],native:boolean):Mesh {
  const points:number[]=[],colors:number[]=[],color=new Color();
  for(const s of surfaces){color.setHex(s.color);for(const t of s.triangles)for(const p of t){points.push(...p);colors.push(color.r,color.g,color.b);}}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(points),3));geometry.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.92,flatShading:true});
  const mesh=new Mesh(geometry,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,keepInMinecraft:native};return mesh;
}

/** One bounded family, constructed cooperatively, identical detail on touch.
 * onCreate may attach the provisional root, but admission stays closed until
 * the final source/recipe check and complete private receipt have succeeded. */
export function* createSouthWestSitesV326Steps(native=false,onCreate?:(root:Group)=>void):Generator<void,Group|null> {
  if(source.schemaVersion!==1||source.sites.length!==9||jsonHash(metadata())!==META_CONTROL||jsonHash(rows(native))!==(native?NATIVE_CONTROL:DRAWN_CONTROL))return null;
  const root=new Group(),r:Receipt={native,nodes:[],meshes:[],resources:new Set(),invalid:false,meta:JSON.stringify(metadata())};let delivered=false;
  root.name='Pfaueninsel, Brücke-Museum and Kunsthaus Dahlem v326';root.userData={textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native};
  const invalidate=()=>{r.invalid=true;};
  try{
    onCreate?.(root);
    for(const s of source.sites){
      const group=new Group();group.name=s.name;group.userData={siteKey:s.key,textureFree:true};root.add(group);
      const surfaces=native?s.nativeSurfaces:s.surfaces,boxes=native?s.nativeBoxes:s.boxes;
      if(surfaces.length){const mesh=surfaceMesh(surfaces,native);mesh.name=s.name+': complete retained source surfaces';group.add(mesh);yield;}
      if(boxes.length){if(boxes.length>40000||boxes.some(q=>q.length!==8||!q.every(Number.isFinite)||Math.min(q[3],q[4],q[5])<=0||native&&q[6]!==0))throw Error('Invalid southwest source detail');const mesh=justicePalaceV183Boxes(boxes.map(q=>native?[...q.slice(0,6),q[7]]:q),native);mesh.geometry.clearGroups();mesh.name=s.name+': source-supported recognition';group.add(mesh);yield;}
    }
    interleaveStaticGeometry(root);freezeStaticSceneTransforms(root);
    root.traverse(o=>{r.nodes.push({o,parent:o.parent,children:o.children.slice(),pose:pose(o)});if(!(o instanceof Mesh))return;
      const m=o,day=m.userData.dayMaterial as Material,night=m.userData.nightMaterial as Material,grade=schwellenraumMaterialFor(m,day);r.resources.add(m.geometry);for(const mat of[day,night,grade]){r.resources.add(mat);mat.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(mat))invalidate();});}m.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(m.geometry))invalidate();});
      if(m instanceof InstancedMesh){r.resources.add(m);m.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(m))invalidate();});}
      r.meshes.push({m,geometry:m.geometry,attrs:Object.entries(m.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:m.geometry.index?pin(m.geometry.index):null,...(m instanceof InstancedMesh?{matrix:pin(m.instanceMatrix),color:pin(m.instanceColor!),count:m.count}:{}),day,night,grade,shapes:[day,night,grade].map(shape)});
    });
    if(jsonHash(rows(native))!==(native?NATIVE_CONTROL:DRAWN_CONTROL)||JSON.stringify(metadata())!==r.meta)throw Error('Southwest recipe changed during construction');
    receipts.set(root,r);if(!hasCompleteSouthWestSitesV326(root,native))throw Error('Incomplete southwest source family');
    delivered=true;return root;
  }finally{if(!delivered){r.invalid=true;receipts.delete(root);root.removeFromParent();collectResources(root,r.resources);for(const q of r.resources)q.dispose();root.clear();}}
}

export function createSouthWestSitesV326(native=false):Group|null {const g=createSouthWestSitesV326Steps(native);let n=g.next();while(!n.done)n=g.next();return n.value;}
export function disposeSouthWestSitesV326(root:Group):void {const r=receipts.get(root);if(!r)return;r.invalid=true;receipts.delete(root);root.removeFromParent();for(const q of r.resources)q.dispose();root.clear();}

/** Raw private proof is deliberately separate from the actual world attachment
 * gate used for SourceQuarter. No public userData label authorizes retirement. */
export function hasSouthWestSitesRuntimeV326(world:Object3D,root:Group|null|undefined,native:boolean):boolean {
  if(!root||!hasCompleteSouthWestSitesV326(root,native))return false;
  for(let p:Object3D|null=root.parent;p;p=p.parent)if(p===world)return true;
  return false;
}
