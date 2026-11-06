/** Bounded reference interpretations; every old owner remains reversible. */
import {
 BoxGeometry,BufferAttribute,BufferGeometry,CatmullRomCurve3,Color,CylinderGeometry,
 Float32BufferAttribute,Group,InstancedBufferAttribute,InstancedMesh,InterleavedBufferAttribute,
 Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,Object3D,SphereGeometry,TubeGeometry,Vector3,
 type Material,
} from "three";
import {letteringLayout,letteringStrokePaths} from "./drawnLettering";
import {interleaveStaticGeometrySteps} from "./interleaveStaticGeometry";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {staticStorageInfo} from "./losslessStaticStorage";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {schwellenraumMaterialFor} from "./visual-modes/schwellenraum/materialGrade";
import {hasMinecraftMaterialProvenance} from "./visual-modes/minecraft/materialMode";
import {isSceneMaterialProgramRetirementV321} from "./sceneMaterialPrograms";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
import {isSceneInstanceGpuRetirementV309} from "./sceneGpuResidency";
import {hasMemorialAccuracySourceRowsV322,type MemorialSiteKeyV322} from "./MemorialPreviousV322";

type P=[number,number,number];
type Box={p:P;s:P;color:number};
type Solid={a:P;b:P;r:number;ellipsoid?:P;yaw?:number;box?:P};
type Options={keys:readonly MemorialSiteKeyV322[];sourceRows:readonly Record<string,unknown>[];mobileLike?:boolean};
type A=BufferAttribute|InterleavedBufferAttribute;
type Pin={attribute:A;info:ReturnType<typeof staticStorageInfo>;version:number;count:number;size:number;normalized:boolean;offset:number;stride:number};
const storage=(a:A)=>a instanceof InterleavedBufferAttribute?a.data:a;
const pin=(a:A):Pin=>({attribute:a,info:staticStorageInfo(storage(a)),version:storage(a).version,count:a.count,size:a.itemSize,normalized:a.normalized,offset:a instanceof InterleavedBufferAttribute?a.offset:0,stride:a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize});
const matches=(a:A|null|undefined,p:Pin)=>{if(!a||a!==p.attribute||storage(a).version!==p.version||a.count!==p.count||a.itemSize!==p.size||a.normalized!==p.normalized||(a instanceof InterleavedBufferAttribute?a.offset:0)!==p.offset||(a instanceof InterleavedBufferAttribute?a.data.stride:a.itemSize)!==p.stride)return false;const q=staticStorageInfo(storage(a));return q.arrayIdentity===p.info.arrayIdentity&&q.bufferIdentity===p.info.bufferIdentity&&q.byteLength===p.info.byteLength&&q.bufferBytes===p.info.bufferBytes;};
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:readonly number[])=>pose(o).every((v,i)=>Object.is(v,p[i]));
const style=(m:Material)=>[m.opacity,+m.transparent,+m.depthWrite,+m.depthTest,m.side,m.alphaTest,+m.visible,+(m as Material&{vertexColors:boolean}).vertexColors];
type Member={range:number[];styles:number[][];mesh:Mesh;geometry:BufferGeometry;attributes:Map<string,Pin>;index:Pin;matrix?:Pin;color?:Pin;count?:number;day:Material;night:Material;grade:Material;pose:number[]};
type Receipt={native:boolean;keys:readonly MemorialSiteKeyV322[];sourceRows:Options['sourceRows'];members:Member[];pose:number[];invalid:boolean;solids:Solid[];bounds:{min:P;max:P};siteBounds:{min:P;max:P}[]};
const receipts=new WeakMap<Group,Receipt>();

/** Photo-based fitting curves, not surveyed sculpture meshes. Units are metres.
 * Four separate ends and the central walking air remain open. */
