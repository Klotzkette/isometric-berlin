import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BufferGeometry, InterleavedBufferAttribute, Material, Mesh, LineSegments } from "three";
import roofs from "../src/data/roofHouseV233.json";
import doors from "../src/data/houseDoorsV233.json";
import curbs from "../src/data/houseCurbsV233.json";
import { prepareRoofHouseV233 } from "../src/roofHouseV233";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareHouseCurbsV233 } from "../src/houseCurbsV233";
import { replacePanoramaFacadeV202 } from "../src/panoramaFacadeV202";
import { transferSiteTrianglesV209 } from "../src/siteOwnershipV209";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
const descriptors = new Map<string, any>(manifest.chunks.map((d: { id: string }) => [d.id, d]));
const keys = [...new Set([...Object.keys(roofs.packets), ...Object.keys(curbs.packets),
  ...Object.keys(doors.chunks).flatMap(id => [`drawn:${id}`, `minecraft:${id}`])])].sort();
function finish<T>(it: Generator<void, T>): T { let n = it.next(); while (!n.done) n = it.next(); return n.value; }
const bytes = (encoded: string) => Buffer.from(encoded, "base64").length;
function load(key: string): SurroundingCityChunk {
  const [family, id] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(descriptors.get(id)[family].url, root))).toString());
}
function prepare(chunk: SurroundingCityChunk, id: string, native: boolean): SurroundingCityChunk {
  return finish(prepareHouseCurbsV233(finish(prepareHouseDoorsV233(finish(prepareRoofHouseV233(chunk, id, native)), id, native)), id, native));
}
function budget(packet: SurroundingCityChunk, native: boolean) {
  const vertices = packet.meshes.reduce((n, p) => n + bytes(p.positions) / 6, 0);
  const indices = packet.meshes.reduce((n, p) => n + bytes(p.indices) / 4, 0);
  const lineVertices = !native && packet.lines?.positions ? bytes(packet.lines.positions) / 6 : 0;
  return { vertices, indices, buffers: (vertices && indices ? 2 : 0) + (lineVertices ? 1 : 0),
    geometryBytes: vertices * 12 + indices * (vertices <= 65535 ? 2 : 4) + lineVertices * (packet.lines?.colors ? 12 : 6) };
}

test("every v233 house tile composes safely within unchanged packet limits and preserves its encoded source", () => {
  expect(keys.length).toBeGreaterThan(300);
  for (const key of keys) {
    const [family, id] = key.split(":"), native = family === "minecraft";
    const original = load(key), snapshot = JSON.stringify(original);
    const result = prepare(original, id, native), counts = budget(result, native);
    expect(result.meshes.length, key).toBeLessThanOrEqual(16);
    expect(counts.vertices, key).toBeLessThanOrEqual(400000);
    expect(counts.indices, key).toBeLessThanOrEqual(2400000);
    original.meshes.forEach((part, i) => expect(result.meshes[i], key).toBe(part));
    expect(result.nav, key).toBe(original.nav); expect(result.lines, key).toBe(original.lines);
    expect(JSON.stringify(original), key).toBe(snapshot);
    expect(prepare(result, id, native), key).toBe(result);
  }
}, 60000);

test("the integrated decoder accounts for every extra byte and buffer in all affected families", () => {
  for (const key of keys) {
    const [family, id] = key.split(":"), native = family === "minecraft";
    const original = load(key), expected = budget(prepare(original, id, native), native);
    const built = createSurroundingCityChunk(original, id, native);
    expect(built.geometryBytes, key).toBe(expected.geometryBytes);
    expect(built.bufferCount, key).toBe(expected.buffers);
    const arrays = new Set<ArrayBufferLike>(), geometry = new Set<BufferGeometry>(), materials = new Set<Material>();
    built.root.traverse(object => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      geometry.add(object.geometry);
      for (const a of Object.values(object.geometry.attributes)) arrays.add(a instanceof InterleavedBufferAttribute ? a.data.array.buffer : a.array.buffer);
      if (object.geometry.index) arrays.add(object.geometry.index.array.buffer);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
      for (const v of Object.values(object.userData)) if (v instanceof Material) materials.add(v);
    });
    expect([...arrays].reduce((n, a) => n + a.byteLength, 0), key).toBe(built.geometryBytes);
    for (const g of geometry) g.dispose(); for (const m of materials) m.dispose(); built.root.clear();
  }
}, 240000);

