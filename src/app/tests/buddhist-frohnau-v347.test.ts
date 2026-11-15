import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Mesh} from 'three';
import {buildSurroundingCityChunk,surroundingBuildingSolidAt,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {decodeGardenTerrainV330,gardenTerrainGroundAtV330} from '../src/GardenTerrainV330';
import {spreeBridgeFloorAtV242} from '../src/SpreeBridgesV242';
import {buddhistFrohnauGroundAtV347,buddhistFrohnauContainsV347} from '../src/BuddhistFrohnauGroundV347';
import {surroundingScopeGroundAt} from '../src/surroundingCityScope';
import {measuredTerrainOwnersV342} from '../src/measuredTerrainOwnersV342';
import {staticGeometryAudit,disposeStaticAudit} from './helpers/staticGeometryAudit';
const geo=resolve(import.meta.dir,'../../../geo_data/regierungsviertel');
const manifest=JSON.parse(readFileSync(resolve(geo,'buddhist-frohnau-v347-manifest.json'),'utf8'));
const source=JSON.parse(gunzipSync(readFileSync(resolve(geo,'buddhist-frohnau-v347-source.json.gz'))).toString());
const folder=process.env.BUDDHIST_FROHNAU_V347_PACKETS??resolve(geo,'raw/buddhist-frohnau-v347/packets');
const packet=(native:boolean):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync(resolve(folder,manifest.chunks[0][native?'minecraft':'drawn'].url))).toString());
const finish=<T>(gen:Generator<void,T>):T=>{let n=gen.next();while(!n.done)n=gen.next();return n.value;};