const BERLIN_PATHS:P[][]=[
 [[-4,0,-1.7],[-3.8,1.6,-1.65],[-3.3,3,-1.5],[-2.35,4.2,-1.2],[-2.45,6.2,-.9],[-2.35,7.35,-.85],[-1.65,7.40,-.85]],
 [[4,0,1.7],[3.8,1.6,1.65],[3.3,3,1.5],[2.35,4.2,1.2],[2.45,6.2,.9],[2.35,7.35,.85],[1.65,7.40,.85]],
 [[-4,0,1.7],[-3.6,1.8,1.5],[-2.5,3.5,1.2],[-.7,5.2,.8],[.7,5.6,.8],[.55,6.3,.8],[-.55,7.30,.8],[.15,7.40,.85]],
 [[4,0,-1.7],[3.6,1.8,-1.5],[2.5,3.5,-1.2],[.7,5.2,-.8],[-.7,5.6,-.8],[-.55,6.3,-.8],[.55,7.30,-.8],[-.15,7.40,-.85]],
];
const STEEL=0x9b9f9c,BRONZE=0x435b52,PATINA=0x64796a,DARK=0x2f453e;
function solidBounds(solids:Solid[]):{min:P;max:P}{const bounds={min:[Infinity,Infinity,Infinity]as P,max:[-Infinity,-Infinity,-Infinity]as P};for(const s of solids){const c=Math.cos(s.yaw??0),t=Math.sin(s.yaw??0),e=s.ellipsoid,extent:P=s.box?s.box.map(v=>v/2)as P:e?[Math.hypot(e[0]*c,e[2]*t)/2,e[1]/2,Math.hypot(e[0]*t,e[2]*c)/2]:[s.r,s.r,s.r];for(const p of[s.a,s.b])for(let i=0;i<3;i++){bounds.min[i]=Math.min(bounds.min[i],p[i]-extent[i]);bounds.max[i]=Math.max(bounds.max[i],p[i]+extent[i]);}}return bounds;}
class Model {
 parts:BufferGeometry[]=[];boxes:Box[]=[];solids:Solid[]=[];private occupied=new Set<string>();
 constructor(readonly native:boolean,readonly origin:P,readonly yaw=0){}
 world(p:P):P{const c=Math.cos(this.yaw),s=Math.sin(this.yaw);return[this.origin[0]+c*p[0]+s*p[2],this.origin[1]+p[1],this.origin[2]-s*p[0]+c*p[2]];}
 paint(g:BufferGeometry,color:number){g.deleteAttribute("uv");if(!g.index)g.setIndex(Array.from({length:g.getAttribute("position").count},(_,i)=>i));const tint=new Color(color),p=g.getAttribute("position"),n=g.getAttribute("normal"),c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const shade=.86+.10*Math.max(0,n.getY(i))+.04*Math.abs(n.getX(i));c.set([tint.r*shade,tint.g*shade,tint.b*shade],i*3);}g.setAttribute("color",new BufferAttribute(c,3));this.parts.push(g);}
 voxel(p:P,s:P,color:number){if(s.some(n=>!(n>0)))return;const q=this.world(p),key=[...q,...s,color].join(",");if(this.occupied.has(key))return;this.occupied.add(key);this.boxes.push({p:q,s,color});this.solids.push({a:q,b:q,r:0,box:s});}
 ellipsoid(p:P,s:P,color:number){
  const world=this.world(p);if(!this.native)this.solids.push({a:world,b:world,r:Math.max(...s)/2,ellipsoid:s,yaw:this.yaw});
  if(this.native){const step=.17;for(let y=-s[1]/2;y<s[1]/2;y+=step){const thickness=Math.min(step,s[1]/2-y),cy=y+thickness/2,f=Math.sqrt(Math.max(0,1-(2*cy/s[1])**2));this.voxel([p[0],p[1]+cy,p[2]],[Math.max(.08,s[0]*f),thickness,Math.max(.08,s[2]*f)],color);}return;}
  const g=new SphereGeometry(.5,12,8);g.scale(...s);g.rotateY(this.yaw);g.translate(...world);this.paint(g,color);
 }
 box(p:P,size:P,color:number){const q=this.world(p);if(this.native){const c=Math.abs(Math.cos(this.yaw)),t=Math.abs(Math.sin(this.yaw));this.voxel(p,[c*size[0]+t*size[2],size[1],t*size[0]+c*size[2]],color);return;}const g=new BoxGeometry(...size);g.rotateY(this.yaw);g.translate(...q);this.paint(g,color);this.solids.push({a:q,b:q,r:0,box:size});}
 prism(points:[number,number][],depth:number,z:number,color:number){
  if(this.native){const ys=points.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys);for(let y=lo;y<hi;y+=.2){const mid=Math.min(hi,y+.1),xs:number[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]>mid)!==(b[1]>mid))xs.push(a[0]+(b[0]-a[0])*(mid-a[1])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=1;i<xs.length;i+=2)this.box([(xs[i-1]+xs[i])/2,(y+Math.min(hi,y+.2))/2,z],[xs[i]-xs[i-1],Math.min(.2,hi-y),depth],color);}return;}
  const positions:number[]=[],tri=(a:P,b:P,c:P)=>positions.push(...this.world(a),...this.world(b),...this.world(c));for(let i=1;i<points.length-1;i++){tri([points[0][0],points[0][1],z-depth/2],[points[i+1][0],points[i+1][1],z-depth/2],[points[i][0],points[i][1],z-depth/2]);tri([points[0][0],points[0][1],z+depth/2],[points[i][0],points[i][1],z+depth/2],[points[i+1][0],points[i+1][1],z+depth/2]);}for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];tri([a[0],a[1],z-depth/2],[b[0],b[1],z-depth/2],[b[0],b[1],z+depth/2]);tri([a[0],a[1],z-depth/2],[b[0],b[1],z+depth/2],[a[0],a[1],z+depth/2]);}const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.computeVertexNormals();this.paint(g,color);
  // Finite narrow collision bands follow the visible slab profile.
  const ys=points.map(p=>p[1]);for(let y=Math.min(...ys);y<Math.max(...ys);y+=.2){const mid=y+.1,xs:number[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]>mid)!==(b[1]>mid))xs.push(a[0]+(b[0]-a[0])*(mid-a[1])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=1;i<xs.length;i+=2){const center=this.world([(xs[i]+xs[i-1])/2,mid,z]);this.solids.push({a:center,b:center,r:0,box:[xs[i]-xs[i-1],.2,depth]});}}
 }
 cylinder(a:P,b:P,r:number,color:number){
  const wa=this.world(a),wb=this.world(b);if(!this.native)this.solids.push({a:wa,b:wb,r});
  if(this.native){const d=new Vector3(...b).sub(new Vector3(...a)),n=Math.max(1,Math.ceil(d.length()/Math.min(.15,r*1.5)));for(let i=0;i<=n;i++)this.voxel([a[0]+d.x*i/n,a[1]+d.y*i/n,a[2]+d.z*i/n],[r*2,r*2,r*2],color);return;}
  const d=new Vector3(...wb).sub(new Vector3(...wa)),g=new CylinderGeometry(r,r,d.length(),color===0xadb0aa?48:10);
  const up=new Vector3(0,1,0),axis=up.clone().cross(d.clone().normalize()),dot=up.dot(d.clone().normalize());
  if(axis.lengthSq()>1e-12)g.applyMatrix4(new Matrix4().makeRotationAxis(axis.normalize(),Math.acos(Math.max(-1,Math.min(1,dot)))));else if(dot<0)g.rotateX(Math.PI);
  g.translate((wa[0]+wb[0])/2,(wa[1]+wb[1])/2,(wa[2]+wb[2])/2);this.paint(g,color);
 }
 ring(center:P,radius:number,tube:number,color:number){for(let i=0;i<40;i++){const a=i/40*Math.PI*2,b=(i+1)/40*Math.PI*2;this.cylinder([center[0]+Math.cos(a)*radius,center[1]+Math.sin(a)*radius,center[2]],[center[0]+Math.cos(b)*radius,center[1]+Math.sin(b)*radius,center[2]],tube,color);}}
}

