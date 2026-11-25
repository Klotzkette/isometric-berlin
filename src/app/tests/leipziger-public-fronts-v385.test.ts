import { expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3, type Object3D } from "three";
import { readFileSync } from "node:fs";
import { createCanadianPublicFrontsV385 } from "../src/LeipzigerPublicFrontsV385";
import { createPedestrianEnvironment } from "../src/pedestrianNavigation";
import { createMallAndVosspalaisDetails } from "../src/MallAndVosspalaisDetails";
import {
  createLeipzigerPlatzDetails,
  leipzigerPlatzPortalAt,
} from "../src/LeipzigerPlatzDetails";

type Edge = { a: number[]; b: number[]; side: number };
const square: Edge = { a: [385.909, 984.756], b: [404.669, 962.634], side: 1 };
const ebert: Edge = { a: [353.874, 955.829], b: [357.474, 932.798], side: -1 };
const west: Edge = { a: [530.479, 992.085], b: [532.9, 1022.642], side: 1 };
const upper: Edge = { a: [532.474, 991.061], b: [534.811, 1020.355], side: 1 };
const vox = JSON.parse(
  readFileSync(
    new URL(
      "../public/mesh/regierungsviertel/minecraft-voxels.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function frontRay(edge: Edge, u: number, y: number) {
  const dx = edge.b[0] - edge.a[0],
    dz = edge.b[1] - edge.a[1],
    len = Math.hypot(dx, dz);
  const nx = (-edge.side * dz) / len,
    nz = (edge.side * dx) / len;
  return new Raycaster(
    new Vector3(
      edge.a[0] + (u * dx) / len + nx * 8,
      y,
      edge.a[1] + (u * dz) / len + nz * 8,
    ),
    new Vector3(-nx, 0, -nz),
    0,
    18,
  );
}

// Independently walk the shipped voxel grid at 2 cm spacing. A decorative
// mesh buried in the original wall is never counted as a visible hit.
function originalBlockDistance(ray: Raycaster): number {
  const p = new Vector3();
  for (let d = 0; d < 16; d += 0.02) {
    ray.ray.at(d, p);
    const ix = Math.floor(p.x / vox.cell_m) - vox.grid.min_x_idx;
    const iz = Math.floor(p.z / vox.cell_m) - vox.grid.min_z_idx;
    if (
      vox.building_rows[iz].some(
        ([start, n, low, high]: number[]) =>
          ix >= start && ix < start + n && p.y >= low / 10 && p.y <= high / 10,
      )
    )
      return d;
  }
  return Infinity;
}

function visible(
  object: Object3D,
  edge: Edge,
  u: number,
  y: number,
  native: boolean,
) {
  const ray = frontRay(edge, u, y);
  const hit = ray.intersectObject(object, true)[0];
  expect(hit?.object, `Facade at ${edge.a}, u=${u}, y=${y}`).toBeInstanceOf(
    Mesh,
  );
  expect(hit.distance).toBeLessThan(native ? originalBlockDistance(ray) : 8);
}

for (const native of [false, true]) {
  test(`public Canadian elevations face the square and Ebertstraße (${native ? "blocks" : "drawn"})`, () => {
    const group = createCanadianPublicFrontsV385(native);
    group.updateMatrixWorld(true);
    // All three broad louvred bays, louvers seen against a coarse protruding
    // voxel, and the centre of the second public street's continuous screen.
    for (const u of [7.3, 13.1, 14.5, 18.8, 21.7])
      visible(group, square, u, 15.04, native);
    for (const u of [4.45, 7.33, 12.35, 16.34, 19.05])
      visible(group, ebert, u, 20.04, native);
    expect(group.children).toHaveLength(1);
  });

  test(`the five Mall bays and their five upper pairs face the U-Bahn entrance (${native ? "blocks" : "drawn"})`, () => {
    const group = createMallAndVosspalaisDetails({ minecraft: native });
    group.updateMatrixWorld(true);
    const lowerWidth = Math.hypot(west.b[0] - west.a[0], west.b[1] - west.a[1]);
    const upperWidth = Math.hypot(
      upper.b[0] - upper.a[0],
      upper.b[1] - upper.a[1],
    );
    for (let bay = 0; bay < 5; bay++) {
      visible(group, west, ((bay + 0.5) * lowerWidth) / 5, 15.15, native);
      for (const side of [-1, 1])
        visible(
          group,
          upper,
          ((bay + 0.5) * upperWidth) / 5 + side * 0.74,
          30.22,
          native,
        );
    }
    // Directly above the two mapped cross spans are two decks. The central
    // point between them remains open up to the transparent barrel roof.
    for (const [x, z] of [
      [635.35, 977.53],
      [631.685, 930.615],
    ]) {
      const ray = new Raycaster(new Vector3(x, 19, z), new Vector3(0, -1, 0));
      const heights = ray.intersectObject(group, true).map((h) => h.point.y);
      for (const deck of [10.25, 15.58])
        expect(heights.some((h) => Math.abs(h - deck - 0.165) < 0.015)).toBe(
          true,
        );
    }
    const axis = new Raycaster(
      new Vector3(633.5, 18, 953.6),
      new Vector3(0, -1, 0),
      0,
      12,
    );
    expect(axis.intersectObject(group, true)).toHaveLength(0);
  });
}

test("the embassy relief is present on its original drawn entry and the entrance faces the photographed square", () => {
  const root = createLeipzigerPlatzDetails();
  expect(
    root.getObjectByName(
      "Canadian Embassy · Leipziger Platz and Ebertstraße public elevations",
    ),
  ).toBeDefined();
  expect(
    leipzigerPlatzPortalAt(395.29, 8.35, 973.695, "DEBE3DYO57c7Jtdb")?.id,
  ).toBe("canadian-embassy-square-entrance");
  expect(
    leipzigerPlatzPortalAt(380.147, 8.35, 919.466, "DEBE3DLjGyKuiciJ"),
  ).toBeNull();
});

test("the full public Piazza footprint stays paved up to both streets in both styles", () => {
  const city = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
  const bridges = city.buildings.filter((b: {id:string})=>["ANtdjIMa","f8929NwV"].includes(b.id));
  const environment = createPedestrianEnvironment(vox,{water:[]},null,{buildings:bridges});
  for (const minecraft of [false,true]) {
    environment.visualMode = ()=>minecraft ? "minecraft" : "day";
    const root = createMallAndVosspalaisDetails({ minecraft });
    root.updateMatrixWorld(true);
    const floor = root.getObjectByName("Mall Piazza · continuous public stone paving") as Mesh;
    const vertices = floor.geometry.getAttribute("position");
    let area = 0;
    for (let i=0; i<vertices.count; i+=3) {
      const x = vertices.getX(i), z = vertices.getZ(i);
      area += Math.abs((vertices.getX(i+1)-x)*(vertices.getZ(i+2)-z) -
        (vertices.getZ(i+1)-z)*(vertices.getX(i+2)-x)) / 2;
    }
    expect(area).toBeCloseTo(2328.6659,1); // projected cadastral-grid area of OSM way 194066305
    for (const [x,z,inside] of [[630,905,1],[635,952,1],[638,984,1],[640,1009,1],
      [645,1002,1],[650,980,0],[626,1009,0],[618,927,0],[650,912,0]]) {
      const down = new Raycaster(new Vector3(x,8,z),new Vector3(0,-1,0));
      const hits = down.intersectObject(floor);
      expect(hits.length>0).toBe(Boolean(inside));
      if (inside) expect(environment.groundAt(x,z)).toBeCloseTo(hits[0].point.y,4);
    }
  }
});

test("the paved Piazza clears the actual midpoint-graded turf at both street approaches and between every grass row", async () => {
  const { mallPiazzaFootwayV385 } = await import("../src/leipzigerPlatzSourceProfile");
  const { pointInPedestrianRing } = await import("../src/pedestrianNavigation");
  for (const name of ["ground-context","minecraft-voxels"]) {
    const ground = await Bun.file(new URL(`../public/mesh/regierungsviertel/${name}.json`,import.meta.url)).json();
    const floor = createMallAndVosspalaisDetails({minecraft:name==="minecraft-voxels"})
      .getObjectByName("Mall Piazza · continuous public stone paving") as Mesh;
    floor.updateMatrixWorld(true);
    const {grid, ground_height: h, cell_m: cell} = ground;
    let count = 0, clearance = Infinity;
    for (let zi=896; zi<1016; zi+=4) {
      const row = zi/cell - grid.min_z_idx;
      const grass = ground.ground_rows[row];
      for (const z of [zi+.015,zi+2,zi+3.985]) for (let x=619.5;x<=647.5;x++) {
        if (!pointInPedestrianRing(x,z,mallPiazzaFootwayV385)) continue;
        const col = Math.floor(x/cell) - grid.min_x_idx;
        const [start,run] = grass.find(([a,n]:number[])=>a<=col && col<a+n);
        const oldTop = h.y_dm[Math.floor(row/h.stride_cells)*h.cols+
          Math.floor((start+run/2)/h.stride_cells)]/10;
        const hit = new Raycaster(new Vector3(x,8,z),new Vector3(0,-1,0)).intersectObject(floor)[0];
        expect(hit).toBeDefined();
        clearance = Math.min(clearance,hit.point.y-oldTop);
        count++;
      }
    }
    expect(count).toBeGreaterThan(1500);
    expect(clearance).toBeGreaterThan(.04);
  }
});
