import { expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createArbeitsministeriumQuartierV383 } from "../src/ArbeitsministeriumQuartierV383";
import { createMehringplatzV383 } from "../src/MehringplatzV383";
import { mehringplatzSolidsV383 } from "../src/mehringplatzNavigationV383";
import { isMehringplatzPrismV383, isMehringplatzReplacementColumnV383 } from "../src/mehringplatzOwnersV383";
import { createLabourQuartierV208 } from "../src/LabourQuartierV208";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
import type { PrismBuilding } from "../src/IsometricCityWorld";

const file = (name: string) => Bun.file(new URL("../public/mesh/regierungsviertel/" + name, import.meta.url)).json();

test("Core drawing and voxel payloads replace precisely five housing and station footprints", async () => {
  const { buildings } = await file("lod2-prisms.json");
  const selected: PrismBuilding[] = buildings.filter(isMehringplatzPrismV383);
  expect(selected.map(row => row.id).sort()).toEqual(["38799552","25483580","15548229","25483631","16110464"].sort());
  for (const old of selected) {
    expect(isMehringplatzPrismV383({ ...old, h_dm:old.h_dm+1 })).toBeFalse();
    expect(isMehringplatzPrismV383({ ...old, ring:[...old.ring].reverse() })).toBeFalse();
  }
  const { grid, building_rows: rows } = await file("minecraft-voxels.json");
  let count=0;
  rows.forEach((runs:number[][], row:number) => {
    const z=grid.min_z_idx+row;
    if(z<520||z>600) return;
    for(const [start,span,lo,hi,cls] of runs) for(let x=grid.min_x_idx+start;x<grid.min_x_idx+start+span;x++) {
      if(!isMehringplatzReplacementColumnV383(x,z,lo,hi,cls)) continue;
      expect(isMehringplatzReplacementColumnV383(x,z,lo,hi+1,cls)).toBeFalse();
      expect(isMehringplatzReplacementColumnV383(x,z,lo,hi,cls+1)).toBeFalse();
      count++;
    }
  });
  expect(count).toBe(816);
});

test("The walking controller keeps the southern route open after a style switch", async () => {
  const { buildings } = await file("lod2-prisms.json");
  let mode: VisualMode = "day";
  const index = compilePedestrianObstacles({ buildings: buildings.filter(isMehringplatzPrismV383) }, () => mode);
  for (const style of ["day", "minecraft", "day"] as const) {
    mode = style;
    expect(pedestrianPointIsBlocked(1327.97, 2316.39, 5.72, index)).toBeFalse();
    expect(pedestrianPointIsBlocked(1307.20, 2311.77, 5.72, index)).toBeTrue();
    expect(pedestrianPointIsBlocked(1327.97, 2316.39, 13, index)).toBeTrue();
  }
});

function inside(x:number,z:number,ring:number[][]) {
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}

for(const native of [false,true]) test("Walkable housing bridge, platforms, column and BMAS arches in "+(native?"block style":"drawn style"),async()=>{
  const square=await createMehringplatzV383(native);
  square.updateMatrixWorld(true);
  const meshes=square.children as Mesh[];
  for(const m of meshes) {
    expect(m.geometry.getAttribute("position").count).toBeLessThan(65536);
    expect(m.geometry.index!.count).toBeGreaterThan(0);
    expect(m.geometry.getAttribute("color").count).toBe(m.geometry.getAttribute("position").count);
  }
  const solids=mehringplatzSolidsV383("38799552",native)!;
  const occupied=(x:number,z:number,y:number)=>solids.some(([, ,lo,hi,[outer,...holes]])=>
    y>lo && y<hi && inside(x,z,outer) && !holes.some(h=>inside(x,z,h)));
  expect(occupied(1327.97,2316.39,7.2)).toBeFalse();
  expect(occupied(1327.97,2316.39,13)).toBeTrue();
  expect(occupied(1307.2,2311.77,7.2)).toBeTrue();
  const up=new Raycaster(new Vector3(1327.97,7.2,2316.39),new Vector3(0,1,0));
  expect(up.intersectObjects(meshes)[0].point.y).toBeCloseTo(10.92,1);
  const column=new Raycaster(new Vector3(1329.214,30,2246.846),new Vector3(0,-1,0));
  expect(column.intersectObjects(meshes)[0].point.y).toBeGreaterThan(23);
  const platforms=mehringplatzSolidsV383("16110464",native)!.filter(r=>r[1].startsWith("w"));
  expect(platforms.map(r=>r[1]).sort()).toEqual(["w49037862","w49037864"]);
  for(const r of platforms) expect(r[2]).toBeGreaterThan(14.4);
  const old=createLabourQuartierV208(native,true), retained=createLabourQuartierV208(native,false);
  expect((retained.children.at(-1) as InstancedMesh).count).toBeLessThan((old.children.at(-1) as InstancedMesh).count);
  const bmas=await createArbeitsministeriumQuartierV383(native);
  expect(new Box3().setFromObject(bmas).max.y).toBeCloseTo(30.02,1);
  bmas.updateMatrixWorld(true);
  const front=new Raycaster(new Vector3(826,16.8,741.7), new Vector3(.958,0,-.286).normalize());
  expect(front.intersectObjects(bmas.children)[0].distance).toBeLessThan(29);
});
