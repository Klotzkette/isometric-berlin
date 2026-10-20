import { describe, expect, test } from "bun:test";
import { appendKulturbrauereiV252 } from "../src/KulturbrauereiV252";
import data from "../src/data/kulturbrauereiV252.json";

describe("Kulturbrauerei and named northern fronts v252", () => {
  for (const native of [false, true]) test(`bounded additive rows, native=${native}`, () => {
    const rows: number[][] = [[123]];
    appendKulturbrauereiV252(rows, native);
    expect(rows[0]).toEqual([123]);
    expect(rows.length - 1).toBe(native ? 6518 : 6236);
    expect((rows.length - 1) * 76).toBeLessThan(500_000);
    for (const row of rows.slice(1)) {
      expect(row).toHaveLength(native ? 7 : 8);
      expect(row.every(Number.isFinite)).toBe(true);
      expect(row.slice(3, 6).every(v => v > 0)).toBe(true);
      expect(row[0]).toBeGreaterThan(2100);
      expect(row[0]).toBeLessThan(3750);
      expect(row[2]).toBeGreaterThan(-2500);
      expect(row[2]).toBeLessThan(-1750);
    }
    const repeat: number[][] = [];
    appendKulturbrauereiV252(repeat, native);
    expect(repeat).toEqual(rows.slice(1));
  });
  test("native ordinary walls use independent axis-aligned source spans", () => {
    expect(data.native.length).toBeGreaterThan(data.drawn.length);
    for (const f of data.native) {
      expect(f.a[0] === f.b[0] || f.a[1] === f.b[1]).toBe(true);
      expect(Math.abs(f.n[0]) === 1 || Math.abs(f.n[1]) === 1).toBe(true);
    }
    expect(data.counts.drawnRetainedWindows).toBe(560);
    expect(data.counts.nativeRetainedWindows).toBe(413);
  });
});
