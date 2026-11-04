import { expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { BND_PUBLIC_ART_V314, createBndPublicArtV314 } from "../src/BndPublicArtV314";
import { bndArtCourtOwnershipV314 } from "../src/bndArtCourtOwnershipV314";
import {
  createBndHeadquartersV174,
  createMinecraftBndHeadquartersV174,
} from "../src/BndHeadquartersV174";
import { createSmoothSurfaces, type SurfacePayload } from "../src/IsometricCityWorld";
import { createNativeOttoWeidtFountainV314, matchesOttoWeidtBasinV314 } from "../src/OttoWeidtFountainV314";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { type VoxelPayload } from "../src/terrainPayload";
import { readdirSync } from "node:fs";

const asset = (path: string): URL => new URL(`../public/mesh/regierungsviertel/${path}`, import.meta.url);

async function court(native: boolean, enabled: boolean): Promise<Group> {
  const dir = new URL(`../src/data/altMitteV169${native ? "Native" : "Drawn"}/`, import.meta.url);
  const root = new Group();
  const options = bndArtCourtOwnershipV314({
    bndPublicArtV314: enabled, neighbourhoodV300: true, westKiezV302: true,
    golgathaV270: true, tachelesFrontsV270: true, northernSitesV266: true,
    chariteBridgesV265: true, schlossplatzV239: true, staatsoperV240: true,
    architectureV241: true, littenStadthausV297: true, wallGalleryV298: true,
  });
  for (const file of readdirSync(dir)) {
    const packet = (await Bun.file(new URL(file, dir)).json()) as SurroundingCityChunk & { id: string };
    if (!packet.id.startsWith("0_-4")) continue;
    const steps = buildSurroundingCityChunk(packet, `alt-mitte-v169-${packet.id}`, native, false, options);
    let next = steps.next();
    while (!next.done) next = steps.next();
    root.add(next.value.root);
  }
  root.add(native ? createMinecraftBndHeadquartersV174() : createBndHeadquartersV174());
  root.updateMatrixWorld(true);
  return root;
}

function hits(root: Group, x: number, z: number) {
  return new Raycaster(new Vector3(x, 60, z), new Vector3(0, -1, 0))
    .intersectObject(root, true).filter((hit) => hit.face);
}

test.each([false, true])("BND public art and its exact live predecessor court, native=%s", async (native) => {
  const old = await court(native, false), opened = await court(native, true);
  const short = BND_PUBLIC_ART_V314.palms[0];
  const tall = BND_PUBLIC_ART_V314.palms[1];
  const sculpture = BND_PUBLIC_ART_V314.monolith;
  expect(hits(old, short.x, short.z)[0].point.y).toBeGreaterThan(17.9);
  expect(hits(old, sculpture.x, sculpture.z)[0].point.y).toBeGreaterThan(17.9);
  expect(hits(opened, short.x, short.z)[0].point.y).toBeCloseTo(short.groundY, 2);
  expect(hits(opened, sculpture.x, sculpture.z)[0].point.y).toBeCloseTo(sculpture.groundY, 2);
  expect(hits(opened, tall.x, tall.z)).toHaveLength(0);
  expect(opened.children.reduce((n, child) => n + (child.userData.sourceQuarterTrianglesV303 ?? 0), 0))
    .toBe(native ? 978 : 33);
  expect(opened.children.reduce((n, child) => n + (child.userData.sourceQuarterLineSegmentsV303 ?? 0), 0))
    .toBe(native ? 0 : 15);
  const art = createBndPublicArtV314(native);
  opened.add(art);
  opened.updateMatrixWorld(true);
  for (const object of [short, tall, sculpture]) {
    const hit = hits(opened, object.x, object.z)[0];
    expect(hit.object.parent).toBe(art);
    expect(hit.point.y).toBeGreaterThan(object.groundY + 2.5);
  }
  const streetEye = new Vector3(
    sculpture.x + Math.cos(sculpture.angle) * 56,
    7.2,
    sculpture.z + Math.sin(sculpture.angle) * 56,
  );
  const sightline = new Vector3(sculpture.x, 11.2, sculpture.z).sub(streetEye).normalize();
  const firstStreetFace = new Raycaster(streetEye, sightline).intersectObject(opened, true).find((hit) => hit.face);
  expect(firstStreetFace?.object.parent).toBe(art);
  if (native) {
    const mesh = art.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      for (const index of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[index]).toBe(0);
    }
  }
});

test("Otto-Weidt-Platz replaces only the exact old basin with a low granite water stone and jets", async () => {
  const original = (await Bun.file(asset("surface-polygons.json")).json()) as SurfacePayload;
  const basin = original.water.find(matchesOttoWeidtBasinV314)!;
  expect(basin).toBeDefined();
  const other = { ...basin, ring: basin.ring.map(([x, z]) => [x + 1000, z]) };
  expect(matchesOttoWeidtBasinV314(other)).toBe(false);
  const world = createSmoothSurfaces({ schema_version: original.schema_version, parks: [], water: [basin, other] }, 0.9, 5.2, () => 5.2);
  expect(world.getObjectByName("basin water")).toBeInstanceOf(Mesh);
  const granite = world.getObjectByName("Otto-Weidt-Platz rounded granite water stone")!;
  const water = world.getObjectByName("Otto-Weidt-Platz fountain water")!;
  const jets = world.getObjectByName("Otto-Weidt-Platz jets and spray")!;
  const bounds = new Box3().setFromObject(granite);
  expect(bounds.min.y).toBeCloseTo(5.32, 2);
  expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.65, 2);
  expect(new Box3().setFromObject(jets).max.y).toBeGreaterThan(bounds.max.y + 0.7);
  expect(water.userData.dayMaterial.color.getHex()).toBe(0x628da1);
});

test("Native fountain caps precisely the retained basin cells and leaves a changed source alone", async () => {
  const source = (await Bun.file(asset("minecraft-voxels.json")).json()) as VoxelPayload;
  const root = createNativeOttoWeidtFountainV314(source)!;
  expect(root.userData.coveredBasinCells).toBe(12);
  const mesh = root.children[0] as InstancedMesh;
  const matrix = new Matrix4();
  for (let i = 0; i < 12; i++) {
    mesh.getMatrixAt(i, matrix);
    expect(matrix.elements[0]).toBe(4);
    expect(matrix.elements[10]).toBe(4);
    expect(matrix.elements[13] + matrix.elements[5] / 2).toBeCloseTo(5.232, 3);
  }
  const rows = [...source.ground_rows];
  const row = -1620 / 4 - source.grid.min_z_idx;
  rows[row] = rows[row].filter((entry) => entry[2] !== source.classes.indexOf("basin"));
  expect(createNativeOttoWeidtFountainV314({ ...source, ground_rows: rows })).toBeNull();
});
