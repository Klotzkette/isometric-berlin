import { expect } from "bun:test";
import { BufferAttribute, BufferGeometry } from "three";

const bytes = (array: ArrayBufferView) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const allocateLike = (array: ArrayLike<number>, count: number): any =>
  new (array.constructor as { new(length: number): any })(count);

/** Replace one independently reproduced merged contribution, retaining every
 * unrelated attribute byte. Insertions use the next retained contribution as
 * their exact ordering anchor. The caller owns/restores/disposes the result. */
export function spliceGeometryContribution(
  live: BufferGeometry, needle: BufferGeometry, replacement: BufferGeometry,
  mode: "replace" | "insert-before" = "replace",
): BufferGeometry {
  const names = Object.keys(live.attributes);
  expect(Object.keys(needle.attributes)).toEqual(names);
  expect(Object.keys(replacement.attributes)).toEqual(names);
  const total = live.getAttribute("position").count, count = needle.getAttribute("position").count;
  expect(count).toBeGreaterThan(0);
  for (const name of names) for (const part of [needle, replacement]) {
    const a = live.getAttribute(name), b = part.getAttribute(name);
    expect(a).toBeInstanceOf(BufferAttribute); expect(b).toBeInstanceOf(BufferAttribute);
    expect(b.itemSize).toBe(a.itemSize); expect(b.normalized).toBe(a.normalized);
    expect(b.array.constructor).toBe(a.array.constructor);
    expect(b.count).toBe(part.getAttribute("position").count);
  }
  const p = live.getAttribute("position"), q = needle.getAttribute("position");
  const positionBytes = bytes(p.array), needlePositionBytes = bytes(q.array);
  const vertexBytes = p.itemSize * p.array.BYTES_PER_ELEMENT;
  const matches: number[] = [];
  for (let vertex = 0; vertex <= total - count; vertex++) {
    const offset = vertex * vertexBytes;
    if (!positionBytes.subarray(offset, offset + vertexBytes).equals(needlePositionBytes.subarray(0, vertexBytes))) continue;
    if (names.every(name => {
      const a = live.getAttribute(name), b = needle.getAttribute(name);
      const at = vertex * a.itemSize * a.array.BYTES_PER_ELEMENT;
      return bytes(a.array).subarray(at, at + b.array.byteLength).equals(bytes(b.array));
    })) matches.push(vertex);
  }
  expect(matches).toHaveLength(1);
  const start = matches[0], removed = mode === "replace" ? count : 0;
  const added = replacement.getAttribute("position").count, delta = added - removed;
  const result = new BufferGeometry();
  result.name = live.name;
  result.groups = live.groups.map(group => ({ ...group }));
  expect(result.groups).toHaveLength(0); // These merged monument batches have no material groups.
  result.drawRange = { ...live.drawRange };
  for (const name of names) {
    const a = live.getAttribute(name) as BufferAttribute, b = replacement.getAttribute(name) as BufferAttribute;
    const at = start * a.itemSize, end = (start + removed) * a.itemSize;
    const output = allocateLike(a.array, (total + delta) * a.itemSize);
    output.set(a.array.subarray(0, at)); output.set(b.array, at);
    output.set(a.array.subarray(end), at + b.array.length);
    const attribute = new BufferAttribute(output, a.itemSize, a.normalized);
    attribute.name = a.name; attribute.setUsage(a.usage);
    result.setAttribute(name, attribute);
  }
  expect(!!needle.index).toBe(!!live.index);
  expect(!!replacement.index).toBe(!!live.index);
  if (live.index && needle.index && replacement.index) {
    const old = live.index.array, part = needle.index.array, insert = replacement.index.array;
    const indexStart = old.findIndex(index => index >= start);
    expect(indexStart).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < part.length; i++) expect(old[indexStart + i]).toBe(part[i] + start);
    for (let i = 0; i < indexStart; i++) if (old[i] >= start) throw new Error("Earlier contribution overlaps its replay span");
    for (let i = indexStart + part.length; i < old.length; i++)
      if (old[i] < start + count) throw new Error("Later contribution overlaps its replay span");
    const removedIndices = mode === "replace" ? part.length : 0;
    const output = allocateLike(old, old.length - removedIndices + insert.length);
    output.set(old.subarray(0, indexStart));
    for (let i = 0; i < insert.length; i++) output[indexStart + i] = insert[i] + start;
    for (let i = indexStart + removedIndices; i < old.length; i++) {
      const value = old[i] + delta;
      output[i - removedIndices + insert.length] = value;
      if (output[i - removedIndices + insert.length] !== value) throw new Error("Replay exceeds the original index width");
    }
    result.setIndex(new BufferAttribute(output, 1));
  }
  return result;
}