function* berlin(model:Model):Generator<void>{
 const radius=.55;
 for(const controls of BERLIN_PATHS){
  const curve=new CatmullRomCurve3(controls.map(p=>new Vector3(...p)),false,"centripetal");
  if(model.native){const step=.125,points=curve.getPoints(256),set=new Map<string,{p:P;color:number}>();
   // An independently cardinal surface shell, no rotated native tube or hidden fill.
   for(let i=0;i<points.length;i++){const p=points[i],t=curve.getTangent(i/(points.length-1)),normal=new Vector3(0,1,0).cross(t).normalize();if(normal.lengthSq()<.1)normal.set(1,0,0);const binormal=t.clone().cross(normal).normalize();
    for(let j=0;j<32;j++){const angle=j/32*Math.PI*2,q=p.clone().addScaledVector(normal,Math.cos(angle)*radius).addScaledVector(binormal,Math.sin(angle)*radius),world=model.world([q.x,q.y,q.z]),ix=Math.round(world[0]/step),iy=Math.floor(q.y/step),iz=Math.round(world[2]/step);if(iy<0||iy>=64)continue;const key=ix+":"+iy+":"+iz;set.set(key,{p:[ix*step,model.origin[1]+(iy+.5)*step,iz*step],color:j%4?STEEL:0xb3b5ae});}
    if(i%32===31)yield;
   }
   for(const end of [0,1]){const p=curve.getPoint(end),t=curve.getTangent(end),normal=new Vector3(0,1,0).cross(t).normalize();if(normal.lengthSq()<.1)normal.set(1,0,0);const binormal=t.clone().cross(normal).normalize();for(let a=-radius;a<=radius;a+=step*.8)for(let b=-radius;b<=radius;b+=step*.8){if(a*a+b*b>radius*radius)continue;const q=p.clone().addScaledVector(normal,a).addScaledVector(binormal,b),w=model.world([q.x,q.y,q.z]),ix=Math.round(w[0]/step),iy=Math.floor(q.y/step),iz=Math.round(w[2]/step);if(iy<0||iy>=64)continue;set.set(ix+":"+iy+":"+iz,{p:[ix*step,model.origin[1]+(iy+.5)*step,iz*step],color:0xadb0aa});}}
   for(const row of set.values()){model.boxes.push({p:row.p,s:[step,step,step],color:row.color});model.solids.push({a:row.p,b:row.p,r:step/2,box:[step,step,step]});}
  }else{
   const g=new TubeGeometry(curve,80,radius,48,false);g.rotateY(model.yaw);g.translate(...model.origin);model.paint(g,STEEL);
   // Flat circular end caps are part of the photographed closed steel sections.
   for(const end of[0,1]){const p=curve.getPoint(end),t=curve.getTangent(end),a=p.clone().addScaledVector(t,-.006),b=p.clone().addScaledVector(t,.006);model.cylinder([a.x,a.y,a.z],[b.x,b.y,b.z],radius,0xadb0aa);}
  }
  const points=curve.getPoints(64);if(!model.native)for(let i=1;i<points.length;i++)model.solids.push({a:model.world(points[i-1].toArray()as P),b:model.world(points[i].toArray()as P),r:radius});yield;
 }
}
function* mother(model:Model):Generator<void>{
 // The prior granite plinth remains. The draped figure, recumbent son and
 // large wreath are separate recognisable elements in the Senate photograph.
 model.ellipsoid([.2,1.5,-.3],[1.35,2.6,.8],BRONZE);
 model.ellipsoid([.2,2.9,-.3],[.95,1.15,.65],BRONZE);
 model.ellipsoid([.18,3.78,-.2],[.58,.7,.53],PATINA);
 model.ellipsoid([.14,3.7,.08],[.35,.38,.24],BRONZE);
 model.ellipsoid([.17,4.02,-.22],[.64,.3,.54],DARK);
 for(let fold=0;fold<7;fold++)model.cylinder([-.35+fold*.18,.15,-.13],[.08+(fold-3)*.08,2.92,-.11],.045,fold%2?DARK:PATINA);
 model.cylinder([-.27,2.9,-.27],[-.9,1.85,.05],.19,BRONZE);
 model.cylinder([-.9,1.85,.05],[-1.15,1.5,.23],.16,BRONZE);
 model.cylinder([.65,2.9,-.3],[.85,1.9,.03],.18,BRONZE);
 model.cylinder([.85,1.9,.03],[1.24,1.4,.35],.15,BRONZE);
 model.ellipsoid([-1.42,.8,.73],[.67,.6,.64],PATINA);
 model.ellipsoid([-1.55,.85,1.02],[.38,.28,.22],BRONZE);
 model.ellipsoid([-.45,.61,.72],[1.45,.75,.85],PATINA);
 model.ellipsoid([.8,.4,.72],[1.6,.55,.75],BRONZE);
 model.ring([-1.42,1.28,-.18],1.05,.16,DARK);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;model.ellipsoid([-1.42+Math.cos(a)*1.08,1.28+Math.sin(a)*1.08,-.1],[.28,.38,.18],i%3?BRONZE:PATINA);if(i%8===7)yield;}
 // Broad flag cloth falls over the reclining body and over the plinth front.
 const n=24,m=12,positions:number[]=[],indices:number[]=[];
 const at=(i:number,j:number):P=>{const u=i/n,v=j/m,x=-1.17+u*3.0,z=.18+v*1.17,y=.58+.35*Math.sin(u*Math.PI)-.6*v*v+.09*Math.sin(u*9*Math.PI)*(v*.7+.3);return[x,y,z];};
 for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){const p=at(i,j);if(model.native)model.voxel(p,[.15,.13,.15],i%3?BRONZE:PATINA);else positions.push(...model.world(p));}
 if(!model.native){for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();model.paint(g,BRONZE);}
 yield;
}

