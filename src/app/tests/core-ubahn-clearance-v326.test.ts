import{test,expect}from'bun:test';
import{readFileSync}from'node:fs';
import{join}from'node:path';
import{createHash}from'node:crypto';
import{Mesh}from'three';
import{createSchlossEastStreets}from'../src/SchlossEastStreets';
import{schlossEastNavigationGroundAt}from'../src/schlossEastNavigation';
import{worldGroundSampler,type VoxelPayload}from'../src/terrainPayload';
import{compilePedestrianWater,pedestrianObstacleCellKey,type PedestrianEnvironment,type PedestrianObstacleIndex,type PedestrianPolygonObstacle}from'../src/pedestrianNavigation';
import{createCoreUbahnAccessV326Steps,createCoreUbahnClearanceV326}from'../src/CoreUbahnAccessV326';
import{disposeSurroundingCityRoot}from'../src/disposeSurroundingCityRootV323';
import raw from'../src/data/ubahnAccessV326.json';
import authored from'../src/data/ubahnAuthoredGroundV326Index.json';

const drain=<T>(g:Generator<void,T>):T=>{let n=g.next();while(!n.done)n=g.next();return n.value;};
const base=join(import.meta.dir,'..');
function actualEnvironment():PedestrianEnvironment{
 const parts=[1,2].flatMap(i=>JSON.parse(readFileSync(join(base,`src/data/altMitteV169Navigation/packet-00${i}.json`),'utf8')));
 const index:PedestrianObstacleIndex={cells:new Map(),cellSizeM:64,buildingCount:0,obstacleCount:0,hedgeAreaCount:0,hedgeSegmentCount:0,parkDetailsAdded:false,playgroundEquipmentCount:0,shrubClusterCount:0,streetLightCount:0,treeCount:0,wallSegmentCount:0};
 for(const p of parts){const xs=p.ring.map((p:number[])=>p[0]),zs=p.ring.map((p:number[])=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);if(maxX<1760||minX>2810||maxZ< -365||minZ>850)continue;
  const row:PedestrianPolygonObstacle={kind:'polygon',sourceId:p.sourceId,ring:p.ring,holes:p.holes,coordinateScale:1,minX,maxX,minZ,maxZ,minY:p.groundY,maxY:p.topY};
  for(let z=Math.floor(minZ/64);z<=Math.floor(maxZ/64);z++)for(let x=Math.floor(minX/64);x<=Math.floor(maxX/64);x++){const k=pedestrianObstacleCellKey(x,z),rows=index.cells.get(k)??[];rows.push(row);index.cells.set(k,rows);}index.buildingCount++;index.obstacleCount++;
 }
 const surfaces=JSON.parse(readFileSync(join(base,'public/mesh/regierungsviertel/surface-polygons.json'),'utf8'));
 return{bounds:{minX:1760,minZ:-365,maxX:2810,maxZ:850},groundAt:()=>null,obstacles:index,water:compilePedestrianWater(surfaces)};
}
const contact=(x:number,z:number)=>({id:'source-contact',sourceWay:'source-contact',sourcePoints:[[x,z]]as[number,number][],ring:[[x-.03,z-.03],[x+.03,z-.03],[x+.03,z+.03],[x-.03,z+.03]]as[number,number][],surfaceY:5.5,bottomY:5.4,width:.06,steps:0,native:false});

