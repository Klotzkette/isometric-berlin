import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import {
  disposeSurroundingCityRoot, validateSurroundingManifest,
  SURROUNDING_CITY_MAX_DESCRIPTORS, SURROUNDING_CITY_RESIDENT_BUDGET_BYTES,
  SURROUNDING_CITY_MAX_CHUNK_BYTES, SURROUNDING_CITY_PREFETCH_BYTES,
  type SurroundingCityManifest,
} from "../src/SurroundingCity";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const assets = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest: SurroundingCityManifest = JSON.parse(readFileSync(new URL("manifest.json", assets), "utf8"));
const airport = manifest.chunks.filter(d => d.id.startsWith("ber236-"));

test("complete BER catalogue fits its finite metadata allowance with unchanged live budgets", () => {
  expect(airport.length).toBeGreaterThan(36);
  expect(validateSurroundingManifest(manifest)).toBe(manifest);
  expect(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES).toBe(24 * 1024 * 1024);
  expect(SURROUNDING_CITY_MAX_CHUNK_BYTES).toBe(12 * 1024 * 1024);
  expect(SURROUNDING_CITY_PREFETCH_BYTES).toBe(4 * 1024 * 1024);
  const excess = { ...manifest, chunks: Array.from({ length: SURROUNDING_CITY_MAX_DESCRIPTORS + 1 }, (_, i) =>
    ({ ...manifest.chunks[0], id: `extra-${i}` })) };
  expect(() => validateSurroundingManifest(excess)).toThrow();
});

for (const family of ["drawn", "minecraft"] as const) test(`all BER ${family} packets decode losslessly inside the existing stream`, () => {
  let total = 0, largest = 0;
  for (const descriptor of airport) {
    const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(descriptor[family].url, assets))).toString());
    const original = JSON.stringify(packet);
    const result = createSurroundingCityChunk(packet, descriptor.id, family === "minecraft");
    expect(JSON.stringify(packet)).toBe(original);
    expect(result.root.userData.surroundingCity).toBe(true);
    expect(result.root.children.length).toBeLessThanOrEqual(2);
    expect(result.geometryBytes).toBeLessThan(SURROUNDING_CITY_MAX_CHUNK_BYTES);
    const body = result.root.children[0] as Mesh;
    const expectedVertices = packet.meshes.reduce((n, m) => n + Buffer.from(m.positions, "base64").length / 6, 0);
    const expectedIndices = packet.meshes.reduce((n, m) => n + Buffer.from(m.indices, "base64").length / 4, 0);
    if (expectedVertices === 0) {
      // A tiny source sliver can contain no complete native grid cell. Its
      // navigation packet remains valid, without an empty GPU allocation.
      expect(expectedIndices).toBe(0);
      expect(result.root.children.length).toBe(0);
      expect(result.geometryBytes).toBe(0);
      disposeSurroundingCityRoot(result.root);
      continue;
    }
    expect(body.geometry.getAttribute("position").count).toBe(expectedVertices);
    expect(body.geometry.index!.count).toBe(expectedIndices);
    expect(body.geometry.getAttribute("uv")).toBeUndefined();
    expect(body.frustumCulled).toBe(true);
    expect(body.matrixAutoUpdate).toBe(false);
    total += result.geometryBytes; largest = Math.max(largest, result.geometryBytes);
    disposeSurroundingCityRoot(result.root);
  }
  // The whole airport itself must fit the existing resident budget; moving
  // through Berlin must still use the ordinary culling/eviction controller.
  expect(total).toBeLessThan(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES);
  console.log("BER v236 decoded", { family, packets: airport.length, total, largest });
});
