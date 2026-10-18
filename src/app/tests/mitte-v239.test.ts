import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Group, Mesh, LineSegments } from "three";
import oldNavigation from "../src/data/schlossplatzV239PreviousNavigation.json";
import owners from "../src/data/schlossplatzV239Owners.json";
import tower from "../src/data/stadthausV239Replacement.json";
import previous from "../src/data/cityRecognitionV182.json";
import required from "../src/data/requiredMitteV239.json";
import { addRequiredMitteV239 } from "../src/RequiredMitteV239";
import { isSchlossplatzPreviousPartV239, createSchlossplatzColumnTesterV239, isSchlossplatzCorePrismV239 } from "../src/schlossplatzV239Profile";
import { keepStadthausBoxV182V239, keepStadthausSegmentV182V239 } from "../src/stadthausPreviousV239";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import type { PrismPayload } from "../src/IsometricCityWorld";

const originals = owners.previousPrisms as PrismPayload["buildings"];
const assets = new URL("../public/mesh/regierungsviertel/", import.meta.url);

test("Schlossplatz replaces only complete exact source prisms and actual snapped native tuples", () => {
  const source: PrismPayload = JSON.parse(readFileSync(new URL("lod2-prisms.json", assets), "utf8"));
  const found = source.buildings.filter(isSchlossplatzCorePrismV239);
  expect(found).toEqual(originals);
  for (const old of originals) {
    expect(isSchlossplatzCorePrismV239({ ...old, h_dm: old.h_dm + 1 })).toBeFalse();
    expect(isSchlossplatzCorePrismV239({ ...old, ring: old.ring.slice(1) })).toBeFalse();
  }
  const matches = createSchlossplatzColumnTesterV239(source.buildings);
  expect(owners.previousColumns).toHaveLength(506);
  for (const row of owners.previousColumns) {
    expect(matches(row.x, row.z, row.low, row.high, row.kind)).toBeTrue();
    expect(matches(row.x, row.z, row.low, row.high + 40, row.kind)).toBeFalse();
    expect(matches(row.x, row.z, row.low, row.high, row.kind + 1)).toBeFalse();
    expect(matches(row.x + 4, row.z + .01, row.low, row.high, row.kind)).toBeFalse();
    expect(createSchlossplatzColumnTesterV239([])(row.x, row.z, row.low, row.high, row.kind)).toBeFalse();
  }
  const a = owners.previousColumns[0];
  expect(createSchlossplatzColumnTesterV239(originals, 2)(a.x,a.z,a.low,a.high,a.kind)).toBeFalse();
});

test("only recorded hollow tower estimates retire, preserving every existing measured civic row", () => {
  for (const [rows, receipts, keep] of [
    [previous.boxes, tower.boxes, keepStadthausBoxV182V239],
    [previous.segments, tower.segments, keepStadthausSegmentV182V239],
  ] as const) {
    const indices = new Set(receipts.map(r => r.index));
    rows.forEach((row, i) => expect(keep(row, i)).toBe(!indices.has(i)));
    receipts.forEach(({ row, index }) => {
      expect(keep([...row.slice(0, -1), row.at(-1)! + 1], index)).toBeTrue();
      expect(keep(row, index + 100000)).toBeTrue();
    });
  }
});

test("required Schlossplatz navigation installs source footprints with holes once and preserves neighbors", () => {
  const index = compilePedestrianObstacles({ buildings: originals }, () => "day", { replaceSchlossplatzPrisms: true });
  const ids = new Set(owners.navigationSolids.map(s => s.sourceId));
  const unique = [...new Set([...index.cells.values()].flat())].filter(o => ids.has(o.sourceId ?? ""));
  expect(unique).toHaveLength(owners.navigationSolids.length);
  expect(unique.map(o => o.sourceId).sort()).toEqual(owners.navigationSolids.map(s => s.sourceId).sort());
  expect(unique.some(o => owners.prismIds.includes(o.sourceId ?? ""))).toBeFalse();
  const legacy = compilePedestrianObstacles({ buildings: originals });
  expect([...new Set([...legacy.cells.values()].flat())].filter(o => ids.has(o.sourceId ?? ""))).toHaveLength(oldNavigation.parts.length);
  for (const part of oldNavigation.parts) {
    expect(isSchlossplatzPreviousPartV239(part)).toBeTrue();
    expect(isSchlossplatzPreviousPartV239({ ...part, topY: part.topY + 1 })).toBeFalse();
    expect(isSchlossplatzPreviousPartV239({ ...part, ring: part.ring.slice(1) })).toBeFalse();
  }
});

for (const native of [false, true]) test(`required Mitte ${native ? "native" : "drawn"} preserves full source vertices and disposes on cancellation`, () => {
  const expected = required[native ? "minecraft" : "drawn"];
  const root = new Group();
  const build = addRequiredMitteV239(root, native);
  while (!build.next().done) { /* cooperative construction */ }
  let vertices = 0, indices = 0;
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    vertices += o.geometry.getAttribute("position").count;
    indices += o.geometry.index?.count ?? 0;
  });
  const meshes = expected.flatMap(p => p.meshes);
  expect(vertices).toBe(meshes.reduce((n,m) => n + Buffer.from(m.positions,"base64").length / 6, 0));
  expect(indices).toBe(meshes.reduce((n,m) => n + Buffer.from(m.indices,"base64").length / 4, 0));
  expect(root.children).toHaveLength(3);
  const geometries = new Set(), disposed = new Set();
  root.traverse(o => { if (o instanceof Mesh) {
    geometries.add(o.geometry); o.geometry.addEventListener("dispose", () => disposed.add(o.geometry));
  }});
  disposeSurroundingCityRoot(root);
  expect(disposed).toEqual(geometries);
  // Abandon while the first packed mesh is being built; its generator owns cleanup.
  const abandoned = new Group(), generator = addRequiredMitteV239(abandoned, native);
  generator.next(); generator.return(); disposeSurroundingCityRoot(abandoned);
  expect(abandoned.children).toHaveLength(0);
});
