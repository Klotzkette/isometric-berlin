import { describe, expect, test } from "bun:test";
import source from "../src/data/mitteHeritageV166Source.json";
import {
  separateWeinbergPitchRowV255,
  separateWeinbergPitchSheetV255,
  WEINBERG_PITCH_SEPARATION_V255,
} from "../src/weinbergPlaygroundLayersV255";
import { drapeTerrainTriangle } from "../src/weinbergTerrainV176";
import { nativeTerrainGroundRows } from "../src/weinbergLocalModelTerrainV176";

describe("Weinberg's preserved playground and pitch display layers", () => {
  test("separates exactly four pitch sheets without cutting source geometry or changing relief", () => {
    let changed = 0;
    for (const sheet of source.groundSurfaces) {
      const next = separateWeinbergPitchSheetV255(sheet);
      if (next === sheet) continue;
      changed++;
      expect(next.kind).toBe("pitch");
      expect(next.triangles.length).toBe(sheet.triangles.length);
      const before = sheet.triangles.flatMap(drapeTerrainTriangle);
      const after = next.triangles.flatMap(drapeTerrainTriangle);
      expect(after.length).toBe(before.length);
      after.forEach((t, i) => t.forEach((p, j) => {
        expect(p[0]).toBe(before[i][j][0]);
        expect(p[2]).toBe(before[i][j][2]);
        expect(p[1] - before[i][j][1]).toBeCloseTo(WEINBERG_PITCH_SEPARATION_V255, 10);
      }));
    }
    expect(changed).toBe(4);
  });

  test("separates exactly 47 native pitch runs while preserving every cell, colour and dimension", () => {
    let changed = 0;
    for (const row of source.groundRuns) {
      const next = separateWeinbergPitchRowV255(row);
      if (next === row) continue;
      changed++;
      expect(next.filter((_, i) => i !== 1)).toEqual(row.filter((_, i) => i !== 1));
      const before = nativeTerrainGroundRows([row]);
      const after = nativeTerrainGroundRows([next]);
      expect(after.length).toBe(before.length);
      after.forEach((r, i) => {
        expect(r.filter((_, j) => j !== 1)).toEqual(before[i].filter((_, j) => j !== 1));
        expect(r[1] - before[i][1]).toBeCloseTo(WEINBERG_PITCH_SEPARATION_V255, 10);
      });
    }
    expect(changed).toBe(47);
  });
});
