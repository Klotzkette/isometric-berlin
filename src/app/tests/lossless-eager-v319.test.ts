import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { minifySync } from "rolldown/experimental";
import { LOSSLESS_EAGER_FIELDS_V319, LOSSLESS_EAGER_SOURCE_SHA_V319, LOSSLESS_EAGER_FIELD_SHA_V319, exactEagerFieldsV319, assertEagerFieldV319 } from "../losslessEagerFieldsV319";
import { transformLosslessJsonData, losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";

const path = "data/zooHousesV282.json", id = "/project/src/app/src/" + path;
const source = () => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
function evaluate(raw: string, sourceId = id) {
  const transformed = transformLosslessJsonData(raw, sourceId)!;
  const script = transformed.code.replace(/^import[^\n]*\n/, "").replace(/export \{ ([^\n]*) \};/, (_m, aliases: string) =>
    `const named={${aliases.split(", ").filter(Boolean).map(alias => { const [value, key] = alias.split(" as "); return `[${JSON.stringify(key)}]:${value}`; }).join(",")}};`)
    .replace("export default", "const data=");
  let decodes = 0;
  const result = new Function("__decodeLosslessGzip", script + ";return {data,named:typeof named==='undefined'?{}:named};")((s: string) => {
    decodes++; return decodeLosslessGzipJson(s);
  });
  return { ...result, decodes, code: transformed.code };
}

test("only the exact published198 penguin field is compressed, with every source value and ordinary eager identity retained", () => {
  expect(LOSSLESS_EAGER_FIELDS_V319).toEqual({ [path]: ["penguin"] });
  const raw = source(), expected = JSON.parse(raw), output = evaluate(raw);
  expect(sha(raw)).toBe(LOSSLESS_EAGER_SOURCE_SHA_V319);
  expect(sha(JSON.stringify(expected.penguin))).toBe(LOSSLESS_EAGER_FIELD_SHA_V319);
  const oldProof = readFileSync(new URL("./fixtures/source-history-v318.json", import.meta.url));
  expect(sha(oldProof)).toBe("e2ab235b83a3407dbfa46c26ba8b55f4c205c8e1914a4c98390bf451fd2a5d70");
  expect(JSON.parse(oldProof.toString()).currentGraph["src/app/src/" + path]).toBe(LOSSLESS_EAGER_SOURCE_SHA_V319);
  expect(output.data).toEqual(expected);
  expect(JSON.stringify(output.data)).toBe(JSON.stringify(expected));
  expect(Object.getOwnPropertyDescriptors(output.data)).toEqual(Object.getOwnPropertyDescriptors(expected));
  expect(output.decodes).toBe(1);
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["zooHousesV282.json"] ?? []).not.toContain("penguin");
  expect(output.code).not.toContain("WeakRef"); expect(output.code).not.toContain("get [");
  expect(output.named.penguin).toBe(output.data.penguin);
  const held = output.data.penguin; held.identityProbe = { exact: true };
  expect(output.named.penguin.identityProbe).toBe(held.identityProbe);
  output.data.penguin = { replacement: true }; expect(output.named.penguin).toBe(held);
  const saved = minifySync("before.js", "export const value=" + raw + ";", {}).code.length - minifySync("after.js", output.code, {}).code.length;
  expect(saved).toBeGreaterThan(90000);
});

test("a changed source, another field or a public/unknown path never acquires the finite encoding", () => {
  const raw = source();
  expect(() => transformLosslessJsonData(raw + " ", id)).toThrow("Changed exact v319 eager source");
  expect(() => exactEagerFieldsV319(path, raw.replace("schemaVersion", "schemaMutated"))).toThrow("Changed exact v319 eager source");
  expect(() => assertEagerFieldV319(path, "penguin", JSON.stringify(JSON.parse(raw).penguin) + " ")).toThrow("Changed exact v319 eager field");
  expect(() => assertEagerFieldV319(path, "brehm", "{}")).toThrow("Changed exact v319 eager field");
  expect(exactEagerFieldsV319("data/other.json", raw)).toEqual([]);
  expect(transformLosslessJsonData(raw, "/project/src/app/public/" + path)).toBeUndefined();
});

test("the unchanged shared codec still preserves negative zero, underflow, infinities and own proto keys without a source-pin bypass", () => {
  const raw = `[${Array(2000).fill('[-0,1e400,5e-324,{"__proto__":{"own":true}}]').join(",")}]`;
  const output = evaluate(raw, "/project/src/app/src/data/synthetic-number-control-v319.json");
  expect(Object.is(output.data[0][0], -0)).toBeTrue();
  expect(output.data[0][1]).toBe(Infinity); expect(output.data[0][2]).toBe(5e-324);
  expect(Object.hasOwn(output.data[0][3], "__proto__")).toBeTrue();
  expect(output.data).toEqual(JSON.parse(raw)); expect(output.decodes).toBe(1);
  expect(() => transformLosslessJsonData(raw, id)).toThrow("Changed exact v319 eager source");
});

test("per-field tree shaking keeps the decoder and penguin geometry out of metadata-only entry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "isometric-eager-v319-"));
  try {
    const folder = join(directory, "src/app/src/data"); await mkdir(folder, { recursive: true });
    const json = join(folder, "zooHousesV282.json"), entry = join(directory, "entry.js");
    await writeFile(json, source()); await writeFile(entry, `import {schemaVersion} from ${JSON.stringify(json)};window.fixture=schemaVersion;`);
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData([])], build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw Error("Expected fixture output");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw Error("Missing fixture entry");
    expect(chunk.code.length).toBeLessThan(100);
    expect(chunk.code).not.toContain("decodeLossless");
    expect(chunk.code).not.toContain("penguin");
    expect(transformLosslessJsonData(readFileSync(new URL("../src/data/regierungsviertel-landmarks.json", import.meta.url), "utf8"),
      "/project/src/app/src/data/regierungsviertel-landmarks.json")).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
