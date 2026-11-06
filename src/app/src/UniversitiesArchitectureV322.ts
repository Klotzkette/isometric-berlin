/** Finite complete university families and reference-guided facade fittings. */
import { BufferAttribute, Group, InstancedMesh, InterleavedBufferAttribute, type Material, type Object3D } from "three";
import data from "./data/universitiesArchitectureV322.json";
import { completePackedRootV307, createPackedRootStepsV309, type RequiredPackedV307 } from "./requiredPackedRootV307";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { interleaveStaticGeometry } from "./interleaveStaticGeometry";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { staticStorageInfo } from "./losslessStaticStorage";
import { isSceneGeometryGpuRetirementV309 } from "./sceneGeometryGpuResidency";
import { isSceneInstanceGpuRetirementV309 } from "./sceneGpuResidency";
import { isSceneMaterialProgramRetirementV321 } from "./sceneMaterialPrograms";
import { hasMinecraftMaterialProvenance } from "./visual-modes/minecraft/materialMode";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";
import type { PrismBuilding } from "./IsometricCityWorld";
import { createExactOwnersSourceV321 } from "./ExactOwnersV321";
import { uniExactPlansV322 } from "./universitiesPreviousV322";
export { uniExactPlansV322 } from "./universitiesPreviousV322";

