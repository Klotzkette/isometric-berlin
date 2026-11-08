/** Bounded source-bound U-Bahn access recognition. Existing authored accesses
 * and all original ground stay with their original owners. No cutting here. */
import {BoxGeometry,BufferAttribute,Color,Group,InstancedBufferAttribute,InstancedMesh,
  InterleavedBufferAttribute,Matrix4,MeshBasicMaterial,MeshStandardMaterial,Quaternion,Vector3,
  type Material,type Object3D} from 'three';
import data from './data/ubahnAccessV326.json';
import {letteringLayout,letteringStrokePaths} from './drawnLettering';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {interleaveStaticGeometry} from './interleaveStaticGeometry';
import {isParkedStaticStorageV321,staticStorageInfo} from './losslessStaticStorage';
import {isSceneGeometryGpuRetirementV309} from './sceneGeometryGpuResidency';
import {isSceneInstanceGpuRetirementV309} from './sceneGpuResidency';
import {isSceneMaterialProgramRetirementV321} from './sceneMaterialPrograms';
import {schwellenraumMaterialFor} from './visual-modes/schwellenraum/materialGrade';
import {hasMinecraftMaterialProvenance} from './visual-modes/minecraft/materialMode';

type P=[number,number];type V=[number,number,number];
type Stair={sourceWay:string;points:P[];ring:P[];width:number;length:number;steps:number;descent:number;level:string|null;mappedStepCount:boolean;mappedWidth:boolean};
type Entry={id:string;station:string;point:P;key:string;axis:P;headingWay:string;association:object;ref:string;stair:Stair|null};
type Station={id:string;name:string;bvgName:string;lines:string[];nodes:string[];entrances:string[];temporaryU6Closure:boolean};
type Profile={schemaVersion:number;source:object;references:object[];stations:Station[];entries:Entry[];omitted:object[];estimates:object;evidenceSha256:string};
const source=data as unknown as Profile,CONTROL=2948145808;
const hashJSON=(q:unknown)=>{let h=2166136261;for(const c of JSON.stringify(q))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
type JSONPin={object:object;prototype:object|null;fields:[PropertyKey,PropertyDescriptor][]};
function jsonPins(q:unknown,out:JSONPin[]=[],seen=new Set<object>()):JSONPin[]|null{
 if(q===null||typeof q!=='object')return out;if(seen.has(q))return null;seen.add(q);
 const proto=Object.getPrototypeOf(q),keys=Reflect.ownKeys(q),array=Array.isArray(q);
 if(array?proto!==Array.prototype||keys.length!==q.length+1||Array.from({length:q.length},(_,i)=>String(i)).some(k=>!Object.hasOwn(q,k)):proto!==Object.prototype&&proto!==null)return null;
 const fields:JSONPin['fields']=[];for(const k of keys){const d=Object.getOwnPropertyDescriptor(q,k)!;if(typeof k!=='string'||!('value'in d))return null;fields.push([k,d]);if(!jsonPins(d.value,out,seen))return null;}
 out.push({object:q,prototype:proto,fields});return out;
}
const sameJSON=(pins:JSONPin[])=>pins.every(p=>Object.getPrototypeOf(p.object)===p.prototype&&Reflect.ownKeys(p.object).length===p.fields.length&&p.fields.every(([k,d])=>{const q=Object.getOwnPropertyDescriptor(p.object,k);return q&&'value'in q&&Object.is(q.value,d.value)&&q.enumerable===d.enumerable&&q.configurable===d.configurable&&q.writable===d.writable;}));
type Attr=BufferAttribute|InterleavedBufferAttribute;
const store=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
function words(a:Attr):number{const v=store(a).array,b=new Uint8Array(v.buffer,v.byteOffset,v.byteLength),w=new Uint32Array(b.buffer,b.byteOffset,Math.floor(b.length/4));let h=2166136261;for(let i=0;i<w.length;i++)h=Math.imul(h^w[i],16777619)>>>0;for(let i=w.length*4;i<b.length;i++)h=Math.imul(h^b[i],16777619)>>>0;return h;}
type Pin={a:Attr;version:number;size:number;count:number;normalized:boolean;offset:number;stride:number;info:ReturnType<typeof staticStorageInfo>;hash:number};
const pin=(a:Attr):Pin=>({a,version:store(a).version,size:a.itemSize,count:a.count,normalized:a.normalized,offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize,info:staticStorageInfo(store(a)),hash:words(a)});
function intact(a:Attr|null|undefined,p:Pin):boolean{
 if(!a||a!==p.a||store(a).version!==p.version||a.itemSize!==p.size||a.count!==p.count||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;
 const s=store(a),q=staticStorageInfo(s);return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes&&(isParkedStaticStorageV321(s)||words(a)===p.hash);
}
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:number[])=>pose(o).every((v,i)=>Object.is(v,p[i]));
const materialShape=(m:Material)=>JSON.stringify([m.type,m.opacity,m.transparent,m.alphaTest,m.depthWrite,m.depthTest,m.side,(m as MeshBasicMaterial).vertexColors,(m as MeshStandardMaterial).roughness,(m as MeshStandardMaterial).metalness]);
type Part={p:V;s:V;rgb:number;q:Quaternion};
type Member={mesh:InstancedMesh;geometry:InstancedMesh['geometry'];attrs:[string,Pin][];index:Pin;matrix:Pin;color:Pin;pose:number[];count:number;castShadow:boolean;receiveShadow:boolean;day:Material;night:Material;grade:Material;shapes:string[]};
export type UbahnAccessOpeningV326={id:string;sourceWay:string;sourcePoints:readonly P[];ring:readonly P[];surfaceY:number;bottomY:number;width:number;steps:number;native:boolean;nativeCells?:readonly P[];cellM?:number};
type GroundEntry={entry:Entry;base:number;bounds:[number,number,number,number];cells?:P[]};
type Receipt={native:boolean;stairs:boolean;metadata:JSONPin[];members:Member[];pose:number[];invalid:boolean;resources:Set<{dispose():void}>;entries:GroundEntry[];openings:UbahnAccessOpeningV326[];sourceEntries:Entry[];sourceStations:Station[];sourceLength:number;stationLength:number;selectedIndices:number[];stationIndices:number[];stationRefs:Station[]};
const receipts=new WeakMap<Group,Receipt>();

/** Private full current-word/shape/pose/material proof; parked immutable storage
 * can prove unchanged bytes without inflating it on every query. */
export function hasCompleteUbahnAccessV326(root:Group,native?:boolean):boolean{
 const r=receipts.get(root);if(!r||r.invalid||native!==undefined&&r.native!==native||!root.visible||!samePose(root,r.pose)||!sameJSON(r.metadata)||source.entries!==r.sourceEntries||source.stations!==r.sourceStations||source.entries.length!==r.sourceLength||source.stations.length!==r.stationLength||r.selectedIndices.some((i,j)=>source.entries[i]!==r.entries[j].entry)||r.stationIndices.some((i,j)=>source.stations[i]!==r.stationRefs[j])||root.children.length!==r.members.length)return false;
 return r.members.every((p,i)=>{const m=p.mesh;return root.children[i]===m&&m.parent===root&&m.visible&&samePose(m,p.pose)&&m.geometry===p.geometry&&m.count===p.count&&m.castShadow===p.castShadow&&m.receiveShadow===p.receiveShadow&&m.morphTexture===null&&Object.keys(m.geometry.morphAttributes).length===0&&m.geometry.drawRange.start===0&&m.geometry.drawRange.count===Infinity&&Object.keys(m.geometry.attributes).length===p.attrs.length&&p.attrs.every(([k,a])=>intact(m.geometry.getAttribute(k)as Attr,a))&&intact(m.geometry.index,p.index)&&intact(m.instanceMatrix,p.matrix)&&intact(m.instanceColor,p.color)&&m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&[p.day,p.night,p.grade].every((q,j)=>materialShape(q)===p.shapes[j])&&(m.material===p.day||m.material===p.night||m.material===p.grade||[p.day,p.night,p.grade].some(q=>hasMinecraftMaterialProvenance(m,q,m.material as Material)));});
}
function inside(p:P,ring:readonly P[]):boolean{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function along(p:P,points:readonly P[]):{u:number;distance:number}{let total=0,best={u:0,distance:Infinity};for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(!length)continue;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(length*length))),distance=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);if(distance<best.distance)best={u:total+t*length,distance};total+=length;}return best;}
function pointAt(points:readonly P[],u:number):{p:P;axis:P}{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(u<=len||i===points.length-1){const t=Math.max(0,Math.min(1,u/len));return{p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],axis:[(b[0]-a[0])/len,(b[1]-a[1])/len]};}u-=len;}throw Error('Missing exact source path');}
function nativeCells(s:Stair):P[]{const out:P[]=[],ring=s.ring,minX=Math.floor(Math.min(...ring.map(p=>p[0]))*4),maxX=Math.ceil(Math.max(...ring.map(p=>p[0]))*4),minZ=Math.floor(Math.min(...ring.map(p=>p[1]))*4),maxZ=Math.ceil(Math.max(...ring.map(p=>p[1]))*4);for(let iz=minZ;iz<maxZ;iz++)for(let ix=minX;ix<maxX;ix++){const x=ix/4,z=iz/4;if([[x+.00001,z+.00001],[x+.24999,z+.00001],[x+.24999,z+.24999],[x+.00001,z+.24999]].every(p=>inside(p as P,ring)))out.push([x,z]);}return out;}