test('every complete family and original measured vertex survives the immutable packet pair',()=>{
 expect(source.parents).toHaveLength(6);expect(source.parents.reduce((n:number,p:any)=>n+p.parts.length,0)).toBe(9);
 expect(source.retained.overlapM2).toBe(0);expect(manifest.chunks).toHaveLength(1);
 for(const native of [false,true]){
  const descriptor=manifest.chunks[0][native?'minecraft':'drawn'];const bytes=readFileSync(resolve(folder,descriptor.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(descriptor.sha256);
  expect(bytes.byteLength).toBe(descriptor.bytes);expect(gunzipSync(bytes).byteLength).toBe(descriptor.decodedBytes);
  const p=packet(native);expect(p.meshes).toHaveLength(3);
  expect(new Set(p.nav.buildings.map(b=>b.sourceId))).toEqual(new Set(source.parents.map((p:any)=>p.id)));
  expect(p.nav.buildings).toHaveLength(native?6:9);
  for(const b of p.nav.buildings)expect(native?b.nativeRoofCaps!.length:b.roofTriangles!.length).toBeGreaterThan(0);
  if(!native){
   const mesh=p.meshes.find(m=>m.kind==='buddhist-frohnau-buildings-v347')!;
   const pos=new Uint16Array(Uint8Array.from(Buffer.from(mesh.positions,'base64')).buffer);
   const vertices=new Set<string>();for(let i=0;i<pos.length;i+=3)vertices.add(`${pos[i]},${pos[i+1]},${pos[i+2]}`);
   for(const parent of source.parents)for(const part of parent.parts)for(const surface of part.surfaces)for(const ring of surface.rings)for(const [x,y,z]of ring){
    const key=`${Math.round((x-p.origin[0])*100)},${Math.round((y+30-source.datumNHN-p.origin[1])*100)},${Math.round((z-p.origin[2])*100)}`;
    expect(vertices.has(key)).toBe(true);
   }
  }
 }
});

test('73 stairs and eight landings connect, and pre-residency ground matches resident navigation',()=>{
 expect(source.stair.steps).toBe(73);expect(source.stair.landings).toBe(8);
 expect(buddhistFrohnauGroundAtV347(0,0)).toBeNull();expect(buddhistFrohnauContainsV347(-4390,-13200)).toBe(false);
 for(const native of [false,true]){
  const p=packet(native),floors=p.nav.spreeBridgesV242!.floors;expect(floors).toHaveLength(81);
  expect(new Set(floors.map(p=>p.y)).size).toBe(73);
  let previous=-Infinity;
  for(const floor of floors){
   const x=floor.ring.reduce((n,q)=>n+q[0],0)/floor.ring.length,z=floor.ring.reduce((n,q)=>n+q[1],0)/floor.ring.length;
   expect(floor.y).toBeGreaterThanOrEqual(previous);previous=floor.y;
   expect(buddhistFrohnauGroundAtV347(x+p.origin[0],z+p.origin[2],native)).toBe(spreeBridgeFloorAtV242(p.nav,x,z));
   expect(surroundingBuildingSolidAt(p.nav,x,floor.y+1,z,.15)).toBe(false);
  }
  const grid=decodeGardenTerrainV330(p.gardenTerrainV330!,native);
  for(let x=-4380.7;x<-4180;x+=11)for(let z=-13150.3;z<-13010;z+=9){
   if(!buddhistFrohnauContainsV347(x,z))continue;
   const lx=x-p.origin[0],lz=z-p.origin[2];
   expect(buddhistFrohnauGroundAtV347(x,z,native)).toBe(spreeBridgeFloorAtV242(p.nav,lx,lz)??gardenTerrainGroundAtV330(grid,lx,lz,native));
  }
 }
});

test('both streamed branches stay bounded, Native stays cardinal and remounts preserve every mesh',()=>{
 for(const native of [false,true]){
  const a=finish(buildSurroundingCityChunk(packet(native),source.key,native));
  const b=finish(buildSurroundingCityChunk(packet(native),source.key,native));
  const aa=staticGeometryAudit(a.root),bb=staticGeometryAudit(b.root);
  expect(aa.hash).toBe(bb.hash);expect(a.bufferCount).toBeLessThanOrEqual(12);expect(a.geometryBytes).toBeLessThan(2000000);
  let triangles=0;
  a.root.traverse(o=>{if(!(o instanceof Mesh))return;expect(o.geometry.getAttribute('uv')).toBeUndefined();
   const p=o.geometry.getAttribute('position'),ix=o.geometry.index!;
   triangles+=ix.count/3;
   if(native)for(let i=0;i<ix.count;i+=3){
    const q=[0,1,2].map(j=>[p.getX(ix.getX(i+j)),p.getY(ix.getX(i+j)),p.getZ(ix.getX(i+j))]);
    const u=q[1].map((v,j)=>v-q[0][j]),v=q[2].map((v,j)=>v-q[0][j]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    expect(n.filter(v=>Math.abs(v)>.0001).length).toBeLessThanOrEqual(1);
   }
  });
  expect(triangles).toBe(native?14400:4607);
  disposeStaticAudit(a.root);disposeStaticAudit(b.root);
 }
});

test('shared scope delegates exact measured Frohnau terrain and stairs before residency in both families',()=>{
 expect(measuredTerrainOwnersV342.has('buddhist347--9_-26')).toBe(true);
 expect(measuredTerrainOwnersV342.has('buddhist347--9_-26-p1')).toBe(false);
 expect(measuredTerrainOwnersV342.has('buddhist347--8_-26')).toBe(false);
 for(const native of [false,true]){
  const p=packet(native),grid=decodeGardenTerrainV330(p.gardenTerrainV330!,native);let stairOverrides=0;
  for(const floor of p.nav.spreeBridgesV242!.floors){
   const lx=floor.ring.reduce((n,q)=>n+q[0],0)/floor.ring.length,lz=floor.ring.reduce((n,q)=>n+q[1],0)/floor.ring.length;
   const x=lx+p.origin[0],z=lz+p.origin[2];
   expect(surroundingScopeGroundAt(x,z,native)).toBe(floor.y);
   if(Math.abs(floor.y-gardenTerrainGroundAtV330(grid,lx,lz,native)!)>.02)stairOverrides++;
  }
  expect(stairOverrides).toBeGreaterThan(70);
  for(const [x,z]of [[-4360,-13120],[-4300,-13080],[-4230,-13050]]){
   expect(buddhistFrohnauContainsV347(x,z)).toBe(true);
   expect(surroundingScopeGroundAt(x,z,native)).toBe(buddhistFrohnauGroundAtV347(x,z,native));
  }
  for(const [x,z]of [[-4390,-13200],[-4160,-13110]]){
   expect(buddhistFrohnauContainsV347(x,z)).toBe(false);
   expect(surroundingScopeGroundAt(x,z,native)).toBeNull();
  }
 }
});
