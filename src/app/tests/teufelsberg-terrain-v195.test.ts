import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import field from "../src/data/teufelsbergTerrainV195.json";
import { grunewaldTerrainOffset } from "../src/grunewaldTerrainV190";
import { teufelsbergTerrainOffsetV195 } from "../src/teufelsbergTerrainV195";
import { olympicTerrainOffsetV201 } from "../src/olympicTerrainV201";
import { terrainGroundAt } from "../src/weinbergTerrainV176";

test("the earlier measured field retains its independent v1.0.94 hash", () => {
  const bytes = readFileSync(new URL("../src/data/grunewaldTerrainV190.json", import.meta.url));
  expect(createHash("sha256").update(bytes).digest("hex"))
    .toBe("7e18c957243303e8c1ece2c990ed119192182164efa1c5b9fbe6f52b320d4902");
});

test("the existing walking-height entry point resolves the measured summit and label separately", () => {
  expect(terrainGroundAt(-8783, 2157)).toBeCloseTo(90.07, 8);
  expect(terrainGroundAt(-8783, 2157) + 30).toBeCloseTo(120.07, 8);
  expect(terrainGroundAt(-8775.006918908737, 2150.707746723667) + 30)
    .toBeCloseTo(114.4961, 4);
  expect(terrainGroundAt(-8432, 1672) + 30).toBeCloseTo(98.72, 8);
  expect(terrainGroundAt(-8403.524021575635, 1642.2394943060353) + 30)
    .toBeCloseTo(98.5492, 4);
  expect(terrainGroundAt(-8783, 2157, 3.12) - terrainGroundAt(-8783, 2157))
    .toBeCloseTo(0.12, 10);
});

test("both grid resolutions use the same two planar triangles as prepared terrain", () => {
  expect(field.profiles.map(p => p.stepM)).toEqual([8, 1]);
  for (const [profile, ix, iz] of [
    [field.profiles[0], 103, 51],
    [field.profiles[1], 17, 17],
  ] as const) {
    const [west, north] = profile.support, step = profile.stepM;
    for (const corners of [[[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]]]) {
      const x = west + (ix + corners.reduce((sum, c) => sum + c[0], 0) / 3) * step;
      const z = north + (iz + corners.reduce((sum, c) => sum + c[1], 0) / 3) * step;
      const expected = corners.reduce((sum, [dx, dz]) => sum + profile.offsets[iz + dz][ix + dx], 0) / 3;
      expect(teufelsbergTerrainOffsetV195(x, z)).toBeCloseTo(expected, 8);
      expect(terrainGroundAt(x, z)).toBeCloseTo(3 + expected, 8);
    }
  }
});

test("the outer apron and tiny crest join continuously on every boundary interval", () => {
  for (const profile of field.profiles) {
    const [w, n, e, s] = profile.support, step = profile.stepM;
    for (const [axis, edge, start, end] of [
      [0, w, n, s], [0, e, n, s], [1, n, w, e], [1, s, w, e],
    ]) {
      for (let position = start; position < end; position += step) {
        for (const fraction of [0, 0.37, 0.79]) {
          const x = axis === 0 ? edge : position + fraction * step;
          const z = axis === 1 ? edge : position + fraction * step;
          const boundary = terrainGroundAt(x, z);
          const insideX = Math.min(e - 1e-6, Math.max(w + 1e-6, x));
          const insideZ = Math.min(s - 1e-6, Math.max(n + 1e-6, z));
          expect(Math.abs(terrainGroundAt(insideX, insideZ) - boundary)).toBeLessThan(0.0001);
          if (profile === field.profiles[0]) expect(teufelsbergTerrainOffsetV195(x, z)).toBeNull();
        }
      }
    }
  }
});

test("native terrain remains flat within fixed eight metre cells including the crest", () => {
  for (const [x, z] of [[-8788, 2156], [-8404, 1644], [-9244, 1252], [-7940, 2684]]) {
    const height = terrainGroundAt(x, z);
    for (const dx of [-3.999, 0, 3.999]) {
      for (const dz of [-3.999, 0, 3.999]) {
        expect(terrainGroundAt(x + dx, z + dz, 3, true)).toBe(height);
      }
    }
  }
  expect(terrainGroundAt(-8783, 2157, 3, true) + 30).toBeCloseTo(118.79, 8);
  expect(terrainGroundAt(-8784.001, 2157, 3, true))
    .not.toBe(terrainGroundAt(-8783.999, 2157, 3, true));
});

test("outside the local support earlier terrain and unrelated walking datums remain unchanged", () => {
  for (const [x, z, drawn, native] of [
    [-11966.52, 4245.25, 44.995675, 45.065],
    [-6700, 5626, 14.593125, 14.77],
    [-9456, 2088, 0.1625, 0.38125],
    [-7740, 1780, 0.0325, 0.0325],
    [-8620, 1120, 0, 0],
    [-8350, 2784, 18.90625, 18.89],
    [0, 0, 0, 0],
  ]) {
    expect(teufelsbergTerrainOffsetV195(x, z)).toBeNull();
    expect(grunewaldTerrainOffset(x, z)).toBeCloseTo(drawn, 8);
    // v201 explicitly refines the Olympic apron at the one northern checkpoint;
    // the old Grunewald field itself remains pinned to its independent values.
    expect(terrainGroundAt(x, z)).toBeCloseTo(3 + (olympicTerrainOffsetV201(x,z) ?? drawn), 8);
    expect(terrainGroundAt(x, z, 3, true)).toBeCloseTo(3 + (olympicTerrainOffsetV201(x,z,true) ?? native), 8);
  }
  expect(terrainGroundAt(2132.98, -1408.45)).toBe(12.4);
  expect(terrainGroundAt(0, 0, 5.245)).toBe(5.245);
});
