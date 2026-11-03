import {BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import type {Material} from "three";
import data from "./data/northSitesV306.json";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {staticStorageInfo} from "./losslessStaticStorage";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
import {schwellenraumMaterialFor} from "./visual-modes/schwellenraum/materialGrade";

type A={attribute:BufferAttribute;storage:ReturnType<typeof staticStorageInfo>;version:number;count:number;size:number;normalized:boolean};
type T={matrix:number[];position:number[];quaternion:number[];scale:number[];auto:boolean;worldAuto:boolean};
type M={mesh:Mesh;geometry:BufferGeometry;attributes:Map<string,A>;index:A;day:Material;night:Material;grade:Material;transform:T};
type R={native:boolean;children:M[];transform:T;disposed:boolean};
const receipts=new WeakMap<Group,R>();
const transform=(o:Group|Mesh):T=>({matrix:o.matrix.elements.slice(),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),auto:o.matrixAutoUpdate,worldAuto:o.matrixWorldAutoUpdate});
const sameTransform=(o:Group|Mesh,p:T)=>o.matrixAutoUpdate===p.auto&&o.matrixWorldAutoUpdate===p.worldAuto&&o.matrix.elements.every((v,i)=>v===p.matrix[i])&&o.position.toArray().every((v,i)=>v===p.position[i])&&o.quaternion.toArray().every((v,i)=>v===p.quaternion[i])&&o.scale.toArray().every((v,i)=>v===p.scale[i]);
const capture=(a:BufferAttribute):A=>({attribute:a,storage:staticStorageInfo(a),version:a.version,count:a.count,size:a.itemSize,normalized:a.normalized});
function matches(a:BufferAttribute|null|undefined,r:A):boolean{
 if(!a||a!==r.attribute||a.version!==r.version||a.count!==r.count||a.itemSize!==r.size||a.normalized!==r.normalized)return false;
 const s=staticStorageInfo(a);return s.arrayIdentity===r.storage.arrayIdentity&&s.bufferIdentity===r.storage.bufferIdentity&&s.byteLength===r.storage.byteLength&&s.bufferBytes===r.storage.bufferBytes;
}
/** Private complete child/storage identities survive legitimate GPU parking. */
export function hasCompleteNorthSitesV306(root:Group,native?:boolean):boolean{
 const r=receipts.get(root);return !!r&&!r.disposed&&root.visible&&sameTransform(root,r.transform)&&(native===undefined||native===r.native)&&root.children.length===r.children.length&&r.children.every((p,i)=>root.children[i]===p.mesh&&p.mesh.parent===root&&p.mesh.visible&&sameTransform(p.mesh,p.transform)&&p.mesh.geometry===p.geometry&&p.geometry.drawRange.start===0&&(p.geometry.drawRange.count===Infinity||p.geometry.drawRange.count===p.index.count)&&Object.keys(p.geometry.attributes).length===p.attributes.size&&[...p.attributes].every(([k,a])=>matches(p.geometry.getAttribute(k) as BufferAttribute,a))&&matches(p.geometry.index,p.index)&&(p.mesh.material===p.day||p.mesh.material===p.night||p.mesh.material===p.grade)&&p.mesh.userData.dayMaterial===p.day&&p.mesh.userData.nightMaterial===p.night&&p.mesh.userData.schwellenraumMaterial===p.grade);
}
/** Complete new named school and bounded original memorial interpretation.
 * Equal drawn detail on touch; separate hollow cardinal native surfaces. */
export function createNorthSitesV306(native=false):Group{
 const root=new Group(),resources=new Set<{dispose():void}>();root.name="Lessing school and Ernst-Thälmann memorial v306";
 const receipt:R={native,children:[],transform:transform(root),disposed:false};
 const invalidate=()=>{receipt.disposed=true;};
 try{
  if(data.schemaVersion!==1||data.sites.length!==2||new Set(data.sites.map(s=>s.key)).size!==2)throw Error("Incomplete northern sites schema");
  for(const site of data.sites){
   const p=native?site.native:site.drawn,raw=decodeBase64Bytes(p.position),colors=decodeBase64Bytes(p.color),ix=decodeBase64Bytes(p.index);
   if(raw.byteLength!==p.vertices*12||colors.byteLength!==p.vertices*3||ix.byteLength!==p.triangles*12||!p.vertices||!p.triangles)throw Error("Incomplete northern site buffers");
   const ps=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4),indices=new Uint32Array(ix.buffer,ix.byteOffset,ix.byteLength/4);
   if(ps.some(v=>!Number.isFinite(v))||indices.some(i=>i>=p.vertices))throw Error("Invalid northern site geometry");
   const geometry=new BufferGeometry();resources.add(geometry);geometry.addEventListener("dispose",()=>{if(!isSceneGeometryGpuRetirementV309(geometry))invalidate();});geometry.setAttribute("position",new BufferAttribute(ps,3));geometry.setAttribute("color",new BufferAttribute(colors,3,true));geometry.setIndex(new BufferAttribute(indices,1));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.94,flatShading:native});resources.add(day);resources.add(night);
   day.addEventListener("dispose",invalidate);night.addEventListener("dispose",invalidate);
   const mesh=new Mesh(geometry,day);mesh.name=site.key==="lessing"?"Complete measured Lessing-Gymnasium Schöningstraße17, nine source leaves":"Lew Kerbel Thälmann bust, fist, folded flag and source-contained granite courses";
   mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,sourceSheetsRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,northSiteV306:site.key};const grade=schwellenraumMaterialFor(mesh,day);resources.add(grade);grade.addEventListener("dispose",invalidate);root.add(mesh);
  }
  root.userData={northSitesV306:true,sourceReceipt:"north-sites-v306-source.json.gz",fullStaticDetailOnTouch:true,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,smallReferenceDimensionsEstimated:true};freezeStaticSceneTransforms(root);
  receipt.transform=transform(root);receipt.children=(root.children as Mesh[]).map(mesh=>({mesh,geometry:mesh.geometry,attributes:new Map(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,capture(a as BufferAttribute)])),index:capture(mesh.geometry.index!),day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:mesh.userData.schwellenraumMaterial,transform:transform(mesh)}));receipts.set(root,receipt);return root;
 }catch(error){receipts.delete(root);for(const r of resources)r.dispose();root.clear();throw error;}
}
