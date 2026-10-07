import { expect, test } from "bun:test";
import { parkReliefAt } from "../src/parkReliefV182";
import { terrainGroundAt } from "../src/weinbergTerrainV176";

test("official park relief is the same field for navigation and displayed packets", () => {
  expect(parkReliefAt(1000,-3160)).toBeCloseTo(56.44,4);
  expect(terrainGroundAt(1000,-3160)).toBeCloseTo(56.44,4);
  expect(parkReliefAt(576,3506)).toBeGreaterThan(30);
  expect(parkReliefAt(4140,-730)).toBeGreaterThan(40);
  expect(parkReliefAt(0,0,5.2)).toBe(5.2);
  expect(parkReliefAt(1000,-3160,3,true)).toBeCloseTo(parkReliefAt(1002,-3158),5);
});
