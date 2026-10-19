import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const assets = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const addition = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/tor-landmark-v245-manifest-addition.json", import.meta.url), "utf8"));
const descriptor = addition.chunks[0];
const packet = (mode: "drawn" | "minecraft"): SurroundingCityChunk => JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url, assets))).toString());

for (const mode of ["drawn", "minecraft"] as const) {
  test(`Tor138 ${mode}: complete additive geometry and exact one-time GPU disposal`, () => {
    expect(addition.chunks).toHaveLength(1);
    const data = packet(mode), before = JSON.stringify(data);
    const built = createSurroundingCityChunk(data, descriptor.id, mode === "minecraft");
    expect(JSON.stringify(data)).toBe(before);
    expect(data.nav).toEqual({ groundY: 3, ground: [], water: [], buildings: [] });
    expect(built.root.children).toHaveLength(1);
    expect(built.geometryBytes).toBeLessThan(80_000);
    const mesh = built.root.children[0] as Mesh;
    expect(mesh.geometry.getAttribute("position").count).toBe(Buffer.from(data.meshes[0].positions, "base64").length / 6);
    expect(mesh.geometry.index!.count).toBe(Buffer.from(data.meshes[0].indices, "base64").length / 4);
    expect(mesh.frustumCulled).toBeTrue();
    expect(mesh.matrixAutoUpdate).toBeFalse();
    let disposed = 0;
    mesh.geometry.addEventListener("dispose", () => disposed++);
    disposeSurroundingCityRoot(built.root);
    expect(disposed).toBe(1);
  });
}

test("Tor138 a cancelled preparation cannot publish its new detail", async () => {
  const data = packet("minecraft"), before = JSON.stringify(data);
  const controller = new AbortController();
  controller.abort();
  await expect(createSurroundingCityChunkCooperatively(data, descriptor.id, true, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(JSON.stringify(data)).toBe(before);
});
