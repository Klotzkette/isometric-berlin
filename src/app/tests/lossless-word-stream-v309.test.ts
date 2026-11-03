import { expect, test } from "bun:test";
import { decodeLosslessWordStreamV309, encodeLosslessWordStreamV309 } from "../src/losslessWordStreamV309";
const b64 = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");

test("every UInt32 wrap, negative delta, signed zero and Float32 payload survives exactly", () => {
  const special = [0, 0xffffffff, 0x80000000, 0x7fffffff, 0x3f800000, 0xbf800000, 0x7fc01234, 0xff800000, 0x00000001];
  for (const stride of [1, 3]) {
    const words = Uint32Array.from([...special, ...Array.from({ length: 12000 }, (_, i) => Math.imul(i, 2654435761) >>> 0)]);
    const before = words.slice(), encoded = encodeLosslessWordStreamV309(words, stride), restored = decodeLosslessWordStreamV309(b64(encoded), words.length, stride);
    expect(restored).toEqual(before); expect(words).toEqual(before); expect(encodeLosslessWordStreamV309(restored, stride)).toEqual(encoded);
  }
});

test("truncated, overflowed, noncanonical and trailing bytes fail closed", () => {
  for (const bytes of [[128], [255, 255, 255, 255, 16], [128, 0], [0, 0]]) expect(() => decodeLosslessWordStreamV309(b64(new Uint8Array(bytes)), 1, 1)).toThrow();
  for (const [count, stride] of [[-1, 1], [4_000_001, 1], [3.5, 1], [1, 3], [3, 2]]) expect(() => decodeLosslessWordStreamV309("", count, stride)).toThrow();
  expect(decodeLosslessWordStreamV309("", 0, 3)).toEqual(new Uint32Array());
});

test("survey-like positions and source indices save wire words without changing geometry", () => {
  const coordinates = new Float32Array(30000);
  for (let i = 0; i < coordinates.length / 3; i++) coordinates.set([940 + i % 80 * .25, 33 + i % 11 * .00001, -3210 + Math.floor(i / 80) * .25], i * 3);
  const words = new Uint32Array(coordinates.buffer), packed = encodeLosslessWordStreamV309(words, 3);
  expect(packed.byteLength).toBeLessThan(words.byteLength);
  const restored = decodeLosslessWordStreamV309(b64(packed), words.length, 3);
  expect([...new Uint8Array(restored.buffer)]).toEqual([...new Uint8Array(coordinates.buffer)]);
});

test("axis column byte planes preserve every Float32 and index bit exactly", async () => {
  const { encodeLosslessWordPlanesV309, decodeLosslessWordPlanesV309 } = await import("../src/losslessWordStreamV309");
  for (const stride of [1, 3]) {
    const words = Uint32Array.from(Array.from({ length: 90003 }, (_, i) => i % 7 === 0 ? 0x80000000 : Math.imul(i, 0x9e3779b9) >>> 0));
    const packed = encodeLosslessWordPlanesV309(words, stride);
    expect(decodeLosslessWordPlanesV309(b64(packed), words.length, stride)).toEqual(words);
    expect(encodeLosslessWordPlanesV309(decodeLosslessWordPlanesV309(b64(packed), words.length, stride), stride)).toEqual(packed);
    expect(() => decodeLosslessWordPlanesV309(b64(packed.subarray(1)), words.length, stride)).toThrow();
  }
  expect([...encodeLosslessWordPlanesV309(new Uint32Array([1,3,7]),1)]).toEqual([2,4,8,0,0,0,0,0,0,0,0,0]);
});