type Face={owner:string;parent?:string;a:number[];d:number[];n:number[];range:number[];polygon:number[][];holes:number[][][];voids:number[][]};
type Site={key:string;style:string;palette:number[];pitch:number;storey:number;ratio:number;faces:Face[];nativeFaces:Face[];partIds:string[]};
type NativeRows={key:string;native:true;origin:number[];count:number;columns:string[];tones:string;palette:number[]};
type Navigation={site:string;id:string;ring:number[][];holes:number[][][];groundY:number;topY:number;roofTriangles:number[][][]};
type Catalogue={schemaVersion:number;sites:Site[];models:(RequiredPackedV307|NativeRows)[];navigation:Navigation[];sourcePrisms?:PrismBuilding[];oldBodies?:PrismBuilding[]};
const source=data as unknown as Catalogue;
const CONTROL:number=1141110182; // Finalized only after every finite source/receipt closes.
const OLD_BODY_CONTROL:number=1283560482;
const packedOwner=Symbol("Complete measured university families v322");
const fnv=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
let catalogueReady:boolean|undefined,oldBodiesReady:boolean|undefined;
const freeze=(v:unknown):void=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const q of Object.values(v))freeze(q);Object.freeze(v);}};
function* readySteps():Generator<void,boolean>{
 if(catalogueReady!==undefined)return catalogueReady;
 if(CONTROL===0||source.schemaVersion!==1||source.sites.length!==18||source.models.length!==45)return catalogueReady=false;
 const text=JSON.stringify(source);let h=2166136261;
 for(let start=0;start<text.length;start+=32768){for(let i=start;i<Math.min(start+32768,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}
 if(h!==CONTROL)return catalogueReady=false;
 freeze(source.sites);freeze(source.navigation);freeze(source.sourcePrisms);freeze(source.oldBodies);freeze(source.models);
 return catalogueReady=true;
}
function ready():boolean{return catalogueReady===true;}
function exact(a:unknown,b:unknown):boolean {
 if(a===b)return true;if(!a||!b||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.getOwnPropertyNames(a),expected=Object.getOwnPropertyNames(b);return keys.length===expected.length&&expected.every(k=>{const x=Object.getOwnPropertyDescriptor(a,k),y=Object.getOwnPropertyDescriptor(b,k);return !!x&&!!y&&"value"in x&&"value"in y&&exact(x.value,y.value);});
}
/** Full original-record identity, never a geographic deletion zone. */
export function universitiesPreviousPrismV322(prism:unknown):boolean{oldBodiesReady??=OLD_BODY_CONTROL!==0&&fnv(JSON.stringify(source.oldBodies))===OLD_BODY_CONTROL;return oldBodiesReady&&!!source.oldBodies?.some(p=>exact(prism,p));}
function admitted(prisms:readonly PrismBuilding[]|undefined,native:boolean,mobileLike:boolean,voxels:unknown):boolean {
 if(!ready()||!prisms||!source.sourcePrisms?.length)return false;
 const wanted=new Map(source.sourcePrisms.map(p=>[p.id,p])),seen=new Set<string>();
 for(const p of prisms){const d=p&&Object.getOwnPropertyDescriptor(p,"id");if(!d||!("value"in d)||!wanted.has(d.value))continue;if(seen.has(d.value)||!exact(p,wanted.get(d.value)))return false;seen.add(d.value);}
 if(seen.size!==wanted.size)return false;
 const entry=uniExactPlansV322(native,mobileLike);
 return !!createExactOwnersSourceV321(entry.plan,prisms,entry.control,voxels);
}
const inside=(x:number,y:number,ring:readonly number[][])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
function fits(f:Face,u:number,y:number,w:number,h:number):boolean {
 const lo=u-w/2,hi=u+w/2,b=y-h/2,t=y+h/2;
 if(lo<f.range[0]||hi>f.range[1]||b<f.range[2]||t>f.range[3]||f.voids.some(q=>hi>q[0]&&lo<q[1]&&t>q[2]&&b<q[3]))return false;
 const corners=[[lo,b],[hi,b],[hi,t],[lo,t]];
 if(corners.some(p=>!inside(p[0],p[1],f.polygon)||f.holes.some(r=>inside(p[0],p[1],r))))return false;
 const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(const ring of[f.polygon,...f.holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],q=ring[(i+1)%ring.length];if(a[0]>lo&&a[0]<hi&&a[1]>b&&a[1]<t)return false;
  for(let j=0;j<4;j++){const c=corners[j],d=corners[(j+1)%4];if(cross(a,q,c)*cross(a,q,d)<0&&cross(c,d,a)*cross(c,d,q)<0)return false;}
 }
 return true;
}
function* fittingRows(site:Site,native:boolean):Generator<void,{frames:number[][];glass:number[][]}> {
 const frames:number[][]=[],glass:number[][]=[];
 const add=(dest:number[][],f:Face,u:number,y:number,w:number,h:number,depth:number,out:number,tone:number)=>{
  const row=[f.a[0]+f.d[0]*u+f.n[0]*out,y,f.a[1]+f.d[1]*u+f.n[1]*out,w,h,depth];
  if(native){if(Math.abs(f.d[1])>.5)[row[3],row[5]]=[row[5],row[3]];row.push(tone);}else row.push(-Math.atan2(f.d[1],f.d[0]),tone);dest.push(row);
 };
 let count=0;
 for(const face of native?site.nativeFaces:site.faces){
  if(native&&face.d[0]*face.d[1]!==0)throw Error("University native front is not cardinal");
  const [lo,hi,bottom,top]=face.range,storey=site.key==='ash-extension'&&top-bottom>25?3.9:site.key==='bht-wedding'&&top-bottom>30?3.8:site.storey,pitch=(hi-lo)/Math.max(1,Math.round((hi-lo)/site.pitch)),bays=Math.max(1,Math.round((hi-lo)/site.pitch));
  for(let y=bottom+1.9,level=0;y+1.25<top-.2;y+=storey,level++)for(let bay=0;bay<bays;bay++){
   const u=lo+(bay+.5)*pitch;
   const ratio=site.style==='jura-rhythm'?(bay%3===0?.70:.35):site.ratio;
   const w=Math.min(pitch-.32,pitch*ratio),h=Math.min(storey-1.05,site.style==='historic-school'?2.25:2.45);
   if(!fits(face,u,y,w+.26,h+.30))continue;
   if(++count%32===0)yield;
   add(frames,face,u,y,w+.24,h+.24,.11,.28,site.palette[0]);
   add(glass,face,u,y,w,h,.075,.37,site.palette[1]);
   for(const side of[-1,1]){add(frames,face,u+side*(w/2+.025),y,.085,h+.16,.12,.43,site.palette[2]);add(frames,face,u,y+side*(h/2+.025),w+.13,.085,.12,.43,site.palette[2]);}
   add(frames,face,u,y,.065,h,.10,.45,site.palette[2]);
   if(site.style==='historic-school'||site.style==='historic-campus')add(frames,face,u,y-h/2-.14,w+.38,.15,.25,.42,site.palette[0]);
   if(site.style==='industrial-brick')add(frames,face,u,y+.35,w,.075,.10,.45,site.palette[2]);
  }
  // Fine cedar joints are deliberately distinct from an arbitrary extra grid.
  if(site.style==='grey-cedar')for(let u=lo+.3;u<hi-.2;u+=.6){const y=(bottom+top)/2,h=top-bottom-.3;if(fits(face,u,y,.045,h))add(frames,face,u,y,.045,h,.045,.10,0x777A72);}
 }
 return {frames,glass};
}
function rows(q:NativeRows):number[][] {
 if(q.columns.length!==6||q.origin.length!==3||q.count<=0)throw Error("Incomplete university native runs");
 const columns=q.columns.map(s=>{const b=decodeBase64Bytes(s);if(b.byteLength!==q.count*2)throw Error("Incomplete native run words");return new Uint16Array(b.buffer,b.byteOffset,q.count);});
 const tones=decodeBase64Bytes(q.tones);if(tones.length!==q.count||tones.some(t=>t>=q.palette.length))throw Error("Incomplete native run palette");
 return Array.from({length:q.count},(_,i)=>[...columns.map((v,k)=>v[i]/100+(k<3?q.origin[k]:0)),q.palette[tones[i]]]);
}
type Attr=BufferAttribute|InterleavedBufferAttribute;
const backing=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
type Pin={attribute:Attr;version:number;size:number;count:number;normalized:boolean;offset:number;stride:number;storage:ReturnType<typeof staticStorageInfo>};
const pin=(a:Attr):Pin=>({attribute:a,version:backing(a).version,size:a.itemSize,count:a.count,normalized:a.normalized,offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,storage:staticStorageInfo(backing(a))});
function unchanged(a:Attr|null|undefined,p:Pin):boolean {if(!a||a!==p.attribute||backing(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;const s=staticStorageInfo(backing(a));return s.arrayIdentity===p.storage.arrayIdentity&&s.bufferIdentity===p.storage.bufferIdentity&&s.byteLength===p.storage.byteLength&&s.bufferBytes===p.storage.bufferBytes;}
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const poseMatches=(o:Object3D,p:number[])=>pose(o).every((v,i)=>Object.is(v,p[i]));
type Member={mesh:InstancedMesh;geometry:InstancedMesh['geometry'];drawStart:number;drawCount:number;attributes:[string,Pin][];index:Pin;matrix:Pin;color:Pin;count:number;pose:number[];day:Material;night:Material;grade:Material};
type Receipt={native:boolean;packed?:Group;members:Member[];pose:number[];invalid:boolean;nativeBodies:number[][]};
const receipts=new WeakMap<Group,Receipt>();
export function hasCompleteUniversitiesArchitectureV322(root:Group,native?:boolean):boolean {
 const r=receipts.get(root);if(!r||r.invalid||native!==undefined&&native!==r.native||!root.visible||!poseMatches(root,r.pose)||root.children.length!==r.members.length+(r.packed?1:0)||r.packed&&(r.packed.parent!==root||root.children[0]!==r.packed||!completePackedRootV307(r.packed,packedOwner,false)))return false;
 return r.members.every((p,i)=>{const m=p.mesh;return root.children[i+(r.packed?1:0)]===m&&m.parent===root&&m.visible&&m.geometry===p.geometry&&m.geometry.drawRange.start===p.drawStart&&m.geometry.drawRange.count===p.drawCount&&m.count===p.count&&poseMatches(m,p.pose)&&Object.keys(m.geometry.attributes).length===p.attributes.length&&p.attributes.every(([k,a])=>unchanged(m.geometry.getAttribute(k)as Attr,a))&&unchanged(m.geometry.index,p.index)&&unchanged(m.instanceMatrix,p.matrix)&&unchanged(m.instanceColor,p.color)&&m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&(m.material===p.day||m.material===p.night||m.material===p.grade||hasMinecraftMaterialProvenance(m,p.day,m.material as Material)||hasMinecraftMaterialProvenance(m,p.night,m.material as Material)||hasMinecraftMaterialProvenance(m,p.grade,m.material as Material));});
}
/** Default closed. Models precede every old-source transfer; touch has full detail. */
export function* createUniversitiesArchitectureV322Steps(native=false,options:{sourcePrisms?:readonly PrismBuilding[];voxels?:unknown;mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group> {
 const root=new Group();root.name='Complete university architecture v322';root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};onCreate?.(root);
 if(!(yield*readySteps()))return root;
 if(!admitted(options.sourcePrisms,native,options.mobileLike??false,options.voxels))return root;
 const r:Receipt={native,members:[],pose:[],invalid:false,nativeBodies:[]},resources=new Set<{dispose():void}>();let delivered=false;
 const add=(name:string,list:number[][],lit=false)=>{
  const m=justicePalaceV183Boxes(list,native);m.name=name;
  // Interleave only these new stock unit boxes before taking private pins.
  interleaveStaticGeometry(m);
  const day=m.userData.dayMaterial as Material,night=m.userData.nightMaterial as Material;
  if(lit){night.userData.nightEmissive=0xE6C782;night.userData.nightEmissiveIntensity=.42;}
  const grade=schwellenraumMaterialFor(m,day);m.userData.schwellenraumMaterial=grade;
  resources.add(m);resources.add(m.geometry);for(const material of[day,night,grade]){resources.add(material);material.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(material))r.invalid=true;});}
  m.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(m.geometry))r.invalid=true;});m.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(m))r.invalid=true;});root.add(m);
 };
 try{
  if(!native)r.packed=yield*createPackedRootStepsV309(packedOwner,'Complete retained official university sheets',false,source.models.filter(m=>!m.native)as RequiredPackedV307[],{sourceLeaves:source.sites.reduce((n,s)=>n+s.partIds.length,0)},g=>root.add(g));
  for(const site of source.sites){
   if(native){const q=source.models.find(q=>q.native&&q.key===site.key+'-independent-native')as NativeRows|undefined;if(!q)throw Error('Missing complete university native body');const list=rows(q);r.nativeBodies.push(...list);add(site.key+' independent native exterior',list);yield;}
   const list=yield*fittingRows(site,native);if(!list.frames.length||!list.glass.length)throw Error('Missing complete university front '+site.key);add(site.key+' source-bound frames',list.frames);yield;add(site.key+' source-bound glazing',list.glass,true);yield;
  }
  if(native)for(const q of source.models)if(q.native&&q.key.endsWith('-new-ground-native')){const list=rows(q as NativeRows);r.nativeBodies.push(...list);add(q.key+' exact new campus floor',list);yield;}
  freezeStaticSceneTransforms(root);
  r.pose=pose(root);r.members=root.children.filter((o):o is InstancedMesh=>o instanceof InstancedMesh).map(m=>({mesh:m,geometry:m.geometry,drawStart:m.geometry.drawRange.start,drawCount:m.geometry.drawRange.count,attributes:Object.entries(m.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:pin(m.geometry.index!),matrix:pin(m.instanceMatrix),color:pin(m.instanceColor!),count:m.count,pose:pose(m),day:m.userData.dayMaterial,night:m.userData.nightMaterial,grade:m.userData.schwellenraumMaterial}));receipts.set(root,r);delivered=true;return root;
 }finally{if(!delivered){r.invalid=true;root.traverse(o=>{const m=o as InstancedMesh;if(m.geometry)resources.add(m.geometry);for(const q of[m.material,m.userData.dayMaterial,m.userData.nightMaterial,m.userData.schwellenraumMaterial].flat())if(q&&typeof q.dispose==='function')resources.add(q);});for(const q of resources)q.dispose();root.clear();}}
}
export function createUniversitiesArchitectureV322(native=false,options:Parameters<typeof createUniversitiesArchitectureV322Steps>[1]={}):Group {const steps=createUniversitiesArchitectureV322Steps(native,options);let n=steps.next();while(!n.done)n=steps.next();return n.value;}

