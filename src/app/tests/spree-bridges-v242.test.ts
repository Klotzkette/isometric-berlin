import { describe, expect, test } from "bun:test";
import { transformLosslessJsonData } from "../losslessJsonData";
import { spreeBridgeFloorAtV242, spreeBridgeSolidAtV242 } from "../src/SpreeBridgesV242";
import type { SurroundingNavigation, SurroundingPolygon } from "../src/SurroundingCityGeometry";

const rectangle = (a: number, b: number, c: number, d: number): SurroundingPolygon => ({
  ring: [[a, b], [c, b], [c, d], [a, d], [a, b]], holes: [],
});
const nav: SurroundingNavigation = {
  ground: [], water: [], roads: [], buildings: [], bridges: [], groundY: 3,
  spreeBridgesV242: {
    floors: [{ ...rectangle(0, 0, 20, 8), y: 3.14 }, { ...rectangle(0, 0, 20, 2), y: 3.28 },
      { ...rectangle(0, 1.9, 20, 2.1), y: 3.3 }],
    solids: [{ ...rectangle(0, 0, 20, 0.1), low: 3.28, high: 4.41 }],
  },
};

describe("resident mapped Spree bridge navigation", () => {
  test("tracks actual deck, sidewalk and curb heights without blocking open approaches", () => {
    expect(spreeBridgeFloorAtV242(nav, 10, 4)).toBe(3.14);
    expect(spreeBridgeFloorAtV242(nav, 10, 1)).toBe(3.28);
    expect(spreeBridgeFloorAtV242(nav, 10, 2)).toBe(3.3);
    expect(spreeBridgeFloorAtV242(nav, 21, 4)).toBeNull();
    expect(spreeBridgeSolidAtV242(nav, 10, 4, 0.05)).toBe(true);
    expect(spreeBridgeSolidAtV242(nav, 10, 2, 0.05)).toBe(false);
    expect(spreeBridgeSolidAtV242(nav, 10, 5, 0.05)).toBe(false);
    expect(spreeBridgeSolidAtV242(nav, 10, 4, 0.3, 0.25)).toBe(true);
    expect(spreeBridgeSolidAtV242(nav, 0.01, 4, 4, 0.3)).toBe(false);
    expect(spreeBridgeFloorAtV242(nav, NaN, 0)).toBeNull();
    expect(spreeBridgeSolidAtV242(nav, 10, 4, 0, NaN)).toBe(false);
  });

  test("preserves source holes and releases navigation with its owning packet", () => {
    const polygon = { ...rectangle(0, 0, 20, 8), holes: [rectangle(8, 2, 12, 6).ring], y: 3.14 };
    const local = { ...nav, spreeBridgesV242: { floors: [polygon], solids: [] } };
    expect(spreeBridgeFloorAtV242(local, 10, 4)).toBeNull();
    expect(spreeBridgeFloorAtV242(local, 5, 4)).toBe(3.14);
    expect(spreeBridgeFloorAtV242({ ...nav, spreeBridgesV242: undefined }, 5, 4)).toBeNull();
  });

  test("core mesh constructor input uses the existing weak lossless cache", () => {
    const source = JSON.stringify({ schemaVersion: 1, core: { drawn: [{ owner: "1", meshes: ["all-data"] }], minecraft: [] } });
    const compiled = transformLosslessJsonData(source, "/project/src/app/src/data/spreeBridgesV242.json", 4)!;
    expect(compiled.code).toContain('get ["core"]');
    expect(compiled.code).toContain("new WeakRef(value)");
  });
});
