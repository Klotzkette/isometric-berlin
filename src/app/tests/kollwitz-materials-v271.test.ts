import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/kollwitzMaterialsV271.json";
import { applyKollwitzMaterialsV271 } from "../src/kollwitzMaterialsV271";
import type { AltMitteAppearanceSourceV213 } from "../src/altMitteAppearanceV213";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

const finish = <T>(iterator: Generator<void, T>): T => {
  let next = iterator.next(); while (!next.done) next = iterator.next(); return next.value;
};
const packet = (key: string): SurroundingCityChunk => {
  const [family, tile] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${family}.json.gz`, import.meta.url))).toString());
};
function destination(part: SurroundingPackedMesh, offset = 2): Uint16Array {
  const positions = Buffer.from(part.positions, "base64"), colors = Buffer.from(part.colors, "base64");
  const output = new Uint16Array((positions.length / 6 + offset + 2) * 6).fill(51);
  for (let vertex = 0; vertex < positions.length / 6; vertex++) for (let axis = 0; axis < 3; axis++) {
    output[(vertex + offset) * 6 + axis] = positions.readUInt16LE(vertex * 6 + axis * 2);
    output[(vertex + offset) * 6 + 3 + axis] = colors[vertex * 3 + axis] * 257;
  }
  return output;
}

test("all twelve Kollwitz receipts preserve topology, navigation and non-receipted cells", () => {
  let changed = 0;
  for (const [key, receipts] of Object.entries(data.packets)) {
    const source = packet(key), original = JSON.stringify(source), [family, tile] = key.split(":");
    for (const receipt of receipts) {
      const part = source.meshes[receipt.mesh], output = destination(part), before = output.slice();
      const count = Buffer.from(part.positions, "base64").length / 6, expected = new Map<number, number>();
      const runs = Buffer.from(receipt.runs, "base64");
      for (let at = 0; at < runs.length; at += 12) {
        const first = runs.readUInt32LE(at), count = runs.readUInt32LE(at + 4), color = data.palette[runs.readUInt32LE(at + 8)];
        for (let index = first; index < first + count; index++) expected.set(index + 2, color);
      }
      const written = finish(applyKollwitzMaterialsV271(tile, family === "minecraft", part, receipt.mesh, output, 2, count));
      expect(written).toBe(expected.size); changed += written;
      for (let index = 0; index < output.length; index++) {
        const vertex = Math.floor(index / 6), axis = index % 6, color = expected.get(vertex);
        if (axis < 3 || color === undefined) expect(output[index]).toBe(before[index]);
        else expect(output[index]).toBe(((color >>> ((5 - axis) * 8)) & 255) * 257);
      }
      const painted = output.slice();
      finish(applyKollwitzMaterialsV271(tile, family === "minecraft", part, receipt.mesh, output, 2, count));
      expect(output).toEqual(painted); expect(output.byteLength).toBe(before.byteLength);
    }
    expect(JSON.stringify(source)).toBe(original);
  }
  expect(changed).toBe(8274 + 9060);
});

test("changed source, wrong family, foreign tiles and old facade companions fail closed", () => {
  const key = Object.keys(data.packets)[0], source = packet(key), [family, tile] = key.split(":");
  const receipt = Object.values(data.packets)[0][0], part = source.meshes[receipt.mesh];
  const count = Buffer.from(part.positions, "base64").length / 6;
  for (const field of ["positions", "colors", "indices"] as const) {
    const changed = { ...part, [field]: (part[field][0] === "A" ? "B" : "A") + part[field].slice(1) };
    const output = destination(part), before = output.slice();
    expect(finish(applyKollwitzMaterialsV271(tile, family === "minecraft", changed, receipt.mesh, output, 2, count))).toBe(0);
    expect(output).toEqual(before);
  }
  for (const [id, native, kind] of [["4_-4", false, "city"], [tile, family !== "minecraft", "city"], [tile, false, "kiez-facades-v209"], [tile, false, "alt-mitte-v169"]] as const) {
    const output = destination(part), before = output.slice();
    expect(finish(applyKollwitzMaterialsV271(id, native, { ...part, kind }, receipt.mesh, output, 2, count))).toBe(0);
    expect(output).toEqual(before);
  }
});

test("an invalid late range cannot partially recolor an earlier valid owner", () => {
  const key = Object.keys(data.packets)[0], source = packet(key), [family, tile] = key.split(":");
  const receipt = Object.values(data.packets)[0][0], part = source.meshes[receipt.mesh];
  const count = Buffer.from(part.positions, "base64").length / 6;
  const bad = structuredClone(data) as AltMitteAppearanceSourceV213;
  const ranges = Buffer.from(receipt.runs, "base64"); ranges.writeUInt32LE(count + 1, ranges.length - 12);
  (bad.packets[key][0] as { runs: string }).runs = ranges.toString("base64");
  const output = destination(part), before = output.slice();
  expect(() => finish(applyKollwitzMaterialsV271(tile, family === "minecraft", part, receipt.mesh, output, 2, count, bad))).toThrow();
  expect(output).toEqual(before);
});

test("the tiny key index does not touch receipt data for unrelated city packets", () => {
  const source = packet(Object.keys(data.packets)[0]), part = source.meshes[0];
  const evidence = { schemaVersion: 1, palette: [], get packets() { throw new Error("receipt graph must stay untouched"); } } as unknown as AltMitteAppearanceSourceV213;
  const output = destination(part), before = output.slice(), count = Buffer.from(part.positions, "base64").length / 6;
  expect(finish(applyKollwitzMaterialsV271("outer187-27_6", false, part, 0, output, 2, count, evidence))).toBe(0);
  expect(output).toEqual(before);
});
