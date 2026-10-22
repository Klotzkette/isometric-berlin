import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import { applyOuterMaterialsV263 } from "../src/outerMaterialsV263";
import data from "../src/data/outerMaterialsV263.json";
import previous from "../src/data/outerMaterialsV232.json";
import prior254 from "../src/data/outerMaterialsV254.json";
import { createSurroundingCityChunk, type SurroundingCityChunk, type SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

function finish<T>(it: Generator<void, T>): T {
  let step = it.next(); while (!step.done) step = it.next(); return step.value;
}
function packet(key: string): SurroundingCityChunk {
  const [family, tile] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${family}.json.gz`, import.meta.url))).toString());
}
function interleaved(part: SurroundingPackedMesh, offset = 0): Uint16Array {
  const p = Buffer.from(part.positions, "base64"), c = Buffer.from(part.colors, "base64");
  const v = new Uint16Array(p.length + offset * 6 + 6).fill(31);
  for (let i = 0; i < p.length / 6; i++) for (let a = 0; a < 3; a++) {
    v[(offset + i) * 6 + a] = p.readUInt16LE(i * 6 + a * 2);
    v[(offset + i) * 6 + a + 3] = c[i * 3 + a] * 257;
  }
  return v;
}

test("all legacy city receipts preserve source cells, buffer size and earlier packets", () => {
  let changed = 0;
  for (const [key, receipts] of Object.entries(data.packets)) {
    expect(Object.hasOwn(previous.packets, key)).toBe(false);
    expect(Object.hasOwn(prior254.packets, key)).toBe(false);
    const p = packet(key), snapshot = JSON.stringify(p), [family, tile] = key.split(":");
    for (const receipt of receipts) {
      const part = p.meshes[receipt.mesh], offset = 2, v = interleaved(part, offset), before = v.slice();
      const allowed = new Set<number>(), runs = Buffer.from(receipt.runs, "base64");
      for (let at = 0; at < runs.length; at += 12)
        for (let i = runs.readUInt32LE(at); i < runs.readUInt32LE(at) + runs.readUInt32LE(at + 4); i++) allowed.add(i + offset);
      const count = Buffer.from(part.positions, "base64").length / 6;
      const applied = finish(applyOuterMaterialsV263(tile, family === "minecraft", part, receipt.mesh, v, offset, count));
      expect(applied).toBe(allowed.size);
      changed += applied;
      for (let i = 0; i < v.length; i++)
        if (i % 6 < 3 || !allowed.has(Math.floor(i / 6))) expect(v[i]).toBe(before[i]);
      expect(v.byteLength).toBe(before.byteLength);
      const after = v.slice();
      finish(applyOuterMaterialsV263(tile, family === "minecraft", part, receipt.mesh, v, offset, count));
      expect(v).toEqual(after);
    }
    expect(JSON.stringify(p)).toBe(snapshot);
  }
  expect(changed).toBeGreaterThan(5000);
});

test("changed encoded geometry, wrong family and authored parts fail closed", () => {
  const key = Object.keys(data.packets)[0], p = packet(key), [family, tile] = key.split(":");
  const receipt = Object.values(data.packets)[0][0], part = p.meshes[receipt.mesh];
  const variants = (["positions", "colors", "indices"] as const).map(field => ({
    ...part, [field]: (part[field][0] === "A" ? "B" : "A") + part[field].slice(1),
  }));
  variants.push({ ...part, kind: "outer-facades-v230" });
  for (const modified of variants) {
    const v = interleaved(part), before = v.slice();
    expect(finish(applyOuterMaterialsV263(tile, family === "minecraft", modified, receipt.mesh, v, 0, (v.length - 6) / 6))).toBe(0);
    expect(v).toEqual(before);
  }
  const v = interleaved(part), before = v.slice();
  expect(finish(applyOuterMaterialsV263("missing", false, part, receipt.mesh, v, 0, (v.length - 6) / 6))).toBe(0);
  expect(finish(applyOuterMaterialsV263(tile, family !== "minecraft", part, receipt.mesh, v, 0, (v.length - 6) / 6))).toBe(0);
  expect(v).toEqual(before);
});

test("integrated decoder applies both independent families without source or navigation edits", () => {
  for (const family of ["drawn", "minecraft"]) {
    const key = Object.keys(data.packets).find(key => key.startsWith(`${family}:`))!;
    const p = packet(key), snapshot = JSON.stringify(p), tile = key.split(":")[1];
    const made = createSurroundingCityChunk(p, tile, family === "minecraft");
    try {
      const body = made.root.children.find(child => child instanceof Mesh) as Mesh;
      const positions = body.geometry.getAttribute("position");
      let offset = 0;
      for (const part of p.meshes) {
        const original = Buffer.from(part.positions, "base64");
        for (let at = 0; at < original.length; at += 6) {
          expect(positions.getX(offset)).toBe(original.readUInt16LE(at));
          expect(positions.getY(offset)).toBe(original.readUInt16LE(at + 2));
          expect(positions.getZ(offset++)).toBe(original.readUInt16LE(at + 4));
        }
      }
      expect(made.root.userData.outerMaterialVerticesV263).toBeGreaterThan(0);
      expect(JSON.stringify(p)).toBe(snapshot);
      expect(made.nav).toEqual(p.nav);
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});