function* treptow(model:Model,row:Record<string,unknown>):Generator<void>{
 // Preserve all sixteen measured stones/rims and their inscriptions. These
 // shallow geometric silhouettes improve the old identical bead-like figures;
 // they are reference interpretations, not facsimiles of narrative reliefs.
 const stones=row.cenotaphs as {id:string;rings:number[][][]}[];
 for(let ordinal=0;ordinal<stones.length;ordinal++){
  const ring=stones[ordinal].rings[0],cx=ring.slice(0,-1).reduce((n,p)=>n+p[0],0)/(ring.length-1),cz=ring.slice(0,-1).reduce((n,p)=>n+p[1],0)/(ring.length-1);
  for(let edge=1;edge<ring.length;edge++){
   const a=ring[edge-1],b=ring[edge],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<=3)continue;
   const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;let nx=dz/length,nz=-dx/length;if(nx*(mx-cx)+nz*(mz-cz)<0){nx=-nx;nz=-nz;}
   const face=new Model(model.native,[mx+nx*.075,3,mz+nz*.075],Math.atan2(nx,nz));
   for(let person=0;person<5;person++){
    const x=(person+.5)/5*length-length/2,gesture=(ordinal+person)%4,head=gesture===2?1.42:1.87;
    face.ellipsoid([x,head-.48,.02],[.38,.77,.13],0xb2aa96);face.ellipsoid([x,head,.035],[.23,.28,.15],0xc1b8a4);
    face.ellipsoid([x,head+.08,.025],[.28,.12,.16],0xaca28f);
    for(const side of[-1,1]){const elbow=x+side*(gesture===1?.33:.24),handY=gesture===3&&side>0?head+.13:head-.76;
     face.cylinder([x+side*.16,head-.24,.045],[elbow,head-.55,.055],.065,0xb8af9b);face.cylinder([elbow,head-.55,.055],[x+side*.18,handY,.07],.055,0xb8af9b);
     face.cylinder([x+side*.10,head-.83,.035],[x+side*.16,.33,.035],.075,0xb2aa96);face.ellipsoid([x+side*.17,.25,.055],[.25,.16,.17],0xaaa08d);
    }
   }
   model.parts.push(...face.parts);model.boxes.push(...face.boxes);model.solids.push(...face.solids);yield;
  }
 }
}

