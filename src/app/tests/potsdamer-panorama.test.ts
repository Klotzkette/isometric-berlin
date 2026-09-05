import { expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh } from "three";
import {
  inPotsdamerPanoramaLandscape,
  hasPotsdamerUpperStoreys,
  POTSDAMER_UPPER_STOREYS,
  POTSDAMER_PANORAMA_BUILDINGS,
  POTSDAMER_PANORAMA_LANDSCAPE,
  potsdamerPanoramaMaterialFor,
} from "../src/potsdamerPanoramaPalette";
import { potsdamerPanoramaRoofBoxes } from "../src/potsdamerPanoramaRoofs";
import { createDistantBuildingShells, createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import { buildColumnToneLookup } from "../src/MinecraftVoxelWorld";
import { treeFoliageTone, type ParkTree } from "../src/ParkDetails";
import { addBox, createBuilder, finishDrawnGroup } from "../src/drawnKit";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;

test("panorama colours retain 20 complete source groups and 276 real prism identities", () => {
  const ids = POTSDAMER_PANORAMA_BUILDINGS.flatMap(building => [...building.prismIds]);
  expect(POTSDAMER_PANORAMA_BUILDINGS).toHaveLength(20);
  expect(ids).toHaveLength(276);
  expect(new Set(ids).size).toBe(ids.length);
  const source = new Map(payload.buildings.map(building => [building.id, building]));
  for (const id of ids) {
    const building = source.get(id)!;
    expect(building).toBeDefined();
    for (const [x, z] of building.ring) {
      expect(x / 10).toBeGreaterThan(-240);
      expect(x / 10).toBeLessThan(420);
      expect(z / 10).toBeGreaterThan(1060);
      expect(z / 10).toBeLessThan(1690);
    }
  }
  expect(potsdamerPanoramaMaterialFor("K0002MCN")).toBeUndefined();
});

test("gold, terracotta, glass and pale residential facades stay distinct in distant shells", () => {
  const ids = ["eVfooGWp", "AOI6FuOL", "7tOasE68", "GlU2rEzg"];
  const buildings = ids.map(id => payload.buildings.find(building => building.id === id)!);
  const group = createDistantBuildingShells(payload, buildings);
  const shell = group.children[0] as InstancedMesh;
  expect(shell).toBeInstanceOf(InstancedMesh);
  const color = new Color();
  for (let i = 0; i < buildings.length; i += 1) {
    shell.getColorAt(i, color);
    expect(color.getHex()).toBe(potsdamerPanoramaMaterialFor(buildings[i].id)!.facade);
  }
  shell.geometry.dispose();
});

test("Minecraft uses the same photo-supported facade hue even without a sampled tone", () => {
  const id = "AOI6FuOL";
  const lookup = buildColumnToneLookup({ buildings: [{ id, ring: [[0, 0], [100, 0], [100, 100], [0, 100]] }] });
  expect(lookup(5, 5)).toBe(potsdamerPanoramaMaterialFor(id)!.facade);
  expect(lookup(15, 15)).toBeNull();
});

test("grey upper storeys subdivide the existing walls without internal caps or overlapping skins", () => {
  const source = payload.buildings.find(building => building.id === "AOI6FuOL")!;
  const building = { ...source, ring: [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][], holes: [], h_dm: 400, y0_dm: 0, roof: 1000 };
  expect(hasPotsdamerUpperStoreys(building.id, 40)).toBe(true);
  expect(hasPotsdamerUpperStoreys(building.id, 15)).toBe(false);
  expect(hasPotsdamerUpperStoreys("unrelated", 40)).toBe(false);
  const group = createIsometricCity({ ...payload, buildings: [building] }, null);
  const mesh = group.getObjectByName("LoD2 prism buildings") as Mesh;
  const positions = mesh.geometry.getAttribute("position");
  const colors = mesh.geometry.getAttribute("color");
  const boundary = POTSDAMER_UPPER_STOREYS.startM;
  let lower = 0;
  let upper = 0;
  for (let i = 0; i < positions.count; i += 3) {
    const ys = [positions.getY(i), positions.getY(i + 1), positions.getY(i + 2)];
    const min = Math.min(...ys), max = Math.max(...ys);
    expect(min < boundary - 0.001 && max > boundary + 0.001).toBe(false);
    expect(ys.every(y => Math.abs(y - boundary) < 0.001)).toBe(false);
    if (max - min < 1) continue;
    if (min >= boundary - 0.001) {
      expect(colors.getX(i)).toBeLessThan(colors.getZ(i));
      upper += 1;
    } else {
      expect(colors.getX(i)).toBeGreaterThan(colors.getZ(i) * 2);
      lower += 1;
    }
  }
  expect(lower).toBe(8);
  expect(upper).toBe(8);
  mesh.geometry.dispose();
});

test("local foliage changes preserve source trees and special red/silver species", () => {
  const tree: ParkTree = { id: "test", position: [210, 5, 1420], crown_radius_m: 4, height_m: 12, leaf_type: "broadleaf", variant: 0 };
  expect(treeFoliageTone(tree)).toBe(POTSDAMER_PANORAMA_LANDSCAPE.foliage[0]);
  expect(treeFoliageTone({ ...tree, position: [300, 5, 0] })).not.toBe(treeFoliageTone(tree));
  for (const species of ["Blutbuche", "Silber-Linde"]) {
    expect(treeFoliageTone({ ...tree, species })).toBe(treeFoliageTone({ ...tree, species, position: [300, 5, 0] }));
  }
  expect(inPotsdamerPanoramaLandscape(Number.NaN, 1420)).toBe(false);
});

test("two roof lights use bounded surfaces with no hidden fill or new draw-call requirement", () => {
  const full = potsdamerPanoramaRoofBoxes();
  const voxel = potsdamerPanoramaRoofBoxes(true);
  expect(full).toHaveLength(120);
  expect(voxel).toHaveLength(72);
  const builder = createBuilder();
  for (const box of full) {
    expect(box.position[1]).toBeGreaterThan(42);
    expect(box.position[1]).toBeLessThan(44);
    expect(box.size[1]).toBeLessThan(1);
    addBox(builder, box.color, ...box.position, ...box.size, box.rotationY, false);
  }
  const group = finishDrawnGroup(builder, { name: "QA roof surfaces" })!;
  expect(group.children).toHaveLength(1);
  let bytes = 0;
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const attr of Object.values(object.geometry.attributes)) {
      if ("array" in attr) bytes += attr.array.byteLength;
    }
    bytes += object.geometry.index?.array.byteLength ?? 0;
    object.geometry.dispose();
  });
  expect(bytes).toBeLessThan(70 * 1024);
  expect(voxel.length * 76).toBe(5472);
});
