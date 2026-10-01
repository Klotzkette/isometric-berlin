import { describe, expect, test } from 'bun:test';
import { createHbfNorthApproach } from '../src/HbfNorthApproach';
import { HBF_NORTH_APPROACH_SOURCE as source, hbfNorthRailFloorAt, hbfNorthRailGroundAt, pointInHbfNorthRailCut } from '../src/HbfNorthApproachProfile';
import { InstancedMesh, Mesh, Raycaster, Vector3 } from 'three';
function budget(native:boolean){
 const root=createHbfNorthApproach(()=>5.2,native);let draws=0,bytes=0,instances=0;
 root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;if(o.geometry.index)bytes+=o.geometry.index.array.byteLength;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});
 return{root,draws,bytes,instances};
}
describe('Source-bound northern Hauptbahnhof approach',()=>{
 test('retains mainline and S21 as separate source systems and the mapped park',()=>{
  expect(source.park.id).toBe(185633562);expect(source.paths).toHaveLength(8);expect(source.benches).toHaveLength(12);
  expect(source.retaining_walls.map(w=>w.id)).toEqual([460595887,1127456787,1127456788]);
  expect(source.tracks.filter(t=>t.family==='s21')).toHaveLength(2);
  expect(source.profile.mainline_portal_track_way_ids).toHaveLength(6);
 });
 test('only the two local railway cuts lower the public terrain',()=>{
  expect(pointInHbfNorthRailCut(-333,-1160)).toBe(true);
  expect(pointInHbfNorthRailCut(-283,-1160)).toBe(true);
  expect(pointInHbfNorthRailCut(-393,-1180)).toBe(false);
  expect(hbfNorthRailGroundAt(-393,-1180)).toBeNull();
  expect(hbfNorthRailGroundAt(-333,-1160)).toBeLessThan(-2);
  expect(hbfNorthRailGroundAt(-505,-1428)).toBeGreaterThan(3);
 });
 test('the photographed broad mainline mouth stays physically open',()=>{
  const {root}=budget(false);root.updateMatrixWorld(true);
  const [x,z]=source.profile.origin,[dx,dz]=source.profile.outward;
  const ray=new Raycaster(new Vector3(x+dx*8,-1.3,z+dz*8),new Vector3(-dx,0,-dz),0,17);
  expect(ray.intersectObject(root,true)).toHaveLength(0);
 });
 test('floor triangles follow the grade beneath every mapped track and leave sleepers exposed',()=>{
  const root=createHbfNorthApproach(()=>5.2);root.updateMatrixWorld(true);
  const surfaces=root.getObjectByName('Source-bound open-cut floor and Döberitzer path surfaces')!;
  let samples=0;
  for(const track of source.tracks)for(let i=1;i<track.points.length;i++){
   const a=track.points[i-1],b=track.points[i];
   for(const t of[.2,.5,.8]){
    const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    if(!pointInHbfNorthRailCut(x,z))continue;
    const floor=hbfNorthRailFloorAt(x,z,track.family as 'mainline'|'s21');
    const hits=new Raycaster(new Vector3(x,floor+1,z),new Vector3(0,-1,0),0,2).intersectObject(surfaces,false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(floor+.04,4);
    expect(hits[0].point.y).toBeLessThan(floor+.105);
    samples++;
   }
  }
  expect(samples).toBeGreaterThan(60);
 });
 test('both presentations retain bounded static geometry without textures',()=>{
  for(const native of[false,true]){
   const b=budget(native);console.log({native,draws:b.draws,bytes:b.bytes,instances:b.instances});
   expect(b.draws).toBe(native?1:2);expect(b.bytes).toBeLessThan(5_000_000);expect(b.root.userData.fullStaticDetailOnTouch).toBe(true);
   b.root.traverse(o=>{if(!(o instanceof Mesh))return;for(const m of(Array.isArray(o.material)?o.material:[o.material]))expect((m as {map?:unknown}).map??null).toBeNull();});
  }
 });
});

describe('Integrated northern railway terrain and public paths',()=>{
 test('the roof seam has no retained grass island in shared drawn/native ground',async()=>{
  const {createGroundSlabs}=await import('../src/MinecraftVoxelWorld');
  const {restoreHbfNorthRailGroundOwnership}=await import('../src/HbfNorthRailGroundOwnership');
  const ground=await Bun.file(new URL('../public/mesh/regierungsviertel/ground-context.json',import.meta.url)).json();
  const cropped={...ground,ground_rows:ground.ground_rows.map((row:unknown,i:number)=>{const z=(i+ground.grid.min_z_idx)*ground.cell_m;return z>-1200&&z<-1120?row:[];})};
  const slabs=createGroundSlabs(cropped,'portal seam ground',{grass:[0x88aa66]});
  restoreHbfNorthRailGroundOwnership(slabs,cropped);slabs.updateMatrixWorld(true);
  // Centroid of the former tiny triangular gap, whose vertical face appeared
  // as a large green rectangle beneath the concrete head in the full viewer.
  const ray=new Raycaster(new Vector3(-337.6786,12,-1145.5793),new Vector3(0,-1,0),0,15);
  expect(ray.intersectObject(slabs,true)).toHaveLength(0);
  ray.ray.origin.set(-393,12,-1180);
  expect(ray.intersectObject(slabs,true).length).toBeGreaterThan(0);
 });
 test('real viewer walking follows cut floors while adjacent park stays on original ground',async()=>{
  const {createPedestrianEnvironment}=await import('../src/pedestrianNavigation');
  const {smoothGroundTopSampler}=await import('../src/MinecraftVoxelWorld');
  const ground=await Bun.file(new URL('../public/mesh/regierungsviertel/ground-context.json',import.meta.url)).json();
  const environment=createPedestrianEnvironment(ground,{water:[]});
  const sample=smoothGroundTopSampler(ground);
  for(const [x,z] of[[-333,-1160],[-283,-1160],[-505,-1428]])expect(environment.groundAt(x,z)).toBe(hbfNorthRailGroundAt(x,z));
  for(const [x,z] of[[-393,-1180],[-548,-1420],[-630,-1550]])expect(environment.groundAt(x,z)).toBe(sample(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx));
  const limited={...ground,grid:{min_x_idx:0,min_z_idx:0,cols:2,rows:2}};
  const fixture=createPedestrianEnvironment(limited,{water:[]});
  expect(fixture.groundAt(-333,-1160)).toBeNull();
 });
 test('offline lawn matching leaves unrelated polygons unchanged',async()=>{
  const {hbfNorthRailParkSurfaces}=await import('../src/HbfNorthRailSurfaces');
  const unrelated={area_m2:16,ring:[[0,0],[40,0],[40,40],[0,40],[0,0]],holes:[],kind:'lawn' as const};
  expect(hbfNorthRailParkSurfaces(unrelated)[0]).toBe(unrelated);
  const original=source.park_surface_replacements[0];
  const result=hbfNorthRailParkSurfaces({...unrelated,ring:original.source_ring});
  expect(result).toHaveLength(original.polygons.length);
  expect(result[0].ring).toEqual(original.polygons[0].ring);
 });
});
