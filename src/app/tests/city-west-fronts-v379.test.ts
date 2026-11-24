import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { Group, Mesh } from "three";
import { preloadAltMitteNativeV169Source } from "../src/AltMitteNativeCoreV169";
import { createDistantBuildingShells, createIsometricCityCoreStepsV309, type PrismPayload } from "../src/IsometricCityWorld";
import { buildColumnToneLookup, buildMinecraftVoxelWorldSteps, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import packet from "../src/data/cityWestFrontsV379.json";

type Front = [number, number, number, number, number, number, number, number[][]];
const fronts = packet as unknown as Record<string, Front[]>;
const owners = Object.keys(fronts).sort();
const assets = resolve(import.meta.dir, "../public/mesh/regierungsviertel");
const rawPrisms = readFileSync(resolve(assets, "lod2-prisms.json"));
const source = JSON.parse(rawPrisms.toString()) as PrismPayload;
const receipt = JSON.parse(gunzipSync(readFileSync(resolve(import.meta.dir,
  "../../../geo_data/regierungsviertel/citywest-fronts-v379-evidence.json.gz"))).toString()) as {
  prismsSha256: string;
  protectedOwners: string[];
  addressMatches: Record<string, [number, string, Record<string, string>]>;
  registered: { id: string; a: number[]; b: number[]; base: number; height: number; sha256: string }[];
};
const drawnName = "City West · fotografierte Fassaden";
const nativeName = drawnName + " auf Blockwänden";

test("the dated receipt, retained prism edges, and 1,855 measured fields agree", () => {
  expect(createHash("sha256").update(rawPrisms).digest("hex")).toBe(receipt.prismsSha256);
  expect(owners).toHaveLength(89);
  expect(Object.values(fronts).flat()).toHaveLength(150);
  expect(receipt.protectedOwners.every(id => !Object.hasOwn(fronts, id))).toBe(true);
  const walls = new Set(receipt.registered.filter(face => /^[a-f0-9]{64}$/.test(face.sha256))
    .map(f => [f.id, ...f.a, ...f.b, f.base, f.height].join("/")));
  const parts = new Map(source.buildings.map(part => [part.id, part]));
  const kinds = [0, 0, 0];
  for (const [id, sides] of Object.entries(fronts)) {
    const building = parts.get(id)!;
    const edges = [building.ring, ...(building.holes ?? [])].flatMap(ring =>
      ring.map((p, i) => [p.join(","), ring[(i + 1) % ring.length].join(",")].sort().join("/")));
    for (const [x, z, x1, z1, base, height, , fields] of sides) {
      expect(walls.has([id, x, z, x1, z1, base, height].join("/"))).toBe(true);
      expect(edges).toContain([[x * 10, z * 10].map(Math.round).join(","),
        [x1 * 10, z1 * 10].map(Math.round).join(",")].sort().join("/"));
      expect(building.y0_dm / 10).toBe(base);
      const width = Math.round(10 * Math.hypot(x1 - x, z1 - z));
      for (const [left, right, bottom, top, kind] of fields) {
        expect(left >= 0 && left < right && right <= width).toBe(true);
        expect(bottom >= 0 && bottom < top && top <= height * 10 + .01).toBe(true);
        kinds[kind]++;
      }
    }
  }
  expect(kinds).toEqual([1711, 58, 86]);
  expect(receipt.addressMatches["81500151"][1]).toBe("way/181500151");
  expect(receipt.addressMatches["90078078"][1]).toBe("way/290078078");
});

function verifyMesh(root: Group, name: string, quads: number) {
  const mesh = root.getObjectByName(name) as Mesh;
  expect(mesh?.isMesh).toBe(true);
  expect([...mesh.userData.cityWestFrontOwnersV379].sort()).toEqual(owners);
  expect(mesh.geometry.getIndex()!.count).toBe(quads * 6);
  const position = mesh.geometry.getAttribute("position");
  return createHash("sha256").update(Buffer.from(position.array.buffer, position.array.byteOffset, position.array.byteLength)).digest("hex");
}

test("distant and close drawn models emit the same 150 measured facades", () => {
  const selected = source.buildings.filter(building => Object.hasOwn(fronts, building.id));
  const scoped = { ...source, buildings: selected };
  const distant = createDistantBuildingShells(scoped, selected);
  const distantHash = verifyMesh(distant, drawnName, 5335);
  disposeSurroundingCityRoot(distant);
  const steps = createIsometricCityCoreStepsV309(scoped, null, undefined, null, { buildings: selected, includeContext: false });
  let result = steps.next();
  while (!result.done) result = steps.next();
  expect(verifyMesh(result.value, drawnName, 5335)).toBe(distantHash);
  disposeSurroundingCityRoot(result.value);
});

test("all 89 facades project equally onto real exposed block faces on mobile and desktop", async () => {
  await preloadAltMitteNativeV169Source();
  const voxels = JSON.parse(readFileSync(resolve(assets, "minecraft-voxels.json"), "utf8")) as VoxelPayload;
  // Retain real columns and their obscuring neighbours around every registered wall.
  const cell = voxels.cell_m;
  const keep = new Set<number>();
  const key = (x: number, z: number) => x * 65536 + z;
  for (const [x, z, x1, z1] of Object.values(fronts).flat()) {
    for (let i = Math.floor(Math.min(x, x1) / cell) - 3; i <= Math.ceil(Math.max(x, x1) / cell) + 3; i++) {
      for (let j = Math.floor(Math.min(z, z1) / cell) - 3; j <= Math.ceil(Math.max(z, z1) / cell) + 3; j++) keep.add(key(i, j));
    }
  }
  const buildings: NonNullable<VoxelPayload["buildings"]> = [];
  for (const [row, runs] of voxels.building_rows!.entries()) {
    const z = voxels.grid.min_z_idx + row;
    for (const [offset, length, bottom, top, material] of runs) {
      for (let n = 0; n < length; n++) {
        const x = voxels.grid.min_x_idx + offset + n;
        if (keep.has(key(x, z))) buildings.push([x, z, bottom, top, material]);
      }
    }
  }
  const fixture = { ...voxels, building_rows: undefined, tree_rows: undefined, ground_rows: [], trees: [], buildings };
  const lookup = buildColumnToneLookup(source);
  // Keep the original 89 surveyed owners in this v379 geometry receipt. The
  // real voxel columns, neighbouring buildings, colours and heights stay live.
  lookup.cityWestOwnerAt = buildColumnToneLookup({
    ...source, buildings: source.buildings.filter(building => Object.hasOwn(fronts, building.id)),
  }).cityWestOwnerAt;
  let desktop = "";
  for (const detailProfile of ["full", "mobile"] as const) {
    const root = new Group();
    const steps = buildMinecraftVoxelWorldSteps(root, fixture, lookup, null, { detailProfile });
    while (!root.getObjectByName(nativeName) && !steps.next().done) { /* stop at the published mesh */ }
    const hash = verifyMesh(root, nativeName, 7352);
    if (detailProfile === "full") desktop = hash;
    else expect(hash).toBe(desktop);
    steps.return(root);
    disposeSurroundingCityRoot(root);
  }
}, 60000);
