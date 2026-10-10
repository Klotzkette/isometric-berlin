import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot, validateSurroundingManifest } from "../src/SurroundingCity";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import neukoellnReceipt from "../src/data/neukoellnPlacesV210Ownership.json";

// Independent receipt verification; do not derive expectations through the
// production transfer helpers that this historical packet test is checking.
function fingerprint(parts: string[]): number {
  let value = 2166136261;
  for (const part of parts) for (const character of part) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return value;
}

test("all new Ringbahn packets decode through the production renderer without lost vertices", async () => {
  const folder = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
  const manifest = validateSurroundingManifest(await Bun.file(new URL("manifest.json", folder)).json());
  const additions = manifest.chunks.filter(chunk => chunk.id.startsWith("ring182-"));
  expect(additions).toHaveLength(150);
  const owners = new Set([
    "OSM-way-24315001", "OSM-way-26824425", "OSM-way-334062957",
    "OSM-way-334062967", "OSM-way-334062969", "OSM-way-47023388", "OSM-way-88382458",
  ]);
  const seenTriangles = new Set<object>(), seenLines = new Set<object>(), seenNavigation = new Set<object>();
  let vertices = 0, largest = 0;
  for (const descriptor of additions) for (const family of ["drawn", "minecraft"] as const) {
    const packed = new Uint8Array(await Bun.file(new URL(descriptor[family].url, folder)).arrayBuffer());
    const payload = JSON.parse(new TextDecoder().decode(Bun.gunzipSync(packed))) as SurroundingCityChunk;
    const triangleReceipts = neukoellnReceipt.records.filter(r => r.tile === descriptor.id && r.mode === family);
    const lineReceipts = neukoellnReceipt.lineRecords.filter(r => r.tile === descriptor.id && r.mode === family);
    const navigationReceipts = neukoellnReceipt.navigationRecords.filter(r => r.tile === descriptor.id && r.mode === family);
    if (triangleReceipts.length || lineReceipts.length) {
      const sha256 = createHash("sha256").update(packed).digest("hex");
      for (const receipt of [...triangleReceipts, ...lineReceipts]) {
        expect(receipt.sha256).toBe(sha256);
        expect(owners.has(receipt.owner)).toBe(true);
      }
    }
    for (const receipt of navigationReceipts) {
      expect(owners.has(receipt.owner)).toBe(true);
      expect(receipt.groundY).toBe(payload.nav.groundY);
      expect(payload.nav.buildings.filter(b => b.sourceId === receipt.owner && isDeepStrictEqual(b, receipt.original))).toHaveLength(1);
      expect(triangleReceipts.some(r => r.owner === receipt.owner)).toBe(true);
      seenNavigation.add(receipt);
    }
    const expectedBuildings = payload.nav.buildings.filter(building => !navigationReceipts.some(r =>
      r.owner === building.sourceId && r.groundY === payload.nav.groundY && isDeepStrictEqual(building, r.original)));
    const originalNavigation = structuredClone(payload.nav);
    const built = createSurroundingCityChunk(payload, descriptor.id, family === "minecraft");
    try {
      const sources = [...payload.meshes, ...(payload.lines?.positions ? [payload.lines] : [])];
      const objects = built.root.children.filter(object => object instanceof Mesh || object instanceof LineSegments) as (Mesh | LineSegments)[];
      expect(objects.length).toBe(sources.length);
      expect(payload.nav).toEqual(originalNavigation);
      if (expectedBuildings.length === payload.nav.buildings.length) expect(built.nav).toBe(payload.nav);
      else {
        expect(built.nav).not.toBe(payload.nav);
        expect(built.nav).toEqual({ ...payload.nav, buildings: expectedBuildings });
        for (const key of Object.keys(payload.nav) as (keyof typeof payload.nav)[]) {
          if (key !== "buildings") expect(built.nav[key]).toBe(payload.nav[key]);
        }
        expectedBuildings.forEach((building, i) => expect(built.nav.buildings[i]).toBe(building));
      }
      for (let i = 0; i < objects.length; i++) {
        const source = new Uint16Array(Uint8Array.from(Buffer.from(sources[i].positions, "base64")).buffer);
        const position = objects[i].geometry.getAttribute("position") as InterleavedBufferAttribute;
        expect(position.count * 3).toBe(source.length);
        const retiredSegments = new Set<number>();
        if (objects[i] instanceof LineSegments) {
          const inkFingerprint = fingerprint([sources[i].positions, sources[i].colors ?? ""]);
          for (const receipt of lineReceipts) {
            expect(receipt.fingerprint).toBe(inkFingerprint);
            for (const segment of receipt.segments) {
              expect(Number.isSafeInteger(segment) && segment >= 0 && segment * 6 + 5 < source.length).toBe(true);
              retiredSegments.add(segment);
            }
            seenLines.add(receipt);
          }
        }
        for (let p = 0; p < source.length; p++) {
          const expected = retiredSegments.has(Math.floor(p / 6)) && p % 6 >= 3 ? source[p - 3] : source[p];
          if (position.data.array[Math.floor(p / 3) * 6 + p % 3] !== expected) {
            throw new Error(`Ringbahn source vertex changed in ${descriptor.id}/${family}`);
          }
        }
        if (objects[i] instanceof Mesh) {
          const part = payload.meshes[i];
          const indices = new Uint32Array(Uint8Array.from(Buffer.from(part.indices, "base64")).buffer);
          const actual = objects[i].geometry.getIndex()!;
          expect(actual.count).toBe(indices.length);
          const retiredTriangles = new Set<number>();
          const receipts = triangleReceipts.filter(r => r.kind === part.kind);
          if (receipts.length) {
            const meshFingerprint = fingerprint([part.positions, part.colors, part.indices]);
            for (const receipt of receipts) {
              expect(receipt.fingerprint).toBe(meshFingerprint);
              for (const triangle of receipt.triangles) {
                expect(Number.isSafeInteger(triangle) && triangle >= 0 && triangle * 3 + 2 < indices.length).toBe(true);
                retiredTriangles.add(triangle);
              }
              seenTriangles.add(receipt);
            }
          }
          for (let p = 0; p < indices.length; p++) {
            const expected = retiredTriangles.has(Math.floor(p / 3)) ? indices[p - p % 3] : indices[p];
            if (actual.array[p] !== expected) {
              throw new Error(`Ringbahn source index changed outside its receipt in ${descriptor.id}/${family}`);
            }
          }
        }
        vertices += position.count;
      }
      largest = Math.max(largest, built.geometryBytes);
    } finally { disposeSurroundingCityRoot(built.root); }
  }
  expect(seenTriangles.size).toBe(neukoellnReceipt.records.length);
  expect(seenLines.size).toBe(neukoellnReceipt.lineRecords.length);
  expect(seenNavigation.size).toBe(neukoellnReceipt.navigationRecords.length);
  expect(vertices).toBeGreaterThan(1_000_000);
  expect(largest).toBeLessThan(3 * 1024 * 1024);
}, 60_000);

test("new Ringbahn and Steglitz ground exists before streaming; the original core stays owned", () => {
  for (const [x, z] of [[5800, 4500], [-3450, 7000], [0, 5200]]) {
    expect(surroundingScopeGroundAt(x, z)).toBe(3);
  }
  expect(surroundingScopeGroundAt(0, 0)).toBeNull();
  expect(surroundingScopeGroundAt(20000, 20000)).toBeNull();
});
