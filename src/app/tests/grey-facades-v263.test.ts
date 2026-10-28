import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh } from "three";
import data from "../src/data/greyFacadesV263.json";
import streetCurves from "../src/data/streetCurvesV276.json";
import { prepareGreyFacadesV263, type GreyFacadeSourceV263 } from "../src/greyFacadesV263";
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
    const prepared = finish(prepareGreyFacadesV263(original, tile, native));
    expect(prepared).not.toBe(original);
    expect(prepared.nav).toBe(original.nav);
    expect(prepared.meshes.slice(0, original.meshes.length)).toEqual(original.meshes);
    original.meshes.forEach((part, i) => expect(prepared.meshes[i]).toBe(part));
    expect(prepared.meshes.length).toBe(original.meshes.length + 1);
    expect(prepared.meshes.at(-1)!.kind).toBe("grey-facades-v263");
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
    expect(finish(prepareGreyFacadesV263(prepared, tile, native))).toBe(prepared);
    expect(JSON.stringify(original)).toBe(snapshot);
    if (native) nativeWindows += plan.windows.length; else windows += plan.windows.length;
  }
  expect(windows).toBeGreaterThan(1000);
  expect(nativeWindows).toBeGreaterThan(650);
  expect(Object.keys(data.packets).length).toBeLessThanOrEqual(64);
});

test("changed source streams, navigation, origin, missing bindings and over-budget transactions fail closed", () => {
  const key = Object.keys(data.packets)[0], [family, tile] = key.split(":"), native = family === "minecraft";
  const p = packet(key);
  for (const field of ["positions", "colors", "indices"] as const) {
    const changed = structuredClone(p);
    changed.meshes[0][field] = (changed.meshes[0][field][0] === "A" ? "B" : "A") + changed.meshes[0][field].slice(1);
    expect(finish(prepareGreyFacadesV263(changed, tile, native))).toBe(changed);
  }
  const moved = structuredClone(p); moved.origin[0]++;
  expect(finish(prepareGreyFacadesV263(moved, tile, native))).toBe(moved);
  const height = structuredClone(p); height.nav.buildings[0].height++;
  expect(finish(prepareGreyFacadesV263(height, tile, native))).toBe(height);
  const full = { ...p, meshes: Array.from({ length: 16 }, () => p.meshes[0]) };
  expect(finish(prepareGreyFacadesV263(full, tile, native))).toBe(full);
  const added = { ...p, meshes: [...p.meshes, p.meshes[0]] };
  expect(finish(prepareGreyFacadesV263(added, tile, native))).toBe(added);
  const tooManyVertices = { ...p, meshes: [{ ...p.meshes[0], positions: "AAAA".repeat(800_002) }] };
  expect(finish(prepareGreyFacadesV263(tooManyVertices, tile, native))).toBe(tooManyVertices);
  for (const change of ["records", "windows"] as const) {
    const custom = structuredClone(data) as GreyFacadeSourceV263;
    if (change === "records") custom.packets[key].records = [];
    else custom.packets[key].windows = Array.from({ length: 97 }, () => custom.packets[key].windows[0]);
    expect(finish(prepareGreyFacadesV263(p, tile, native, custom))).toBe(p);
  }
  expect(finish(prepareGreyFacadesV263(p, "unrelated-authored-site", native))).toBe(p);
  expect(finish(prepareGreyFacadesV263(p, tile, !native))).toBe(p);
});

