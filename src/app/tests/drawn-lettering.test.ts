import { describe, expect, test } from "bun:test";

import { letteringLayout } from "../src/drawnLettering";

describe("shared drawn alphabet", () => {
  test("covers every word the scene has to set", () => {
    for (const text of [
      "DEM DEUTSCHEN VOLKE",
      "STARBUCKS",
      "KPMG",
      "DKB",
      "WELT",
      "OGGI",
      "OGGI'S",
      "GEMUESEKEBAB",
      "MUBIS",
      "CITY IMBISS",
      "S15",
      "BERLINER ENSEMBLE",
      "ALBRECHT VON GRAEFE",
      "TAYLOR WESSING",
      "FUNBOX",
      "FUNBOX.COM",
      "TICKETS",
      "GLEISS LUTZ",
      "ICH HABE DEN KRIEG VERHINDERN WOLLEN.",
      "GEORG ELSER, ENDE NOVEMBER 1939",
      "1941",
      "1945",
      "ВЕЧНАЯ СЛАВА",
      "ГЕРОЯМ ПАВШИМ",
      "В БОЯХ С НЕМЕЦКО-",
      "ФАШИСТСКИМИ ЗАХВАТЧИКАМИ",
      "ЗА СВОБОДУ И НЕЗАВИСИМОСТЬ СОВЕТСКОГО СОЮЗА",
    ]) {
      expect(() => letteringLayout(text, 0.5)).not.toThrow();
    }
  });

  test("refuses characters it cannot draw instead of leaving a gap", () => {
    expect(() => letteringLayout("STARBUCKS!", 0.5)).toThrow();
  });

  test("sets STARBUCKS left to right without overlap", () => {
    const layout = letteringLayout("STARBUCKS", 0.42);
    expect(layout.glyphs).toHaveLength(9);
    for (let index = 1; index < layout.glyphs.length; index += 1) {
      const previous = layout.glyphs[index - 1];
      expect(layout.glyphs[index].leftM).toBeGreaterThanOrEqual(
        previous.leftM + previous.advanceM,
      );
    }
    // Nine capitals at 42 cm must still fit a 7 m shopfront fascia.
    expect(layout.totalWidthM).toBeLessThan(7);
  });

  test("scales linearly so a band can be retuned without redrawing", () => {
    const single = letteringLayout("STARBUCKS", 1);
    const double = letteringLayout("STARBUCKS", 2);
    expect(double.totalWidthM).toBeCloseTo(single.totalWidthM * 2, 6);
    expect(double.strokeWidthM).toBeCloseTo(single.strokeWidthM * 2, 6);
  });

  test("lays out the Russian memorial dedication without platform fonts", () => {
    const layout = letteringLayout("ВЕЧНАЯ СЛАВА", 0.21);
    expect(layout.glyphs).toHaveLength(12);
    expect(layout.totalWidthM).toBeGreaterThan(2);
    expect(layout.totalWidthM).toBeLessThan(4);
  });
});
