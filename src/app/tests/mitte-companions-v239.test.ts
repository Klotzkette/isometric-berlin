import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import {
  disposeSurroundingCityRoot, validateSurroundingManifest,
  SURROUNDING_CITY_RESIDENT_BUDGET_BYTES, SURROUNDING_CITY_MAX_CHUNK_BYTES,
  SURROUNDING_CITY_PREFETCH_BYTES, type SurroundingCityManifest,
} from "../src/SurroundingCity";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const assets = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest: SurroundingCityManifest = JSON.parse(readFileSync(new URL("manifest.json", assets), "utf8"));
const additions = manifest.chunks.filter(d => /^(nikolai|northfront|namedfront)239-/.test(d.id));

test("bounded northern Mitte facade uses the existing catalogue and unchanged live budgets", () => {
  for (const prefix of ["nikolai239-", "northfront239-", "namedfront239-"])
    expect(additions.some(d => d.id.startsWith(prefix))).toBeTrue();
  expect(additions.length).toBeLessThanOrEqual(36);
  expect(validateSurroundingManifest(manifest)).toBe(manifest);
  expect(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES).toBe(24 * 1024 * 1024);
  expect(SURROUNDING_CITY_MAX_CHUNK_BYTES).toBe(12 * 1024 * 1024);
  expect(SURROUNDING_CITY_PREFETCH_BYTES).toBe(4 * 1024 * 1024);
});

for (const family of ["drawn", "minecraft"] as const)
  test(`all northern Mitte facade ${family} packets retain their vertices and release their GPU objects`, () => {
    let total = 0, largest = 0;
    for (const descriptor of additions) {
      const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(descriptor[family].url, assets))).toString());
      const original = JSON.stringify(packet);
      const result = createSurroundingCityChunk(packet, descriptor.id, family === "minecraft");
      expect(JSON.stringify(packet)).toBe(original);
      expect(result.root.children.length).toBeLessThanOrEqual(2);
      expect(result.geometryBytes).toBeLessThan(SURROUNDING_CITY_MAX_CHUNK_BYTES);
      const body = result.root.children[0] as Mesh;
      const vertices = packet.meshes.reduce((n, m) => n + Buffer.from(m.positions, "base64").length / 6, 0);
      const indices = packet.meshes.reduce((n, m) => n + Buffer.from(m.indices, "base64").length / 4, 0);
      expect(body.geometry.getAttribute("position").count).toBe(vertices);
      expect(body.geometry.index!.count).toBe(indices);
      expect(body.frustumCulled).toBeTrue();
      expect(body.matrixAutoUpdate).toBe(false);
      const geometries = new Set();
      const disposed = new Set();
      result.root.traverse(o => {
        if (!(o instanceof Mesh)) return;
        geometries.add(o.geometry);
        o.geometry.addEventListener("dispose", () => disposed.add(o.geometry));
      });
      total += result.geometryBytes;
      largest = Math.max(largest, result.geometryBytes);
      disposeSurroundingCityRoot(result.root);
      expect(disposed).toEqual(geometries);
    }
    expect(total).toBeLessThan(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES);
    console.log("Mitte fronts v239 decoded", { family, packets: additions.length, total, largest });
  });
