import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import payload from "../src/data/citywestStreetsV235.json";
import { prepareCitywestStreetsV235, type CitywestStreetSourceV235 } from "../src/CitywestStreetsV235";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = path.resolve(import.meta.dir, "../../..");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "geo_data/regierungsviertel/citywest-streets-v235-evidence.json"), "utf8"));
const source = payload as CitywestStreetSourceV235;
function finish(iterator: Generator<void, SurroundingCityChunk>): SurroundingCityChunk {
  let result = iterator.next(); while (!result.done) result = iterator.next(); return result.value;
}
function fixture(key: string): SurroundingCityChunk {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, evidence.packets[key].url))).toString());
}

describe("source-supported Tauentzien paint", () => {
  test("one immutable additive part with identical navigation and cancellable preparation", () => {
    for (const key of source.ids) {
      const [family, id] = key.split(":"), native = family === "minecraft";
      const before = fixture(key), snapshot = JSON.stringify(before);
      const iterator = prepareCitywestStreetsV235(before, id, native);
      expect(iterator.next().done).toBe(false); iterator.return(before);
      expect(JSON.stringify(before)).toBe(snapshot);
      const after = finish(prepareCitywestStreetsV235(before, id, native));
      expect(after.meshes.slice(0,-1)).toEqual(before.meshes);
      expect(after.meshes.length).toBe(before.meshes.length + 1);
      expect(after.meshes.length).toBeLessThanOrEqual(16);
      expect(after.nav).toBe(before.nav); expect(after.lines).toBe(before.lines);
      expect(finish(prepareCitywestStreetsV235(after,id,native))).toBe(after);
    }
  });
  test("unknown packets do not decode the weak payload", () => {
    expect(source.ids).toEqual(Object.keys(source.packets).sort());
    const before = fixture(source.ids[0]), descriptor = Object.getOwnPropertyDescriptor(source,"packets")!;
    Object.defineProperty(source,"packets", { configurable:true, get() { throw new Error("unexpected decode"); } });
    try { expect(finish(prepareCitywestStreetsV235(before,"absent"))).toBe(before); }
    finally { Object.defineProperty(source,"packets",descriptor); }
  });
  test("a changed origin or ground datum safely rejects the sidecar", () => {
    const key = source.ids[0], id = key.split(":")[1], before = fixture(key);
    const moved = structuredClone(before); moved.origin[0] += 1;
    expect(finish(prepareCitywestStreetsV235(moved,id))).toBe(moved);
    const changed = structuredClone(before); changed.nav.groundY += 1;
    expect(finish(prepareCitywestStreetsV235(changed,id))).toBe(changed);
    expect(source.packets[`minecraft:${id}`].mesh.positions).not.toBe(source.packets[key].mesh.positions);
  });
});
