import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyWeinbergLegacyMaterialsV271, type WeinbergLegacyMaterialsSourceV271 } from "../src/weinbergLegacyMaterialsV271";
import type { SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import manifest from "../src/data/weinbergLegacyMaterialsV271.json";

const encode = (a: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(a.buffer).toString("base64");
const runs = (values: number[]) => encode(new Uint32Array(values));
function fingerprint(part: SurroundingPackedMesh): number {
  let value = 2166136261;
  for (const byte of Buffer.from(part.positions + part.colors + part.indices)) value = Math.imul(value ^ byte, 16777619) >>> 0;
  return value;
}
function finish(iterator: Generator<void, number>): { changed: number; yields: number } {
  let next = iterator.next(), yields = 0;
  while (!next.done) { yields++; next = iterator.next(); }
  return { changed: next.value, yields };
}
function fixture(count = 12) {
  const positions = new Uint16Array(count * 3);
  const colours = new Uint8Array(count * 3).fill(90);
  const indices = new Uint32Array(count);
  const vertices = new Uint16Array((count + 4) * 6).fill(1234);
  for (let i = 0; i < count; i++) {
    positions.set([i, 1000 + i, i % 4], i * 3);
    vertices.set([i, 1000 + i, i % 4, 90 * 257, 90 * 257, 90 * 257], (i + 2) * 6);
    indices[i] = i;
  }
  const part: SurroundingPackedMesh = { kind: "mitte-street-fronts-v166", positionType: "u16cm",
    positions: encode(positions), colors: encode(colours), indices: encode(indices) };
  const receipt = { mesh: 1, kind: part.kind, fingerprint: fingerprint(part), runs: runs([0, 3, 0, 3, 3, 1]) };
  const source: WeinbergLegacyMaterialsSourceV271 = { schemaVersion: 1, palette: [0x88775c, 0x29433d, 0x56746a],
    packets: { "drawn:3_-3": [receipt], "minecraft:3_-3": [{ ...receipt, runs: runs([0, 3, 0, 3, 3, 2]) }] } };
  return { part, vertices, source, receipt, count };
}

test("exact legacy receipts change only selected colour cells in either old layer", () => {
  for (const kind of ["mitte-street-fronts-v166", "scheunenviertel-v168"]) {
    const { part, vertices, source, receipt, count } = fixture();
    part.kind = kind; receipt.kind = kind;
    const before = vertices.slice(), encoded = JSON.stringify(part);
    expect(finish(applyWeinbergLegacyMaterialsV271("3_-3", false, part, 1, vertices, 2, count, source)).changed).toBe(6);
    for (let i = 0; i < vertices.length; i++) {
      const local = Math.floor(i / 6) - 2;
      if (i % 6 < 3 || local < 0 || local >= 6) expect(vertices[i]).toBe(before[i]);
    }
    expect(Array.from(vertices.slice(2 * 6 + 3, 2 * 6 + 6))).toEqual([0x88, 0x77, 0x5c].map(v => v * 257));
    expect(JSON.stringify(part)).toBe(encoded);
    const result = vertices.slice();
    finish(applyWeinbergLegacyMaterialsV271("3_-3", false, part, 1, vertices, 2, count, source));
    expect(vertices).toEqual(result);
  }
});

test("native colours are independently bound and unrelated packets never read weak data", () => {
  const { part, vertices, source, count } = fixture();
  expect(finish(applyWeinbergLegacyMaterialsV271("3_-3", true, part, 1, vertices, 2, count, source)).changed).toBe(6);
  expect(Array.from(vertices.slice(5 * 6 + 3, 5 * 6 + 6))).toEqual([0x56, 0x74, 0x6a].map(v => v * 257));
  const guarded = { schemaVersion: 1, palette: [], get packets(): never { throw new Error("must not access weak field"); } } as WeinbergLegacyMaterialsSourceV271;
  expect(finish(applyWeinbergLegacyMaterialsV271("irrelevant", false, part, 1, vertices, 2, count, guarded)).changed).toBe(0);
  expect(finish(applyWeinbergLegacyMaterialsV271("3_-3", false, { ...part, kind: "alt-mitte-v169" }, 1, vertices, 2, count, guarded)).changed).toBe(0);
});

test("changed source bytes, another mesh or kind cannot recolour a substitute", () => {
  const { part, source, count } = fixture();
  const changed: [SurroundingPackedMesh, number][] = [
    [part, 0], [{ ...part, kind: "scheunenviertel-v168" }, 1],
    ...(["positions", "colors", "indices"] as const).map(key =>
      [{ ...part, [key]: `B${part[key].slice(1)}` }, 1] as [SurroundingPackedMesh, number]),
  ];
  for (const [input, mesh] of changed) {
    const { vertices } = fixture(), before = vertices.slice();
    expect(finish(applyWeinbergLegacyMaterialsV271("3_-3", false, input, mesh, vertices, 2, count, source)).changed).toBe(0);
    expect(vertices).toEqual(before);
  }
});

test("invalid late ranges fail before painting an earlier valid range", () => {
  for (const tail of [[12, 1, 0], [2, 1, 0], [3, 0, 0], [3, 1, 99], [0xffffffff, 1, 0], [3]]) {
    const { part, vertices, source, receipt, count } = fixture(), before = vertices.slice();
    receipt.runs = runs([0, 3, 0, ...tail]);
    expect(() => finish(applyWeinbergLegacyMaterialsV271("3_-3", false, part, 1, vertices, 2, count, source))).toThrow("Invalid Weinberg legacy material receipt");
    expect(vertices).toEqual(before);
  }
});

test("large receipts yield in validation and application and permit cancellation", () => {
  const { part, vertices, source, receipt, count } = fixture(12_288);
  receipt.runs = runs(Array.from({ length: count }, (_, i) => [i, 1, i % 2]).flat());
  const result = finish(applyWeinbergLegacyMaterialsV271("3_-3", false, part, 1, vertices, 2, count, source));
  expect(result.changed).toBe(count);
  expect(result.yields).toBeGreaterThanOrEqual(9);
  const next = fixture(count).vertices, before = next.slice();
  const iterator = applyWeinbergLegacyMaterialsV271("3_-3", false, part, 1, next, 2, count, source);
  expect(iterator.next().done).toBe(false);
  iterator.return(0);
  expect(next).toEqual(before);
});

test("committed actual drawn/native selectors preserve positions, other cells and all encoded streams", () => {
  const source = manifest as WeinbergLegacyMaterialsSourceV271;
  for (const [key, receipts] of Object.entries(source.packets)) {
    const [mode, tile] = key.split(":");
    const packet = JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`, import.meta.url))).toString());
    for (const receipt of receipts) {
      const part = packet.meshes[receipt.mesh] as SurroundingPackedMesh;
      const positions = new Uint16Array(Uint8Array.from(Buffer.from(part.positions, "base64")).buffer);
      const colours = Buffer.from(part.colors, "base64"), count = positions.length / 3;
      const vertices = new Uint16Array(count * 6);
      for (let i = 0; i < count; i++) {
        vertices.set(positions.subarray(i * 3, i * 3 + 3), i * 6);
        vertices.set([colours[i * 3] * 257, colours[i * 3 + 1] * 257, colours[i * 3 + 2] * 257], i * 6 + 3);
      }
      const before = vertices.slice(), encoded = JSON.stringify(part);
      const allowed = new Set<number>();
      const triples = new Uint32Array(Uint8Array.from(Buffer.from(receipt.runs, "base64")).buffer);
      for (let at = 0; at < triples.length; at += 3) {
        for (let vertex = triples[at]; vertex < triples[at] + triples[at + 1]; vertex++) allowed.add(vertex);
      }
      expect(finish(applyWeinbergLegacyMaterialsV271(tile, mode === "minecraft", part, receipt.mesh, vertices, 0, count)).changed).toBe(allowed.size);
      let misplaced = 0;
      for (let i = 0; i < vertices.length; i++) {
        if (i % 6 < 3 || !allowed.has(Math.floor(i / 6))) misplaced += Number(vertices[i] !== before[i]);
      }
      expect(misplaced).toBe(0);
      expect(JSON.stringify(part)).toBe(encoded);
    }
  }
});
