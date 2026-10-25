import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {Box3,InstancedMesh,Matrix4,Mesh,Ray,Raycaster,Vector3} from 'three';
import data from '../src/data/technikmuseumV272.json';
import {createTechnikmuseumV272,technikmuseumGeometryV272} from '../src/TechnikmuseumV272';
import {createTechnikmuseumColumnTesterV272,isTechnikmuseumSourceV272,technikmuseumContainsV272,technikmuseumRoofV272,technikmuseumSolidsV272} from '../src/TechnikmuseumV272Profile';
import {disposeSurroundingCityRoot} from '../src/SurroundingCity';
import {createDistantBuildingShells,createIsometricCityCore,type PrismPayload} from '../src/IsometricCityWorld';
import {createProgressiveBuildingCoverage} from '../src/progressiveBuildingCoverage';
import {compilePedestrianObstacles} from '../src/pedestrianNavigation';

const sourcePayload:PrismPayload=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));
const actual=sourcePayload.buildings;
const locomotiveTracks=['way/40985994','way/40985997','way/40985992','way/39093470','way/39093627','way/39093628'];

test('only the complete unchanged source selection retires exact exclusive native tuples',()=>{
 expect(actual.filter(isTechnikmuseumSourceV272)).toEqual(expect.arrayContaining(data.previousPrisms));
 expect(actual.filter(isTechnikmuseumSourceV272)).toHaveLength(3);
 expect(isTechnikmuseumSourceV272({id:'unrelated',get ring(){throw Error('Unrelated owner was inspected');}})).toBe(false);
 const tester=createTechnikmuseumColumnTesterV272(actual,data.cellM);
 for(const c of data.columns)expect(tester(...c as [number,number,number,number,number])).toBe(true);
 for(const c of data.retainedSharedColumns)expect(tester(...c as [number,number,number,number,number])).toBe(false);
 const c=data.columns[0] as [number,number,number,number,number];
 for(const prisms of [actual.filter((p:{id:string})=>p.id!==data.previousPrisms[0].id),[...actual,data.previousPrisms[0]],actual.map((p:{id:string,h_dm:number})=>p.id===data.previousPrisms[1].id?{...p,h_dm:p.h_dm+1}:p)])expect(createTechnikmuseumColumnTesterV272(prisms,data.cellM)(...c)).toBe(false);
 expect(createTechnikmuseumColumnTesterV272(actual,data.cellM+.1)(...c)).toBe(false);
 expect(tester(c[0],c[1],c[2],c[3]+1,c[4])).toBe(false);
 const x=c[0]*data.cellM*10,z=c[1]*data.cellM*10;
 expect(createTechnikmuseumColumnTesterV272([...actual,{id:'new-overlapping-owner',ring:[[x,z],[x+40,z],[x+40,z+40],[x,z+40]]}],data.cellM)(...c)).toBe(false);
});

test('all three complete source plans survive; native roof support equals the visible cardinal shell',()=>{
 const native=technikmuseumGeometryV272(true),solids=technikmuseumSolidsV272(true);
 expect(native.triangles).toHaveLength(0);
 expect(native.rows.every(r=>r.yaw===0&&r.s.every(s=>s>0)&&[...r.p,...r.s].every(Number.isFinite))).toBe(true);
 const roofs=native.rows.filter(r=>r.role==='native-source-plan-roof');
 expect(roofs.length).toBe(data.sites.reduce((sum,s)=>sum+s.nativeCells,0));
 for(const r of roofs){
  const [x,y,z]=r.p,solid=solids.find(s=>technikmuseumContainsV272(s.ring,x,z));
  expect(solid).toBeDefined();expect(solid!.topAt(x,z)).toBeCloseTo(y+r.s[1]/2,6);
 }
 for(const site of data.sites){
  const old=data.previousPrisms.find(p=>p.id===site.prism)!;
  expect(site.ring).toEqual(old.ring.map(([x,z])=>[x/10,z/10]));
  expect(technikmuseumRoofV272(site,-10000,-10000,true)).toBeNull();
 }
});

