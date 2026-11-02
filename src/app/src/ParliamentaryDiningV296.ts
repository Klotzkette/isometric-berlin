import {BoxGeometry,BufferAttribute,BufferGeometry,Color,CylinderGeometry,Group,InstancedBufferAttribute,InstancedMesh,LineSegments,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,Material,Object3D,SphereGeometry,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {parliamentClipGeometryV295,parliamentClipInkV295} from './ParliamentRetainedEnvelopeV295';
import {DINING_OPENINGS_V296} from './parliamentaryDiningV296Profile';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {PARLIAMENTARY_DINING_V296 as P} from './parliamentaryDiningV296Profile';
type Shape='box'|'round'|'sphere'|'glass';
type Member={x:number;y:number;z:number;w:number;h:number;d:number;yaw:number;color:number;shape:Shape;role:string};
class Plan{
 rows:Member[]=[];roles:Record<string,number>={};constructor(readonly native:boolean){}
 box(x:number,y:number,z:number,w:number,h:number,d:number,color:number,role:string,yaw=0,shape:Shape='box'):void{
  this.roles[role]=(this.roles[role]??0)+1;
  if(!this.native){this.rows.push({x,y,z,w,h,d,color,role,yaw,shape});return;}
  if(shape==='sphere'){
   for(const[dx,dy,dz]of[[0,0,0],[-.24,0,0],[.24,0,0],[0,-.24,0],[0,.24,0],[0,0,-.24],[0,0,.24]])this.rows.push({x:x+dx*w,y:y+dy*h,z:z+dz*d,w:w*.58,h:h*.58,d:d*.58,color,role,yaw:0,shape:'box'});return;
  }
  if(shape==='round'&&h<.3){const cell=.45;for(let dx=-w/2+cell/2;dx<w/2;dx+=cell)for(let dz=-d/2+cell/2;dz<d/2;dz+=cell){if((dx/(w/2))**2+(dz/(d/2))**2>1)continue;this.rows.push({x:x+dx,y,z:z+dz,w:Math.min(cell,w),h,d:Math.min(cell,d),color,role,yaw:0,shape:'box'});}return;}
  if(Math.abs(Math.sin(yaw))<1e-7){this.rows.push({x,y,z,w,h,d,color,role,yaw:0,shape:shape==='glass'?'glass':'box'});return;}
  const n=Math.max(1,Math.ceil(w/.4)),m=Math.max(1,Math.ceil(d/.4)),c=Math.cos(yaw),s=Math.sin(yaw);
  for(let i=0;i<n;i++)for(let j=0;j<m;j++){const u=(i+.5)*w/n-w/2,v=(j+.5)*d/m-d/2;this.rows.push({x:x+c*u+s*v,y,z:z-s*u+c*v,w:Math.abs(c)*w/n+Math.abs(s)*d/m,h,d:Math.abs(s)*w/n+Math.abs(c)*d/m,color,role,yaw:0,shape:shape==='glass'?'glass':'box'});}
 }
}
function table(p:Plan,x:number,floor:number,z:number,radius=.62,chairs=3,colour=0xdbc6a0):void{
 p.box(x,floor+.74,z,radius*2,.09,radius*2,colour,'dining:round-table',0,'round');p.box(x,floor+.38,z,.1,.7,.1,0x777c73,'dining:table-stem');p.box(x,floor+.035,z,.48,.07,.48,0x777c73,'dining:table-foot',0,'round');
 for(let i=0;i<chairs;i++){const a=i*Math.PI*2/chairs,xx=x+Math.cos(a)*(radius+.5),zz=z+Math.sin(a)*(radius+.5),yaw=-a+Math.PI/2;p.box(xx,floor+.42,zz,.48,.08,.48,0xb49471,'dining:chair-seat',yaw,'round');p.box(xx+Math.cos(a)*.17,floor+.69,zz+Math.sin(a)*.17,.48,.42,.08,0xa88968,'dining:chair-back',yaw);for(const side of[-1,1])p.box(xx+Math.cos(a)*.13-Math.sin(a)*side*.17,floor+.21,zz+Math.sin(a)*.13+Math.cos(a)*side*.17,.045,.42,.045,0x5d625c,'dining:chair-leg');}
}
function pardo(p:Plan):void{
 const l=P.lampenladen;
 p.box(l.cx,l.floor-.06,l.cz,l.radius*2,.12,l.radius*2,0xc7d6c6,'pardo:complete-terrazzo-floor',0,'round');
 p.box(l.cx,l.ceiling+.05,l.cz,l.radius*2,.1,l.radius*2,0xd7d8cc,'pardo:complete-room-ceiling',0,'round');
 // Ring glazing has open door sectors. It never substitutes an opaque disc.
 const n=48;for(let i=0;i<n;i++){const a=(i+.5)*Math.PI*2/n,x=l.cx+Math.cos(a)*l.radius,z=l.cz+Math.sin(a)*l.radius,yaw=-a-Math.PI/2;if(i===0||i===23)continue;p.box(x,(l.floor+l.ceiling)/2,z,2*Math.PI*l.radius/n-.06,l.ceiling-l.floor-.12,.055,0xadc6c6,'pardo:transparent-river-glazing',yaw,'glass');p.box(x,(l.floor+l.ceiling)/2,z,.07,l.ceiling-l.floor,.08,0x7c8580,'pardo:slender-window-post',yaw);}
 for(const y of[l.floor+.07,l.ceiling-.06])for(let i=0;i<48;i++){const a=(i+.5)*Math.PI/24;p.box(l.cx+Math.cos(a)*l.radius,y,l.cz+Math.sin(a)*l.radius,Math.PI*l.radius/24+.04,.1,.12,0xa7b0a8,'pardo:glazing-ring-frame',-a-Math.PI/2);}
 const colours=[0x8fac74,0xd6b946,0x658fb2,0xb69ab1,0x728c70,0xd7cfad,0xc68662,0x71aeb2];let lamp=0;
 for(let ix=-6;ix<=6;ix++)for(let iz=-6;iz<=6;iz++){const x=ix*1.85,z=iz*1.85;if(Math.hypot(x,z)>11.8)continue;const k=lamp++,r=.22+(k%3)*.045,y=6.05+(k%4)*.16;p.box(l.cx+x,(y+l.ceiling)/2,l.cz+z,.025,l.ceiling-y,.025,0x87877e,'pardo:lamp-suspension');p.box(l.cx+x,y,l.cz+z,r*2,r*2,r*2,colours[k%colours.length],'pardo:paired-coloured-glass-body',0,'sphere');p.box(l.cx+x+.09,y+.11,l.cz+z,r*1.45,r*1.45,r*1.45,colours[(k+3)%colours.length],'pardo:paired-coloured-glass-body',0,'sphere');}
 let t=0;for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){if(ix===0&&iz===0)continue;const x=ix*4.2,z=iz*4.2;if(Math.hypot(x,z)>10.7)continue;table(p,l.cx+x,l.floor,l.cz+z,.63,3,0xb8a382);t++;}
 p.roles['pardo:illustrative-table-count']=t;p.roles['pardo:illustrative-lamp-count']=lamp;
 for(const[x,z]of[[-5,-3],[2,5],[6,-5],[-8,3]])p.box(l.cx+x,l.floor+.006,l.cz+z,1.2,.02,1.2,0x8fa995,'pardo:independent-terrazzo-tone');
}
function marie(p:Plan):void{
 const m=P.marie,[x0,x1,z0,z1]=m.room,[tx0,tx1]=m.terrace,w=x1-x0,depth=z1-z0;
 p.box((x0+x1)/2,m.floor-.06,(z0+z1)/2,w,.12,depth,0xd4d0bf,'marie:lower-interior-floor');p.box((x0+x1)/2,m.ceiling+.08,(z0+z1)/2,w,.16,depth,0xd6d5c9,'marie:interior-ceiling');
 p.box((x0+x1)/2,m.upper-.08,(z0-165.6)/2,w,.16,-165.6-z0,0xd4d0bf,'marie:upper-balcony-floor');
 p.box((tx0+tx1)/2,m.floor-.08,(z0+z1)/2,tx1-tx0,.16,depth,0xc9c4b5,'marie:lower-terrace');p.box((tx0+tx1)/2,m.upper-.1,(z0-165.6)/2,tx1-tx0,.2,-165.6-z0,0xc9c4b5,'marie:upper-terrace');
 for(let i=0;i<10;i++){const z=z0+(i+.5)*depth/10;if(i===6)continue;p.box(x0,(m.floor+m.ceiling)/2,z,.06,m.ceiling-m.floor-.1,depth/10-.08,0xb1c7c5,'marie:transparent-spree-front',0,'glass');p.box(x0,(m.floor+m.ceiling)/2,z,.08,m.ceiling-m.floor,.07,0x7d8882,'marie:front-mullion');}
 for(const z of[z0,z1])p.box((x0+x1)/2,(m.floor+m.ceiling)/2,z,w,m.ceiling-m.floor,.05,0xb1c7c5,'marie:transparent-room-side',0,'glass');
 for(const y of[m.floor+.03,m.upper,m.ceiling-.04])p.box(x0,y,(z0+z1)/2,.11,.11,depth,0xa5aba0,'marie:horizontal-window-frame');
 // Two visible terrace levels connect by a compact stair; outside source ground remains.
 for(let i=0;i<20;i++){const z=-160.53-i*.26,top=m.floor+(i+1)*(m.upper-m.floor)/20;p.box(tx0+1.2,top-.08,z,2.2,.16,.28,0xc4c2b5,'marie:terrace-stair-tread');}
 for(const floor of[m.floor,m.upper])for(const z of floor===m.floor?[-172.3,-168.2,-160.1,-155.8]:[-172.6,-168.7])for(const x of[388,394.5])table(p,x,floor,z,.52,3,0xd7c7a5);
 for(const[z,floor]of[[-172.4,m.floor],[-168.6,m.floor],[-160,m.floor],[-155.8,m.floor],[-172.4,m.upper],[-168.6,m.upper]])table(p,380.5,floor,z,.51,3,0xd8d1b8);
 for(const[x,z]of[[389,-171],[395,-171],[389,-159],[395,-159]]){p.box(x,6.5,z,.035,1.2,.035,0x85877e,'marie:pendant-stem');p.box(x,5.95,z,.65,.13,.65,0xe3ddbd,'marie:neutral-pendant',0,'round');}
 p.box(399,m.floor+.55,-156,1.4,1.1,3.2,0x9c8062,'marie:service-counter');
 for(const floor of[m.upper])for(const x of[tx0+.12,x0+.12]){for(let z=z0+.3;z<-165.6;z+=1.35)p.box(x,floor+.5,z,.07,1,.07,0x839089,'marie:terrace-guardrail-post');p.box(x,floor+1,-170.6,.08,.08,10.5,0x839089,'marie:terrace-guardrail-top');}
}
function makeBatch(rows:Member[],shape:Shape,native:boolean):InstancedMesh{
 let g:BufferGeometry=shape==='sphere'?new SphereGeometry(.5,12,8):shape==='round'?new CylinderGeometry(.5,.5,1,20):new BoxGeometry(1,1,1);g.deleteAttribute('uv');
 const glass=shape==='glass',day=new MeshBasicMaterial({color:0xffffff,transparent:glass,opacity:glass?.17:1,depthWrite:!glass}),night=new MeshStandardMaterial({color:0xffffff,roughness:glass?.24:.84,transparent:glass,opacity:glass?.17:1,depthWrite:!glass});const mesh=new InstancedMesh(g,day,0),matrices=new Float32Array(rows.length*16),colours=new Float32Array(rows.length*3),m=new Matrix4(),c=new Color(),v=new Vector3();
 rows.forEach((r,i)=>{m.makeRotationY(r.yaw);m.scale(v.set(r.w,r.h,r.d));m.setPosition(r.x,r.y,r.z);m.toArray(matrices,i*16);c.setHex(r.color).toArray(colours,i*3);});mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colours,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.name=`Parliamentary dining ${shape}${native?' cardinal':''}`;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native};return mesh;
}
/** Complete rooms precede any optional source/terrain aperture transaction. */
export function createParliamentaryDiningV296(native=false):Group{
 const p=new Plan(native);pardo(p);marie(p);const root=new Group();root.name=`Parliamentary dining v296${native?' independent native':''}`;
 for(const shape of['box','round','sphere','glass'] as Shape[]){const rows=p.rows.filter(r=>r.shape===shape);if(rows.length)root.add(makeBatch(rows,shape,native));}
 root.userData={parliamentaryDiningV296:true,requiredBeforeNavigation:true,sourceSheetsRetained:true,textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,roles:p.roles,instanceCount:p.rows.length,geometryStatus:P.sourceStatus};return freezeStaticSceneTransforms(root);
}

