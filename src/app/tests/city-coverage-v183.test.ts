import { expect, test } from "bun:test";
import { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot, validateSurroundingManifest } from "../src/SurroundingCity";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import { prepareAllotmentsV264 } from "../src/AllotmentsV264";
import { prepareRoofHouseV233 } from "../src/roofHouseV233";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareHouseCurbsV233 } from "../src/houseCurbsV233";
import { prepareCityStreetsV249 } from "../src/cityStreetsV249";
import { prepareStreetCurvesV276, type StreetCurvesSourceV276 } from "../src/streetCurvesV276";
import roofHouses from "../src/data/roofHouseV233.json";
import streetCurves from "../src/data/streetCurvesV276.json";

function finish<T>(steps: Generator<void, T>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
function prepareLaterDetails(chunk: SurroundingCityChunk, id: string, native: boolean): SurroundingCityChunk {
  // These are exactly the six later append receipts intersecting city183 keys,
  // in production order. Keep every original part and the original 3 MiB limit.
  for (const prepare of [prepareAllotmentsV264, prepareRoofHouseV233, prepareHouseDoorsV233,
    prepareHouseCurbsV233, prepareCityStreetsV249, prepareStreetCurvesV276]) {
    chunk = finish(prepare(chunk, id, native));
  }
  return chunk;
}
const decoded = (positions: string) => new Uint16Array(Uint8Array.from(Buffer.from(positions, "base64")).buffer);
const bytes = (encoded: string) => Buffer.from(encoded, "base64").length;

test("all new v183 city packets decode through the production renderer without lost vertices", async () => {
  const folder = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
  const manifest = validateSurroundingManifest(await Bun.file(new URL("manifest.json", folder)).json());
  const additions = manifest.chunks.filter(chunk => chunk.id.startsWith("city183-"));
  expect(additions).toHaveLength(67);
  let vertices = 0, largest = 0;
  for (const descriptor of additions) for (const family of ["drawn", "minecraft"] as const) {
    const packed = new Uint8Array(await Bun.file(new URL(descriptor[family].url, folder)).arrayBuffer());
    const payload = JSON.parse(new TextDecoder().decode(Bun.gunzipSync(packed))) as SurroundingCityChunk;
    const native = family === "minecraft", key = `${family}:${descriptor.id}`;
    const snapshot = JSON.stringify(payload), prepared = prepareLaterDetails(payload, descriptor.id, native);
    payload.meshes.forEach((part, i) => expect(prepared.meshes[i], key).toBe(part));
    expect(prepared.lines, key).toBe(payload.lines);
    const built = createSurroundingCityChunk(payload, descriptor.id, native);
    try {
      const body = built.root.children.filter(object => object instanceof Mesh) as Mesh[];
      const ink = built.root.children.filter(object => object instanceof LineSegments) as LineSegments[];
      expect(body, key).toHaveLength(1);
      expect(ink, key).toHaveLength(!native && payload.lines?.positions ? 1 : 0);
      const curve = native ? undefined : (streetCurves as StreetCurvesSourceV276).chunks[descriptor.id];
      if (curve) {
        expect(built.nav.roads).toEqual([...(payload.nav.roads ?? []), ...curve.roads]);
        expect({ ...built.nav, roads: payload.nav.roads }).toEqual(payload.nav);
      } else expect(built.nav).toBe(payload.nav);

      // The decoder merges the original parts and the exact later appends into
      // one body. Compare every original scalar and every appended scalar.
      const position = body[0].geometry.getAttribute("position") as InterleavedBufferAttribute;
      let offset = 0;
      for (const part of prepared.meshes) {
        const source = decoded(part.positions);
        for (let p = 0; p < source.length; p++) {
          if (position.data.array[(offset + Math.floor(p / 3)) * 6 + p % 3] !== source[p]) {
            throw new Error(`v183 city source vertex changed in ${descriptor.id}/${family}`);
          }
        }
        offset += source.length / 3;
      }
      expect(position.count, key).toBe(offset);
      vertices += position.count;

      let lineVertices = 0;
      if (ink.length) {
        const original = decoded(payload.lines!.positions), arcs = decoded(curve?.lines.positions ?? "");
        const expected = new Uint16Array(original.length + arcs.length);
        expected.set(original); expected.set(arcs, original.length);
        const roof = (roofHouses.packets as Record<string, { segments: number[] }>)[key];
        // Only exact obsolete roof/chord segments collapse to their first point;
        // all other source ink and the full curved replacement remain checked.
        for (const segment of [...(roof?.segments ?? []), ...(curve?.segments ?? [])]) {
          expected.copyWithin(segment * 6 + 3, segment * 6, segment * 6 + 3);
        }
        const linePosition = ink[0].geometry.getAttribute("position");
        expect(linePosition.count * 3, key).toBe(expected.length);
        for (let p = 0; p < expected.length; p += 3) {
          if (linePosition.getX(p / 3) !== expected[p] || linePosition.getY(p / 3) !== expected[p + 1] ||
              linePosition.getZ(p / 3) !== expected[p + 2]) {
            throw new Error(`v183 city source ink changed outside its exact receipts in ${key}`);
          }
        }
        lineVertices = linePosition.count; vertices += lineVertices;
      }
      const indices = prepared.meshes.reduce((sum, part) => sum + bytes(part.indices) / 4, 0);
      expect(built.geometryBytes, key).toBe(offset * 12 + indices * (offset <= 65535 ? 2 : 4) +
        lineVertices * (payload.lines?.colors ? 12 : 6));
      expect(JSON.stringify(payload), key).toBe(snapshot);
      largest = Math.max(largest, built.geometryBytes);
    } finally { disposeSurroundingCityRoot(built.root); }
  }
  expect(vertices).toBeGreaterThan(200_000);
  expect(largest).toBeLessThan(3 * 1024 * 1024);
}, 60_000);

test("new v183 city and Steglitz ground exists before streaming; the original core stays owned", () => {
  for (const [x, z] of [[-3262, 4699], [-1086, 4637], [-5500, -1423], [6024, 3340]]) {
    expect(surroundingScopeGroundAt(x, z)).toBe(3);
  }
  expect(surroundingScopeGroundAt(0, 0)).toBeNull();
  expect(surroundingScopeGroundAt(20000, 20000)).toBeNull();
});
