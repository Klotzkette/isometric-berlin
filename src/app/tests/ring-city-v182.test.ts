import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot, validateSurroundingManifest } from "../src/SurroundingCity";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import neukoellnReceipt from "../src/data/neukoellnPlacesV210Ownership.json";
import townhallReceipt from "../src/data/townhallV227Ownership.json";
import { prepareFriedrichshainV266 } from "../src/FriedrichshainV266";
import { prepareAllotmentsV264 } from "../src/AllotmentsV264";
import { prepareRoofHouseV233, type RoofHouseSourceV233 } from "../src/roofHouseV233";
import { prepareGreyFacadesV263 } from "../src/greyFacadesV263";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareHouseCurbsV233 } from "../src/houseCurbsV233";
import { prepareCityStreetsV249 } from "../src/CityStreetsV249";
import { prepareMainStreetEdgesV254 } from "../src/MainStreetEdgesV254";
import { prepareNamedSiteV238, type NamedSiteSourceV238 } from "../src/namedSiteReplacementsV238";
import { prepareCityWestTransportV281, type CityWestSourceV281 } from "../src/CityWestTransportV281";
import { prepareStreetCurvesV276, type StreetCurvesSourceV276 } from "../src/streetCurvesV276";
import roofSource from "../src/data/roofHouseV233.json";
import namedSource from "../src/data/southElevatedV238Replacement.json";
import northNamedSource from "../src/data/northElevatedV238Replacement.json";
import venueNamedSource from "../src/data/venuesV238Replacement.json";
import cityWestSource from "../src/data/citywestTransportV281.json";
import curveSource from "../src/data/streetCurvesV276.json";

function drain<T>(iterator: Generator<void, T>): T {
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return next.value;
}
const u16 = (value: string) => new Uint16Array(Uint8Array.from(Buffer.from(value, "base64")).buffer);
const u32 = (value: string) => new Uint32Array(Uint8Array.from(Buffer.from(value, "base64")).buffer);

/** Only the later append-only preparations whose source key indexes intersect
 * the original 150 Ringbahn tiles, in their production order. Old packed parts
 * remain the exact same objects; transfers below are checked independently. */
