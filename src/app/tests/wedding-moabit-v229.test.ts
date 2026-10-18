import {readFileSync} from 'node:fs';
import {describe,test,expect} from 'bun:test';
import {Box3,Group,InstancedMesh,Matrix4,Raycaster,Vector3} from 'three';
import {createWeddingMoabitV229} from '../src/WeddingMoabitV229';
import {applyWeddingStationHeightV229,weddingStairsV229,weddingStationFloorAtV229,weddingMoabitSourceV229,weddingMoabitGroundV229} from '../src/weddingMoabitV229Profile';
import {createRailStationsV190} from '../src/RailStationsV190';
function dispose(root:Group){root.traverse((o:any)=>{o.geometry?.dispose();for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial])m?.dispose?.();});}
describe('bounded Wedding/Moabit v229',()=>{
 test('only exact Wedding owner is rigidly lifted, idempotently',()=>{
  const root=new Group(),other=new Group(),hall=new Group();other.userData={stationName:'Wedding'};hall.userData={stationName:'Wedding',anchorOsmId:'node/614445865',platformIds:['relation/5559039']};root.add(other,hall);applyWeddingStationHeightV229(root);applyWeddingStationHeightV229(root);expect(hall.position.y).toBe(6.5);expect(other.position.y).toBe(0);expect(root.position.y).toBe(0);
 });
 for(const native of [false,true])test(`actual construction, finite culling and stairs ${native}`,()=>{
  const root=createWeddingMoabitV229(native);root.updateMatrixWorld(true);let bytes=0,count=0;
  root.traverse(o=>{if(o instanceof InstancedMesh){count+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);expect(o.userData.fullStaticDetailOnTouch).toBe(true);expect(o.boundingSphere!.radius).toBeLessThan(170);for(const x of o.instanceMatrix.array)expect(Number.isFinite(x)).toBe(true);if(native){const m=new Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);for(const k of [1,2,4,6,8,9])expect(m.elements[k]).toBe(0);}}}});
  expect(bytes).toBeLessThan(native?1_600_000:400_000);expect(count).toBeGreaterThan(500);
  const stairs=root.children.find(o=>o.name.startsWith('Wedding:'))!;const ray=new Raycaster();
  for(const s of weddingStairsV229())for(let i=0;i<s.steps;i++){const t=(i+.5)/s.steps,x=s.a[0]+(s.b[0]-s.a[0])*t,z=s.a[1]+(s.b[1]-s.a[1])*t,y=s.low+(i+1)*(s.high-s.low)/s.steps;ray.set(new Vector3(x,y+.4,z),new Vector3(0,-1,0));const hits=ray.intersectObject(stairs,true);expect(hits.length).toBeGreaterThan(0);expect(Math.abs(hits[0].point.y-y)).toBeLessThan(.025);expect(weddingStationFloorAtV229(x,z,y,native)).toBeCloseTo(y,4);}
  expect(weddingStationFloorAtV229(-192,-2698,5.2,native)).toBeNull();expect(weddingStationFloorAtV229(-192,-2698,10.46,native)).toBe(10.46);
  console.log({native,bytes,count,calls:root.children.length});dispose(root);
 });
 test('source identities and terrain finite at every pitch',()=>{const s=weddingMoabitSourceV229();expect(s.pitches.length).toBe(14);expect(s.square.id).toBe('relation/4717544');for(const p of s.pitches)for(const [x,z]of p.ring){expect(Number.isFinite(weddingMoabitGroundV229(x,z))).toBe(true);expect(Number.isFinite(weddingMoabitGroundV229(x,z,true))).toBe(true);}expect(s.stationCorrection.oldDatasetSha256['railStationsV190.json'].length).toBe(64);});
 test('the shipped rail constructor invokes the exact transform',()=>{const root=createRailStationsV190(false);const hall=root.children.find(o=>o.userData.stationName==='Wedding')!;expect(hall.position.y).toBe(6.5);expect(hall.userData.weddingHeightV229).toBe(true);for(const o of root.children)if(o!==hall)expect(o.position.y).toBe(0);const box=new Box3().setFromObject(hall);expect(box.min.y).toBeGreaterThan(10);dispose(root);});
});
// This uses actual delivered lawns/ground, not merely a second analytic sampler.
import ground from '../public/mesh/regierungsviertel/ground-context.json';
import surfaces from '../public/mesh/regierungsviertel/surface-polygons.json';
import {createSmoothSurfaces,type SurfacePayload} from '../src/IsometricCityWorld';
import {createGroundSlabs,smoothGroundTopSampler,CLASS_SHADES,type VoxelPayload} from '../src/terrainPayload';
for(const native of [false,true])test(`field paint clears delivered Poststadion terrain ${native}`,()=>{
 const payload=ground as VoxelPayload,sample=smoothGroundTopSampler(payload),cell=payload.cell_m;
 const terrain=(x:number,z:number)=>sample(x/cell-payload.grid.min_x_idx,z/cell-payload.grid.min_z_idx);
 const old=native?createGroundSlabs({...payload,ground_rows:payload.ground_rows.map((row,iz)=>{
  const z=(payload.grid.min_z_idx+iz)*cell;if(z< -1540||z> -1000)return[];
  const left=Math.floor(-1080/cell)-payload.grid.min_x_idx,right=Math.ceil(-560/cell)-payload.grid.min_x_idx;
  return row.map(([x,n,c])=>[Math.max(x,left),Math.min(x+n,right)-Math.max(x,left),c]as[number,number,number]).filter(r=>r[1]>0);
 })},'bounded actual Poststadion ground',CLASS_SHADES,{parkRelief:'native'}):createSmoothSurfaces({...surfaces,parks:surfaces.parks.filter(p=>p.name==='SportPark Poststadion'||p.name==='Fritz-Schloß-Park'),roads:[],water:[],scrub_points:[],lane_markings:[],sunken_walls:[]}as SurfacePayload,-1.15,4.2,terrain);
 const root=createWeddingMoabitV229(native);old.updateMatrixWorld(true);root.updateMatrixWorld(true);let hits=0,min=Infinity;
 for(const p of weddingMoabitSourceV229().pitches){const[x,z,ux,uz,length,width]=p.frame;const mesh=root.children.find(o=>o.name.includes(p.id))!;
  for(const sign of [-1,1])for(let i=1;i<8;i++){const u=(i/8-.5)*(length-3.2),v=sign*(width/2-1.6),px=x+ux*u-uz*v,pz=z+uz*u+ux*v;const ray=new Raycaster(new Vector3(px,80,pz),new Vector3(0,-1,0)),a=ray.intersectObject(mesh,true),b=ray.intersectObject(old,true);if(!a.length||!b.length)continue;hits++;min=Math.min(min,a[0].point.y-b[0].point.y);}
 }
 console.log({native,groundPaintSamples:hits,minClearance:min});expect(hits).toBeGreaterThan(150);expect(min).toBeGreaterThan(-.005);dispose(root);dispose(old);
},20000);

