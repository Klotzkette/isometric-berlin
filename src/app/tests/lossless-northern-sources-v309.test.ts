import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { LOSSLESS_BASE85_BEFORE_V309, LOSSLESS_BASE85_SOURCES_V263 } from "../losslessBase85SourcesV263";
import { LOSSLESS_NORTHERN_SOURCES_V309 } from "../losslessNorthernSourcesV309";
import { READONLY_CONSTRUCTION_JSON_FIELDS, transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";

test("the current registry preserves the complete frozen old set and only the finite northern additions", () => {
  expect([...LOSSLESS_BASE85_SOURCES_V263].filter(path => !LOSSLESS_BASE85_BEFORE_V309.has(path)).sort()).toEqual([...LOSSLESS_NORTHERN_SOURCES_V309].sort());
  expect([...LOSSLESS_BASE85_BEFORE_V309].every(path => LOSSLESS_BASE85_SOURCES_V263.has(path))).toBeTrue();
  expect(LOSSLESS_NORTHERN_SOURCES_V309.size).toBe(24);
  expect([...LOSSLESS_NORTHERN_SOURCES_V309].every(path => /^data\/[a-zA-Z0-9]+V30[6789][a-zA-Z0-9]*\.json$/.test(path))).toBeTrue();
});

for (const [name, field] of [["railTerrainContactApproachV309", "meshes"], ["railBridgeUnderdeckApproachV309", "models"], ["railBridgeApproachV307Pavement", "models"], ["railBridgeApproachV307Bodies", "models"], ["railBridgeApproachV307Ground", "meshes"], ["northSitesV306", "sites"], ["railTerrainContactV307", "meshes"], ["coreTerrainContactV307", "meshes"], ["gesundbrunnenRoadBridgesV309", "models"], ["railBridgeUnderdeckV307", "models"], ["railSseArchitectureV307", "models"], ["hospitalArchitectureV308Core", "sites"]]) test(`${name} preserves every construction value with the established weak source lifetime`, () => {
  const path = `data/${name}.json`, text = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), expected = JSON.parse(text);
  expect(READONLY_CONSTRUCTION_JSON_FIELDS[`${name}.json`]).toEqual([field]);
  const transformed = transformLosslessJsonData(text, `/project/src/app/src/${path}`)!;
  expect(transformed.code).toContain("losslessGzipBase85"); expect(transformed.code).toContain("new WeakRef(value)");
  const script = transformed.code.replace(/^import[^\n]*\n/, "").replace(/export \{[^\n]*\};/, "").replace(/const __field\d+ = \/\* @__PURE__ \*\/ __read\d+\(\);/g, "").replace("export default", "return");
  let reads = 0;
  const data = new Function("__decodeLosslessGzip", script)((encoded: string) => { reads++; return decodeLosslessGzipJson(encoded); });
  const eagerReads = name === "coreTerrainContactV307" ? 1 : 0;
  expect(reads).toBe(eagerReads); const variants = data.variants;
  const first = data[field]; expect(first).toEqual(expected[field]); expect(data[field]).toBe(first); expect(reads).toBe(eagerReads + 1);
  if (variants) { expect(data.variants).toBe(variants); expect(data.variants).toEqual(expected.variants); }
  expect(JSON.stringify(data)).toBe(JSON.stringify(expected));
});
