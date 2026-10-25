import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {preloadAltMitteV169NativeNavigation} from '../src/altMitteV169Profile';
import {createPedestrianEnvironment,createPedestrianState,pedestrianPointIsBlocked,PEDESTRIAN_WALK_SPEED_MPS,stepPedestrian} from '../src/pedestrianNavigation';
import {golgathaRoofAtV270} from '../src/golgathaV270Profile';

test('full retained city: Borsigstrasse walk, corrected helm and live mode roof changes',async()=>{
 await preloadAltMitteV169NativeNavigation();
 const ground=JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json','utf8'));
 const prisms=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));
 const env=createPedestrianEnvironment(ground,{water:[]},null,prisms,undefined,{golgathaV270:true});
 const a=[1310,-1094],b=[1321,-1076],dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz),yaw=Math.atan2(dx,-dz);
 for(const mode of ['day','minecraft','day'] as const){
  env.visualMode=()=>mode;
  const floor=env.groundAt(a[0],a[1])!;
  let state=createPedestrianState(env,{x:a[0],z:a[1],yaw,groundYHint:floor,preserveHorizontalPosition:true}),respawn=false,jump=false,maxStep=0;
  for(let i=0;i<80;i++){
   const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},distance/(80*PEDESTRIAN_WALK_SPEED_MPS),env);
   maxStep=Math.max(maxStep,Math.abs(result.state.groundY-state.groundY));respawn||=result.respawned;jump||=result.state.jumpOffset!==0;state=result.state;
  }
  expect(respawn).toBe(false);expect(jump).toBe(false);expect(maxStep).toBeLessThan(.2);
  expect(Math.hypot(state.x-b[0],state.z-b[1])).toBeLessThan(.15);
  expect(pedestrianPointIsBlocked(1326.05,-1088.6,60,env.obstacles,env)).toBe(true);
  expect(pedestrianPointIsBlocked(1326.05,-1088.6,66.3,env.obstacles,env)).toBe(false);
  // On the narrow native summit cell the roof is 66.2m, while the drawn
  // sloping helm at this off-centre position is lower. One compiled index
  // must follow the active presentation rather than retaining either cap.
  const x=1326.24,z=-1088.74,y=65;
  expect(golgathaRoofAtV270(x,z,true)!).toBeGreaterThan(y);
  expect(golgathaRoofAtV270(x,z,false)!).toBeLessThan(y);
  expect(pedestrianPointIsBlocked(x,z,y,env.obstacles,env)).toBe(mode==='minecraft');
 }
});
