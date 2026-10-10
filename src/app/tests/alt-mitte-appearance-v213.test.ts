import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import { applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213 } from "../src/altMitteAppearanceV213";
import { transferExactPacketTriangles } from "../src/exactPacketTransfer";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk, type SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import appearance from "../src/data/altMitteAppearanceV213.json";

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
  const coordinates = new Uint16Array(count * 3);
  const colours = new Uint8Array(count * 3).fill(90);
  const indices = new Uint32Array(count);
  const values = new Uint16Array((count + 4) * 6).fill(1234);
  for (let i = 0; i < count; i++) {
    coordinates.set([i, 1000 + i, i % 4], i * 3);
    values.set([i, 1000 + i, i % 4, 90 * 257, 90 * 257, 90 * 257], (i + 2) * 6);
    indices[i] = i;
  }
  const part: SurroundingPackedMesh = { kind: "alt-mitte-v169", positionType: "u16cm",
    positions: encode(coordinates), colors: encode(colours), indices: encode(indices) };
  const receipt = { mesh: 1, fingerprint: fingerprint(part), runs: runs([0, 3, 0, 3, 3, 1]) };
  const source: AltMitteAppearanceSourceV213 = { schemaVersion: 1, palette: [0x88775c, 0x29433d, 0x56746a],
    packets: { "drawn:alt-mitte-v169-test": [receipt], "drawn:test": [receipt],
      "minecraft:alt-mitte-v169-test": [{ ...receipt, runs: runs([0, 3, 0, 3, 3, 2]) }] } };
  return { part, values, source, receipt, count };
}

test("exact source wall and roof receipts change only selected colour cells, including resident shells", () => {
  for (const tile of ["test", "alt-mitte-v169-test"]) {
    const { part, values, source, count } = fixture(), original = values.slice();
    const packet = JSON.stringify(part);
    expect(finish(applyAltMitteAppearanceV213(tile, false, part, 1, values, 2, count, source)).changed).toBe(6);
    for (let i = 0; i < values.length; i++) {
      const local = Math.floor(i / 6) - 2;
      if (i % 6 < 3 || local < 0 || local >= 6) expect(values[i]).toBe(original[i]);
    }
    expect(Array.from(values.slice(2 * 6 + 3, 2 * 6 + 6))).toEqual([0x88, 0x77, 0x5c].map(v => v * 257));
    expect(Array.from(values.slice(5 * 6 + 3, 5 * 6 + 6))).toEqual([0x29, 0x43, 0x3d].map(v => v * 257));
    // Existing facade quads after the six source vertices retain their relief.
    expect(values.slice(8 * 6)).toEqual(original.slice(8 * 6));
    expect(JSON.stringify(part)).toBe(packet);
    const result = values.slice();
    finish(applyAltMitteAppearanceV213(tile, false, part, 1, values, 2, count, source));
    expect(values).toEqual(result);
  }
});

test("native receipts use their independently compiled face paint without geometry or continuous wash", () => {
  const { part, values, source, count } = fixture(), before = values.slice();
  expect(finish(applyAltMitteAppearanceV213("alt-mitte-v169-test", true, part, 1, values, 2, count, source)).changed).toBe(6);
  for (let vertex = 3; vertex < 6; vertex++) {
    const at = (vertex + 2) * 6;
    expect(values.slice(at, at + 3)).toEqual(before.slice(at, at + 3));
    expect(Array.from(values.slice(at + 3, at + 6))).toEqual([0x56, 0x74, 0x6a].map(v => v * 257));
  }
});

test("changed encoded sources, wrong owners, mode, mesh and kind retain original appearance", () => {
  const { part, source, count } = fixture();
  const changes: [string, boolean, SurroundingPackedMesh, number][] = [
    ["absent", false, part, 1], ["test", true, part, 1], ["test", false, part, 0],
    ["test", false, { ...part, kind: "authored-model" }, 1],
    ...(["positions", "colors", "indices"] as const).map(key =>
      ["test", false, { ...part, [key]: `B${part[key].slice(1)}` }, 1] as [string, boolean, SurroundingPackedMesh, number]),
  ];
  for (const [tile, native, input, mesh] of changes) {
    const { values } = fixture(), before = values.slice();
    expect(finish(applyAltMitteAppearanceV213(tile, native, input, mesh, values, 2, count, source)).changed).toBe(0);
    expect(values).toEqual(before);
  }
});

test("a malformed later range cannot partially paint an earlier source owner", () => {
  for (const tail of [[12, 1, 0], [2, 1, 0], [3, 0, 0], [3, 1, 99], [0xffffffff, 1, 0], [3, 0xffffffff, 0], [3]]) {
    const { part, values, source, receipt, count } = fixture(), before = values.slice();
    receipt.runs = runs([0, 3, 0, ...tail]);
    expect(() => finish(applyAltMitteAppearanceV213("test", false, part, 1, values, 2, count, source))).toThrow("Invalid Alt-Mitte appearance");
    expect(values).toEqual(before);
  }
});

