import {expect,test}from'bun:test';
import {BufferAttribute,BufferGeometry,Group,InstancedMesh,Mesh,MeshBasicMaterial}from'three';
import {readFileSync}from'node:fs';
import {gunzipSync}from'node:zlib';
import {resolve}from'node:path';
import profile from'../src/data/publicMonumentsV326.json';
import namedProfile from'../src/data/oberschoeneweideMemorialV326.json';
import index from'../src/data/publicMonumentsV326Index.json';
import {createPublicMonumentsV326,createPublicMonumentsV326Steps,createOberschoeneweideMemorialV326,hasCompletePublicMonumentsV326,hasPublicMonumentsRuntimeV326,disposePublicMonumentsV326}from'../src/PublicMonumentsV326';
import {parkStaticInstancesSteps}from'../src/losslessStaticStorage';
import {interleaveStaticGeometry}from'../src/interleaveStaticGeometry';
import {retireSceneMaterialPrograms}from'../src/sceneMaterialPrograms';
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,restoreMinecraftMaterialPresentation,disposeMinecraftMaterialState}from'../src/visual-modes/minecraft/materialMode';
import {createPublicMonumentsPacketV326Steps}from'../src/PublicMonumentsPacketV326';
import {buildSurroundingCityChunk,type SurroundingNavigation}from'../src/SurroundingCityGeometry';
import {disposeSurroundingCityRoot as disposeSurroundingCityRootV323}from'../src/disposeSurroundingCityRootV323';
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const counts=new Map(profile.keys.map(k=>[k,profile.entries.filter(e=>e.key===k).length])),key=Array.from(counts).sort((a,b)=>b[1]-a[1])[0][0];
const selected=profile.entries.filter(e=>e.key===key),make=(native=false,mobileLike=false)=>createPublicMonumentsV326({native,keys:[key],terrainAt:()=>7.25,mobileLike})!;

test('finite source identities and documented standard dimension; no all-Berlin default or old-source duplicates',()=>{
 expect(profile.entries).toHaveLength(6475);expect(profile.keys).toHaveLength(543);expect(new Set(profile.entries.map(e=>e.id)).size).toBe(6475);expect(profile.widthM).toBe(.1);expect(profile.depthM).toBe(.1);expect(index.entries).toEqual(profile.entries.map(e=>({id:e.id,key:e.key,point:e.point})));expect(selected).toHaveLength(238);
 expect(createPublicMonumentsV326({native:false,terrainAt:()=>3})).toBeNull();expect(createPublicMonumentsV326({native:false,keys:['unknown'],terrainAt:()=>3})).toBeNull();expect(createPublicMonumentsV326({native:false,keys:[key,key],terrainAt:()=>3})).toBeNull();expect(createPublicMonumentsV326({native:false,keys:[key],sourceIds:[selected[0].id],terrainAt:()=>3})).toBeNull();expect(createPublicMonumentsV326({native:false,keys:[key],terrainAt:()=>null})).toBeNull();expect(createPublicMonumentsV326({native:false,keys:[key],terrainAt:()=>NaN})).toBeNull();
});

test('full/touch and independent Native keep actual 10cm cardinal tops on supplied surface and correct local packet frame',()=>{
 for(const native of[false,true]){const a=make(native),b=make(native,true);try{expect(hasCompletePublicMonumentsV326(a,native)).toBe(true);expect(hasCompletePublicMonumentsV326(a,!native)).toBe(false);const m=a.children[0]as InstancedMesh;expect(m.count).toBe(238);expect(m.instanceMatrix.array).toEqual((b.children[0]as InstancedMesh).instanceMatrix.array);for(let i=0;i<m.count;i++){const at=i*16;expect(m.instanceMatrix.array[at]).toBeCloseTo(.1,7);expect(m.instanceMatrix.array[at+5]).toBeCloseTo(.003,8);expect(m.instanceMatrix.array[at+10]).toBeCloseTo(.1,7);expect(m.instanceMatrix.array[at+13]).toBeCloseTo(7.2515,5);for(const k of[1,2,3,4,6,7,8,9,11])if(m.instanceMatrix.array[at+k]!==0)throw Error('Rotated pavement stone');}}finally{disposePublicMonumentsV326(a);disposePublicMonumentsV326(b);}}
 const q=selected[0],r=createPublicMonumentsV326({native:false,sourceIds:[q.id],terrainAt:()=>7.25,origin:[q.point[0]-2,5,q.point[1]-4]})!;try{const a=(r.children[0]as InstancedMesh).instanceMatrix.array;expect(a[12]).toBe(2);expect(a[13]).toBeCloseTo(2.2515,5);expect(a[14]).toBe(4);}finally{disposePublicMonumentsV326(r);}
});

