/** Estimated public window rhythms on the exact new upper-wall triangles only.
 * No old body, roof, court, datum, navigation or source record is modified. */
import {Group,Mesh,BufferAttribute,InterleavedBufferAttribute,type Material,MeshStandardMaterial} from 'three';
import {createPackedRootStepsV309,completePackedRootV307,readRequiredPackedWordsV307,type RequiredPackedV307} from './requiredPackedRootV307';
import {decodeBase64Bytes} from './decodeBase64Bytes';
import {staticStorageInfo} from './losslessStaticStorage';
import {isSceneGeometryGpuRetirementV309} from './sceneGeometryGpuResidency';
const OWNER=Symbol('source-contained Senate upper windows v321');
const SOURCES:Record<string,number>={'education-bounded-roof':869665092,'education-cardinal-roof':1508402971,'urban-bounded-roof':358081966,'urban-cardinal-roof':3784429763};
type V2=[number,number];type V3=[number,number,number];type Tri=[V3,V3,V3];
type Plane={n:V2;d:V2;c:number;triangles:V2[][];u0:number;u1:number;lo:number;hi:number};
type Attr=BufferAttribute|InterleavedBufferAttribute;
type Pin={attribute:Attr;version:number;storage:ReturnType<typeof staticStorageInfo>;size:number;count:number};
type Receipt={parent:Mesh;geometry:Mesh['geometry'];attributes:[string,Pin][];index:Pin;pose:number[];root:Group;native:boolean;night:MeshStandardMaterial;disposed:boolean};
const receipts=new WeakMap<Group,Receipt>();
const hash=(v:unknown)=>{let h=2166136261;for(const c of JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const store=(a:Attr)=>a instanceof InterleavedBufferAttribute?a.data:a;
const pin=(a:Attr):Pin=>({attribute:a,version:store(a).version,storage:staticStorageInfo(store(a)),size:a.itemSize,count:a.count});
function matches(a:Attr|null|undefined,p:Pin):boolean{if(!a||a!==p.attribute||store(a).version!==p.version||a.itemSize!==p.size||a.count!==p.count)return false;const s=staticStorageInfo(store(a));return s.arrayIdentity===p.storage.arrayIdentity&&s.bufferIdentity===p.storage.bufferIdentity&&s.byteLength===p.storage.byteLength&&s.bufferBytes===p.storage.bufferBytes;}
const pose=(p:Mesh)=>[...p.matrix.elements,...p.position.toArray(),...p.quaternion.toArray(),...p.scale.toArray(),+p.matrixAutoUpdate,+p.matrixWorldAutoUpdate];
function b64(a:ArrayBufferView):string{const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s);}
function bytesEqual(a:ArrayBufferView,b:ArrayBufferView):boolean{if(a.byteLength!==b.byteLength)return false;const x=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),y=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);return x.every((v,i)=>v===y[i]);}
function sourceTriangles(parent:Mesh,q:RequiredPackedV307):Tri[]{if(SOURCES[q.key]!==hash(q)||q.positionType!=='f32'||q.colorType!=='u16linear'||q.origin.some(v=>v!==0)||parent.name!==q.key||parent.position.lengthSq()!==0||parent.scale.x!==1||parent.scale.y!==1||parent.scale.z!==1||parent.quaternion.x||parent.quaternion.y||parent.quaternion.z||parent.quaternion.w!==1)throw Error('Unknown Senate upper source');
 const p=parent.geometry.getAttribute('position'),c=parent.geometry.getAttribute('color'),ix=parent.geometry.index,words=readRequiredPackedWordsV307(q.positions,q.vertices*3,3,q.positionsCodec),indices=readRequiredPackedWordsV307(q.indices,q.triangles*3,1,q.indicesCodec),color=decodeBase64Bytes(q.colors);
 if(!(p instanceof BufferAttribute)||!(p.array instanceof Float32Array)||!ix||ix.itemSize!==1||!(c instanceof BufferAttribute)||!c.normalized||!(c.array instanceof Uint16Array)||!bytesEqual(p.array,words)||!bytesEqual(ix.array,indices)||!bytesEqual(c.array,color))throw Error('Changed actual Senate upper mesh');
 const result:Tri[]=[];for(let i=0;i<ix.count;i+=3)result.push([0,1,2].map(j=>{const v=ix.getX(i+j);return[p.getX(v),p.getY(v),p.getZ(v)] as V3;})as Tri);return result;
}
function area(p:V2[]):number{let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s)/2;}
function clippedArea(triangle:V2[],u0:number,u1:number,y0:number,y1:number):number{let p=triangle;for(const[axis,value,sign]of[[0,u0,1],[0,u1,-1],[1,y0,1],[1,y1,-1]]){const next:V2[]=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],fa=(a[axis]-value)*sign,fb=(b[axis]-value)*sign;if(fa>=0)next.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}p=next;if(p.length<3)return 0;}return area(p);}
function roofCovers(t:Tri,x:number,y:number,z:number):boolean{const[a,b,c]=t,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-9)return false;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7&&u*a[1]+v*b[1]+(1-u-v)*c[1]>y+.01;}
function planes(triangles:Tri[],native:boolean):{planes:Plane[];roofs:Tri[]}{const groups=new Map<string,Plane>(),roofs:Tri[]=[];
 for(const t of triangles){const[a,b,c]=t,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...cross);if(length<1e-8)continue;
  if(Math.abs(cross[1])/length>0.99999){roofs.push(t);continue;}if(Math.abs(cross[1])/length>1e-6)continue;
  let nx=cross[0]/length,nz=cross[2]/length;if(nx< -1e-7||Math.abs(nx)<1e-7&&nz<0){nx=-nx;nz=-nz;}if(native&&Math.min(Math.abs(nx),Math.abs(nz))>1e-6)throw Error('Noncardinal native Senate source');
  const n:V2=[nx,nz],d:V2=[-nz,nx],constant=nx*a[0]+nz*a[2],key=nx.toFixed(6)+','+nz.toFixed(6)+','+constant.toFixed(3),projected=t.map(p=>[p[0]*d[0]+p[2]*d[1],p[1]]as V2);let g=groups.get(key);
  if(!g){g={n,d,c:constant,triangles:[],u0:Infinity,u1:-Infinity,lo:Infinity,hi:-Infinity};groups.set(key,g);}g.triangles.push(projected);for(const[u,y]of projected){g.u0=Math.min(g.u0,u);g.u1=Math.max(g.u1,u);g.lo=Math.min(g.lo,y);g.hi=Math.max(g.hi,y);}
 }return{planes:[...groups.values()],roofs};}