for (const native of [false,true]) test(`eastern mapped level-1 landing joins stairs to platform ${native}`,()=>{
 const s=weddingStairsV229().find(s=>s.id==='way/363581647')!;
 expect(s.low).toBe(10.46); expect(s.high).toBe(10.46);
 for(let i=0;i<=40;i++){const u=i/40,x=s.a[0]*(1-u)+s.b[0]*u,z=s.a[1]*(1-u)+s.b[1]*u;
  expect(weddingStationFloorAtV229(x,z,10.46,native)).toBeCloseTo(10.46,6);
  expect(weddingStationFloorAtV229(x,z,5.2,native)).toBeNull();
 }
});

import {compilePedestrianObstacles,createPedestrianState,stepPedestrian,type PedestrianEnvironment} from '../src/pedestrianNavigation';
import {weddingStationSolidAtV229,isWeddingRoofCoreV229} from '../src/weddingMoabitV229Profile';
for(const native of [false,true])test(`actual movement crosses retained core roof owner and all Wedding accesses ${native}`,()=>{
 const original=weddingMoabitSourceV229().stationCorrection.previousCoreRoof;
 expect(isWeddingRoofCoreV229(original)).toBe(true);expect(isWeddingRoofCoreV229({...original,h_dm:31})).toBe(false);
 const completeCore=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8'));
 const obstacles=compilePedestrianObstacles(completeCore);
 expect(weddingMoabitSourceV229().stationCorrection.previousCoreRoofs.every(isWeddingRoofCoreV229)).toBe(true);
 const e:PedestrianEnvironment={bounds:{minX:-1000,maxX:1000,minZ:-4000,maxZ:0},groundAt:()=>5.2,water:[],obstacles,visualMode:()=>native?'minecraft':'day',
  interiorGroundAt:(x,z,feet)=>weddingStationFloorAtV229(x,z,feet??5.2,native),interiorSolidAt:(x,y,z,radius)=>weddingStationSolidAtV229(x,y,z,radius,native)};
 const lookup=(id:string)=>weddingStairsV229().find(s=>s.id==='way/'+id)!;
 for(const name of ['central','east']){
  const c=lookup('437595043'),u=lookup('242094102'),a=lookup('47908978'),b=lookup('437595046'),d=lookup('437595034'),l=lookup('363581647');
  const points=name==='central'?[c.a,c.b,u.a,u.b]:[a.a,a.b,b.a,b.b,d.a,d.b,l.a];
  const extend=(a:number[],b:number[],n:number)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return [b[0]+(b[0]-a[0])*n/length,b[1]+(b[1]-a[1])*n/length]};
  points.unshift(extend(points[1],points[0],.45));points.push(extend(points.at(-2)!,points.at(-1)!,name==='central'?.7:1));
  let state=createPedestrianState(e,{x:points[0][0],z:points[0][1],yaw:0,groundYHint:5.2});
  const travel=(waypoints:number[][])=>{for(const point of waypoints){let frames=0;while(Math.hypot(state.x-point[0],state.z-point[1])>.20&&frames++<1000){state.yaw=Math.atan2(point[0]-state.x,-(point[1]-state.z));const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},.02,e);expect(result.respawned).toBe(false);state=result.state;}if(frames>=1000)console.log({native,name,point,state});expect(frames).toBeLessThan(1000);}};
  travel(points.slice(1));expect(state.groundY).toBeCloseTo(10.46,4);travel(points.slice(0,-1).reverse());expect(state.groundY).toBeCloseTo(5.2,4);
 }
 for(const route of [[[-70.433,-2799.244],[-69.727,-2782.181],[-69.4,-2764.4]],[[-195.4,-2702.92],[-188.6,-2693.08]]]){
  let state=createPedestrianState(e,{x:route[0][0],z:route[0][1],yaw:0,groundYHint:5.2});
  for(const point of route.slice(1)){let frames=0;while(Math.hypot(state.x-point[0],state.z-point[1])>.20&&frames++<1000){state.yaw=Math.atan2(point[0]-state.x,-(point[1]-state.z));state=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},.02,e).state;expect(state.groundY).toBeCloseTo(5.2,4);}expect(frames).toBeLessThan(1000);}
 }
 expect(weddingStationSolidAtV229(-227.10675,7,-2673.90706,0,native)).toBe(false);
});

