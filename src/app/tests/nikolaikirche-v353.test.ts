import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {LineSegments, Mesh, type Object3D} from 'three';
import {createSurroundingCityChunk, surroundingBuildingSolidAt, prepareSurroundingQuarterPredecessorV303, groundOverlayKindsV329, type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {disposeSurroundingCityRoot} from '../src/disposeSurroundingCityRootV323';
import {captureSourceQuarterPacketV303} from '../src/SourceQuarterPacketV303';
import {captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300} from '../src/NeighbourhoodPacketV300';
import {nikolaikirchePacketV353, nikolaikircheSourceV353} from '../src/NikolaikircheV353';
import index from '../src/data/nikolaikircheV353Index.json';
import {doneV342, optionsV342} from './helpers/neukoellnPredecessorV342';

const KIND='nikolaikirche-v353', OWNER='DEBE01YYK00001VX';
const packed=new Uint8Array(readFileSync(new URL('../src/data/nikolaikircheV353Packets.json.gz',import.meta.url)));
const source=()=>nikolaikircheSourceV353(packed,nikolaikirchePacketV353.keys,index.decodedBytes);
const input=(id:string,mode:string):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
const first=<T>(root:Object3D,check:(o:Object3D)=>o is T&Object3D):T|undefined=>{let found:T|undefined;root.traverse(o=>{if(!found&&check(o))found=o;});return found;};

test('all five complete church transfers are admitted by the actual production decoder; unrelated words, materials, navigation and ink survive',async()=>{
 const recipes=source();
 for(const key of recipes.keys){
  const [mode,id]=key.split(':'),native=mode==='minecraft',raw=input(id,mode),snapshot=JSON.stringify(raw),plan=recipes.packets[key];
  const settings=await optionsV342(id,native);
  const before=createSurroundingCityChunk(input(id,mode),id,native,{...settings,sourceQuarterSourcesV303:settings.sourceQuarterSourcesV303?.filter(e=>e.kind!==KIND)});
  const after=createSurroundingCityChunk(raw,id,native,settings);
  try{
   expect(after.root.userData.sourceQuarterOwnersV303).toContain(OWNER);
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
   expect(after.nav.buildings.filter(b=>!b.sourceId.startsWith(KIND+':'))).toEqual(before.nav.buildings.filter(b=>b.sourceId!==OWNER||id!=='4_0'));
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
   if(id==='4_0'){
    const solid=(x:number,y:number,z:number)=>surroundingBuildingSolidAt(after.nav,x-2048,y,z);
    expect(solid(2440,35,285.23)).toBeTrue();expect(solid(2440,37,285.23)).toBeFalse();
    expect(solid(2410.587,70,281.107)).toBeTrue();expect(solid(2410.587,88,281.107)).toBeFalse();
    expect(solid(native?2410.5:2410.587,87,native?281.5:281.107)).toBeTrue();
    // The old full-width gable no longer closes the gap between the needles.
    expect(solid(2410.6,55,286.2)).toBeFalse();
   }
   expect(after.geometryBytes).toBeLessThan(6*1024*1024);
  }finally{disposeSurroundingCityRoot(before.root);disposeSurroundingCityRoot(after.root);}
 }
},30000);

test('independent Native body and helmets contain only cardinal faces',()=>{
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
 const wrong=nikolaikircheSourceV353(packed,nikolaikirchePacketV353.keys,index.decodedBytes+1);
 expect(()=>wrong.packets[wrong.keys[0]]).toThrow();
 const swapped=JSON.parse(gunzipSync(packed).toString());swapped.keys.reverse();const bytes=gzipSync(JSON.stringify(swapped));
 const invalid=nikolaikircheSourceV353(bytes,nikolaikirchePacketV353.keys,Buffer.byteLength(JSON.stringify(swapped)));
 expect(()=>invalid.packets[invalid.keys[0]]).toThrow();
});