function* pyramide(model:Model):Generator<void>{
 const curve=new CatmullRomCurve3([new Vector3(0,0,0),new Vector3(-.8,6,0),new Vector3(-2.3,11.4,0),new Vector3(-4.4,16.3,0)],false,"centripetal"),scale=17/curve.getLength();
 const point=(t:number,dx=0,dz=0):P=>{const p=curve.getPoint(t).multiplyScalar(scale);return[p.x+dx,p.y,p.z+dz];};
 // Three lightly curved bundled steel tubes, with two independent guy wires.
 for(const[dx,dz]of[[0,0],[.19,.11],[.19,-.11]]){for(let i=0;i<80;i++)model.cylinder(point(i/80,dx,dz),point((i+1)/80,dx,dz),.105,0x777e7b);yield;}
 const top=point(.96);for(const sign of[-1,1]){model.cylinder(top,[10,0,sign*12],.012,0x949a96);model.box([10,-.03,sign*12],[.8,.20,.8],0xaaa69a);yield;}
}
function* cadillacs(model:Model):Generator<void>{
 // Actual complete ensemble is catalogued8×6×6m. Slabs and exposed car
 // surfaces are photo-estimated; no invented plaque or adjacent Beton-Trabi.
 model.prism([[-3,0],[-2.8,3.6],[-1.9,6.4],[-.45,8],[-.18,7.25],[-1.05,0]],.62,-1.0,0x9f9e94);
 model.prism([[-.75,0],[-.75,6.4],[.0,6.4],[.05,5.0],[2.95,5],[2.95,0]],3.8,.45,0xa8a79c);
 model.prism([[-.1,0],[.2,1.1],[.5,3.7],[1.8,3.7],[2.7,0]],.8,2.35,0xb1afa4);
 const car=0x2c434c;model.box([-.55,3.35,-1.43],[.7,5.8,.63],car);model.box([-.56,3.6,-1.78],[.62,1.9,.12],0x566f73);
 for(const y of[1.1,5.6]){model.cylinder([-.56,y,-1.85],[-.56,y,-1.98],.36,0x282d2c);model.cylinder([-.56,y,-1.99],[-.56,y,-2.02],.22,0xb9b9ac);}
 model.box([1.75,2.0,2.78],[1.9,1.2,.24],car);model.box([1.73,2.8,2.62],[1.55,.6,.18],0x536a6c);model.box([1.75,1.6,2.94],[2.0,.16,.10],0xb4b4a8);
 for(const x of[1.02,2.48])model.box([x,2.12,2.94],[.35,.24,.09],0xd7d3bc);for(let j=0;j<8;j++)model.box([1.33+j*.12,1.99,2.95],[.045,.35,.06],0x9c9f98);
 // A finite perimeter of pale marble fragments, never an invented inscription.
 for(let side=0;side<4;side++)for(let i=0;i<18;i++){const u=-2.85+i*.335,p:P=side<2?[u,.14,side?3:-3]:[side===2?-3:3,.14,u];model.box(p,[.13,.18+(i%3)*.07,.13],i%3?0xc6c6b9:0xdfded1);}yield;
}