/** Guarded exact authored owner repair. Unrelated groups/batches retain their arrays. */

export function applyDiningAuthoredOpeningsV296(root:Group,native:boolean,enabled=false):void {
 if(!enabled)return;root.updateMatrixWorld(true);
 const targets:(Mesh|LineSegments)[]=[];
 root.traverse(o=>{
  if(!(o instanceof Mesh||o instanceof LineSegments))return;
  if(native){if(o.name==='Minecraft parliamentary band block signature')targets.push(o);return;}
  let owner=o.parent;while(owner&&owner!==root&&owner.name!=='Marie-Elisabeth-Lüders-Haus Spree facade')owner=owner.parent;
  if(owner?.name==='Marie-Elisabeth-Lüders-Haus Spree facade'||root.name==='Marie-Elisabeth-Lüders-Haus Spree facade')targets.push(o);
 });
 const cuts=DINING_OPENINGS_V296.marie;
 for(const o of targets){
  if(o instanceof InstancedMesh){
   const keptMatrices:number[]=[],keptColours:number[]=[],fragments:BufferGeometry[]=[];const matrix=new Matrix4(),colour=new Color();
   for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,matrix);const g=o.geometry.clone().applyMatrix4(o.matrixWorld.clone().multiply(matrix));
    const clipped=parliamentClipGeometryV295(g,cuts);
    if(clipped===g){keptMatrices.push(...Array.from(o.instanceMatrix.array.slice(i*16,i*16+16)));if(o.instanceColor)keptColours.push(...Array.from(o.instanceColor.array.slice(i*3,i*3+3)));g.dispose();continue;}
    g.dispose();if(!clipped.getAttribute('position').count){clipped.dispose();continue;}if(o.instanceColor){o.getColorAt(i,colour);const rgb=new Float32Array(clipped.getAttribute('position').count*3);for(let k=0;k<rgb.length;k+=3)rgb.set([colour.r,colour.g,colour.b],k);clipped.setAttribute('color',new BufferAttribute(rgb,3));}
    clipped.applyMatrix4(o.parent!.matrixWorld.clone().invert());fragments.push(clipped.index?clipped.toNonIndexed():clipped);
   }
   if(!fragments.length&&keptMatrices.length===o.count*16)continue;
   o.count=keptMatrices.length/16;o.instanceMatrix=new InstancedBufferAttribute(new Float32Array(keptMatrices),16);if(o.instanceColor)o.instanceColor=new InstancedBufferAttribute(new Float32Array(keptColours),3);o.computeBoundingBox();o.computeBoundingSphere();
   if(fragments.length){const g=mergeGeometries(fragments,false)!;fragments.forEach(p=>p.dispose());const mat=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();const replacement=new Mesh(g,mat);replacement.name=o.name+' v296 retained opening fragments';replacement.userData={...o.userData,parliamentaryDiningV296:true,sourceOutsideFragmentsRetained:true};if(o.instanceColor){for(const m of Array.isArray(mat)?mat:[mat])Object.assign(m,{vertexColors:true});for(const key of['dayMaterial','nightMaterial'])if(o.userData[key]){const m=o.userData[key].clone();m.vertexColors=true;replacement.userData[key]=m;}}replacement.castShadow=o.castShadow;replacement.receiveShadow=o.receiveShadow;o.parent!.add(replacement);}
   o.userData.parliamentaryDiningV296=true;
  }else{
   const world=o.geometry.clone().applyMatrix4(o.matrixWorld),clipped=o instanceof LineSegments?parliamentClipInkV295(world,cuts):parliamentClipGeometryV295(world,cuts);if(clipped===world){world.dispose();continue;}world.dispose();clipped.applyMatrix4(o.matrixWorld.clone().invert());const old=o.geometry;o.geometry=clipped;old.dispose();o.userData.parliamentaryDiningV296=true;
  }
 }
 root.userData.parliamentaryDiningV296=true;freezeStaticSceneTransforms(root);
}


