import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { crossingPavingPart } from "../src/crossingPavingV368";
import { loadSurroundingDetailSourcesV362 } from "../src/primaryColourBankV362";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

const id = "-5_6";
const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(
  new URL("../public/mesh/surrounding-berlin-v159/-5_6.drawn.json.gz", import.meta.url),
)).toString());

// OSM footway 1110550700 crosses asphalt ways 4693555 / 4693557.
const worldProbe = [-2348.92, 3495.15];

function finish<T>(generator: Generator<void, T>): T {
  let next = generator.next();
  while (!next.done) next = generator.next();
  return next.value;
}

function hasFace(part: SurroundingPackedMesh, height: number, rgb: number[]): boolean {
  const positions = Buffer.from(part.positions, "base64");
  const indices = Buffer.from(part.indices, "base64");
  const colors = Buffer.from(part.colors, "base64");
  const x = (worldProbe[0] - packet.origin[0]) * 100;
  const z = (worldProbe[1] - packet.origin[2]) * 100;
  for (let i = 0; i < indices.length; i += 12) {
    const ids = [0, 4, 8].map(j => indices.readUInt32LE(i + j));
    if (!ids.every(v => positions.readUInt16LE(6*v+2) === height &&
        rgb.every((value, c) => value === colors[3*v+c]))) continue;
    const p = ids.map(v => [positions.readUInt16LE(6*v), positions.readUInt16LE(6*v+4)]);
    const turns = p.map(([ax, az], k) => {
      const [bx, bz] = p[(k+1)%3];
      return (bx-ax)*(z-az) - (bz-az)*(x-ax);
    });
    if (turns.every(v => v >= 0) || turns.every(v => v <= 0)) return true;
  }
  return false;
}

test("a mapped asphalt crossing covers the incorrect path face at its original location", async () => {
  const { crossingPaving } = await loadSurroundingDetailSourcesV362(id, false, {});
  const mesh = finish(crossingPavingPart(packet, crossingPaving));
  expect(mesh).toBeDefined();
  expect(packet.meshes.some(p => p.kind === "city" && hasFace(p, 1312, [149,131,92]))).toBe(true);
  expect(hasFace(mesh!, 1315, [39,41,39])).toBe(true);
  const city = packet.meshes.find(p => p.kind === "city")!;
  const staleMesh = { ...city, colors: city.colors.replace(/^./, city.colors[0] === "A" ? "B" : "A") };
  const stale = { ...packet, meshes: packet.meshes.map(p => p === city ? staleMesh : p) };
  expect(finish(crossingPavingPart(stale, crossingPaving))).toBeUndefined();
  expect(finish(crossingPavingPart({ ...packet, nav: { ...packet.nav, roads: [] } }, crossingPaving))).toBeUndefined();
  expect((await loadSurroundingDetailSourcesV362(id, true, {})).crossingPaving).toBeUndefined();
});
