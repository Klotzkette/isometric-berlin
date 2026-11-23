import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { hasDistrictFrontsV379 } from "../src/districtFrontsIndexV379";
import { loadDistrictFrontsV379 } from "../src/districtFrontsV379";
import regions from "../src/data/districtFrontsIndexV379.json";

const site = resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
const manifest = JSON.parse(readFileSync(resolve(site, "manifest.json"), "utf8")) as {
  chunks: { id: string; drawn: { url: string }; minecraft: { url: string } }[];
};
const descriptors = new Map(manifest.chunks.map(row => [row.id, row]));
type RecordRow = { id: string; tile: string; borough: string; attributes: { "building:levels": string } };
const receipt: { sites: RecordRow[] } = JSON.parse(gunzipSync(readFileSync(resolve(
  import.meta.dir, "../../../geo_data/regierungsviertel/district-fronts-v379-evidence.json.gz",
))).toString());

test("both actual tile encodings draw each documented frontage in one mesh and only on its own navigation owners", async () => {
  const visited = [new Set<string>(), new Set<string>()];
  let checkedAbsent = false;
  for (const tile of Object.values(regions).flat()) {
    const descriptor = descriptors.get(tile)!;
    expect(hasDistrictFrontsV379(tile)).toBe(true);
    const siteIds = receipt.sites.filter(row => row.tile === tile).map(row => row.id).sort();
    for (const native of [false, true]) {
      const asset = descriptor[native ? "minecraft" : "drawn"].url;
      const chunk = JSON.parse(gunzipSync(readFileSync(resolve(site, asset))).toString()) as SurroundingCityChunk;
      const mesh = await loadDistrictFrontsV379(tile, native, chunk);
      expect(mesh?.isMesh).toBe(true);
      const ranges = mesh!.userData.districtFrontOwnersV379 as {id: string; count: number}[];
      expect(ranges.map(row => row.id).sort()).toEqual(siteIds);
      for (const row of ranges) {
        expect(row.count).toBeGreaterThan(0);
        visited[Number(native)].add(row.id);
      }
      expect(mesh!.geometry.getIndex()!.count).toBe(ranges.reduce((n, row) => n + row.count, 0));
      expect(mesh!.geometry.boundingSphere!.radius).toBeGreaterThan(0);
      expect(mesh!.geometry.boundingSphere!.radius).toBeLessThan(750);
      mesh!.geometry.dispose();
      mesh!.userData.dayMaterial.dispose();
      if (mesh!.userData.nightMaterial !== mesh!.userData.dayMaterial) mesh!.userData.nightMaterial.dispose();
      if (!checkedAbsent) {
        const empty = { ...chunk, nav: { ...chunk.nav, buildings: [] } };
        expect(await loadDistrictFrontsV379(tile, native, empty)).toBeUndefined();
        checkedAbsent = true;
      }
    }
  }
  const owners = new Set(receipt.sites.map(row => row.id));
  expect(owners.size).toBeGreaterThan(300);
  expect(new Set(receipt.sites.map(row => row.borough)).size).toBeGreaterThanOrEqual(11);
  expect(visited[0]).toEqual(owners);
  expect(visited[1]).toEqual(owners);
  expect(hasDistrictFrontsV379("unmapped")).toBe(false);
});

test("the normal surrounding-city loader attaches the measured facades and releases their geometry", async () => {
  const { createStreamedSurroundingCityChunkV255 } = await import("../src/SurroundingCity");
  const { disposeSurroundingCityRoot } = await import("../src/disposeSurroundingCityRootV323");
  const id = "ring182-9_10";
  const descriptor = descriptors.get(id)!;
  for (const native of [false, true]) {
    const asset = descriptor[native ? "minecraft" : "drawn"].url;
    const input = JSON.parse(gunzipSync(readFileSync(resolve(site, asset))).toString()) as SurroundingCityChunk;
    const entry = await createStreamedSurroundingCityChunkV255(input, id, native, { yield: async () => {} });
    const front = entry.root.getObjectByName("Mapped district street fronts v379") as import("three").Mesh;
    expect(front?.userData.districtFrontOwnersV379.map((row: {id: string}) => row.id)).toContain("OSM-way-244725851");
    let released = false;
    front.geometry.addEventListener("dispose", () => { released = true; });
    disposeSurroundingCityRoot(entry.root);
    expect(released).toBe(true);
  }
});
