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

function kerbEndpoints(slabs: InstancedMesh, include: (x: number, z: number) => boolean, expectedY?: number): number[] {
  attach(slabs);
  const steps = createKerbLinesSteps(ground, new Set(["asphalt", "water", "basin"]),
    (x, z) => !include(x, z), undefined, getPathEdgeInkV373(slabs));
  let result = steps.next();
  while (!result.done) result = steps.next();
  const geometry = result.value!.geometry;
  const positions = geometry.getAttribute("position");
  const endpoints: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    endpoints.push(positions.getX(i), positions.getZ(i));
    if (expectedY !== undefined) expect(positions.getY(i)).toBeCloseTo(expectedY, 4);
  }
  geometry.dispose();
  return endpoints;
}

test("two level neighbouring slabs replace their raster kerb with the straight edge of OSM way 57732140", () => {
  const first = [180, 2528] as const, second = [180, 2532] as const;
  const include = (x: number, z: number) => x === 182 && (z === 2530 || z === 2534);
  const original = [180, 2532, 184, 2532];
  expect(kerbEndpoints(host([first]), include)).toEqual(original);
  const uneven = host([first, second]);
  const matrix = new Matrix4();
  uneven.getMatrixAt(1, matrix);
  matrix.elements[13] += 1;
  uneven.setMatrixAt(1, matrix);
  expect(kerbEndpoints(uneven, include)).toEqual(original);
  const actual = kerbEndpoints(host([first, second]), include, 6.22);
  // Intersections with x = 180 and 184 measured against the original OSM polygon.
  const expected = [180, 2532.851143, 184, 2534.170065];
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 3));
});

test("a raster kerb adjoining OSM way 5748424 retains its unconfirmed stretch", () => {
  const slabs = host([[-1984, 1784], [-1980, 1784]]);
  const include = (x: number, z: number) => z === 1786 && (x === -1982 || x === -1978);
  expect(kerbEndpoints(slabs, include)).toEqual([-1980, 1784, -1980, 1788]);
});
