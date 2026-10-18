import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/houseDoorsV233.json";
import { houseDoorNavigationGuardV233, prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
const load = (id: string, native: boolean): SurroundingCityChunk => {
  const desc = manifest.chunks.find((r: { id: string }) => r.id === id);
  return JSON.parse(gunzipSync(readFileSync(new URL(desc[native ? "minecraft" : "drawn"].url, root))).toString());
};
function finish<T>(iterator: Generator<void, T>): T {
  let step = iterator.next(); while (!step.done) step = iterator.next(); return step.value;
}
const decode = (s: string) => Buffer.from(s, "base64");

describe("source-mapped ordinary house doors v233", () => {
  test("every real recipe matches its retained source guard; old source, nav and topology are unchanged", () => {
    let drawn = 0, native = 0;
    for (const [id, entry] of Object.entries(data.chunks)) for (const mc of [false, true]) {
      const before = load(id, mc), plan = mc ? entry.minecraft : entry.drawn;
      const text = JSON.stringify(before);
      expect(houseDoorNavigationGuardV233(before.nav)).toBe(plan.guard);
      const after = finish(prepareHouseDoorsV233(before, id, mc));
      expect(JSON.stringify(before)).toBe(text);
      expect(after.nav).toBe(before.nav); expect(after.origin).toBe(before.origin);
      before.meshes.forEach((part, i) => expect(after.meshes[i]).toBe(part));
      if (!plan.doors.length) { expect(after).toBe(before); continue; }
      const added = after.meshes.at(-1)!;
      expect(added.kind).toBe("house-doors-v233");
      expect(decode(added.positions).length / 6).toBe(plan.doors.length * 48);
      expect(decode(added.indices).length / 4).toBe(plan.doors.length * 72);
      expect(decode(added.colors).length).toBe(plan.doors.length * 48 * 3);
      expect(finish(prepareHouseDoorsV233(after, id, mc))).toBe(after);
      if (mc) native += plan.doors.length; else drawn += plan.doors.length;
    }
    expect(drawn).toBeGreaterThan(2000); expect(native).toBeGreaterThan(1000);
  }, 20000);

  test("native panels follow independently matched orthogonal wall planes", () => {
    for (const [id, entry] of Object.entries(data.chunks)) {
      if (!entry.minecraft.doors.length) continue;
      const after = finish(prepareHouseDoorsV233(load(id, true), id, true));
      const buffer = decode(after.meshes.at(-1)!.positions);
      const p = new Uint16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
      for (let q = 0; q < p.length; q += 12) {
        const xs = [p[q], p[q + 3], p[q + 6], p[q + 9]];
        const zs = [p[q + 2], p[q + 5], p[q + 8], p[q + 11]];
        expect(new Set(xs).size === 1 || new Set(zs).size === 1).toBe(true);
      }
    }
  }, 20000);

  test("unknown IDs, altered source heights and shifted packet origins fail closed", () => {
    const id = Object.keys(data.chunks)[0], packet = load(id, false);
    expect(finish(prepareHouseDoorsV233(packet, "not-a-tile"))).toBe(packet);
    const altered = structuredClone(packet); altered.nav.buildings[0].height += .1;
    expect(finish(prepareHouseDoorsV233(altered, id))).toBe(altered);
    const shifted = { ...packet, origin: [...packet.origin] as [number, number, number] }; shifted.origin[0] += 1;
    expect(finish(prepareHouseDoorsV233(shifted, id))).toBe(shifted);
  });
});
