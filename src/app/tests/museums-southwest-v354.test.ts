import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {LineSegments, Mesh, OrthographicCamera, type Object3D} from 'three';
import {createSurroundingCity} from '../src/SurroundingCity';
import {createSurroundingCityChunk, surroundingBuildingSolidAt, prepareSurroundingQuarterPredecessorV303, groundOverlayKindsV329, type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {disposeSurroundingCityRoot} from '../src/disposeSurroundingCityRootV323';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300} from '../src/NeighbourhoodPacketV300';
import {museumsSouthwestPacketV354, museumsSouthwestSourceV354, dueppelVillageFloorV354} from '../src/MuseumsSouthwestV354';
import index from '../src/data/museumsSouthwestV354Index.json';
import {doneV342, optionsV342} from './helpers/neukoellnPredecessorV342';

const KIND='museums-southwest-v354';
const packed=new Uint8Array(readFileSync(new URL('../src/data/museumsSouthwestV354Packets.json.gz',import.meta.url)));
const source=()=>museumsSouthwestSourceV354(packed,museumsSouthwestPacketV354.keys,index.decodedBytes);
const input=(id:string,mode:string):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
const first=<T>(root:Object3D,check:(o:Object3D)=>o is T&Object3D):T|undefined=>{let found:T|undefined;root.traverse(o=>{if(!found&&check(o))found=o;});return found;};

test('new village walking floor follows actual delivered grass/path triangles and disappears with its resident owner',()=>{
 for(const native of [false,true]){
  const plan=source().packets[`${native?'minecraft':'drawn'}:outer187--19_20`];
  const pb=Buffer.from(plan.append!.positions,'base64'),ib=Buffer.from(plan.append!.indices,'base64');
  const p=new Uint16Array(pb.buffer,pb.byteOffset,pb.length/2),ix=new Uint32Array(ib.buffer,ib.byteOffset,ib.length/4);
  let floors=0;
  for(let i=0;i<ix.length;i+=3){
   const t=[0,1,2].map(j=>[p[ix[i+j]*3]/100+plan.origin[0],p[ix[i+j]*3+1]/100+plan.origin[1],p[ix[i+j]*3+2]/100+plan.origin[2]]);
   if(!t.every(v=>Math.abs(v[1]-3.02)<.001))continue;
   const x=t.reduce((n,v)=>n+v[0],0)/3,z=t.reduce((n,v)=>n+v[2],0)/3;
   // Quantized boundary slivers can have their centre a few millimetres off
   // the literal map; at least the substantial interior is walkable.
   if(dueppelVillageFloorV354(plan.owners,x,z,native)===3.02)floors++;
   expect(dueppelVillageFloorV354([],x,z,native)).toBeNull();
  }
  expect(floors).toBeGreaterThan(100);
  expect(dueppelVillageFloorV354(plan.owners,0,0,native)).toBeNull();
 }
});

test('streamed village admits the new walking surface beyond old partial ground and releases it with the host',async()=>{
 const id='outer187--19_20';
 for(const native of [false,true]){
  const raw=input(id,native?'minecraft':'drawn'),body=JSON.stringify(raw);
  const camera=new OrthographicCamera(-180,180,180,-180,1,2000);
  camera.position.set(-9610,120,10312);camera.up.set(0,0,-1);camera.lookAt(-9610,3,10312);camera.updateMatrixWorld();
  const manifest={schemaVersion:1,groundY:3,footprint:[],chunks:[{id,bounds:[-9728,10240,-9216,10752],drawn:{url:'host.json',bytes:body.length},minecraft:{url:'host.json',bytes:body.length}}]};
  const city=createSurroundingCity({camera,manifestUrl:new URL('https://v354.test/manifest.json'),mode:native?'minecraft':'day',sourceQuartersV303:true,sourceQuarterSourcesV303:[{kind:KIND,source:source()}],fetch:(async(url)=>new Response(String(url).includes('manifest.json')?JSON.stringify(manifest):body)) as typeof fetch});
  try{
   await city.ready;
   for(let i=0;i<250&&city.pending;i++)await new Promise(r=>setTimeout(r,4));
   expect(city.residentChunkCount).toBe(1);
   expect(city.hasResidentSurfaceAt(-9610,10312)).toBeTrue();
   expect(city.groundAt(-9610,10312)).toBe(3.02);
   city.dispose();
   expect(city.hasResidentSurfaceAt(-9610,10312)).toBeFalse();
   expect(city.groundAt(-9610,10312)).toBeNull();
  }finally{city.dispose();}
 }
});

