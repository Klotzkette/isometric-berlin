import { expect, test } from "bun:test";
import { Mesh } from "three";
import { GendarmenmarktFacadeBuilder } from "../src/GendarmenmarktFacadeBuilder";
import { addZilleEstateV366 } from "../src/ZilleEstateFacesV366";
import { zilleEstateOwnerV366, zilleEstateRoofV366 } from "../src/ZilleEstateRoofV366";
import { createDistantBuildingShells, createIsometricCityCore, type PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";
import roofs from "../src/data/zilleEstateRoofsV366.json";
import faces from "../src/data/zilleEstateFacesV366.json";
import hero from "../src/data/moabitJusticeV166Evidence.json";

const mesh = (name: string) => Bun.file(new URL("../public/mesh/regierungsviertel/" + name, import.meta.url)).json();
const prisms: PrismPayload = await mesh("lod2-prisms.json");
const voxels: VoxelPayload = await mesh("minecraft-voxels.json");
const evidence = await Bun.file(new URL("../../../geo_data/regierungsviertel/zille-estate-v366.json", import.meta.url)).json();
const owned = prisms.buildings.filter(zilleEstateOwnerV366);

test("all 31 cadastral residential parent records resolve to distinct retained parts outside the separate 1 m justice meshes", () => {
  const parents = Object.values(evidence.parents) as { admitted: string[] }[];
  expect(parents).toHaveLength(31);
  const ids = parents.flatMap(p => p.admitted);
  expect(ids).toHaveLength(51);
  expect(new Set(ids)).toEqual(new Set(owned.map(b => b.id)));
  expect(hero.legacyPrisms.some(p => ids.includes(p.id))).toBe(false);
  expect(owned.filter(b => zilleEstateOwnerV366({ ...b, h_dm: b.h_dm + 1 }))).toHaveLength(0);
});

test("both drawn shell paths submit the actual shallow roof sheets and eaves for every admitted roof", () => {
  const buildings = owned.filter(b => Object.hasOwn(roofs, b.id));
  expect(buildings).toHaveLength(4);
  const payload = { ...prisms, buildings };
  const expected = new Set<string>();
  for (const b of buildings) {
    const roof = zilleEstateRoofV366(b)!;
    const data = roofs[b.id as keyof typeof roofs];
    for (const p of data.positionsMm) expected.add(p.join(","));
    expect(roof.wallHeight).toBeCloseTo(data.eaveMm / 1000 - b.y0_dm / 10, 3);
    expect(zilleEstateRoofV366({ ...b, y0_dm: b.y0_dm + 1 })).toBeNull();
    for (let i = 0; i < roof.triangles.length; i += 9) {
      const [ax,,az,bx,,bz,cx,,cz] = roof.triangles.subarray(i, i + 9);
      expect((bz - az) * (cx - ax) - (bx - ax) * (cz - az)).toBeGreaterThanOrEqual(-.00001);
    }
  }
  for (const group of [createDistantBuildingShells(payload, buildings),
    createIsometricCityCore(payload, null, null, null, { includeContext: false, bridgeStructures: false })]) {
    const submitted = new Set<string>();
    group.traverse(o => {
      if (o instanceof Mesh) {
        const pos = o.geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i++) submitted.add([pos.getX(i),pos.getY(i),pos.getZ(i)].map(v => Math.round(v * 1000)).join(","));
      }
    });
    expect([...expected].filter(p => !submitted.has(p))).toEqual([]);
    disposeStaticAudit(group);
  }
});

for (const native of [false,true]) test("street and courtyard finishes share the two existing batches " + (native ? "in native" : "in drawn"), () => {
  const builder = new GendarmenmarktFacadeBuilder(native, false, 0);
  const { walls, fittings } = addZilleEstateV366(builder, owned, native ? voxels : undefined);
  expect(walls).toBe(native ? 231 : 120);
  expect(fittings).toBe(16);
  expect(new Set(builder.batches.keys())).toEqual(new Set(["stone","glass"]));
  const geometry = [...builder.batches.values()].flat();
  for (const color of [0x995852,0xd8d7cd,0xc9c7bc]) expect(geometry.some(v => v.color === color)).toBe(true);
  if (native) for (const { matrix } of geometry) {
    for (const i of [1,2,4,6,8,9]) expect(Math.abs(matrix[i])).toBeLessThan(.00001);
  }
});

test("a neighboring occupied voxel suppresses a previously exposed estate wall", () => {
  const b = owned.find(b => faces[b.id as keyof typeof faces].native.length > 0)!;
  const [x,z,dx,dz,lo,hi,material] = faces[b.id as keyof typeof faces].native[0];
  const rows = [...voxels.building_rows!];
  const i = z + dz - voxels.grid.min_z_idx;
  rows[i] = [...rows[i], [x + dx - voxels.grid.min_x_idx, 1, lo, hi, material]];
  const draw = (v: VoxelPayload) => addZilleEstateV366(new GendarmenmarktFacadeBuilder(true), [b], v).walls;
  expect(draw({ ...voxels, building_rows: rows })).toBeLessThan(draw(voxels));
});
