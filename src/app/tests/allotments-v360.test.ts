import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createAllotmentExteriorChunkV360 } from "../src/AllotmentDetailsV360";
import exterior from "../src/data/allotmentDetailsV360ExteriorIndex.json";
import index from "../src/data/allotmentDetailsV360Index.json";
import { surroundingPolygonContains } from "../src/SurroundingCityGeometry";

function finish<T>(work: Generator<void, T>): T {
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
}

function stored(id: string) {
  const record = index.sources.find(row => row.ids.includes(id));
  if (!record) throw Error(`Missing tile ${id}`);
  const bytes = readFileSync(new URL(`../src/data/${record.file}`, import.meta.url));
  expect(bytes.byteLength).toBe(record.compressedBytes);
  const raw = gunzipSync(bytes);
  expect(raw.byteLength).toBe(record.decodedBytes);
  return JSON.parse(raw.toString()).packets[id];
}

test("off-map foundations load in both geometry families and only admit mapped ground", () => {
  // This block contains part of Märchenland, previously outside city coverage.
  const cell = [12, -13] as const;
  expect(exterior.tiles).toContainEqual([...cell]);
  const record = stored("allotment360-12_-13");
  const [x, z] = cell.map(q => q * 512);
  for (const family of ["drawn", "minecraft"] as const) {
    const plan = { ...record[family], foundation: record.foundation };
    const chunk = finish(createAllotmentExteriorChunkV360(plan, [x, z, x + 512, z + 512], family === "minecraft"));
    expect(chunk?.meshes).toHaveLength(1);
    expect(chunk?.nav.groundY).toBe(3);
    const covers = (dx: number, dz: number) => chunk?.nav.ground.some(p => surroundingPolygonContains(p, dx, dz));
    expect(covers(120, 480)).toBe(true);
    expect(covers(500, 10)).toBe(false);
    expect(finish(createAllotmentExteriorChunkV360(plan, [x + 1, z, x + 512, z + 512], family === "minecraft"))).toBeUndefined();
  }
});
