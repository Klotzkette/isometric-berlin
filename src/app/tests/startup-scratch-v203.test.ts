import { expect, spyOn, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";
import { releaseScratchBuffer } from "../src/releaseScratchBuffer";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";
import { indexGeometryExactly } from "../src/exactGeometryIndex";

test("owned scratch detaches while independent source and result bytes remain readable", () => {
  const source = new Uint8Array(200_000).fill(27);
  const scratch = source.slice();
  const output = scratch.slice();
  releaseScratchBuffer(scratch.buffer);
  expect(scratch.byteLength).toBe(0);
  expect(output).toEqual(source);
  releaseScratchBuffer(scratch.buffer);
  releaseScratchBuffer(undefined);
});

test("unsupported detachment preserves the ordinary GC fallback", () => {
  const buffer = new ArrayBuffer(100_000);
  Object.defineProperty(buffer, "transfer", { value: () => { throw new Error("unsupported"); } });
  expect(() => releaseScratchBuffer(buffer)).not.toThrow();
  expect(buffer.byteLength).toBe(100_000);
});

test("large lossless JSON and source reconstruction survive scratch retirement", () => {
  const source = Array.from({ length: 40_000 }, (_, i) => [i / 7, "Äöß — Berlin", i % 3]);
  const packed = gzipSync(JSON.stringify(source)).toString("base64");
  const first = decodeLosslessGzipJson(packed);
  expect(first).toEqual(source);
  expect(decodeLosslessGzipJson(packed)).toEqual(first);
  expect(() => decodeLosslessGzipJson(gzipSync("not valid JSON".repeat(20_000)).toString("base64"))).toThrow();
});

test("exact indexing releases large lookup scratch, never original or final geometry arrays", () => {
  const geometry = new BufferGeometry();
  const values = new Float32Array(90_000 * 3);
  for (let v = 0; v < 90_000; v++) values.set([v % 3, (v % 3) ** 2, -0], v * 3);
  geometry.setAttribute("position", new BufferAttribute(values, 3));
  const before = values.slice();
  const transfer = spyOn(ArrayBuffer.prototype, "transfer");
  try {
    const result = indexGeometryExactly(geometry);
    expect(result.changed).toBeTrue();
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(values).toEqual(before);
    const position = geometry.getAttribute("position");
    for (let v = 0; v < 90_000; v++) {
      const i = geometry.index!.getX(v);
      expect(position.getX(i)).toBe(before[v * 3]);
      expect(position.getY(i)).toBe(before[v * 3 + 1]);
      expect(Object.is(position.getZ(i), -0)).toBeTrue();
    }
  } finally { transfer.mockRestore(); geometry.dispose(); }
});

test("early no-saving exit also releases index scratch", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(Array.from({ length: 90_000 }, (_, i) => i), 3));
  const original = geometry.getAttribute("position").array;
  const transfer = spyOn(ArrayBuffer.prototype, "transfer");
  try {
    expect(indexGeometryExactly(geometry).changed).toBeFalse();
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(geometry.getAttribute("position").array).toBe(original);
    expect(original.byteLength).toBe(360_000);
  } finally { transfer.mockRestore(); geometry.dispose(); }
});
