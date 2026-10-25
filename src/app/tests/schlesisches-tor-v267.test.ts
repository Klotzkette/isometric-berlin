import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createSchlesischesTorV267, schlesischesTorGeometryV267 } from '../src/SchlesischesTorV267';
import { schlesischesTorRoofCellsV267, schlesischesTorSolidsV267, schlesischesTorStructuralRowsV267 } from '../src/SchlesischesTorV267Profile';
import data from '../src/data/schlesischesTorV267.json';
import { surroundingBuildingSolidAt, surroundingPolygonContains, type SurroundingCityChunk } from '../src/SurroundingCityGeometry';
import { terrainGroundAt } from '../src/weinbergTerrainV176';
import { createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked, stepPedestrian, PEDESTRIAN_WALK_SPEED_MPS, type PedestrianExtension } from '../src/pedestrianNavigation';
function packet(native:boolean):SurroundingCityChunk{return JSON.parse(gunzipSync(readFileSync(`public/mesh/surrounding-berlin-v159/9_4.${native?'minecraft':'drawn'}.json.gz`)).toString());}

test('station retains independent cardinal native geometry and complete mobile detail',()=>{
  const drawn=schlesischesTorGeometryV267(),native=schlesischesTorGeometryV267(true);
  expect(drawn.triangles.length).toBe(609);expect(native.triangles).toHaveLength(0);
  expect(drawn.rows.length).toBeGreaterThan(14000);expect(native.rows.length).toBeLessThan(25000);
  expect(native.rows.every(r=>r.angle===0&&r.size.every(n=>n>0&&Number.isFinite(n)))).toBe(true);
  expect(drawn.rows.some(r=>r.role==='paired-portal-archivolt')).toBe(true);
  expect(native.rows.some(r=>r.role==='paired-portal-archivolt')).toBe(true);
  const source=packet(true),owner=source.nav.buildings.find(b=>b.sourceId===data.owner)!;
  expect(native.rows.filter(r=>r.role==='source-bound-red-brick').every(r=>{
    const x=r.position[0]-source.origin[0],z=r.position[2]-source.origin[2];
    return owner.ring.some((a,i)=>{const b=owner.ring[(i+1)%owner.ring.length],dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<.111;});
  })).toBe(true);
  for(const mode of [false,true]){
    const desktop=createSchlesischesTorV267(mode),mobile=createSchlesischesTorV267(mode,{mobileLike:true});
    expect(desktop.userData.instances).toBe(mobile.userData.instances);expect(desktop.userData.triangles).toBe(mobile.userData.triangles);expect(desktop.userData.retiredOwners).toEqual([]);
    for(const root of [desktop,mobile])root.traverse(object=>{const mesh=object as any;if(mesh.geometry){expect(mesh.geometry.getAttribute('uv')).toBeUndefined();mesh.geometry.dispose();}mesh.userData.dayMaterial?.dispose();mesh.userData.nightMaterial?.dispose();});
  }
});

test('compact native roof and deck collision retains represented raster geometry',()=>{
  const native=schlesischesTorSolidsV267(true),drawn=schlesischesTorSolidsV267();expect(native.length).toBeLessThan(100);expect(drawn.length).toBe(25);
  const roof=native.find(r=>r.sourceId.endsWith('native-roof-envelope'))!;let maxError=0,bottomError=0;
  for(const row of schlesischesTorRoofCellsV267()){
    const [x,y,z]=row.position,[w,h,d]=row.size;bottomError=Math.max(bottomError,Math.abs(y-h/2-(data.nativeBaseTopY-.02)));
    for(const [dx,dz] of [[0,0],[-.49,-.49],[.49,.49]])maxError=Math.max(maxError,Math.abs(roof.topAt(x+dx*w,z+dz*d)-(y+h/2)));
  }
  expect(maxError).toBeLessThan(1e-8);expect(bottomError).toBeLessThan(1e-8);
  const decks=native.filter(r=>r.sourceId.endsWith('native-deck'));
  expect(schlesischesTorStructuralRowsV267(true).filter(r=>r.role==='mapped-west-viaduct-deck').every(r=>decks.some(s=>Math.abs(s.topAt(r.position[0],r.position[2])-(r.position[1]+r.size[1]/2))<1e-8))).toBe(true);
});

