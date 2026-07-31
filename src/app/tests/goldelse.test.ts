import { describe, expect, test } from "bun:test";

import {
  createGoldelseFigure,
  GOLDELSE_GOLD,
  GOLDELSE_GOLD_SHADED,
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
      "Goldelse field standard",
      "Goldelse iron cross",
      "Goldelse helmet",
      "Goldelse helmet eagle body",
      "Goldelse wing",
      "Goldelse robe",
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

  test("the wreath she raises is the highest point, above the standard", () => {
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
    expect(topOf("Goldelse laurel wreath")).toBeCloseTo(GOLDELSE_HEIGHT_M, 6);
    expect(topOf("Goldelse iron cross")).toBeLessThan(GOLDELSE_HEIGHT_M);
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
      expect([GOLDELSE_GOLD, GOLDELSE_GOLD_SHADED]).toContain(part.tone);
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
