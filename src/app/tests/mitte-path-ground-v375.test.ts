import { expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh, Raycaster, Vector3, type Object3D } from "three";
import {
  createIsometricCityCoreStepsV309,
  createSmoothSurfaces,
  ISO_GROUND_SHADES,
} from "../src/IsometricCityWorld";
import { bindGroundFinishV348 } from "../src/GroundFinishV348";
import { restoreRoadGroundV343 } from "../src/RoadGroundV343";
import { createKulturforumPlazaV343 } from "../src/KulturforumPlazaV343";
import { restoreTiergartenPathsV345 } from "../src/TiergartenPathsV345";
import { attachMittePlazaEdgesV367 } from "../src/MittePlazaEdgesV367";
import { MITTE_PATH_GROUND_V375, restoreMittePathGroundV375 } from "../src/MittePathDepthV375";
import { takeMittePathPreviewV375 } from "../src/mittePathArrivalV375";
import { surfaceFamilyPayload } from "../src/progressiveWorld";
import { smoothGroundTopSampler } from "../src/terrainPayload";
import { createRestoredRoadBatch } from "../src/restoredRoadSurfaces";
import { spreebogenTerrainYAt } from "../src/spreebogenBankProfile";
import { compactStaticGeometry } from "../src/compactStaticGeometry";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import scene from "../public/mesh/regierungsviertel/scene.json";

// Independent downward rays at actual paths in Mitte, Moabit and Tiergarten.
// Each record stores XZ, the old grass roof, and the original way's grade.
const checks = [
  [271.4996, -618.2804, 4.1, 4.00614, "surface-earth"],
  [1184.8345, -382.3732, 2, 1.93524, "restored-paving-2--1"],
  [1352.9028, -398.95, 1.8, 1.53805, "surface-sand"],
  [-412.7594, -1030, 5.4, 5.10886, "surface-earth"],
  [-323.6349, -238.4352, 4.9, 4.70015, "restored-paving--1--1"],
  [-843.8448, -86.7333, 5.2, 4.99273, "surface-sand"],
  [-542.4695, -22.42, 3.5, 3.40279, "restored-paving--2--1"],
  [-240.9927, 104.5574, 4.3, 4.19643, "surface-sand"],
] as const;
function first(root: Object3D, x: number, z: number) {
  return new Raycaster(new Vector3(x, 35, z), new Vector3(0, -1, 0)).intersectObject(root)[0];
}
function productionFloor(): InstancedMesh {
  let floor: InstancedMesh | undefined;
  const it = createIsometricCityCoreStepsV309(prisms, ground, scene.tiergartentunnel, surfaces, {
    buildings: [],
    smoothSurfaces: null,
    retainRasterAsphalt: false,
    invalidenGroundV371: true,
    restoreRoadGroundV343: function* (mesh, g) {
      restoreRoadGroundV343(mesh, g, createKulturforumPlazaV343(g));
      restoreTiergartenPathsV345(mesh, g, surfaces);
      yield* attachMittePlazaEdgesV367(mesh, g, ISO_GROUND_SHADES);
      floor = mesh;
      yield;
    },
  });
  while (!floor && !it.next().done) {
    /* advance through the main-thread floor callback */
  }
  it.return(undefined!);
  if (!floor) throw Error("Ground stage was skipped");
  return floor;
}

