import overridesV148 from "./fixtures/museums-v148-overrides.json";
import {describe,expect,test} from 'bun:test';
import {Box3,BoxGeometry,Color,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createJamesSimonArchitecture} from '../src/JamesSimonArchitecture';
import {JAMES_SIMON_SOURCE as S,JAMES_SIMON_PROFILE,JAMES_SIMON_LOW_POSTS,jamesSimonWorld,jamesSimonLocal,jamesSimonRoofAt,jamesSimonWalkSurfaceAt,jamesSimonStairTopAt,jamesSimonTerraceVoidAt,jamesSimonExtraSolidAt,isJamesSimonReplacementColumn} from '../src/jamesSimonProfile';
import {createDomAltesMuseum} from '../src/DomAltesMuseum';
import {GRANITE_BOWL_PROFILE as B} from '../src/domAltesMuseumProfile';
import {createMuseumTriadArchitecture} from '../src/MuseumTriadArchitecture';
import {createSpreeMuseumDetails} from '../src/SpreeMuseumDetails';
import {createMinecraftSpreeMuseumDetails} from '../src/MinecraftSpreeMuseumDetails';
import {MUSEUMS_V147_BUDGETS} from '../src/museumsV147Profile';
import {restoreJamesSimonGroundOwnership} from '../src/JamesSimonGroundOwnership';
import ownership from '../src/data/jamesSimonTerrainBoundary.json';
import type {VoxelPayload} from '../src/MinecraftVoxelWorld';
import {compilePedestrianObstacles,createPedestrianState,pedestrianPointIsBlocked} from '../src/pedestrianNavigation';
import prisms from '../public/mesh/regierungsviertel/lod2-prisms.json';
function budget(root:Group){let bytes=0,draws=0,instances=0,vertices=0;const seen=new Set();root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBe(false);expect(o.geometry.getAttribute('uv')).toBeUndefined();expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();const n=o instanceof InstancedMesh?o.count:1;vertices+=o.geometry.getAttribute('position').count*n;if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();}bytes+=o.geometry.index?.array.byteLength??0;}if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});return {bytes,draws,instances,vertices};}
describe('museum source-preserving refinement v1.0.47',()=>{
 test('James-Simon retains all eight original parts and superseded OSM source',()=>{
  expect(S.parts).toHaveLength(8);expect(S.parent_id).toBe('DEBE01AL3jA00008');expect(S.source_created).toBe('2026-03-02');expect(S.source_sha256).toMatch(/^[a-f0-9]{64}$/);expect(S.previous_display_prism).toEqual(prisms.buildings.find(p=>p.id==='94422265'));
  expect(Math.max(...S.parts.map(p=>p.top_y_m))).toBe(26.661);const root=createJamesSimonArchitecture(),mesh=root.children[0] as Mesh;expect(mesh.userData.sourcePartIds).toEqual(S.parts.map(p=>p.id));expect(new Box3().setFromObject(root).max.y).toBeCloseTo(26.661,3);
  const ring=S.parts.find(p=>p.id==='DEBE3DetH0pbh00c')!.ring;expect(ring).toHaveLength(19);
 });
 test('upper colonnade is visibly open through to recessed glass and physically traversable',()=>{
  const root=createJamesSimonArchitecture();root.updateMatrixWorld(true);const p=jamesSimonWorld(55.6,14,3),q=jamesSimonWorld(55.6,14,-10),dir=new Vector3(...q).sub(new Vector3(...p)).normalize();const hit=new Raycaster(new Vector3(...p),dir).intersectObject(root,true)[0];expect(hit).toBeDefined();expect(hit.distance).toBeGreaterThan(7.8);expect(hit.distance).toBeLessThan(8.6);
  const gap=jamesSimonWorld(55.6,14,-2);expect(jamesSimonTerraceVoidAt(...gap,'DEBE3DetH0pbh00c')).toBeTrue();expect(jamesSimonExtraSolidAt(...gap)).toBeFalse();const column=jamesSimonWorld(54.4,14,0);expect(jamesSimonExtraSolidAt(...column)).toBeTrue();expect(jamesSimonWalkSurfaceAt(gap[0],gap[2],10.41)).toBe(10.41);expect(jamesSimonTerraceVoidAt(...gap,'unrelated')).toBeFalse();
 });
 test('low colonnade roofs retain source height above open post intervals',()=>{
  const p=S.parts.find(p=>p.id==='DEBE3DdiH2RPygTn')!;const x=p.ring.reduce((n,v)=>n+v[0],0)/p.ring.length,z=p.ring.reduce((n,v)=>n+v[1],0)/p.ring.length;
  expect(jamesSimonTerraceVoidAt(x,8,z,p.id)).toBeTrue();const post=JAMES_SIMON_LOW_POSTS.find(s=>s.partId===p.id)!;expect(jamesSimonExtraSolidAt(post.x,8,post.z)).toBeTrue();expect(jamesSimonRoofAt(x,z,p.id)).toBeCloseTo(p.top_y_m,1);
  expect(isJamesSimonReplacementColumn(1740,-80)).toBeTrue();expect(isJamesSimonReplacementColumn(1740,-80,40)).toBeFalse();expect(isJamesSimonReplacementColumn(1680,-80)).toBeFalse();expect(isJamesSimonReplacementColumn(1800,-100)).toBeFalse();
 });
 test('all three stair flights are exposed above the cut source plinth in smooth and native forms',()=>{
  for(const minecraft of[false,true]){const root=createJamesSimonArchitecture({minecraft});root.updateMatrixWorld(true);for(const u of[40,55,70]){const p=jamesSimonWorld(u,30,2.95),top=jamesSimonStairTopAt(u,2.95)!;const hit=new Raycaster(new Vector3(...p),new Vector3(0,-1,0)).intersectObject(root,true)[0];expect(hit.point.y).toBeCloseTo(top,2);expect(jamesSimonWalkSurfaceAt(p[0],p[2],top)).toBeCloseTo(top,4);expect(jamesSimonTerraceVoidAt(p[0],top,p[2],'DEBE3DuquIO5LuiT')).toBeTrue();}}
 });
 test('the complete navigation index admits the entire capsule at every stair flight and upper landing',()=>{
  const obstacles=compilePedestrianObstacles(prisms),access={walkableInteriorAt:jamesSimonTerraceVoidAt,interiorSolidAt:jamesSimonExtraSolidAt};
  const environment={...access,obstacles,interiorGroundAt:jamesSimonWalkSurfaceAt,groundAt:()=>5.2,water:[],bounds:{minX:1600,maxX:1850,minZ:-200,maxZ:50}};
  for(const u of[70,55,40,38,36,34,32,30,28.2]){const [x,,z]=jamesSimonWorld(u,0,2.95),feet=jamesSimonStairTopAt(u,2.95)!;expect(pedestrianPointIsBlocked(x,z,feet,obstacles,access)).toBeFalse();const state=createPedestrianState(environment,{x,z,yaw:0,groundYHint:feet,preserveHorizontalPosition:true});expect(state.groundY).toBeCloseTo(feet,4);expect(state.x).toBeCloseTo(x,4);expect(state.z).toBeCloseTo(z,4);}
 });
 test('terrain ownership has a complete floor and solid staircase foundation behind it',()=>{
  for(const minecraft of[false,true]){const root=createJamesSimonArchitecture({minecraft});root.updateMatrixWorld(true);
   const floor=new Raycaster(new Vector3(1741.2792,12,-66.23454),new Vector3(0,-1,0)).intersectObject(root,true)[0];expect(floor.point.y).toBeCloseTo(10.41,2);
   const p=jamesSimonWorld(61.8,3,6),q=jamesSimonWorld(61.8,3,0);const side=new Raycaster(new Vector3(...p),new Vector3(...q).sub(new Vector3(...p)).normalize()).intersectObject(root,true)[0];expect(side.distance).toBeCloseTo(.45,2);
  }
 });
 test('native plinth half-block depth covers preserved exterior land on the short and tapered source face',()=>{
  const root=createJamesSimonArchitecture({minecraft:true});root.updateMatrixWorld(true);
  for(const [x,y,z]of[[1697.151343,3.774167,-97.54887],[1700.90455,3.615949,-93.01878],[1704.378528,3.838796,-88.87458],[1708,3.69877,-84.751081]]){const [u,v]=jamesSimonLocal(x,z),from=jamesSimonWorld(u,y,10),to=jamesSimonWorld(u,y,0),hit=new Raycaster(new Vector3(...from),new Vector3(...to).sub(new Vector3(...from)).normalize()).intersectObject(root,true)[0];expect(jamesSimonLocal(hit.point.x,hit.point.z)[1]).toBeGreaterThan(v+.04);}
  for(const [u,sourceV]of[[37,6.7992985786],[43,5.7930680255]]){const from=jamesSimonWorld(u,3.6,10),to=jamesSimonWorld(u,3.6,0),hit=new Raycaster(new Vector3(...from),new Vector3(...to).sub(new Vector3(...from)).normalize()).intersectObject(root,true)[0];expect(jamesSimonLocal(hit.point.x,hit.point.z)[1]).toBeGreaterThan(sourceV+.45);}
 });
 test('ground clipping removes only owned cells and keeps outside run height and paint',()=>{
  const slab=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),29),matrix=new Matrix4(),paint=new Color(.2,.4,.1);
  for(let i=0;i<29;i++){matrix.makeScale(120,3,4);matrix.setPosition(1732,3.7,-138+i*4);slab.setMatrixAt(i,matrix);slab.setColorAt(i,paint);}
  restoreJamesSimonGroundOwnership(slab,{cell_m:4,grid:ownership.grid} as VoxelPayload);slab.updateMatrixWorld(true);
  expect(slab.userData.jamesSimonOwnedFoundationCells).toBeGreaterThan(0);expect(slab.children).toHaveLength(1);
  expect(new Raycaster(new Vector3(1741.2792,30,-66.23454),new Vector3(0,-1,0)).intersectObject(slab,true)).toHaveLength(0);
  const kept=new Raycaster(new Vector3(1680,30,-80),new Vector3(0,-1,0)).intersectObject(slab,true)[0];expect(kept.point.y).toBeCloseTo(5.2,5);slab.getColorAt(kept.instanceId!,paint);expect(paint.toArray()).toEqual([expect.closeTo(.2,6),expect.closeTo(.4,6),expect.closeTo(.1,6)]);
 });
 test('bowl keeps its exact OSM anchor, open cavity and rounded polished red-granite lip',()=>{
  const root=createDomAltesMuseum(),bowl=root.getObjectByName('Granitschale hollow polished red-granite basin') as Mesh;root.updateMatrixWorld(true);expect([bowl.position.x,bowl.position.z]).toEqual([...B.centre]);const box=new Box3().setFromObject(bowl);expect(box.max.x-box.min.x).toBeCloseTo(6.9,3);expect(box.max.y).toBeCloseTo(7.47,3);expect(bowl.geometry.getAttribute('color')).toBeDefined();expect((bowl.userData.nightMaterial as MeshStandardMaterial).roughness).toBe(.24);const hit=new Raycaster(new Vector3(B.centre[0],10,B.centre[1]),new Vector3(0,-1,0)).intersectObject(bowl)[0];expect(hit.point.y).toBeCloseTo(6.39,2);
 });
 test('v147 budgets stay frozen with explicit owner-requested v148 Altes overrides',()=>{
  expect(MUSEUMS_V147_BUDGETS.current.dom).toEqual({bytes:876008,draws:14,instances:6830,vertices:230336});
  expect(MUSEUMS_V147_BUDGETS.current.domMC).toEqual({bytes:1210720,draws:1,instances:15922,vertices:382128});
  const rows={dom:createDomAltesMuseum(),domMC:createDomAltesMuseum({minecraft:true}),triad:createMuseumTriadArchitecture(),triadMC:createMuseumTriadArchitecture({minecraft:true}),spree:createSpreeMuseumDetails(),spreeMC:createMinecraftSpreeMuseumDetails(),james:createJamesSimonArchitecture(),jamesMC:createJamesSimonArchitecture({minecraft:true})};
  for(const [name,root] of Object.entries(rows))expect(budget(root)).toEqual(overridesV148[name as keyof typeof overridesV148] ?? MUSEUMS_V147_BUDGETS.current[name as keyof typeof rows]);
  expect(budget(createJamesSimonArchitecture({mobileLike:true}))).toEqual(budget(rows.james));expect(budget(createDomAltesMuseum({mobileLike:true}))).toEqual(budget(rows.dom));expect(budget(createMuseumTriadArchitecture({mobileLike:true}))).toEqual(budget(rows.triad));
  const native=createJamesSimonArchitecture({minecraft:true,mobileLike:true});expect(native.children).toHaveLength(1);expect(native.children[0]).toBeInstanceOf(InstancedMesh);expect((native.children[0] as InstancedMesh).count).toBeLessThan(2200);expect(JAMES_SIMON_PROFILE.catalogueAddition).toBeFalse();
 });
});
