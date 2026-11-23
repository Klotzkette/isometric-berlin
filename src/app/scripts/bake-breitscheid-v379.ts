// Run with Bun. This bakes the same full-detail church that the procedural
// builder exposes to the offline tools. There is no quantization or decimation.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { BufferAttribute, Group, LineSegments, Material, Mesh, type Object3D } from "three";
import { createBreitscheidEnsembleV379 } from "../src/CityWestDetails";
import type { PackedChurchAttribute, PackedChurchNode } from "../src/preparedBreitscheidV379";

const root = createBreitscheidEnsembleV379("full", "omit");
const nodes: PackedChurchNode[] = [];
const blocks: Buffer[] = [];
let offset = 0;
function encodeAttribute(a: BufferAttribute): PackedChurchAttribute {
  const bytes = Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength);
  const padding = (4 - offset % 4) % 4;
  // Compress repeated high bytes and regular vertex/index strides without
  // changing a single bit. The chosen layout is recorded for each attribute.
  let storage = bytes, stride = 0, best = gzipSync(bytes).length;
  for (const distance of new Set([a.array.BYTES_PER_ELEMENT, a.array.BYTES_PER_ELEMENT * a.itemSize, a.array.BYTES_PER_ELEMENT * 3])) {
    if (distance > bytes.length) continue;
    const plane = Buffer.allocUnsafe(bytes.length);
    let at = 0;
    for (let lane = 0; lane < distance; lane++) {
      let prev = 0;
      for (let i = lane; i < bytes.length; i += distance) {
        plane[at++] = bytes[i] - prev;
        prev = bytes[i];
      }
    }
    const size = gzipSync(plane).length;
    if (size < best) { storage = plane; stride = distance; best = size; }
  }
  blocks.push(Buffer.alloc(padding), storage);
  offset += padding;
  const block = {offset, stride, length:a.array.length, type:a.array.constructor.name as PackedChurchAttribute["type"], size:a.itemSize, normalized:a.normalized};
  offset += bytes.length;
  return block;
}
function materialSettings(material: Material) {
  const { uuid, metadata, ...settings } = material.toJSON();
  return settings;
}
function record(o: Object3D, parent: number) {
  o.updateMatrix();
  if (!o.matrix.elements.every((v,i) => v === (i%5 === 0 ? 1 : 0))) throw Error("Unexpected transformed church part");
  const {dayMaterial, nightMaterial, ...userData} = o.userData;
  const row: PackedChurchNode = {name:o.name, type:o.type, parent, renderOrder:o.renderOrder, userData};
  if (o instanceof Mesh || o instanceof LineSegments) {
    const g = o.geometry;
    if (Array.isArray(o.material) || g.groups.length || g.boundingSphere || g.boundingBox) throw Error("Unexpected church geometry settings");
    row.attributes = {};
    for (const [name, a] of Object.entries(g.attributes)) {
      if (!(a instanceof BufferAttribute)) throw Error("Unsupported interleaved church buffer");
      row.attributes[name] = encodeAttribute(a);
    }
    if (g.index) row.index = encodeAttribute(g.index);
    row.geometryFlags = g.userData;
    row.material = materialSettings(o.material);
    if (nightMaterial) row.night = materialSettings(nightMaterial);
  } else if (!(o instanceof Group)) throw Error("Unsupported church node");
  const index = nodes.push(row) - 1;
  for (const child of o.children) record(child, index);
}
record(root, -1);
const json = Buffer.from(JSON.stringify(nodes));
const header = Buffer.alloc(8 + json.length + (4 - json.length % 4) % 4);
header.write("BCW1");
header.writeUInt32LE(json.length, 4);
json.copy(header, 8);
const packet = gzipSync(Buffer.concat([header, ...blocks]), {level:9});
writeFileSync(new URL("../src/data/breitscheidEnsembleV379.bin.gz",import.meta.url), packet);
console.log(nodes.length, "nodes,", packet.length, "compressed bytes");
