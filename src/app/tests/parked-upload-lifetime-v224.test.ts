import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BufferAttribute, InterleavedBuffer } from "three";
import { WebGLAttributes } from "three/src/renderers/webgl/WebGLAttributes.js";
import { parkStaticAttribute, staticStorageInfo } from "../src/losslessStaticStorage";

type Storage = BufferAttribute | InterleavedBuffer;
const BYTES = 1024 * 1024;
function finish(steps: Generator<void, number>): number {
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}
function digest(values: ArrayBufferView): string {
  return createHash("sha256").update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength)).digest("hex");
}
function source(): Float32Array {
  const words = new Uint32Array(BYTES / 4);
  for (let i = 0; i < words.length; i++) words[i] = 0x3f800000 + i % 31;
  words[0] = 0x80000000; words[1] = 0x7fc00001; words[2] = 0x7fa00011;
  return new Float32Array(words.buffer);
}
function host() {
  const uploaded: ArrayBufferView[] = [], hashes: string[] = [];
  let peakDecodedBytes = 0, failUpload = false;
  const gl = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, FLOAT: 5126, UNSIGNED_INT: 5125,
    createBuffer: () => ({}), deleteBuffer: () => {}, bindBuffer: () => {},
    bufferData: (_target: number, values: ArrayBufferView) => {
      if (failUpload) { failUpload = false; throw new Error("upload interrupted"); }
      hashes.push(digest(values)); uploaded.push(values);
      peakDecodedBytes = Math.max(peakDecodedBytes, uploaded.reduce((sum, view) => sum + view.byteLength, 0));
    },
    bufferSubData: (_target: number, _offset: number, values: ArrayBufferView) => { hashes.push(digest(values)); },
  };
  const backend = WebGLAttributes(gl);
  return { backend, uploaded, hashes, get peakDecodedBytes() { return peakDecodedBytes; },
    failNextUpload() { failUpload = true; },
    upload(storage: Storage) { backend.update(storage, gl.ARRAY_BUFFER); },
  };
}

test("a same-frame restore uploads exact bytes with only one decoded exclusive buffer live", () => {
  const h = host();
  const attributes = Array.from({ length: 12 }, () => {
    const attribute = new BufferAttribute(source(), 1), expected = digest(attribute.array);
    const info = staticStorageInfo(attribute);
    expect(finish(parkStaticAttribute(attribute, true))).toBeGreaterThan(0);
    return { attribute, expected, info };
  });
  for (const { attribute, expected, info } of attributes) {
    h.upload(attribute);
    expect(h.hashes.at(-1)).toBe(expected);
    expect(h.uploaded.at(-1)!.byteLength).toBe(0);
    expect(staticStorageInfo(attribute)).toEqual(info);
    expect(attribute.count).toBe(BYTES / 4);
    expect(attribute.version).toBe(0);
  }
  expect(h.peakDecodedBytes).toBe(BYTES);
  for (const { attribute } of attributes) h.upload(attribute);
  expect(h.hashes).toHaveLength(attributes.length);
});

test("evicted interleaved and index buffers repeatedly restore bit-identical uploads", () => {
  const h = host();
  const fields: Storage[] = [new InterleavedBuffer(source(), 4),
    new BufferAttribute(new Uint32Array(source().buffer), 1)];
  const expected = fields.map(field => digest(field.array));
  for (const field of fields) expect(finish(parkStaticAttribute(field, true))).toBeGreaterThan(0);
  for (let cycle = 0; cycle < 6; cycle++) {
    for (let i = 0; i < fields.length; i++) {
      h.upload(fields[i]);
      expect(h.hashes.at(-1)).toBe(expected[i]);
      expect(h.uploaded.at(-1)!.byteLength).toBe(0);
      h.backend.remove(fields[i]);
    }
  }
  expect(h.peakDecodedBytes).toBe(BYTES);
});

test("CPU reads stay valid for their current job and mutation restores the default upload callback", async () => {
  const h = host(), attribute = new BufferAttribute(source(), 1);
  const originalUpload = attribute.onUploadCallback;
  finish(parkStaticAttribute(attribute, true));
  const read = attribute.array;
  expect(read.byteLength).toBe(BYTES);
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(read.byteLength).toBe(0);
  h.upload(attribute);
  attribute.setX(9, 42); attribute.needsUpdate = true;
  expect(attribute.onUploadCallback).toBe(originalUpload);
  const writable = attribute.array, expected = digest(writable);
  h.upload(attribute);
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(h.hashes.at(-1)).toBe(expected);
  expect(writable.byteLength).toBe(BYTES);
  expect(attribute.getX(9)).toBe(42);
});

test("nonexclusive backing and later authored upload callbacks retain their ownership", async () => {
  const h = host(), shared = new BufferAttribute(source(), 1), borrowed = shared.array;
  const defaultUpload = shared.onUploadCallback;
  finish(parkStaticAttribute(shared)); h.upload(shared);
  expect(shared.onUploadCallback).toBe(defaultUpload);
  expect(borrowed.byteLength).toBe(BYTES);
  const owned = new BufferAttribute(source(), 1);
  finish(parkStaticAttribute(owned, true));
  let calls = 0;
  const authored = () => { calls++; };
  owned.onUpload(authored);
  const replacement = source(); owned.array = replacement;
  expect(owned.onUploadCallback).toBe(authored);
  h.upload(owned);
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(calls).toBe(1);
  expect(replacement.byteLength).toBe(BYTES);
  expect(borrowed.byteLength).toBe(BYTES);
});

test("an interrupted upload preserves decoded bytes until a successful retry", () => {
  const h = host(), attribute = new BufferAttribute(source(), 1);
  const expected = digest(attribute.array);
  finish(parkStaticAttribute(attribute, true));
  const decoded = attribute.array;
  h.failNextUpload();
  expect(() => h.upload(attribute)).toThrow("upload interrupted");
  expect(decoded.byteLength).toBe(BYTES);
  expect(digest(decoded)).toBe(expected);
  h.upload(attribute);
  expect(h.hashes).toEqual([expected]);
  expect(decoded.byteLength).toBe(0);
});
