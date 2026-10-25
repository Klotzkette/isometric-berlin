import { expect,test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import core from '../src/data/moabitHousesCoreV269.json';
import {moabitCoreFacadeHeadV269,moabitCoreNativeHeadV269,moabitCoreSourceGuardV269}from '../src/MoabitCoreHousesV269';
import {facadeWallsOf,type PrismPayload}from '../src/IsometricCityWorld';
import {buildColumnToneLookup}from '../src/MinecraftVoxelWorld';
const source=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8')) as PrismPayload;
const audit=JSON.parse(gunzipSync(readFileSync(new URL('../../../geo_data/regierungsviertel/moabit-houses-v269-audit.json.gz',import.meta.url))).toString());

test('all exact core street walls qualify once; changed part or courtyard refuses',()=>{
 let matched=0;
 for(const b of source.buildings){const plan=(core.core as any)[b.id];if(!plan)continue;
  const walls=facadeWallsOf(b),chosen=walls.filter(w=>moabitCoreFacadeHeadV269(b,w));
  if(moabitCoreSourceGuardV269(b)!==plan.guard){expect(chosen.length).toBe(0);continue;}
  expect(chosen.length).toBe(1);expect(moabitCoreSourceGuardV269(b)).toBe(plan.guard);matched++;
  expect(moabitCoreFacadeHeadV269({...b,h_dm:b.h_dm+1},chosen[0])).toBe(false);
  expect(moabitCoreFacadeHeadV269(b,{...chosen[0],isCourtyard:true})).toBe(false);
 }
 expect(matched).toBe(1257);
 for(const id of ['06483932','37533771'])expect((core.core as any)[id]).toBeUndefined();
});

test('native source lookup stays lazy and all native selectors bind exact unchanged columns',()=>{
 let called=0;const lookup=()=>{called++;return undefined;};
 expect(moabitCoreNativeHeadV269(lookup,9999,9999,1,0,0,200)).toBe(false);expect(called).toBe(0);
 for(const [key,v]of Object.entries(core.native)){
  const [x,z,dx,dz]=key.split(',').map(Number);const [lo,hi,id]=v;
  expect(moabitCoreNativeHeadV269(id as string,x,z,dx,dz,lo as number,hi as number)).toBe(true);
  expect(moabitCoreNativeHeadV269(id as string,x,z,dx,dz,(lo as number)+1,hi as number)).toBe(false);
 }
});

test('actual native source-owner resolution retains qualified faces throughout Moabit',()=>{
 const lookup=buildColumnToneLookup(source);const quarters=new Set<string>();let actual=0;
 const byId=new Map(audit.selected.map((r:any)=>[r.owner,r.quarter]));
 for(const [key,v]of Object.entries(core.native)){
  const [x,z,dx,dz]=key.split(',').map(Number);const [lo,hi]=v;
  if(moabitCoreNativeHeadV269(()=>lookup.sourceIdAt?.((x+.5)*4,(z+.5)*4),x,z,dx,dz,lo as number,hi as number)){
   actual++;quarters.add(byId.get(v[2]) as string);
  }
 }
 expect(actual).toBeGreaterThan(2000);expect(quarters.size).toBe(12);
});

test('integrated core factory adds heads in its existing batch and retains every other buffer',async()=>{
 const {createIsometricCity}=await import('../src/IsometricCityWorld');
 const {disposeSurroundingCityRoot}=await import('../src/SurroundingCity');
 const {Mesh,LineSegments}=await import('three');
 const groups=new Map<string,any>();for(const r of [...audit.selected].sort((a:any,b:any)=>Object.keys(a.tags).length-Object.keys(b.tags).length))if(!groups.has(r.quarter)&&r.height>16)groups.set(r.quarter,r);
 let changedQuarters=0;
 for(const r of groups.values()){
  const b=r.source,p=(core.core as any)[b.id],guard=p.guard;let before:any,after:any;
  try{
   p.guard=guard^1;before=createIsometricCity(source,null,null,null,{buildings:[b],includeContext:false});
   p.guard=guard;after=createIsometricCity(source,null,null,null,{buildings:[b],includeContext:false});
   expect(after.children.length).toBe(before.children.length);
   const a=after.getObjectByName('LoD2 facade axes'),old=before.getObjectByName('LoD2 facade axes');
   if(a&&old&&a.geometry.getAttribute('position').count>old.geometry.getAttribute('position').count){
    changedQuarters++;
    const positions=(o:any)=>Array.from(o.geometry.getAttribute('position').array as Float32Array);
    const counts=new Map<string,number>();const now=positions(a);for(let i=0;i<now.length;i+=6){const k=now.slice(i,i+6).join(',');counts.set(k,(counts.get(k)??0)+1);}
    const prior=positions(old);for(let i=0;i<prior.length;i+=6){const k=prior.slice(i,i+6).join(',');expect(counts.get(k)).toBeGreaterThan(0);counts.set(k,counts.get(k)!-1);}
   }
   before.traverse((o:any)=>{if(!(o instanceof Mesh||o instanceof LineSegments)||o.name==='LoD2 facade axes')return;const n=after.getObjectByName(o.name);expect(!!n).toBe(true);for(const [key,attr]of Object.entries(o.geometry.attributes) as any){expect(n.geometry.getAttribute(key).array).toEqual(attr.array);}expect(n.geometry.index?.array).toEqual(o.geometry.index?.array);});
  }finally{p.guard=guard;if(before)disposeSurroundingCityRoot(before);if(after)disposeSurroundingCityRoot(after);}
 }
 expect(changedQuarters).toBe(12);
});
