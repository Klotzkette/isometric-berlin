import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Raycaster, Vector3 } from "three";
import data from "../src/data/cityStreetsV249.json";
import { prepareCityStreetsV249, type CityStreetSourceV249 } from "../src/CityStreetsV249";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const root = path.resolve(import.meta.dir, "../../..");
const evidence = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "geo_data/regierungsviertel/city-streets-v249-evidence.json.gz"))).toString());
const source = data as CityStreetSourceV249;
function fixture(key: string): SurroundingCityChunk {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, evidence.packets[key].url))).toString());
}
function finish<T>(iterator: Generator<void, T>): T {
  let r = iterator.next(); while (!r.done) r = iterator.next(); return r.value;
}

describe("citywide source-tagged crossing and curb complements v249", () => {
  test("restored crossing stripes are the actual top visible surface in both families", () => {
    const familyCounts = { drawn: 0, minecraft: 0 };
    const hidden: string[] = [];
    for (const entry of evidence.emitted) {
      const records = entry.records.filter((r: { visibilityProbe?: number[] }) => r.visibilityProbe);
      if (!records.length) continue;
      const [family, id] = entry.packet.split(":") as ["drawn" | "minecraft", string];
      const built = finish(buildSurroundingCityChunk(fixture(entry.packet), id, family === "minecraft"));
      built.root.updateMatrixWorld(true);
      for (const r of records) {
        const [x, z] = r.visibilityProbe;
        const hit = new Raycaster(new Vector3(x, 3.5, z), new Vector3(0,-1,0))
          .intersectObject(built.root, true).find(h => (h.object as { isMesh?: boolean }).isMesh);
        expect(hit).toBeDefined();
        if (Math.abs(hit!.point.y - 3.18) > .00005)
          hidden.push(`${entry.packet} ${r.key} at ${x},${z}: top ${hit!.point.y}`);
        familyCounts[family]++;
      }
      disposeSurroundingCityRoot(built.root);
    }
    expect(familyCounts.drawn).toBeGreaterThan(100);
    expect(familyCounts.minecraft).toBeGreaterThan(100);
    expect(hidden).toEqual([]);
  });
  test("every old packet, line and navigation survives; additions decode in existing bounded batch", () => {
    for (const key of source.ids) {
      const [family, id] = key.split(":"), native = family === "minecraft";
      const before = fixture(key), snapshot = JSON.stringify(before);
      const after = finish(prepareCityStreetsV249(before, id, native));
      expect(after.meshes.length).toBe(before.meshes.length + 1);
      expect(after.meshes.slice(0, -1)).toEqual(before.meshes);
      expect(after.nav).toBe(before.nav); expect(after.lines).toBe(before.lines);
      expect(JSON.stringify(before)).toBe(snapshot);
      expect(finish(prepareCityStreetsV249(after, id, native))).toBe(after);
      const built = finish(buildSurroundingCityChunk(after, id, native));
      expect(built.geometryBytes).toBeLessThan(12 * 1024 * 1024);
      expect(built.root.userData.sourceKinds).toContain("city-streets-v249");
      disposeSurroundingCityRoot(built.root);
    }
  });
  test("unrelated packets avoid packed data; drift and cancellation fail closed", () => {
    const key = source.ids[0], [family, id] = key.split(":"), native = family === "minecraft";
    const before = fixture(key);
    const descriptor = Object.getOwnPropertyDescriptor(source, "packets")!;
    Object.defineProperty(source, "packets", { configurable: true, get() { throw new Error("unexpected decode"); } });
    try { expect(finish(prepareCityStreetsV249(before, "unrelated", native))).toBe(before); }
    finally { Object.defineProperty(source, "packets", descriptor); }
    const changed = structuredClone(before); changed.nav.ground[0].ring[0][0] += .01;
    expect(finish(prepareCityStreetsV249(changed, id, native))).toBe(changed);
    const moved = structuredClone(before); moved.origin[0] += 1;
    expect(finish(prepareCityStreetsV249(moved, id, native))).toBe(moved);
    const iterator = prepareCityStreetsV249(before, id, native), snapshot = JSON.stringify(before);
    expect(iterator.next().done).toBe(false); iterator.return(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
