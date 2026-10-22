import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { build } from "vite";
import { EAGER_RETAINED_SOURCE_NAMES, losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";
import { decodeLosslessGzipJson as decodeBase85GzipJson } from "../src/losslessGzipBase85";
import { prepareOuterRoofsV262, applyOuterRoofsV262Triangles, type OuterRoofsSourceV262 } from "../src/outerRoofsV262";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

test("every finite retained source preserves complete values, eager strong ownership and named aliases", () => {
  let savings = 0;
  for (const name of EAGER_RETAINED_SOURCE_NAMES) {
    const source = readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
    const path = `/project/src/app/src/${name}`, result = transformLosslessJsonData(source, path)!;
    expect(result).toBeDefined();
    expect(result.code).not.toContain("WeakRef");
    expect(result.code).not.toContain("get [");
    let script = result.code.replace(/^import[^\n]*\n/, "");
    script = script.replace(/export \{ ([^\n]*) \};/, (_match, aliases: string) =>
      `const named={${aliases.split(", ").filter(Boolean).map(alias => {
        const [value, key] = alias.split(" as "); return `[${JSON.stringify(key)}]:${value}`;
      }).join(",")}};`);
    script = script.replace("export default", "const data=");
    let decodes = 0;
    const { data, named } = new Function("__decodeLosslessGzip", `${result.code.includes("export {") ? "" : "const named={};"}${script};return {data,named};`)((encoded: string) => {
      decodes++; return (result.code.includes("losslessGzipBase85") ? decodeBase85GzipJson : decodeLosslessGzipJson)(encoded);
    });
    const expected = JSON.parse(source);
    expect(decodes).toBe(1);
    expect(data).toEqual(expected);
    expect(JSON.stringify(data)).toBe(JSON.stringify(expected));
    expect(Object.getOwnPropertyDescriptors(data)).toEqual(Object.getOwnPropertyDescriptors(expected));
    if (Array.isArray(data)) {
      expect(Object.keys(named)).toEqual([]);
      const held = data; data.push({ retained: true }); expect(held.at(-1)).toEqual({ retained: true });
    } else {
      for (const key of Object.keys(named)) expect(named[key]).toBe(data[key]);
      const key = Object.keys(data).find(key => data[key] && typeof data[key] === "object");
      if (key !== undefined) {
        const held = data[key]; held.retainedMutation = { exact: true };
        expect(data[key].retainedMutation).toBe(held.retainedMutation);
        if (Object.hasOwn(named, key)) expect(named[key]).toBe(held);
        data[key] = { replacement: true };
        if (Object.hasOwn(named, key)) expect(named[key]).toBe(held);
        expect(data[key]).toEqual({ replacement: true });
      }
      data.retainedRootMutation = { exact: true };
      expect(data.retainedRootMutation).toEqual({ exact: true });
    }
    expect(decodes).toBe(1);
    savings += source.length - result.code.length;
    for (const id of [`/project/src/app/src/nested/${name}`, `/project/src/app/public/${name}`, `${path}?raw`]) {
      expect(transformLosslessJsonData(source, id)).toBeUndefined();
    }
  }
  expect(EAGER_RETAINED_SOURCE_NAMES.length).toBe(35);
  expect(savings).toBeGreaterThan(1_700_000);
});

class CollectableReference {
  static entries: CollectableReference[] = [];
  private value: object | undefined;
  constructor(value: object) { this.value = value; CollectableReference.entries.push(this); }
  deref() { return this.value; }
  static collect() { for (const ref of this.entries) ref.value = undefined; this.entries = []; }
}
function finish<T>(generator: Generator<void, T>): T {
  let item = generator.next(); while (!item.done) item = generator.next(); return item.value;
}
async function compileFixture(name: string, source: string) {
  const dir = await mkdtemp(join(tmpdir(), "isometric-storage-v263-"));
  try {
    const folder = join(dir, "src/app/src/data"); await mkdir(folder, { recursive: true });
    const path = join(folder, name), entry = join(dir, "entry.js");
    await writeFile(path, source); await writeFile(entry, `import data from ${JSON.stringify(path)};window.fixture=data;`);
    const result = await build({ configFile: false, root: dir, publicDir: false, logLevel: "silent", plugins: [losslessJsonData()],
      build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw Error("Expected fixture output");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw Error("Missing fixture entry"); return chunk.code;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("production roof source survives collection during both real drawn and native prepared transactions", async () => {
  const original = readFileSync(new URL("../src/data/outerRoofsV262.json", import.meta.url), "utf8");
  const expected = JSON.parse(original), code = await compileFixture("outerRoofsV262.json", original);
  const window: { fixture?: OuterRoofsSourceV262 } = {}; let parses = 0;
  new Function("window", "JSON", "WeakRef", code)(window, { parse(value: string) { parses++; return JSON.parse(value); } }, CollectableReference);
  expect(parses).toBe(0);
  const source = window.fixture!, first = source.packets;
  expect(first).toEqual(expected.packets); expect(parses).toBe(1);
  for (const key of Object.keys(first)) {
    const [mode, id] = key.split(":"), receipt = source.packets[key];
    const chunk: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url))).toString());
    const before = JSON.stringify(chunk), generator = prepareOuterRoofsV262(chunk, id, mode === "minecraft", source);
    expect(generator.next().done).toBeFalse(); CollectableReference.collect();
    const prepared = finish(generator);
    expect(prepared.meshes.at(-1)).toBe(receipt.replacement);
    expect(JSON.stringify(chunk)).toBe(before);
    const record = receipt.records[0], bytes = Buffer.from(chunk.meshes[record.mesh].indices, "base64");
    const indices = new Uint32Array(bytes.length / 4);
    for (let i = 0; i < indices.length; i++) indices[i] = bytes.readUInt32LE(i * 4);
    expect(finish(applyOuterRoofsV262Triangles(prepared, record.mesh, indices, 0))).toBe(record.triangles.length);
  }
  const recovered = source.packets; expect(recovered).not.toBe(first); expect(recovered).toEqual(expected.packets);
  const replacement = {}; source.packets = replacement; CollectableReference.collect(); expect(source.packets).toBe(replacement);
  Object.freeze(source); expect(() => { source.packets = first; }).toThrow(TypeError);
  const fallback: { fixture?: OuterRoofsSourceV262 } = {};
  new Function("window", "JSON", "WeakRef", code)(fallback, JSON, undefined);
  const stable = fallback.fixture!.packets; expect(fallback.fixture!.packets).toBe(stable); expect(stable).toEqual(expected.packets);
});

test("production venue strings decode on demand and retain exact typed-buffer bytes", async () => {
  const original = readFileSync(new URL("../src/data/westVenuesV260.json", import.meta.url), "utf8");
  const expected = JSON.parse(original), code = await compileFixture("westVenuesV260.json", original);
  const window: { fixture?: Record<string, unknown> } = {}; let parses = 0;
  new Function("window", "JSON", "WeakRef", code)(window, { parse(value: string) { parses++; return JSON.parse(value); } }, CollectableReference);
  expect(parses).toBe(0); const source = window.fixture!;
  for (const field of ["sourcePositions", "facadeBoxes", "nativeBoxes"]) {
    const before = parses, value = source[field] as string;
    expect(value).toBe(expected[field]); expect(Buffer.from(value, "base64")).toEqual(Buffer.from(expected[field], "base64"));
    CollectableReference.collect(); expect(source[field]).toBe(value); expect(parses).toBe(before + 1);
  }
  expect(JSON.stringify(source)).toBe(JSON.stringify(expected));
  source.nativeBoxes = "retained replacement"; CollectableReference.collect(); expect(source.nativeBoxes).toBe("retained replacement");
  Object.freeze(source); expect(() => { source.nativeBoxes = "forbidden"; }).toThrow(TypeError);
});
