import {
  BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, CylinderGeometry, FloatType, PlaneGeometry, RingGeometry, SphereGeometry, TorusGeometry,
  InterleavedBuffer, InterleavedBufferAttribute, Line, Mesh, Points,
  StaticDrawUsage, type Object3D,
} from "three";

// Packing replaces one geometry at a time. Bound the temporary duplicate;
// enormous single meshes save few handles compared with many small meshes.
export const STATIC_INTERLEAVE_MAX_BYTES = 8 * 1024 * 1024;

export type StaticGeometryInterleaveResult = {
  geometries: number;
  savedBuffers: number;
  bytes: number;
};

function immutable(attribute: BufferAttribute): boolean {
  return attribute.usage === StaticDrawUsage &&
    !("isInstancedBufferAttribute" in attribute) &&
    !("isFloat16BufferAttribute" in attribute) &&
    attribute.updateRanges.length === 0 &&
    attribute.onUploadCallback === BufferAttribute.prototype.onUploadCallback;
}

/**
 * Losslessly combine immutable Float32 vertex streams into one GPU buffer.
 * Run only on unpublished main-thread roots, after exact indexing and Worker
 * deserialization, before any renderer/warmup sees them. Instance matrices and
 * instance colours are deliberately not vertex streams and remain untouched.
 *
 * Ownership is explicit: exact-indexed static batches, or audited stock box/curved/planar geometry
 * whose construction is complete. CPU-deformed flag cloth uses DynamicDrawUsage
 * and is excluded. Arbitrary landmark/mode-colour geometries never opt in.
 * No vertex, index, material, group, draw range, bound or visibility is changed.
 */
export function interleaveStaticGeometry(root: Object3D): StaticGeometryInterleaveResult {
  const result: StaticGeometryInterleaveResult = { geometries: 0, savedBuffers: 0, bytes: 0 };
  const visited = new Set<BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    const geometry: BufferGeometry = object.geometry;
    if (visited.has(geometry)) return;
    visited.add(geometry);
    if (!(geometry.userData.exactIndexPending === false || geometry instanceof BoxGeometry ||
        geometry instanceof CylinderGeometry || geometry instanceof SphereGeometry ||
        geometry instanceof TorusGeometry || geometry instanceof PlaneGeometry ||
        geometry instanceof RingGeometry || geometry instanceof CircleGeometry) ||
        object.userData.modeColours || geometry.userData.flatColorsBuilt ||
        Object.values(geometry.morphAttributes).some((attributes) => attributes.length > 0) ||
        (geometry.index && !immutable(geometry.index))) return;
    const entries = Object.entries(geometry.attributes);
    const count = geometry.getAttribute("position")?.count ?? 0;
    if (entries.length < 2 || count < 1 || !Number.isSafeInteger(count)) return;
    if (entries.some(([, attribute]) => !(attribute instanceof BufferAttribute) ||
      !(attribute.array instanceof Float32Array) || attribute.gpuType !== FloatType ||
      attribute.count !== count || !Number.isInteger(attribute.itemSize) ||
      attribute.itemSize < 1 || !immutable(attribute))) return;
    const attributes = entries as Array<[string, BufferAttribute]>;
    const stride = attributes.reduce((total, [, attribute]) => total + attribute.itemSize, 0);
    const bytes = count * stride * Float32Array.BYTES_PER_ELEMENT;
    // Keep strides within the portable 255-byte vertexAttribPointer limit.
    if (stride * Float32Array.BYTES_PER_ELEMENT > 255 || bytes > STATIC_INTERLEAVE_MAX_BYTES) return;
    const values = new Float32Array(count * stride);
    const words = new Uint32Array(values.buffer);
    const data = new InterleavedBuffer(values, stride).setUsage(StaticDrawUsage);
    let offset = 0;
    for (const [name, original] of attributes) {
      const source = new Uint32Array(original.array.buffer, original.array.byteOffset, original.array.length);
      const size = original.itemSize;
      // Integer copies preserve signed zero and NaN payloads as well as every
      // ordinary float bit; numeric get/set conversion is deliberately avoided.
      for (let vertex = 0; vertex < count; vertex++) {
        for (let component = 0; component < size; component++) {
          words[vertex * stride + offset + component] = source[vertex * size + component];
        }
      }
      const attribute = new InterleavedBufferAttribute(data, size, offset, original.normalized);
      attribute.name = original.name;
      geometry.setAttribute(name, attribute);
      offset += size;
    }
    result.geometries++;
    result.savedBuffers += attributes.length - 1;
    result.bytes += bytes;
  });
  return result;
}
