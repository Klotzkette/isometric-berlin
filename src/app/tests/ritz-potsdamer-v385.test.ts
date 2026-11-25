import { expect, test } from 'bun:test';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { createDistantBuildingShells, createIsometricCityCore, type PrismPayload } from '../src/IsometricCityWorld';
import { createMinecraftVoxelWorld } from '../src/MinecraftVoxelWorld';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';
import type { VoxelBuildingColumn, VoxelPayload } from '../src/terrainPayload';
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import type { VisualMode } from '../src/visualMode';
import { createRitzPortalsV385 } from '../src/RitzPortalsV385';
import { hasRitzCanopyColumnsV385, isRitzCanopyV385 } from '../src/ritzCanopyProfileV385';
import { ritzNativeRoofHeightsV385, ritzRoofNavigationV385, ritzRoofV385 } from '../src/ritzRoofsV385';
import roofs from '../src/data/ritzRoofsV385.json';
import { createPotsdamerPlatzPublicRealm } from '../src/PotsdamerPlatzPublicRealm';
import { POTSDAMER_TRAFFIC_TOWER_PROFILE as tower } from '../src/potsdamerTrafficTowerProfile';

const city = (name:string)=>Bun.file(new URL('../public/mesh/regierungsviertel/'+name,import.meta.url)).json();
const prisms: PrismPayload = await city('lod2-prisms.json');
const owner=prisms.buildings.find(isRitzCanopyV385)!;
const source={...prisms,buildings:[owner]};
const native:VoxelPayload=await city('minecraft-voxels.json');
const columns:VoxelBuildingColumn[]=[[60,245,53,133,3],[61,245,53,133,3],[62,245,53,133,3],[60,246,53,133,3]];

function crossing(group:Group) {
  group.updateMatrixWorld(true);
  const canopy=group.getObjectByName('The Ritz-Carlton · freitragendes Vordach (DEBE01YYK0003V2X)');
  expect(canopy).toBeInstanceOf(Mesh);
  const x=246.4,z=983.2;
  const hit=(y:number,dy:number)=>new Raycaster(new Vector3(x,y,z),new Vector3(0,dy,0)).intersectObject(canopy!)[0].point.y;
  expect(hit(6,1)).toBeCloseTo(10.98,1);
  expect(hit(18,-1)).toBeCloseTo(11.3,3);
  for(const h of [6.3,7.3,8.3,10.3]) {
    const straight=new Raycaster(new Vector3(x,h,989),new Vector3(0,0,-1),0,8);
    expect(straight.intersectObject(canopy!)).toHaveLength(0);
  }
}

test('the isolated opening is already present in both normal drawn core and distant coverage',()=>{
  expect(prisms.buildings.filter(isRitzCanopyV385)).toHaveLength(1);
  expect(isRitzCanopyV385({...owner,h_dm:61})).toBeFalse();
  expect(isRitzCanopyV385({...owner,ring:[...owner.ring].reverse()})).toBeFalse();
  const distant=createDistantBuildingShells(source,source.buildings);
  crossing(distant);
  expect(distant.children).toHaveLength(1);
  crossing(createIsometricCityCore(source,null));
});

test('the production native constructor opens exactly the four original canopy columns',async()=>{
  expect(hasRitzCanopyColumnsV385(native)).toBeTrue();
  const reduced:VoxelPayload={...native,schema_version:1,building_rows:undefined,buildings:columns,
    ground_rows:[],tree_rows:undefined,trees:[]};
  expect(hasRitzCanopyColumnsV385(reduced)).toBeTrue();
  expect(hasRitzCanopyColumnsV385({...reduced,buildings:[...columns.slice(0,3),columns[0]]})).toBeFalse();
  expect(hasRitzCanopyColumnsV385({...reduced,cell_m:5})).toBeFalse();
  await preloadAltMitteNativeV169Source();
  crossing(createMinecraftVoxelWorld(reduced,null,null,{sourcePrisms:source.buildings}));
},60000);