function inscription(model:Model,label:string,center:P,size:number,horizontal=false):void{
 const layout=letteringLayout(label,size),paths=letteringStrokePaths(label,size);for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],at=(p:number[]):P=>horizontal?[center[0]+p[0]-layout.totalWidthM/2,center[1],center[2]+p[1]]:[center[0]+p[0]-layout.totalWidthM/2,center[1]+p[1],center[2]];model.cylinder(at(a),at(b),.006,0x625c4b);}
}
function* french(model:Model):Generator<void>{
 // Public Max Bill recognition layout: distinct granite portals and low
 // connecting/reclining stones, with the central walking spaces kept open.
 const dark=0x41473f,light=0xbfc2b8,red=0x78604f,brown=0xa29273,thickness=.40,h=3.15,w=2.55;
 for(const [cx,cz,turn]of[[-2,0,Math.PI/2],[0,-2,0],[2,0,Math.PI/2]] as const){const c=Math.cos(turn),s=Math.sin(turn),at=(u:number,y:number):P=>[cx+c*u,y,cz-s*u];
  model.box(at(-w/2,h/2+.25),[thickness,h,thickness],turn?light:dark);model.box(at(w/2,h/2+.25),[thickness,h,thickness],turn?dark:light);
  model.box(at(0,h+.25),[turn?thickness:w+thickness,thickness,turn?w+thickness:thickness],dark);model.box(at(0,.20),[turn?thickness:w+thickness,thickness,turn?w+thickness:thickness],red);yield;}
 model.box([-.65,1.65,2.0],[thickness,2.9,thickness],brown);model.box([.65,.2,2],[3.0,.4,thickness],red);
 model.box([0,.18,.15],[2.4,.36,.6],red);for(const x of[-.60,.60])model.box([x,.37,.15],[1.10,.025,.46],0x655d47);
 inscription(model,'BERLIN DANKT FRANKREICH',[-.6,.39,.02],.055,true);inscription(model,'BERLIN REMERCIE LA FRANCE',[.6,.39,.02],.052,true);yield;
}
function* british(model:Model,row:Record<string,unknown>):Generator<void>{
 const spec=row as unknown as {cross:{point:number[]};stone:{rings:number[][][]};displayGroundM:number},cross=new Model(model.native,[spec.cross.point[0],spec.displayGroundM,spec.cross.point[1]],Math.PI/2),stone=0xd6d2c2;
 cross.box([0,.22,0],[2.6,.44,2.6],stone);cross.box([0,.57,0],[1.95,.28,1.95],stone);cross.box([0,.91,0],[1.25,.40,1.25],0xccc8b8);
 cross.prism([[-.26,1.1],[-.19,7.8],[.19,7.8],[.26,1.1]],.40,0,stone);cross.box([0,6.30,0],[2.15,.43,.44],stone);
 cross.box([0,4.60,.225],[.075,3.25,.025],0x505c50);cross.box([0,6.14,.23],[.68,.065,.025],0x505c50);cross.box([0,6.57,.23],[.065,.80,.025],0x505c50);cross.prism([[-.037,2.98],[0,2.78],[.037,2.98]],.025,.23,0x505c50);
 model.parts.push(...cross.parts);model.boxes.push(...cross.boxes);model.solids.push(...cross.solids);yield;
 const ring=spec.stone.rings[0],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2,w=Math.max(...zs)-Math.min(...zs),d=Math.max(...xs)-Math.min(...xs),marker=new Model(model.native,[cx,spec.displayGroundM,cz],Math.PI/2);
 for(let i=0;i<4;i++)marker.box([0,.075+i*.15,0],[w-i*.75,.15,d-i*.48],stone);
 marker.box([0,.76,0],[w*.55,.32,d*.56],0xcecabb);marker.box([0,1.37,0],[w*.53,.90,d*.48],stone);marker.box([0,1.88,0],[w*.55,.12,d*.50],0xe1dece);
 inscription(marker,'THEIR NAME LIVETH',[0,1.49,d*.245+.015],.20);inscription(marker,'FOR EVERMORE',[0,1.18,d*.245+.015],.20);
 model.parts.push(...marker.parts);model.boxes.push(...marker.boxes);model.solids.push(...marker.solids);yield;
}

