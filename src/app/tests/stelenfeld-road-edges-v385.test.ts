import { expect, test } from "bun:test";
import { Mesh, Raycaster, Triangle, Vector3 } from "three";
import { createMemorialLandmarks, setStelenfeldPresentation } from "../src/MemorialLandmarks";
import { stelenfeldGroundAtV385 } from "../src/holocaustField";
import { stelenfeldRenderDataV385 } from "../src/stelenfeldRimV385";
import { STELENFELD_ANCHOR, STELENFELD_BASE, stelenfeldOwnsGroundCell } from "../src/stelenfeldSiteV385";
import { CLASS_SHADES, createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";

// These nine furnished-viewer rays ended on grass after every local restored
// asphalt/paving batch had loaded. The third coordinate is the original top.
const patches = [
  [446,638,4.30], [486,626,4.20], [522,618,4.30],
  [546.14,500.13,4.70], [553.51,525.07,4.60], [392.93,559.74,4.50],
  [388.77,587.92,4.50], [385.57,609.76,4.30], [564.22,561.38,4.60],
];

test("the public memorial presents its seven surveyed carriageway gaps on the same mesh and walking surface", () => {
  const field = createMemorialLandmarks([{
    name: "Denkmal für die ermordeten Juden Europas",
    world: [STELENFELD_ANCHOR[0],8,STELENFELD_ANCHOR[1]],
  }]);
  const floor = field.getObjectByName("Stelenfeld surveyed alley pavement") as Mesh;
  const down = new Vector3(0,-1,0);
  const heights = (x:number,z:number) => new Raycaster(new Vector3(x,12,z),down).intersectObject(floor);
  for (const [native,snow] of [[false,false],[true,false],[false,true],[false,false]]) {
    setStelenfeldPresentation(field,native,snow);
    field.updateMatrixWorld(true);
    for (const [x,z,grass] of patches) {
      const hit=heights(x,z)[0];
      const walk=stelenfeldGroundAtV385(x,z,native);
      expect(walk).not.toBeNull();
      expect(hit.point.y).toBeCloseTo(walk!,3);
      expect(hit.point.y).toBeGreaterThan(grass + (native ? .015 : .025));
      expect(hit.point.y-grass).toBeLessThan(.24);
    }
    expect(heights(382,634)).toHaveLength(0);
    expect(stelenfeldGroundAtV385(382,634,native)).toBeNull();
  }
});

test.each([false,true])("every surveyed asphalt facet clears the actual retained terrain, native=%s", async native => {
  const file = new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url);
  const input = await Bun.file(file).json() as VoxelPayload;
  // Keep whole original runs, including where the memorial splits a covering
  // grass slab and changes which source DTM midpoint its writer samples.
  const ground_rows = input.ground_rows.map((runs, row) => {
    const z = (input.grid.min_z_idx + row) * input.cell_m;
    return z < 484 || z > 656 ? [] : runs.filter(([offset, length]) => {
      const x = (input.grid.min_x_idx + offset) * input.cell_m;
      return x < 580 && x + length * input.cell_m > 378;
    });
  });
  const slabs = createGroundSlabs({ ...input, ground_rows }, "Memorial ground runs", CLASS_SHADES, {
    parkRelief: native ? "native" : "drawn", skipAtWorld: stelenfeldOwnsGroundCell,
    skipClasses: native ? [] : ["asphalt"],
  });
  slabs.updateMatrixWorld(true);
  const { drawn, native: blocks, indices, roadStart } = stelenfeldRenderDataV385();
  const data = native ? blocks : drawn;
  const point = (index:number) => new Vector3().fromArray(data, 3*index).add(
    new Vector3(STELENFELD_ANCHOR[0], STELENFELD_BASE, STELENFELD_ANCHOR[1]));
  const direction = new Vector3(0,-1,0);
  const controls = [new Vector3(559.88,0,566.6), new Vector3(382,0,634)];
  let facets = 0, overControl = 0;
  const obscured: number[][] = [];
  for (let i=0; i<indices.length; i+=3) {
    if (indices[i] < roadStart) continue;
    const triangle = new Triangle(point(indices[i]), point(indices[i+1]), point(indices[i+2]));
    const centre = triangle.getMidpoint(new Vector3());
    const ray = new Raycaster(new Vector3(centre.x, 12, centre.z), direction);
    const target = ray.intersectObject(slabs)[0];
    if (!target || centre.y < target.point.y + .014) obscured.push([centre.x,centre.z,centre.y,target?.point.y ?? NaN]);
    for (const control of controls) {
      ray.ray.origin.set(control.x,12,control.z);
      if (ray.ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,new Vector3())) overControl++;
    }
    facets++;
  }
  expect(obscured).toEqual([]);
  expect(facets).toBe(369);
  expect(overControl).toBe(0);
});
