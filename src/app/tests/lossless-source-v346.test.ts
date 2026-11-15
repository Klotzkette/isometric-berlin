import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { LOSSLESS_BASE85_BEFORE_V346, LOSSLESS_BASE85_SOURCES_V263 } from "../losslessBase85SourcesV263";
import { LOSSLESS_BASE85_SOURCES_V346 } from "../losslessBase85SourcesV346";
import { transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessBase85, decodeLosslessGzipJson } from "../src/losslessGzipBase85";
import receipt from "./fixtures/lossless-source-v346.json";

const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
function script(code: string) {
  return code.replace(/^import[^\n]*\n/, "").replace(/export \{[^\n]*\};/, "")
    // Default-only consumer after unused named exports are removed. Never
    // force a new eager read of a weak construction field during this test.
    .replace(/const __field\d+ = \/\* @__PURE__ \*\/ __read\d+\(\);/g, "")
    .replace("export default", "return");
}

test("V346 adds exactly 106 frozen source paths and retains the complete previous codec set", () => {
  expect(LOSSLESS_BASE85_SOURCES_V346.size).toBe(106);
  expect(hash([...LOSSLESS_BASE85_SOURCES_V346].sort().join("\n"))).toBe("51fe15998f3a6679d5d7ae2108f445b8507bd78e3ff5798f9d4c41a9ae3a27fc");
  expect([...LOSSLESS_BASE85_SOURCES_V263].filter(x => !LOSSLESS_BASE85_BEFORE_V346.has(x)).sort()).toEqual([...LOSSLESS_BASE85_SOURCES_V346].sort());
  expect([...LOSSLESS_BASE85_BEFORE_V346].every(x => LOSSLESS_BASE85_SOURCES_V263.has(x))).toBeTrue();
  expect(receipt.sources.map(x => x.path).sort()).toEqual([...LOSSLESS_BASE85_SOURCES_V346].sort());
});

for (const row of receipt.sources) test(`exact source and full decoded values: ${row.path}`, () => {
  const source = readFileSync(new URL(`../src/${row.path}`, import.meta.url), "utf8");
  expect(Buffer.byteLength(source)).toBe(row.bytes);
  expect(hash(source)).toBe(row.sha256);
  const result = transformLosslessJsonData(source, `/project/src/app/src/${row.path}`)!;
  expect(result).toBeDefined();
  expect(result.code).toContain("losslessGzipBase85.ts");
  const expected = JSON.parse(source);
  const actual = new Function("__decodeLosslessGzip", script(result.code))(decodeLosslessGzipJson);
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  expect(hash(JSON.stringify(actual))).toBe(hash(JSON.stringify(expected)));
  // Every emitted gzip field is decoded, including both mode families.
  for (const match of result.code.matchAll(/__decodeLosslessGzip\("([^"\n]+)"\)/g)) {
    const bytes = decodeLosslessBase85(match[1]);
    const decoded = gunzipSync(bytes).toString("utf8");
    expect(hash(JSON.stringify(decodeLosslessGzipJson(match[1])))).toBe(hash(JSON.stringify(JSON.parse(decoded))));
  }
}, 30_000);

test("per-tile weak reconstruction, mutation transfer and no-WeakRef fallback retain exact contracts", () => {
  const sample = { schemaVersion: 1, keys: ["drawn:a", "minecraft:b"], packets: {
    "drawn:a": { rows: Array(4000).fill([1, 2, 3]), text: "Grün", negativeZero: -0 },
    "minecraft:b": { rows: Array(4000).fill([4, 5, 6]) },
  } };
  const text = JSON.stringify(sample).replace('"negativeZero":0', '"negativeZero":-0');
  const transformed = transformLosslessJsonData(text, "/project/src/app/src/data/mainRoadFrontsV346Packets00.json", 4)!;
  const weak: { value: unknown }[] = [];
  class Ref { constructor(public value: unknown) { weak.push(this); } deref() { return this.value; } }
  let decoded = 0;
  const data = new Function("__decodeLosslessGzip", "WeakRef", script(transformed.code))((s: string) => { decoded++; return decodeLosslessGzipJson(s); }, Ref);
  expect(decoded).toBe(0);
  expect(Object.keys(data.packets)).toEqual(Object.keys(sample.packets));
  const first = data.packets["drawn:a"];
  expect(Object.is(first.negativeZero, -0)).toBeTrue();
  expect(decoded).toBe(1);
  expect(data.packets["drawn:a"]).toBe(first);
  weak[0].value = undefined;
  expect(data.packets["drawn:a"]).toEqual(first);
  expect(decoded).toBe(2);
  const replacement = { explicitlyOwned: true };
  data.packets["drawn:a"] = replacement;
  for (const ref of weak) ref.value = undefined;
  expect(data.packets["drawn:a"]).toBe(replacement);
  expect(decoded).toBe(2);
  const strong = new Function("__decodeLosslessGzip", "WeakRef", script(transformed.code))(decodeLosslessGzipJson, undefined);
  expect(strong.packets["minecraft:b"]).toBe(strong.packets["minecraft:b"]);
  strong.packets["minecraft:b"].rows[0][0] = 23;
  expect(strong.packets["minecraft:b"].rows[0][0]).toBe(23);
  const unlisted = transformLosslessJsonData(JSON.stringify({rows: sample.packets["drawn:a"].rows}), "/project/src/app/src/data/unlistedV346.json", 4)!;
  expect(unlisted.code).toContain("losslessGzipJson.ts");
  expect(unlisted.code).not.toContain("losslessGzipBase85");
});
