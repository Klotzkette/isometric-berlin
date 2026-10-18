import { expect, test } from "bun:test";
import { prepareRoofHouseV233 } from "../src/roofHouseV233";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareHouseCurbsV233 } from "../src/houseCurbsV233";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyOuterMaterialsV232 } from "../src/outerMaterialsV232";
import data from "../src/data/outerMaterialsV232.json";
import { createSurroundingCityChunk, type SurroundingCityChunk, type SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { Mesh } from "three";

function finish(g: Generator<void, number>): number {
  let value = g.next();
  while (!value.done) value = g.next();
  return value.value;
}
function interleaved(part: SurroundingPackedMesh): Uint16Array {
  const p = Buffer.from(part.positions, "base64"), c = Buffer.from(part.colors, "base64");
  const v = new Uint16Array(p.length);
  for (let i = 0; i < p.length / 6; i++) for (let a = 0; a < 3; a++) {
    v[i * 6 + a] = p.readUInt16LE(i * 6 + a * 2);
    v[i * 6 + a + 3] = c[i * 3 + a] * 257;
  }
  return v;
}
function packet(key: string): SurroundingCityChunk {
  const [family, tile] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${family}.json.gz`, import.meta.url))).toString());
}

test("all outer receipts change only exact existing colour cells, with independent native owners", () => {
  let drawn = 0, native = 0;
  for (const [key, receipts] of Object.entries(data.packets)) {
    const p = packet(key), snapshot = JSON.stringify(p), [family, tile] = key.split(":");
    for (const receipt of receipts) {
      const part = p.meshes[receipt.mesh], v = interleaved(part), before = v.slice();
      const allowed = new Set<number>(), runs = Buffer.from(receipt.runs, "base64");
      for (let at = 0; at < runs.length; at += 12)
        for (let i = runs.readUInt32LE(at); i < runs.readUInt32LE(at) + runs.readUInt32LE(at + 4); i++) allowed.add(i);
      const changed = finish(applyOuterMaterialsV232(tile, family === "minecraft", part, receipt.mesh, v, 0, v.length / 6));
      expect(changed).toBe(allowed.size);
      for (let i = 0; i < v.length; i++) if (i % 6 < 3 || !allowed.has(Math.floor(i / 6))) expect(v[i]).toBe(before[i]);
      expect(v.byteLength).toBe(before.byteLength);
      const after = v.slice();
      finish(applyOuterMaterialsV232(tile, family === "minecraft", part, receipt.mesh, v, 0, v.length / 6));
      expect(v).toEqual(after);
      if (family === "minecraft") native += changed; else drawn += changed;
    }
    expect(JSON.stringify(p)).toBe(snapshot);
  }
  expect(drawn).toBe(1174); expect(native).toBe(2844);
});

test("changed source streams, wrong packets and authored mesh kinds retain their colours", () => {
  const key = Object.keys(data.packets)[0], p = packet(key), [family, tile] = key.split(":");
  const receipt = Object.values(data.packets)[0][0], part = p.meshes[receipt.mesh];
  for (const change of ["positions", "colors", "indices"] as const) {
    const v = interleaved(part), before = v.slice();
    const replacement = part[change][0] === "A" ? "B" : "A";
    const changed = { ...part, [change]: replacement + part[change].slice(1) };
    expect(finish(applyOuterMaterialsV232(tile, family === "minecraft", changed, receipt.mesh, v, 0, v.length / 6))).toBe(0);
    expect(v).toEqual(before);
  }
  for (const [name, kind] of [["unknown", "city"], [tile, "authored-facade"], [tile, "outer-facades-v230"]]) {
    const v = interleaved(part), before = v.slice();
    expect(finish(applyOuterMaterialsV232(name, family === "minecraft", { ...part, kind }, receipt.mesh, v, 0, v.length / 6))).toBe(0);
    expect(v).toEqual(before);
  }
});

test("integrated bounded decoder retains complete geometry and navigation in either family", () => {
  for (const family of ["drawn", "minecraft"]) {
    const key = Object.keys(data.packets).find(key => key.startsWith(family + ":"))!;
    const p = packet(key), snapshot = JSON.stringify(p), tile = key.split(":")[1];
    const finish = <T,>(it: Generator<void, T>): T => {
      let step = it.next(); while (!step.done) step = it.next(); return step.value;
    };
    const native = family === "minecraft";
    const prepared = finish(prepareHouseCurbsV233(finish(prepareHouseDoorsV233(
      finish(prepareRoofHouseV233(p, tile, native)), tile, native)), tile, native));
    const made = createSurroundingCityChunk(p, tile, family === "minecraft");
    try {
      const body = made.root.children.find(child => child instanceof Mesh) as Mesh;
      const positions = body.geometry.getAttribute("position");
      let offset = 0;
      for (const part of prepared.meshes) {
        const original = Buffer.from(part.positions, "base64");
        for (let at = 0; at < original.length; at += 6) {
          expect(positions.getX(offset)).toBe(original.readUInt16LE(at));
          expect(positions.getY(offset)).toBe(original.readUInt16LE(at + 2));
          expect(positions.getZ(offset++)).toBe(original.readUInt16LE(at + 4));
        }
      }
      expect(positions.count).toBe(offset);
      expect(body.geometry.index!.count).toBe(prepared.meshes.reduce((n, part) => n + Buffer.from(part.indices, "base64").byteLength / 4, 0));
      expect(made.root.userData.outerMaterialVerticesV232).toBeGreaterThan(0);
      expect(JSON.stringify(p)).toBe(snapshot);
      expect(made.nav).toEqual(p.nav);
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});
