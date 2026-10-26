import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import data from "../src/data/lehrterV277Ownership.json";
import { createLehrterColumnTesterV277, isLehrterSourceV277 } from "../src/lehrterV277Ownership";
import { createDistantBuildingShells, createIsometricCityCore, type PrismPayload } from "../src/IsometricCityWorld";
import { createProgressiveBuildingCoverage } from "../src/progressiveBuildingCoverage";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const payload: PrismPayload = JSON.parse(readFileSync("public/mesh/regierungsviertel/lod2-prisms.json", "utf8"));
const actual = payload.buildings;
const selected = actual.filter(isLehrterSourceV277);
type Column = [number, number, number, number, number];

test("four exact retained owners, source hashes and complete exclusive column receipts remain independently bound", () => {
  expect(data.previousPrisms).toHaveLength(4);
  expect(selected).toEqual(expect.arrayContaining(data.previousPrisms));
  expect(selected).toHaveLength(4);
  for (const input of data.inputs) {
    const bytes = readFileSync(`../../${input.path}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(input.sha256);
  }
  expect(data.columns).toHaveLength(96);
  expect(data.retainedSharedColumns).toHaveLength(14);
  expect(data.neighbours).toHaveLength(4);
  const voxel = JSON.parse(readFileSync("public/mesh/regierungsviertel/minecraft-voxels.json", "utf8"));
  const columns = new Set<string>();
  voxel.building_rows.forEach((runs: number[][], zi: number) => {
    const z = voxel.grid.min_z_idx + zi;
    if (z * voxel.cell_m < data.bounds[1] - voxel.cell_m || z * voxel.cell_m > data.bounds[3]) return;
    for (const [offset, count, low, high, kind] of runs) {
      for (let x = voxel.grid.min_x_idx + offset; x < voxel.grid.min_x_idx + offset + count; x++) {
        columns.add([x, z, low, high, kind].join("/"));
      }
    }
  });
  expect(data.columns.every(c => columns.has(c.join("/")))).toBe(true);
  const tester = createLehrterColumnTesterV277(actual, voxel.cell_m);
  for (const c of data.columns) expect(tester(...c as Column)).toBe(true);
  for (const c of data.retainedSharedColumns) expect(tester(...c as Column)).toBe(false);
  expect(data.columns.every(c => voxel.classes[c[4]] === "concrete" || voxel.classes[c[4]] === "glass")).toBe(true);
});

test("changed source geometry, elevations, material, roof, holes or owner never yields", () => {
  expect(isLehrterSourceV277({ id: "unrelated", get ring() { throw Error("Unrelated geometry must not be read"); } })).toBe(false);
  const part = data.previousPrisms[0];
  const changedRing = part.ring.map(p => [...p]); changedRing[0][0] += 1;
  const mutations = [
    { ...part, id: "unrelated" },
    { ...part, ring: changedRing },
    { ...part, holes: [[[1, 1], [2, 1], [2, 2]]] },
    { ...part, holes: undefined },
    { ...part, y0_dm: part.y0_dm + 1 },
    { ...part, h_dm: part.h_dm + 1 },
    { ...part, class: part.class + 1 },
    { ...part, roof: part.roof + 1 },
    { ...part, tone: [1, 2, 3] },
  ];
  const first = data.columns[0] as Column;
  for (const mutated of mutations) {
    expect(isLehrterSourceV277(mutated)).toBe(false);
    const changed = actual.map(p => p.id === part.id ? mutated : p);
    expect(createLehrterColumnTesterV277(changed, data.cellM)(...first)).toBe(false);
  }
  for (const parts of [undefined, [], actual.filter(p => p.id !== part.id), [...actual, part]]) {
    expect(createLehrterColumnTesterV277(parts, data.cellM)(...first)).toBe(false);
  }
  expect(createLehrterColumnTesterV277(actual, 2)(...first)).toBe(false);
  const tester = createLehrterColumnTesterV277(actual, data.cellM);
  for (let index = 0; index < 5; index++) {
    const changed = [...first] as Column; changed[index] += 1;
    if (!data.columns.some(c => c.every((v, i) => v === changed[i]))) expect(tester(...changed)).toBe(false);
  }
  // Ground and tree tuples can never match a recorded concrete/glass column.
  expect(tester(first[0], first[1], first[2], first[3], 0)).toBe(false);
  expect(tester(first[0], first[1], first[2], first[3], 2)).toBe(false);
});

test("a new or changed overlapping owner preserves its whole old column without erasing neighbouring cells", () => {
  const first = data.columns[0] as Column;
  const x = first[0] * data.cellM * 10, z = first[1] * data.cellM * 10;
  const foreign = { id: "new-neighbour", ring: [[x, z], [x + 40, z], [x + 40, z + 40], [x, z + 40]] };
  const guarded = createLehrterColumnTesterV277([...actual, foreign], data.cellM);
  expect(guarded(...first)).toBe(false);
  const far = data.columns.find(c => Math.abs(c[0] - first[0]) > 2 || Math.abs(c[1] - first[1]) > 2)! as Column;
  expect(guarded(...far)).toBe(true);
  const moved = { ...foreign, ring: foreign.ring.map(([a, b]) => [a + 100000, b + 100000]) };
  expect(createLehrterColumnTesterV277([...actual, moved], data.cellM)(...first)).toBe(true);
});

test("initial, distant and progressive drawn layers retire all four old prisms only on explicit activation", () => {
  const source = { ...payload, buildings: selected };
  const before = createDistantBuildingShells(source, selected);
  const after = createDistantBuildingShells(source, selected, { lehrterV277: true });
  expect(before.userData.visibleBuildingCount).toBe(4);
  expect(after.userData.visibleBuildingCount).toBe(0);
  const partition = { initial: [], omitted: selected.slice(0, 2), remaining: [selected.slice(2)] };
  for (const enabled of [false, true]) {
    const coverage = createProgressiveBuildingCoverage(source, partition, { lehrterV277: enabled });
    expect(coverage.children.map(c => c.userData.visibleBuildingCount)).toEqual(enabled ? [0, 0] : [2, 2]);
    disposeSurroundingCityRoot(coverage);
  }
  const oldCore = createIsometricCityCore(source, null, null, null, { includeContext: false });
  const newCore = createIsometricCityCore(source, null, null, null, { includeContext: false, lehrterV277: true });
  expect(oldCore.children.length).toBeGreaterThan(0);
  expect(newCore.children.length).toBe(0);
  const changed = { ...selected[0], h_dm: selected[0].h_dm + 1 };
  const retained = createDistantBuildingShells(source, [changed], { lehrterV277: true });
  expect(retained.userData.visibleBuildingCount).toBe(1);
  const retainedCore = createIsometricCityCore({ ...source, buildings: [changed] }, null, null, null, { includeContext: false, lehrterV277: true });
  expect(retainedCore.children.length).toBeGreaterThan(0);
  for (const root of [before, after, oldCore, newCore, retained, retainedCore]) disposeSurroundingCityRoot(root);
});
