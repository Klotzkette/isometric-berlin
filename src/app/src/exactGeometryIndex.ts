import { BufferAttribute, BufferGeometry, StaticDrawUsage } from "three";

/** Bound transient integer scratch to at most 12 MiB per geometry. */
export const EXACT_INDEX_MAX_VERTICES = 1_048_576;

export type ExactGeometryIndexResult = {
  changed: boolean;
  originalBytes: number;
  indexedBytes: number;
  savedBytes: number;
  originalVertexCount: number;
  vertexCount: number;
};

type AttributeView = {
  attribute: BufferAttribute;
  bytes: Uint8Array;
  words: Uint32Array | null;
  stride: number;
  wordStride: number;
};

function view(attribute: BufferAttribute): AttributeView {
  const array = attribute.array;
  const stride = attribute.itemSize * array.BYTES_PER_ELEMENT;
  const wordAligned = stride % 4 === 0 && array.byteOffset % 4 === 0;
  return {
    attribute,
    bytes: new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    words: wordAligned
      ? new Uint32Array(array.buffer, array.byteOffset, array.byteLength / 4)
      : null,
    stride,
    wordStride: wordAligned ? stride / 4 : 0,
  };
}

function immutable(attribute: BufferAttribute): boolean {
  return attribute.usage === StaticDrawUsage &&
    !("isInstancedBufferAttribute" in attribute) &&
    !("isFloat16BufferAttribute" in attribute) &&
    attribute.updateRanges.length === 0 &&
    attribute.onUploadCallback === BufferAttribute.prototype.onUploadCallback;
}

function hashVertex(views: AttributeView[], vertex: number): number {
  let hash = 2166136261;
  for (const entry of views) {
    if (entry.words) {
      const start = vertex * entry.wordStride;
      for (let i = 0; i < entry.wordStride; i++) {
        hash = Math.imul(hash ^ entry.words[start + i], 16777619);
      }
    } else {
      const start = vertex * entry.stride;
      for (let i = 0; i < entry.stride; i++) {
        hash = Math.imul(hash ^ entry.bytes[start + i], 16777619);
      }
    }
  }
  // Float positions frequently end in zero mantissa bits. Mix those upper
  // bits into the table address instead of clustering axis-aligned vertices.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

function equalVertex(views: AttributeView[], left: number, right: number): boolean {
  for (const entry of views) {
    if (entry.words) {
      const a = left * entry.wordStride;
      const b = right * entry.wordStride;
      for (let i = 0; i < entry.wordStride; i++) {
        if (entry.words[a + i] !== entry.words[b + i]) return false;
      }
    } else {
      const a = left * entry.stride;
      const b = right * entry.stride;
      for (let i = 0; i < entry.stride; i++) {
        if (entry.bytes[a + i] !== entry.bytes[b + i]) return false;
      }
    }
  }
  return true;
}

/**
 * Index one immutable geometry in place, merging only byte-identical vertices.
 * Triangle/line order, attribute bits, groups, draw range and bounds survive.
 * This is intended at construction boundaries before upload or animation;
 * callers must not apply it to authored vertex-range mutation schemes.
 * Scratch storage is two integer tables; no per-vertex strings or objects.
 */
export function indexGeometryExactly(geometry: BufferGeometry): ExactGeometryIndexResult {
  const position = geometry.getAttribute("position");
  const entries = Object.entries(geometry.attributes);
  const originalVertexCount = position?.count ?? 0;
  const originalBytes = entries.reduce((sum, [, attribute]) =>
    sum + attribute.array.byteLength, geometry.index?.array.byteLength ?? 0);
  const unchanged: ExactGeometryIndexResult = {
    changed: false, originalBytes, indexedBytes: originalBytes,
    savedBytes: 0, originalVertexCount, vertexCount: originalVertexCount,
  };
  if (!position || originalVertexCount < 3 ||
    !Number.isSafeInteger(originalVertexCount) || originalVertexCount > EXACT_INDEX_MAX_VERTICES ||
    Object.values(geometry.morphAttributes).some((attributes) => attributes.length > 0) ||
    (geometry.index && !immutable(geometry.index)) ||
    entries.some(([, attribute]) => !(attribute instanceof BufferAttribute) ||
      attribute.count !== originalVertexCount || !immutable(attribute))) return unchanged;

  const views = entries.map(([, attribute]) => view(attribute as BufferAttribute));
  const vertexBytes = views.reduce((sum, entry) => sum + entry.stride, 0);
  const indexCount = geometry.index?.count ?? originalVertexCount;
  if (indexCount * 2 >= originalBytes) return unchanged;
  // At most 70% occupancy even for a geometry with no duplicate vertices.
  let capacity = 8;
  while (capacity < originalVertexCount / 0.7) capacity *= 2;
  const table = new Uint32Array(capacity);
  const remap = new Uint32Array(originalVertexCount);
  const mask = capacity - 1;
  let uniqueCount = 0;
  for (let vertex = 0; vertex < originalVertexCount; vertex++) {
    let slot = hashVertex(views, vertex) & mask;
    while (table[slot] !== 0 && !equalVertex(views, vertex, table[slot] - 1)) {
      slot = (slot + 1) & mask;
    }
    if (table[slot] === 0) {
      table[slot] = vertex + 1;
      remap[vertex] = uniqueCount++;
      // Unique count can only increase. Stop before allocating output when
      // even the smallest possible index cannot provide an actual saving.
      if (uniqueCount * vertexBytes + indexCount * 2 >= originalBytes) return unchanged;
    } else {
      remap[vertex] = remap[table[slot] - 1];
    }
  }
  const indexBytes = uniqueCount <= 65535 ? 2 : 4;
  const indexedBytes = uniqueCount * vertexBytes + indexCount * indexBytes;
  if (indexedBytes >= originalBytes) return unchanged;

  const indices = indexBytes === 2 ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
  for (let i = 0; i < indexCount; i++) {
    const oldVertex = geometry.index ? geometry.index.getX(i) : i;
    if (!Number.isInteger(oldVertex) || oldVertex < 0 || oldVertex >= originalVertexCount) {
      return unchanged;
    }
    indices[i] = remap[oldVertex];
  }
  const replacements: Array<[string, BufferAttribute]> = [];
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const [name] = entries[entryIndex];
    const entry = views[entryIndex];
    const original = entry.attribute;
    const ArrayType = original.array.constructor as { new(length: number): BufferAttribute["array"] };
    const values = new ArrayType(uniqueCount * original.itemSize);
    const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
    let next = 0;
    for (let vertex = 0; vertex < originalVertexCount; vertex++) {
      if (remap[vertex] !== next) continue;
      bytes.set(entry.bytes.subarray(vertex * entry.stride, (vertex + 1) * entry.stride), next * entry.stride);
      next++;
    }
    const attribute = new BufferAttribute(values, original.itemSize, original.normalized);
    attribute.name = original.name;
    attribute.gpuType = original.gpuType;
    attribute.setUsage(original.usage);
    replacements.push([name, attribute]);
  }
  for (const [name, attribute] of replacements) geometry.setAttribute(name, attribute);
  const index = new BufferAttribute(indices, 1);
  if (geometry.index) {
    index.name = geometry.index.name;
    index.gpuType = geometry.index.gpuType;
  }
  geometry.setIndex(index);
  return {
    changed: true, originalBytes, indexedBytes, savedBytes: originalBytes - indexedBytes,
    originalVertexCount, vertexCount: uniqueCount,
  };
}