function prepareRing(payload: SurroundingCityChunk, id: string, native: boolean): SurroundingCityChunk {
  let result = payload;
  for (const prepare of [prepareFriedrichshainV266, prepareAllotmentsV264, prepareRoofHouseV233,
    prepareGreyFacadesV263, prepareHouseDoorsV233, prepareHouseCurbsV233, prepareCityStreetsV249,
    prepareMainStreetEdgesV254, prepareNamedSiteV238, prepareCityWestTransportV281, prepareStreetCurvesV276])
    result = drain(prepare(result, id, native));
  payload.meshes.forEach((part, i) => expect(result.meshes[i]).toBe(part));
  expect(result.lines).toBe(payload.lines);
  expect(result.meshes.length).toBeLessThanOrEqual(16);
  return result;
}

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
  const seenTownhallTriangles = new Set<object>(), seenTownhallLines = new Set<object>(), seenTownhallNavigation = new Set<object>();
  let vertices = 0, largest = 0;
  for (const descriptor of additions) for (const family of ["drawn", "minecraft"] as const) {
    const packed = new Uint8Array(await Bun.file(new URL(descriptor[family].url, folder)).arrayBuffer());
    const payload = JSON.parse(new TextDecoder().decode(Bun.gunzipSync(packed))) as SurroundingCityChunk;
    const native = family === "minecraft", key = `${family}:${descriptor.id}`;
    const original = JSON.stringify(payload), prepared = prepareRing(payload, descriptor.id, native);
    const triangleReceipts = [...neukoellnReceipt.records, ...townhallReceipt.records].filter(r => r.tile === descriptor.id && r.mode === family);
    const lineReceipts = [...neukoellnReceipt.lineRecords, ...townhallReceipt.lineRecords].filter(r => r.tile === descriptor.id && r.mode === family);
    const navigationReceipts = [...neukoellnReceipt.navigationRecords, ...townhallReceipt.navigationRecords].filter(r => r.tile === descriptor.id && r.mode === family);
    const roof = (roofSource as RoofHouseSourceV233).packets[key];
    const named = [namedSource, northNamedSource, venueNamedSource]
      .map(data => (data as NamedSiteSourceV238).packets[key]).find(Boolean);
    const cityWest = (cityWestSource as CityWestSourceV281).packets[key];
    const curves = native ? undefined : (curveSource as StreetCurvesSourceV276).chunks[descriptor.id];
    const replacements = [roof, named, cityWest].filter(r => !!r);
    for (const receipt of replacements) {
      expect(receipt.origin).toEqual(payload.origin);
      expect(prepared.meshes.includes(receipt.replacement)).toBe(true);
      for (const record of receipt.records) {
        const part = payload.meshes[record.mesh];
        expect(record.fingerprint).toBe(fingerprint([part.positions, part.colors, part.indices]));
      }
    }
    if (curves) {
      expect(prepared.meshes.includes(curves.mesh)).toBe(true);
      expect(curves.origin).toEqual(payload.origin);
      for (const record of curves.records) {
        const part = prepared.meshes[record.mesh];
        expect(record.kind).toBe(part.kind);
        expect(record.fingerprint).toBe(fingerprint([part.positions, part.colors, part.indices]));
      }
    }
    if (triangleReceipts.length || lineReceipts.length) {
      const sha256 = createHash("sha256").update(packed).digest("hex");
      for (const receipt of [...triangleReceipts, ...lineReceipts]) {
        expect(receipt.sha256).toBe(sha256);
        if (neukoellnReceipt.records.includes(receipt as never) || neukoellnReceipt.lineRecords.includes(receipt as never))
          expect(owners.has(receipt.owner)).toBe(true);
      }
    }
    for (const receipt of navigationReceipts) {
      if (neukoellnReceipt.navigationRecords.includes(receipt as never)) expect(owners.has(receipt.owner)).toBe(true);
      expect(receipt.groundY).toBe(payload.nav.groundY);
      expect(payload.nav.buildings.filter(b => b.sourceId === receipt.owner && isDeepStrictEqual(b, receipt.original))).toHaveLength(1);
      expect(triangleReceipts.some(r => r.owner === receipt.owner)).toBe(true);
      (neukoellnReceipt.navigationRecords.includes(receipt as never) ? seenNavigation : seenTownhallNavigation).add(receipt);
    }
    let expectedBuildings = payload.nav.buildings.filter(building => !navigationReceipts.some(r =>
      r.owner === building.sourceId && r.groundY === payload.nav.groundY && isDeepStrictEqual(building, r.original)));
    if (named) {
      for (const receipt of named.navigationRecords) {
        expect(receipt.groundY).toBe(payload.nav.groundY);
        expect(payload.nav.buildings.filter(b => b.sourceId === receipt.owner && isDeepStrictEqual(b, receipt.original))).toHaveLength(1);
      }
      expectedBuildings = expectedBuildings.filter(b => !named.navigationRecords.some(r => r.owner === b.sourceId && isDeepStrictEqual(r.original, b)));
      expectedBuildings.push(...named.navigationSolids.map((s, i) => ({ ring: s.ring, holes: s.holes,
        minHeight: s.minY - payload.nav.groundY, height: s.maxY - payload.nav.groundY,
        sourceId: `required-v238-${payload.origin[0]}-${payload.origin[2]}-${i}` })));
    }
    if (cityWest) {
      expect(cityWest.navigationFingerprint).toBe(fingerprint([JSON.stringify(payload.nav)]));
      expect(cityWest.replacementFingerprint).toBe(fingerprint([cityWest.replacement.positions, cityWest.replacement.colors, cityWest.replacement.indices]));
      expectedBuildings = [...expectedBuildings.filter(b => !cityWest.retiredOwners.includes(b.sourceId ?? "")), ...cityWest.buildings];
    }
    const expectedNavigation = { ...payload.nav, buildings: expectedBuildings,
      ...(curves ? { roads: [...(payload.nav.roads ?? []), ...curves.roads] } : {}) };
    const built = createSurroundingCityChunk(payload, descriptor.id, native);
    try {
      const objects = built.root.children.filter(object => object instanceof Mesh || object instanceof LineSegments) as (Mesh | LineSegments)[];
      expect(objects.filter(object => object instanceof Mesh)).toHaveLength(1);
      expect(objects.filter(object => object instanceof LineSegments)).toHaveLength(!native && payload.lines?.positions ? 1 : 0);
      expect(JSON.stringify(payload)).toBe(original);
      expect(built.nav).toEqual(expectedNavigation);
      for (const field of Object.keys(payload.nav) as (keyof typeof payload.nav)[])
        if (field !== "buildings" && !(field === "roads" && curves)) expect(built.nav[field]).toBe(payload.nav[field]);
      const mesh = objects.find(object => object instanceof Mesh) as Mesh;
      const position = mesh.geometry.getAttribute("position") as InterleavedBufferAttribute;
      const actual = mesh.geometry.getIndex()!;
      let vertexOffset = 0, indexOffset = 0;
      for (const [i, part] of prepared.meshes.entries()) {
        const source = u16(part.positions), indices = u32(part.indices);
        for (let p = 0; p < source.length; p++) {
          if (position.getComponent(vertexOffset + Math.floor(p / 3), p % 3) !== source[p]) {
            throw new Error(`Ringbahn source vertex changed in ${descriptor.id}/${family}`);
          }
        }
        const retiredTriangles = new Set<number>();
        for (const receipt of triangleReceipts.filter(r => r.kind === part.kind)) {
          expect(receipt.fingerprint).toBe(fingerprint([part.positions, part.colors, part.indices]));
          for (const triangle of receipt.triangles) retiredTriangles.add(triangle);
          (neukoellnReceipt.records.includes(receipt as never) ? seenTriangles : seenTownhallTriangles).add(receipt);
        }
        for (const receipt of replacements) for (const record of receipt.records.filter(r => r.mesh === i))
          for (const triangle of record.triangles) retiredTriangles.add(triangle);
        for (const triangle of retiredTriangles)
          expect(Number.isSafeInteger(triangle) && triangle >= 0 && triangle * 3 + 2 < indices.length).toBe(true);
        for (let p = 0; p < indices.length; p++) {
          const expected = retiredTriangles.has(Math.floor(p / 3)) ? indices[p - p % 3] : indices[p];
          if (actual.array[indexOffset + p] !== vertexOffset + expected) {
            throw new Error(`Ringbahn source index changed outside its receipt in ${descriptor.id}/${family}`);
          }
        }
        vertexOffset += source.length / 3; indexOffset += indices.length;
      }
      expect(position.count).toBe(vertexOffset); expect(actual.count).toBe(indexOffset);
      vertices += position.count;
      if (!native && payload.lines?.positions) {
        const ink = objects.find(object => object instanceof LineSegments) as LineSegments;
        const inkPosition = ink.geometry.getAttribute("position");
        const source = u16(payload.lines.positions), tail = curves ? u16(curves.lines.positions) : new Uint16Array();
        const retiredSegments = new Set<number>();
        const inkFingerprint = fingerprint([payload.lines.positions, payload.lines.colors ?? ""]);
        for (const receipt of lineReceipts) {
          expect(receipt.fingerprint).toBe(inkFingerprint);
          receipt.segments.forEach(segment => retiredSegments.add(segment));
          (neukoellnReceipt.lineRecords.includes(receipt as never) ? seenLines : seenTownhallLines).add(receipt);
        }
        for (const receipt of [...replacements, ...(curves ? [curves] : [])]) if (receipt.segments.length) {
          expect(receipt.lineFingerprint).toBe(inkFingerprint);
          receipt.segments.forEach(segment => retiredSegments.add(segment));
        }
        for (const segment of retiredSegments)
          expect(Number.isSafeInteger(segment) && segment >= 0 && segment * 6 + 5 < source.length).toBe(true);
        expect(inkPosition.count * 3).toBe(source.length + tail.length);
        for (let p = 0; p < source.length + tail.length; p++) {
          const expected = p >= source.length ? tail[p - source.length] :
            source[retiredSegments.has(Math.floor(p / 6)) && p % 6 >= 3 ? p - 3 : p];
          if (inkPosition.getComponent(Math.floor(p / 3), p % 3) !== expected) {
            throw new Error(`Ringbahn source line changed outside its receipt in ${descriptor.id}/${family}`);
          }
        }
        vertices += inkPosition.count;
      }
      largest = Math.max(largest, built.geometryBytes);
    } finally { disposeSurroundingCityRoot(built.root); }
  }
  expect(seenTriangles.size).toBe(neukoellnReceipt.records.length);
  expect(seenLines.size).toBe(neukoellnReceipt.lineRecords.length);
  expect(seenNavigation.size).toBe(neukoellnReceipt.navigationRecords.length);
  expect(seenTownhallTriangles.size).toBe(townhallReceipt.records.filter(r => r.tile.startsWith("ring182-")).length);
  expect(seenTownhallLines.size).toBe(townhallReceipt.lineRecords.filter(r => r.tile.startsWith("ring182-")).length);
  expect(seenTownhallNavigation.size).toBe(townhallReceipt.navigationRecords.filter(r => r.tile.startsWith("ring182-")).length);
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