test('every locomotive is visible through the real inner-front glazing in drawn and native',()=>{
 for(const native of [false,true]){
  const root=createTechnikmuseumV272(native,{diagnostics:true});root.updateMatrixWorld(true);
  const model=technikmuseumGeometryV272(native);
  for(let li=0;li<locomotiveTracks.length;li++){
   const track=data.tracks.find(t=>t.id===locomotiveTracks[li])!,[a,b]=track.geometry.coordinates,l=Math.hypot(b[0]-a[0],b[1]-a[1]),x=a[0]+(b[0]-a[0])/l*5.7,z=a[1]+(b[1]-a[1])/l*5.7,site=data.sites[li<3?1:2];
   const start=new Vector3(site.centre![0],7.75,site.centre![1]);
   const hits=new Raycaster(start,new Vector3(x,7.75,z).sub(start).normalize(),0,70).intersectObjects(root.children,false);
   expect(hits.length).toBeGreaterThan(2);
   expect(((hits[0].object as Mesh).material as {transparent:boolean}).transparent).toBe(true);
   const hit=hits.find(h=>!((h.object as Mesh).material as {transparent:boolean}).transparent)!;
   expect(hit.instanceId).toBeDefined();
   expect(model.rows.filter(r=>!r.glass)[hit.instanceId!].role).toBe('locomotive-boiler');
  }
  expect(model.triangles.filter(t=>t.role.includes('roof')).every(t=>!t.glass)).toBe(true);
  disposeSurroundingCityRoot(root);
 }
});

test('full mobile architecture is identical and uses bounded reusable untextured batches',()=>{
 for(const native of [false,true]){
  const desktop=createTechnikmuseumV272(native),mobile=createTechnikmuseumV272(native,{mobileLike:true});
  expect(desktop.children.length).toBe(native?2:3);expect(mobile.children.length).toBe(desktop.children.length);
  let bytes=0;const matrix=new Matrix4();
  desktop.children.forEach((child,i)=>{
   const mesh=child as Mesh,peer=mobile.children[i] as Mesh;expect(mesh.matrixAutoUpdate).toBe(false);expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
   for(const [key,a] of Object.entries(mesh.geometry.attributes)){expect(a.array).toEqual(peer.geometry.getAttribute(key).array);bytes+=a.array.byteLength;}
   if(mesh instanceof InstancedMesh){const other=peer as InstancedMesh;expect(mesh.instanceMatrix.array).toEqual(other.instanceMatrix.array);expect(mesh.instanceColor!.array).toEqual(other.instanceColor!.array);bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;
    if(native)for(let j=0;j<mesh.count;j++){mesh.getMatrixAt(j,matrix);for(const at of [1,2,4,6,8,9])expect(matrix.elements[at]).toBe(0);}
   }
  });
  expect(bytes).toBeLessThan(native?3_000_000:2_600_000);
  expect(desktop.userData.fullStaticDetailOnTouch).toBe(true);
  expect(desktop.userData.roles['c47-rounded-fuselage']).toBe(21);
  expect(desktop.userData.roles['rotor-footing']).toBe(1);
  expect(desktop.userData.roles['locomotive-chimney']).toBe(6);
  expect(desktop.userData.records).toBeUndefined();
  let disposed=0;const geometries=new Set(desktop.children.map(m=>(m as Mesh).geometry));for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed++);
  disposeSurroundingCityRoot(desktop);expect(disposed).toBe(geometries.size);disposeSurroundingCityRoot(mobile);
 }
});

