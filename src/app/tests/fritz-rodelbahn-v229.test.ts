import {expect,test} from "bun:test";
import {InstancedMesh,Raycaster,Vector3} from "three";
import data from "../src/data/fritzRodelbahnV229Navigation.json";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import {createSmoothSurfaces,type SurfacePayload} from "../src/IsometricCityWorld";
import {createGroundSlabs,smoothGroundTopSampler,CLASS_SHADES,type VoxelPayload} from "../src/terrainPayload";
import {createFritzRodelbahnV229} from "../src/FritzRodelbahnV229";
import {fritzRodelbahnGroundAtV229} from "../src/fritzRodelbahnV229Navigation";

for(const native of [false,true])test(`${native?'native':'drawn'} mapped sled slope stays above real delivered Fritz ground and below no false lid`,()=>{
 const payload=ground as VoxelPayload, sample=smoothGroundTopSampler(payload),cell=payload.cell_m;
 const terrain=(x:number,z:number)=>sample(x/cell-payload.grid.min_x_idx,z/cell-payload.grid.min_z_idx);
 const root=createFritzRodelbahnV229(native);
 const old=native?createGroundSlabs({...payload,ground_rows:payload.ground_rows.map((row,iz)=>{
  const z=(payload.grid.min_z_idx+iz)*cell;if(z<data.bounds[1]-8||z>data.bounds[3]+8)return [];
  const left=Math.floor((data.bounds[0]-8)/cell)-payload.grid.min_x_idx,right=Math.ceil((data.bounds[2]+8)/cell)-payload.grid.min_x_idx;
  return row.map(([x,n,c])=>[Math.max(x,left),Math.min(x+n,right)-Math.max(x,left),c] as [number,number,number]).filter(r=>r[1]>0);
 })},"actual bounded native Fritz ground",CLASS_SHADES,{parkRelief:"native"}):createSmoothSurfaces({...surfaces,parks:surfaces.parks.filter(p=>p.name==='Fritz-Schloß-Park'),roads:[],water:[],scrub_points:[],lane_markings:[],sunken_walls:[]} as SurfacePayload,-1.15,4.2,terrain);
 root.updateMatrixWorld(true);old.updateMatrixWorld(true);
 let hits=0,low=Infinity,high=-Infinity,minClearance=Infinity;
 for(let x=-1182.23;x<-990;x+=7)for(let z=-1370.11;z<-1191;z+=7){
  const y=fritzRodelbahnGroundAtV229(x,z,native);if(y===null)continue;
  const ray=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0)),r=ray.intersectObject(root,true),o=ray.intersectObject(old,true);
  expect(r.length).toBeGreaterThan(0);expect(Math.abs(r[0].point.y-y)).toBeLessThan(native?.0001:.025);
  if(o.length)minClearance=Math.min(minClearance,r[0].point.y-o[0].point.y);
  low=Math.min(low,y);high=Math.max(high,y);hits++;
 }
 expect(minClearance).toBeGreaterThan(-.003);expect(hits).toBeGreaterThan(90);expect(high-low).toBeGreaterThan(12);
 if(native){const m=root.children[0] as InstancedMesh;for(let i=0;i<m.count;i++)for(const j of [1,2,4,6,8,9])expect(m.instanceMatrix.array[i*16+j]).toBe(0);}
 expect(root.userData.fullStaticDetailOnTouch).toBe(true);
});
