import { expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry } from "three";
import { refineCoreParkReliefSurface } from "../src/parkReliefSurfaceV182";

test("hill refinement preserves outside faces, complete source area and winding", () => {
  const g = new BufferGeometry();
  const p = new Float32Array([1000,0,-3100, 1064,0,-3100, 1000,0,-3036, 0,0,0, 64,0,0, 0,0,64]);
  g.setAttribute("position",new BufferAttribute(p,3)); g.setIndex([0,1,2,3,4,5]);
  const r = refineCoreParkReliefSurface(g), a=r.getAttribute("position"), indices=r.getIndex()!;
  expect(Array.from(a.array.slice(0,p.length))).toEqual(Array.from(p));
  expect(Array.from(indices.array.slice(-3))).toEqual([3,4,5]);
  let area=0;
  for(let i=0;i<indices.count;i+=3){
    const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
    const x=ids.map(j=>a.getX(j)),z=ids.map(j=>a.getZ(j));
    const cross=(x[1]-x[0])*(z[2]-z[0])-(z[1]-z[0])*(x[2]-x[0]);
    expect(cross).toBeGreaterThan(0); area+=cross/2;
    if(x[0]>500) for(let j=0;j<3;j++) expect(Math.hypot(x[j]-x[(j+1)%3],z[j]-z[(j+1)%3])).toBeLessThanOrEqual(4.000001);
  }
  expect(area).toBe(4096);expect(a.count).toBeLessThan(1000);
  g.dispose();r.dispose();
});
