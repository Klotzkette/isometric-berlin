import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group } from "three";
import previous from "../src/data/staatsbibliothekV241Previous.json";
import libraries from "../src/data/librariesV202.json";
import { createLibrariesV202 } from "../src/LibrariesV202";
import { transferStaatsbibliothekTrianglesV241, transferStaatsbibliothekLinesV241, staatsbibliothekV241PreviousFilters } from "../src/staatsbibliothekV241Ownership";
import { addStaatsbibliothekV241 } from "../src/StaatsbibliothekV241";
import { createSurroundingCityChunk, type SurroundingCityChunk, type SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

function finish<T>(steps: Generator<void, T>): T {
  let next = steps.next(); while (!next.done) next = steps.next(); return next.value;
}
function fingerprint(parts: string[]): number {
  let h = 2166136261;
  for (const part of parts) for (let i = 0; i < part.length; i++) h = Math.imul(h ^ part.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function indices(part: SurroundingPackedMesh): Uint32Array {
  const b = Buffer.from(part.indices, "base64");
  return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const evidence = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/staatsbibliothek-v241-evidence.json", import.meta.url), "utf8"));
const packets = new Map<string, SurroundingCityChunk>();
for (const path of Object.keys(evidence.inputs)) {
  if (!/packet-\d+\.json$/.test(path) && !path.endsWith("2_0.drawn.json.gz")) continue;
  const bytes = readFileSync(new URL(`../../../${path}`, import.meta.url));
  const packet = JSON.parse((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString());
  packets.set((path.includes("V169Native/") ? "minecraft:" : "drawn:") + ((path.includes("V169Native/") || path.includes("V169Drawn/")) ? `alt-mitte-v169-${packet.id}` : packet.id), packet);
}
function partFor(r: typeof previous.records[number]): SurroundingPackedMesh {
  return packets.get(r.mode + ":" + r.tile)!.meshes.find(p => fingerprint([p.positions, p.colors, p.indices]) === r.fingerprint)!;
}

test("exact library facade transfer is opt-in and preserves every unrelated index", () => {
  for (const r of previous.records) {
    const part = partFor(r), original = indices(part), disabled = original.slice();
    expect(finish(transferStaatsbibliothekTrianglesV241(false, r.tile, r.mode === "minecraft", part, disabled, 0))).toBe(0);
    expect(disabled).toEqual(original);
    const selected = new Set(r.triangles), got = new Uint32Array(original.length + 6).fill(47);
    got.set(original, 6);
    expect(finish(transferStaatsbibliothekTrianglesV241(true, r.tile, r.mode === "minecraft", part, got, 6))).toBe(selected.size);
    expect(got.slice(0, 6)).toEqual(new Uint32Array(6).fill(47));
    for (let i = 0; i < original.length; i += 3) {
      expect(Array.from(got.slice(i + 6, i + 9))).toEqual(selected.has(i / 3)
        ? [original[i], original[i], original[i]] : Array.from(original.slice(i, i + 3)));
    }
  }
});

test("changed encoded geometry, color, mode, kind and identity fail open", () => {
  for (const r of previous.records) {
    const part = partFor(r), original = indices(part);
    const mutate = (key: "positions" | "colors" | "indices") => {
      const b = Buffer.from(part[key], "base64"); b[b.length - 1] ^= 1;
      return { ...part, [key]: b.toString("base64") };
    };
    for (const candidate of [mutate("positions"), mutate("colors"), mutate("indices"), { ...part, kind: "another-owner" }]) {
      const got = original.slice();
      expect(finish(transferStaatsbibliothekTrianglesV241(true, r.tile, r.mode === "minecraft", candidate, got, 0))).toBe(0);
      expect(got).toEqual(original);
    }
    for (const [tile, native] of [[r.tile + "-changed", r.mode === "minecraft"], [r.tile, r.mode !== "minecraft"]] as const) {
      const got = original.slice();
      expect(finish(transferStaatsbibliothekTrianglesV241(true, tile, native, part, got, 0))).toBe(0);
      expect(got).toEqual(original);
    }
  }
});

test("v202 exact row guards preserve other library, courts, and changed row values", () => {
  const enabled = staatsbibliothekV241PreviousFilters(true), disabled = staatsbibliothekV241PreviousFilters(false);
  for (const [key, filter] of [["boxes", "box"], ["blocks", "block"], ["surfaces", "surface"]] as const) {
    const keep = enabled[filter] as (r: unknown, i: number) => boolean;
    const all = disabled[filter] as (r: unknown, i: number) => boolean;
    expect(libraries[key].filter(keep).length).toBe(libraries[key].length - previous[key].length);
    expect(libraries[key].every(all)).toBe(true);
    for (const r of previous[key]) {
      expect(keep(r.row, r.index)).toBe(false);
      const changed = structuredClone(r.row);
      if (Array.isArray(changed)) changed[0] += .001; else changed.color += 1;
      expect(keep(changed, r.index)).toBe(true);
      expect(keep(r.row, -1)).toBe(true);
    }
  }
  for (const native of [false, true]) {
    const legacy = createLibrariesV202(native), current = createLibrariesV202(native, true);
    expect(legacy.userData.additiveOnly).toBe(true);
    expect(current.userData.additiveOnly).toBe(false);
    disposeSurroundingCityRoot(legacy); disposeSurroundingCityRoot(current);
  }
});

test("only obsolete exact roof ink yields, changed packet fails open", () => {
  for (const r of previous.lineRecords) {
    const part = packets.get("drawn:" + r.tile)!.lines!;
    const b = Buffer.from(part.positions, "base64");
    const original = new Uint16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const disabled = original.slice(), got = original.slice();
    expect(finish(transferStaatsbibliothekLinesV241(false, r.tile, part, disabled, 3))).toBe(0);
    expect(disabled).toEqual(original);
    expect(finish(transferStaatsbibliothekLinesV241(true, r.tile, part, got, 3))).toBe(r.segments.length);
    const selected = new Set(r.segments);
    for (let i = 0; i < original.length; i += 6) expect(got.slice(i, i + 6)).toEqual(selected.has(i / 6)
      ? new Uint16Array([...original.slice(i, i + 3), ...original.slice(i, i + 3)]) : original.slice(i, i + 6));
    const safe = original.slice();
    expect(finish(transferStaatsbibliothekLinesV241(true, r.tile, { ...part, colors: "changed" }, safe, 3))).toBe(0);
    expect(safe).toEqual(original);
  }
});

test("actual decoder keeps standalone source and scopes enabled transfer per construction", () => {
  const r = previous.records.find(r => r.mode === "minecraft")!;
  const packet = packets.get(r.mode + ":" + r.tile)!;
  const original = JSON.stringify(packet);
  const legacy = createSurroundingCityChunk(packet, r.tile, true);
  const enabled = createSurroundingCityChunk(packet, r.tile, true, { architectureV241: true });
  expect((enabled.root.userData.siteTransferredTrianglesV209 ?? 0) - (legacy.root.userData.siteTransferredTrianglesV209 ?? 0)).toBe(previous.records.filter(x => x.tile === r.tile && x.mode === "minecraft").reduce((sum, x) => sum + x.triangles.length, 0));
  expect(JSON.stringify(packet)).toBe(original);
  disposeSurroundingCityRoot(legacy.root); disposeSurroundingCityRoot(enabled.root);
});

test("required new model is full in both modes and cancellation publishes no partial root", () => {
  for (const native of [false, true]) {
    const cancelled = new Group(), steps = addStaatsbibliothekV241(cancelled, native);
    expect(steps.next().done).toBe(false);
    steps.return();
    expect(cancelled.children.length).toBe(0);
    const root = new Group(); finish(addStaatsbibliothekV241(root, native));
    expect(root.children.length).toBe(1);
    expect(root.children[0].userData.fullMobileIdentical).toBe(true);
    expect(root.children[0].userData.nativeMinecraft).toBe(native);
    disposeSurroundingCityRoot(root);
  }
});