/** Complete selected sites only. Unknown/unprepared inputs keep all old models. */
export function* createMemorialAccuracyV322Steps(native=false,options:Options,onCreate?:(root:Group)=>void):Generator<void,Group|null>{
 if(!options||!hasMemorialAccuracySourceRowsV322(options.sourceRows,native,options.keys))return null;
 const root=new Group();root.name="Source-bound memorial accuracy v322: "+options.keys.join(",");
 const resources=new Set<{dispose():void}>(),members:Member[]=[],solids:Solid[]=[],pendingModels:Model[]=[],siteBounds:{min:P;max:P}[]=[];let delivered=false;
 try{
  onCreate?.(root);
  for(const key of options.keys){const row=options.sourceRows.find(r=>r.id===({berlin:"node/313826576",schoenholz:"node/2274670443",treptow:"way/442879072",pyramide:"node/4224142271",cadillacs:"node/1270806845",french:"node/9671927947",british:"way/5077552"}[key]))!;
   const origin:P=key==="berlin"?[-2264.7,5.2,1674.9]:key==="pyramide"?[-3578.9,((row.ground as {valueDm:number}).valueDm)/10,1841.4]:key==="cadillacs"?[(row.point as number[])[0],((row.ground as {valueDm:number}).valueDm)/10,(row.point as number[])[1]]:key==="french"?[(row.point as number[])[0],row.displayGroundM as number,(row.point as number[])[1]]:key==="schoenholz"?[258.46,((row.sourceRows as number[][])[0][1])-2.6+.8,-6943.286]:[0,0,0];
   // Bearings are source-axis fits; the unmeasured sculpture curves are labelled estimates.
   const model=new Model(native,origin,key==="berlin"?.968091:key==="pyramide"?1.7:key==="cadillacs"||key==="french"||key==="british"?0:.7804);pendingModels.push(model);if(key==="berlin")yield*berlin(model);else if(key==="schoenholz")yield*mother(model);else if(key==="treptow")yield*treptow(model,row);else if(key==="pyramide")yield*pyramide(model);else if(key==="cadillacs")yield*cadillacs(model);else if(key==="french")yield*french(model);else yield*british(model,row);solids.push(...model.solids);siteBounds.push(solidBounds(model.solids));
   let mesh:Mesh;
   const day=new MeshBasicMaterial({vertexColors:!native}),night=new MeshStandardMaterial({vertexColors:!native,roughness:key==="berlin"?.36:.76,metalness:key==="berlin"?.68:.27});resources.add(day);resources.add(night);
   if(native){const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");resources.add(geometry);const instanced=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),tint=new Color(),ms=new Float32Array(model.boxes.length*16),cs=new Float32Array(model.boxes.length*3);
    for(let i=0;i<model.boxes.length;i++){const b=model.boxes[i];matrix.makeScale(...b.s).setPosition(...b.p).toArray(ms,i*16);tint.setHex(b.color).toArray(cs,i*3);if(i%128===127)yield;}
    instanced.instanceMatrix=new InstancedBufferAttribute(ms,16);instanced.instanceColor=new InstancedBufferAttribute(cs,3);instanced.count=model.boxes.length;instanced.computeBoundingBox();instanced.computeBoundingSphere();mesh=instanced;resources.add(instanced);
   }else{const geometry=mergeGeometries(model.parts,false);for(const part of model.parts)part.dispose();if(!geometry)throw Error("Incomplete memorial model");resources.add(geometry);geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh=new Mesh(geometry,day);}
   mesh.geometry.userData.losslessStaticBacking=true;mesh.name="Memorial v322 "+key+(native?" cardinal":" reference silhouette");mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,displayDimensionsEstimated:true};root.add(mesh);
   const grade=schwellenraumMaterialFor(mesh,day);resources.add(grade);yield;
  }
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,memorialKeys:[...options.keys],interpretation:"Source-bound public-photo interpretation; small forms and curves are estimated, not a sculpture scan"};yield*interleaveStaticGeometrySteps(root);freezeStaticSceneTransforms(root);
  const receipt:Receipt={native,keys:[...options.keys],sourceRows:options.sourceRows,members,pose:pose(root),invalid:false,solids,siteBounds,bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}};
  for(const child of root.children){const mesh=child as Mesh,geometry=mesh.geometry,day=mesh.userData.dayMaterial as Material,night=mesh.userData.nightMaterial as Material,grade=mesh.userData.schwellenraumMaterial as Material;
   members.push({range:[geometry.drawRange.start,geometry.drawRange.count],styles:[day,night,grade].map(style),mesh,geometry,attributes:new Map(Object.entries(geometry.attributes).map(([k,a])=>[k,pin(a)])),index:pin(geometry.index!),day,night,grade,pose:pose(mesh),...(mesh instanceof InstancedMesh?{matrix:pin(mesh.instanceMatrix),color:pin(mesh.instanceColor!),count:mesh.count}:{})});
   geometry.addEventListener("dispose",()=>{if(!isSceneGeometryGpuRetirementV309(geometry))receipt.invalid=true;});for(const material of[day,night,grade])material.addEventListener("dispose",()=>{if(!isSceneMaterialProgramRetirementV321(material))receipt.invalid=true;});if(mesh instanceof InstancedMesh)mesh.addEventListener("dispose",()=>{if(!isSceneInstanceGpuRetirementV309(mesh))receipt.invalid=true;});
  }
  receipt.bounds=solidBounds(solids);
  receipts.set(root,receipt);delivered=true;return root;
 }catch{return null;}finally{if(!delivered){for(const model of pendingModels)for(const p of model.parts)p.dispose();for(const r of resources)r.dispose();root.clear();}}
}
export function createMemorialAccuracyV322(native=false,options:Options):Group|null{const g=createMemorialAccuracyV322Steps(native,options);for(;;){const r=g.next();if(r.done)return r.value;}}
export function hasCompleteMemorialAccuracyV322(root:Group,native:boolean,expectedKeys:readonly MemorialSiteKeyV322[]):boolean{
 const r=receipts.get(root);return !!r&&!r.invalid&&r.native===native&&r.keys.length===expectedKeys.length&&r.keys.every((k,i)=>k===expectedKeys[i])&&hasMemorialAccuracySourceRowsV322(r.sourceRows,native,r.keys)&&root.visible&&samePose(root,r.pose)&&root.children.length===r.members.length&&r.members.length===r.keys.length&&r.members.every((p,i)=>{const m=p.mesh;return root.children[i]===m&&m.parent===root&&m.visible&&samePose(m,p.pose)&&m.geometry===p.geometry&&m.geometry.drawRange.start===p.range[0]&&m.geometry.drawRange.count===p.range[1]&&[p.day,p.night,p.grade].every((mat,i)=>style(mat).every((v,j)=>Object.is(v,p.styles[i][j])))&&Object.keys(m.geometry.attributes).length===p.attributes.size&&[...p.attributes].every(([k,a])=>matches(m.geometry.getAttribute(k),a))&&matches(m.geometry.index,p.index)&&(!(m instanceof InstancedMesh)||m.count===p.count&&matches(m.instanceMatrix,p.matrix!)&&matches(m.instanceColor,p.color!))&&m.userData.dayMaterial===p.day&&m.userData.nightMaterial===p.night&&m.userData.schwellenraumMaterial===p.grade&&(m.material===p.day||m.material===p.night||m.material===p.grade||hasMinecraftMaterialProvenance(m,p.day,m.material)||hasMinecraftMaterialProvenance(m,p.night,m.material)||hasMinecraftMaterialProvenance(m,p.grade,m.material));});
}
/** Constant-time private-receipt broad phase; no source/render arrays read. */
export function memorialAccuracyMayContainV322(root:Group,x:number,y:number,z:number,radius=0):boolean{const r=receipts.get(root);return !!r&&Number.isFinite(radius)&&radius>=0&&[x,y,z].every(Number.isFinite)&&r.siteBounds.some(b=>[x,y,z].every((v,i)=>v>=b.min[i]-radius&&v<=b.max[i]+radius));}
/** Granular tube/figure solids; the central Berlin-sculpture passage stays air. */
export function memorialAccuracySolidAtV322(root:Group,x:number,y:number,z:number,radius=0):boolean{
 const r=receipts.get(root);if(!r||!memorialAccuracyMayContainV322(root,x,y,z,radius)||!hasCompleteMemorialAccuracyV322(root,r.native,r.keys))return false;
 return r.solids.some(s=>{if(s.box)return [x,y,z].every((v,i)=>Math.abs(v-s.a[i])<=s.box![i]/2+radius);if(s.ellipsoid){const dx=x-s.a[0],dz=z-s.a[2],c=Math.cos(s.yaw!),t=Math.sin(s.yaw!);return ((dx*c-dz*t)/(s.ellipsoid[0]/2+radius))**2+((y-s.a[1])/(s.ellipsoid[1]/2+radius))**2+((dx*t+dz*c)/(s.ellipsoid[2]/2+radius))**2<1;}const d=s.b.map((n,i)=>n-s.a[i]),p=[x-s.a[0],y-s.a[1],z-s.a[2]],l=d.reduce((n,v)=>n+v*v,0),t=l?Math.max(0,Math.min(1,p.reduce((n,v,i)=>n+v*d[i],0)/l)):0;return p.reduce((n,v,i)=>n+(v-d[i]*t)**2,0)<(s.r+radius)**2;});
}
