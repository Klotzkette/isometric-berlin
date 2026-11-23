import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import selection from "../scripts/offline-delta-selection.json";
import { compactTile } from "../scripts/compact-offline-tiles";
import { openOfflineGzip } from "../scripts/offline-gzip";
import { restoreSurroundingPacketDelta } from "../src/SurroundingPacketDelta";

test("offline delta round-trips XYZ predictors, wrapped indices and unrelated source fields", async () => {
  const vertices = Buffer.alloc(1200);
  for (let i = 0; i < vertices.length / 2; i++) vertices.writeUInt16LE(100 - i % 31, i * 2);
  const indices = Buffer.alloc(800);
  for (let i = 0; i < indices.length / 4; i++) indices.writeUInt32LE((i - 5) >>> 0, i * 4);
  const mesh = { positions: vertices.toString("base64"), indices: indices.toString("base64"), positionType: "u16cm" };
  const original = Buffer.from(`{"meshes":[${JSON.stringify(mesh)}],"nav":{"groundY":-0}}\n`);
  const result = await compactTile(original);
  expect(result).toBeDefined();
  const raw = gunzipSync(result!.data);
  expect(raw.length).toBe(result!.decodedBytes);
  const packed = JSON.parse(raw.toString());
  expect(packed.meshes[0].positions.startsWith("~")).toBe(true);
  expect(packed.meshes[0].indices.startsWith("~")).toBe(true);
  await restoreSurroundingPacketDelta(packed, original.length - raw.length, new AbortController().signal);
  expect(packed.meshes).toEqual([mesh]);
  expect(Object.is(packed.nav.groundY, -0)).toBe(true);
});

test("a repeated field outside meshes cannot silently produce different geometry", async () => {
  const positions = Buffer.alloc(1200).toString("base64");
  const source = Buffer.from(JSON.stringify({
    meshes: [{ positionType: "u16cm", positions, indices: "" }], lines: { positions },
  }));
  await expect(compactTile(source)).rejects.toThrow();
});

test("optional native build compressor emits standard gzip with identical decoded bytes", () => {
  const encoder = openOfflineGzip();
  if (!encoder) return;
  try {
    const source = Buffer.from("Berlin ".repeat(10_000));
    expect(gunzipSync(encoder.compress(source)).equals(source)).toBe(true);
  } finally {
    encoder.close();
  }
});

test("ordinary gzip selection preserves startup tiles and runtime-pinned wire identities", () => {
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  const manifest = read("../public/mesh/surrounding-berlin-v159/manifest.json");
  expect(createHash("sha256").update(manifest).digest("hex")).toBe(selection.plainGzipManifestSha256);
  const pinned = new Set([
    "../src/data/ubahnGroundApproachesV326Index.json",
    "../src/data/steelRailSpansV369.json",
    "../src/NikolaiFountainV353.ts",
    "../src/NaunynSpaetiV332.ts",
  ].flatMap(file => read(file).match(/[a-f0-9]{64}/g) ?? []));
  const plain = Buffer.from(selection.plainGzipMaskBase64, "base64");
  const delta = Buffer.from(selection.maskBase64, "base64");
  let index = 0;
  let candidates = 0;
  for (const chunk of JSON.parse(manifest).chunks) {
    const [minX, minZ, maxX, maxZ] = chunk.bounds;
    const distance = Math.hypot(Math.max(0, minX, -maxX), Math.max(0, minZ, -maxZ));
    for (const family of ["drawn", "minecraft"]) {
      const bit = 1 << (index % 8);
      if (plain[index >> 3] & bit) {
        expect(delta[index >> 3] & bit).toBe(0);
        expect(distance).toBeGreaterThan(3000);
        expect(pinned.has(chunk[family].sha256)).toBe(false);
        candidates++;
      }
      index++;
    }
  }
  expect(candidates).toBe(2291);
  expect(candidates).toBe(selection.plainGzipCount);
});
