import { BufferAttribute, BufferGeometry, Vector3, type Group, type Mesh, type TypedArrayConstructor } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import cuts from "./data/simsonCutsV375.json";

type Cut = {records: string; fragments: string};
const batches: Record<string, Record<string, Cut>> = cuts;

function unpack(text: string): Int32Array {
  const raw = gunzipSync(decodeBase64Bytes(text));
  if (raw.byteLength % 4) throw new Error("Invalid Simsonweg packet size");
  return new Int32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

/** Replace only the listed original faces. The source can belong to other meshes. */
export function cutSimsonGeometryV375(source: BufferGeometry, cut: Cut): BufferGeometry {
  if (source.userData.simsonCutsV375) return source;
  const rows = unpack(cut.records), pieces = unpack(cut.fragments);
  const position = source.getAttribute("position"), original = source.getIndex();
  const oldCount = original?.count ?? position?.count;
  if (!position || position.itemSize !== 3 || rows.length === 0 || rows.length % 5 ||
      pieces.length % 6 || oldCount % 3 || Object.keys(source.morphAttributes).length) return source;

  // Check the complete patch before allocating or changing any draw buffers.
  let previous = -1, triangles = 0;
  for (let i = 0; i < rows.length; i += 5) {
    const face = rows[i], count = rows[i + 4];
    if (face <= previous || 3 * face + 2 >= oldCount || count < 0) return source;
    for (let j = 0; j < 3; j++) {
      const offset = 3 * face + j, v = rows[i + j + 1];
      if (v < 0 || v >= position.count || v !== (original ? original.getX(offset) : offset)) return source;
    }
    triangles += count;
    previous = face;
  }
  if (triangles * 6 !== pieces.length) return source;

  const extra = triangles * 3, result = new BufferGeometry();
  result.boundingBox = source.boundingBox?.clone() ?? null;
  result.boundingSphere = source.boundingSphere?.clone() ?? null;
  const point = new Vector3();
  const attributes: [BufferAttribute, BufferAttribute][] = [];
  for (const [name, attr] of Object.entries(source.attributes)) {
    if (!(attr instanceof BufferAttribute) || attr.count !== position.count ||
        "isFloat16BufferAttribute" in attr) return source;
    if (!extra) {
      result.setAttribute(name, attr);
      continue;
    }
    const ArrayType = attr.array.constructor as TypedArrayConstructor;
    const extended = new ArrayType((attr.count + extra) * attr.itemSize);
    extended.set(attr.array);
    const out = new BufferAttribute(extended, attr.itemSize, attr.normalized);
    out.name = attr.name;
    out.setUsage(attr.usage);
    out.gpuType = attr.gpuType;
    result.setAttribute(name, out);
    attributes.push([attr, out]);
  }

  // Keep the source draw order, material groups and any restricted draw range.
  const Index = position.count + extra > 65535 ? Uint32Array : Uint16Array;
  const index = new Index(oldCount - rows.length / 5 * 3 + extra);
  let oldAt = 0, indexAt = 0, vertex = position.count, pieceAt = 0;
  const copyTo = (end: number) => {
    if (original) index.set(original.array.subarray(oldAt, end), indexAt);
    else for (let i = oldAt; i < end; i++) index[indexAt + i - oldAt] = i;
    indexAt += end - oldAt;
    oldAt = end;
  };
  for (let i = 0; i < rows.length; i += 5) {
    copyTo(rows[i] * 3);
    oldAt += 3;
    const a = rows[i + 1], b = rows[i + 2], c = rows[i + 3], count = rows[i + 4];
    if (!count) continue;
    const ax = position.getX(a), az = position.getZ(a);
    const bx = position.getX(b) - ax, bz = position.getZ(b) - az;
    const cx = position.getX(c) - ax, cz = position.getZ(c) - az;
    const area = bx * cz - bz * cx;
    if (area === 0) return source;
    for (let n = 0; n < count; n++, pieceAt += 6) {
      const x0 = pieces[pieceAt], z0 = pieces[pieceAt + 1];
      const x1 = pieces[pieceAt + 2], z1 = pieces[pieceAt + 3];
      const x2 = pieces[pieceAt + 4], z2 = pieces[pieceAt + 5];
      const reverse = ((x1 - x0) * (z2 - z0) - (z1 - z0) * (x2 - x0)) * area < 0;
      for (let j = 0; j < 3; j++) {
        const x = pieces[pieceAt + j * 2] / 100 - ax, z = pieces[pieceAt + j * 2 + 1] / 100 - az;
        const wb = (x * cz - z * cx) / area, wc = (bx * z - bz * x) / area, wa = 1 - wb - wc;
        for (const [attr, out] of attributes) {
          for (let k = 0; k < attr.itemSize; k++) {
            const av = attr.getComponent(a, k), bv = attr.getComponent(b, k), cv = attr.getComponent(c, k);
            const value = wa * av + wb * bv + wc * cv;
            // Centimetre snapping can extend a fraction beyond an edge. Keep
            // normalized integers in their original range instead of wrapping.
            out.setComponent(vertex, k, attr.normalized
              ? Math.min(Math.max(av, bv, cv), Math.max(Math.min(av, bv, cv), value)) : value);
          }
        }
        if (result.boundingBox || result.boundingSphere) {
          point.fromBufferAttribute(result.getAttribute("position"), vertex);
          result.boundingBox?.expandByPoint(point);
          result.boundingSphere?.expandByPoint(point);
        }
        index[indexAt + (reverse && j ? 3 - j : j)] = vertex++;
      }
      indexAt += 3;
    }
  }
  copyTo(oldCount);
  result.setIndex(new BufferAttribute(index, 1));
  const remap = (offset: number) => {
    let adjusted = offset;
    for (let i = 0; i < rows.length && rows[i] * 3 < offset; i += 5) adjusted += 3 * (rows[i + 4] - 1);
    return adjusted;
  };
  for (const group of source.groups) {
    const start = remap(group.start);
    result.addGroup(start, remap(group.start + group.count) - start, group.materialIndex);
  }
  const start = remap(source.drawRange.start);
  result.setDrawRange(start, remap(source.drawRange.start + source.drawRange.count) - start);
  result.name = source.name;
  result.userData = {...source.userData, simsonCutsV375: true};
  return result;
}

export function applySimsonCutsV375(root: Group, batchId: string): void {
  if (!Object.hasOwn(batches, batchId)) return;
  const batch = batches[batchId];
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || "isInstancedMesh" in mesh || !Object.hasOwn(batch, object.name)) return;
    mesh.geometry = cutSimsonGeometryV375(mesh.geometry, batch[object.name]);
  });
}
