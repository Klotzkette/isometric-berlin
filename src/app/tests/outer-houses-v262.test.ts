import { expect, test } from "bun:test";
import { Color, InterleavedBufferAttribute, Mesh } from "three";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { GENERIC_FACADE_SWATCHES } from "../src/cityColourV184";
import { outerHousePaletteV262, refineOuterHousePaletteV262,
  OUTER_HOUSE_FACADE_SWATCHES_V262, OUTER_HOUSE_ROOF_SWATCHES_V262 } from "../src/outerHousePaletteV262";
import { surroundingColourOwners, surroundingGenericColour } from "../src/surroundingCityColourV184";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import materials232 from "../src/data/outerMaterialsV232.json";
import materials254 from "../src/data/outerMaterialsV254.json";

function finish<T>(it: Generator<void, T>): T {
  let step = it.next(); while (!step.done) step = it.next(); return step.value;
}
const linear = (hex: number): [number, number, number] => new Color(hex).toArray().map(value => Math.round(value * 255)) as [number, number, number];
const WALL = linear(0xd3d0c3), ROOF = linear(0x9d978c);
const luminance = (rgb: readonly number[]) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
function packet(tile: string, native = false): SurroundingCityChunk {
  return JSON.parse(gunzipSync(readFileSync(new URL(
    `../public/mesh/surrounding-berlin-v159/${tile}.${native ? "minecraft" : "drawn"}.json.gz`, import.meta.url))).toString());
}
function owners(p: SurroundingCityChunk) {
  return finish(surroundingColourOwners(p.nav.buildings, p.nav.groundY,
    p.origin[1], p.origin[0], p.origin[2], undefined, false, true));
}

test("outer fallback is restrained and varied, with separate darker roofs and unchanged core swatches", () => {
  expect(GENERIC_FACADE_SWATCHES).toEqual([
    0xddc29e, 0xcba989, 0xe9dcc0, 0xafc0a7, 0xd4a596, 0xa8c4cb, 0xd2b679, 0xc6c6b8,
  ]);
  expect(new Set(OUTER_HOUSE_FACADE_SWATCHES_V262).size).toBe(8);
  expect(new Set(OUTER_HOUSE_ROOF_SWATCHES_V262).size).toBe(8);
  for (const hex of OUTER_HOUSE_FACADE_SWATCHES_V262) {
    const rgb = [hex >>> 16, (hex >>> 8) & 255, hex & 255];
    expect((Math.max(...rgb) - Math.min(...rgb)) / Math.max(...rgb)).toBeLessThan(0.31);
    for (const roof of OUTER_HOUSE_ROOF_SWATCHES_V262)
      expect(luminance(linear(hex))).toBeGreaterThan(luminance(linear(roof)) * 1.6);
  }
  const pairs = new Set<string>();
  for (let i = 0; i < 128; i++) pairs.add(JSON.stringify(outerHousePaletteV262(`OSM-way-${308981000 + i}`)));
  expect(pairs.size).toBeGreaterThan(24);
});

test("only exact retained primary packet names enter the new palette", () => {
  for (const id of ["-1_-7", "0_0", "ring182--11_-3", "city183--9_7",
    "outer187-27_7", "north190-5_-8", "east200-6_-17", "marzahn230-24_-5"])
    expect(refineOuterHousePaletteV262(id)).toBeTrue();
  for (const id of ["alt-mitte-v169-1", "outerfacade230-1_2", "district188-1_2",
    "northfront239-1_2", "ber236-1_2", "outer187-authored", "outer187-1_2-detail", ""])
    expect(refineOuterHousePaletteV262(id)).toBeFalse();
});

test("split owners keep one material at every height and ambiguous corners retain source paint", () => {
  const a = { sourceId: "ordinary-source", ring: [[0, 0], [10, 0], [10, 10], [0, 10]],
    holes: [[[2, 2], [4, 2], [4, 4], [2, 4]]], height: 12, minHeight: 0 };
  const b = { ...a, ring: [[0, 0], [3, 0], [3, 1], [0, 1]], holes: [], height: 20 };
  const read = (records: typeof a[]) => {
    const selected = finish(surroundingColourOwners(records, 3, -10, 0, 0, () => false, false, true));
    return [0, 1000, 2000, 3300].map(y => [...surroundingGenericColour(selected, 0, 0, ...WALL, y, [0, 0, 0])!]);
  };
  const expected = Array.from({ length: 4 }, () => [...outerHousePaletteV262(a.sourceId).wall]);
  expect(read([a, b, a])).toEqual(expected);
  expect(read([b, a, a])).toEqual(expected);
  const ambiguous = finish(surroundingColourOwners([a, { ...a, sourceId: "other" }], 3, -10, 0, 0, () => false, false, true));
  expect(surroundingGenericColour(ambiguous, 0, 0, ...WALL)).toBeUndefined();
  expect(surroundingGenericColour(ambiguous, 0, 0, ...ROOF)).toBeUndefined();
});

