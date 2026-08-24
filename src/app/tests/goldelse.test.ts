import { describe, expect, test } from "bun:test";

import {
  createGoldelseFigure,
  GOLDELSE_GOLD_DEEP,
  GOLDELSE_GOLD,
  GOLDELSE_GOLD_HIGHLIGHT,
  GOLDELSE_GOLD_SHADED,
  GOLDELSE_GOLD_TONES,
  GOLDELSE_HEIGHT_M,
} from "../src/goldelse";

const AT_ORIGIN = { base: [0, 0, 0] as [number, number, number] };

function partNames(facing: [number, number] = [1, 0]): string[] {
  return createGoldelseFigure({ ...AT_ORIGIN, facing }).parts.map(
    (part) => part.name,
  );
}

describe("Goldelse figure", () => {
  test("stands exactly the published 8.32 m tall", () => {
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    expect(GOLDELSE_HEIGHT_M).toBe(8.32);
    expect(figure.heightM).toBeCloseTo(GOLDELSE_HEIGHT_M, 6);
  });

  test("carries every documented attribute", () => {
    const names = partNames();
    // "Sie hält in der Rechten einen Lorbeerkranz in die Höhe, in der Linken
    // ein Feldzeichen mit dem Eisernen Kreuz. Auf ihrem Helm sitzt ein Adler."
    for (const attribute of [
      "Goldelse laurel wreath",
      "Goldelse individual laurel leaves",
      "Goldelse field standard",
      "Goldelse standard ring",
      "Goldelse iron cross",
      "Goldelse field standard finial",
      "Goldelse field standard ribbons",
      "Goldelse helmet",
      "Goldelse helmet eagle body",
      "Goldelse wing",
      "Goldelse primary wing feathers",
      "Goldelse secondary wing feathers",
      "Goldelse robe",
      "Goldelse 0.92 m shoe",
    ]) {
      expect(names).toContain(attribute);
    }
  });

  test("has two spread wings, not one", () => {
    expect(partNames().filter((name) => name === "Goldelse wing")).toHaveLength(
      2,
    );
  });

  test("wings are mirror images across the figure's centre plane", () => {
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    const wings = figure.parts.filter((part) => part.name === "Goldelse wing");
    const spanOf = (triangles: Float32Array): [number, number] => {
      let min = Infinity;
      let max = -Infinity;
      for (let index = 2; index < triangles.length; index += 3) {
        min = Math.min(min, triangles[index]);
        max = Math.max(max, triangles[index]);
      }
      return [min, max];
    };
    const [leftMin, leftMax] = spanOf(wings[0].triangles);
    const [rightMin, rightMax] = spanOf(wings[1].triangles);
    expect(leftMin).toBeCloseTo(-rightMax, 6);
    expect(leftMax).toBeCloseTo(-rightMin, 6);
    // Both wings actually reach out to the side rather than hugging the body.
    expect(Math.max(leftMax, rightMax)).toBeGreaterThan(2.5);
  });

  test("the photographed standard finial is the 8.32 m crown above the wreath", () => {
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    const topOf = (name: string): number => {
      let top = -Infinity;
      for (const part of figure.parts.filter((entry) => entry.name === name)) {
        for (let index = 1; index < part.triangles.length; index += 3) {
          top = Math.max(top, part.triangles[index]);
        }
      }
      return top;
    };
    expect(topOf("Goldelse field standard finial")).toBeCloseTo(
      GOLDELSE_HEIGHT_M,
      6,
    );
    expect(topOf("Goldelse laurel wreath")).toBeGreaterThan(7.6);
    expect(topOf("Goldelse laurel wreath")).toBeLessThan(
      topOf("Goldelse field standard finial"),
    );
    expect(topOf("Goldelse standard ring")).toBeLessThan(
      GOLDELSE_HEIGHT_M,
    );
  });

  test("carries layered feather, laurel, ribbon and robe-fold recognition geometry", () => {
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    expect(figure.metrics).toEqual({
      laurelLeafCount: 20,
      primaryFeathersPerWing: 10,
      robeFoldCount: 7,
      secondaryFeathersPerWing: 8,
      standardRibbonCount: 3,
    });
    expect(
      figure.parts.filter(
        (part) => part.name === "Goldelse primary wing feathers",
      ),
    ).toHaveLength(4);
    expect(
      figure.parts.filter(
        (part) => part.name === "Goldelse secondary wing feathers",
      ),
    ).toHaveLength(2);
    expect(
      figure.parts.find(
        (part) => part.name === "Goldelse individual laurel leaves",
      )!.triangles.length,
    ).toBeGreaterThan(600);
  });

  test("keeps the detailed figure inside one small merged-scene budget", () => {
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    const vertexCount = figure.parts.reduce(
      (total, part) => total + part.triangles.length / 3,
      0,
    );
    expect(figure.parts.length).toBeLessThanOrEqual(48);
    expect(vertexCount).toBeLessThanOrEqual(8_000);
    expect(figure.inkSegments.length / 6).toBeLessThanOrEqual(90);
    for (const name of [
      "Goldelse primary wing feathers",
      "Goldelse secondary wing feathers",
      "Goldelse layered wing coverts",
      "Goldelse individual laurel leaves",
      "Goldelse iron cross",
    ]) {
      expect(
        figure.parts
          .filter((part) => part.name === name)
          .every((part) => part.inked === false),
      ).toBe(true);
    }
  });

  test("uses bright leaf-gold highlights with deep fold separation", () => {
    expect(GOLDELSE_GOLD_TONES).toEqual([
      GOLDELSE_GOLD,
      GOLDELSE_GOLD_HIGHLIGHT,
      GOLDELSE_GOLD_SHADED,
      GOLDELSE_GOLD_DEEP,
    ]);
    const channels = (tone: number): [number, number, number] => [
      (tone >> 16) & 0xff,
      (tone >> 8) & 0xff,
      tone & 0xff,
    ];
    const brightness = (tone: number): number => {
      const [red, green, blue] = channels(tone);
      return red * 0.2126 + green * 0.7152 + blue * 0.0722;
    };
    expect(channels(GOLDELSE_GOLD)[0]).toBe(255);
    expect(channels(GOLDELSE_GOLD)[1]).toBeGreaterThanOrEqual(200);
    expect(brightness(GOLDELSE_GOLD_HIGHLIGHT)).toBeGreaterThan(
      brightness(GOLDELSE_GOLD),
    );
    expect(brightness(GOLDELSE_GOLD_SHADED)).toBeGreaterThan(
      brightness(GOLDELSE_GOLD_DEEP),
    );
  });

  test("retains Drake's documented 0.92 m shoe length", () => {
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    const shoe = figure.parts.find(
      (part) => part.name === "Goldelse 0.92 m shoe",
    )!;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let index = 0; index < shoe.triangles.length; index += 3) {
      minX = Math.min(minX, shoe.triangles[index]);
      maxX = Math.max(maxX, shoe.triangles[index]);
    }
    expect(maxX - minX).toBeCloseTo(0.92, 6);
  });

  test("faces the given axis, with the wreath on her right", () => {
    // Facing world +x: her own left is world -z, so the standard sits at -z
    // and the raised wreath at +z.
    const figure = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    const centreZ = (name: string): number => {
      let sum = 0;
      let count = 0;
      for (const part of figure.parts.filter((entry) => entry.name === name)) {
        for (let index = 2; index < part.triangles.length; index += 3) {
          sum += part.triangles[index];
          count += 1;
        }
      }
      return sum / count;
    };
    expect(centreZ("Goldelse field standard")).toBeLessThan(-0.5);
    expect(centreZ("Goldelse laurel wreath")).toBeGreaterThan(0.5);
  });

  test("rotating the facing rotates the whole figure rigidly", () => {
    const east = createGoldelseFigure({ ...AT_ORIGIN, facing: [1, 0] });
    const north = createGoldelseFigure({ ...AT_ORIGIN, facing: [0, 1] });
    const radius = (part: { triangles: Float32Array }): number => {
      let max = 0;
      for (let index = 0; index < part.triangles.length; index += 3) {
        max = Math.max(
          max,
          Math.hypot(part.triangles[index], part.triangles[index + 2]),
        );
      }
      return max;
    };
    expect(east.parts).toHaveLength(north.parts.length);
    east.parts.forEach((part, index) => {
      expect(radius(part)).toBeCloseTo(radius(north.parts[index]), 6);
    });
  });

  test("sits on its base and emits only finite gilded geometry", () => {
    const figure = createGoldelseFigure({
      base: [412, 33.5, -98],
      facing: [0.6, -0.8],
    });
    let lowest = Infinity;
    for (const part of figure.parts) {
      expect(GOLDELSE_GOLD_TONES).toContain(part.tone);
      expect(part.triangles.length % 9).toBe(0);
      for (const value of part.triangles) {
        expect(Number.isFinite(value)).toBe(true);
      }
      for (let index = 1; index < part.triangles.length; index += 3) {
        lowest = Math.min(lowest, part.triangles[index]);
      }
    }
    expect(lowest).toBeCloseTo(33.5, 6);
    expect(figure.inkSegments.length % 6).toBe(0);
    expect(figure.inkSegments.every(Number.isFinite)).toBe(true);
  });
});
