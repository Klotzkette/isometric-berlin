import { expect } from "bun:test";
import type { InterleavedBufferAttribute, Mesh } from "three";
import type { SurroundingPackedMesh } from "../../src/SurroundingCityGeometry";

/** Validate one exact recipe at any position in a packed city mesh. The
 * baseline includes byte-identical streets which can follow that insertion. */
export function expectPackedInsertion(before: Mesh, after: Mesh, part: SurroundingPackedMesh) {
  const left = (before.geometry.getAttribute("position") as InterleavedBufferAttribute).data;
  const right = (after.geometry.getAttribute("position") as InterleavedBufferAttribute).data;
  const oldIndices = before.geometry.index!.array;
  const indices = after.geometry.index!.array;
  const positions = Buffer.from(part.positions, "base64");
  const triangles = Buffer.from(part.indices, "base64");
  const vertices = positions.byteLength / 6, faces = triangles.byteLength / 4;
  expect(right.count - left.count).toBe(vertices);
  expect(indices.length - oldIndices.length).toBe(faces);
  expect(left.stride).toBe(right.stride);
  const expected = Array.from({ length: faces }, (_, i) => triangles.readUInt32LE(i * 4));
  for (let start = 0; start + faces <= indices.length; start += 3) {
    const base = indices[start] - expected[0];
    if (base < 0 || base + vertices > right.count) continue;
    if (right.array[base * right.stride] !== positions.readUInt16LE(0)) continue;
    if (!expected.every((v, i) => indices[start + i] === base + v)) continue;
    let match = true;
    for (let i = 0; i < vertices && match; i++) {
      for (let axis = 0; axis < 3; axis++) {
        if (right.array[(base + i) * right.stride + axis] !== positions.readUInt16LE(6 * i + 2 * axis)) match = false;
      }
    }
    if (!match) continue;
    const asBytes = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
    expect(asBytes(right.array.subarray(0, base * right.stride)).equals(
      asBytes(left.array.subarray(0, base * left.stride)),
    )).toBe(true);
    expect(asBytes(right.array.subarray((base + vertices) * right.stride)).equals(
      asBytes(left.array.subarray(base * left.stride)),
    )).toBe(true);
    for (let i = 0; i < oldIndices.length; i++) {
      const at = i < start ? i : i + faces;
      const expectedIndex = oldIndices[i] < base ? oldIndices[i] : oldIndices[i] + vertices;
      if (indices[at] !== expectedIndex) throw new Error(`Previous triangle index changed at ${i}`);
    }
    return { base, start, vertices, faces };
  }
  throw new Error(`Missing complete packed insertion ${part.kind}`);
}
