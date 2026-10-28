import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { InterleavedBufferAttribute, Mesh } from "three";
import { DISTRICT_HOUSE_REGIONS_V225, districtHouseOwnerV225, districtHouseRegionV225, shadeDistrictHousePanesV225 } from "../src/districtHousePresentationV225";
import { DISTRICT_HOUSE_REGIONS_V226, districtHouseOwnerV226, districtHouseRegionV226, shadeDistrictHousePanesV226 } from "../src/districtHousePresentationV226";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { surroundingColourOwners, surroundingGenericColour } from "../src/surroundingCityColourV184";
import { prepareRoofHouseV233, applyRoofHouseV233Triangles } from "../src/roofHouseV233";
import { prepareHouseDoorsV233 } from "../src/houseDoorsV233";
import { prepareCityStreetsV249 } from "../src/CityStreetsV249";
import { prepareNamedSiteV238, applyNamedSiteTrianglesV238, namedSiteNavigationV238 } from "../src/namedSiteReplacementsV238";
import { prepareKreuzbergStreetsV267 } from "../src/KreuzbergStreetsV267";
import { prepareStreetCurvesV276, streetCurveExtraLineVerticesV276 } from "../src/streetCurvesV276";
import { transferSiteTrianglesV209, siteNavigationV209 } from "../src/siteOwnershipV209";
import { replacePanoramaFacadeV202 } from "../src/panoramaFacadeV202";
import { refineOuterHousePaletteV262 } from "../src/outerHousePaletteV262";
import { primaryHousePaletteV273 } from "../src/primaryHousePaletteV273";
import { applyPrimaryColoursV273 } from "../src/primaryColoursV273";
import { applyLegacyHouseMaterialsV273 } from "../src/legacyHouseMaterialsV273";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const packet = (id: string, native: boolean): SurroundingCityChunk => JSON.parse(gunzipSync(readFileSync(new URL(`${id}.${native ? "minecraft" : "drawn"}.json.gz`, directory))).toString());
function finish<T>(steps: Generator<void, T>): T { let next = steps.next(); while (!next.done) next = steps.next(); return next.value; }
const u16 = (text: string) => new Uint16Array(Uint8Array.from(Buffer.from(text, "base64")).buffer);
const u32 = (text: string) => new Uint32Array(Uint8Array.from(Buffer.from(text, "base64")).buffer);
function owners(chunk: SurroundingCityChunk, prior: boolean) {
  return finish(surroundingColourOwners(chunk.nav.buildings, chunk.nav.groundY, chunk.origin[1], chunk.origin[0], chunk.origin[2], prior ? districtHouseOwnerV225 : districtHouseOwnerV226));
}

test("two exact scopes are additive and preserve all five original selection grids", () => {
  expect(DISTRICT_HOUSE_REGIONS_V226.slice(0, 5)).toEqual(DISTRICT_HOUSE_REGIONS_V225);
  expect(DISTRICT_HOUSE_REGIONS_V226.slice(5).map(region => region.name)).toEqual(["Kreuzberg", "Friedrichshain"]);
  expect(districtHouseRegionV226(3331.66, 2087.46)).toBe(5);
  expect(districtHouseRegionV226(5500, 500)).toBe(6);
  expect(districtHouseRegionV225(3331.66, 2087.46)).toBe(-1);
  for (const region of DISTRICT_HOUSE_REGIONS_V225) {
    const grid = region.grid;
    let exact = true;
    for (let i = 0; i < grid.cells.length; i++) {
      const x = (grid.x0 + i % grid.width + 0.5) * grid.size, z = (grid.z0 + Math.floor(i / grid.width) + 0.5) * grid.size;
      const before = districtHouseRegionV225(x, z);
      if (before >= 0 && districtHouseRegionV226(x, z) !== before) exact = false;
    }
    expect(exact).toBeTrue();
  }
  for (const [x, z] of [[1200, 600], [-500, -4000], [9000, 2500]]) expect(districtHouseRegionV226(x, z)).toBe(-1);
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
  expect(districtHouseOwnerV226("ordinary", ring, 3331.66, 2087.46)).toBeTrue();
  expect(districtHouseOwnerV226("ordinary", [[0, 0], [9000, 0], [0, 10]], 3331.66, 2087.46)).toBeFalse();
  expect(districtHouseOwnerV226("DEBE06YYB0000AUq", ring, 3331.66, 2087.46)).toBeFalse();
});

