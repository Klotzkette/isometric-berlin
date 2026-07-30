import { describe, expect, test } from "bun:test";

import {
  DEDICATION_CAP_HEIGHT_M,
  dedicationLayout,
  REICHSTAG_DEDICATION,
} from "../src/reichstagInscription";

describe("Reichstag west architrave dedication", () => {
  test("spells the bronze dedication exactly", () => {
    expect(REICHSTAG_DEDICATION).toBe("DEM DEUTSCHEN VOLKE");
  });

  test("has a drawn glyph for every character it must set", () => {
    expect(() => dedicationLayout()).not.toThrow();
  });

  test("refuses characters the drawn alphabet does not cover", () => {
    expect(() => dedicationLayout("DEM DEUTSCHEN VOLKE!")).toThrow();
  });

  test("keeps the real bronze capitals' height", () => {
    // Peter Behrens' letters stand about 60 cm tall on the architrave.
    expect(DEDICATION_CAP_HEIGHT_M).toBeGreaterThan(0.5);
    expect(DEDICATION_CAP_HEIGHT_M).toBeLessThan(0.75);
  });

  test("lays the line out left to right without overlap", () => {
    const layout = dedicationLayout();
    expect(layout.glyphs).toHaveLength(REICHSTAG_DEDICATION.length);
    for (let index = 1; index < layout.glyphs.length; index += 1) {
      const previous = layout.glyphs[index - 1];
      const current = layout.glyphs[index];
      expect(current.leftM).toBeGreaterThanOrEqual(
        previous.leftM + previous.advanceM,
      );
    }
    const last = layout.glyphs[layout.glyphs.length - 1];
    expect(layout.totalWidthM).toBeCloseTo(last.leftM + last.advanceM, 6);
  });

  test("fits the architrave band above the six portico columns", () => {
    // The columns span 35 m of the 41 m entablature; the line must sit inside
    // the 26 m band the model draws on that architrave.
    expect(dedicationLayout().totalWidthM).toBeLessThan(26);
    expect(dedicationLayout().totalWidthM).toBeGreaterThan(12);
  });

  test("scales linearly, so the band can be retuned without redrawing", () => {
    const single = dedicationLayout(REICHSTAG_DEDICATION, 1);
    const double = dedicationLayout(REICHSTAG_DEDICATION, 2);
    expect(double.totalWidthM).toBeCloseTo(single.totalWidthM * 2, 6);
    expect(double.strokeWidthM).toBeCloseTo(single.strokeWidthM * 2, 6);
  });

  test("keeps the strokes hairline-thin relative to the cap height", () => {
    const layout = dedicationLayout();
    expect(layout.strokeWidthM).toBeLessThan(layout.capHeightM * 0.2);
  });
});
