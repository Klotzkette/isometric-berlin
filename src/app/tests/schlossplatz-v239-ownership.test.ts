import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh, type Group } from "three";
import previous from "../src/data/schlossplatzV239AltMittePrevious.json";
import { transferSchlossplatzLinesV239, transferSchlossplatzTrianglesV239 } from "../src/schlossplatzV239Ownership";
import { buildAltMitteCoreV169Steps, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { createSurroundingCityChunkCooperatively, type SurroundingCityChunk, type SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

function finish<T>(steps: Generator<void, T>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
function fingerprint(parts: string[]): number {
  let hash = 2166136261;
  for (const text of parts) for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
function integers(encoded: string): Uint32Array {
  const bytes = Buffer.from(encoded, "base64");
  return new Uint32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const evidence = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/schlossplatz-v239-alt-mitte-evidence.json", import.meta.url), "utf8"));
const packets = new Map<string, SurroundingCityChunk>();
for (const path of Object.keys(evidence.inputs)) {
  const bytes = readFileSync(new URL(`../../../${path}`, import.meta.url));
  const packet = JSON.parse((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString());
  const native = path.includes("Native/") || path.includes(".minecraft.");
  packets.set(`${native}:${path.includes("/data/altMitte") ? "alt-mitte-v169-" : ""}${packet.id}`, packet);
}
function sourceFor(record: typeof previous.records[number]): SurroundingPackedMesh {
  const packet = packets.get(`${record.mode === "minecraft"}:${record.tile}`)!;
  return packet.meshes.find(part => fingerprint([part.positions, part.colors, part.indices]) === record.fingerprint)!;
}

test("v239 retires all exact audited shell/native/window triangles only with explicit ownership", () => {
  for (const record of previous.records) {
    const part = sourceFor(record);
    const original = integers(part.indices);
    const disabled = original.slice();
    expect(finish(transferSchlossplatzTrianglesV239(false, record.tile, record.mode === "minecraft", part, disabled, 0))).toBe(0);
    expect(disabled).toEqual(original);
    // Exercise an aggregate buffer with another mesh preceding this one.
    const indices = new Uint32Array(original.length + 6).fill(47);
    indices.set(original, 6);
    expect(finish(transferSchlossplatzTrianglesV239(true, record.tile, record.mode === "minecraft", part, indices, 6))).toBe(record.triangles.length);
    expect(indices.slice(0, 6)).toEqual(new Uint32Array(6).fill(47));
    const selected = new Set(record.triangles);
    for (let triangle = 0; triangle < original.length / 3; triangle++) {
      const offset = triangle * 3;
      expect(Array.from(indices.slice(offset + 6, offset + 9))).toEqual(selected.has(triangle)
        ? [original[offset], original[offset], original[offset]] : Array.from(original.slice(offset, offset + 3)));
    }
  }
});

test("changed encoded attributes, mode, tile and kind fail open", () => {
  for (const record of previous.records) {
    const part = sourceFor(record), original = integers(part.indices);
    const changed = (key: "positions" | "colors" | "indices") => {
      const bytes = Buffer.from(part[key], "base64"); bytes[bytes.length - 1] ^= 1;
      return { ...part, [key]: bytes.toString("base64") };
    };
    for (const candidate of [changed("positions"), changed("colors"), changed("indices"), { ...part, kind: "different-owner" }]) {
      const indices = original.slice();
      expect(finish(transferSchlossplatzTrianglesV239(true, record.tile, record.mode === "minecraft", candidate, indices, 0))).toBe(0);
      expect(indices).toEqual(original);
    }
    for (const [tile, native] of [[record.tile + "-different", record.mode === "minecraft"], [record.tile, record.mode !== "minecraft"]] as const) {
      const indices = original.slice();
      expect(finish(transferSchlossplatzTrianglesV239(true, tile, native, part, indices, 0))).toBe(0);
      expect(indices).toEqual(original);
    }
  }
});

test("ink retirement keeps every unrelated endpoint and fails open without ownership or exact bytes", () => {
  for (const record of previous.lineRecords) {
    const lines = packets.get(`false:${record.tile}`)!.lines!;
    const bytes = Buffer.from(lines.positions, "base64");
    const original = new Uint16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const disabled = original.slice();
    expect(finish(transferSchlossplatzLinesV239(false, record.tile, lines, disabled, 3))).toBe(0);
    expect(disabled).toEqual(original);
    const values = original.slice();
    expect(finish(transferSchlossplatzLinesV239(true, record.tile, lines, values, 3))).toBe(record.segments.length);
    const selected = new Set(record.segments);
    for (let segment = 0; segment < original.length / 6; segment++) {
      const i = segment * 6;
      expect(values.slice(i, i + 3)).toEqual(original.slice(i, i + 3));
      expect(values.slice(i + 3, i + 6)).toEqual(original.slice(i + (selected.has(segment) ? 0 : 3), i + (selected.has(segment) ? 3 : 6)));
    }
    bytes[0] ^= 1;
    const unchanged = original.slice();
    expect(finish(transferSchlossplatzLinesV239(true, record.tile, { ...lines, positions: bytes.toString("base64") }, unchanged, 3))).toBe(0);
    expect(unchanged).toEqual(original);
  }
});

function nondegenerate(root: Group): number {
  let count = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh) || !object.geometry.index) return;
    const indices = object.geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) if (indices[i] !== indices[i + 1] && indices[i] !== indices[i + 2]) count++;
  });
  return count;
}

for (const native of [false, true]) test(`v169 ${native ? "native" : "drawn"} default stays complete; opted-in transaction uses receipts`, () => {
  const record = previous.records.find(r => r.tile === "alt-mitte-v169-3_0-piece-0" && r.mode === (native ? "minecraft" : "drawn"))!;
  const packet = packets.get(`${native}:${record.tile}`)!;
  const immutable = JSON.stringify(packet);
  const chunk = { id: "3_0-piece-0", packet };
  const source: AltMitteCoreV169Source = { schemaVersion: 1, sourceParents: previous.parents, drawnChunks: [chunk], minecraftChunks: [chunk] };
  const standalone = finish(buildAltMitteCoreV169Steps(source, native));
  const replaced = finish(buildAltMitteCoreV169Steps(source, native, { schlossplatzV239: true }));
  expect(nondegenerate(standalone) - nondegenerate(replaced)).toBe(record.triangles.length);
  const standaloneAfter = finish(buildAltMitteCoreV169Steps(source, native));
  expect(nondegenerate(standaloneAfter)).toBe(nondegenerate(standalone));
  expect(JSON.stringify(packet)).toBe(immutable);
  disposeSurroundingCityRoot(standalone); disposeSurroundingCityRoot(replaced); disposeSurroundingCityRoot(standaloneAfter);
});

test("streamed facade decoder forwards explicit ownership and disposes cancellation", async () => {
  const record = previous.records.find(r => r.tile === "3_0" && r.layer === "front")!;
  const packet = packets.get(`false:${record.tile}`)!;
  const immutable = JSON.stringify(packet);
  const standalone = await createSurroundingCityChunkCooperatively(packet, record.tile, false);
  const replaced = await createSurroundingCityChunkCooperatively(packet, record.tile, false, {}, { schlossplatzV239: true });
  expect(nondegenerate(standalone.root) - nondegenerate(replaced.root)).toBe(record.triangles.length);
  const standaloneAfter = await createSurroundingCityChunkCooperatively(packet, record.tile, false);
  expect(nondegenerate(standaloneAfter.root)).toBe(nondegenerate(standalone.root));
  expect(JSON.stringify(packet)).toBe(immutable);
  disposeSurroundingCityRoot(standalone.root); disposeSurroundingCityRoot(replaced.root); disposeSurroundingCityRoot(standaloneAfter.root);
  const controller = new AbortController();
  await expect(createSurroundingCityChunkCooperatively(packet, record.tile, false,
    { signal: controller.signal, budgetMs: 0, yield: async () => { controller.abort(); } },
    { schlossplatzV239: true })).rejects.toThrow("Aborted");
});
