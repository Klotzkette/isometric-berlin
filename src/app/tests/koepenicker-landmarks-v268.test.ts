import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import data from '../src/data/koepenickerLandmarksV268.json';
import {prepareKoepenickerLandmarksV268,applyKoepenickerLandmarksV268Triangles,applyKoepenickerLandmarksV268Lines,koepenickerLandmarksNavigationV268,KOEPENICKER_LANDMARKS_V268_KIND} from '../src/KoepenickerLandmarksV268';
import {createSurroundingCityChunk,surroundingBuildingSolidAt,surroundingPolygonContains,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {createPedestrianEnvironment,createPedestrianState,stepPedestrian,PEDESTRIAN_WALK_SPEED_MPS,type PedestrianExtension} from '../src/pedestrianNavigation';
import {terrainGroundAt} from '../src/weinbergTerrainV176';
import {Mesh,LineSegments,type Material} from 'three';
const complete=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const load=(native:boolean)=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/8_3.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
const decoded=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;

test('complete replacement is atomic, source guarded, idempotent and complement-preserving',()=>{
 for(const native of [false,true]){
  const raw=load(native),extra={...data.packets['drawn:8_3'].replacement,kind:'earlier-test-detail'},before={...raw,meshes:[...raw.meshes,extra]};
  const prepared=complete(prepareKoepenickerLandmarksV268(before,'8_3',native));
  expect(prepared).not.toBe(before);expect(prepared.meshes.slice(0,-1)).toEqual(before.meshes);expect(prepared.lines).toBe(before.lines);expect(prepared.nav).toBe(before.nav);
  expect(prepared.meshes.at(-1)!.kind).toBe(KOEPENICKER_LANDMARKS_V268_KIND);expect(complete(prepareKoepenickerLandmarksV268(prepared,'8_3',native))).toBe(prepared);
  expect(complete(prepareKoepenickerLandmarksV268(raw,'7_3',native))).toBe(raw);
  const changed={...raw,nav:{...raw.nav,groundY:raw.nav.groundY+.1}};expect(complete(prepareKoepenickerLandmarksV268(changed,'8_3',native))).toBe(changed);
  const damaged={...raw,meshes:raw.meshes.map((p,i)=>i===0?{...p,colors:p.colors+'A'}:p)};expect(complete(prepareKoepenickerLandmarksV268(damaged,'8_3',native))).toBe(damaged);
  const key=native?'minecraft:8_3':'drawn:8_3',r=data.packets[key],corrupt={...data,packets:{...data.packets,[key]:{...r,replacement:{...r.replacement,colors:r.replacement.colors+'A'}}}};
  expect(complete(prepareKoepenickerLandmarksV268(raw,'8_3',native,corrupt))).toBe(raw);
  const nav=koepenickerLandmarksNavigationV268(prepared,raw.nav);expect(nav.buildings.filter(b=>b.sourceId!==data.profile.owner)).toEqual(raw.nav.buildings.filter(b=>b.sourceId!==data.profile.owner));expect(nav.ground).toBe(raw.nav.ground);expect(nav.roads).toBe(raw.nav.roads);expect(nav.water).toBe(raw.nav.water);
  let total=0;
  for(const [i,p] of raw.meshes.entries()){
   const original=new Uint32Array(decoded(p.indices)),indices=original.slice();expect(complete(applyKoepenickerLandmarksV268Triangles(raw,i,indices,0))).toBe(0);total+=complete(applyKoepenickerLandmarksV268Triangles(prepared,i,indices,0));
   const chosen=new Set(r.records.filter(r=>r.mesh===i).flatMap(r=>r.triangles));expect(indices.every((v,j)=>chosen.has(Math.floor(j/3))?v===original[Math.floor(j/3)*3]:v===original[j])).toBe(true);
  }expect(total).toBe(native?514:184);
  if(raw.lines){const original=new Uint16Array(decoded(raw.lines.positions)),values=original.slice();expect(complete(applyKoepenickerLandmarksV268Lines(raw,values,3))).toBe(0);expect(complete(applyKoepenickerLandmarksV268Lines(prepared,values,3))).toBe(r.segments.length);const chosen=new Set(r.segments);expect(values.every((v,i)=>chosen.has(Math.floor(i/6))?v===original[Math.floor(i/6)*6+i%3]:v===original[i])).toBe(true);}
 }
});

test('real tile mode changes keep the street walk free and lower roof collision source-faithful',()=>{
 const packets=[load(false),load(true)],navs=packets.map((p,i)=>koepenickerLandmarksNavigationV268(complete(prepareKoepenickerLandmarksV268(p,'8_3',i===1)),p.nav));let native=false;const active=()=>({p:packets[native?1:0],nav:navs[native?1:0]});
 const extension:PedestrianExtension={bounds:{minX:4096,maxX:4608,minZ:1536,maxZ:2048},groundAt:(x,z)=>{const {p,nav}=active(),lx=x-p.origin[0],lz=z-p.origin[2];return nav.ground.some(g=>surroundingPolygonContains(g,lx,lz))?terrainGroundAt(x,z,nav.groundY,native)+(nav.roads?.some(g=>surroundingPolygonContains(g,lx,lz))?.09:0):null;},solidAt:(x,y,z,r=0)=>{const {p,nav}=active();return surroundingBuildingSolidAt(nav,x-p.origin[0],y,z-p.origin[2],r);},waterAt:(x,z)=>{const {p,nav}=active();return nav.water.some(g=>surroundingPolygonContains(g,x-p.origin[0],z-p.origin[2]));}};
 const ground=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/ground-context.json',import.meta.url),'utf8')),env=createPedestrianEnvironment(ground,{water:[]},null,{buildings:[]},extension);env.visualMode=()=>native?'minecraft':'day';
 const start=[4224,1668],end=[4252,1688],dx=end[0]-start[0],dz=end[1]-start[1],distance=Math.hypot(dx,dz),frames=80;
 for(const mode of [false,true,false]){
  native=mode;const floor=env.groundAt(...start as [number,number])!;expect(floor).toBeGreaterThanOrEqual(3);expect(floor).toBeLessThanOrEqual(3.1);
  let state=createPedestrianState(env,{x:start[0],z:start[1],yaw:Math.atan2(dx,-dz),groundYHint:floor,preserveHorizontalPosition:true}),respawn=false,jump=false,maxStep=0;
  for(let i=0;i<frames;i++){const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},distance/(frames*PEDESTRIAN_WALK_SPEED_MPS),env);maxStep=Math.max(maxStep,Math.abs(result.state.groundY-state.groundY));respawn||=result.respawned;jump||=result.state.jumpOffset!==0;state=result.state;}
  expect(respawn).toBe(false);expect(jump).toBe(false);expect(maxStep).toBeLessThan(.11);expect(state.x).toBeCloseTo(end[0],4);expect(state.z).toBeCloseTo(end[1],4);
  const {p,nav}=active();expect(surroundingBuildingSolidAt(p.nav,4230-p.origin[0],18,1640-p.origin[2])).toBe(true);expect(surroundingBuildingSolidAt(nav,4230-p.origin[0],18,1640-p.origin[2])).toBe(false);expect(surroundingBuildingSolidAt(nav,4230-p.origin[0],17,1640-p.origin[2])).toBe(true);
 }
});

test('production decoder retains earlier layers and publishes bounded complete model',()=>{
 for(const native of [false,true]){
  const raw=load(native),source=JSON.stringify(raw),result=createSurroundingCityChunk(raw,'8_3',native);
  expect(result.root.userData.sourceKinds).toContain(KOEPENICKER_LANDMARKS_V268_KIND);expect(result.root.userData.koepenickerLandmarksTransferredTrianglesV268).toBe(native?514:184);expect(result.nav.buildings.filter(b=>b.sourceId===data.profile.owner).length).toBe(data.packets[native?'minecraft:8_3':'drawn:8_3'].buildings.length);
  expect(JSON.stringify(raw)).toBe(source);expect(result.geometryBytes).toBeLessThan(12*1024*1024);
  const materials=new Set<Material>();result.root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(m)materials.add(m);}});for(const m of materials)m.dispose();
 }
});
