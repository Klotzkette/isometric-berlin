import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";
import { civicFacilitySourceV350, type CivicCompactSourceV350 } from "../src/CivicFacilitiesV350";
import index from "../src/data/civicFacilitiesV350Index.json";

test("finite compact facility modules preserve every guard, name and generated geometry", () => {
  let originalBytes = 0, compiledBytes = 0;
  for (const { file } of index.sources) {
    const source = readFileSync(new URL("../src/data/" + file, import.meta.url), "utf8");
    const result = transformLosslessJsonData(source, "/repo/src/app/src/data/" + file)!;
    expect(result).toBeDefined();
    let decodes = 0;
    const code = result.code.replace(/^import[^\n]+\n/, "").replace(/export \{[^\n]+\};/, "")
      .replace("export default __source;", "return __source;");
    const actual = new Function("__decodeLosslessGzip", code)((text: string) => {
      decodes++; return decodeLosslessGzipJson(text);
    }) as CivicCompactSourceV350;
    const expected = JSON.parse(source) as CivicCompactSourceV350;
    expect(actual).toEqual(expected);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(expected));
    const a = civicFacilitySourceV350(actual), b = civicFacilitySourceV350(expected);
    for (const key of actual.keys) expect(a.packets[key]).toEqual(b.packets[key]);
    expect(decodes).toBe(1);
    const retained = actual.packets;
    expect(actual.packets).toBe(retained);
    originalBytes += Buffer.byteLength(source); compiledBytes += Buffer.byteLength(result.code);
    expect(transformLosslessJsonData(source, "/repo/src/app/public/" + file)).toBeUndefined();
  }
  expect(index.sources.length).toBe(29);
  expect(compiledBytes).toBeLessThan(originalBytes * .65);
  console.log(JSON.stringify({ compactOriginalBytes: originalBytes, compactCompiledBytes: compiledBytes }));
});