test('coverage and production navigation transfer only when the complete required-site flag is set',()=>{
 const source={...sourcePayload,buildings:actual.filter(isTechnikmuseumSourceV272)};
 const original=createDistantBuildingShells(source,source.buildings),transferred=createDistantBuildingShells(source,source.buildings,{technikmuseumV272:true});
 expect(original.userData.visibleBuildingCount).toBe(3);expect(transferred.userData.visibleBuildingCount).toBe(0);
 const partition={initial:[],omitted:source.buildings.slice(0,1),remaining:[source.buildings.slice(1)]};
 for(const enabled of [false,true]){
  const coverage=createProgressiveBuildingCoverage(source,partition,{technikmuseumV272:enabled});
  expect(coverage.children.map(c=>c.userData.visibleBuildingCount)).toEqual(enabled?[0,0]:[1,2]);
  disposeSurroundingCityRoot(coverage);
 }
 const oldCore=createIsometricCityCore(source,null,null,null,{includeContext:false}),newCore=createIsometricCityCore(source,null,null,null,{includeContext:false,technikmuseumV272:true});
 expect(oldCore.children.length).toBeGreaterThan(0);expect(newCore.children.length).toBe(0);
 const changed={...source,buildings:[{...source.buildings[0],h_dm:source.buildings[0].h_dm+1}]};
 const preserved=createDistantBuildingShells(changed,changed.buildings,{technikmuseumV272:true});expect(preserved.userData.visibleBuildingCount).toBe(1);
 let native=false;
 const oldNav=compilePedestrianObstacles(source),nav=compilePedestrianObstacles(source,()=>native?'minecraft':'day',{replaceTechnikmuseumPrisms:true});
 expect(oldNav.buildingCount).toBe(3);expect(nav.buildingCount).toBe(6);
 const obstacles=[...new Set([...nav.cells.values()].flat())].filter(o=>o.kind==='polygon');
 const roofs=technikmuseumGeometryV272(true).rows.filter(r=>r.role==='native-source-plan-roof');
 for(const mode of [false,true,false]){native=mode;for(const site of data.sites){
  const roof=roofs.find(r=>technikmuseumContainsV272(site.ring,r.p[0],r.p[2]))!;
  const expected=technikmuseumRoofV272(site,roof.p[0],roof.p[2],native);
  const active=obstacles.filter(o=>o.sourceId===site.prism).map(o=>o.topAt?.(roof.p[0],roof.p[2])).filter(y=>Number.isFinite(y));
  expect(active).toHaveLength(1);expect(active[0]).toBeCloseTo(expected!,6);
 }}
 for(const root of [original,transferred,oldCore,newCore,preserved])disposeSurroundingCityRoot(root);
});

test('all retained native museum-area columns, including45 shared tuples, leave every locomotive view clear',()=>{
 const voxel=JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json','utf8'));
 const retired=createTechnikmuseumColumnTesterV272(actual,voxel.cell_m),kept:number[][]=[];
 voxel.building_rows.forEach((runs:number[][],zi:number)=>{const iz=voxel.grid.min_z_idx+zi;if(iz*4<2200||iz*4>2500)return;
  for(const [off,n,lo,hi,k] of runs)for(let ix=voxel.grid.min_x_idx+off;ix<voxel.grid.min_x_idx+off+n;ix++)if(ix*4>180&&ix*4<470&&!retired(ix,iz,lo,hi,k))kept.push([ix,iz,lo,hi,k]);
 });
 expect(kept).toHaveLength(1216);
 const retainedKeys=new Set(kept.map(c=>c.join('/')));for(const c of data.retainedSharedColumns)expect(retainedKeys.has(c.join('/'))).toBe(true);
 for(let li=0;li<locomotiveTracks.length;li++){
  const [a,b]=data.tracks.find(t=>t.id===locomotiveTracks[li])!.geometry.coordinates,l=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const target=new Vector3(a[0]+(b[0]-a[0])/l*5.7,7.75,a[1]+(b[1]-a[1])/l*5.7),site=data.sites[li<3?1:2],start=new Vector3(site.centre![0],7.75,site.centre![1]),ray=new Ray(start,target.clone().sub(start).normalize());
  for(const c of kept){const hit=ray.intersectBox(new Box3(new Vector3(c[0]*4,c[2]/10,c[1]*4),new Vector3((c[0]+1)*4,c[3]/10,(c[1]+1)*4)),new Vector3());if(hit)expect(hit.distanceTo(start)).toBeGreaterThan(target.distanceTo(start));}
 }
});
