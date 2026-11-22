import { expect, test } from "bun:test";
import { BoxGeometry, Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { attachMittePlazaEdgesV367, MITTE_PLAZA_EDGES_V367 } from "../src/MittePlazaEdgesV367";
import { createKerbLinesSteps, ISO_GROUND_SHADES } from "../src/IsometricCityWorld";
import { getPathEdgeInkV373 } from "../src/pathEdgeInkV373";
import type { VoxelPayload } from "../src/terrainPayload";
import raster from "../public/mesh/regierungsviertel/ground-context.json";

const ground = raster as unknown as VoxelPayload;
type Point = readonly [number, number];

// Real source cells on the Deutsches Technikmuseum grounds, independently
// inspected in osm.gpkg. In both cases the cell centre lies outside the way.
const apron = {
  origin: [356, 2336], inside: [357, 2337], outside: [359, 2339],
} as const; // OSM way 55500825, unhewn cobblestone
const footway = {
  origin: [180, 2532], inside: [183, 2533], outside: [181, 2535],
} as const; // OSM way 57732140, unhewn cobblestone

function host(origins: readonly Point[], name = "Drawn ground slabs", width = 4) {
  const slabs = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), origins.length);
  slabs.name = name;
  slabs.userData.nightMaterial = slabs.material;
  origins.forEach(([x,z], i) => {
    const row = z / 4 - ground.grid.min_z_idx, col = x / 4 - ground.grid.min_x_idx;
    const run = ground.ground_rows[row].find(([start, length]) => col >= start && col < start + length)!;
    const paint = ISO_GROUND_SHADES[ground.classes[run[2]]][0];
    slabs.setMatrixAt(i, new Matrix4().makeScale(width, 3, 4).setPosition(x + width / 2, 4.5, z + 2));
    slabs.setColorAt(i, new Color(paint));
  });
  return slabs;
}

function attach(slabs: InstancedMesh) {
  for (const _ of attachMittePlazaEdgesV367(slabs, ground, ISO_GROUND_SHADES)) { }
}

function paintAt(slabs: InstancedMesh, [x,z]: Point) {
  const surface = slabs.getObjectByName(MITTE_PLAZA_EDGES_V367) as Mesh | undefined;
  if (!surface) return null;
  const hit = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObject(surface)[0];
  if (!hit) return null;
  expect(hit.point.y).toBe(6);
  return new Color().fromBufferAttribute(surface.geometry.getAttribute("color"), hit.face!.a);
}

test("two mapped Kreuzberg cobblestone edges change the finish within one four-metre cell", () => {
  const slabs = host([apron.origin, footway.origin]);
  const transforms = slabs.instanceMatrix.array.slice();
  const paving = new Color(ISO_GROUND_SHADES.plazaBrick[0]);
  attach(slabs);
  for (const area of [apron, footway]) {
    const paint = paintAt(slabs, area.inside);
    expect(paint).not.toBeNull();
    expect(paint!.r).toBeCloseTo(paving.r, 4);
    expect(paint!.g).toBeCloseTo(paving.g, 4);
    expect(paint!.b).toBeCloseTo(paving.b, 4);
    expect(paintAt(slabs, area.outside)).toBeNull();
  }
  expect(slabs.instanceMatrix.array).toEqual(transforms);
  expect(slabs.children).toHaveLength(1);
  attach(slabs);
  expect(slabs.children).toHaveLength(1);
});

test("a neighbouring paved street at Walter-Benjamin-Platz does not acquire a grass edge", () => {
  // This point lies outside OSM pedestrian area 26808681 but inside a
  // retained surface-polygons.json street. Grass cannot be inferred here.
  const slabs = host([[-3876,1812]]);
  attach(slabs);
  expect(paintAt(slabs, [-3873.355,1814])).toBeNull();
});

test("native or partial floor cells do not acquire the source edge or retire their kerbs", () => {
  for (const slabs of [host([apron.origin], "Voxel ground runs"), host([apron.origin], "Drawn ground slabs", 2)]) {
    attach(slabs);
    expect(slabs.children).toHaveLength(0);
    expect(getPathEdgeInkV373(slabs)?.size ?? 0).toBe(0);
  }
});

test("the straight edge of OSM way 5748424 replaces the four-metre kerb only after both slabs survive", () => {
  // OSM at this location crosses x = -1984 and -1980 at the street coordinates below.
  // The original terrain line is vertical at x = -1980.
  const first = [-1984, 1784] as const, second = [-1980, 1784] as const;
  const skipOtherCells = (x: number, z: number) => z !== 1786 || (x !== -1982 && x !== -1978);
  function endpoints(owners: readonly Point[]): number[] {
    const slabs = host(owners);
    attach(slabs);
    const steps = createKerbLinesSteps(ground, new Set(["asphalt", "water", "basin"]),
      skipOtherCells, undefined, getPathEdgeInkV373(slabs));
    let result = steps.next();
    while (!result.done) result = steps.next();
    const geometry = result.value!.geometry;
    const positions = geometry.getAttribute("position");
    expect(positions.count).toBe(2);
    const endpoints = [positions.getX(0), positions.getZ(0), positions.getX(1), positions.getZ(1)];
    geometry.dispose();
    return endpoints;
  }
  expect(endpoints([first])).toEqual([-1980, 1784, -1980, 1788]);
  const actual = endpoints([first, second]);
  const expected = [-1984, 1784.715, -1980, 1786.369];
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 3));
});