test("large receipts yield throughout validation and painting, and can be cancelled", () => {
  const { part, values, source, receipt, count } = fixture(12_288);
  receipt.runs = runs(Array.from({ length: count }, (_, i) => [i, 1, i % 2]).flat());
  const result = finish(applyAltMitteAppearanceV213("test", false, part, 1, values, 2, count, source));
  expect(result.changed).toBe(count);
  // At least three validation and three application checkpoints, plus hashing.
  expect(result.yields).toBeGreaterThanOrEqual(9);
  const nextValues = fixture(count).values, before = nextValues.slice();
  const iterator = applyAltMitteAppearanceV213("test", false, part, 1, nextValues, 2, count, source);
  expect(iterator.next().done).toBe(false);
  iterator.return(0);
  expect(nextValues).toEqual(before);
});

test("appearance updates keep immutable packet fingerprints valid for exact later owner transfers", () => {
  const { part, values, source, receipt, count } = fixture();
  finish(applyAltMitteAppearanceV213("test", false, part, 1, values, 2, count, source));
  const indices = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  expect(finish(transferExactPacketTriangles([{ tile: "test", mode: "drawn", kind: part.kind,
    fingerprint: receipt.fingerprint, triangles: [1] }], "test", false, part, indices, 0)).changed).toBe(1);
  expect(indices).toEqual(new Uint16Array([0, 1, 2, 3, 3, 3, 6, 7, 8, 9, 10, 11]));
});

function realPacket(key: string): SurroundingCityChunk {
  const colon = key.indexOf(":"), mode = key.slice(0, colon), tile = key.slice(colon + 1);
  if (tile.startsWith("alt-mitte-v169-")) {
    const manifest = JSON.parse(readFileSync(new URL(`../src/data/altMitte${mode === "drawn" ? "Drawn" : "Native"}V169Source.json`, import.meta.url), "utf8"));
    const file = manifest.chunkFiles.find((value: { id: string }) => `alt-mitte-v169-${value.id}` === tile)?.file;
    expect(file).toBeDefined();
    return JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8"));
  }
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`, import.meta.url))).toString());
}

test("real drawn/native resident and streamed packets apply compiled receipts with identical topology and storage", async () => {
  const source = appearance as AltMitteAppearanceSourceV213;
  for (const native of [false, true]) for (const resident of [true, false]) {
    const mode = native ? "minecraft" : "drawn";
    const key = Object.keys(source.packets).find(value => value.startsWith(`${mode}:`) &&
      value.startsWith(`${mode}:alt-mitte-v169-`) === resident);
    expect(key).toBeDefined();
    const tile = key!.slice(key!.indexOf(":") + 1), chunk = realPacket(key!);
    const immutable = Bun.hash(JSON.stringify(chunk));
    // Preserve the resident/streamed v186 distinction, but use no v213 receipt.
    const original = createSurroundingCityChunk(chunk, `${resident ? "alt-mitte-v169-" : ""}unbound-appearance-v213`, native);
    const actual = createSurroundingCityChunk(chunk, tile, native);
    let yielded = 0;
    const cooperative = await createSurroundingCityChunkCooperatively(chunk, tile, native,
      { budgetMs: 0, yield: async () => { yielded++; } });
    try {
      // These sample packets contain no later exact-owner replacements, so the
      // unknown receipt key is an independent baseline for every source index.
      expect(actual.root.userData.panoramaTransferredTriangles ?? 0).toBe(0);
      expect(actual.root.userData.siteTransferredTrianglesV209 ?? 0).toBe(0);
      expect(actual.root.userData.siteTransferredLineSegmentsV209 ?? 0).toBe(0);
      expect(actual.root.userData.altMitteAppearanceVerticesV213).toBeGreaterThan(0);
      expect(actual.geometryBytes).toBe(original.geometryBytes);
      expect(actual.bufferCount).toBe(original.bufferCount);
      expect(actual.nav).toBe(chunk.nav);
      expect(cooperative.nav).toBe(chunk.nav);
      expect(actual.root.children.length).toBe(original.root.children.length);
      expect(yielded).toBeGreaterThan(0);
      let changed = 0;
      for (let mesh = 0; mesh < actual.root.children.length; mesh++) {
        const a = actual.root.children[mesh] as Mesh, b = original.root.children[mesh] as Mesh;
        const c = cooperative.root.children[mesh] as Mesh;
        expect(a.geometry.index?.array).toEqual(b.geometry.index?.array);
        expect(a.geometry.index?.array).toEqual(c.geometry.index?.array);
        expect(Object.keys(a.geometry.attributes)).toEqual(Object.keys(b.geometry.attributes));
        const current = a.geometry.getAttribute("position"), before = b.geometry.getAttribute("position");
        const repeated = c.geometry.getAttribute("position");
        expect(current.array).toEqual(repeated.array);
        expect(current.count).toBe(before.count);
        for (let i = 0; i < current.count; i++) {
          expect(current.getX(i)).toBe(before.getX(i));
          expect(current.getY(i)).toBe(before.getY(i));
          expect(current.getZ(i)).toBe(before.getZ(i));
        }
        const colours = a.geometry.getAttribute("color"), oldColours = b.geometry.getAttribute("color");
        if (colours) for (let i = 0; i < colours.count; i++) {
          if (colours.getX(i) !== oldColours.getX(i) || colours.getY(i) !== oldColours.getY(i) ||
              colours.getZ(i) !== oldColours.getZ(i)) changed++;
        }
      }
      expect(changed).toBeGreaterThan(0);
      expect(Bun.hash(JSON.stringify(chunk))).toBe(immutable);
    } finally {
      for (const result of [original, actual, cooperative]) disposeSurroundingCityRoot(result.root);
    }
  }
});
