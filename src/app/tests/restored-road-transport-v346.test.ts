import { readRoadWordRecord, readRoadWordBatch } from "../src/roadWordPlanesV362";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "vite";
import { compressRestoredRoadSourceV346, losslessRestoredRoadSurfacesV346, packRoadWordPlanes } from "../losslessRestoredRoadSurfacesV346";
import { decodeLosslessBase85, decodeLosslessGzipJson, encodeLosslessBase85 } from "../src/losslessGzipBase85";

const sourcePath = new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url);
const sha = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");

test("all 425 production batches remain byte-exact through independently bounded transport", () => {
  const source = readFileSync(sourcePath, "utf8"), before = sha(source);
  const { text, receipt } = compressRestoredRoadSourceV346(source);
  const original = source.trimEnd().split("\n"), packed = text.trimEnd().split("\n");
  expect(original).toHaveLength(426);
  expect(packed).toHaveLength(original.length);
  expect(JSON.parse(packed[0])).toEqual({ ...JSON.parse(original[0]), encoding: "ndjson-gzip-base85-json" });
  for (let i = 1; i < original.length; i++) {
    expect(gunzipSync(decodeLosslessBase85(packed[i])).toString()).toBe(original[i]);
    expect(decodeLosslessGzipJson(packed[i], 2 * 1024 * 1024)).toEqual(JSON.parse(original[i]));
    expect(packed[i].length).toBeLessThan(2 * 1024 * 1024);
  }
  expect(receipt.sourceSha256).toBe(before);
  expect(receipt.sourceBytes).toBe(30_512_656);
  expect(receipt.savedBytes).toBeGreaterThan(10_000_000);
  expect(receipt.batchCount).toBe(425);
  expect(receipt.maxDecodedBatchChars).toBe(225_327);
  expect(sha(readFileSync(sourcePath, "utf8"))).toBe(before);
}, 30_000);

test("shuffled word planes recover all 425 source records byte for byte", () => {
  const source = readFileSync(sourcePath, "utf8");
  const { text, receipt } = packRoadWordPlanes(source);
  const [, ...lines] = text.trimEnd().split("\n");
  const original = source.trimEnd().split("\n").slice(1);
  expect(lines.length).toBe(425);
  for (const [i, line] of lines.entries()) {
    const row = readRoadWordBatch(readRoadWordRecord(JSON.parse(line), 2 * 1024 * 1024));
    const xz = Buffer.from(row.xz).toString("base64");
    const indices = row.indices && Buffer.from(row.indices).toString("base64");
    expect(JSON.stringify({ ...row, xz, indices })).toBe(original[i]);
  }
  expect(receipt.transportBytes).toBeLessThan(13_000_000);
  expect(receipt.sourceSha256).toBe(sha(source));
}, 30_000);

test("packed roads reject changed geometry and checksum bytes even when the expanded size matches", () => {
  const planes = Buffer.from([3, 7, 9, 12, 19, 23, 35, 48, 52, 68, 77, 85, 97, 105, 109, 126]);
  const compressed = gzipSync(planes, { level: 0 });
  const offset = compressed.indexOf(planes);
  expect(offset).toBeGreaterThan(0);
  const decode = (bytes: Uint8Array) => readRoadWordBatch(readRoadWordRecord(
    ["r", "kerbs", planes.length, 0, encodeLosslessBase85(bytes)], 2 * 1024 * 1024,
  ));
  expect(decode(compressed).xz.byteLength).toBe(planes.length);
  for (const index of [offset + 1, compressed.length - 8]) {
    const corrupt = Buffer.from(compressed);
    corrupt[index] ^= 1;
    expect(() => decode(corrupt)).toThrow("checksum");
  }
});

