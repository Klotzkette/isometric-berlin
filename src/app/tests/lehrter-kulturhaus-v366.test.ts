import { expect, test } from "bun:test";
import { GendarmenmarktFacadeBuilder } from "../src/GendarmenmarktFacadeBuilder";
import { appendLehrterKulturhausV366, applyLehrterClinkerV366 } from "../src/LehrterKulturhausV366";
import { lehrterKulturhausOwnerV366, lehrterKulturhausRoofV366 } from "../src/lehrterKulturhausProfileV366";
import details from "../src/data/lehrterKulturhausFrontsV366.json";
import roofSource from "../src/data/lehrterKulturhausRoofsV366.json";
import type { PrismBuilding, PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
const source = (p: string) =>
  Bun.file(new URL("../public/mesh/regierungsviertel/" + p, import.meta.url)).json();
const prisms: PrismPayload = await source("lod2-prisms.json");
const voxels: VoxelPayload = await source("minecraft-voxels.json");
const owned = prisms.buildings.filter(lehrterKulturhausOwnerV366);
const withId = (id: string) => owned.find((p) => p.id === id)!;

test("only the twelve original surveyed parts match and the two false flat caps become measured roofs", () => {
  expect(owned).toHaveLength(12);
  for (const id of ["24ruzruS", "mO1M4nzw"] as const) {
    const p = withId(id),
      roof = lehrterKulturhausRoofV366(p)!;
    expect(roofSource[id].sourceSheets).toBe(id === "24ruzruS" ? 20 : 40);
    expect(roof.wallHeight).toBeCloseTo(id === "24ruzruS" ? 17.339 : 16.871, 3);
    const y: number[] = [];
    for (let i = 0; i < roof.triangles.length; i += 9) {
      const q = roof.triangles.subarray(i, i + 9);
      const ny = (q[5] - q[2]) * (q[6] - q[0]) - (q[3] - q[0]) * (q[8] - q[2]);
      expect(ny).toBeGreaterThanOrEqual(-0.00001);
      y.push(q[1], q[4], q[7]);
    }
    expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(3.9);
    expect(Math.abs(Math.max(...y) - (p.y0_dm + p.h_dm) / 10)).toBeLessThan(0.05);
    expect(lehrterKulturhausRoofV366({ ...p, h_dm: p.h_dm + 1 })).toBeNull();
  }
});

for (const native of [false, true])
  test(`audited walls and open KUNST portal ${native ? "cardinal" : "drawn"}`, () => {
    const b = new GendarmenmarktFacadeBuilder(native, false, 0);
    const ids = appendLehrterKulturhausV366(b, prisms.buildings, native, native ? voxels : undefined);
    expect(new Set(ids)).toEqual(
      new Set(["mO1M4nzw", "24ruzruS", "ia66KyBc", "JuHnDm1r", "Od9FgiX1", "7s8cBB6l", "TluIell9"])
    );
    const boxes = [...b.batches.values()].flat();
    expect(boxes.length).toBeGreaterThan(400);
    expect(boxes.some((p) => p.color === 0x90cea8)).toBe(true);
    if (native)
      for (const { matrix: m } of boxes)
        for (const i of [1, 2, 4, 6, 8, 9]) expect(Math.abs(m[i])).toBeLessThan(0.00001);
    const a = withId("mO1M4nzw").ring[19],
      c = withId("24ruzruS").ring[9];
    const mx = (a[0] + c[0]) / 20,
      mz = (a[1] + c[1]) / 20;
    expect(
      boxes
        .filter((p) => Math.hypot(p.matrix[12] - mx, p.matrix[14] - mz) < 0.6)
        .every((p) => p.matrix[13] - Math.abs(p.matrix[5]) / 2 > 8.5)
    ).toBe(true);
    const target = withId("mO1M4nzw");
    expect(
      appendLehrterKulturhausV366(new GendarmenmarktFacadeBuilder(native), [target, target], native, voxels)
    ).toEqual([]);
    expect(
      appendLehrterKulturhausV366(
        new GendarmenmarktFacadeBuilder(native),
        [{ ...target, h_dm: 407 }],
        native,
        voxels
      )
    ).toEqual([]);
  });

test("occupied neighboring voxel prevents that specific external facade admission", () => {
  const target = withId("mO1M4nzw");
  const build = (p: VoxelPayload) => {
    const b = new GendarmenmarktFacadeBuilder(true);
    appendLehrterKulturhausV366(b, [target], true, p);
    return [...b.batches.values()].flat().length;
  };
  const [x, z, dx, dz, lo, hi, kind] = details.find((f) => f.owner === target.id)!.native[0];
  const rows = [...voxels.building_rows!],
    index = z + dz - voxels.grid.min_z_idx;
  rows[index] = [...rows[index], [x + dx - voxels.grid.min_x_idx, 1, lo, hi, kind]];
  expect(build({ ...voxels, building_rows: rows })).toBeLessThan(build(voxels));
});

test("distant and final drawn batches submit every measured rooftop vertex", async () => {
  const { createDistantBuildingShells, createIsometricCityCore } = await import("../src/IsometricCityWorld");
  const { Mesh } = await import("three");
  const { disposeStaticAudit } = await import("./helpers/staticGeometryAudit");
  const buildings = [withId("24ruzruS"), withId("mO1M4nzw")];
  const source = { ...prisms, buildings };
  const key = (x: number, y: number, z: number) => [x, y, z].map((p) => Math.round(p * 1000)).join(",");
  for (const scene of [
    createDistantBuildingShells(source, buildings),
    createIsometricCityCore(source, null, null, null, { includeContext: false, bridgeStructures: false }),
  ]) {
    const submitted = new Set<string>();
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) submitted.add(key(pos.getX(i), pos.getY(i), pos.getZ(i)));
    });
    for (const id of ["24ruzruS", "mO1M4nzw"] as const) {
      for (const [x, y, z] of roofSource[id].positionsMm)
        expect(submitted.has([x, y, z].join(","))).toBe(true);
    }
    disposeStaticAudit(scene);
  }
});

test("native brick and roof finish follow only matched source footprints", async () => {
  const { buildColumnToneLookup } = await import("../src/MinecraftVoxelWorld");
  const lookup = buildColumnToneLookup(prisms);
  const red = 0x9e6253,
    tile = 0x965744;
  const coords = [
    [-599, -1249],
    [-625, -1302],
    [-648, -1346],
  ];
  for (const [x, z] of coords) {
    expect(lookup(x, z)).toBe(red);
    expect(lookup.illustrationRoofToneAt!(x, z)).toBe(tile);
  }
  expect(lookup(-612, -1382)).not.toBe(red);
});

test("drawn stone finishes receive one clinker hook each for day and night", async () => {
  const { disposeStaticAudit } = await import("./helpers/staticGeometryAudit");
  for (const native of [false, true]) {
    const b = new GendarmenmarktFacadeBuilder(native, false, 0);
    appendLehrterKulturhausV366(b, owned, native, native ? voxels : undefined);
    const root = b.finish("Lehrter");
    applyLehrterClinkerV366(root);
    applyLehrterClinkerV366(root);
    for (const mesh of root.children) {
      const expected = !native && mesh.name.endsWith(" stone") ? 1 : 0;
      for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) {
        expect(material.customProgramCacheKey().split("|lehrter-rotklinker").length - 1).toBe(expected);
      }
    }
    disposeStaticAudit(root);
  }
});
