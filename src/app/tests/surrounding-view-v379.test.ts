import { expect, test } from "bun:test";
import fs from "node:fs";
import { Box3, Frustum, Matrix4, OrthographicCamera, PerspectiveCamera, Raycaster, Plane, Vector2, Vector3 } from "three";
import { createSurroundingViewPlanV379 } from "../src/surroundingViewPlanV379";
import { indexSurroundingFootprintV379 } from "../src/surroundingFootprintV379";
import { surroundingPolygonContains } from "../src/SurroundingCityGeometry";
import { cameraNeedsSurroundingGroundV379 } from "../src/surroundingCityScope";
import type { SurroundingCityManifest } from "../src/SurroundingCity";

const manifest: SurroundingCityManifest = JSON.parse(fs.readFileSync(
  new URL("../public/mesh/surrounding-berlin-v159/manifest.json",import.meta.url),"utf8"));
const path = [
  [-3980, 535, 1430], [-3780, 430, 810], [-3720, 480, 118], [6350,-2700,1800], [14500,6500,4400],
];
function distance(b: readonly number[], x: number,z: number){
  return Math.max(b[0]-x,0,x-b[2]) ** 2 + Math.max(b[1]-z,0,z-b[3]) ** 2;
}

test("both lenses retain every expanded-frustum and near tile, including raised and distant sites", () => {
  const tiles=manifest.chunks, ceiling=(t:typeof tiles[number])=>t.id.startsWith("outer")?24:410;
  const local=(t:typeof tiles[number])=>t.id.startsWith("city");
  const select=createSurroundingViewPlanV379(tiles,ceiling,local,t=>!t.detailCompanionOf&&!local(t));
  for(const camera of [new PerspectiveCamera(50,1.7,.5,17000),new OrthographicCamera(-1000,1000,650,-650,.5,17000)]){
    for(const [x,z,y] of path){
      const target=new Vector3(x,2,z);
      camera.position.set(x+y*.5,y,z+y*.9);camera.lookAt(target);camera.updateMatrixWorld();
      const proj=camera.projectionMatrix.clone();proj.elements[0]/=1.18;proj.elements[5]/=1.18;
      const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(proj,camera.matrixWorldInverse));
      const predicted=select(camera,frustum,camera.position,target), box=new Box3();
      const reach=Math.max(1100,1.5*Math.hypot(camera.position.x-x,y,camera.position.z-z))**2;
      const original=tiles.filter(t=>{
        const [w,n,e,s]=t.bounds, eye=distance(t.bounds,camera.position.x,camera.position.z);
        if(local(t)&&eye>reach&&distance(t.bounds,x,z)>reach)return false;
        box.min.set(w,-12,n);box.max.set(e,ceiling(t),s);
        return eye<180**2 || frustum.intersectsBox(box);
      }).sort((a,b)=>distance(a.bounds,x,z)-distance(b.bounds,x,z));
      expect(new Set(predicted.map(t=>t.id))).toEqual(new Set(original.map(t=>t.id)));
      expect(predicted.slice(0,4)).toEqual(original.slice(0,4));
      expect(select(camera,frustum,camera.position,target)).toBe(predicted);
      if (x!==-3980 || !(camera instanceof PerspectiveCamera)) continue;
      const ray=new Raycaster(), plane=new Plane(new Vector3(0,1,0),0);
      for(const sx of [-.62,.62]) for(const sy of [-.28,.28]){
        ray.setFromCamera(new Vector2(sx,sy),camera);
        const ground=ray.ray.intersectPlane(plane,new Vector3())!;
        const t=original.find(t=>!t.detailCompanionOf&&!local(t)&&t.bounds[0]<=ground.x&&ground.x<t.bounds[2]&&t.bounds[1]<=ground.z&&ground.z<t.bounds[3]);
        if(t)expect(predicted.indexOf(t)).toBeLessThan(8);
      }
    }
  }
});

test("spatial ground queries match the real municipal footprint and respect the gardening exclusion",()=>{
  const count=manifest.gardenFootprintStartV330!, polygons=manifest.footprint;
  const at=indexSurroundingFootprintV379(polygons,count);
  const sample=(x:number,z:number)=>expect(at(x,z)).toBe(polygons.slice(0,count).some(p=>surroundingPolygonContains(p,x,z)));
  for(let x=-18000;x<=20000;x+=1853)for(let z=-17000;z<=18000;z+=1657)sample(x,z);
  for(const p of [polygons[0],polygons[125],polygons[count-1],polygons[count]])for(const q of p.ring.slice(0,3))sample(q[0],q[1]);
  const shape={ring:[[0,0],[1024,0],[1024,1024],[0,1024]],holes:[[[50,50],[90,50],[90,90],[50,90]]]};
  const real=indexSurroundingFootprintV379([shape]);expect([real(512,512),real(80,80),real(-1,500)]).toEqual([true,false,false]);
});

test("the early desktop camera recognises represented exterior terrain and excludes the central city and beyond-Berlin views",()=>{
  for (const native of [false,true]) {
    expect(cameraNeedsSurroundingGroundV379(-3980,535,native)).toBeTrue();
    expect(cameraNeedsSurroundingGroundV379(418,300,native)).toBeFalse();
    expect(cameraNeedsSurroundingGroundV379(100000,100000,native)).toBeFalse();
  }
});
