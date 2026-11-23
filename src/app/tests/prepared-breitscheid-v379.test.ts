import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { BufferAttribute, Mesh, LineSegments, Material, type Object3D } from "three";
import { createBreitscheidEnsembleV379 } from "../src/CityWestDetails";
import { decodePreparedBreitscheidV379 } from "../src/preparedBreitscheidV379";

function settings(m: Material) {
  const {uuid, metadata, ...properties} = m.toJSON();
  return properties;
}
function attribute(a: BufferAttribute) {
  const bytes = Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength);
  return [a.array.constructor.name, a.itemSize, a.normalized, a.count, createHash("sha256").update(bytes).digest("hex")];
}
function geometry(root: Object3D) {
  const nodes: unknown[] = [];
  root.traverse(o => {
    const {dayMaterial, nightMaterial, ...flags} = o.userData;
    nodes.push([o.name, o.parent?.name, o.type, o.renderOrder, o.matrix.elements, flags]);
    if (o instanceof Mesh || o instanceof LineSegments) {
      nodes.push([o.geometry.userData, settings(o.material), dayMaterial === o.material, nightMaterial && settings(nightMaterial)]);
      nodes.push(Object.entries(o.geometry.attributes).map(([n,a]) => [n, attribute(a as BufferAttribute)]));
      if (o.geometry.index) nodes.push(attribute(o.geometry.index));
    }
  });
  return nodes;
}
test("prepared Breitscheidplatz preserves every attribute byte, node and day/night material", () => {
  const zip = readFileSync(new URL("../src/data/breitscheidEnsembleV379.bin.gz", import.meta.url));
  const bytes = new Uint8Array(gunzipSync(zip)).buffer;
  const original = createBreitscheidEnsembleV379("full","omit");
  const loaded = decodePreparedBreitscheidV379(bytes);
  expect(geometry(loaded)).toEqual(geometry(original));
  expect(zip.byteLength).toBeLessThan(150000);
});