test('all six museum transfers are admitted by the actual production decoder; unrelated words, materials, navigation and ink survive',async()=>{
 const recipes=source();
 for(const key of recipes.keys){
  const [mode,id]=key.split(':'),native=mode==='minecraft',raw=input(id,mode),snapshot=JSON.stringify(raw),plan=recipes.packets[key];
  const settings=await optionsV342(id,native);
  const before=createSurroundingCityChunk(input(id,mode),id,native,{...settings,sourceQuarterSourcesV303:settings.sourceQuarterSourcesV303?.filter(e=>e.kind!==KIND)});
  const after=createSurroundingCityChunk(raw,id,native,{...settings,sourceQuarterSourcesV303:[...(settings.sourceQuarterSourcesV303??[]).filter(e=>e.kind!==KIND),{kind:KIND,source:recipes}]});
  try{
   for(const owner of plan.owners)expect(after.root.userData.sourceQuarterOwnersV303).toContain(owner);
   expect(JSON.stringify(raw)).toBe(snapshot);
   expect((after.root.userData.sourceQuarterTrianglesV303??0)-(before.root.userData.sourceQuarterTrianglesV303??0)).toBe(plan.retire.reduce((n,r)=>n+r.triangles.length,0));
   const a=first(before.root,(o):o is Mesh=>o instanceof Mesh),b=first(after.root,(o):o is Mesh=>o instanceof Mesh)!;
   expect(b).toBeDefined();
   if(a){
    let predecessor=doneV342(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,settings));
    for(const entry of settings.sourceQuarterSourcesV303??[]){
     if(entry.kind===KIND||groundOverlayKindsV329.has(entry.kind))continue;
     const candidate=entry.source.packets[key];if(!candidate)continue;
     const ticket=candidate.preparedRecords?doneV342(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):doneV342(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
     if(ticket)predecessor=doneV342(ticket(predecessor));
    }
    const oldCount=predecessor.meshes.reduce((n,m)=>n+Buffer.from(m.indices,'base64').length/4,0);
    const oldVertices=predecessor.meshes.reduce((n,m)=>n+Buffer.from(m.positions,'base64').length/6,0);
    const addedIndices=Buffer.from(plan.append!.indices,'base64').length/4;
    const addedVertices=Buffer.from(plan.append!.positions,'base64').length/6;
    let vertexChanged=0;
    for(const attr of ['position','color']){
     const old=a.geometry.getAttribute(attr),now=b.geometry.getAttribute(attr);
     for(let i=0;i<old.count;i++)for(const f of ['getX','getY','getZ']as const)if(old[f](i)!==now[f](i+(i>=oldVertices?addedVertices:0)))vertexChanged++;
    }
    expect(vertexChanged).toBe(0);
    const retired=new Set<number>();
    for(const r of plan.retire){const offset=predecessor.meshes.slice(0,r.mesh).reduce((n,m)=>n+Buffer.from(m.indices,'base64').length/4,0);for(const t of r.triangles)retired.add(offset+t*3);}
    let unrelatedChanged=0,notRetired=0;
    for(let i=0;i<a.geometry.index!.count;i+=3){
     const oi=a.geometry.index!,ni=b.geometry.index!;
     if(retired.has(i)){if(ni.getX(i)!==ni.getX(i+1)||ni.getX(i)!==ni.getX(i+2))notRetired++;}
     else for(let j=0;j<3;j++)if(oi.getX(i+j)!==ni.getX(i+j+(i>=oldCount?addedIndices:0))-(i>=oldCount?addedVertices:0))unrelatedChanged++;
    }
    expect(unrelatedChanged).toBe(0);expect(notRetired).toBe(0);
   }
   for(const field of ['ground','water','roads','bridges','groundY']as const)expect(after.nav[field]).toEqual(before.nav[field]);
   expect(after.nav.buildings.filter(b=>!b.sourceId.startsWith(KIND+':'))).toEqual(before.nav.buildings);
   if(plan.retireLines.length){
    const old=first(before.root,(o):o is LineSegments=>o instanceof LineSegments)!.geometry.getAttribute('position');
    const now=first(after.root,(o):o is LineSegments=>o instanceof LineSegments)!.geometry.getAttribute('position');
    const retired=new Set(plan.retireLines);let changed=0,remaining=0;
    for(let i=0;i<old.count;i+=2)for(const f of ['getX','getY','getZ']as const){
     if(retired.has(i/2)){if(now[f](i)!==now[f](i+1))remaining++;}
     else if(now[f](i)!==old[f](i)||now[f](i+1)!==old[f](i+1))changed++;
    }
    expect(changed).toBe(0);expect(remaining).toBe(0);expect(now.count).toBeGreaterThan(old.count);
   }
   if(id==='outer187--19_20'){
    const solid=(x:number,y:number,z:number)=>surroundingBuildingSolidAt(after.nav,x-raw.origin[0],y,z-raw.origin[2]);
    // The raised hay store remains open through its middle, below the roof.
    expect(solid(-9635.25,4.8,10298.5)).toBeFalse();
    // The mapped 3.2 m palisade gateway remains open at pedestrian height.
    expect(solid(-9570.91,4.5,10271.81)).toBeFalse();
   }
   expect(after.geometryBytes).toBeLessThan(6*1024*1024);
  }finally{disposeSurroundingCityRoot(before.root);disposeSurroundingCityRoot(after.root);}
 }
},30000);

