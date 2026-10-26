import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";
import { losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";
import { LOSSLESS_ZOPFLI_FIELDS_V274 } from "../losslessZopfliFieldsV274";
import { createLosslessZopfliPreparation, type LosslessZopfliField } from "../losslessZopfliV274";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function receipt(sourcePath: string, key: string, json: string): LosslessZopfliField {
  return { sourcePath, key, exactJsonSha256: sha(json), exactJsonBytes: Buffer.byteLength(json) };
}
async function transform(plugin: Plugin, source: string, id: string, command: "build" | "serve" = "build") {
  const configured = plugin.configResolved as Function;
  configured({ command });
  const hook = typeof plugin.transform === "function" ? plugin.transform : plugin.transform!.handler;
  return await hook.call({} as never, source, id) as ReturnType<typeof transformLosslessJsonData>;
}

test("finite receipts reject changed/missing fields and retain the original fallback", async () => {
  const sourcePath = "data/centralTheatresV274.json", json = "[1,2,3]";
  const fields = [receipt(sourcePath, "native", json)];
  const prepare = createLosslessZopfliPreparation(fields, JSON.stringify);
  for (const id of ["/repo/src/app/public/" + sourcePath, "/repo/src/app/src/nested/" + sourcePath,
    "/repo/src/app/src/" + sourcePath + "?raw", "/repo/src/app/src/" + sourcePath + "?url"]) {
    expect(await prepare.prepare("not JSON", id)).toBeUndefined();
  }
  const id = "/repo/src/app/src/" + sourcePath;
  expect(await prepare.prepare('{"native":[1,2,4]}', id)).toBeUndefined();
  expect(await prepare.prepare('{"other":[1,2,3]}', id)).toBeUndefined();
  for (const source of ['{"native":[1,2,4]}', '{"other":[1,2,3]}']) {
    expect(await transform(losslessJsonData(fields), source, id)).toEqual(transformLosslessJsonData(source, id));
  }
  expect(() => createLosslessZopfliPreparation([...fields, ...fields], JSON.stringify)).toThrow("Duplicate");
  // Development retains the old transform even if a build receipt needs renewal.
  const source = '{"drawn":[1,2,4]}';
  expect(await transform(losslessJsonData(fields), source, id, "serve")).toEqual(transformLosslessJsonData(source, id));
});

test("unlisted sources remain byte-identical and zlib9 alone controls admission", async () => {
  const id = "/repo/src/app/src/data/unlisted.json";
  const source = JSON.stringify({ rows: Array.from({ length: 15000 }, (_, i) => [i, i / 7]) });
  expect(await transform(losslessJsonData(), source, id)).toEqual(transformLosslessJsonData(source, id));
  const poorlyCompressible = '[1,2,3]';
  const prepared = new Map([[poorlyCompressible, new Uint8Array(0)]]);
  expect(transformLosslessJsonData('{"rows":[1,2,3]}', id, 4, prepared))
    .toEqual(transformLosslessJsonData('{"rows":[1,2,3]}', id, 4));
  const root = '[1,2,3]';
  expect(transformLosslessJsonData(root, id, 1, new Map([[root, new Uint8Array(0)]])))
    .toEqual(transformLosslessJsonData(root, id, 1));
});

test("real production plugin preserves exact numbers, eager descriptors, weak reconstruction and tree shaking", async () => {
  const directory = await mkdtemp(join(tmpdir(), "isometric-zopfli-v274-"));
  const dataDir = join(directory, "src/app/src/data");
  await mkdir(dataDir, { recursive: true });
  const relative = "data/centralTheatresV274.json";
  const id = join(dataDir, "centralTheatresV274.json");
  // The production exactJson serializer must preserve all these special values.
  const row = '[-0,1e400,-1e400,"Berlin ä 🪁",{"__proto__":{"own":true}}]';
  const json = `[${Array(1300).fill(row).join(",")}]`;
  const source = `{"version":274,"drawn":${json},"native":${json},"other":${json}}`;
  const fields = ["drawn", "native", "other"].map(key => receipt(relative, key, json));
  await writeFile(id, source);
  const compile = async (entry: string, selected = fields) => {
    const entryPath = join(directory, "entry.js");
    await writeFile(entryPath, entry);
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData(selected)],
      build: { write: false, minify: true, rolldownOptions: { input: entryPath } } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    expect(result.output.every(item => item.type === "chunk")).toBeTrue();
    for (const chunk of result.output) if (chunk.type === "chunk") {
      expect(chunk.code).not.toContain("@gfx/zopfli");
      expect(chunk.code).not.toContain("WebAssembly");
    }
    const entryChunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!entryChunk || entryChunk.type !== "chunk") throw new Error("Missing entry");
    return entryChunk.code;
  };
  try {
    const code = await compile(`import data, { drawn } from ${JSON.stringify(id)}; window.fixture = data; window.named = drawn;`);
    let parses = 0;
    const jsonRuntime = { parse(text: string) { parses++; return JSON.parse(text); } };
    class Ref {
      static refs: Ref[] = [];
      constructor(public value: unknown) { Ref.refs.push(this); }
      deref() { return this.value; }
    }
    const window: { fixture?: Record<string, any>; named?: unknown } = {};
    new Function("window", "JSON", "WeakRef", code)(window, jsonRuntime, Ref);
    const data = window.fixture!;
    expect(parses).toBe(1); // The eager drawn field only; no native/other decode.
    expect(Ref.refs.length).toBe(0);
    const descriptor = Object.getOwnPropertyDescriptor(data, "drawn")!;
    expect(descriptor).toEqual({ value: window.named, writable: true, enumerable: true, configurable: true });
    expect(data.drawn).toBe(window.named);
    expect(Object.is(data.drawn[0][0], -0)).toBeTrue();
    expect(data.drawn[0][1]).toBe(Infinity);
    expect(data.drawn[0][2]).toBe(-Infinity);
    expect(Object.hasOwn(data.drawn[0][4], "__proto__")).toBeTrue();
    const firstNative = data.native;
    expect(firstNative).toEqual(JSON.parse(json));
    expect(Ref.refs.length).toBe(1);
    Ref.refs[0].value = undefined;
    expect(data.native).not.toBe(firstNative);
    expect(data.native).toEqual(firstNative);
    const strong = data.other;
    strong[0][0] = 77;
    expect(data.other).toBe(strong);
    expect(data.other[0][0]).toBe(77);
    const oldNamed = window.named;
    data.drawn = ["replacement"];
    expect(window.named).toBe(oldNamed);
    Object.freeze(data);
    expect(() => { data.native = []; }).toThrow(TypeError);
    const fallback: { fixture?: Record<string, any> } = {};
    new Function("window", "JSON", "WeakRef", code)(fallback, JSON, undefined);
    expect(fallback.fixture!.native).toBe(fallback.fixture!.native);
    expect(fallback.fixture).toEqual(JSON.parse(source));
    const entry = `import { version } from ${JSON.stringify(id)}; window.fixture = version;`;
    const metadata = await compile(entry);
    expect(metadata).toBe(await compile(entry, []));
    expect(metadata.length).toBeLessThan(256);
    expect(metadata).not.toContain("JSON.parse");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);

test("an audited real park field uses the unchanged runtime decoder with a smaller exact payload", async () => {
  const relative = "data/northParksV198Native0.json";
  const id = fileURLToPath(new URL("../src/" + relative, import.meta.url));
  const source = await readFile(id, "utf8");
  const fields = LOSSLESS_ZOPFLI_FIELDS_V274.filter(field => field.sourcePath === relative);
  expect(fields.length).toBe(1);
  const original = transformLosslessJsonData(source, id)!;
  const optimized = (await transform(losslessJsonData(fields), source, id))!;
  expect(optimized.code.length).toBeLessThan(original.code.length - 150000);
  const encoded = optimized.code.match(/__decodeLosslessGzip\(("[^"]*")\)/)![1];
  const actual = decodeLosslessGzipJson(JSON.parse(encoded));
  expect(actual).toEqual(JSON.parse(source).cells);
  expect(optimized.code).toContain("new WeakRef(value)");
  // Encoding alone changes. All declaration, descriptor and ownership code matches.
  const withoutPayload = (code: string) => code.replace(/__decodeLosslessGzip\("[^"]*"\)/g, "__decodeLosslessGzip(PAYLOAD)");
  expect(withoutPayload(optimized.code)).toBe(withoutPayload(original.code));
}, 60000);
