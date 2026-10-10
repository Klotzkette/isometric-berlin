import { expect, test } from "bun:test";
import { Color, InterleavedBufferAttribute, Mesh } from "three";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const encode = (array: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
const rgb = (hex: number) => new Color(hex).toArray().map(value => Math.round(value * 255));
const WALL = rgb(0xd3d0c3), ROOF = rgb(0x9d978c), AUTHORED = rgb(0xa8b9ad);
function fixture(offset = 0, sourceId = "way/123"): SurroundingCityChunk {
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]].map(([x, z]) => [x + offset, z]);
  const holes = [[[2 + offset, 2], [4 + offset, 2], [4 + offset, 4], [2 + offset, 4]]];
  return {
    schemaVersion: 1, origin: [512 - offset, -10, 512],
    meshes: [{ kind: "city", positionType: "u16cm",
      positions: encode(new Uint16Array([
        offset * 100, 1300, 0, (offset + 10) * 100, 2300, 0, (offset + 2) * 100, 2300, 200,
        offset * 100, 2300, 0, (offset + 5) * 100, 1300, 500, (offset + 10) * 100, 1300, 1000,
      ])), colors: encode(new Uint8Array([...WALL, ...ROOF, ...WALL, ...AUTHORED, ...WALL, ...WALL])),
      indices: encode(new Uint32Array([0, 1, 2, 3, 4, 5])) }],
    nav: { groundY: 3, ground: [], water: [], buildings: [{ ring, holes, sourceId, height: 10, minHeight: 0 }] },
  };
}
function vertexColours(chunk: SurroundingCityChunk, minecraft = false): number[][] {
  const result = createSurroundingCityChunk(chunk, "colours", minecraft);
  try {
    const geometry = (result.root.children[0] as Mesh).geometry;
    const data = (geometry.getAttribute("color") as InterleavedBufferAttribute).data.array;
    expect(result.geometryBytes).toBe(6 * 12 + 6 * 2);
    expect(result.nav).toBe(chunk.nav);
    expect(geometry.index!.array).toEqual(new Uint16Array([0, 1, 2, 3, 4, 5]));
    const original = new Uint16Array(Uint8Array.from(Buffer.from(chunk.meshes[0].positions, "base64")).buffer);
    for (let i = 0; i < original.length; i++) expect(data[Math.floor(i / 3) * 6 + i % 3]).toBe(original[i]);
    return Array.from({ length: data.length / 6 }, (_, i) => Array.from(data.slice(i * 6 + 3, i * 6 + 6), channel => channel / 257));
  } finally { disposeSurroundingCityRoot(result.root); }
}

test("only generic city wall/roof colours at uniquely owned source corners change", () => {
  const chunk = fixture(), source = JSON.stringify(chunk), colors = vertexColours(chunk);
  expect(colors[0]).not.toEqual(WALL);
  expect(colors[1]).not.toEqual(ROOF);
  // Courtyard keeps its owner's paint, with the v211 source-height wash.
  expect(colors[2].every((channel, i) => channel > colors[0][i])).toBeTrue();
  expect(colors[3]).toEqual(AUTHORED);
  expect(colors[4]).toEqual(WALL); // No source-corner ownership.
  expect(JSON.stringify(chunk)).toBe(source);
  chunk.meshes[0].kind = "bespoke-model";
  expect(vertexColours(chunk)).toEqual([WALL, ROOF, WALL, AUTHORED, WALL, WALL]);
});

test("source palette survives chunk origins, native mode and repeated source parts", () => {
  const expected = vertexColours(fixture());
  expect(vertexColours(fixture(20))).toEqual(expected);
  const native = vertexColours(fixture(), true);
  expect(native.slice(3, 5)).toEqual(expected.slice(3, 5)); // Authored / unowned.
  expect(native[5]).toEqual(native[0]);
  expect(expected[5]).toEqual(expected[0]);
  expect(native[1]).toEqual(expected[1]); // Roof tone unchanged between modes.
  expect(native[0]).toEqual(native[2]); // Native keeps its flat block material.
  expect(native[0].every((channel, i) => channel > expected[0][i] && channel <= expected[2][i])).toBeTrue();
  const repeated = fixture();
  repeated.nav.buildings.push(structuredClone(repeated.nav.buildings[0]));
  expect(vertexColours(repeated)).toEqual(expected);
});