type Builder={positions:number[];colors:number[];indices:number[]};
const builder=():Builder=>({positions:[],colors:[],indices:[]});
const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
function quad(b:Builder,g:Plane,sign:number,u0:number,u1:number,y0:number,y1:number,depth:number,rgb:number){const base=b.positions.length/3,color=[rgb>>16&255,rgb>>8&255,rgb&255].map(v=>Math.round(linear(v/255)*65535));for(const[u,y]of[[u0,y0],[u1,y0],[u1,y1],[u0,y1]]){b.positions.push(g.d[0]*u+g.n[0]*(g.c+sign*depth),y,g.d[1]*u+g.n[1]*(g.c+sign*depth));b.colors.push(...color);}b.indices.push(base,base+1,base+2,base,base+2,base+3);}
function packed(b:Builder,key:string,native:boolean):RequiredPackedV307{return{key,native,positionType:'f32',colorType:'u16linear',origin:[0,0,0],positions:b64(new Float32Array(b.positions)),colors:b64(new Uint16Array(b.colors)),indices:b64(new Uint32Array(b.indices)),vertices:b.positions.length/3,triangles:b.indices.length/3};}
/** Root's already full-source-admitted factory invokes this before normal
 * parking/presentation. Its original parent geometry is borrowed, never edited. */