test("real primary packets preserve source bytes and every non-generic colour in both families", () => {
  for (const tile of ["-1_-7", "ring182--11_-3", "city183--9_7", "outer187-27_7",
    "north190-5_-8", "east200-6_-17", "marzahn230-24_-5"]) for (const native of [false, true]) {
    const p = packet(tile, native), before = JSON.stringify(p), selected = owners(p);
    let changedWalls = 0, changedRoofs = 0;
    for (const part of p.meshes) {
      if (part.kind !== "city") continue;
      const positions = Buffer.from(part.positions, "base64"), colors = Buffer.from(part.colors, "base64");
      const scratch: [number, number, number] = [0, 0, 0];
      for (let at = 0; at < colors.length; at += 3) {
        const original = [colors[at], colors[at + 1], colors[at + 2]] as [number, number, number];
        const next = surroundingGenericColour(selected, positions.readUInt16LE(at * 2),
          positions.readUInt16LE(at * 2 + 4), ...original,
          native ? undefined : positions.readUInt16LE(at * 2 + 2), scratch);
        if (!original.every((value, i) => value === WALL[i]) && !original.every((value, i) => value === ROOF[i])) {
          expect(next).toBeUndefined(); continue;
        }
        if (next) {
          if (original[0] === WALL[0]) changedWalls++; else changedRoofs++;
          expect(next).not.toEqual(original);
        }
      }
    }
    expect(changedWalls).toBeGreaterThan(0);
    expect(changedRoofs).toBeGreaterThan(0);
    expect(JSON.stringify(p)).toBe(before);
  }
});

test("real clipped neighbour owners retain matching roof and flat wall paint across origins", () => {
  for (const native of [false, true]) {
    const a = packet("outer187-27_7", native), b = packet("outer187-27_6", native);
    const aOwners = owners(a), bOwners = owners(b);
    let checked = 0;
    for (const first of a.nav.buildings) {
      const second = b.nav.buildings.find(building => building.sourceId === first.sourceId);
      if (!second) continue;
      for (const paint of [WALL, ROOF]) {
        const firstColour = surroundingGenericColour(aOwners, Math.round(first.ring[0][0] * 100), Math.round(first.ring[0][1] * 100), ...paint);
        const secondColour = surroundingGenericColour(bOwners, Math.round(second.ring[0][0] * 100), Math.round(second.ring[0][1] * 100), ...paint);
        if (firstColour && secondColour) { expect(firstColour).toEqual(secondColour); checked++; }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }
});

test("integrated decoder gives exact v232/v254 material receipts priority over the new fallback", () => {
  for (const evidence of [materials232, materials254]) for (const native of [false, true]) {
    const key = Object.keys(evidence.packets).find(key => key.startsWith(native ? "minecraft:" : "drawn:"))!;
    const tile = key.split(":")[1], p = packet(tile, native), before = JSON.stringify(p);
    const made = createSurroundingCityChunk(p, tile, native);
    try {
      const mesh = made.root.children.find(child => child instanceof Mesh) as Mesh;
      const geometry = mesh.geometry, colour = geometry.getAttribute("color") as InterleavedBufferAttribute;
      for (const receipt of evidence.packets[key as keyof typeof evidence.packets]) {
        const offset = p.meshes.slice(0, receipt.mesh).reduce((sum, part) => sum + Buffer.from(part.positions, "base64").length / 6, 0);
        const runs = Buffer.from(receipt.runs, "base64");
        for (let at = 0; at < runs.length; at += 12) {
          const first = runs.readUInt32LE(at), count = runs.readUInt32LE(at + 4), rgb = evidence.palette[runs.readUInt32LE(at + 8)];
          const expected = [rgb >>> 16, (rgb >>> 8) & 255, rgb & 255];
          for (let i = first; i < first + count; i++)
            expect(Array.from(colour.data.array.slice((offset + i) * 6 + 3, (offset + i) * 6 + 6))).toEqual(expected.map(value => value * 257));
        }
      }
      expect(made.nav).toEqual(p.nav);
      expect(made.bufferCount).toBe(2 + (!native && p.lines?.positions ? 1 : 0));
      expect(JSON.stringify(p)).toBe(before);
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});
