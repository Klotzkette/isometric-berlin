import {expect,test} from "bun:test";
import {Raycaster,Vector3} from "three";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import banks from "../src/data/pankeNativeBanksV229.json";
import {createPankeBanksV229} from "../src/PankeBanksV229";
import {CLASS_SHADES,createGroundSlabs,type VoxelPayload} from "../src/terrainPayload";
import {disposeStaticAudit} from "./helpers/staticGeometryAudit";

test("native bank faces are visible from water in front of the unchanged original land slabs",()=>{
 const payload=ground as VoxelPayload;
 // Keep complete retained runs: clipping their X start/count would change the
 // run-midpoint height that the real native world renders.
 const actual=createGroundSlabs({...payload,ground_rows:payload.ground_rows.map((runs,iz)=>{
  const z=(payload.grid.min_z_idx+iz)*4;
  return z< -3630||z> -1890?[]:runs.filter(([x,n])=>(x+payload.grid.min_x_idx)*4<1010&&(x+n+payload.grid.min_x_idx)*4> -510);
 })},"Original retained native Panke land and water",CLASS_SHADES,{parkRelief:"native"});
 const overlay=createPankeBanksV229(true);
 try {
  actual.updateMatrixWorld(true);overlay.updateMatrixWorld(true);
  let checked=0,minClearance=Infinity;
  const directions=new Set<string>();
  const rows=banks.banks.filter(r=>r[9]===-2);
  // Real upper-wall rays cover every direction and the full downstream reach.
  for(let index=0;index<rows.length;index+=13){
   const raw=rows[index];
   const [ax,az,bx,bz,nx,nz]=raw as number[],top=Number(raw[7])-.12;
   const x=ax+(bx-ax)*.343,z=az+(bz-az)*.343;
   const ray=new Raycaster(new Vector3(x+nx*.8,top-.35,z+nz*.8),new Vector3(-nx,0,-nz),0,2);
   const oldHit=ray.intersectObject(actual,true)[0],newHit=ray.intersectObject(overlay,true)[0];
   expect(oldHit).toBeDefined();expect(newHit).toBeDefined();
   expect(newHit.object.name).toContain("Panke bank");
   expect(newHit.distance).toBeLessThan(oldHit.distance-.04);
   minClearance=Math.min(minClearance,oldHit.distance-newHit.distance);
   directions.add(`${nx},${nz}`);checked++;
  }
  expect(checked).toBeGreaterThan(70);expect(directions.size).toBe(4);
  expect(minClearance).toBeGreaterThan(.04);
 }finally{disposeStaticAudit(overlay);disposeStaticAudit(actual);}
});