test('actual eastern Core carriers and complete original body/water profiles admit only clear sources, both families',()=>{
 const payload=JSON.parse(readFileSync(join(base,'public/mesh/regierungsviertel/minecraft-voxels.json'),'utf8'))as VoxelPayload,original=worldGroundSampler(payload);
 for(const native of[false,true]){
  const world=createSchlossEastStreets(payload,native),environment=actualEnvironment(),clearance=createCoreUbahnClearanceV326(environment)!;
  const hosts:Mesh[]=[];world.traverse(o=>{if(o instanceof Mesh)hosts.push(o);});
  const signature=()=>{const h=createHash('sha256');for(const m of hosts)for(const a of[m.geometry.getAttribute('position'),m.geometry.index])if(a)h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));return h.digest('hex');};
  const before=signature(),attributes=hosts.map(m=>Object.keys(m.geometry.attributes));
  const model=drain(createCoreUbahnAccessV326Steps(world,native,(x,z)=>schlossEastNavigationGroundAt(x,z,native?'minecraft':'day')??original(x,z),clearance));
  expect(model).not.toBeNull();expect(model!.complete()).toBe(true);expect(model!.openingIds.length).toBeGreaterThan(0);expect(signature()).toBe(before);expect(hosts.map(m=>Object.keys(m.geometry.attributes))).toEqual(attributes);
  const started=performance.now(),fresh=clearance.complete(),completeMs=performance.now()-started;
  const cells=environment.obstacles!.cells,originalGet=cells.get,queried=new Set<number|string>();
  try{cells.get=function(key){queried.add(key);return originalGet.call(this,key);};clearance.complete();}finally{cells.get=originalGet;}
  console.log(JSON.stringify({coreClearanceNative:native,freshComplete:fresh,completeMs,waterJSONBytes:JSON.stringify(environment.water).length,waterRegions:environment.water.length,queriedCells:queried.size,indexCells:cells.size,indexBuildings:environment.obstacles!.buildingCount}));
  for(const row of authored.entries.filter(e=>e.admission==='source-body-blocked')){const e=raw.entries.find(e=>e.id===row.id)!;expect(clearance(contact(...e.point as[number,number]))).toBe(false);}
  model!.dispose();expect(signature()).toBe(before);expect(model!.complete()).toBe(false);disposeSurroundingCityRoot(world);
 }
});

test('bounded real navigation rejects edge intrusions, unexpected local members and any changed water source',()=>{
 const environment=actualEnvironment(),clearance=createCoreUbahnClearanceV326(environment)!;
 const entry=raw.entries.find(e=>e.id==='node/8196659577')!,o=contact(...entry.point as[number,number]);expect(clearance(o)).toBe(true);
 const key=pedestrianObstacleCellKey(Math.floor(entry.point[0]/64),Math.floor(entry.point[1]/64)),rows=environment.obstacles!.cells.get(key)!;
 const x=entry.point[0]+.028,z=entry.point[1],edge:PedestrianPolygonObstacle={kind:'polygon',coordinateScale:1,sourceId:'negative-edge-only',minX:x,maxX:x+.02,minZ:z-.01,maxZ:z+.01,minY:5.2,maxY:10,ring:[[x,z-.01],[x+.02,z-.01],[x+.02,z+.01],[x,z+.01]],holes:[]};
 rows.push(edge);expect(clearance.complete()).toBe(false);expect(createCoreUbahnClearanceV326(environment)!(o)).toBe(false);rows.pop();expect(clearance.complete()).toBe(true);
 environment.water[0].ring[0]=[environment.water[0].ring[0][0]+.01,environment.water[0].ring[0][1]];expect(clearance.complete()).toBe(false);
 expect(createCoreUbahnClearanceV326({...environment,obstacles:undefined})).toBeNull();
});

test('closed source contours with two closed holes retain their exact water voids',()=>{
 const environment=actualEnvironment(),entry=raw.entries.find(e=>e.id==='node/8196659577')!,[x,z]=entry.point;
 const square=(cx:number,cz:number,r:number)=>[[cx-r,cz-r],[cx+r,cz-r],[cx+r,cz+r],[cx-r,cz+r],[cx-r,cz-r]]as[number,number][];
 environment.water.push({minX:x-2,minZ:z-2,maxX:x+2,maxZ:z+2,ring:square(x,z,2),holes:[square(x,z,.25),square(x+1,z,.25)]});
 const proof=createCoreUbahnClearanceV326(environment)!;
 expect(proof(contact(x,z))).toBe(true);expect(proof(contact(x+1,z))).toBe(true);
 expect(proof(contact(x+.5,z))).toBe(false);expect(proof(contact(x+.24,z))).toBe(false);
});
