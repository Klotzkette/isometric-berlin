import { expect, test } from "bun:test";
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { createMoabitStreetFrontsV340 } from "../src/MoabitStreetFrontsV340";
import evidence from "../src/data/moabitStreetFrontsV340.json";
import originalV300 from "../src/data/moabitMitteV300Owners.json";
import originalV302 from "../src/data/westKiezV302CoreOwners.json";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const url = (name: string) => new URL(`../public/mesh/regierungsviertel/${name}`, import.meta.url);
const source = await Bun.file(url("lod2-prisms.json")).json() as PrismPayload;
const voxels = await Bun.file(url("minecraft-voxels.json")).json() as VoxelPayload;
const originals = evidence.sites.map(site => site.prism);
const ids = new Set(originals.map(p => p.id));
const sizes = new Vector3(), position = new Vector3(), rotation = new Quaternion(), matrix = new Matrix4();

test("the eight historically documented address owners are distinct from earlier v300 and v302 transfers", () => {
  for (const old of [...originalV300.oldPrisms, ...originalV300.retainedPrisms, ...originalV302.oldPrisms]) {
    expect(ids.has(old.id)).toBeFalse();
  }
  expect(source.buildings.filter(p => ids.has(p.id)).length).toBe(8);
  expect(evidence.sites.flatMap(s => s.faces).length).toBe(22);
  expect(evidence.sites.flatMap(s => s.native).length).toBe(39);
  const a = evidence.sites.find(s => s.address === "Gotzkowskystraße 16")!;
  const b = evidence.sites.find(s => s.address === "Gotzkowskystraße 17")!;
  expect([a.prism.h_dm, b.prism.h_dm]).toEqual([100, 100]);
  expect(a.officialHeightM).toBeCloseTo(23.65, 2);
  expect(b.officialHeightM).toBeCloseTo(23.07, 2);
});

for (const native of [false, true]) test(`address-specific relief is bounded and leaves source payload bytes intact (${native ? "Native" : "Drawn"})`, () => {
  const before = JSON.stringify(source.buildings.filter(p => ids.has(p.id)));
  const root = createMoabitStreetFrontsV340(source.buildings, native, voxels)!;
  expect(root.userData.sourcePrismIds.length).toBe(8);
  expect(root.userData.sourceFaceCount).toBe(native ? 39 : 22);
  expect(root.children).toHaveLength(2);
  let count = 0;
  for (const child of root.children) {
    expect(child).toBeInstanceOf(InstancedMesh);
    const batch = child as InstancedMesh;
    count += batch.count;
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      matrix.decompose(position, rotation, sizes);
      expect(position.y).toBeGreaterThan(5.2);
      expect(sizes.x * sizes.y * sizes.z).toBeGreaterThan(0);
      if (native) {
        expect(new Euler().setFromQuaternion(rotation).y).toBeCloseTo(0, 7);
        const family = evidence.sites.flatMap(site => site.native).filter(([x, z, dx, dz]) => {
          const d = dx ? Math.abs(position.x - (x * 4 + 2 + dx * 2)) : Math.abs(position.z - (z * 4 + 2 + dz * 2));
          const u = dx ? Math.abs(position.z - (z * 4 + 2)) : Math.abs(position.x - (x * 4 + 2));
          return d <= .55 && u <= 2;
        });
        expect(family.some(row => position.y + sizes.y / 2 < row[5] / 10)).toBeTrue();
      }
    }
  }
  expect(count).toBeGreaterThan(700);
  expect(count).toBeLessThan(3600);
  expect(JSON.stringify(source.buildings.filter(p => ids.has(p.id)))).toBe(before);
  disposeStaticAudit(root);
});

test("source mutations and new neighboring columns leave their affected frontage closed", () => {
  const target = originals[0];
  expect(createMoabitStreetFrontsV340([{ ...target, h_dm: target.h_dm + 1 }], false)).toBeNull();
  expect(createMoabitStreetFrontsV340([target, target], false)).toBeNull();
  expect(createMoabitStreetFrontsV340([target], true)).toBeNull();
  const [x, z, dx, dz, lo, hi, kind] = evidence.sites[0].native[0];
  const rows = [...voxels.building_rows!];
  const index = z + dz - voxels.grid.min_z_idx;
  rows[index] = [...rows[index], [x + dx - voxels.grid.min_x_idx, 1, lo, hi, kind]];
  expect(createMoabitStreetFrontsV340([target], true, { ...voxels, building_rows: rows })).toBeNull();
  const unaffected = createMoabitStreetFrontsV340([originals[1]], true, { ...voxels, building_rows: rows });
  expect(unaffected?.userData.sourcePrismIds).toEqual([originals[1].id]);
  disposeStaticAudit(unaffected!);
});
