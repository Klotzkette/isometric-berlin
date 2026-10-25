import {expect,test}from'bun:test';
import {readFileSync}from'node:fs';
import {Box3,Mesh}from'three';
import data from'../src/data/moabitLandmarksV269Profile.json';
import {createMoabitLandmarksV269}from'../src/MoabitLandmarksV269';
import {isMoabitLandmarkSourceV269,createMoabitLandmarkColumnTesterV269,moabitLandmarkSolidsV269}from'../src/MoabitLandmarksV269Profile';
import {createPedestrianEnvironment,createPedestrianState,stepPedestrian,PEDESTRIAN_WALK_SPEED_MPS}from'../src/pedestrianNavigation';
const actual=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));

test('only exact fallback owners and exclusive old tuples yield; mutations fail closed',()=>{
 const tester=createMoabitLandmarkColumnTesterV269(actual.buildings,data.cellM);
 expect(actual.buildings.filter(isMoabitLandmarkSourceV269).map((p:{id:string})=>p.id).sort()).toEqual(['06483932','37533771']);
 for(const s of data.sites){
  expect(isMoabitLandmarkSourceV269({...s.previousPrism,h_dm:141})).toBe(false);
  expect(s.columns.every(c=>tester(...c as [number,number,number,number,number]))).toBe(true);
  const c=s.columns[0];expect(tester(c[0],c[1],c[2],c[3]+1,c[4])).toBe(false);
  const x=c[0]*data.cellM*10,z=c[1]*data.cellM*10,newOwner={id:'new-overlap',ring:[[x,z],[x+40,z],[x+40,z+40],[x,z+40]]};
  expect(createMoabitLandmarkColumnTesterV269([...actual.buildings,newOwner],data.cellM)(...c as [number,number,number,number,number])).toBe(false);
  expect(createMoabitLandmarkColumnTesterV269(actual.buildings,data.cellM+1)(...c as [number,number,number,number,number])).toBe(false);
 }
});

test('required compact model has complete published tops in both modes and no texture/UV',()=>{
 for(const native of[false,true]){
  const root=createMoabitLandmarksV269(native);expect(root.children.length).toBe(2);expect(root.userData.requiredBeforeNavigation).toBe(true);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  root.updateMatrixWorld(true);let bytes=0;
  for(const child of root.children){const m=child as Mesh,profile=data.sites.find(s=>s.key===m.userData.siteKey)!;
   const b=new Box3().setFromObject(m);expect(b.min.y).toBeCloseTo(5.2,6);expect(b.max.y).toBeCloseTo(profile.topY,5);expect(m.matrixAutoUpdate).toBe(false);expect(m.geometry.getAttribute('uv')).toBeUndefined();
   for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;bytes+=m.geometry.index!.array.byteLength;
   m.geometry.dispose();for(const mat of new Set([m.material,m.userData.dayMaterial,m.userData.nightMaterial].flat()))mat.dispose();
  }expect(bytes).toBeLessThan(2_000_000);
 }
});

test('complete real core navigation remains stable around both sites across mode changes',()=>{
 const ground=JSON.parse(readFileSync('public/mesh/regierungsviertel/ground-context.json','utf8'));
 const voxel=JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json','utf8'));
 const env=createPedestrianEnvironment({...voxel,...ground},{water:[]},null,actual,undefined,{replaceMoabitLandmarkPrisms:true});let native=false;env.visualMode=()=>native?'minecraft':'day';
 const routes=[{a:[-2446,-1111],b:[-2415,-1105]},{a:[-2165,-864],b:[-2158,-831]}];
 for(const mode of[false,true,false]){native=mode;
  for(const{a,b}of routes){const floor=env.groundAt(a[0],a[1])!,dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz);let state=createPedestrianState(env,{x:a[0],z:a[1],yaw:Math.atan2(dx,-dz),groundYHint:floor,preserveHorizontalPosition:true}),respawn=false,jump=false,maxStep=0;
   for(let i=0;i<80;i++){const r=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},distance/(80*PEDESTRIAN_WALK_SPEED_MPS),env);respawn||=r.respawned;jump||=r.state.jumpOffset!==0;maxStep=Math.max(maxStep,Math.abs(r.state.groundY-state.groundY));state=r.state;}
   expect(respawn).toBe(false);expect(jump).toBe(false);expect(maxStep).toBeLessThan(.35);expect(Math.hypot(state.x-b[0],state.z-b[1])).toBeLessThan(.2);
  }
  const solids=moabitLandmarkSolidsV269(native);expect(solids.length).toBeLessThan(6);
  for(const s of data.sites){const solid=solids.find(p=>p.sourceId===s.prism)!;const t=s.towers[0],top=solid.topAt(t.centre[0],t.centre[1]);expect(top).not.toBeNull();expect(top!).toBeGreaterThan(35);}
 }
});
