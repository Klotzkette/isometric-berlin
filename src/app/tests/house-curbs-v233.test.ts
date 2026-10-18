import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import payload from "../src/data/houseCurbsV233.json";
import { houseCurbGroundGuardV233, prepareHouseCurbsV233, type HouseCurbSourceV233 } from "../src/houseCurbsV233";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = path.resolve(import.meta.dir, "../../..");
const evidence = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "geo_data/regierungsviertel/house-curbs-v233-evidence.json.gz"))).toString());
const source = payload as HouseCurbSourceV233;
function finish(iterator: Generator<void, SurroundingCityChunk>): SurroundingCityChunk {
  let result = iterator.next(); while (!result.done) result = iterator.next(); return result.value;
}
function fixture(key: string): SurroundingCityChunk {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, evidence.packets[key].url))).toString());
}

describe("bounded source curb packet additions", () => {
  test("unrelated packets never decode the weak packed-data field", () => {
    expect(source.ids).toEqual(Object.keys(source.packets).sort());
    const before = fixture(source.ids[0]);
    const descriptor = Object.getOwnPropertyDescriptor(source,"packets")!;
    Object.defineProperty(source,"packets", { configurable: true, get() { throw new Error("unexpected packed-data decode"); } });
    try { expect(finish(prepareHouseCurbsV233(before,"absent"))).toBe(before); }
    finally { Object.defineProperty(source,"packets",descriptor); }
  });
  test("every retained source packet gets exactly one additive part and unchanged navigation", () => {
    for (const key of Object.keys(source.packets)) {
      const [family,id] = key.split(":"), native = family === "minecraft";
      const before = fixture(key), snapshot = JSON.stringify(before);
      expect(houseCurbGroundGuardV233(before.nav.ground)).toBe(source.packets[key].guard);
      const after = finish(prepareHouseCurbsV233(before,id,native));
      expect(after.meshes.length).toBe(before.meshes.length + 1);
      expect(after.meshes.length).toBeLessThanOrEqual(16);
      expect(after.meshes.slice(0,-1)).toEqual(before.meshes);
      expect(after.nav).toBe(before.nav); expect(after.lines).toBe(before.lines);
      expect(JSON.stringify(before)).toBe(snapshot);
      expect(finish(prepareHouseCurbsV233(after,id,native))).toBe(after);
    }
  });
  test("wrong ground, origin or unknown ownership is a safe no-op", () => {
    const key = Object.keys(source.packets)[0], [family,id] = key.split(":"), native = family === "minecraft";
    const before = fixture(key);
    expect(finish(prepareHouseCurbsV233(before,"absent",native))).toBe(before);
    const moved = { ...before, origin: [before.origin[0]+1, before.origin[1],before.origin[2]] as [number,number,number] };
    expect(finish(prepareHouseCurbsV233(moved,id,native))).toBe(moved);
    const changed = structuredClone(before); changed.nav.ground[0].ring[0][0] += .01;
    expect(finish(prepareHouseCurbsV233(changed,id,native))).toBe(changed);
  });
  test("family data remains separate and cancellation does not mutate input", () => {
    const key = Object.keys(source.packets).find(k=>k.startsWith("drawn:"))!, id = key.split(":")[1];
    const before = fixture(key), iterator = prepareHouseCurbsV233(before,id);
    const snapshot = JSON.stringify(before); expect(iterator.next().done).toBe(false); iterator.return(before);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(source.packets[key].mesh.kind).toBe("house-curbs-v233");
    const native=source.packets[`minecraft:${id}`];
    if(native) expect(native.mesh.positions).not.toBe(source.packets[key].mesh.positions);
  });
});
