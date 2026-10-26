import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LOSSLESS_PACKED_STRING_FIELDS, transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";

for (const sourceName of ["bayerCampusV277.json", "bayerCampusV277Legacy.json", "lehrterV277.json", "rkiMoabitV277.json"]) test(`${sourceName} packing preserves every mesh byte and retained navigation object`, () => {
  const path = fileURLToPath(new URL(`../src/data/${sourceName}`, import.meta.url));
  const source = readFileSync(path, "utf8");
  const original = JSON.parse(source);
  const result = transformLosslessJsonData(source, path)!;
  expect(result).toBeDefined();
  const code = result.code
    .replace(/^import[^\n]+;\n/, "")
    .replace(/export \{[^\n]+\};/, "")
    .replace("export default", "return");
  let decodes = 0;
  const restored = new Function("__decodeLosslessGzip", code)((value: string) => {
    decodes++;
    return decodeLosslessGzipJson(value);
  });
  expect(restored).toEqual(original);
  const firstDecodeCount = decodes;
  for (const field of LOSSLESS_PACKED_STRING_FIELDS[sourceName]!) {
    const value = restored[field];
    expect(typeof value).toBe("string");
    expect(Buffer.from(value, "base64")).toEqual(Buffer.from(original[field], "base64"));
    expect(restored[field]).toBe(value);
  }
  expect(decodes).toBe(firstDecodeCount);
  expect(result.code).not.toContain("WeakRef");
  for (const [field, value] of Object.entries(restored)) {
    if (value && typeof value === "object") expect(restored[field]).toBe(value);
  }
  expect(result.code.length).toBeLessThan(source.length * 0.75);
});