test('actual detached/hidden world gate, mode clones, interleave and postupload parking remain exact',async()=>{
 const r=make(true),m=r.children[0]as InstancedMesh,world=new Group(),hidden=new Group();try{expect(hasPublicMonumentsRuntimeV326(world,r,true)).toBe(false);hidden.visible=false;hidden.add(r);world.add(hidden);expect(hasPublicMonumentsRuntimeV326(world,r,true)).toBe(true);interleaveStaticGeometry(r);
  for(const mode of['nightMaterial','schwellenraumMaterial','dayMaterial']){m.material=m.userData[mode];expect(hasCompletePublicMonumentsV326(r,true)).toBe(true);}const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(r,state,true);expect(hasCompletePublicMonumentsV326(r,true)).toBe(true);restoreMinecraftMaterialPresentation(state);disposeMinecraftMaterialState(state);expect(retireSceneMaterialPrograms(r)).toBe(3);expect(hasCompletePublicMonumentsV326(r,true)).toBe(true);expect(drain(parkStaticInstancesSteps(r))).toBe(0);m.instanceMatrix.onUploadCallback();await new Promise(r=>setTimeout(r,1));expect(hasCompletePublicMonumentsV326(r,true)).toBe(true);
 }finally{disposePublicMonumentsV326(r);}expect(hasCompletePublicMonumentsV326(r,true)).toBe(false);
});

test('changed source/word/membership/material/disposal and cooperative cancellation all close privately',()=>{
 const r=make(),m=r.children[0]as InstancedMesh;try{
 const v=m.instanceMatrix.array[0];m.instanceMatrix.array[0]+=.001;expect(hasCompletePublicMonumentsV326(r)).toBe(false);m.instanceMatrix.array[0]=v;const x=selected[0].point[0];selected[0].point[0]+=.001;expect(hasCompletePublicMonumentsV326(r)).toBe(false);expect(make()).toBeNull();selected[0].point[0]=x;expect(hasCompletePublicMonumentsV326(r)).toBe(true);const mat=m.material,other=new MeshBasicMaterial();m.material=other;expect(hasCompletePublicMonumentsV326(r)).toBe(false);m.material=mat;other.dispose();m.position.x=.001;expect(hasCompletePublicMonumentsV326(r)).toBe(false);m.position.x=0;m.geometry.dispose();expect(hasCompletePublicMonumentsV326(r)).toBe(false);
 }finally{disposePublicMonumentsV326(r);}
 for(const at of[1,4,8]){const world=new Group(),old=new Group();world.add(old);let root:Group|undefined;const g=createPublicMonumentsV326Steps({native:false,keys:[key],terrainAt:()=>7.25},r=>{root=r;world.add(r);});let q=g.next();for(let i=1;i<at&&!q.done;i++)q=g.next();expect(hasCompletePublicMonumentsV326(root!)).toBe(false);g.return(null);expect(world.children).toEqual([old]);expect(root!.children).toHaveLength(0);}
});

