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
  expect(colors[2]).toEqual(colors[0]); // Courtyard follows its source owner.
  expect(colors[3]).toEqual(AUTHORED);
  expect(colors[4]).toEqual(WALL); // No source-corner ownership.
  expect(JSON.stringify(chunk)).toBe(source);
  chunk.meshes[0].kind = "bespoke-model";
  expect(vertexColours(chunk)).toEqual([WALL, ROOF, WALL, AUTHORED, WALL, WALL]);
});

test("source palette survives chunk origins, native mode and repeated source parts", () => {
  const expected = vertexColours(fixture());
  expect(vertexColours(fixture(20))).toEqual(expected);
  expect(vertexColours(fixture(), true)).toEqual(expected);
  const repeated = fixture();
  repeated.nav.buildings.push(structuredClone(repeated.nav.buildings[0]));
  expect(vertexColours(repeated)).toEqual(expected);
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
