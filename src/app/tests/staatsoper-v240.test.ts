import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group } from "three";
import previous from "../src/data/staatsoperV240Previous.json";
import civic from "../src/data/cityRecognitionV182.json";
import { transferStaatsoperTrianglesV240, staatsoperV240PreviousFilters } from "../src/staatsoperV240Ownership";
import { addStaatsoperV240 } from "../src/StaatsoperV240";
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
const evidence = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/staatsoper-v240-evidence.json", import.meta.url), "utf8"));
const packets = new Map<string, SurroundingCityChunk>();
for (const path of Object.keys(evidence.inputs)) {
  if (!path.endsWith("packet-080.json") && !path.endsWith("3_0.drawn.json.gz")) continue;
  const bytes = readFileSync(new URL(`../../../${path}`, import.meta.url));
  const packet = JSON.parse((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString());
  packets.set(path.includes("Native/") ? `alt-mitte-v169-${packet.id}` : packet.id, packet);
}
function partFor(r: typeof previous.records[number]): SurroundingPackedMesh {
  return packets.get(r.tile)!.meshes.find(p => fingerprint([p.positions, p.colors, p.indices]) === r.fingerprint)!;
}

test("exact opera facade transfer is opt-in and preserves every unrelated index", () => {
  for (const r of previous.records) {
    const part = partFor(r), original = indices(part), disabled = original.slice();
    expect(finish(transferStaatsoperTrianglesV240(false, r.tile, r.mode === "minecraft", part, disabled, 0))).toBe(0);
    expect(disabled).toEqual(original);
    const selected = new Set(r.triangles), got = new Uint32Array(original.length + 6).fill(47);
    got.set(original, 6);
    expect(finish(transferStaatsoperTrianglesV240(true, r.tile, r.mode === "minecraft", part, got, 6))).toBe(selected.size);
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
      expect(finish(transferStaatsoperTrianglesV240(true, r.tile, r.mode === "minecraft", candidate, got, 0))).toBe(0);
      expect(got).toEqual(original);
    }
    for (const [tile, native] of [[r.tile + "-changed", r.mode === "minecraft"], [r.tile, r.mode !== "minecraft"]] as const) {
      const got = original.slice();
      expect(finish(transferStaatsoperTrianglesV240(true, tile, native, part, got, 0))).toBe(0);
      expect(got).toEqual(original);
    }
  }
});

test("v182 original row guards preserve all 282 measured opera edges and every other owner", () => {
  const enabled = staatsoperV240PreviousFilters(true), disabled = staatsoperV240PreviousFilters(false);
  expect(civic.boxes.filter(enabled.box).length).toBe(civic.boxes.length - 220);
  expect(civic.segments.filter(enabled.segment).length).toBe(civic.segments.length - 440);
  expect(civic.boxes.every(disabled.box)).toBe(true);
  expect(civic.segments.every(disabled.segment)).toBe(true);
  expect(civic.segments.slice(7204, 7926).filter((r, i) => enabled.segment(r, i + 7204)).length).toBe(282);
  for (const [kind, records] of [["box", previous.boxes], ["segment", previous.segments]] as const) {
    for (const record of records) {
      expect(enabled[kind](record.row, record.index)).toBe(false);
      const changed = record.row.slice(); changed[0] += 0.001;
      expect(enabled[kind](changed, record.index)).toBe(true);
      expect(enabled[kind](record.row, -1)).toBe(true);
    }
  }
});

test("actual decoder keeps standalone source and scopes enabled transfer per construction", () => {
  const r = previous.records.find(r => r.mode === "minecraft")!;
  const packet = packets.get(r.tile)!;
  const original = JSON.stringify(packet);
  const legacy = createSurroundingCityChunk(packet, r.tile, true);
  const enabled = createSurroundingCityChunk(packet, r.tile, true, { staatsoperV240: true });
  expect((enabled.root.userData.siteTransferredTrianglesV209 ?? 0) - (legacy.root.userData.siteTransferredTrianglesV209 ?? 0)).toBe(2789);
  expect(JSON.stringify(packet)).toBe(original);
  disposeSurroundingCityRoot(legacy.root); disposeSurroundingCityRoot(enabled.root);
});

test("required new model is full in both modes and cancellation publishes no partial root", () => {
  for (const native of [false, true]) {
    const cancelled = new Group(), steps = addStaatsoperV240(cancelled, native);
    expect(steps.next().done).toBe(false);
    steps.return();
    expect(cancelled.children.length).toBe(0);
    const root = new Group(); finish(addStaatsoperV240(root, native));
    expect(root.children.length).toBe(1);
    expect(root.children[0].userData.fullMobileIdentical).toBe(true);
    expect(root.children[0].userData.nativeMinecraft).toBe(native);
    disposeSurroundingCityRoot(root);
  }
});