/** Clone only the complete named MELH predecessor into an unpublished world.
 * Original geometry, material handles and visibility never change. The caller
 * hides the returned predecessor only in its synchronous publication commit,
 * and restores that visibility if publication rolls back. */
export function prepareDiningAuthoredFacadeV296(originalCentralRoot:Group,enabled=false):{group:Group;predecessor:Object3D}|null{
 if(!enabled)return null;
 const name="Marie-Elisabeth-Lüders-Haus Spree facade",matches:Object3D[]=[];
 originalCentralRoot.traverse(o=>{if(o.name===name&&o.userData.parliamentaryDiningFacadeV296!==true)matches.push(o);});
 if(matches.length!==1)return null;
 const predecessor=matches[0],geometries=new Map<BufferGeometry,BufferGeometry>(),materials=new Map<Material,Material>(),objects=new Map<Object3D,Object3D>();
 const geometry=(old:BufferGeometry)=>{let next=geometries.get(old);if(!next){next=old.clone();geometries.set(old,next);}return next;};
 const material=(old:Material)=>{let next=materials.get(old);if(!next){next=old.clone();next.onBeforeCompile=old.onBeforeCompile;next.customProgramCacheKey=old.customProgramCacheKey;materials.set(old,next);}return next;};
 const materialList=(old:Material|Material[])=>Array.isArray(old)?old.map(material):material(old);
 const clone=(old:Object3D):Object3D=>{
  let next:Object3D;
  if(old instanceof InstancedMesh){const m=new InstancedMesh(geometry(old.geometry),materialList(old.material),0);m.count=old.count;m.instanceMatrix=old.instanceMatrix.clone() as InstancedBufferAttribute;if(old.instanceColor)m.instanceColor=old.instanceColor.clone() as InstancedBufferAttribute;m.boundingBox=old.boundingBox?.clone()??null;m.boundingSphere=old.boundingSphere?.clone()??null;next=m;}
  else if(old instanceof Mesh)next=new Mesh(geometry(old.geometry),materialList(old.material));
  else if(old instanceof LineSegments)next=new LineSegments(geometry(old.geometry),materialList(old.material));
  else if(old instanceof Group)next=new Group();
  else throw new Error("Unknown rendered MELH facade owner; keep original closed");
  objects.set(old,next);next.name=old.name;next.up.copy(old.up);next.position.copy(old.position);next.quaternion.copy(old.quaternion);next.scale.copy(old.scale);next.matrix.copy(old.matrix);next.matrixWorld.copy(old.matrixWorld);next.matrixAutoUpdate=old.matrixAutoUpdate;next.matrixWorldAutoUpdate=old.matrixWorldAutoUpdate;next.visible=old.visible;next.castShadow=old.castShadow;next.receiveShadow=old.receiveShadow;next.frustumCulled=old.frustumCulled;next.renderOrder=old.renderOrder;next.layers.mask=old.layers.mask;
  for(const child of old.children)next.add(clone(child));return next;
 };
 const copied=new WeakMap<object,unknown>();
 const userData=(value:unknown):unknown=>{
  if(value instanceof Material)return material(value);
  if(value instanceof BufferGeometry)return geometry(value);
  if(value instanceof Object3D)return objects.get(value)??value;
  if(!value||typeof value!=="object")return value;
  if(copied.has(value))return copied.get(value);
  if(Array.isArray(value)){const out:unknown[]=[];copied.set(value,out);for(const v of value)out.push(userData(v));return out;}
  if(Object.getPrototypeOf(value)===Object.prototype){const out:Record<string,unknown>={};copied.set(value,out);for(const[k,v]of Object.entries(value))out[k]=userData(v);return out;}
  return value;
 };
 let group:Group|undefined;
 try{
  // Update only derived matrix caches; local source transforms stay unchanged.
  originalCentralRoot.updateWorldMatrix(true,true);
  group=clone(predecessor) as Group;
  if(!(group instanceof Group))throw new Error("Complete MELH facade group required");
  for(const[old,next]of objects)next.userData=userData(old.userData) as Record<string,unknown>;
  group.matrix.copy(predecessor.matrixWorld);group.matrix.decompose(group.position,group.quaternion,group.scale);group.matrixAutoUpdate=false;group.matrixWorldNeedsUpdate=true;
  applyDiningAuthoredOpeningsV296(group,false,true);
  group.userData.parliamentaryDiningFacadeV296=true;group.userData.predecessorUuidV296=predecessor.uuid;group.userData.detachedBeforePublicationV296=true;
  return{group:freezeStaticSceneTransforms(group),predecessor};
 }catch(error){
  // Every allocation is independently owned, including partial clone failure.
  for(const o of objects.values()){const m=o as Mesh;if(m.geometry)geometries.set(m.geometry,m.geometry);for(const v of[m.material,o.userData.dayMaterial,o.userData.nightMaterial])for(const mat of Array.isArray(v)?v:[v])if(mat instanceof Material)materials.set(mat,mat);if(o instanceof InstancedMesh)o.dispose();}
  for(const g of new Set(geometries.values()))g.dispose();for(const m of new Set(materials.values()))m.dispose();throw error;
 }
}
