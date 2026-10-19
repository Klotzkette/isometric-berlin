import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const assets = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const addition = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/danziger-landmark-v245-manifest-addition.json", import.meta.url), "utf8"));

for (const family of ["drawn", "minecraft"] as const) {
  test(`Danziger57 ${family}: full packet decode and complete disposal`, () => {
    expect(addition.chunks).toHaveLength(1);
    const desc = addition.chunks[0];
    const data: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(desc[family].url, assets))).toString());
    const before = JSON.stringify(data);
    const result = createSurroundingCityChunk(data, desc.id, family === "minecraft");
    expect(JSON.stringify(data)).toBe(before);
    expect(result.root.children).toHaveLength(1);
    expect(result.geometryBytes).toBeLessThan(80_000);
    const body = result.root.children[0] as Mesh;
    expect(body.geometry.getAttribute("position").count).toBe(Buffer.from(data.meshes[0].positions, "base64").length / 6);
    expect(body.geometry.index!.count).toBe(Buffer.from(data.meshes[0].indices, "base64").length / 4);
    expect(body.frustumCulled).toBeTrue();
    expect(body.matrixAutoUpdate).toBeFalse();
    let disposed = 0;
    body.geometry.addEventListener("dispose", () => disposed++);
    disposeSurroundingCityRoot(result.root);
    expect(disposed).toBe(1);
  });

  test(`Danziger57 ${family}: superseded camera request aborts before publication`, async () => {
    const desc = addition.chunks[0];
    const data: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(desc[family].url, assets))).toString());
    const before = JSON.stringify(data);
    const controller = new AbortController();
    let yields = 0;
    await expect(createSurroundingCityChunkCooperatively(data, desc.id, family === "minecraft", {
      signal: controller.signal, budgetMs: 0,
      yield: async () => { yields++; controller.abort(); },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(yields).toBe(1);
    expect(JSON.stringify(data)).toBe(before);
  });
}
