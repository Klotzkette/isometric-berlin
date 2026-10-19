import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import {
  disposeSurroundingCityRoot, SURROUNDING_CITY_MAX_CHUNK_BYTES,
  SURROUNDING_CITY_RESIDENT_BUDGET_BYTES, SURROUNDING_CITY_PREFETCH_BYTES,
} from "../src/SurroundingCity";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const assets = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const addition = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/tor-fronts-v244-manifest-addition.json", import.meta.url), "utf8"));
const packet = (descriptor: typeof addition.chunks[number], mode: "drawn" | "minecraft"): SurroundingCityChunk =>
  JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url, assets))).toString());

test("Torstraße uses six bounded packets and unchanged streaming limits", () => {
  expect(addition.chunks).toHaveLength(6);
  expect(SURROUNDING_CITY_MAX_CHUNK_BYTES).toBe(12 * 1024 * 1024);
  expect(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES).toBe(24 * 1024 * 1024);
  expect(SURROUNDING_CITY_PREFETCH_BYTES).toBe(4 * 1024 * 1024);
});

for (const mode of ["drawn", "minecraft"] as const) {
  test(`Torstraße ${mode}: complete geometry, unchanged source/nav, deterministic release`, () => {
    let total = 0;
    for (const descriptor of addition.chunks) {
      const data = packet(descriptor, mode);
      const before = JSON.stringify(data);
      const built = createSurroundingCityChunk(data, descriptor.id, mode === "minecraft");
      expect(JSON.stringify(data)).toBe(before);
      expect(data.nav).toEqual({ groundY: 3, ground: [], water: [], buildings: [] });
      expect(built.root.children).toHaveLength(1);
      expect(built.geometryBytes).toBeLessThan(SURROUNDING_CITY_MAX_CHUNK_BYTES);
      const body = built.root.children[0] as Mesh;
      const vertices = Buffer.from(data.meshes[0].positions, "base64").length / 6;
      const indices = Buffer.from(data.meshes[0].indices, "base64").length / 4;
      expect(body.geometry.getAttribute("position").count).toBe(vertices);
      expect(body.geometry.index!.count).toBe(indices);
      expect(body.frustumCulled).toBeTrue();
      expect(body.matrixAutoUpdate).toBe(false);
      let releases = 0;
      body.geometry.addEventListener("dispose", () => releases++);
      disposeSurroundingCityRoot(built.root);
      expect(releases).toBe(1);
      total += built.geometryBytes;
    }
    expect(total).toBeLessThan(7 * 1024 * 1024);
  });
}

test("Torstraße decode yields and a cancelled camera/mode request cannot publish geometry", async () => {
  const descriptor = addition.chunks.reduce((a: typeof addition.chunks[number], b: typeof addition.chunks[number]) =>
    a.minecraft.decodedBytes > b.minecraft.decodedBytes ? a : b);
  const data = packet(descriptor, "minecraft");
  const before = JSON.stringify(data);
  const controller = new AbortController();
  let yielded = 0;
  await expect(createSurroundingCityChunkCooperatively(data, descriptor.id, true, {
    signal: controller.signal, budgetMs: 0,
    yield: async () => { yielded++; controller.abort(); },
  })).rejects.toMatchObject({ name: "AbortError" });
  expect(yielded).toBe(1);
  expect(JSON.stringify(data)).toBe(before);
});