test("optional decode bound preserves defaults and refuses oversized or forged ISIZE before parsing", () => {
  const json = JSON.stringify({ exact: [-0, 0.123456789012345, "Grün"] });
  const good = encodeLosslessBase85(gzipSync(json));
  expect(decodeLosslessGzipJson(good)).toEqual(JSON.parse(json));
  expect(decodeLosslessGzipJson(good, Buffer.byteLength(json))).toEqual(JSON.parse(json));
  expect(() => decodeLosslessGzipJson(good, Buffer.byteLength(json) - 1)).toThrow("bounded decoded size");
  // Prefix '{}' is valid JSON; the extra sentinel must still detect expansion.
  const trailing = gzipSync("{}" + " ".repeat(3 * 1024 * 1024));
  const forged = Buffer.from(trailing); forged.writeUInt32LE(2, forged.length - 4);
  expect(() => decodeLosslessGzipJson(encodeLosslessBase85(forged), 2 * 1024 * 1024)).toThrow("decoded size");
  const huge = Buffer.from(gzipSync("{}")); huge.writeUInt32LE(0xffffffff, huge.length - 4);
  expect(() => decodeLosslessGzipJson(encodeLosslessBase85(huge), 2 * 1024 * 1024)).toThrow("bounded decoded size");
  const long = Buffer.from(gzipSync("{}")); long.writeUInt32LE(3, long.length - 4);
  expect(() => decodeLosslessGzipJson(encodeLosslessBase85(long), 2 * 1024 * 1024)).toThrow("decoded size");
});

test("build-only plugin intercepts precisely the road URL and emits one compressed asset plus receipt", async () => {
  const plugin = losslessRestoredRoadSurfacesV346(), emitted: { name: string; source: string | Uint8Array }[] = [];
  expect(plugin.apply).toBe("build");
  expect(plugin.enforce).toBe("pre");
  const load = plugin.load as (this: unknown, id: string) => Promise<string | undefined>;
  const context = { emitFile(file: { name: string; source: string | Uint8Array }) { emitted.push(file); return `asset${emitted.length}`; } };
  expect(await load.call(context, "/project/unrelated.ndjson.txt?url")).toBeUndefined();
  expect(await load.call(context, fileURLToPath(sourcePath) + "?url")).toBe('export default "__VITE_ASSET__asset1__";');
  expect(emitted).toHaveLength(2);
  expect(emitted[0].name).toBe("restoredRoadSurfaces-v376.bin");
  const receipt = JSON.parse(String(emitted[1].source));
  expect(receipt.transportBytes).toBe(Buffer.byteLength(emitted[0].source));
  expect(receipt.transportSha256).toBe(sha(emitted[0].source));
}, 30_000);

test("actual IIFE worker executes and fetches its emitted compressed asset at the worker URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "road-worker-v346-"));
  try {
    const entry = join(directory, "entry.ts"), worker = join(directory, "worker.ts");
    await writeFile(entry, 'new Worker(new URL("./worker.ts", import.meta.url));');
    await writeFile(worker, `import url from ${JSON.stringify(fileURLToPath(sourcePath) + "?url")};fetch(url);`);
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "error",
      base: "./", plugins: [losslessRestoredRoadSurfacesV346()],
      worker: { format: "iife", plugins: () => [losslessRestoredRoadSurfacesV346()] },
      build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected production output");
    const output = result.output;
    const asset = output.find(item => item.type === "asset" && item.fileName.includes("restoredRoadSurfaces-v376"));
    const script = output.find(item => item.type === "asset" && /worker.*\.js$/.test(item.fileName));
    expect(asset).toBeDefined(); expect(script).toBeDefined();
    expect(output.filter(item => item.type === "asset" && item.fileName.includes("restoredRoadSurfaces"))).toHaveLength(1);
    if (!asset || !script || script.type !== "asset") throw new Error("Missing worker assets");
    for (const base of ["https://example.test/isometric-berlin/", "https://example.test/"]) {
      const fetched: string[] = [], workerUrl = new URL(script.fileName, base).href;
      runInNewContext(String(script.source), { URL, self: { location: { href: workerUrl } }, fetch: (url: string) => { fetched.push(url); } });
      expect(fetched).toEqual([new URL(asset.fileName, base).href]);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30_000);