/** Granular physical source floors/roofs, gated by this exact private root. */
export function universitiesNavigationV322(root:Group,native=false):{solidAt:(x:number,y:number,z:number,radius?:number)=>boolean;groundAt:(x:number,z:number,currentY?:number)=>number|null} {
 const index=new Map<string,Navigation[]>(),nativeIndex=new Map<string,number[][]>();
 const insert=<T>(map:Map<string,T[]>,item:T,x0:number,z0:number,x1:number,z1:number)=>{for(let x=Math.floor(x0/16);x<=Math.floor(x1/16);x++)for(let z=Math.floor(z0/16);z<=Math.floor(z1/16);z++){const k=x+','+z;let bucket=map.get(k);if(!bucket)map.set(k,bucket=[]);bucket.push(item);}};
 for(const p of source.navigation){const xs=p.ring.map(v=>v[0]),zs=p.ring.map(v=>v[1]);insert(index,p,Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs));}
 if(native)for(const r of receipts.get(root)?.nativeBodies??[])insert(nativeIndex,r,r[0]-r[3]/2,r[2]-r[5]/2,r[0]+r[3]/2,r[2]+r[5]/2);
 const local=<T>(map:Map<string,T[]>,x:number,z:number,r=0)=>{if(!r)return map.get(Math.floor(x/16)+','+Math.floor(z/16))??[];const found=new Set<T>();for(let ix=Math.floor((x-r)/16);ix<=Math.floor((x+r)/16);ix++)for(let iz=Math.floor((z-r)/16);iz<=Math.floor((z+r)/16);iz++)for(const item of map.get(ix+','+iz)??[])found.add(item);return [...found];};
 const contains=(p:Navigation,x:number,z:number)=>inside(x,z,p.ring)&&!p.holes.some(h=>inside(x,z,h));
 const roof=(p:Navigation,x:number,z:number)=>{let top=-Infinity;for(const [a,b,c]of p.roofTriangles){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return top;};
 return {solidAt(x,y,z,radius=0){const candidates=native?local(nativeIndex,x,z,radius):local(index,x,z,radius);if(!candidates.length||!hasCompleteUniversitiesArchitectureV322(root,native))return false;
  if(native)return (candidates as number[][]).some(r=>Math.abs(x-r[0])<=r[3]/2+radius&&Math.abs(z-r[2])<=r[5]/2+radius&&y>=r[1]-r[4]/2&&y<=r[1]+r[4]/2);
  const samples=radius?[[x,z],[x-radius,z],[x+radius,z],[x,z-radius],[x,z+radius]]:[[x,z]];
  return (candidates as Navigation[]).some(p=>y>=p.groundY&&samples.some(([px,pz])=>contains(p,px,pz)&&y<=roof(p,px,pz)));},groundAt(x,z,currentY=Infinity){const candidates=native?local(nativeIndex,x,z):local(index,x,z);if(!candidates.length||!hasCompleteUniversitiesArchitectureV322(root,native))return null;
  let top=-Infinity;if(native){for(const r of candidates as number[][])if(Math.abs(x-r[0])<=r[3]/2&&Math.abs(z-r[2])<=r[5]/2&&r[1]+r[4]/2<=currentY+.65)top=Math.max(top,r[1]+r[4]/2);}
  else for(const p of candidates as Navigation[])if(contains(p,x,z)){const y=roof(p,x,z);if(y<=currentY+.65)top=Math.max(top,y);}
  return Number.isFinite(top)?top:null;}};
}
