import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { markHighRiseWalls } from "../src/highRiseWallFinish";
import { createSurroundingCityChunk, type SurroundingNavigation } from "../src/SurroundingCityGeometry";

const longRing = [[0, 0], [8, 0], [8, 8], [0, 8]];
const courtyard = [[2, 2], [2, 4], [4, 4], [4, 2]];
const nav: SurroundingNavigation = {
  groundY: 3, ground: [], water: [],
  buildings: [{ sourceId: "upper-floor", ring: longRing, holes: [courtyard], groundOffset: 2, minHeight: 4, height: 26 }],
};

test("only exact outer and courtyard wall vertices survive mixed index ownership", () => {
  const prefix = 4;
  // originY = -1; local heights of the source wall are 10 m and 32 m.
  const coords = [
    [0,1000,0],[800,1000,0],[0,3200,0], // qualified; roof also uses #2
    [200,1000,200],[200,1000,400],[200,3200,200], // independent courtyard
    [800,3200,0],[0,3200,800], // roof
    [0,1001,0],[800,1001,0],[0,3200,0], // wrong lower height
    [0,1000,0],[800,1000,800],[0,3200,0], // crosses the footprint diagonally
    [0,1000,0],[0,1000,0],[800,3200,0], // zero-area triangle
  ];
  const words = new Uint16Array((prefix + coords.length) * 6);
  coords.forEach((point, i) => words.set(point, (prefix + i) * 6));
  const faces = [0,1,2, 3,4,5, 2,6,7, 8,9,10, 11,12,13, 14,15,16];
  for (const Index of [Uint16Array, Uint32Array]) {
    const inds = new Index([0,1,2,...faces.map(i => prefix + i)]);
    const seen: number[] = [];
    for (const _ of markHighRiseWalls(words, inds, 3, faces.length, prefix, coords.length, nav, -1, v => seen.push(v))) {}
    expect(seen).toEqual([0,1,3,4,5].map(i => prefix + i));
  }
});

test("an actual 22.56 m surveyed Berlin building has exactly its 24 exclusive wall vertices", () => {
  const file = new URL("../public/mesh/surrounding-berlin-v159/-8_-4.drawn.json.gz", import.meta.url);
  const packet = JSON.parse(gunzipSync(readFileSync(file)).toString());
  const part = packet.meshes[0];
  expect(part.kind).toBe("city");
  const qualifying = packet.nav.buildings.filter((b: {height:number}) => b.height >= 22);
  expect(qualifying.map((b: {sourceId:string}) => b.sourceId)).toEqual(["DEBE01YYK0002SZd"]);
  const raw = Buffer.from(part.positions, "base64"), elements = Buffer.from(part.indices, "base64");
  const positions = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const inds = new Uint32Array(elements.buffer, elements.byteOffset, elements.byteLength / 4);
  const count = positions.length / 3, words = new Uint16Array(count * 6);
  for (let i = 0; i < count; i++) words.set(positions.subarray(i*3, i*3 + 3), i*6);
  const seen: number[] = [];
  const collect = (v: number) => seen.push(v);
  for (const _ of markHighRiseWalls(words, inds, 0, inds.length, 0, count, packet.nav, packet.origin[1], collect)) {}
  expect(seen).toEqual(Array.from({length:24}, (_,i) => 2342 + i));
  const low = { ...packet.nav, buildings: qualifying.map((b:object) => ({ ...b, height:21.99 })) };
  expect(markHighRiseWalls(words, inds, 0, inds.length, 0, count, low, packet.origin[1], collect).next().done).toBe(true);
});

test("the actual tile decoder attaches the one wall run to Drawn and keeps the paired Native tile separate", () => {
  for (const mode of ["drawn", "minecraft"] as const) {
    const file = new URL(`../public/mesh/surrounding-berlin-v159/-8_-4.${mode}.json.gz`, import.meta.url);
    const packet = JSON.parse(gunzipSync(readFileSync(file)).toString());
    const result = createSurroundingCityChunk(packet, "-8_-4", mode === "minecraft");
    const runs = result.root.children.flatMap(child => child.userData.architecturalRuns ?? []);
    expect(runs).toEqual(mode === "drawn" ? [2342 * 8192 + (24 - 1) * 4] : []);
  }
});
