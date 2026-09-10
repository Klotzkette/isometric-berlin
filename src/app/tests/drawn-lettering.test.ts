import { describe, expect, test } from "bun:test";
import { LineSegments, Mesh } from "three";

import {
  createLetteringTexture,
  letteringLayout,
  letteringStrokePaths,
} from "../src/drawnLettering";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";

const KULTURFORUM_ENTRANCE_LABELS = [
  "PHILHARMONIE",
  "KAMMERMUSIKSAAL",
  "GEMÄLDEGALERIE",
  "KUNSTGEWERBEMUSEUM",
  "KUNSTBIBLIOTHEK · KUPFERSTICHKABINETT",
];

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
      ...KULTURFORUM_ENTRANCE_LABELS,
      "ÄÖÜ",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789",
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

  test("normalizes decomposed umlauts before layout and stroke drawing", () => {
    const composed = "GEMÄLDEGALERIE · ÖÜ";
    const decomposed = composed.normalize("NFD");
    expect(decomposed).not.toBe(composed);
    expect(letteringLayout(decomposed, 0.5)).toEqual(
      letteringLayout(composed, 0.5),
    );
    expect(letteringStrokePaths(decomposed, 0.5)).toEqual(
      letteringStrokePaths(composed, 0.5),
    );
  });

  test("keeps both umlaut dots visible inside the cap-height texture band", () => {
    const capHeight = 0.5;
    for (const [umlaut, base] of [["Ä", "A"], ["Ö", "O"], ["Ü", "U"]]) {
      const paths = letteringStrokePaths(umlaut, capHeight);
      const basePaths = letteringStrokePaths(base, capHeight);
      const layout = letteringLayout(umlaut, capHeight);
      expect(paths).toHaveLength(basePaths.length + 2);
      expect(layout.totalWidthM).toBeCloseTo(
        letteringLayout(base, capHeight).totalWidthM,
        8,
      );
      for (const [x, y] of paths.flat()) {
        expect(x).toBeGreaterThanOrEqual(-layout.totalWidthM / 2);
        expect(x).toBeLessThanOrEqual(layout.totalWidthM / 2);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(capHeight);
      }
      const bodyTop = Math.max(...paths.slice(0, -2).flat().map(([, y]) => y));
      for (const dot of paths.slice(-2)) {
        expect(Math.min(...dot.map(([, y]) => y))).toBeGreaterThan(bodyTop);
      }
    }
  });

  test("validates texture labels even when headless tests cannot create a canvas", () => {
    expect(typeof document).toBe("undefined");
    const options = {
      bandHeightM: 0.72,
      bandWidthM: 13.5,
      capHeightM: 0.4,
      fieldColor: "#cdb35e",
      letterColor: "#283235",
    };
    for (const text of KULTURFORUM_ENTRANCE_LABELS) {
      expect(createLetteringTexture({ ...options, text })).toBeNull();
    }
    expect(() => createLetteringTexture({ ...options, text: "INVALID!" }))
      .toThrow('The drawn alphabet has no glyph for "!"');
  });

  test("constructs the shipped landmark catalogue with all five Kulturforum signs", async () => {
    const manifest = await Bun.file(
      new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url),
    ).json() as { landmarks: Parameters<typeof createExpandedCityDetails>[0] };
    expect(manifest.landmarks.length).toBeGreaterThan(0);
    for (const detailProfile of ["full", "mobile"] as const) {
      const details = createExpandedCityDetails(manifest.landmarks, { detailProfile });
      try {
        for (const label of KULTURFORUM_ENTRANCE_LABELS) {
          const sign = details.getObjectByName(`${label} entrance lettering`);
          expect(sign).toBeInstanceOf(Mesh);
          expect(sign?.userData.lettering).toBe(label);
          expect(sign?.userData.kulturforumEntrance).toBeTrue();
        }
      } finally {
        details.traverse((object) => {
          if (!(object instanceof Mesh || object instanceof LineSegments)) return;
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            material.dispose();
          }
        });
      }
    }
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
