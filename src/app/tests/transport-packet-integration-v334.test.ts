import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";

function readTile(id: string, native: boolean): SurroundingCityChunk {
  const mode = native ? "minecraft" : "drawn";
  const url = new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url);
  return JSON.parse(gunzipSync(readFileSync(url)).toString());
}

const schedule = { budgetMs: Infinity };
const ownership = { transportDetailsV334: true };
for (const native of [false, true]) {
  test(`streaming publishes both complete bridge halves with previous navigation (native=${native})`, async () => {
    for (const id of ["outer187-27_16", "outer187-27_15"]) {
      const packet = readTile(id, native);
      const before = await createStreamedSurroundingCityChunkV255(packet, id, native, schedule);
      const after = await createStreamedSurroundingCityChunkV255(packet, id, native, schedule, ownership);
      try {
        expect(after.root.userData.sourceKinds).toContain("katzengrabensteg-v334");
        expect(after.root.userData.namedSiteTrianglesV238).toBeUndefined();
        expect(after.nav).toEqual(before.nav);
        expect(after.geometryBytes).toBeGreaterThan(before.geometryBytes);
        expect(after.geometryBytes).toBeLessThan(24 * 1024 * 1024);
      } finally {
        disposeSurroundingCityRoot(before.root);
        disposeSurroundingCityRoot(after.root);
      }
    }
  });

  test(`the station source is loaded only on the opted-in existing tile (native=${native})`, async () => {
    const id = "5_-7";
    const packet = readTile(id, native);
    const before = await createStreamedSurroundingCityChunkV255(packet, id, native, schedule);
    const after = await createStreamedSurroundingCityChunkV255(packet, id, native, schedule, ownership);
    try {
      expect(before.root.userData.namedSiteTrianglesV238).toBeUndefined();
      expect(after.root.userData.namedSiteTrianglesV238).toBe(native ? 486 : 54);
      expect(after.geometryBytes).toBeLessThan(24 * 1024 * 1024);
    } finally {
      disposeSurroundingCityRoot(before.root);
      disposeSurroundingCityRoot(after.root);
    }
  });
}