test('packet adapter individually skips full-area building/water/ground holes, preserves supported neighbours and cleans retries/cancel',()=>{
 const a=selected[0],b=selected.find(q=>Math.hypot(q.point[0]-a.point[0],q.point[1]-a.point[1])>3)!,origin:[number,number,number]=[Math.floor(a.point[0]/512)*512,0,Math.floor(a.point[1]/512)*512];
 const fixture=()=>{const root=new Group();root.position.fromArray(origin);const v:number[]=[];for(const q of[a,b]){const x=q.point[0]-origin[0],z=q.point[1]-origin[2],a=[x-.08,5,z-.08],b=[x+.08,5,z-.08],c=[x+.08,5,z+.08],d=[x-.08,5,z+.08];v.push(...a,...b,...c,...a,...c,...d);}const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(v),3));root.add(new Mesh(g,new MeshBasicMaterial()));const nav:SurroundingNavigation={ground:[{ring:[[0,0],[512,0],[512,512],[0,512]],holes:[]}],water:[],buildings:[],groundY:5};return{root,nav};};
 for(const type of['water','building','hole','gpu-opening']){const{root,nav}=fixture(),x=a.point[0]-origin[0],z=a.point[1]-origin[2],cut={ring:[[x+.03,z-.04],[x+.07,z-.04],[x+.07,z+.04],[x+.03,z+.04]],holes:[]};if(type==='water')nav.water.push(cut);else if(type==='building')nav.buildings.push({...cut,height:4,minHeight:0,sourceId:'actual-test-building'});else if(type==='hole')nav.ground[0].holes.push(cut.ring);
  // A tiny GPU-only aperture hits none of centre/corner sample points.
  const opening={native:false,ring:[[a.point[0]+.02,a.point[1]+.02],[a.point[0]+.03,a.point[1]+.02],[a.point[0]+.03,a.point[1]+.03],[a.point[0]+.02,a.point[1]+.03]]},options=type==='gpu-opening'?{hosts:[root.children[0]as Mesh],openings:[opening]as any}:{};
  const before=JSON.stringify(nav),packet=drain(createPublicMonumentsPacketV326Steps(root,'actual-primary-test',false,nav,origin,options));try{expect(packet.root).not.toBeNull();expect(packet.supportedSourceIds).toContain(b.id);expect(packet.supportedSourceIds).not.toContain(a.id);expect(packet.unsupportedSourceIds).toContain(a.id);expect(packet.geometryBytes).toBeLessThan(30000);expect(packet.complete()).toBe(true);expect(drain(createPublicMonumentsPacketV326Steps(root,'actual-primary-test',false,nav,origin,options))).toBe(packet);expect(JSON.stringify(nav)).toBe(before);
   nav.water.push({ring:[[0,0],[512,0],[512,512],[0,512]],holes:[]});expect(packet.complete()).toBe(false);const retry=drain(createPublicMonumentsPacketV326Steps(root,'actual-primary-test',false,nav,origin));expect(retry.root).toBeNull();expect(packet.root!.parent).toBeNull();
  }finally{packet.dispose();disposeSurroundingCityRootV323(root);}
 }
 const{root,nav}=fixture();const steps=createPublicMonumentsPacketV326Steps(root,'actual-primary-test',false,nav,origin);let n=steps.next();for(let i=0;i<10&&!n.done;i++)n=steps.next();if(!n.done)steps.return({root:null,geometryBytes:0,bufferCount:0,supportedSourceIds:[],unsupportedSourceIds:[],complete:()=>false,dispose(){}});else n.value.dispose();expect(root.children).toHaveLength(1);disposeSurroundingCityRootV323(root);
});

test('only original supplied ground hosts support stones; later stair/sign top meshes cannot become ground',()=>{
 const q=selected[0],origin:[number,number,number]=[Math.floor(q.point[0]/512)*512,0,Math.floor(q.point[1]/512)*512],root=new Group();root.position.fromArray(origin);const x=q.point[0]-origin[0],z=q.point[1]-origin[2],tri=[x-.08,5,z-.08,x+.08,5,z-.08,x+.08,5,z+.08,x-.08,5,z-.08,x+.08,5,z+.08,x-.08,5,z+.08],g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(tri),3));const laterStair=new Mesh(g,new MeshBasicMaterial()),missingGround=new Mesh(new BufferGeometry(),new MeshBasicMaterial());root.add(missingGround,laterStair);const nav:SurroundingNavigation={ground:[{ring:[[0,0],[512,0],[512,512],[0,512]],holes:[]}],buildings:[],water:[],groundY:5};try{const packet=drain(createPublicMonumentsPacketV326Steps(root,'actual-primary-host-test',false,nav,origin,{hosts:[missingGround]}));expect(packet.root).toBeNull();expect(packet.unsupportedSourceIds).toContain(q.id);}finally{disposeSurroundingCityRootV323(root);}
});

