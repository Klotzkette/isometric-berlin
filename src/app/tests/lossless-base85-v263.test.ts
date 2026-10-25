import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { encodeLosslessBase85, decodeLosslessBase85, decodeLosslessGzipJson } from "../src/losslessGzipBase85";
import { LOSSLESS_BASE85_SOURCES_V263 } from "../losslessBase85SourcesV263";
import { transformLosslessJsonData } from "../losslessJsonData";
import { LOSSLESS_EAGER_FIELDS_V270 } from "../losslessEagerFieldsV270";

test("base85 is canonical and byte-exact across word and scratch-buffer boundaries", () => {
  for (const length of [...Array.from({ length: 33 }, (_, i) => i), 65535, 65536, 65537]) {
    const source = Uint8Array.from({ length }, (_, i) => (i * 197 + (i >>> 8)) & 255);
    const encoded = encodeLosslessBase85(source);
    expect(encoded.length).toBe(1 + Math.ceil(length / 4) * 5);
    expect(encoded).not.toMatch(/["\\`\s]/);
    expect(decodeLosslessBase85(encoded)).toEqual(source);
    expect(encodeLosslessBase85(decodeLosslessBase85(encoded))).toBe(encoded);
  }
  for (const malformed of ["", "1", "4", "00000", "400000", "-00000", "0#####", "0aaaaé", '0aaaa"', "0aaaa\\", "0aaaa`", "0aaaa\n",
    "3" + encodeLosslessBase85(new Uint8Array([1, 2, 3, 4])).slice(1)]) {
    expect(() => decodeLosslessBase85(malformed)).toThrow();
  }
});

test("gzip values preserve exact JSON numbers, strings, own properties and ordinary parse errors", () => {
  const source = '{"zero":-0,"max":1.7976931348623157e308,"min":5e-324,"large":1e400,"small":-1e400,"__proto__":{"own":true},"text":"Grün\\n\\\"\\\\"}';
  const parsed = decodeLosslessGzipJson(encodeLosslessBase85(gzipSync(source))) as Record<string, unknown>;
  expect(parsed).toEqual(JSON.parse(source));
  expect(Object.is(parsed.zero, -0)).toBe(true);
  expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
  expect(() => decodeLosslessGzipJson(encodeLosslessBase85(new Uint8Array([1, 2, 3])))).toThrow();
  expect(() => decodeLosslessGzipJson(encodeLosslessBase85(gzipSync("invalid JSON")))).toThrow();
});

function compile(source: string, path: string, threshold = 65536) {
  const result = transformLosslessJsonData(source, `/project/src/app/src/${path}`, threshold)!;
  expect(result).toBeDefined();
  expect(result.code).toContain("losslessGzipBase85");
  const code = result.code.replace(/^import[^\n]*\n/, "").replace(/export \{[^\n]*\};/, "")
    .replace(/const __field\d+ = \/\* @__PURE__ \*\/ __read\d+\(\);/g, "")
    .replace("export default", "return");
  let decodes = 0;
  const data = new Function("__decodeLosslessGzip", code)((encoded: string) => {
    decodes++; return decodeLosslessGzipJson(encoded);
  });
  return { data, result, decodes: () => decodes };
}

test("real strong packed strings and weak roof packets retain their source values and cache contracts", () => {
  for (const path of ["data/westVenuesV260.json", "data/outerRoofsV262.json"]) {
    const text = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
    const expected = JSON.parse(text), { data, result, decodes } = compile(text, path);
    // Only these formerly eager literals acquire an eager source decode.
    const eagerFields = path.includes("westVenues") ? ["ribSegments", "sourceColors", "sourcePartIds"] : [];
    expect(LOSSLESS_EAGER_FIELDS_V270[path] ?? []).toEqual(eagerFields);
    expect(decodes()).toBe(eagerFields.length);
    for (const key of eagerFields) {
      expect(Object.getOwnPropertyDescriptor(data, key)?.value).toBe(data[key]);
      expect(data[key]).toEqual(expected[key]);
    }
    expect(decodes()).toBe(eagerFields.length);
    const field = path.includes("outerRoofs") ? "packets" : "sourcePositions";
    expect(Object.getOwnPropertyDescriptor(data, field)?.get).toBeFunction();
    const before = decodes(), first = data[field];
    expect(decodes()).toBe(before + 1);
    expect(data[field]).toBe(first);
    expect(decodes()).toBe(before + 1);
    expect(JSON.stringify(data)).toBe(JSON.stringify(expected));
    expect(result.code.includes("WeakRef")).toBe(field === "packets");
    data[field] = { explicit: "ownership transfer" };
    expect(data[field]).toEqual({ explicit: "ownership transfer" });
    Object.freeze(data);
    expect(() => { data[field] = null; }).toThrow();
  }
});

test("only the frozen exact source paths select base85; root arrays stay eager and strongly owned", () => {
  expect(LOSSLESS_BASE85_SOURCES_V263.size).toBe(200);
  const text = JSON.stringify(Array.from({ length: 2000 }, () => [1, 2, 3, "exact"]));
  const { data, decodes } = compile(text, "data/westVenuesV260.json", 4);
  expect(decodes()).toBe(1);
  expect(data).toEqual(JSON.parse(text));
  data[0][0] = 42;
  expect(data[0][0]).toBe(42);
  for (const path of ["data/unlisted.json", "data/nested/westVenuesV260.json"]) {
    const result = transformLosslessJsonData(text, `/project/src/app/src/${path}`, 4)!;
    expect(result.code).toContain("losslessGzipJson.ts");
    expect(result.code).not.toContain("losslessGzipBase85");
  }
});
