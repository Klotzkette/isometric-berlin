import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { Group, InstancedMesh, Mesh } from "three";
import { appendSchoolPlaceV205 } from "../src/schoolsPlacesV205Batches";
import { createSteglitzV182, createMinecraftSteglitzV182 } from "../src/SteglitzV182";
import { transformLosslessJsonData } from "../losslessJsonData";
import data from "../src/data/steglitzWindowsV273.json";
import original from "../src/data/steglitzV182Source.json";
import native from "../src/data/steglitzV182Native.json";
import street from "../src/data/steglitzSchoolV250.json";
import courtyard from "../src/data/steglitzCourtyardV251.json";
import places from "../src/data/schoolsPlacesV205.json";
import { replaceSteglitzSchoolPlaceV250 } from "../src/steglitzSchoolV250";
import {
  appendSteglitzCourtyardV251, steglitzCourtyardV251NativeRows,
  steglitzCourtyardV251SurfaceColor,
} from "../src/steglitzCourtyardV251";
import {
  appendSteglitzWindowsV273, steglitzWindowsV273Enabled,
  steglitzWindowsV273NativeRows, steglitzWindowsV273SourceBoxes,
  steglitzWindowsV273SurfaceColor, verifySteglitzWindowsV273Receipt,
} from "../src/steglitzWindowsV273";

test("source and both previous complete photo models guard all replacements", () => {
  const inputs = { sourceBoxes: original.boxes, sourceSurfaces: original.surfaces,
    nativeRows: native.boxes, v250: street, v251: courtyard };
  expect(steglitzWindowsV273Enabled()).toBe(true);
  expect(verifySteglitzWindowsV273Receipt(inputs)).toBe(true);
  for (const key of Object.keys(inputs) as (keyof typeof inputs)[])
    expect(verifySteglitzWindowsV273Receipt({ ...inputs, [key]: [] })).toBe(false);
});

test("only receipted old panes yield and all existing native cells and surfaces remain", () => {
  const removed = new Set([...street.remove["v182.boxes"], ...courtyard.removeSourceBoxes, ...data.removeSourceBoxes]);
  expect(steglitzWindowsV273SourceBoxes(original.boxes)).toEqual(original.boxes.filter((_, i) => !removed.has(i)));
  const baseline = steglitzCourtyardV251NativeRows(native.boxes);
  const result = steglitzWindowsV273NativeRows(native.boxes);
  const paints = new Map(data.nativeColors.map(r => [r[0], r[1]]));
  expect(result.length).toBe(native.boxes.length);
  result.forEach((r, i) => {
    expect(r.slice(0, 6)).toEqual(native.boxes[i].slice(0, 6));
    expect(r[6]).toBe(paints.get(i) ?? baseline[i][6]);
  });
  const surfaces = new Map(data.surfaceColors.map(r => [r[0], r[1]]));
  original.surfaces.forEach((s, i) => expect(steglitzWindowsV273SurfaceColor(i, s.color))
    .toBe(surfaces.get(i) ?? steglitzCourtyardV251SurfaceColor(i, s.color)));
});

test("Aula, modern wing, clock and sports hall stay as exact earlier batch prefixes", () => {
  const old = places.schools.find(s => s.owner === data.owner)!;
  const prior = appendSteglitzCourtyardV251(replaceSteglitzSchoolPlaceV250(old));
  const result = appendSteglitzWindowsV273(prior);
  expect(result.faces).toBe(prior.faces);
  expect(result.labels).toBe(prior.labels);
  for (const key of ["boxes", "rods", "nativeRows"] as const) {
    expect(result[key].slice(0, prior[key].length)).toEqual(prior[key]);
    expect(result[key].length).toBe(prior[key].length + data[key].length);
    expect(result[key].every(r => r.every(Number.isFinite))).toBe(true);
  }
  expect(result.nativeRows.every(r => r.length === 7 && r.slice(3, 6).every(v => v > 0))).toBe(true);
  for (const other of places.schools.filter(s => s.owner !== data.owner)) expect(appendSteglitzWindowsV273(other)).toBe(other);
  expect(data.nativeRows.length * 76).toBeLessThan(310_000);
  expect((data.boxes.length + data.rods.length) * 76).toBeLessThan(210_000);
});

