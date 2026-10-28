import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import data from "../src/data/outerFacadesV262.json";
import { prepareOuterFacadesV262, type OuterFacadeSourceV262 } from "../src/outerFacadesV262";
import { prepareAllotmentsV264 } from "../src/AllotmentsV264";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

function finish<T>(it: Generator<void, T>): T {
  let step = it.next(); while (!step.done) step = it.next(); return step.value;
}
function packet(key: string): SurroundingCityChunk {
  const [family, tile] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(
    `../public/mesh/surrounding-berlin-v159/${tile}.${family}.json.gz`, import.meta.url))).toString());
}

test("every small facade recipe retains original parts/navigation, bounded exact geometry and independent native alignment", () => {
  let windows = 0, nativeWindows = 0;
  for (const [key, plan] of Object.entries(data.packets)) {
    const [family, tile] = key.split(":"), native = family === "minecraft";
    const original = packet(key), snapshot = JSON.stringify(original);
    const prepared = finish(prepareOuterFacadesV262(original, tile, native));
    expect(prepared).not.toBe(original);
    expect(prepared.nav).toBe(original.nav);
    expect(prepared.meshes.slice(0, original.meshes.length)).toEqual(original.meshes);
    original.meshes.forEach((part, i) => expect(prepared.meshes[i]).toBe(part));
    expect(prepared.meshes.length).toBe(original.meshes.length + 1);
    const part = prepared.meshes.at(-1)!;
    const positions = new Uint16Array(Uint8Array.from(Buffer.from(part.positions, "base64")).buffer);
    const indices = new Uint32Array(Uint8Array.from(Buffer.from(part.indices, "base64")).buffer);
    const quads = native ? 3 : 5;
    expect(positions.length / 3).toBe(plan.windows.length * quads * 4);
    expect(indices.length).toBe(plan.windows.length * quads * 6);
    expect(plan.windows.length).toBeLessThanOrEqual(native ? 64 : 96);
    for (let at = 0; at < indices.length; at += 6) {
      const first = at / 6 * 4;
      expect(Array.from(indices.slice(at, at + 6))).toEqual([first, first + 1, first + 2, first, first + 2, first + 3]);
      if (native) {
        const xs = new Set([0, 1, 2, 3].map(i => positions[(first + i) * 3]));
        const zs = new Set([0, 1, 2, 3].map(i => positions[(first + i) * 3 + 2]));
        expect(xs.size === 1 || zs.size === 1).toBeTrue();
      }
    }
    expect(finish(prepareOuterFacadesV262(prepared, tile, native))).toBe(prepared);
    expect(JSON.stringify(original)).toBe(snapshot);
    if (native) nativeWindows += plan.windows.length; else windows += plan.windows.length;
  }
  expect(windows).toBeGreaterThan(350);
  expect(nativeWindows).toBeGreaterThan(250);
  expect(Object.keys(data.packets).length).toBeLessThanOrEqual(48);
});

test("changed source streams, navigation, origin, missing bindings and over-budget transactions fail closed", () => {
  const key = Object.keys(data.packets)[0], [family, tile] = key.split(":"), native = family === "minecraft";
  const p = packet(key);
  for (const field of ["positions", "colors", "indices"] as const) {
    const changed = structuredClone(p);
    changed.meshes[0][field] = (changed.meshes[0][field][0] === "A" ? "B" : "A") + changed.meshes[0][field].slice(1);
    expect(finish(prepareOuterFacadesV262(changed, tile, native))).toBe(changed);
  }
  const moved = structuredClone(p); moved.origin[0]++;
  expect(finish(prepareOuterFacadesV262(moved, tile, native))).toBe(moved);
  const height = structuredClone(p); height.nav.buildings[0].height++;
  expect(finish(prepareOuterFacadesV262(height, tile, native))).toBe(height);
  const full = { ...p, meshes: Array.from({ length: 16 }, () => p.meshes[0]) };
  expect(finish(prepareOuterFacadesV262(full, tile, native))).toBe(full);
  const added = { ...p, meshes: [...p.meshes, p.meshes[0]] };
  expect(finish(prepareOuterFacadesV262(added, tile, native))).toBe(added);
  const tooManyVertices = { ...p, meshes: [{ ...p.meshes[0], positions: "AAAA".repeat(800_002) }] };
  expect(finish(prepareOuterFacadesV262(tooManyVertices, tile, native))).toBe(tooManyVertices);
  for (const change of ["records", "windows"] as const) {
    const custom = structuredClone(data) as OuterFacadeSourceV262;
    if (change === "records") custom.packets[key].records = [];
    else custom.packets[key].windows = Array.from({ length: 97 }, () => custom.packets[key].windows[0]);
    expect(finish(prepareOuterFacadesV262(p, tile, native, custom))).toBe(p);
  }
  expect(finish(prepareOuterFacadesV262(p, "unrelated-authored-site", native))).toBe(p);
  expect(finish(prepareOuterFacadesV262(p, tile, !native))).toBe(p);
});

test("real outer187-27_6 fittings share existing decoder buffers and retain navigation in both modes", () => {
  for (const native of [false, true]) {
    const key = `${native ? "minecraft" : "drawn"}:outer187-27_6`, p = packet(key);
    // This source tile also contains receipted v264 allotments; preserve the
    // production order while checking the same decoder/buffer contract.
    const prepared = finish(prepareOuterFacadesV262(
      finish(prepareAllotmentsV264(p, "outer187-27_6", native)), "outer187-27_6", native));
    const made = createSurroundingCityChunk(prepared, "outer187-27_6", native);
    try {
      expect(made.root.children.filter(child => child instanceof Mesh)).toHaveLength(1);
      expect(made.nav).toEqual(p.nav);
      expect(made.bufferCount).toBe(2 + (!native && p.lines?.positions ? 1 : 0));
      const mesh = made.root.children.find(child => child instanceof Mesh) as Mesh;
      expect(mesh.geometry.getAttribute("position").count).toBe(prepared.meshes.reduce((count, part) => count + Buffer.from(part.positions, "base64").length / 6, 0));
      expect(mesh.geometry.index!.count).toBe(prepared.meshes.reduce((count, part) => count + Buffer.from(part.indices, "base64").length / 4, 0));
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});