test("actual packets in all prior regions retain every source-owner palette and height", () => {
  for (const id of ["-8_-4", "3_-9", "-5_4", "-10_4", "ring182--8_12"]) for (const native of [false, true]) {
    const source = packet(id, native);
    expect(owners(source, false)).toEqual(owners(source, true));
  }
});

test("real v226 house colours survive the exact later packet refinements in both independent families", () => {
  for (const native of [false, true]) for (const id of ["6_4", "10_0", "district188-6_4", "district188-10_0"]) {
    const source = packet(id, native), original = JSON.stringify(source);
    // These are the later receipts that actually intersect the eight frozen
    // samples: roofs/doors v233, elevated railway v238, street ground v249,
    // Kreuzberg fittings v267 and drawn road crescents v276. The four v188
    // companion packets have none. Keep all original encoded parts and replay
    // the exact registered transfers, never forgive an arbitrary mismatch.
    let prepared = source;
    for (const prepare of [prepareRoofHouseV233, prepareHouseDoorsV233, prepareCityStreetsV249,
      prepareNamedSiteV238, prepareKreuzbergStreetsV267, prepareStreetCurvesV276]) {
      prepared = finish(prepare(prepared, id, native));
    }
    source.meshes.forEach((part, i) => expect(prepared.meshes[i]).toBe(part));
    expect(prepared.meshes.length).toBeLessThanOrEqual(16);
    const built = createSurroundingCityChunk(source, id, native);
    try {
      const mesh = built.root.children[0] as Mesh, geometry = mesh.geometry;
      const values = (geometry.getAttribute("color") as InterleavedBufferAttribute).data.array as Uint16Array;
      const indices = geometry.index!.array;
      const oldOwners = owners(source, true), newOwners = owners(source, false);
      // v262/v273 explicitly supersede fallback paint on primary city packets.
      // The v225/v226 delta is still checked independently below, while this
      // current owner map plus exact material receipts predicts every live cell.
      const currentOwners = finish(surroundingColourOwners(prepared.nav.buildings, prepared.nav.groundY,
        prepared.origin[1], prepared.origin[0], prepared.origin[2], districtHouseOwnerV226,
        false, refineOuterHousePaletteV262(id), refineOuterHousePaletteV262(id) ? primaryHousePaletteV273 : undefined));
      let vertexOffset = 0, indexOffset = 0, changed = 0, geometryExact = true, paintExact = true;
      const scratch: [number, number, number] = [0, 0, 0];
      for (const [meshIndex, part] of prepared.meshes.entries()) {
        const pos = u16(part.positions), sourceIndices = u32(part.indices), color = Buffer.from(part.colors, "base64");
        const before = new Uint16Array(pos.length * 2);
        for (let at = 0; at < pos.length; at += 3) for (let c = 0; c < 3; c++) { before[at * 2 + c] = pos[at + c]; before[at * 2 + c + 3] = color[at + c] * 257; }
        const after = before.slice(), expected = before.slice();
        finish(shadeDistrictHousePanesV225(part.kind, before, sourceIndices, 0, sourceIndices.length, source.origin[0], source.origin[2], native));
        finish(shadeDistrictHousePanesV226(part.kind, after, sourceIndices, 0, sourceIndices.length, source.origin[0], source.origin[2], native));
        for (let at = 0; at < pos.length; at += 3) {
          if (part.kind === "city") {
            const oldColor = surroundingGenericColour(oldOwners, pos[at], pos[at + 2], color[at], color[at + 1], color[at + 2], native ? undefined : pos[at + 1], scratch)?.slice() ?? Array.from(color.slice(at, at + 3));
            const newColor = surroundingGenericColour(newOwners, pos[at], pos[at + 2], color[at], color[at + 1], color[at + 2], native ? undefined : pos[at + 1], scratch) ?? color.subarray(at, at + 3);
            for (let c = 0; c < 3; c++) if (newColor[c] !== oldColor[c]) changed++;
            const liveColor = surroundingGenericColour(currentOwners, pos[at], pos[at + 2], color[at], color[at + 1], color[at + 2], native ? undefined : pos[at + 1], scratch) ?? color.subarray(at, at + 3);
            for (let c = 0; c < 3; c++) expected[at * 2 + 3 + c] = liveColor[c] * 257;
          } else {
            for (let c = 3; c < 6; c++) if (before[at * 2 + c] !== after[at * 2 + c]) changed++;
          }
        }
        finish(applyPrimaryColoursV273(prepared, id, native, meshIndex, expected, 0, pos.length / 3));
        finish(applyLegacyHouseMaterialsV273(id, native, part, meshIndex, expected, 0, pos.length / 3));
        finish(shadeDistrictHousePanesV226(part.kind, expected, sourceIndices, 0, sourceIndices.length, source.origin[0], source.origin[2], native));
        for (let at = 0; at < pos.length; at += 3) {
          const offset = (vertexOffset + at / 3) * 6;
          for (let c = 0; c < 3; c++) {
            if (values[offset + c] !== pos[at + c]) geometryExact = false;
            if (values[offset + 3 + c] !== expected[at * 2 + 3 + c]) paintExact = false;
          }
        }
        const expectedIndices = Uint32Array.from(sourceIndices, value => value + vertexOffset);
        finish(replacePanoramaFacadeV202(id, native, part, expectedIndices, 0));
        finish(transferSiteTrianglesV209(id, native, part, expectedIndices, 0));
        finish(applyRoofHouseV233Triangles(prepared, meshIndex, expectedIndices, 0));
        finish(applyNamedSiteTrianglesV238(prepared, meshIndex, expectedIndices, 0));
        for (let at = 0; at < sourceIndices.length; at++) if (indices[indexOffset + at] !== expectedIndices[at]) geometryExact = false;
        vertexOffset += pos.length / 3; indexOffset += sourceIndices.length;
      }
      expect(changed).toBeGreaterThan(0);
      expect(geometryExact, `${id}:${native}: exact source geometry and receipted transfers`).toBeTrue();
      expect(paintExact, `${id}:${native}: exact v226 plus later source-owned paint`).toBeTrue();
      expect(values.length).toBe(vertexOffset * 6); expect(indices.length).toBe(indexOffset);
      expect(vertexOffset).toBeLessThanOrEqual(400_000); expect(indexOffset).toBeLessThanOrEqual(2_400_000);
      const lines = !native && source.lines?.positions ? source.lines : undefined;
      const lineBytes = lines ? (u16(lines.positions).length / 3 + streetCurveExtraLineVerticesV276(prepared)) * (lines.colors ? 12 : 6) : 0;
      expect(built.geometryBytes).toBe(values.byteLength + indices.byteLength + lineBytes);
      expect(built.bufferCount).toBe(lines ? 3 : 2);
      expect(built.root.children.length).toBe(lines ? 2 : 1);
      expect(built.nav).toEqual(namedSiteNavigationV238(prepared, siteNavigationV209(id, prepared.nav)));
      expect(JSON.stringify(source)).toBe(original);
    } finally { disposeSurroundingCityRoot(built.root); }
  }
});

test("new audit preserves the five old count rows and all prior input receipts", async () => {
  const before = await Bun.file(new URL("../../../geo_data/regierungsviertel/district-houses-v225-audit.json", import.meta.url)).json();
  const after = await Bun.file(new URL("../../../geo_data/regierungsviertel/district-houses-v226-audit.json", import.meta.url)).json();
  expect(after.regions.slice(0, 5)).toEqual(before.regions);
  expect(after.previousInputHashesExact).toBe(before.inputs.length);
  expect(after.inputs.length + before.inputs.length).toBe(after.packets);
  expect(after.regions.slice(5).map((region: { drawnPanes: number; nativePanes: number }) => [region.drawnPanes, region.nativePanes])).toEqual([[28696, 10005], [31336, 8407]]);
});