test('real complete delivered primary -6_5, both families: source-bound plates use actual triangulated ground without changing old bytes or Nav',()=>{
 const directory=resolve(import.meta.dir,'../public/mesh/surrounding-berlin-v159'),manifest=JSON.parse(readFileSync(resolve(directory,'manifest.json'),'utf8')),descriptor=manifest.chunks.find((q:any)=>q.id==='-6_5');let positive=0;
 for(const native of[false,true]){const bytes=readFileSync(resolve(directory,descriptor[native?'minecraft':'drawn'].url)),chunk=JSON.parse(gunzipSync(bytes).toString()),nav=JSON.stringify(chunk.nav),built=drain(buildSurroundingCityChunk(chunk,descriptor.id,native));try{
   const original=built.root.children.slice(),packet=drain(createPublicMonumentsPacketV326Steps(built.root,descriptor.id,native,built.nav,built.origin));try{expect(packet.root).not.toBeNull();expect(packet.supportedSourceIds.length).toBeGreaterThan(0);expect(packet.supportedSourceIds.length+packet.unsupportedSourceIds.length).toBe(238);expect(packet.complete()).toBe(true);expect(packet.root!.children.every(q=>hasCompletePublicMonumentsV326(q as Group,native))).toBe(true);expect(packet.geometryBytes).toBeLessThan(30000);positive+=packet.supportedSourceIds.length;expect(built.root.children.slice(0,original.length)).toEqual(original);expect(JSON.stringify(chunk.nav)).toBe(nav);expect(readFileSync(resolve(directory,descriptor[native?'minecraft':'drawn'].url)).equals(bytes)).toBe(true);}finally{packet.dispose();}
 }finally{disposeSurroundingCityRootV323(built.root);}}
 expect(positive).toBeGreaterThan(100);
},10000);

test('individual Oberschöneweide clinker stele keeps documented exact envelope, four-sided ceramic band and explicit orientation limit',()=>{
 for(const native of[false,true]){const root=createOberschoeneweideMemorialV326(native,5,[namedProfile.point[0]-1,0,namedProfile.point[1]-2])!;try{expect(hasCompletePublicMonumentsV326(root,native)).toBe(true);expect(root.userData.orientationStatus).toContain('estimated');expect(root.userData.reliefStatus).toContain('not a photographic replica');const m=root.children[0]as InstancedMesh;expect(m.count).toBeGreaterThan(300);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<m.count;i++){const a=m.instanceMatrix.array,k=i*16,p=[a[k+12],a[k+13],a[k+14]],s=[a[k],a[k+5],a[k+10]];for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[j]-s[j]/2);hi[j]=Math.max(hi[j],p[j]+s[j]/2);}}expect(hi[0]-lo[0]).toBeCloseTo(.7,6);expect(hi[1]-lo[1]).toBeCloseTo(2.5,5);expect(hi[2]-lo[2]).toBeCloseTo(.63,6);const h=namedProfile.heightM;try{namedProfile.heightM+=.1;expect(hasCompletePublicMonumentsV326(root,native)).toBe(false);expect(createOberschoeneweideMemorialV326(native,5)).toBeNull();}finally{namedProfile.heightM=h;}
 }finally{disposePublicMonumentsV326(root);}}
});

test('actual19_12 primary complements individually support named stele and return matching new Nav without changing originals',()=>{
 const directory=resolve(import.meta.dir,'../public/mesh/surrounding-berlin-v159'),manifest=JSON.parse(readFileSync(resolve(directory,'manifest.json'),'utf8')),descriptors=manifest.chunks.filter((q:any)=>['outer187-19_12','east200-19_12'].includes(q.id));expect(descriptors).toHaveLength(2);
 for(const native of[false,true]){let admitted=0;for(const descriptor of descriptors){const bytes=readFileSync(resolve(directory,descriptor[native?'minecraft':'drawn'].url)),chunk=JSON.parse(gunzipSync(bytes).toString()),built=drain(buildSurroundingCityChunk(chunk,descriptor.id,native)),navText=JSON.stringify(built.nav);try{const packet=drain(createPublicMonumentsPacketV326Steps(built.root,descriptor.id,native,built.nav,built.origin));try{if(packet.supportedSourceIds.includes(namedProfile.id)){admitted++;expect(packet.root).not.toBeNull();expect(packet.complete()).toBe(true);expect(packet.navigation).toBeDefined();expect(packet.navigation!.buildings.slice(0,built.nav.buildings.length)).toEqual(built.nav.buildings);const added=packet.navigation!.buildings.at(-1)!;expect(added.sourceId).toBe('monument:node/4998450868:v326');expect(added.height-added.minHeight).toBe(2.5);expect(packet.geometryBytes).toBeLessThan(80000);}expect(JSON.stringify(built.nav)).toBe(navText);expect(readFileSync(resolve(directory,descriptor[native?'minecraft':'drawn'].url)).equals(bytes)).toBe(true);}finally{packet.dispose();}}finally{disposeSurroundingCityRootV323(built.root);}}expect(admitted).toBe(1);}
},10000);
