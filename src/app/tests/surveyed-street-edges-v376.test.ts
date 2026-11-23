import { expect, test } from "bun:test";
import { BoxGeometry, Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { attachExteriorStreetMarginsV373 } from "../src/ExteriorStreetMarginsV373";
import { createExtrapolatedMargin, ISO_GROUND_SHADES } from "../src/IsometricCityWorld";
import { attachMittePlazaEdgesV367, MITTE_PLAZA_EDGES_V367 } from "../src/MittePlazaEdgesV367";
import { surroundingPolygonContains } from "../src/SurroundingCityGeometry";
import { createGroundSlabs, smoothGroundTopSampler, type VoxelPayload } from "../src/terrainPayload";
import raster from "../public/mesh/regierungsviertel/ground-context.json";
import surface from "../public/mesh/regierungsviertel/surface-polygons.json";

const ground = raster as unknown as VoxelPayload;

function ray(x: number, z: number) {
  return new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0));
}

test("surveyed sidewalks cross the original four-metre slab at Hardenbergstraße and Friedrichstraße", () => {
  // Stone-sett cl_gehweg.564710 and mosaic cl_gehweg.663702 from the city survey.
  const sites = [
    { x: -3308, z: 720, inside: [-3306.922, 722.273], outside: [-3304.996, 721.739] },
    { x: 1112, z: -248, inside: [1115.325, -245.110], outside: [1113.201, -245.169] },
  ];
  const slabs = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), sites.length);
  slabs.name = "Drawn ground slabs";
  slabs.userData.nightMaterial = slabs.material;
  for (const [index, site] of sites.entries()) {
    const row = site.z / 4 - ground.grid.min_z_idx, col = site.x / 4 - ground.grid.min_x_idx;
    const original = ground.ground_rows[row].find(([start,length]) => start <= col && col < start + length)!;
    expect(ground.classes[original[2]]).toBe("grass");
    slabs.setMatrixAt(index, new Matrix4().makeScale(4, 3, 4).setPosition(site.x + 2, 4.5, site.z + 2));
    slabs.setColorAt(index, new Color(ISO_GROUND_SHADES.grass[0]));
  }
  const originalMatrices = slabs.instanceMatrix.array.slice();
  for (const _ of attachMittePlazaEdgesV367(slabs, ground, ISO_GROUND_SHADES)) { }
  const mesh = slabs.getObjectByName(MITTE_PLAZA_EDGES_V367)!;
  expect(mesh.userData.correctedSurveyedSidewalkCellsV376).toBe(2);
  for (const {inside, outside} of sites) {
    const hits = ray(inside[0], inside[1]).intersectObject(mesh);
    expect(hits).toHaveLength(1);
    expect(hits[0].point.y).toBe(6);
    expect(ray(outside[0],outside[1]).intersectObject(mesh)).toHaveLength(0);
  }
  expect(slabs.instanceMatrix.array).toEqual(originalMatrices);
});

test("Mitte asphalt matches the measured carriageway at exposed diagonal and station approaches", () => {
  const sites = [
    [250.793, -2050.833], // Chausseestraße, cm_fahrbahn.26148
    [-220.823, -779.683], // Invalidenstraße west of the station, cm_fahrbahn.25086
    [-1102.723, -887.260], // Turmstraße, cm_fahrbahn.26426
    [-853.903, -2993.303], // Luxemburger Straße, cm_fahrbahn.26730
  ];
  const slabs = createGroundSlabs(ground, "Drawn ground slabs", ISO_GROUND_SHADES, {
    skipClasses: ["asphalt"], skipBridge: true, skipWater: true, parkRelief: "drawn",
  });
  slabs.userData.tiergartenPathsV345 = true;
  for (const _ of attachExteriorStreetMarginsV373(slabs, ground)) { }
  const road = slabs.getObjectByName("Surveyed road margins in Mitte v376")!;
  // Opaque Three.js draws compare the nearest Group.renderOrder first and
  // Mesh.renderOrder second. A later-writing paper backdrop hid these roads.
  const paper = createExtrapolatedMargin().getObjectByName("extrapolated margin ground")!;
  const segment = road.children[0] as Mesh;
  expect(road.renderOrder).toBe(paper.parent!.renderOrder);
  expect(road.parent!.renderOrder).toBe(paper.parent!.renderOrder);
  expect(paper.renderOrder).toBeLessThan(segment.renderOrder);
  expect(segment.renderOrder).toBeLessThan(slabs.renderOrder);
  expect(segment.userData.dayMaterial.depthWrite).toBeFalse();
  expect(segment.userData.nightMaterial.depthWrite).toBeFalse();
  const grey = new Color(0xc4c5c0);
  const terrain = smoothGroundTopSampler(ground);
  for (const [x,z] of sites) {
    expect(ray(x,z).intersectObject(slabs, false)).toHaveLength(0);
    expect(surface.roads.some(row => surroundingPolygonContains(row, 10*x, 10*z))).toBeFalse();
    const hits = ray(x,z).intersectObject(road);
    expect(hits).toHaveLength(1);
    const hit = hits[0], mesh = hit.object as Mesh;
    const colour = new Color().fromBufferAttribute(mesh.geometry.getAttribute("color"), hit.face!.a);
    expect(Math.abs(colour.r - grey.r)).toBeLessThan(0.5/255);
    expect(Math.abs(colour.g - grey.g)).toBeLessThan(0.5/255);
    expect(Math.abs(colour.b - grey.b)).toBeLessThan(0.5/255);
    const position = mesh.geometry.getAttribute("position");
    for (const i of [hit.face!.a, hit.face!.b, hit.face!.c]) {
      expect(position.getY(i)).toBeCloseTo(terrain(position.getX(i)/4-ground.grid.min_x_idx,
        position.getZ(i)/4-ground.grid.min_z_idx), 4);
    }
  }
});