export function* createBerlinSenateUpperWindowsV321Steps(parent:Mesh,source:RequiredPackedV307,native:boolean):Generator<void,Group>{
 if(source.native!==native)throw Error('Wrong Senate upper mode');const triangles=sourceTriangles(parent,source),survey=planes(triangles,native),education=source.key.startsWith('education'),glass=builder(),frames=builder();let count=0,visited=0;
 // Public sources: seven main levels with two set back at Bernhard-Weiß6;
 // eighteen levels incl.17th-floor roof terrace at Württembergische6. Bay and
 // joinery dimensions are estimates; the terrace/technical top gets no grid.
 const base=3,top=education?34.745:69.013,floors=education?7:18,pitch=(top-base)/floors,
  ys=Array.from({length:education?7:17},(_,i)=>base+(i+.5)*pitch).map(y=>native?Math.round(y*8)/8:y);
 for(const g of survey.planes){const width=native?1.42:education?1.8:2.0,height=native?2:education?2.25:2.32,frame=native?.125:.10,outerW=width+frame*2,outerH=height+frame*2;
  const bayPitch=education?3.55:2.8,bays=Math.max(1,Math.floor((g.u1-g.u0)/bayPitch)),centers=native?Array.from({length:Math.max(0,Math.ceil((g.u1-g.u0)/2)+1)},(_,i)=>Math.ceil(g.u0/2)*2+1+i*2):Array.from({length:bays},(_,i)=>g.u0+(i+.5)*(g.u1-g.u0)/bays);
  for(const y of ys){if(y-outerH/2<g.lo+.20||y+outerH/2>g.hi-.20)continue;for(const u of centers){if(++visited%128===0)yield;const u0=u-outerW/2,u1=u+outerW/2,y0=y-outerH/2,y1=y+outerH/2;if(u0<g.u0+.18||u1>g.u1-.18)continue;
    const support=g.triangles.reduce((sum,t)=>sum+clippedArea(t,u0,u1,y0,y1),0),required=outerW*outerH;if(Math.abs(support-required)>required*.00005)continue;
    const x=g.d[0]*u+g.n[0]*g.c,z=g.d[1]*u+g.n[1]*g.c,plus=survey.roofs.some(t=>roofCovers(t,x+g.n[0]*.2,y,z+g.n[1]*.2)),minus=survey.roofs.some(t=>roofCovers(t,x-g.n[0]*.2,y,z-g.n[1]*.2));if(plus===minus)continue;const sign=plus?-1:1;
    quad(glass,g,sign,u-width/2,u+width/2,y-height/2,y+height/2,native?.125:.075,education?0x526a73:0x607987);
    const tone=education?0xc6c1ad:0xb9b7a9,depth=native?.25:.12;
    quad(frames,g,sign,u0,u0+frame,y0,y1,depth,tone);quad(frames,g,sign,u1-frame,u1,y0,y1,depth,tone);quad(frames,g,sign,u0+frame,u1-frame,y0,y0+frame,depth,tone);quad(frames,g,sign,u0+frame,u1-frame,y1-frame,y1,depth,tone);
    quad(frames,g,sign,u-.035,u+.035,y-height/2,y+height/2,depth,tone);if(!education)quad(frames,g,sign,u-width/2,u+width/2,y+height*.10,y+height*.10+.055,depth,tone);count++;
  }}
 }
 if(count<20||count>4000)throw Error('Incomplete Senate upper window coverage');
 let partial:Group|null=null,delivered=false;try{const root=yield*createPackedRootStepsV309(OWNER,source.key+' public upper windows v321',native,[packed(frames,'Senate upper source-contained frames',native),packed(glass,'Senate upper source-contained glazing',native)],{estimatedFittingsV321:true,upperWindowCount:count},r=>{partial=r;parent.add(r);});
  const mesh=root.children[1]as Mesh,night=mesh.userData.nightMaterial as MeshStandardMaterial;night.userData.nightEmissive=0xffcb92;night.userData.nightEmissiveIntensity=.48;
  const receipt:Receipt={parent,geometry:parent.geometry,attributes:Object.entries(parent.geometry.attributes).map(([k,a])=>[k,pin(a)]),index:pin(parent.geometry.index!),pose:pose(parent),root,native,night,disposed:false};
  parent.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(receipt.geometry))receipt.disposed=true;});receipts.set(root,receipt);delivered=true;return root;
 }finally{if(!delivered)(partial as Group|null)?.removeFromParent();}
}
export function completeBerlinSenateUpperWindowsV321(root:Group,parent:Mesh,native?:boolean):boolean{const r=receipts.get(root);return !!r&&!r.disposed&&r.parent===parent&&root.parent===parent&&parent.children.length===1&&parent.children[0]===root&&(native===undefined||native===r.native)&&parent.geometry===r.geometry&&pose(parent).every((v,i)=>Object.is(v,r.pose[i]))&&r.attributes.every(([k,a])=>matches(parent.geometry.getAttribute(k),a))&&matches(parent.geometry.index,r.index)&&completePackedRootV307(root,OWNER,native)&&r.night.userData.nightEmissive===0xffcb92&&r.night.userData.nightEmissiveIntensity===.48;}
