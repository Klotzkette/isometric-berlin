import { expect, test } from "bun:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessBase85 } from "../src/losslessGzipBase85";

const SOURCE = "[" + Array(4096).fill("-0").join(",") + "]";
const IDS = [
  "/project/src/app/src/data/altMitteV169Navigation/packet-000.json",
  "/project/src/app/src/data/operaTheatresV274.json",
];
function emittedBytes(code: string): Uint8Array {
  const match = code.match(/__decodeLosslessGzip\(("(?:\\.|[^"\\])*")\)/);
  expect(match).not.toBeNull();
  const encoded = JSON.parse(match![1]) as string;
  return code.includes("losslessGzipBase85")
    ? decodeLosslessBase85(encoded)
    : Buffer.from(encoded, "base64");
}
test("standard gzip has a canonical v181 OS marker and identical compressed data", () => {
  const original = gzipSync(SOURCE, { level: 9 });
  const linux = Buffer.from(original);
  linux[9] = 3;
  for (const id of IDS) {
    const result = transformLosslessJsonData(SOURCE, id, 1)!;
    const bytes = emittedBytes(result.code);
    expect(bytes[9]).toBe(0x13);
    expect(bytes.byteLength).toBe(original.byteLength);
    expect(Array.from(bytes.subarray(0, 9)))
      .toEqual(Array.from(linux.subarray(0, 9)));
    expect(Array.from(bytes.subarray(10)))
      .toEqual(Array.from(linux.subarray(10)));
    expect(gunzipSync(bytes).toString()).toBe(SOURCE);
    expect(Object.is(JSON.parse(gunzipSync(bytes).toString())[0], -0))
      .toBeTrue();
  }
});
test("canonical metadata does not change the existing base64 admission decision", () => {
  const id = "/project/src/app/src/leipzigerPlatzSource.json";
  for (const source of ["[-0]", SOURCE]) {
    const raw = gzipSync(source, { level: 9 });
    const admissionLength = Math.ceil(raw.byteLength / 3) * 4;
    const admitted = admissionLength < source.length * .8;
    const result = transformLosslessJsonData(source, id, 1);
    expect(Boolean(result)).toBe(admitted);
    if (result) {
      const emitted = emittedBytes(result.code);
      expect(Math.ceil(emitted.byteLength / 3) * 4).toBe(admissionLength);
    }
  }
});
test("prepared gzip bytes and their source buffers remain untouched", () => {
  for (const os of [3, 255]) for (const id of IDS) {
    const prepared = gzipSync(SOURCE, { level: 9 });
    prepared[9] = os;
    const before = Uint8Array.from(prepared);
    const result = transformLosslessJsonData(
      SOURCE, id, 1, new Map([[SOURCE, prepared]]),
    )!;
    const emitted = emittedBytes(result.code);
    expect(Array.from(emitted)).toEqual(Array.from(before));
    expect(Array.from(prepared)).toEqual(Array.from(before));
    expect(gunzipSync(emitted).toString()).toBe(SOURCE);
    expect(Object.is(JSON.parse(gunzipSync(emitted).toString())[0], -0))
      .toBeTrue();
  }
});