test('the walking controller retains headroom under the canopy on a style change',()=>{
  let mode:VisualMode='day';
  const index=compilePedestrianObstacles(source,()=>mode);
  for(const style of ['day','minecraft','day'] as const) {
    mode=style;
    expect(pedestrianPointIsBlocked(246.4,983.2,5.8,index)).toBeFalse();
    expect(pedestrianPointIsBlocked(246.4,983.2,10.1,index)).toBeTrue();
    expect(pedestrianPointIsBlocked(246.4,983.2,11.5,index)).toBeFalse();
  }
});

test('two matching hotel roofs retain the measured ridges and 138 exclusive original brick cells',()=>{
  const owned=prisms.buildings.filter(p=>ritzRoofV385(p));
  expect(owned).toHaveLength(2);
  const top=ritzNativeRoofHeightsV385(owned)!;
  let roofTriangles=0,n=0;
  for(const p of owned) {
    const data=roofs[p.id as keyof typeof roofs];
    roofTriangles+=data.roofCorners/3;
    expect(ritzRoofV385({...p,h_dm:p.h_dm+1})).toBeNull();
    expect(ritzRoofV385({...p,ring:[...p.ring].reverse()})).toBeNull();
    expect(ritzRoofV385(p)!.wallHeight).toBeCloseTo(data.eave/1000-p.y0_dm/10,6);
    const heightAt=ritzRoofNavigationV385(p)!;
    for(const [x,z,lo,old,h] of data.n) {
      expect(top(x,z,lo,old,3)).toBe(h);
      expect(top(x,z,lo,old+1,3)).toBe(old+1);
      expect(top(x,z,lo,old,2)).toBe(old);
      expect(heightAt(x*4+2,z*4+2,true)).toBe(h/10);
      expect(Math.abs(heightAt(x*4+2,z*4+2,false)-h/10)).toBeLessThan(.051);
      n++;
    }
  }
  expect(roofTriangles).toBe(132);
  expect(n).toBe(138);
  expect(ritzNativeRoofHeightsV385([owner])).toBeUndefined();
});

test('the new hotel and apartment street entrances and upper panes face the public square in both styles',()=>{
  for(const native of [false,true]) {
    const group=createRitzPortalsV385(native);
    group.updateMatrixWorld(true);
    expect(group.children).toHaveLength(1);
    for(const [x,y] of [[246.1,8],[261.6,8],[243.9,24],[261,62]]) {
      const hits=new Raycaster(new Vector3(x,y,993),new Vector3(0,0,-1),0,30).intersectObjects(group.children);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.z).toBeGreaterThan(975);
    }
    const east=new Raycaster(new Vector3(284,57,955),new Vector3(-1,0,0),0,30);
    expect(east.intersectObjects(group.children)[0].point.x).toBeGreaterThan(267);
  }
});

test('the Potsdamer footway has no invented radial bars around the traffic tower',()=>{
  const [x,z]=tower.worldXZ;
  for(const detail of ['full','mobile'] as const) {
    const realm=createPotsdamerPlatzPublicRealm(detail);
    realm.updateMatrixWorld(true);
    const paving=new Raycaster(new Vector3(x+5.1,15,z),new Vector3(0,-1,0),0,15);
    expect(paving.intersectObjects(realm.children,true)).toHaveLength(0);
  }
});

test('the footway from the square reaches each public entrance in drawn and block style',()=>{
  const doors=[
    {x:246.13,z:979.02,dx:.1,dz:1,floor:5.45},
    {x:395.3,z:973.7,dx:.65,dz:.75,floor:5.31},
  ];
  const nearby=prisms.buildings.filter(b=>b.ring.some(([x,z])=>
    doors.some(d=>Math.hypot(d.x-x/10,d.z-z/10)<60)));
  let mode:VisualMode='day';
  const index=compilePedestrianObstacles({buildings:nearby},()=>mode);
  for(const style of ['day','minecraft'] as const) {
    mode=style;
    for(const d of doors) for(let cm=65;cm<=800;cm+=10) {
      expect(pedestrianPointIsBlocked(d.x+d.dx*cm/100,d.z+d.dz*cm/100,d.floor,index)).toBeFalse();
    }
  }
});