test("v211 grounding follows source ground, elevated parts and terrain offsets", () => {
  const expected = vertexColours(fixture());
  for (const [groundDelta, terrainOffset, originDelta, minHeight] of [
    [7, 0, 0, 0], [0, 8, 0, 0], [0, 0, 6, 0], [0, 0, 0, 4], [5, 7, 4, 2],
  ]) {
    const chunk = fixture();
    chunk.nav.groundY += groundDelta;
    chunk.origin[1] += originDelta;
    chunk.nav.buildings[0].groundOffset = terrainOffset;
    chunk.nav.buildings[0].minHeight += minHeight;
    chunk.nav.buildings[0].height += minHeight;
    const positions = new Uint16Array(Uint8Array.from(Buffer.from(chunk.meshes[0].positions, "base64")).buffer);
    for (let i = 1; i < positions.length; i += 3) positions[i] += (groundDelta + terrainOffset + minHeight - originDelta) * 100;
    chunk.meshes[0].positions = encode(positions);
    expect(vertexColours(chunk)).toEqual(expected);
  }
});

test("ambiguous vertical parts retain flat paint independent of order", () => {
  const chunk = fixture(), other = structuredClone(chunk.nav.buildings[0]);
  other.height += 7;
  chunk.nav.buildings.push(other);
  const expected = vertexColours(chunk);
  expect(expected[0]).toEqual(expected[2]);
  expect(expected).toEqual(vertexColours(chunk, true));
  chunk.nav.buildings.reverse();
  expect(vertexColours(chunk)).toEqual(expected);
});

test("conflicting heights disable the whole source wash with only one shared corner", () => {
  const chunk = fixture(), original = structuredClone(chunk.nav.buildings[0]);
  chunk.nav.buildings.push({ ...original, height: original.height + 7,
    ring: [[0, 0], [4, 0], [4, 1], [0, 1]], holes: [] });
  // A later matching part cannot re-enable the first part's wash.
  chunk.nav.buildings.push(structuredClone(original));
  const source = JSON.stringify(chunk), expected = vertexColours(chunk, true);
  expect(expected[0]).not.toEqual(WALL); // Keep the source palette.
  expect(expected[0]).toEqual(expected[2]); // Shared base / unshared court top.
  expect(expected[0]).toEqual(expected[5]); // Unshared exterior base.
  expect(vertexColours(chunk)).toEqual(expected);
  expect(JSON.stringify(chunk)).toBe(source);
  chunk.nav.buildings = [chunk.nav.buildings[1], original, structuredClone(original)];
  expect(vertexColours(chunk)).toEqual(expected);
  chunk.nav.buildings.reverse();
  expect(vertexColours(chunk)).toEqual(expected);
});

test("shared corners retain original colours regardless of source order", () => {
  const chunk = fixture(), other = structuredClone(chunk.nav.buildings[0]);
  other.sourceId = "way/456";
  chunk.nav.buildings.push(other);
  const expected = [WALL, ROOF, WALL, AUTHORED, WALL, WALL];
  expect(vertexColours(chunk)).toEqual(expected);
  chunk.nav.buildings.reverse();
  expect(vertexColours(chunk)).toEqual(expected);
});

test("cooperative colouring yields bounded ownership work and matches synchronous bytes", async () => {
  const chunk = fixture();
  chunk.nav.buildings[0].ring = Array.from({ length: 8_193 }, (_, i) => chunk.nav.buildings[0].ring[i % 4]);
  let yields = 0;
  const sync = createSurroundingCityChunk(chunk, "sync");
  const cooperative = await createSurroundingCityChunkCooperatively(chunk, "cooperative", false,
    { budgetMs: 0, yield: async () => { yields++; } });
  try {
    const data = (value: typeof sync) => ((value.root.children[0] as Mesh).geometry.getAttribute("color") as InterleavedBufferAttribute).data.array;
    expect(yields).toBeGreaterThan(2);
    expect(data(cooperative)).toEqual(data(sync));
    expect(cooperative.geometryBytes).toBe(sync.geometryBytes);
  } finally { disposeSurroundingCityRoot(sync.root); disposeSurroundingCityRoot(cooperative.root); }
});