test("eight blocked paths transfer from their temporary fragments to the complete streamed surfaces at the original height", async () => {
  const world = new Group(),
    floor = productionFloor();
  world.add(floor);
  world.updateMatrixWorld(true);
  for (const [x, z, roof] of checks) {
    const hit = first(world, x, z);
    expect(hit.object).toBe(floor);
    expect(hit.point.y).toBeCloseTo(roof, 4);
  }
  const oldMatrices = floor.instanceMatrix;
  expect(restoreMittePathGroundV375(floor, ground, [])).toBe(false);
  expect(floor.instanceMatrix).toBe(oldMatrices);
  expect(restoreMittePathGroundV375(floor, ground, ISO_GROUND_SHADES.grass)).toBe(true);
  expect(restoreMittePathGroundV375(floor, ground, ISO_GROUND_SHADES.grass)).toBe(false);
  expect(floor.userData.mittePathGroundV375).toBe(1009);
  // Both sides of the formerly bright four-metre fringe at the ring path in
  // Geschichtspark Moabit are the same surveyed host grass at this height.
  const retained = first(world, -327.9, -898);
  const neighbour = first(world, -325.9, -900.2);
  expect(retained.object.parent?.name).toBe(MITTE_PATH_GROUND_V375);
  expect(retained.object.userData.groundFinishV348).toBe("grass");
  expect(neighbour.object).toBe(floor);
  expect(neighbour.object.userData.groundFinishV348).toBe("core-drawn");
  const lawn = floor.getObjectByName(MITTE_PATH_GROUND_V375)!;
  expect(lawn.children.every(piece => piece.userData.groundFinishV348 === "grass")).toBeTrue();
  expect(bindGroundFinishV348(lawn)).toBe(2); // shared day and night materials
  expect(bindGroundFinishV348(lawn)).toBe(0);
  expect(floor.getObjectByName("Original Mitte path fragments awaiting their source batches")!
    .children.every(piece => !piece.userData.groundFinishV348)).toBeTrue();
  let memory = 0;
  floor.getObjectByName(MITTE_PATH_GROUND_V375)!.traverse((mesh) => {
    if (!(mesh instanceof Mesh)) return;
    compactStaticGeometry(mesh);
    memory += mesh.geometry.index?.array.byteLength ?? 0;
    for (const attr of Object.values(mesh.geometry.attributes)) memory += attr.array.byteLength;
  });
  expect(memory).toBeLessThan(2_100_000);
  world.updateMatrixWorld(true);
  for (const [x, z, , y, batch] of checks) {
    const hit = first(world, x, z);
    expect(hit.object.name).toBe("Original path pending " + batch);
    expect(hit.point.y).toBeCloseTo(y, 4);
  }
  expect(takeMittePathPreviewV375(world, "restored-asphalt--2--1")).toBeUndefined();
  const sample = smoothGroundTopSampler(ground);
  const height = (x: number, z: number) =>
    sample(x / ground.cell_m - ground.grid.min_x_idx, z / ground.cell_m - ground.grid.min_z_idx);
  const ids = new Set<string>(checks.map((c) => c[4]));
  const text = await Bun.file(
    new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url),
  ).text();
  for (const k of ["sand", "earth"] as const) {
    const full = createSmoothSurfaces(
      surfaceFamilyPayload(surfaces, k),
      ground.water_top_y_m ?? 0,
      (ground.water_top_y_m ?? 0) + 5.35,
      height,
      {
        invalidenGroundV371: true,
        parliamentaryDiningV296: true,
        waterfrontV296: true,
        excludeDistrictMarkings: true,
      },
    );
    world.add(full);
    expect(takeMittePathPreviewV375(world, "surface-" + k)?.isMesh).toBe(true);
  }
  for (const line of text.trimEnd().split("\n").slice(1)) {
    const record = JSON.parse(line);
    if (!ids.has(record.id)) continue;
    world.add(createRestoredRoadBatch(record, (x, z) => spreebogenTerrainYAt(x, z, height(x, z)), true));
    expect(takeMittePathPreviewV375(world, record.id)?.isMesh).toBe(true);
  }
  world.updateMatrixWorld(true);
  for (const [x, z, , y, batch] of checks) {
    const hit = first(world, x, z);
    expect(hit.object.name).toBe(
      batch === "surface-earth"
        ? "smooth earth desire paths"
        : batch === "surface-sand"
          ? "smooth park paths"
          : "smooth paved paths",
    );
    expect(hit.point.y).toBeCloseTo(y, 4);
    expect(takeMittePathPreviewV375(world, batch)).toBeUndefined();
  }
}, 90_000);