test("shared tiles retain original vertices and retire exactly the receipted flat-house triangles", () => {
  const shared = keys.filter(key => Object.hasOwn(roofs.packets, key) && Object.hasOwn(curbs.packets, key) && Object.hasOwn(doors.chunks, key.split(":")[1]));
  expect(shared.length).toBeGreaterThan(5);
  for (const key of shared) {
    const [family, id] = key.split(":"), native = family === "minecraft";
    const original = load(key), snapshot = JSON.stringify(original);
    const receipt = (roofs.packets as Record<string, any>)[key];
    const built = createSurroundingCityChunk(original, id, native);
    const body = built.root.children.find(child => child instanceof Mesh) as Mesh;
    const position = body.geometry.getAttribute("position"), colour = body.geometry.getAttribute("color"), indices = body.geometry.index!;
    expect(built.root.userData.rosenthalerGroundTrianglesV228 ?? 0, key).toBe(0);
    let vertexOffset = 0, indexOffset = 0, siteTransferred = 0, panoramaTransferred = 0;
    for (const [meshIndex, part] of original.meshes.entries()) {
      const pBuffer = Buffer.from(part.positions, "base64"), iBuffer = Buffer.from(part.indices, "base64");
      const pp = new Uint16Array(pBuffer.buffer, pBuffer.byteOffset, pBuffer.length / 2);
      const ii = new Uint32Array(iBuffer.buffer, iBuffer.byteOffset, iBuffer.length / 4);
      // Replay the existing ownership baseline before applying the v233 receipt.
      // Shared tiles can legitimately contain already retired landmark triangles.
      const baseline = Uint32Array.from(ii, v => v + vertexOffset);
      panoramaTransferred += finish(replacePanoramaFacadeV202(id, native, part, baseline, 0));
      siteTransferred += finish(transferSiteTrianglesV209(id, native, part, baseline, 0));
      const retired = new Set<number>(receipt.records.filter((r: { mesh: number }) => r.mesh === meshIndex).flatMap((r: { triangles: number[] }) => r.triangles));
      for (let i = 0; i < pp.length; i += 3) {
        const j = vertexOffset + i / 3;
        if (position.getX(j) !== pp[i] || position.getY(j) !== pp[i + 1] || position.getZ(j) !== pp[i + 2]) throw new Error(`${key}: altered original source vertex ${j}`);
      }
      for (let i = 0; i < ii.length; i += 3) for (let j = 0; j < 3; j++) {
        const expected = baseline[i + (retired.has(i / 3) ? 0 : j)];
        if (indices.getX(indexOffset + i + j) !== expected) throw new Error(`${key}: unrelated triangle retirement at ${meshIndex}:${i / 3}`);
      }
      vertexOffset += pp.length / 3; indexOffset += ii.length;
    }
    expect(built.root.userData.siteTransferredTrianglesV209 ?? 0, key).toBe(siteTransferred);
    expect(built.root.userData.panoramaTransferredTriangles ?? 0, key).toBe(panoramaTransferred);
    const roofColours = Buffer.from(receipt.replacement.colors, "base64");
    for (let i = 0; i < roofColours.length; i += 3) {
      const j = vertexOffset + i / 3;
      for (const [a, channel] of [colour.getX(j), colour.getY(j), colour.getZ(j)].entries()) {
        if (Math.abs(channel - roofColours[i + a] / 255) > 1e-7) throw new Error(`${key}: source roof colour altered at ${j}`);
      }
    }
    expect(JSON.stringify(original), key).toBe(snapshot);
    built.root.traverse(object => { if (object instanceof Mesh || object instanceof LineSegments) {
      object.geometry.dispose(); for (const m of Array.isArray(object.material) ? object.material : [object.material]) m.dispose();
      for (const v of Object.values(object.userData)) if (v instanceof Material) v.dispose();
    } }); built.root.clear();
  }
}, 60000);
