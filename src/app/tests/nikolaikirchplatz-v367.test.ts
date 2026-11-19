import { expect, test } from "bun:test";
import { Raycaster, Vector3 } from "three";
import source from "../src/data/nikolaikirchplatzV367.json";
import { NIKOLAI_FOUNTAIN_V353 } from "../src/NikolaiFountainV353";
import { createNikolaikirchplatzV367 } from "../src/NikolaikirchplatzV367";

test("the measured fountain footprint and the register share one physical model", () => {
  expect(source.fountain).toEqual([NIKOLAI_FOUNTAIN_V353.x,NIKOLAI_FOUNTAIN_V353.z]);
  expect(source.furniture.filter(p=>p.material==="seat")).toHaveLength(21);
});

for (const native of [false,true]) {
  test(`surveyed square has one finite batch, covered walkways and an open fountain base in ${native?"Native":"Drawn"}`, () => {
    const mesh = createNikolaikirchplatzV367(native);
    mesh.updateMatrixWorld();
    const hits = (x: number,z: number) => new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0))
      .intersectObject(mesh).map(h=>h.point.y);
    const geometry = mesh.geometry;
    expect(geometry.getAttribute("position").count).toBeLessThan(36000);
    expect(geometry.getAttribute("uv")).toBeUndefined();
    const setts = geometry.getAttribute("settSize");
    if (native) {
      expect(setts).toBeUndefined();
    } else {
      expect(setts.count).toBe(geometry.getAttribute("position").count);
      expect(new Set(setts.array)).toEqual(new Set([0, 1, 2]));
    }
    expect(geometry.index!.count/3).toBeLessThan(23000);
    expect(geometry.boundingSphere!.radius).toBeLessThan(95);
    // Survey exclusions: three tree pits, a monument plinth and the fountain.
    for (const [x,z] of [[2390.24,304.62],[2394.20,308.62],[2389.53,309.06],[2400.32,288.56],source.fountain]) {
      expect(hits(x,z)).toHaveLength(0);
    }
    expect(hits(2409,284)).toHaveLength(0); // Interior of the stone westwork.
    for (const [x,z] of [[2392,291],[2400,276],[2460,305],[2380,313]]) {
      const top = hits(x,z)[0];
      expect(top).toBeGreaterThan(3.09);
      expect(top).toBeLessThan(3.17);
    }
    // These pixels intersected the old ochre 4_0 road cap at y=3.12 in
    // production. Both projections must show surveyed forecourt at this height.
    for (const [x,z] of [[2396.674,293.061],[2398.141,295.563],[2394.361,287.353],[2399.707,304.674]]) {
      expect(hits(x,z)[0]).toBeCloseTo(3.145,3);
    }
    expect(hits(source.fountain[0]+2.45,source.fountain[1])[0]).toBeCloseTo(3.145,3);
    const p = geometry.getAttribute("position");
    expect(Array.from(p.array).every(Number.isFinite)).toBeTrue();
    for (const part of source.furniture.filter(s=>s.material==="seat")) {
      const x=source.origin[0]+part.points.reduce((v,p)=>v+p[0],0)/400;
      const z=source.origin[1]+part.points.reduce((v,p)=>v+p[1],0)/400;
      expect(hits(x,z)[0]).toBeCloseTo(3.58,2);
    }
    mesh.material.dispose(); mesh.userData.nightMaterial.dispose(); geometry.dispose();
  });
}
