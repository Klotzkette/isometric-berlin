/** Current public ministry exteriors; old sources yield only to a complete root. */
import {
  BoxGeometry, BufferAttribute, Color, Group, InstancedBufferAttribute, InterleavedBufferAttribute,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3,
} from "three";
import type { Material } from "three";
import data from "./data/federalMinistriesV321.json";
import { completePackedRootV307, createPackedRootStepsV309, type RequiredPackedV307 } from "./requiredPackedRootV307";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { interleaveStaticGeometry } from "./interleaveStaticGeometry";
import { staticStorageInfo, parkStaticInstancesSteps } from "./losslessStaticStorage";
import { isSceneGeometryGpuRetirementV309 } from "./sceneGeometryGpuResidency";
import { isSceneInstanceGpuRetirementV309 } from "./sceneGpuResidency";
import { isSceneMaterialProgramRetirementV321 } from "./sceneMaterialPrograms";
import { hasMinecraftMaterialProvenance } from "./visual-modes/minecraft/materialMode";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";
import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import type { DeutschesTheaterVoxelPayload } from "./DeutschesTheater";

type Face = {detail?:{style:string;palette:number[];pitch:number;storey:number;ratio:number}; owner:string; parent?:string; a:number[]; d:number[]; n:number[]; range:number[]; scope?:number[]; polygon?:number[][]; holes?:number[][][]; voids:number[][]};
type Site = {key:string; style:string; palette:number[]; pitch:number; storey:number; ratio:number; faces:Face[]; nativeFaces?:Face[]; partIds:string[]};
type NavigationPart = {site:string; id:string; ring:number[][]; holes:number[][][]; groundY:number; topY:number; roofTriangles:number[][][]};
type Profile = {schemaVersion:number; sites:Site[]; models:RequiredPackedV307[]; navigation:NavigationPart[]; oldBodies:PrismBuilding[]; sourcePrisms?:PrismBuilding[]; nativeNavigationCells:number[][]; nativeColumns?:{cellM:number; grid:VoxelPayload["grid"]; records:{tuple:number[]; contributors:string[]; exclusive:boolean; owner:string}[]}; justiceColonnade:{a:number[];b:number[];base:number;spring:number;crown:number;bays:number;openRing:number[][];ceiling:number;nativeBase?:number;nativeCeiling?:number}};
const source=data as unknown as Profile;
// Updated only by the finite offline finalizer after the source catalogue closes.
const EXPECTED_PROFILE_CONTROL: number = 3786660460;
const bodyOwner=Symbol("Complete federal ministry measured bodies v321");
const fnv=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
let admittedProfile:boolean|undefined;
function profileReady():boolean {
  return admittedProfile??=(EXPECTED_PROFILE_CONTROL!==0&&source.schemaVersion===1&&source.sites.length===8&&new Set(source.sites.map(s=>s.key)).size===8&&source.models.length===20&&source.oldBodies.length===5&&fnv(JSON.stringify(source))===EXPECTED_PROFILE_CONTROL);
}
/** Own-data equality rejects getters, inherited substitutes and changed rings. */
function exact(actual:unknown, expected:unknown):boolean {
  if(actual===expected)return true;
  if(!actual||!expected||typeof actual!=="object"||typeof expected!=="object"||Array.isArray(actual)!==Array.isArray(expected))return false;
  const a=Object.getOwnPropertyNames(actual),b=Object.getOwnPropertyNames(expected);
  return a.length===b.length&&b.every(key=>{const d=Object.getOwnPropertyDescriptor(actual,key),e=Object.getOwnPropertyDescriptor(expected,key);return !!d&&!!e&&"value"in d&&"value"in e&&exact(d.value,e.value);});
}
/** Pure, strict original-record predicate; no geographical substitute. */
export function federalMinistryPreviousPrismV321(prism:unknown):boolean {
  return profileReady()&&source.oldBodies.some(p=>exact(prism,p));
}
function sourceAdmitted(prisms:readonly PrismBuilding[]|undefined,native:boolean,voxels?:DeutschesTheaterVoxelPayload):boolean {
  if(!profileReady()||!prisms||!source.sourcePrisms?.length)return false;
  const wanted=new Map(source.sourcePrisms.map(p=>[p.id,p])),found=new Set<string>();
  for(const p of prisms){const d=p&&Object.getOwnPropertyDescriptor(p,"id"),id=d&&"value"in d?d.value:undefined;if(typeof id!=="string"||!wanted.has(id))continue;if(found.has(id)||!exact(p,wanted.get(id)))return false;found.add(id);}
  if(found.size!==wanted.size)return false;
  if(!native)return true;
  if(!voxels||!source.nativeColumns||voxels.cell_m!==source.nativeColumns.cellM||!exact(voxels.grid,source.nativeColumns.grid)||source.sites.some(s=>!s.nativeFaces?.length))return false;
  let count=0;
  if(voxels.building_rows){
    for(const r of source.nativeColumns.records){const[x,z,b,t,c]=r.tuple,row=voxels.building_rows[z-voxels.grid.min_z_idx];if(!row)return false;let matched=0;
      for(const[start,n,low,high,cls]of row)if(x>=voxels.grid.min_x_idx+start&&x<voxels.grid.min_x_idx+start+n){if(low!==b||high!==t||cls!==c)return false;matched++;}
      if(matched!==1)return false;count++;
    }
  }else if(voxels.buildings){
    const expected=new Map(source.nativeColumns.records.map(r=>[`${r.tuple[0]},${r.tuple[1]}`,r.tuple]));
    for(const row of voxels.buildings){const key=`${row[0]},${row[1]}`;if(expected.has(key)){if(!exact(row,expected.get(key)))return false;count++;}}
  }
  return count===source.nativeColumns.records.length;

}
const inRing=(x:number,y:number,ring:readonly number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const inPart=(x:number,z:number,p:NavigationPart)=>inRing(x,z,p.ring)&&!p.holes.some(h=>inRing(x,z,h));
const fits=(f:Face,u:number,y:number,w:number,h:number)=>{
  const lo=u-w/2,hi=u+w/2,b=y-h/2,t=y+h/2;
  if(lo<f.range[0]||hi>f.range[1]||b<f.range[2]||t>f.range[3])return false;
  if(f.voids.some(v=>hi>v[0]&&lo<v[1]&&t>v[2]&&b<v[3]))return false;
  if(f.polygon){const corners=[[lo,b],[lo,t],[hi,t],[hi,b]];for(const[x,z]of corners)if(!inRing(x,z,f.polygon)||f.holes?.some(r=>inRing(x,z,r)))return false;
    // Four corners alone do not prove containment around a concave notch or
    // a complete source hole lying wholly inside a proposed window.
    for(const ring of[f.polygon,...f.holes??[]])for(let i=0;i<ring.length;i++){
      const a=ring[i],q=ring[(i+1)%ring.length];if(a[0]>lo&&a[0]<hi&&a[1]>b&&a[1]<t)return false;
      for(let j=0;j<4;j++){const c=corners[j],d=corners[(j+1)%4],cross=(u:number[],v:number[],w:number[])=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
        if(cross(a,q,c)*cross(a,q,d)<0&&cross(c,d,a)*cross(c,d,q)<0)return false;}
    }}
  return true;
};
type BoxRow={p:number[];s:number[];yaw:number;color:number;role:string};
function* rowSteps(native:boolean):Generator<void,BoxRow[]>{
  let panes=0;
  const all:BoxRow[]=[];
  const add=(f:Face,u:number,y:number,w:number,h:number,color:number,depth:number,out:number,role:string,checked=false)=>{
    if(!checked&&!fits(f,u,y,w,h))return;
    all.push({p:[f.a[0]+f.d[0]*u+f.n[0]*out,y,f.a[1]+f.d[1]*u+f.n[1]*out],s:[w,h,depth],yaw:native?0:-Math.atan2(f.d[1],f.d[0]),color,role});
    if(native&&Math.abs(f.d[1])>.5){const r=all[all.length-1];r.s=[depth,h,w];}
  };
  for(const site of source.sites)for(const f of native?site.nativeFaces!:site.faces){
    const profile={...site,...f.detail};
    if(native&&Math.abs(f.d[0]*f.d[1])>1e-9)throw Error("Native ministry front is not cardinal");
    const[u0,u1,bottom,top]=f.range,length=u1-u0,bays=Math.max(1,Math.round(length/profile.pitch)),pitch=length/bays;
    const historic=profile.style.startsWith("historic")||profile.style==="vohl-and-basalt";
    const width=Math.min(pitch-.22,pitch*profile.ratio),height=Math.min(profile.storey-1.05,historic?2.65:2.7);
    // Fine reveals and mullions are independent geometry, never a photograph.
    for(let y=bottom+2.05,level=0;y+height/2<top-.3;y+=profile.storey,level++)for(let bay=0;bay<bays;bay++){
      const u=u0+(bay+.5+(profile.style==="basalt-shifted"&&level%2?.18:0))*pitch;
      if(!fits(f,u,y,width+.44,height+.50))continue;
      if(++panes%32===0)yield;
      add(f,u,y,width+.28,height+.26,profile.palette[0],.08,.32,"source-face reveal",true);
      add(f,u,y,width,height,profile.palette[1],.07,.39,"glazing",true);
      for(const side of[-1,1])add(f,u+side*(width/2+.04),y,.105,height+.2,profile.palette[2],.13,.44,"vertical frame",true);
      for(const side of[-1,1])add(f,u,y+side*(height/2+.045),width+.2,.105,profile.palette[2],.13,.44,"horizontal frame",true);
      add(f,u,y,.065,height,profile.palette[2],.10,.48,"mullion",true);
      if(historic)add(f,u,y-height/2-.15,width+.42,.16,profile.palette[0],.30,.48,"historic sill",true);
      if(profile.style==="gmp-frame")add(f,u,y+.2,width,.075,profile.palette[2],.10,.48,"gmp transom",true);
    }
    for(const y of[bottom+.18,top-.15])add(f,(u0+u1)/2,y,length,.17,profile.palette[0],.23,.30,"retained facade edge");
  }
  all.push(...colonnadeRows(native));return all;
}
function colonnadeRows(native:boolean):BoxRow[]{
  const all:BoxRow[]=[];
  const c=source.justiceColonnade,a=c.a,d=[c.b[0]-a[0],c.b[1]-a[1]],length=Math.hypot(...d),unit=d.map(v=>v/length),n=[unit[1],-unit[0]],base=native?(c.nativeBase??5.2):c.base;
  for(let pier=0;pier<=c.bays;pier++)for(const twin of[-1,1]){
    const u=pier*length/c.bays+twin*.23,p=[a[0]+unit[0]*u,base+(c.spring-base)/2,a[1]+unit[1]*u];
    all.push({p,s:[.34,c.spring-base,.34],yaw:0,color:0xC8B58D,role:"paired Tuscan colonnade support"});
    all.push({p:[p[0],c.spring+.10,p[2]],s:[.55,.25,.55],yaw:0,color:0xC8B58D,role:"Tuscan capital"});
  }
  for(let bay=0;bay<c.bays;bay++)for(let piece=0;piece<12;piece++){
    const t=(piece+.5)/12*Math.PI,u=(bay+.5)*length/c.bays+Math.cos(t)*(length/c.bays/2-.20),y=c.spring+Math.sin(t)*(c.crown-c.spring);
    const p=[a[0]+unit[0]*u+n[0]*.02,y,a[1]+unit[1]*u+n[1]*.02];all.push({p,s:[.32,.31,.55],yaw:native?0:-Math.atan2(unit[1],unit[0]),color:0xC8B58D,role:"seven colonnade arches"});
  }
  return all;
}

type StaticAttribute=BufferAttribute|InterleavedBufferAttribute;
const storage=(a:StaticAttribute)=>a instanceof InterleavedBufferAttribute?a.data:a;
type AttrPin={attribute:StaticAttribute;info:ReturnType<typeof staticStorageInfo>;version:number;count:number;size:number;normalized:boolean;offset:number;stride:number};
const pin=(attribute:StaticAttribute):AttrPin=>({attribute,info:staticStorageInfo(storage(attribute)),version:storage(attribute).version,count:attribute.count,size:attribute.itemSize,normalized:attribute.normalized,offset:attribute instanceof InterleavedBufferAttribute?attribute.offset:0,stride:attribute instanceof InterleavedBufferAttribute?attribute.data.stride:attribute.itemSize});
const intact=(a:StaticAttribute|undefined,p:AttrPin)=>{if(!a||a!==p.attribute||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;const q=staticStorageInfo(storage(a));return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes;};
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,Number(o.matrixAutoUpdate),Number(o.matrixWorldAutoUpdate)];
const samePose=(o:Object3D,p:number[])=>{const q=pose(o);return q.length===p.length&&q.every((v,i)=>Object.is(v,p[i]));};
type MemberReceipt={mesh:InstancedMesh;geometry:BoxGeometry;attributes:Map<string,AttrPin>;index:AttrPin;matrix:AttrPin;color:AttrPin;count:number;day:Material;night:Material;grade:Material;meshPose:number[];lit:boolean};
type Receipt={native:boolean;body:Group;members:MemberReceipt[];rootPose:number[];bodyPose:number[];invalid:boolean};
const complete=new WeakMap<Group,Receipt>();
export function hasCompleteFederalMinistriesV321(root:Group,native?:boolean):boolean {
 const r=complete.get(root);if(!r||r.invalid||native!==undefined&&native!==r.native||!root.visible||root.children.length!==r.members.length+1||root.children[0]!==r.body||r.body.parent!==root||!samePose(root,r.rootPose)||!samePose(r.body,r.bodyPose)||!completePackedRootV307(r.body,bodyOwner,r.native))return false;
 return r.members.every((q,i)=>{const m=q.mesh;return root.children[i+1]===m&&m.parent===root&&samePose(m,q.meshPose)&&m.visible&&m.geometry===q.geometry&&m.count===q.count&&Object.keys(m.geometry.attributes).length===q.attributes.size&&[...q.attributes].every(([k,p])=>intact(m.geometry.getAttribute(k)as StaticAttribute,p))&&intact(m.geometry.index??undefined,q.index)&&intact(m.instanceMatrix,q.matrix)&&intact(m.instanceColor??undefined,q.color)&&(m.material===q.day||m.material===q.night||m.material===q.grade||hasMinecraftMaterialProvenance(m,q.day,m.material as Material)||hasMinecraftMaterialProvenance(m,q.night,m.material as Material)||hasMinecraftMaterialProvenance(m,q.grade,m.material as Material))&&m.userData.dayMaterial===q.day&&m.userData.nightMaterial===q.night&&m.userData.schwellenraumMaterial===q.grade&&(!q.lit||q.night.userData.nightEmissive===0xE6C782&&q.night.userData.nightEmissiveIntensity===.42);});
}
/** Closed by default. The same full face count is used on touch and desktop. */
export function* createFederalMinistriesV321Steps(native=false,options:{sourcePrisms?:readonly PrismBuilding[];voxels?:DeutschesTheaterVoxelPayload;mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group> {
  const root=new Group();root.name="Current federal ministry public architecture v321";root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
  onCreate?.(root);
  if(!sourceAdmitted(options.sourcePrisms,native,options.voxels))return root;
  const resources=new Set<{dispose():void}>();let delivered=false;
  try{
    const body=yield*createPackedRootStepsV309(bodyOwner,"Complete X8 and Justice measured lower families v321",native,source.models.filter(p=>p.native===native),{sourceGeometryRetained:true},body=>root.add(body));
    const list=yield*rowSteps(native);
    const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");resources.add(geometry);
    // The partition changes no matrix/colour word. Only a deterministic small
    // subset of glazing receives the existing lights-on emissive contract;
    // frames and the remaining windows stay dark, with no occupancy claim.
    const frames:BoxRow[]=[],lit:BoxRow[]=[];
    for(const row of list)(row.role==="glazing"&&fnv(row.p.join(","))%3===0?lit:frames).push(row);
    const count=list.length;list.length=0;
    const members:InstancedMesh[]=[];
    for(const group of[{rows:frames,lit:false},{rows:lit,lit:true}]){
      if(!group.rows.length)throw Error("Incomplete ministry facade material partition");
      const day=new MeshBasicMaterial({color:0xFFFFFF}),night=new MeshStandardMaterial({color:0xFFFFFF,roughness:group.lit ? .7 : .91});resources.add(day);resources.add(night);
      if(group.lit){night.userData.nightEmissive=0xE6C782;night.userData.nightEmissiveIntensity=.42;}
      const mesh=new InstancedMesh(geometry,day,0),matrices=new Float32Array(group.rows.length*16),colors=new Float32Array(group.rows.length*3),matrix=new Matrix4(),size=new Vector3(),tint=new Color();
      for(let i=0;i<group.rows.length;i++){const row=group.rows[i];matrix.makeRotationY(row.yaw).scale(size.fromArray(row.s)).setPosition(...row.p as[number,number,number]).toArray(matrices,i*16);tint.setHex(row.color).toArray(colors,i*3);if(i%512===511)yield;}
      mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=group.rows.length;group.rows.length=0;
      mesh.name=group.lit?"Source-bound ministry illuminated glazing":"Source-bound ministry reveals, unlit glazing and seven public colonnade arches";
      mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);resources.add(mesh);members.push(mesh);
      const grade=schwellenraumMaterialFor(mesh,day);mesh.userData.schwellenraumMaterial=grade;resources.add(grade);mesh.computeBoundingBox();mesh.computeBoundingSphere();yield;
    }
    interleaveStaticGeometry(root);freezeStaticSceneTransforms(root);yield*parkStaticInstancesSteps(root);
    const receipt:Receipt={native,body,members:members.map((mesh,i)=>({mesh,geometry,attributes:new Map(Object.entries(geometry.attributes).map(([k,a])=>[k,pin(a as StaticAttribute)])),index:pin(geometry.index!),matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),count:mesh.count,day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:mesh.userData.schwellenraumMaterial,meshPose:pose(mesh),lit:i===1})),rootPose:pose(root),bodyPose:pose(body),invalid:false};
    geometry.addEventListener("dispose",()=>{if(!isSceneGeometryGpuRetirementV309(geometry))receipt.invalid=true;});
    for(const mesh of members){mesh.addEventListener("dispose",()=>{if(!isSceneInstanceGpuRetirementV309(mesh))receipt.invalid=true;});for(const m of[mesh.userData.dayMaterial,mesh.userData.nightMaterial,mesh.userData.schwellenraumMaterial]as Material[])m.addEventListener("dispose",()=>{if(!isSceneMaterialProgramRetirementV321(m))receipt.invalid=true;});}
    complete.set(root,receipt);root.userData.instances=count;delivered=true;return root;
  }finally{if(!delivered){root.traverse(o=>{const m=o as InstancedMesh;if(m.geometry)resources.add(m.geometry);for(const q of[m.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(q?.dispose)resources.add(q);});for(const q of resources)q.dispose();root.clear();}}
}
/** Tests and existing callers drain the same cooperative constructor. */
export function createFederalMinistriesV321(native=false,options:{sourcePrisms?:readonly PrismBuilding[];voxels?:DeutschesTheaterVoxelPayload;mobileLike?:boolean}={}):Group{
 const steps=createFederalMinistriesV321Steps(native,options);for(;;){const r=steps.next();if(r.done)return r.value;}
}

function roofAt(p:NavigationPart,x:number,z:number):number|null {
  if(!inPart(x,z,p))return null;let top:number|null=null;
  for(const[a,b,c]of p.roofTriangles){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8)top=Math.max(top??-Infinity,u*a[1]+v*b[1]+w*c[1]);}return top??p.topY;
}
/** No old collision is disabled by a coordinate zone. */
export function federalMinistryReplacesNavigationV321(root:Group,prism:unknown):boolean {return hasCompleteFederalMinistriesV321(root)&&federalMinistryPreviousPrismV321(prism);}
export function federalMinistryNavigationV321(root:Group,native=false):{solidAt(x:number,y:number,z:number,radius?:number):boolean;groundAt(x:number,z:number,currentY?:number):number|null}|null {
  if(!hasCompleteFederalMinistriesV321(root,native))return null;
  const c=source.justiceColonnade,columns=new Map<string,number[]>(),cells=new Set<string>();
  if(native)for(const[ix,iy,iz]of source.nativeNavigationCells){cells.add(`${ix},${iy},${iz}`);const key=`${ix},${iz}`,a=columns.get(key)??[];a.push((iy+1)*2+5.2);columns.set(key,a);}
  const supports=colonnadeRows(native).filter(r=>r.role.includes("colonnade")||r.role.includes("Tuscan"));
  const supportAt=(x:number,y:number,z:number,radius:number)=>supports.some(r=>{
    const dx=x-r.p[0],dz=z-r.p[2],co=Math.cos(r.yaw),si=Math.sin(r.yaw),u=co*dx-si*dz,v=si*dx+co*dz;
    return Math.abs(u)<r.s[0]/2+radius&&Math.abs(v)<r.s[2]/2+radius&&y>=r.p[1]-r.s[1]/2&&y<r.p[1]+r.s[1]/2;
  });
  return {solidAt(x,y,z,radius=0){
    if(!hasCompleteFederalMinistriesV321(root,native))return false;
    if(supportAt(x,y,z,radius))return true;
    const samples=radius?[[x,z],[x-radius,z-radius],[x-radius,z+radius],[x+radius,z-radius],[x+radius,z+radius]]:[[x,z]];
    if(native)return samples.some(([px,pz])=>cells.has(`${Math.floor(px/2)},${Math.floor((y-5.2)/2)},${Math.floor(pz/2)}`));
    for(const[px,pz]of samples){if(inRing(px,pz,c.openRing)&&y>=c.base&&y<c.ceiling)continue;
      if(source.navigation.some(p=>inPart(px,pz,p)&&y>=p.groundY&&y<(roofAt(p,px,pz)??p.topY)))return true;}
    return false;
  },groundAt(x,z,currentY){
    if(!hasCompleteFederalMinistriesV321(root,native)||currentY===undefined)return null;
    let best:number|null=null;const accept=(top:number)=>{if(top>=currentY-1&&top<=currentY+.65)best=Math.max(best??-Infinity,top);};
    if(native){for(const top of columns.get(`${Math.floor(x/2)},${Math.floor(z/2)}`)??[])accept(top);}
    else for(const p of source.navigation){const top=roofAt(p,x,z);if(top!==null)accept(top);}
    if(inRing(x,z,c.openRing))accept(native?c.nativeBase??5.2:c.base);
    return best;
  }};
}

let previousColumns:ReadonlySet<string>|undefined;
/** Exact raw native signatures only. Mixed contributions never yield. */
export function federalMinistryPreviousColumnV321(column:readonly number[]):boolean {
  if(!profileReady()||column.length!==5||!source.nativeColumns)return false;
  previousColumns??=new Set(source.nativeColumns.records.filter(r=>r.exclusive).map(r=>r.tuple.join(",")));
  return previousColumns.has(column.join(","));
}
export { federalMinistryPreviousPlanV321, federalMinistryPreviewPlanV321, federalMinistryCentralPlanV321 } from "./federalMinistryPreviousV321";
