import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BufferGeometry, InterleavedBufferAttribute, LineSegments, Material, Mesh } from "three";
import current from "../src/data/outerRoofsV262.json";
import previous from "../src/data/roofHouseV233.json";
import { prepareOuterRoofsV262 } from "../src/outerRoofsV262";
import { prepareRoofHouseV233 } from "../src/roofHouseV233";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

function finish<T>(work: Generator<void, T>): T {
  let next = work.next();
  while (!next.done) next = work.next();
  return next.value;
}
function load(key: string): SurroundingCityChunk {
  const [mode, id] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(
    `../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url,
  ))).toString());
}

test("actual decoder preserves exact sources and accounts/disposes all eight outer-roof transactions", () => {
  expect(current.keys).toHaveLength(8);
  for (const key of current.keys) {
    const [mode, id] = key.split(":"), native = mode === "minecraft";
    const input = load(key), snapshot = JSON.stringify(input);
    const receipt = current.packets[key as keyof typeof current.packets];
    // Neither order of preparation can alter the older roof contract.
    expect(finish(prepareRoofHouseV233(input, id, native))).toBe(input);
    const prepared = finish(prepareOuterRoofsV262(input, id, native));
    expect(finish(prepareRoofHouseV233(prepared, id, native))).toBe(prepared);
    const made = createSurroundingCityChunk(input, id, native);
    const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
    const buffers = new Set<ArrayBufferLike>();
    try {
      expect(made.root.userData.sourceKinds).toContain("outer-roofs-v262");
      expect(made.root.userData.roofHouseTrianglesV233 ?? 0).toBe(0);
      expect(made.root.userData.outerRoofTrianglesV262).toBe(receipt.records.reduce((n, r) => n + r.triangles.length, 0));
      expect(made.root.userData.outerRoofLineSegmentsV262 ?? 0).toBe(receipt.segments.length);
      expect(made.nav).toBe(input.nav);
      const body = made.root.children.find(o => o instanceof Mesh) as Mesh;
      const positions = body.geometry.getAttribute("position"), indices = body.geometry.index!;
      let vertexOffset = 0, indexOffset = 0;
      for (const [mesh, part] of input.meshes.entries()) {
        const pp = Buffer.from(part.positions, "base64"), ii = Buffer.from(part.indices, "base64");
        const retired = new Set(receipt.records.filter(r => r.mesh === mesh).flatMap(r => r.triangles));
        for (let p = 0; p < pp.length / 6; p++) {
          const at = p + vertexOffset;
          if (positions.getX(at) !== pp.readUInt16LE(p * 6) ||
              positions.getY(at) !== pp.readUInt16LE(p * 6 + 2) ||
              positions.getZ(at) !== pp.readUInt16LE(p * 6 + 4)) throw new Error(`${key}: changed source vertex ${at}`);
        }
        for (let t = 0; t < ii.length / 12; t++) for (let axis = 0; axis < 3; axis++) {
          const expected = vertexOffset + ii.readUInt32LE(t * 12 + (retired.has(t) ? 0 : axis * 4));
          if (indices.getX(indexOffset + t * 3 + axis) !== expected) throw new Error(`${key}: unrelated index change ${mesh}:${t}`);
        }
        vertexOffset += pp.length / 6; indexOffset += ii.length / 4;
      }
      if (!native && input.lines) {
        const ink = made.root.children.find(o => o instanceof LineSegments) as LineSegments;
        const actual = ink.geometry.getAttribute("position"), packed = Buffer.from(input.lines.positions, "base64");
        const retired = new Set<number>(receipt.segments);
        for (let v = 0; v < packed.length / 6; v++) {
          const source = retired.has(Math.floor(v / 2)) && v % 2 ? v - 1 : v;
          if (actual.getX(v) !== packed.readUInt16LE(source * 6) ||
              actual.getY(v) !== packed.readUInt16LE(source * 6 + 2) ||
              actual.getZ(v) !== packed.readUInt16LE(source * 6 + 4)) throw new Error(`${key}: unrelated ink change ${v}`);
        }
      }
      made.root.traverse(o => {
        if (!(o instanceof Mesh || o instanceof LineSegments)) return;
        geometries.add(o.geometry);
        for (const a of Object.values(o.geometry.attributes)) buffers.add(a instanceof InterleavedBufferAttribute ? a.data.array.buffer : a.array.buffer);
        if (o.geometry.index) buffers.add(o.geometry.index.array.buffer);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        for (const v of Object.values(o.userData)) if (v instanceof Material) materials.add(v);
      });
      expect([...buffers].reduce((n, b) => n + b.byteLength, 0)).toBe(made.geometryBytes);
      expect(buffers.size).toBe(made.bufferCount);
      expect(JSON.stringify(input)).toBe(snapshot);
    } finally {
      let geometryEvents = 0, materialEvents = 0;
      geometries.forEach(g => g.addEventListener("dispose", () => { geometryEvents++; }));
      materials.forEach(m => m.addEventListener("dispose", () => { materialEvents++; }));
      disposeSurroundingCityRoot(made.root);
      expect(geometryEvents).toBe(geometries.size);
      expect(materialEvents).toBe(materials.size);
      expect(made.root.children).toHaveLength(0);
    }
  }
});

test("actual decoder retains one existing v233 family pair without a new outer-roof transfer", () => {
  const id = previous.keys[0].split(":")[1];
  for (const mode of ["drawn", "minecraft"]) {
    const key = `${mode}:${id}`, input = load(key), native = mode === "minecraft";
    const receipt = previous.packets[key as keyof typeof previous.packets];
    expect(receipt).toBeDefined();
    expect(finish(prepareOuterRoofsV262(input, id, native))).toBe(input);
    const made = createSurroundingCityChunk(input, id, native);
    try {
      expect(made.root.userData.sourceKinds).toContain("roof-house-v233");
      expect(made.root.userData.sourceKinds).not.toContain("outer-roofs-v262");
      expect(made.root.userData.outerRoofTrianglesV262 ?? 0).toBe(0);
      expect(made.root.userData.roofHouseTrianglesV233).toBe(receipt.records.reduce((n, r) => n + r.triangles.length, 0));
    } finally { disposeSurroundingCityRoot(made.root); }
  }
});
