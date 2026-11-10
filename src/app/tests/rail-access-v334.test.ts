import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { InstancedMesh, Matrix4 } from "three";
import { createRailAccessV334 } from "../src/RailAccessV334";
import data from "../src/data/railAccessV334.json";
import prior from "../src/data/ubahnAccessV326.json";

const inventory = JSON.parse(gunzipSync(readFileSync(new URL(
  "../../../geo_data/regierungsviertel/rail-access-v334-evidence.json.gz", import.meta.url,
))).toString());
const sourceEntries = Object.values(data.cells).flat();
const support = { ground: () => 0, blocked: () => false, water: () => false };

test("the spatial ledger represents precisely the admitted public VBB entrances", () => {
  const represented = inventory.decisions.filter((row: { reason: string }) => row.reason === "represented");
  expect(data.stations).toHaveLength(279);
  expect(sourceEntries).toHaveLength(734);
  expect(Object.keys(data.stairs)).toHaveLength(28);
  expect(new Set(sourceEntries.map(row => row[0]))).toEqual(
    new Set(represented.map((row: { stop: { stop_id: string } }) => row.stop.stop_id)),
  );
  expect(data.source.vbb.license).toBe("CC-BY-4.0");
  expect(data.source.osm.license).toBe("ODbL-1.0");
  for (const [tile, rows] of Object.entries(data.cells)) {
    for (const row of rows) {
      expect(tile).toBe(`${Math.floor(Number(row[2]) / data.cellMeters)}_${Math.floor(Number(row[3]) / data.cellMeters)}`);
      expect(data.stations[Number(row[1])]).toBeDefined();
      if (typeof row[8] === "string") expect(row[8] in data.stairs).toBeTrue();
    }
  }
});

test("Stadtmitte and Hausvogteiplatz preserve the modeled entrances while priority gaps resolve", () => {
  const old = new Set(prior.entries.map(r => r.id));
  const priority = inventory.decisions.filter((r: { stop: { parent_station: string }; reason: string }) =>
    ["de:11000:900100011", "de:11000:900100012"].includes(r.stop.parent_station) && r.reason === "retained-ubahn");
  expect(priority).toHaveLength(12);
  expect(priority.every((r: { retained: string }) => old.has(r.retained))).toBeTrue();
  for (const id of ["000300081032", "000300166040", "000300166042", "000300253017"]) {
    expect(sourceEntries.some(row => row[0] === id)).toBeTrue();
  }
  expect(sourceEntries.find(row => row[0] === "000300166042")?.slice(4, 6)).toEqual(["S", "lift"]);
  const protectedStairs = inventory.decisions.flatMap((row: { retainedStair?: string }) => row.retainedStair ? [row.retainedStair] : []);
  expect(protectedStairs.sort()).toEqual(["way/391385385", "way/391385387", "way/391385389", "way/391385390"]);
  expect(protectedStairs.every((id: string) => !(id in data.stairs))).toBeTrue();
});

for (const native of [false, true]) {
  test(`matched Yorckstraße steps require both visible terrain and a raised landing (native=${native})`, () => {
    const layer = createRailAccessV334();
    const mesh = layer.root.children[0] as InstancedMesh;
    const x = -362.96, z = 3043.38;
    expect(layer.refresh(x, z, native, 0, support)).toBeTrue();
    expect(layer.root.userData.sourceIds).toContain("000300330020");
    expect(layer.root.userData.stairWays).toEqual([]);
    const signsOnly = mesh.count;
    expect(layer.refresh(x + 1, z + 1, native, 0, support)).toBeFalse();
    expect(layer.refresh(x, z, native, 1, { ...support, landing: () => 5 })).toBeTrue();
    expect(layer.root.userData.stairWays).toEqual(["way/52160288"]);
    expect(mesh.count).toBeGreaterThan(signsOnly);
    if (native) {
      const mat = new Matrix4();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, mat);
        const e = mat.elements;
        expect(Math.min(Math.abs(e[0]), Math.abs(e[2]))).toBeLessThan(1e-9);
        expect(Math.min(Math.abs(e[8]), Math.abs(e[10]))).toBeLessThan(1e-9);
      }
    }
    expect(layer.refresh(x, z, native, 2, { ...support, water: () => true, landing: () => 5 })).toBeTrue();
    expect(mesh.count).toBe(0);
    layer.dispose();
    expect(layer.root.children).toHaveLength(0);
    expect(layer.refresh(x, z, native, 3, support)).toBeFalse();
  });
}
