import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyNorthMitteColoursV271 } from "../src/northMitteColoursV271";
import { applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213 } from "../src/altMitteAppearanceV213";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import data from "../src/data/northMitteColoursV271.json";
import keys from "../src/data/northMitteColoursV271Index.json";

const source = data as AltMitteAppearanceSourceV213;
function finish<T>(iterator: Generator<void, T>): T {
  let step = iterator.next(); while (!step.done) step = iterator.next(); return step.value;
}
function packet(key: string): SurroundingCityChunk {
  const [mode, tile] = key.split(":");
  if (tile.startsWith("alt-mitte-v169-")) {
    const catalogue = JSON.parse(readFileSync(new URL(`../src/data/altMitte${mode === "drawn" ? "Drawn" : "Native"}V169Source.json`, import.meta.url), "utf8"));
    const file = catalogue.chunkFiles.find((row: { id: string }) => `alt-mitte-v169-${row.id}` === tile).file;
    return JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8"));
  }
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`, import.meta.url))).toString());
}

test("all finite real receipts alter only their exact existing colour cells after v213", () => {
  expect(keys).toEqual(Object.keys(source.packets).sort());
  for (const key of keys) {
    const chunk = packet(key), [mode, tile] = key.split(":"), native = mode === "minecraft";
    for (const receipt of source.packets[key]) {
      const part = chunk.meshes[receipt.mesh], immutable = Bun.hash(JSON.stringify(part));
      const positions = new Uint16Array(Uint8Array.from(Buffer.from(part.positions, "base64")).buffer);
      const colors = Buffer.from(part.colors, "base64"), count = positions.length / 3;
      const vertices = new Uint16Array(count * 6);
      for (let v = 0; v < count; v++) for (let c = 0; c < 3; c++) {
        vertices[v * 6 + c] = positions[v * 3 + c];
        vertices[v * 6 + c + 3] = colors[v * 3 + c] * 257;
      }
      finish(applyAltMitteAppearanceV213(tile, native, part, receipt.mesh, vertices, 0, count));
      const expected = vertices.slice();
      const runs = new Uint32Array(Uint8Array.from(Buffer.from(receipt.runs, "base64")).buffer);
      let selected = 0;
      for (let i = 0; i < runs.length; i += 3) {
        const tone = source.palette[runs[i + 2]];
        for (let v = runs[i]; v < runs[i] + runs[i + 1]; v++) {
          expected.set([tone >>> 16, (tone >>> 8) & 255, tone & 255].map(c => c * 257), v * 6 + 3);
          selected++;
        }
      }
      expect(finish(applyNorthMitteColoursV271(tile, native, part, receipt.mesh, vertices, 0, count))).toBe(selected);
      expect(vertices).toEqual(expected);
      expect(Bun.hash(JSON.stringify(part))).toBe(immutable);
      const firstPass = vertices.slice();
      finish(applyNorthMitteColoursV271(tile, native, part, receipt.mesh, vertices, 0, count));
      expect(vertices).toEqual(firstPass);
    }
  }
});

test("unrelated tiles and mesh kinds reject before reading construction receipts", () => {
  const key = keys[0], chunk = packet(key), part = chunk.meshes[source.packets[key][0].mesh];
  const inaccessible = { schemaVersion: 1, palette: [], get packets(): never { throw new Error("receipt read"); } } as AltMitteAppearanceSourceV213;
  expect(finish(applyNorthMitteColoursV271("unrelated", false, part, 0, new Uint16Array(), 0, 0, inaccessible))).toBe(0);
  expect(finish(applyNorthMitteColoursV271(key.split(":")[1], key.startsWith("minecraft"), { ...part, kind: "authored" }, 0, new Uint16Array(), 0, 0, inaccessible))).toBe(0);
});

test("changed source bytes fail closed without a partial colour write", () => {
  const key = keys[0], [mode, tile] = key.split(":"), chunk = packet(key), receipt = source.packets[key][0];
  const part = chunk.meshes[receipt.mesh], count = Buffer.from(part.positions, "base64").length / 6;
  for (const field of ["positions", "colors", "indices"] as const) {
    const text = part[field], changed = { ...part, [field]: (text[0] === "A" ? "B" : "A") + text.slice(1) };
    const values = new Uint16Array(count * 6).fill(17), before = values.slice();
    expect(finish(applyNorthMitteColoursV271(tile, mode === "minecraft", changed, receipt.mesh, values, 0, count))).toBe(0);
    expect(values).toEqual(before);
  }
});
