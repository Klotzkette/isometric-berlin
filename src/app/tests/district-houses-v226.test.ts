import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { InterleavedBufferAttribute, Mesh } from "three";
import { DISTRICT_HOUSE_REGIONS_V225, districtHouseOwnerV225, districtHouseRegionV225, shadeDistrictHousePanesV225 } from "../src/districtHousePresentationV225";
import { DISTRICT_HOUSE_REGIONS_V226, districtHouseOwnerV226, districtHouseRegionV226, shadeDistrictHousePanesV226 } from "../src/districtHousePresentationV226";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { surroundingColourOwners, surroundingGenericColour } from "../src/surroundingCityColourV184";

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

test("real Kreuzberg and Friedrichshain packets change only existing colours in both independent families", () => {
  for (const native of [false, true]) for (const id of ["6_4", "10_0", "district188-6_4", "district188-10_0"]) {
    const source = packet(id, native), original = JSON.stringify(source);
    const built = createSurroundingCityChunk(source, id, native);
    try {
      const mesh = built.root.children[0] as Mesh, geometry = mesh.geometry;
      const values = (geometry.getAttribute("color") as InterleavedBufferAttribute).data.array as Uint16Array;
      const indices = geometry.index!.array;
      const oldOwners = owners(source, true), newOwners = owners(source, false);
      let vertexOffset = 0, indexOffset = 0, changed = 0, geometryExact = true, paintExact = true;
      const scratch: [number, number, number] = [0, 0, 0];
      for (const part of source.meshes) {
        const pos = u16(part.positions), sourceIndices = u32(part.indices), color = Buffer.from(part.colors, "base64");
        const before = new Uint16Array(pos.length * 2);
        for (let at = 0; at < pos.length; at += 3) for (let c = 0; c < 3; c++) { before[at * 2 + c] = pos[at + c]; before[at * 2 + c + 3] = color[at + c] * 257; }
        const after = before.slice();
        finish(shadeDistrictHousePanesV225(part.kind, before, sourceIndices, 0, sourceIndices.length, source.origin[0], source.origin[2], native));
        finish(shadeDistrictHousePanesV226(part.kind, after, sourceIndices, 0, sourceIndices.length, source.origin[0], source.origin[2], native));
        for (let at = 0; at < pos.length; at += 3) {
          const offset = (vertexOffset + at / 3) * 6;
          for (let c = 0; c < 3; c++) if (values[offset + c] !== pos[at + c]) geometryExact = false;
          if (part.kind === "city") {
            const oldColor = surroundingGenericColour(oldOwners, pos[at], pos[at + 2], color[at], color[at + 1], color[at + 2], native ? undefined : pos[at + 1], scratch)?.slice() ?? Array.from(color.slice(at, at + 3));
            const newColor = surroundingGenericColour(newOwners, pos[at], pos[at + 2], color[at], color[at + 1], color[at + 2], native ? undefined : pos[at + 1], scratch) ?? color.subarray(at, at + 3);
            for (let c = 0; c < 3; c++) { if (newColor[c] !== oldColor[c]) changed++; if (values[offset + 3 + c] !== newColor[c] * 257) paintExact = false; }
          } else {
            for (let c = 3; c < 6; c++) { if (before[at * 2 + c] !== after[at * 2 + c]) changed++; if (values[offset + c] !== after[at * 2 + c]) paintExact = false; }
          }
        }
        for (let at = 0; at < sourceIndices.length; at++) if (indices[indexOffset + at] !== sourceIndices[at] + vertexOffset) geometryExact = false;
        vertexOffset += pos.length / 3; indexOffset += sourceIndices.length;
      }
      expect(changed).toBeGreaterThan(0);
      expect(geometryExact).toBeTrue(); expect(paintExact).toBeTrue();
      expect(values.length).toBe(vertexOffset * 6); expect(indices.length).toBe(indexOffset);
      const lines = !native && source.lines?.positions ? source.lines : undefined;
      const lineBytes = lines ? u16(lines.positions).byteLength * (lines.colors ? 2 : 1) : 0;
      expect(built.geometryBytes).toBe(values.byteLength + indices.byteLength + lineBytes);
      expect(built.bufferCount).toBe(lines ? 3 : 2);
      expect(built.root.children.length).toBe(lines ? 2 : 1);
      expect(built.nav).toBe(source.nav); expect(JSON.stringify(source)).toBe(original);
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
