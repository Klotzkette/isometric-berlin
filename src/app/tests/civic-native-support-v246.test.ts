import { test, expect } from "bun:test";
import { Color, InstancedMesh, Matrix4 } from "three";
import { createCivicPartyDetailsV246 } from "../src/CivicPartyDetailsV246";
import support from "../src/data/civicV246NativeFaces.json";

// Check the constructed render matrices, not the facade sampling algorithm.
test("v246 civic native skins touch real exposed source planes and remain outside retained columns", () => {
  const group = createCivicPartyDetailsV246(true);
  const matrix = new Matrix4(), color = new Color();
  const keys = ["green", "spd", "rosa"] as const;
  const windowColours = [0x92adb0, 0x536e78, 0x91a5a9];
  group.children.forEach((object, site) => {
    const mesh = object as InstancedMesh;
    const source = support[keys[site]];
    let glazing = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); mesh.getColorAt(i, color);
      const e = matrix.elements, x = e[12], y = e[13], z = e[14];
      const w = e[0], h = e[5], d = e[10];
      expect(w).toBe(.5); expect(d).toBe(.5);
      for (const j of [1, 2, 4, 6, 8, 9]) expect(e[j]).toBe(0);
      expect(source.faces.some(([axis, plane, start, end, sign, low, high]) => {
        const depth = axis === 0 ? x : z, along = axis === 0 ? z : x;
        return Math.abs(depth - sign * .25 - plane) < 1e-5 &&
          along - .25 >= start - 1e-5 && along + .25 <= end + 1e-5 &&
          y - h / 2 >= low - 1e-5 && y + h / 2 <= high + 1e-5;
      })).toBe(true);
      if ("columns" in source) for (const [sx, sz, lo, hi] of source.columns) {
        const overlaps = x + .25 > sx + 1e-5 && x - .25 < sx + 4 - 1e-5 &&
          z + .25 > sz + 1e-5 && z - .25 < sz + 4 - 1e-5 &&
          y + h / 2 > lo + 1e-5 && y - h / 2 < hi - 1e-5;
        expect(overlaps).toBe(false);
      }
      if (color.getHex() === windowColours[site]) glazing++;
    }
    expect(glazing).toBeGreaterThan(15);
    mesh.dispose(); mesh.geometry.dispose();
    for (const material of new Set([mesh.userData.dayMaterial, mesh.userData.nightMaterial])) material.dispose();
  });
});
