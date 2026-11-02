import { describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import { BufferGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import data from "../src/data/moabitMitteV300Core.json";
import owners from "../src/data/moabitMitteV300Owners.json";
import profile from "../src/data/moabitMitteV300Profile.json";
import { admitsMoabitMitteV300Core, admitsMoabitMitteV300Native, createMoabitMitteV300Core, hasCompleteMoabitMitteV300Core, isMoabitMitteV300OldCore, isMoabitMitteV300OldNativeColumn, moabitMitteV300Solids } from "../src/MoabitMitteV300Core";
const clone = <T>(v:T):T=>JSON.parse(JSON.stringify(v));
const core = ()=>JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
const native = ()=>JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8"));
function release(root:Group){const materials=new Set<MeshBasicMaterial>(),geometries=new Set<BufferGeometry>();root.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const key of ['dayMaterial','nightMaterial'])if(o.userData[key])materials.add(o.userData[key]);if(o instanceof InstancedMesh)o.dispose();}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();}
describe("complete Moabit/Mitte source correction v300",()=>{
 it("admits all exact old and retained sources, rejects missing, changed, duplicate or forged owners",()=>{
  const p=core();expect(admitsMoabitMitteV300Core(p)).toBe(true);const owner=owners.oldPrisms[0];expect(isMoabitMitteV300OldCore(owner)).toBe(true);expect(isMoabitMitteV300OldCore({...owner,h_dm:owner.h_dm+1})).toBe(false);expect(isMoabitMitteV300OldCore({...owner,unproved:true})).toBe(false);
  for(const operation of [(q:any)=>q.buildings.splice(q.buildings.findIndex((b:any)=>b.id===owner.id),1),(q:any)=>q.buildings.find((b:any)=>b.id===owner.id).roof=42,(q:any)=>q.buildings.push(clone(owner)),(q:any)=>Object.defineProperty(q.buildings.find((b:any)=>b.id===owner.id),'ring',{enumerable:true,get(){throw Error('untrusted');}})]){const q=clone(p);operation(q);expect(admitsMoabitMitteV300Core(q)).toBe(false);}
  for(const p of owners.retainedPrisms)expect(isMoabitMitteV300OldCore(p)).toBe(false);
  expect(isMoabitMitteV300OldCore(core().buildings.find((b:any)=>b.id==='24362573'))).toBe(false);
 });
 it("admits full affected native rows and classes, keeps foreign and unknown tuples",()=>{
  const p=native();expect(admitsMoabitMitteV300Native(p)).toBe(true);for(const tuple of owners.nativeColumns)expect(isMoabitMitteV300OldNativeColumn(tuple)).toBe(true);expect(isMoabitMitteV300OldNativeColumn([0,0,0,1,0])).toBe(false);
  for(const operation of [(q:any)=>q.classes.push('unknown'),(q:any)=>q.grid.min_x_idx++,(q:any)=>q.building_rows[owners.nativeRows[0].index][0][2]++,(q:any)=>q.cell_m=2]){const q=clone(p);operation(q);expect(admitsMoabitMitteV300Native(q)).toBe(false);}
 });
 for(const isNative of [false,true])it(`constructs all source members on desktop and touch, and checks actual complete geometry (${isNative?'native':'drawn'})`,()=>{
  const a=createMoabitMitteV300Core(isNative),b=createMoabitMitteV300Core(isNative,{mobileLike:true});expect(hasCompleteMoabitMitteV300Core(a,isNative)).toBe(true);expect(hasCompleteMoabitMitteV300Core(a,!isNative)).toBe(false);
  expect(a.children.map(o=>{const m=o as Mesh;return[m.geometry.getAttribute('position').count,m.geometry.index!.count,m instanceof InstancedMesh?m.count:0];})).toEqual(b.children.map(o=>{const m=o as Mesh;return[m.geometry.getAttribute('position').count,m.geometry.index!.count,m instanceof InstancedMesh?m.count:0];}));
  const triangles=a.children.reduce((sum,o)=>{const m=o as Mesh;return sum+m.geometry.index!.count/3*(m instanceof InstancedMesh?m.count:1);},0);expect(triangles).toBe(isNative?data.counts.nativeTriangles:data.counts.drawnTriangles);
  const child=a.children[0] as Mesh,attribute=child.geometry.getAttribute('position');child.geometry.deleteAttribute('position');expect(hasCompleteMoabitMitteV300Core(a)).toBe(false);child.geometry.setAttribute('position',attribute);expect(hasCompleteMoabitMitteV300Core(a)).toBe(true);a.remove(child);expect(hasCompleteMoabitMitteV300Core(a)).toBe(false);a.add(child);a.children.splice(a.children.indexOf(child),1);a.children.unshift(child);expect(hasCompleteMoabitMitteV300Core(a)).toBe(true);
  child.material=new MeshBasicMaterial();expect(hasCompleteMoabitMitteV300Core(a)).toBe(false);child.material.dispose();child.material=child.userData.dayMaterial;
  const fake=new Group();fake.userData={...a.userData};expect(hasCompleteMoabitMitteV300Core(fake)).toBe(false);release(a);release(b);
 });
 it("does not publish a partial member array or darken every replacement window at night",()=>{
  const row=data.nativeBoxes.pop()!;try{expect(()=>createMoabitMitteV300Core(true)).toThrow();}finally{data.nativeBoxes.push(row);}
  for(const mode of [false,true]){const root=createMoabitMitteV300Core(mode),lights=root.children.filter(o=>(o as Mesh).userData.nightMaterial.emissiveIntensity>0);expect(lights.length).toBe(1);expect((lights[0]as InstancedMesh).count).toBeGreaterThan(0);for(const child of root.children)(child as Mesh).material=child.userData.nightMaterial;expect(hasCompleteMoabitMitteV300Core(root,mode)).toBe(true);release(root);}
 });
 it("uses the exact compiled native roof caps rather than the lower source slope",()=>{
  const drawn=moabitMitteV300Solids(),native=moabitMitteV300Solids(true),part=drawn.find(p=>p.sourceId==='DEBE3DmHDzWBuaWc')!;
  expect(part.topAt(-1817,-720.25)).toBeCloseTo(23.90898,4);expect(native.find(p=>p.sourceId===part.sourceId)!.topAt(-1817,-720.25)).toBeCloseTo(24.55,5);
  for(const row of profile.nativeRoofs.filter((_,i)=>i%71===0)){const[parent,x,z,length,,height]=row;const solid=native.find(p=>p.parentId===parent)!;expect(solid.topAt((Number(x)+Number(length)/2)*.5,(Number(z)+.5)*.5)).toBe(height as number);}
 });
 it("cleans unpublished geometry and materials after a late construction failure",()=>{
  const row=data.nativeBoxes[0],width=row[3],geometry=spyOn(BufferGeometry.prototype,'dispose'),material=spyOn(MeshBasicMaterial.prototype,'dispose');row[3]=-1;
  try{expect(()=>createMoabitMitteV300Core(true)).toThrow();expect(geometry).toHaveBeenCalled();expect(material).toHaveBeenCalled();}finally{row[3]=width;geometry.mockRestore();material.mockRestore();}
 });
 it("keeps all native members cardinal and all navigation leaf holes and roof levels",()=>{
  expect(data.nativeBoxes.length).toBeGreaterThan(1000);for(const r of data.nativeBoxes){expect(r[6]).toBe(0);expect(r.slice(3,6).every(v=>v>0)).toBe(true);}
  const solids=moabitMitteV300Solids();expect(solids.length).toBe(profile.navigation.length);expect(solids.length).toBeGreaterThan(profile.sites.length);expect(solids.reduce((n,s)=>n+s.holes.length,0)).toBe(profile.navigation.reduce((n,p)=>n+p.holes.length,0));
  for(let i=0;i<solids.length;i++){expect(solids[i].ring).toEqual(profile.navigation[i].ring);expect(solids[i].holes).toEqual(profile.navigation[i].holes);expect(solids[i].maxY).toBeGreaterThan(solids[i].minY);const t=profile.navigation[i].roofTriangles[0];if(t){const x=(t[0][0]+t[1][0]+t[2][0])/3,z=(t[0][2]+t[1][2]+t[2][2])/3;expect(solids[i].topAt(x,z)).not.toBeNull();}}
 });
});