for(const native of [false,true])test(`Wedding represented canopy and platform have matching thin solids ${native}`,()=>{
 const root=createWeddingMoabitV229(native);root.updateMatrixWorld(true);const canopy=root.children.find(o=>o.name==='Wedding source-bound elevated canopy v229')!;
 const ray=new Raycaster(new Vector3(-236,16,-2668),new Vector3(0,-1,0));const hit=ray.intersectObject(canopy,true)[0];expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(14.96,4);
 expect(weddingStationSolidAtV229(-236,14.9,-2668,0,native)).toBe(true);expect(weddingStationSolidAtV229(-236,7,-2668,0,native)).toBe(false);
 expect(weddingStationFloorAtV229(-236,-2668,5.2,native)).not.toBe(14.96);dispose(root);
});

for(const native of [false,true])test(`source access canopy clears every eastern stair tread ${native}`,()=>{
 const root=createWeddingMoabitV229(native);root.updateMatrixWorld(true);const roofs=root.children.filter(o=>o.name==='Wedding source-bound elevated canopy v229');let count=0;
 for(const s of weddingStairsV229().filter(s=>s.a[0]>-150))for(let i=0;i<s.steps;i++){const u=(i+.5)/s.steps,x=s.a[0]*(1-u)+s.b[0]*u,z=s.a[1]*(1-u)+s.b[1]*u,feet=s.low+(i+1)*(s.high-s.low)/s.steps;
  const ray=new Raycaster(new Vector3(x,feet+1.8,z),new Vector3(0,1,0));const hit=ray.intersectObjects(roofs,true)[0];
  if(hit){count++;expect(hit.point.y-feet).toBeGreaterThan(2.0);}
  expect(weddingStationSolidAtV229(x,feet+1.8,z,.25,native)).toBe(false);
 }expect(count).toBeGreaterThan(35);dispose(root);
});

