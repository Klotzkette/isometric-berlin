import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";

test("finite western/station recipes decode per packet with exact weak reconstruction", () => {
  const file = new URL("../src/data/weddingRingWestV345.json", import.meta.url);
  const raw = readFileSync(file, "utf8"), original = JSON.parse(raw);
  const result = transformLosslessJsonData(raw, file.pathname)!;
  expect(result).toBeDefined();
  expect(result.code.length).toBeLessThan(raw.length * .60);
  let code = result.code.replace(/^import[^\n]+\n/, "").replace(/export \{[^}]*\};?\n/g, "").replace("export default", "return");
  class ExpiredWeakRef { deref() { return undefined; } }
  let reads = 0;
  const decoded = new Function("__decodeLosslessGzip", "WeakRef", code)((value: string) => { reads++; return decodeLosslessGzipJson(value); }, ExpiredWeakRef);
  expect(reads).toBe(0);
  expect(decoded.keys).toEqual(original.keys);
  expect(Object.keys(decoded.packets)).toEqual(Object.keys(original.packets));
  for (const key of original.keys) {
    expect(Object.getOwnPropertyDescriptor(decoded.packets, key)?.get).toBeDefined();
    const before = reads, first = decoded.packets[key], again = decoded.packets[key];
    expect(reads - before).toBe(2);
    expect(first).not.toBe(again);
    expect(first).toEqual(original.packets[key]);
    expect(again).toEqual(first);
  }
  console.log({ stationWestRawBytes: raw.length, stationWestEncodedBytes: result.code.length, packetGetters: original.keys.length });
});