test("changed earlier courtyard data retains the complete previous rendering atomically", () => {
  const code = `
    import assert from 'node:assert/strict';
    import old from './src/data/steglitzCourtyardV251.json';
    import original from './src/data/steglitzV182Source.json';
    import native from './src/data/steglitzV182Native.json';
    import places from './src/data/schoolsPlacesV205.json';
    old.boxes[0][0] += 1;
    const prior = await import('./src/steglitzCourtyardV251');
    const m = await import('./src/steglitzWindowsV273');
    assert.equal(m.steglitzWindowsV273Enabled(), false);
    assert.deepEqual(m.steglitzWindowsV273SourceBoxes(original.boxes), prior.steglitzCourtyardV251SourceBoxes(original.boxes));
    assert.deepEqual(m.steglitzWindowsV273NativeRows(native.boxes), prior.steglitzCourtyardV251NativeRows(native.boxes));
    original.surfaces.forEach((s,i) => assert.equal(m.steglitzWindowsV273SurfaceColor(i,s.color), prior.steglitzCourtyardV251SurfaceColor(i,s.color)));
    const entry = places.schools.find(s=>s.owner === 'DEBE06YYB0000AUq');
    assert.equal(m.appendSteglitzWindowsV273(entry), entry);
  `;
  const child = Bun.spawnSync([process.execPath, "-e", code], { cwd: resolve(import.meta.dir, "..") });
  expect(child.stderr.toString()).toBe("");
  expect(child.exitCode).toBe(0);
});

test("actual drawn/native factories use one corrected school batch and no old duplicate panes", async () => {
  const dispose = (root: Group) => root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    for (const material of new Set([...(Array.isArray(o.material) ? o.material : [o.material]), o.userData.dayMaterial, o.userData.nightMaterial])) material?.dispose();
  });
  for (const nativeMode of [false, true]) {
    const shell = nativeMode ? createMinecraftSteglitzV182() : createSteglitzV182();
    const batchRoot = new Group();
    appendSchoolPlaceV205(batchRoot, "schools", nativeMode);
    const schools = batchRoot.children.filter(o => o.userData.sourceOwner === data.owner) as InstancedMesh[];
    expect(schools.length).toBe(1);
    const batch = schools[0], matrices = batch.instanceMatrix.array;
    expect(batch.userData.steglitzWindowsV273).toBe(true);
    if (!nativeMode) {
      const base = shell.children[2] as InstancedMesh;
      const originalPositions = new Set(data.removeSourceBoxes.map(i => original.boxes[i].slice(0, 3).map(v => Math.round(v * 100)).join(",")));
      for (let i = 0; i < base.count; i++) {
        const a = base.instanceMatrix.array, o = i * 16;
        expect(originalPositions.has([a[o + 12], a[o + 13], a[o + 14]].map(v => Math.round(v * 100)).join(","))).toBe(false);
      }
      // Main glazing rectangle of every new aperture occurs exactly once.
      const openings = data.boxes.filter(r => r[4] > 280 && r[4] < 300 && data.palette[r[7]] === 0x819a9b);
      expect(openings.length).toBe(85);
      for (const row of openings) {
        let found = 0;
        for (let i = 0; i < batch.count; i++) {
          const o = i * 16;
          if ([0, 1, 2].every(k => Math.abs(matrices[o + 12 + k] - row[k] / 100 - data.origin[k]) < 0.005)) found++;
        }
        expect(found).toBe(1);
      }
    } else {
      for (let i = 0; i < batch.count; i++) {
        const o = i * 16;
        expect([1, 2, 4, 6, 8, 9].every(k => matrices[o + k] === 0)).toBe(true);
        expect([0, 5, 10].every(k => matrices[o + k] > 0)).toBe(true);
      }
    }
    dispose(shell); dispose(batchRoot);
  }
  const path = resolve(import.meta.dir, "../src/data/steglitzWindowsV273.json");
  const raw = await Bun.file(path).text();
  const transformed = transformLosslessJsonData(raw, path)!;
  expect(transformed).toBeTruthy();
  expect(Buffer.byteLength(transformed.code)).toBeLessThan(160_000);
});
