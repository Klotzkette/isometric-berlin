import { BufferAttribute, Group, InterleavedBuffer, InterleavedBufferAttribute, LineSegments, Mesh, type BufferGeometry } from "three";

export type AltMitteRegistrationV385 = Record<"drawn" | "native" | "ink", Record<string, Registration>> & {
  residual?: Record<string, RemainingFace[]>;
};
type Registration = [runs: [number, number][], hash: number];
type RemainingFace = [ordinal: number, corners: [number, number, number][]];

/** The original native shell merges some undersides across two owners. Retain
 * the surveyed wing fragments in the same packed mesh, material and draw call. */
function prepareRemainingFaces(geometry: BufferGeometry, registration: Registration, faces: RemainingFace[]) {
  const position = geometry.getAttribute("position"), color = geometry.getAttribute("color"), index = geometry.index;
  if (!(position instanceof InterleavedBufferAttribute) || !(color instanceof InterleavedBufferAttribute)
    || position.data !== color.data || position.data.stride !== 6 || position.offset !== 0 || color.offset !== 3
    || !(position.data.array instanceof Uint16Array) || !index || geometry.groups.length) return null;
  const packed = position.data.array;
  const extra: number[] = [];
  for (const [ordinal, corners] of faces) {
    if (!registration[0].some(([a, n]) => ordinal >= a && ordinal < a + n)
      || ordinal * 3 + 2 >= index.count || !corners.length || corners.length % 3) return null;
    const a = 6 * index.getX(ordinal * 3), b = 6 * index.getX(ordinal * 3 + 1), c = 6 * index.getX(ordinal * 3 + 2);
    for (let i = 3; i < 6; i++) if (packed[a + i] !== packed[b + i] || packed[a + i] !== packed[c + i]) return null;
    for (const p of corners) {
      if (p.length !== 3 || !p.every((v, i) => Number.isInteger(v) && v >= Math.min(packed[a+i], packed[b+i], packed[c+i])
        && v <= Math.max(packed[a+i], packed[b+i], packed[c+i]))) return null;
      extra.push(...p, packed[a+3], packed[a+4], packed[a+5]);
    }
  }
  return () => {
    const vertices = new Uint16Array(packed.length + extra.length);
    vertices.set(packed);
    vertices.set(extra, packed.length);
    const Index = index.array instanceof Uint32Array || vertices.length / 6 > 65535 ? Uint32Array : Uint16Array;
    const indices = new Index(index.count + extra.length / 6);
    indices.set(index.array);
    for (let i = index.count; i < indices.length; i++) indices[i] = position.count + i - index.count;
    const data = new InterleavedBuffer(vertices, 6);
    geometry.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0, false));
    geometry.setAttribute("color", new InterleavedBufferAttribute(data, 3, 3, true));
    geometry.setIndex(new BufferAttribute(indices, 1));
    return vertices.byteLength - packed.byteLength + indices.byteLength - index.array.byteLength;
  };
}

/** Retire only registered predecessor faces and contour lines. Verify the original
 * centimetre coordinates before touching a shared packet's indices or positions. */
function retire(geometry: BufferGeometry, registration: Registration, line: boolean): number {
  const [runs, expectedHash] = registration;
  const positions = geometry.getAttribute("position");
  const index = geometry.index;
  if (!positions || (!line && !index)) return 0;
  const width = line ? 2 : 3;
  const available = (line ? positions.count : index!.count) / width;
  let hash = 2166136261, count = 0;
  for (const [start, length] of runs) {
    if (start < 0 || length <= 0 || start + length > available) return 0;
    for (let offset = width * start; offset < width * (start + length); offset++) {
      const vertex = line ? offset : index!.getX(offset);
      hash = Math.imul(hash ^ positions.getX(vertex), 16777619);
      hash = Math.imul(hash ^ positions.getY(vertex), 16777619);
      hash = Math.imul(hash ^ positions.getZ(vertex), 16777619);
    }
    count += length;
  }
  if ((hash >>> 0) !== expectedHash) return 0;
  for (const [start, length] of runs) {
    for (let offset = width * start; offset < width * (start + length); offset += width) {
      if (line) positions.setXYZ(offset + 1, positions.getX(offset), positions.getY(offset), positions.getZ(offset));
      else {
        const a = index!.getX(offset);
        index!.setX(offset + 1, a);
        index!.setX(offset + 2, a);
      }
    }
  }
  if (line) positions.needsUpdate = true;
  else index!.needsUpdate = true;
  return count;
}

export function retireRegisteredAltMitteGeometry(root: Group, id: string, native: boolean,
  sources: AltMitteRegistrationV385, faceKey: string, lineKey: string): number {
  const face = sources[native ? "native" : "drawn"][id];
  const line = !native && sources.ink[id];
  if (!face && !line) return 0;
  let extraBytes = 0;
  for (const child of root.children) {
    if (face && child instanceof Mesh) {
      const remaining = native && sources.residual?.[id];
      const append = remaining ? prepareRemainingFaces(child.geometry, face, remaining) : null;
      const removed = remaining && !append ? 0 : retire(child.geometry, face, false);
      root.userData[faceKey] = removed;
      if (removed && append) extraBytes += append();
    }
    if (line && child instanceof LineSegments)
      root.userData[lineKey] = retire(child.geometry, line, true);
  }
  return extraBytes;
}