test('independent Native huts, palisade and furniture contain only cardinal faces',()=>{
 for(const key of source().keys.filter(k=>k.startsWith('minecraft:'))){
  const mesh=source().packets[key].append!;
  // Buffer copies have their own exact views; do not depend on pooled offsets.
  const pb=Buffer.from(mesh.positions,'base64'),ib=Buffer.from(mesh.indices,'base64');
  const pos=new Uint16Array(pb.buffer,pb.byteOffset,pb.length/2),ix=new Uint32Array(ib.buffer,ib.byteOffset,ib.length/4);
  let oblique=0;
  for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3,u=[0,1,2].map(j=>pos[b+j]-pos[a+j]),v=[0,1,2].map(j=>pos[c+j]-pos[a+j]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n.filter(x=>x!==0).length!==1)oblique++;}
  expect(oblique).toBe(0);expect(pos.length).toBeGreaterThan(0);
 }
});

test('missing successor or any changed source closes the complete replacement',()=>{
 const recipes=source();
 for(const key of recipes.keys){const [mode,id]=key.split(':'),raw=input(id,mode),native=mode==='minecraft';
  expect(doneV342(captureSourceQuarterPacketV303(raw,id,native,true,recipes,KIND))).toBeDefined();
  const changed=input(id,mode);changed.origin[0]+=.01;
  expect(doneV342(captureSourceQuarterPacketV303(changed,id,native,true,recipes,KIND))).toBeUndefined();
  expect(doneV342(captureSourceQuarterPacketV303(raw,id,native,false,recipes,KIND))).toBeUndefined();
  const bad=JSON.parse(gunzipSync(packed).toString());delete bad.packets[key].append;
  expect(doneV342(captureSourceQuarterPacketV303(raw,id,native,true,bad,KIND))).toBeUndefined();
 }
 const wrong=museumsSouthwestSourceV354(packed,museumsSouthwestPacketV354.keys,index.decodedBytes+1);
 expect(()=>wrong.packets[wrong.keys[0]]).toThrow();
 const swapped=JSON.parse(gunzipSync(packed).toString());swapped.keys.reverse();const bytes=gzipSync(JSON.stringify(swapped));
 const invalid=museumsSouthwestSourceV354(bytes,museumsSouthwestPacketV354.keys,Buffer.byteLength(JSON.stringify(swapped)));
 expect(()=>invalid.packets[invalid.keys[0]]).toThrow();
});


test('each café foot sample is supported by the actual independent production terrain',async()=>{
 const evidence=JSON.parse(gunzipSync(readFileSync(new URL('../../../geo_data/regierungsviertel/museums-southwest-v354-source.json.gz',import.meta.url))).toString());
 for(const model of evidence.models.filter((m:any)=>m.feature==='kunsthaus-cafe-terrace')){
  const native=model.independentNative,mode=native?'minecraft':'drawn',id='outer187--14_11',raw=input(id,mode);
  const settings=await optionsV342(id,native),built=createSurroundingCityChunk(raw,id,native,{...settings,sourceQuarterSourcesV303:settings.sourceQuarterSourcesV303?.filter(e=>e.kind!==KIND)});
  try{
   const triangles:number[][][]=[];
   built.root.traverse(o=>{if(!(o instanceof Mesh))return;const p=o.geometry.getAttribute('position'),ix=o.geometry.index!;
    for(let i=0;i<ix.count;i+=3){const t=[0,1,2].map(j=>{const n=ix.getX(i+j);return[p.getX(n)/100+raw.origin[0],p.getY(n)/100+raw.origin[1],p.getZ(n)/100+raw.origin[2]];});if(t.every(v=>v[1]>15&&v[1]<20))triangles.push(t);}
   });
   for(const group of model.groundSamples)for(const [x,y,z]of group.support){
    let top=-Infinity;
    for(const [a,b,c]of triangles){const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-8)continue;
     const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
     if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
    }
    expect(Number.isFinite(top)).toBeTrue();expect(Math.abs(top-y)).toBeLessThan(.011);
   }
  }finally{disposeSurroundingCityRoot(built.root);}
 }
});
