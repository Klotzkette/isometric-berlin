import { expect, test } from "bun:test";
import { BoxGeometry, Color, InstancedMesh, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { attachExteriorStreetMarginsV373 } from "../src/ExteriorStreetMarginsV373";
import { ISO_GROUND_SHADES } from "../src/IsometricCityWorld";
import { surroundingPolygonContains } from "../src/SurroundingCityGeometry";
import { createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";
import raster from "../public/mesh/regierungsviertel/ground-context.json";
import surface from "../public/mesh/regierungsviertel/surface-polygons.json";

const ground = raster as unknown as VoxelPayload;
const title = "Surveyed exterior street margins v373";
// Independently located within the original WFS polygons and outside the
// project's existing road polygons, using EPSG:25833 and their material codes.
const sites = [
  { x: -3730.45, z: 656.70, hex: 0xc4c5c0 }, // Charlottenburg, Bismarckstraße, cm_fahrbahn.19564, asphalt 02
  { x: 1241.79, z: 1764.68, hex: 0xdcd8cc }, // Kreuzberg, Hedemannstraße, cl_gehweg.522183, paving 06
  { x: -952.26, z: 1996.81, hex: 0xd3cfc3 }, // Schöneberg, An der Apostelkirche, cm_fahrbahn.42052, mosaic 04
  { x: -3809.91, z: 2135.12, hex: 0xc1cda7 }, // Wilmersdorf, Olivaer Platz, ce_gruenflaeche.302, planted margin
];

function ray(x: number, z: number) {
  return new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0));
}

function attach(slabs: InstancedMesh, payload = ground) {
  for (const _ of attachExteriorStreetMarginsV373(slabs, payload)) { }
}

test("four surveyed street margins fill genuine Drawn cutouts with their original materials", () => {
  const slabs = createGroundSlabs(ground, "Drawn ground slabs", ISO_GROUND_SHADES, {
    skipClasses: ["asphalt"], skipBridge: true, skipWater: true, parkRelief: "drawn",
  });
  for (const { x, z } of sites) {
    expect(ray(x, z).intersectObject(slabs, false)).toHaveLength(0);
    expect(surface.roads.some(road => surroundingPolygonContains(road, 10*x, 10*z))).toBeFalse();
  }
  slabs.userData.tiergartenPathsV345 = true;
  attach(slabs);
  const margins = slabs.getObjectByName(title)!;
  expect(margins).toBeDefined();
  for (const { x, z, hex } of sites) {
    const hits = ray(x, z).intersectObject(margins);
    expect(hits).toHaveLength(1);
    const hit = hits[0], mesh = hit.object as Mesh;
    const actual = new Color().fromBufferAttribute(mesh.geometry.getAttribute("color"), hit.face!.a);
    const expected = new Color(hex);
    expect(Math.abs(actual.r - expected.r)).toBeLessThan(.5/255);
    expect(Math.abs(actual.g - expected.g)).toBeLessThan(.5/255);
    expect(Math.abs(actual.b - expected.b)).toBeLessThan(.5/255);
  }
  // Nollendorfplatz access .504, reserved track .804, George-Grosz-Platz stairs .864.
  for (const [x,z] of [[-1250.235, 2116.325], [-1290.529, 2108.565], [-3694.622, 1840.055]]) {
    expect(ray(x,z).intersectObject(margins)).toHaveLength(0);
  }
  attach(slabs);
  expect(slabs.children).toHaveLength(1);
});

test("street margins require the drawn ground source and its unmodified material runs", () => {
  const slabs = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
  slabs.name = "Drawn ground slabs";
  attach(slabs);
  expect(slabs.children).toHaveLength(0);
  slabs.userData.tiergartenPathsV345 = true;
  slabs.name = "Voxel ground runs";
  attach(slabs);
  expect(slabs.children).toHaveLength(0);
  slabs.name = "Drawn ground slabs";
  attach(slabs, { ...ground, ground_rows: ground.ground_rows.slice(1) });
  expect(slabs.children).toHaveLength(0);
});