test('actual 9_4 ground and closed source station retain walking under viaduct in live modes',()=>{
  const packets=[packet(false),packet(true)],ground=JSON.parse(readFileSync('public/mesh/regierungsviertel/ground-context.json','utf8'));let native=false;const active=()=>packets[native?1:0];
  const extension:PedestrianExtension={bounds:{minX:4608,maxX:5120,minZ:2048,maxZ:2560},
    groundAt:(x,z)=>{const p=active(),lx=x-p.origin[0],lz=z-p.origin[2];return p.nav.ground.some(r=>surroundingPolygonContains(r,lx,lz))?terrainGroundAt(x,z,p.nav.groundY,native)+(p.nav.roads?.some(r=>surroundingPolygonContains(r,lx,lz))?.09:0):null;},
    solidAt:(x,y,z,r=0)=>{const p=active();return surroundingBuildingSolidAt(p.nav,x-p.origin[0],y,z-p.origin[2],r);},
    waterAt:(x,z)=>{const p=active();return p.nav.water.some(r=>surroundingPolygonContains(r,x-p.origin[0],z-p.origin[2]));}};
  const env=createPedestrianEnvironment(ground,{water:[]},null,{buildings:[]},extension,{includeSchlesischesTorV267:true});env.visualMode=()=>native?'minecraft':'day';
  const start=[4668,2120],end=[4668,2140],frames=48,distance=end[1]-start[1];
  for(const mode of [false,true,false]){
    native=mode;
    const roofCell=schlesischesTorRoofCellsV267()[20],roofGate=[...env.obstacles!.cells.values()].flat().find(s=>s.sourceId==='schlesisches-tor-v267-native-roof-envelope')!;
    expect(roofGate.kind==='polygon'&&Number.isFinite(roofGate.topAt!(roofCell.position[0],roofCell.position[2]))).toBe(native);
    const floor=env.groundAt(start[0],start[1])!;expect(floor).toBeGreaterThanOrEqual(3);expect(floor).toBeLessThanOrEqual(3.1);
    let state=createPedestrianState(env,{x:start[0],z:start[1],yaw:Math.PI,groundYHint:floor,preserveHorizontalPosition:true});expect(state.x).toBeCloseTo(start[0],5);expect(state.z).toBeCloseTo(start[1],5);
    let respawn=false,jump=false,largestStep=0;
    for(let frame=0;frame<frames;frame++){
      const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},distance/(frames*PEDESTRIAN_WALK_SPEED_MPS),env);
      largestStep=Math.max(largestStep,Math.abs(result.state.groundY-state.groundY));respawn||=result.respawned;jump||=result.state.jumpOffset!==0;state=result.state;
    }
    expect(respawn).toBe(false);expect(jump).toBe(false);expect(largestStep).toBeLessThan(.11);expect(state.x).toBeCloseTo(end[0],4);expect(state.z).toBeCloseTo(end[1],4);
    const deck=schlesischesTorStructuralRowsV267().find(r=>r.role==='mapped-west-viaduct-deck')!,[x,y,z]=deck.position;
    expect(pedestrianPointIsBlocked(x,z,3.09,env.obstacles,env)).toBe(false);expect(pedestrianPointIsBlocked(x,z,y,env.obstacles,env)).toBe(true);expect(pedestrianPointIsBlocked(x,z,y+deck.size[1]/2+.05,env.obstacles,env)).toBe(false);
    expect(pedestrianPointIsBlocked(4716,2118,3.09,env.obstacles,env)).toBe(true);
  }
});