export type UbahnAccessOptionsV326={native:boolean;stairs?:boolean;keys?:readonly string[];sourceIds?:readonly string[];terrainAt:(x:number,z:number,sourceY:number)=>number};
/** At most eight requested512m cells/96 exact entrances; no whole-city default.
 * Caller owns attachment and exact old-ground complements. Cancelling at any
 * yield disposes only this new incomplete group and never touches old sources. */
export function* createUbahnAccessV326Steps(options:UbahnAccessOptionsV326,onCreate?:(root:Group)=>void):Generator<void,Group|null>{
 const root=new Group(),resources=new Set<{dispose():void}>();let delivered=false;const r:Receipt={native:options.native,stairs:options.stairs!==false,metadata:[],members:[],pose:[],invalid:false,resources,entries:[],openings:[],sourceEntries:[],sourceStations:[],sourceLength:0,stationLength:0,selectedIndices:[],stationIndices:[],stationRefs:[]};const invalidate=()=>{r.invalid=true;};
 try{
  if(source.schemaVersion!==1||hashJSON(source)!==CONTROL||typeof options.terrainAt!=='function'||options.stairs!==undefined&&typeof options.stairs!=='boolean'||!['boolean'].includes(typeof options.native))return null;
  const keys=options.keys,ids=options.sourceIds;if(!!keys===!!ids)return null;
  if(keys&&(!keys.length||keys.length>8||new Set(keys).size!==keys.length||keys.some(k=>!source.entries.some(e=>e.key===k))))return null;
  if(ids&&(!ids.length||ids.length>96||new Set(ids).size!==ids.length||ids.some(id=>!source.entries.some(e=>e.id===id))))return null;
  const entries=source.entries.filter(e=>keys?keys.includes(e.key):ids!.includes(e.id));if(!entries.length||entries.length>96)return null;
  const stations=source.stations.filter(s=>entries.some(e=>e.station===s.id));r.sourceEntries=source.entries;r.sourceStations=source.stations;r.sourceLength=source.entries.length;r.stationLength=source.stations.length;r.selectedIndices=entries.map(e=>source.entries.indexOf(e));r.stationIndices=stations.map(s=>source.stations.indexOf(s));r.stationRefs=stations;r.metadata=jsonPins([source.source,source.references,source.estimates,entries,stations])??[];if(!r.metadata.length)return null;
  root.name=`Bounded BVG U-Bahn accesses V326 ${options.native?'native':'drawn'}`;onCreate?.(root);
  const bodies:Part[]=[],signs:Part[]=[],letters:Part[]=[];
  const box=(target:Part[],p:V,s:V,rgb:number,yaw=0)=>{if(p.some(v=>!Number.isFinite(v))||s.some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid finite member');target.push({p,s,rgb,q:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),options.native?0:yaw)});};
  const beam=(target:Part[],a:V,b:V,size:number,rgb:number)=>{const d=new Vector3(...b).sub(new Vector3(...a));if(options.native){const n=Math.max(1,Math.ceil(d.length()/.24));for(let i=0;i<n;i++)box(target,a.map((v,j)=>v+(b[j]-v)*(i+.5)/n)as V,[Math.max(size,Math.abs(d.x)/n),Math.max(size,Math.abs(d.y)/n),Math.max(size,Math.abs(d.z)/n)],rgb);}else target.push({p:a.map((v,j)=>(v+b[j])/2)as V,s:[size,d.length(),size],rgb,q:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.normalize())});};
  for(const entry of entries){
   const base=options.terrainAt(entry.point[0],entry.point[1],3);if(!Number.isFinite(base))return null;
   const s=r.stairs?entry.stair:null;let cells:P[]|undefined;
   if(s){
    const ring=s.ring;if(options.native){cells=nativeCells(s);for(const p of cells){const u=along([p[0]+.125,p[1]+.125],s.points).u,step=Math.min(s.steps,Math.floor(u/Math.max(.2,s.length-.4)*s.steps));box(bodies,[p[0]+.125,base-step*s.descent/s.steps-.09,p[1]+.125],[.25,.18,.25],0xbbb9ac);}}
    else for(let i=0;i<s.steps;i++){const q=pointAt(s.points,(s.length-.4)*(i+.5)/s.steps);box(bodies,[q.p[0],base-i*s.descent/s.steps-.09,q.p[1]],[(s.length-.4)/s.steps,.18,s.width],0xbbb9ac,-Math.atan2(q.axis[1],q.axis[0]));}
    if(!options.native){const q=pointAt(s.points,s.length-.2);box(bodies,[q.p[0],base-s.descent-.09,q.p[1]],[.4,.18,s.width],0x959b95,-Math.atan2(q.axis[1],q.axis[0]));}
    // Concrete retaining panels follow the same finite source stair, never a
    // closed box over its opening or a fictitious underground corridor.
    const nPanels=Math.max(s.steps,Math.ceil(s.length/.24));
    for(let i=0;i<nPanels;i++){const u=s.length*(i+.5)/nPanels,q=pointAt(s.points,u),depth=Math.min(s.descent,u/Math.max(.2,s.length-.4)*s.descent)+.2;
     for(const side of[-1,1]){const nx=-q.axis[1],nz=q.axis[0],p:V=[q.p[0]+nx*side*(s.width/2+.08),base+.1-depth/2,q.p[1]+nz*side*(s.width/2+.08)];box(bodies,p,options.native?[Math.abs(q.axis[0])*s.length/nPanels+Math.abs(nx)*.16,depth,Math.abs(q.axis[1])*s.length/nPanels+Math.abs(nz)*.16]:[s.length/nPanels,depth,.16],0xa8aba2,-Math.atan2(q.axis[1],q.axis[0]));}
    }
    // Source-following side rails, with a continuously descending handrail.
    let total=0;for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;
     for(const side of[-1,1]){const aa:V=[a[0]+nx*side*(s.width/2+.08),base+.96,a[1]+nz*side*(s.width/2+.08)],bb:V=[b[0]+nx*side*(s.width/2+.08),base+.96,b[1]+nz*side*(s.width/2+.08)];beam(bodies,aa,bb,.065,0x5c6964);const n=Math.max(1,Math.ceil(len/.9));for(let j=0;j<=n;j++){const t=j/n;box(bodies,[aa[0]+(bb[0]-aa[0])*t,base+.48,aa[2]+(bb[2]-aa[2])*t],[.065,.96,.065],0x5c6964);}beam(bodies,[a[0]+nx*side*(s.width/2-.12),base-total/s.length*s.descent+.8,a[1]+nz*side*(s.width/2-.12)],[b[0]+nx*side*(s.width/2-.12),base-(total+len)/s.length*s.descent+.8,b[1]+nz*side*(s.width/2-.12)],.055,0x7a807c);}
     total+=len;
    }
    r.openings.push({id:entry.id,sourceWay:s.sourceWay,sourcePoints:s.points,ring,surfaceY:base,bottomY:base-s.descent,width:s.width,steps:s.steps,native:options.native,...(cells?{nativeCells:cells,cellM:.25}:{})});
   }
   const all=s?.ring??[entry.point],bounds:[number,number,number,number]=[Math.min(...all.map(p=>p[0]))-2,Math.min(...all.map(p=>p[1]))-2,Math.max(...all.map(p=>p[0]))+2,Math.max(...all.map(p=>p[1]))+2];r.entries.push({entry,base,bounds,cells});
   const axis=options.native?(Math.abs(entry.axis[0])>=Math.abs(entry.axis[1])?[Math.sign(entry.axis[0]),0]:[0,Math.sign(entry.axis[1])]):entry.axis,nx=-axis[1],nz=axis[0],side=(entry.stair?.width??2.3)/2+.26,cx=entry.point[0]+nx*side,cz=entry.point[1]+nz*side,yaw=-Math.atan2(axis[1],axis[0]);
   const sb=(u:number,y:number,v:number,w:number,h:number,d:number,c:number,target=signs)=>box(target,[cx+axis[0]*u+nx*v,base+y,cz+axis[1]*u+nz*v],options.native?[Math.abs(axis[0])*w+Math.abs(nx)*d,h,Math.abs(axis[1])*w+Math.abs(nz)*d]:[w,h,d],c,yaw);
   sb(0,1.45,0,.09,2.9,.09,0x657372);sb(0,2.64,0,.76,.76,.12,0x1c4f99);sb(0,2.08,0,3.1,.34,.12,0xe6e4d7);
   const station=stations.find(s=>s.id===entry.station)!;const text=station.name.toUpperCase(),height=Math.min(.16,.16*2.86/letteringLayout(text,.16).totalWidthM);
   for(const face of[-1,1]){
    sb(-.20,2.68,face*.075,.10,.43,.025,0xf3efdf,letters);sb(.20,2.68,face*.075,.10,.43,.025,0xf3efdf,letters);sb(0,2.47,face*.075,.48,.10,.025,0xf3efdf,letters);
    for(const path of letteringStrokePaths(text,height))for(let i=1;i<path.length;i++){
     // Right on either viewing face = up cross outward normal. Never mirrored.
     const sp=(p:number[]):V=>[cx+axis[0]*face*p[0]+nx*face*.075,base+2.08-height/2+p[1],cz+axis[1]*face*p[0]+nz*face*.075];
     if(options.native){const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04));for(let j=0;j<n;j++){const p=sp([a[0]+(b[0]-a[0])*(j+.5)/n,a[1]+(b[1]-a[1])*(j+.5)/n]);box(letters,p,[.024,.024,.024],0x273d4f);}}
     else beam(letters,sp(path[i-1]),sp(path[i]),Math.max(.009,height*.08),0x273d4f);
    }
   }
   yield;
  }
  for(const [name,parts]of[['stairs and rails',bodies],['U and name boards',signs],['geometric names',letters]]as const){
   if(!parts.length)continue;const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('uv');geometry.userData.exactIndexPending=false;resources.add(geometry);
   const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:.1});resources.add(day);resources.add(night);
   const matrices=new Float32Array(parts.length*16),colors=new Float32Array(parts.length*3),m=new Matrix4(),c=new Color();parts.forEach((p,i)=>{m.compose(new Vector3(...p.p),p.q,new Vector3(...p.s));m.toArray(matrices,i*16);c.setHex(p.rgb).toArray(colors,i*3);});
   const mesh=new InstancedMesh(geometry,day,0);mesh.count=parts.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.castShadow=name!=='geometric names';mesh.receiveShadow=true;resources.add(mesh);
   mesh.name=`BVG source accesses ${name} V326`;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:options.native,blockNative:options.native,keepInMinecraft:options.native};root.add(mesh);interleaveStaticGeometry(mesh);const grade=schwellenraumMaterialFor(mesh,day);resources.add(grade);
   for(const mat of[day,night,grade])mat.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(mat))invalidate();});geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(geometry))invalidate();});mesh.addEventListener('dispose',()=>{if(!isSceneInstanceGpuRetirementV309(mesh))invalidate();});mesh.computeBoundingBox();mesh.computeBoundingSphere();yield;
  }
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:options.native,blockNative:options.native,keepInMinecraft:options.native,entranceIds:entries.map(e=>e.id)};freezeStaticSceneTransforms(root);r.pose=pose(root);
  r.members=(root.children as InstancedMesh[]).map(mesh=>({mesh,geometry:mesh.geometry,attrs:Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,pin(a as Attr)]),index:pin(mesh.geometry.index!),matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),pose:pose(mesh),count:mesh.count,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,day:mesh.userData.dayMaterial,night:mesh.userData.nightMaterial,grade:mesh.userData.schwellenraumMaterial,shapes:[mesh.userData.dayMaterial,mesh.userData.nightMaterial,mesh.userData.schwellenraumMaterial].map(materialShape)}));
  for(const o of r.openings){o.ring=Object.freeze(o.ring.map(p=>Object.freeze([...p]) as unknown as P));o.sourcePoints=Object.freeze(o.sourcePoints.map(p=>Object.freeze([...p]) as unknown as P));if(o.nativeCells)o.nativeCells=Object.freeze(o.nativeCells.map(p=>Object.freeze([...p]) as unknown as P));Object.freeze(o);}Object.freeze(r.openings);
  receipts.set(root,r);if(!hasCompleteUbahnAccessV326(root,options.native))return null;delivered=true;return root;
 }catch{return null;}finally{if(!delivered){r.invalid=true;receipts.delete(root);for(const q of resources)q.dispose();root.clear();root.removeFromParent();}}
}
export function createUbahnAccessV326(options:UbahnAccessOptionsV326):Group|null{const steps=createUbahnAccessV326Steps(options);for(;;){const s=steps.next();if(s.done)return s.value;}}
export function ubahnAccessOpeningsV326(root:Group):readonly UbahnAccessOpeningV326[]{return hasCompleteUbahnAccessV326(root)?receipts.get(root)!.openings:[];}
export function disposeUbahnAccessV326(root:Group):void{const r=receipts.get(root);if(!r)return;r.invalid=true;receipts.delete(root);root.removeFromParent();for(const q of r.resources)q.dispose();root.clear();}
/** Bounds-first; querying an unrelated street performs no model/source proof. */
export function ubahnAccessGroundAtV326(root:Group,x:number,z:number,currentY?:number):number|null{
 const r=receipts.get(root);if(!r||!r.stairs)return null;const hit=r.entries.find(q=>q.entry.stair&&x>=q.bounds[0]&&z>=q.bounds[1]&&x<=q.bounds[2]&&z<=q.bounds[3]&&inside([x,z],q.entry.stair.ring));if(!hit||!hasCompleteUbahnAccessV326(root,r.native))return null;
 const cell=r.native?hit.cells!.find(p=>x>=p[0]&&z>=p[1]&&x<p[0]+.25&&z<p[1]+.25):undefined;if(r.native&&!cell)return null;const s=hit.entry.stair!,u=along(cell?[cell[0]+.125,cell[1]+.125]:[x,z],s.points).u,step=Math.min(s.steps,Math.floor(u/Math.max(.2,s.length-.4)*s.steps)),y=hit.base-step*s.descent/s.steps;return currentY===undefined||y>=currentY-1&&y<=currentY+.65?y:null;
}
export function ubahnAccessSolidAtV326(root:Group,x:number,y:number,z:number,radius=0):boolean{
 const r=receipts.get(root);if(!r||!r.stairs)return false;const hits=r.entries.filter(q=>q.entry.stair&&x>=q.bounds[0]-radius&&z>=q.bounds[1]-radius&&x<=q.bounds[2]+radius&&z<=q.bounds[3]+radius&&y>=q.base-q.entry.stair.descent-.2&&y<=q.base+1.1);if(!hits.length||!hasCompleteUbahnAccessV326(root,r.native))return false;
 return hits.some(q=>{const s=q.entry.stair!,p=along([x,z],s.points);return p.u>0&&p.u<s.length&&y>=q.base-Math.min(s.descent,p.u/Math.max(.2,s.length-.4)*s.descent)-.2&&Math.abs(p.distance-(s.width/2+.08))<=.08+radius;});
}