test("real east200-22_18 fittings share existing decoder buffers and retain navigation in both modes", () => {
  for (const native of [false, true]) {
    const key = `${native ? "minecraft" : "drawn"}:east200-22_18`, p = packet(key);
    const prepared = finish(prepareGreyFacadesV263(p, "east200-22_18", native));
    const made = createSurroundingCityChunk(prepared, "east200-22_18", native);
    try {
      expect(made.root.children.filter(child => child instanceof Mesh)).toHaveLength(1);
      expect(made.nav).toEqual(p.nav);
      expect(made.bufferCount).toBe(2 + (!native && p.lines?.positions ? 1 : 0));
      const mesh = made.root.children.find(child => child instanceof Mesh) as Mesh;
      expect(mesh.geometry.getAttribute("position").count).toBeGreaterThanOrEqual(prepared.meshes.reduce((count, part) => count + Buffer.from(part.positions, "base64").length / 6, 0));
      expect(mesh.geometry.index!.count).toBeGreaterThanOrEqual(prepared.meshes.reduce((count, part) => count + Buffer.from(part.indices, "base64").length / 4, 0));
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});


test("v262 preparation and every previous mesh remain untouched beside the new transaction", async () => {
  const oldData = (await import("../src/data/outerFacadesV262.json")).default;
  const { prepareOuterFacadesV262 } = await import("../src/outerFacadesV262");
  for (const key of Object.keys(oldData.packets)) {
    const [family, tile] = key.split(":"), native = family === "minecraft";
    const p = packet(key), old = finish(prepareOuterFacadesV262(p, tile, native));
    expect(old).not.toBe(p);
    expect(finish(prepareGreyFacadesV263(old, tile, native))).toBe(old);
  }
  for (const key of Object.keys(data.packets)) {
    const [family, tile] = key.split(":"), native = family === "minecraft";
    const p = packet(key);
    expect(finish(prepareOuterFacadesV262(p, tile, native))).toBe(p);
  }
});

test("every selected real packet keeps its new fittings through the full production preparation chain", () => {
  for (const key of Object.keys(data.packets)) {
    const [family, tile] = key.split(":"), native = family === "minecraft", p = packet(key);
    const snapshot = JSON.stringify(p), made = createSurroundingCityChunk(p, tile, native);
    try {
      expect(made.root.userData.sourceKinds).toContain("grey-facades-v263");
      expect(made.root.children.filter(child => child instanceof Mesh)).toHaveLength(1);
      const curve = native ? undefined : (streetCurves.chunks as Record<string,
        { roads: typeof p.nav.roads }>)[tile];
      if (curve) {
        expect(made.nav.roads).toEqual([...(p.nav.roads ?? []), ...curve.roads!]);
        expect({ ...made.nav, roads: p.nav.roads }).toEqual(p.nav);
      } else expect(made.nav).toEqual(p.nav);
      const body = made.root.children.find(child => child instanceof Mesh) as Mesh;
      expect(body.geometry.getAttribute("position").count).toBeLessThanOrEqual(400_000);
      expect(body.geometry.index!.count).toBeLessThanOrEqual(2_400_000);
      expect(JSON.stringify(p)).toBe(snapshot);
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});

test("measured v254 material colours coexist with the new Heidelberger Straße windows in the real decoder", () => {
  for (const native of [false, true]) {
    const tile = "ring182-9_6", p = packet(`${native ? "minecraft" : "drawn"}:${tile}`);
    const ready = finish(prepareGreyFacadesV263(p, tile, native)), detail = ready.meshes.at(-1)!;
    const offset = p.meshes.reduce((sum, part) => sum + Buffer.from(part.positions, "base64").length / 6, 0);
    const positions = Buffer.from(detail.positions, "base64"), colors = Buffer.from(detail.colors, "base64");
    const made = createSurroundingCityChunk(p, tile, native);
    try {
      expect(made.root.userData.outerMaterialVerticesV254).toBeGreaterThan(0);
      expect(made.root.userData.sourceKinds).toContain("grey-facades-v263");
      const body = made.root.children.find(child => child instanceof Mesh) as Mesh;
      const xyz = body.geometry.getAttribute("position"), rgb = body.geometry.getAttribute("color");
      for (let i = 0; i < positions.length / 6; i++) {
        expect([xyz.getX(offset + i), xyz.getY(offset + i), xyz.getZ(offset + i)])
          .toEqual([positions.readUInt16LE(i * 6), positions.readUInt16LE(i * 6 + 2), positions.readUInt16LE(i * 6 + 4)]);
        expect([rgb.getX(offset + i), rgb.getY(offset + i), rgb.getZ(offset + i)])
          .toEqual([colors[i * 3] / 255, colors[i * 3 + 1] / 255, colors[i * 3 + 2] / 255]);
      }
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});
