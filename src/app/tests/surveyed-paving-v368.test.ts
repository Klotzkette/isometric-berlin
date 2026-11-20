import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadSurroundingDetailSourcesV362 } from "../src/primaryColourBankV362";
import { surveyedPavingPart } from "../src/surveyedPavingV368";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import palette from "../src/data/surveyedPavingPaletteV368.json";

function finish<T>(generator: Generator<void, T>): T {
  let next = generator.next();
  while (!next.done) next = generator.next();
  return next.value;
}

function elevationAt(part: SurroundingPackedMesh, origin: number[], x: number, z: number, rgb: number[]) {
  const vertices = Buffer.from(part.positions, "base64");
  const colors = Buffer.from(part.colors, "base64");
  const indices = Buffer.from(part.indices, "base64");
  for (let i = 0; i < indices.length; i += 12) {
    const ids = [0, 4, 8].map(offset => indices.readUInt32LE(i + offset));
    if (!ids.every(id => rgb.every((color, axis) => colors[id * 3 + axis] === color))) continue;
    const corners = ids.map(id => [
      origin[0] + vertices.readUInt16LE(id * 6) / 100,
      origin[2] + vertices.readUInt16LE(id * 6 + 4) / 100,
    ]);
    const turns = corners.map(([a, b], index) => {
      const [c, d] = corners[(index + 1) % 3];
      return (c - a) * (z - b) - (d - b) * (x - a);
    });
    if (Math.min(...turns) >= 0 || Math.max(...turns) <= 0) {
      const area = turns.reduce((sum, turn) => sum + turn, 0);
      if (!area) continue;
      return origin[1] + ids.reduce((sum, id, corner) =>
        sum + turns[(corner + 1) % 3] / area * vertices.readUInt16LE(id * 6 + 2) / 100, 0);
    }
  }
  return undefined;
}

const probes = [
  ["Nördlicher Uferweg, Pfaueninsel", "outer187--34_17", -17043.47, 8998.91, 4],
  ["Mosaikpflaster Inselstraße, Schwanenwerder", "outer187--28_14", -13884.61, 7625.75, 10],
  ["Franz-Amrehn-Platz, Steglitz", "ring182--7_12", -3344.99, 6330.97, 0],
  ["Hammarskjöldplatz am Funkturm", "ring182--13_2", -6538.7, 1166.56, 0],
  ["Olympiastadion, Pflaster am Osttor", "outer187--18_0", -8706.667, 266.667, 0],
  ["Grüner Weg am Tempelhofer Feld", "ring182-6_10", 3508.2, 5353.2, 5],
] as const;
for (const [name, id, x, z, material] of probes) {
  test(`surveyed ground and documented material at ${name}`, async () => {
    const filename = new URL(`../public/mesh/surrounding-berlin-v159/${id}.drawn.json.gz`, import.meta.url);
    const chunk: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(filename)).toString());
    const { surveyedPaving } = await loadSurroundingDetailSourcesV362(id, false, {});
    const part = finish(surveyedPavingPart(chunk, surveyedPaving, true));
    expect(part).toBeDefined();
    const height = elevationAt(part!, chunk.origin, x, z, palette[material]);
    expect(height).toBeDefined();
    if (id === "outer187--18_0") {
      // The V201 forecourt is over thirty metres above the ordinary datum.
      const groundColors = [[125, 131, 103], [51, 90, 36], [149, 131, 92]];
      const supports = chunk.meshes.filter(mesh => mesh.kind === "city")
        .flatMap(mesh => groundColors.map(rgb => elevationAt(mesh, chunk.origin, x, z, rgb)))
        .filter((value): value is number => value !== undefined);
      expect(height!).toBeCloseTo(34.18, 2);
      expect(supports.some(value => height! - value > .025 && height! - value < .045)).toBe(true);
    }
    expect((await loadSurroundingDetailSourcesV362(id, true, {})).surveyedPaving).toBeUndefined();
    expect(finish(surveyedPavingPart({...chunk, nav: {...chunk.nav, ground: []}}, surveyedPaving, true))).toBeUndefined();
    if (id === "outer187--34_17") {
      expect(finish(surveyedPavingPart(chunk, surveyedPaving, false))).toBeUndefined();
    }
  });
}
