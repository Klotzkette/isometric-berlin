import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createPedestrianEnvironment,createPedestrianState,stepPedestrian,pedestrianPointIsBlocked} from '../src/pedestrianNavigation';
import {preloadAltMitteV169NativeNavigation} from '../src/altMitteV169Profile';
import {anhalterPointV266,TEMPODROM_ANHALTER_V266_PROFILE,tempodromRoofAtV266} from '../src/TempodromAnhalterV266Profile';

test('complete source terrain/navigation permits all three Anhalter passages and blocks masonry in both modes',async()=>{
  await preloadAltMitteV169NativeNavigation();
  const ground=JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json','utf8'));
  const prisms=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));
  const env=createPedestrianEnvironment(ground,{water:[]},null,prisms,undefined,{replaceAnhalterPrism:true,replaceChariteBridges:true,replaceAEGCampusPrisms:true,replaceTownhallPrisms:true,replaceDistrictCourtPrisms:true,replaceColonnadesPrisms:true,replaceSchlossplatzPrisms:true});
  const [dx,dz]=TEMPODROM_ANHALTER_V266_PROFILE.portico.direction;
  for(const mode of ['day','minecraft'] as const){
    env.visualMode=()=>mode;
    for(const u of [-5.45,0,5.45]){
      const [x,,z]=anhalterPointV266(u,5.2,-5);
      let state=createPedestrianState(env,{x,z,yaw:Math.atan2(-dz,-dx),groundYHint:env.groundAt(x,z)!,preserveHorizontalPosition:true});
      for(let frame=0;frame<60;frame++){
        const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},1/60,env);state=result.state;
        expect(result.respawned).toBe(false);expect(state.groundY).toBeLessThan(5.7);expect(state.groundY).toBeGreaterThan(4.9);
      }
      expect(Math.hypot(state.x-x,state.z-z)).toBeGreaterThan(11);
    }
    const [x,,z]=anhalterPointV266(2.75,5.2,-3.02);
    expect(pedestrianPointIsBlocked(x,z,5.2,env.obstacles)).toBe(true);
    const [cx,cz]=TEMPODROM_ANHALTER_V266_PROFILE.tempodrom.centre;
    expect(pedestrianPointIsBlocked(cx,cz,20,env.obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(cx,cz,tempodromRoofAtV266(cx,cz,mode==='minecraft')!+.1,env.obstacles)).toBe(false);
  }
});