for(const native of [false,true])test(`Wedding mapped endpoints and 16-100ms movement retain stair support ${native}`,()=>{
 // Actual browser landing coordinate: a sub-picometre projection outside the
 // segment must not lose the already represented landing to street level.
 expect(weddingStationFloorAtV229(-98.499,-2762.6669999999995,10.46,native)).toBe(10.46);
 const core=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8'));
 const obstacles=compilePedestrianObstacles(core),s=(id:string)=>weddingStairsV229().find(s=>s.id==='way/'+id)!;
 const e:PedestrianEnvironment={bounds:{minX:-1000,maxX:1000,minZ:-4000,maxZ:0},groundAt:()=>5.2,water:[],obstacles,visualMode:()=>native?'minecraft':'day',
  interiorGroundAt:(x,z,feet)=>weddingStationFloorAtV229(x,z,feet??5.2,native),interiorSolidAt:(x,y,z,r)=>weddingStationSolidAtV229(x,y,z,r,native)};
 const extend=(a:number[],b:number[],n:number)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return[b[0]+(b[0]-a[0])*n/l,b[1]+(b[1]-a[1])*n/l]};
 for(const dt of [.016,.033,.05,.1])for(const name of ['central','eastern']){
  const a=s('47908978'),b=s('437595046'),c=s('437595034'),l=s('363581647'),d=s('437595043'),u=s('242094102');
  const points=name==='central'?[d.a,d.b,u.a,u.b]:[a.a,a.b,b.a,b.b,c.a,c.b,l.a];
  points.unshift(extend(points[1],points[0],.45));points.push(extend(points.at(-2)!,points.at(-1)!,.7));
  let state=createPedestrianState(e,{x:points[0][0],z:points[0][1],yaw:0,groundYHint:5.2});
  const travel=(route:number[][])=>{for(const p of route){let frames=0,steeringAge=.03;
   while(Math.hypot(state.x-p[0],state.z-p[1])>.01&&frames++<1000){
    const distance=Math.hypot(state.x-p[0],state.z-p[1]);
    // Same 30ms steering cadence as the browser probe. Analog slowdown at
    // the last frame prevents the test controller itself overshooting a stop.
    if(steeringAge>=.03){state.yaw=Math.atan2(p[0]-state.x,-(p[1]-state.z));steeringAge=0;}steeringAge+=dt;
    const previous=state;const result=stepPedestrian(state,{forward:Math.min(1,distance/(13*dt)),strafe:0,turn:0,look:0,sprint:false},dt,e);state=result.state;
    expect(result.respawned).toBe(false);expect(previous.groundY-state.groundY).toBeLessThan(.8);
   }expect(frames).toBeLessThan(1000);
  }};
  travel(points.slice(1));expect(state.groundY).toBeCloseTo(10.46,5);
  travel(points.slice(0,-1).reverse());expect(state.groundY).toBeCloseTo(5.2,5);
 }
});
