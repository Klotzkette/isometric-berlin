import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import ground from '../public/mesh/regierungsviertel/ground-context.json';
import { createSmoothSurfaces } from '../src/IsometricCityWorld';
import { createDistrictStreets } from '../src/DistrictStreets';
import { smoothGroundTopSampler, worldGroundSampler } from '../src/terrainPayload';
import { tramGroundV281, tramRailHeightV281 } from '../src/TramRailsV281';
import { cutUbahnPresentationV281 } from '../src/UbahnSurfaceAperturesV281';
import { UBAHN_STAIRS_V281 } from '../src/ubahnEntrancesV281Profile';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';

test('retained central terrain supports railheads west of the old mask; actual road owners remain below the new heads',()=>{
  const repo=resolve(import.meta.dir,'../../..');
  const result=Bun.spawnSync(['uv','run','python','scripts/prepare_transit_surface_audit_v281.py'],{cwd:repo,stdout:'pipe',stderr:'pipe'});
  expect(result.exitCode).toBe(0);
  const fixture=JSON.parse(result.stdout.toString());
  const sampler=smoothGroundTopSampler(ground as any),nativeSampler=worldGroundSampler(ground as any);
  const terrain=(x:number,z:number)=>sampler(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx);
  const root=new Group();root.add(createSmoothSurfaces(fixture,ground.water_top_y_m,4.2,terrain));root.add(createDistrictStreets(ground as any));root.updateMatrixWorld(true);
  const skins:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh&&['smooth carriageways','smooth paved paths','District asphalt carriageways','District mapped paved walkways'].includes(o.name))skins.push(o);});
  let supported=0;const gaps:number[]=[];
  for(const [x,z] of fixture.points){
    expect(tramGroundV281(x,z,false)).toBeCloseTo(terrain(x,z),7);
    expect(tramGroundV281(x,z,true)).toBeCloseTo(nativeSampler(x,z)!,7);
    const hit=new Raycaster(new Vector3(x,30,z),new Vector3(0,-1,0)).intersectObjects(skins,false)[0];
    if(!hit)continue; // mapped segregated trackbed has a terrain owner, no paved road
    supported++;const gap=tramRailHeightV281(x,z,false)-hit.point.y;gaps.push(gap);
    expect(gap).toBeGreaterThan(-.001);expect(gap).toBeLessThan(.16);
  }
  expect(supported).toBeGreaterThan(150);
  // Slice precisely the same real source plates, not an invented flat fixture.
  cutUbahnPresentationV281(root,false);root.updateMatrixWorld(true);
  for(const s of UBAHN_STAIRS_V281){
    const x=(s.top[0]+s.bottom[0])/2,z=(s.top[1]+s.bottom[1])/2;
    expect(new Raycaster(new Vector3(x,15,z),new Vector3(0,-1,0)).intersectObjects(skins,false).length).toBe(0);
  }
  console.log(`v281 actual surface audit: ${fixture.points.length} terrain checks, ${supported} road hits, clearances ${Math.min(...gaps).toFixed(4)}..${Math.max(...gaps).toFixed(4)} m`);
  disposeSurroundingCityRoot(root);
},30000);
