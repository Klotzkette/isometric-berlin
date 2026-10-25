import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian } from '../src/pedestrianNavigation';
import { preloadAltMitteV169NativeNavigation } from '../src/altMitteV169Profile';
import { campusCanopySolidsV266 } from '../src/CampusNordV266Profile';

test('full-source Mensa canopy allows continuous ground walking and retains its live mode-specific roof', async()=>{
  await preloadAltMitteV169NativeNavigation();
  const ground=JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json','utf8'));
  const prisms=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));
  const env=createPedestrianEnvironment(ground,{water:[]},null,prisms,undefined,{
    replaceCampusCanopy:true,replaceAnhalterPrism:true,replaceChariteBridges:true,
    replaceAEGCampusPrisms:true,replaceTownhallPrisms:true,replaceDistrictCourtPrisms:true,
    replaceColonnadesPrisms:true,replaceSchlossplatzPrisms:true,
  });
  const start=[719.7,-1002],end=[726.2,-994],dx=end[0]-start[0],dz=end[1]-start[1];
  const distance=Math.hypot(dx,dz),yaw=Math.atan2(dx,-dz),frames=64,dt=distance/(PEDESTRIAN_WALK_SPEED_MPS*frames);
  // Reuse the already compiled index when changing mode, as the live viewer does.
  for(const mode of ['day','minecraft','day'] as const){
    env.visualMode=()=>mode;
    const initialGround=env.groundAt(...start as [number,number])!;
    expect(initialGround).toBeGreaterThan(4.9);expect(initialGround).toBeLessThan(5.7);
    let state=createPedestrianState(env,{x:start[0],z:start[1],yaw,groundYHint:initialGround,preserveHorizontalPosition:true});
    expect(state.x).toBeCloseTo(start[0],6);expect(state.z).toBeCloseTo(start[1],6);
    for(let frame=0;frame<frames;frame++){
      const oldY=state.groundY;
      expect(pedestrianPointIsBlocked(state.x,state.z,state.groundY,env.obstacles,env)).toBe(false);
      const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},dt,env);
      state=result.state;
      expect(result.respawned).toBe(false);expect(state.grounded).toBe(true);
      expect(Math.abs(state.groundY-oldY)).toBeLessThan(.06);
      expect(Math.abs(state.groundY-initialGround)).toBeLessThan(.15);
      expect(state.jumpOffset).toBe(0);
    }
    expect(state.x).toBeCloseTo(end[0],4);expect(state.z).toBeCloseTo(end[1],4);
    const roof=campusCanopySolidsV266(mode==='minecraft')[0];
    expect(pedestrianPointIsBlocked(723,-998,initialGround,env.obstacles,env)).toBe(false);
    expect(pedestrianPointIsBlocked(723,-998,roof.minY+.03,env.obstacles,env)).toBe(true);
    expect(pedestrianPointIsBlocked(723,-998,roof.maxY+.05,env.obstacles,env)).toBe(false);
    // The measured southwest tip reaches this standing capsule; the independent
    // half-metre native roof retracts it. This catches a drawn-only collider or
    // a mode captured once at compilation even though the centre tests pass.
    expect(pedestrianPointIsBlocked(715.55,-1005.65,10.4,env.obstacles,env)).toBe(mode!=='minecraft');
  }
});
