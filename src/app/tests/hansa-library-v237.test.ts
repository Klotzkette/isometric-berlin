import { expect, test } from "bun:test";
import source from "../src/data/hansaLibraryV237.json";
import { HANSA_LIBRARY_PRISM_IDS_V237, hansaLibraryPartForPrismV237,
  hansaLibraryRoofAtV237, isHansaLibraryReplacementColumnV237 } from "../src/hansaLibraryV237Profile";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";

test("library correction retires only its four exact old owners", () => {
  expect([...HANSA_LIBRARY_PRISM_IDS_V237]).toEqual(["UfOiMKPI", "5yW3Z2oo", "Ldcl7dCO", "RRTGvA3Y"]);
  expect(source.previousPrisms.map(p => p.id)).toEqual([...HANSA_LIBRARY_PRISM_IDS_V237]);
  expect(hansaLibraryPartForPrismV237("unrelated")).toBeUndefined();
  expect(isHansaLibraryReplacementColumnV237(-1953.5, 155.6)).toBeFalse();
  expect(isHansaLibraryReplacementColumnV237(-2014.4, -23)).toBeFalse();
  expect(isHansaLibraryReplacementColumnV237(-1975, 155)).toBeFalse();
});

test("walking uses the same measured wings while keeping the courtyard open", () => {
  const index = compilePedestrianObstacles({ buildings: source.previousPrisms } as PrismPayload);
  expect(pedestrianPointIsBlocked(-1953.5, 155.6, 5.2, index)).toBeFalse();
  expect(pedestrianPointIsBlocked(-1953.5, 155.6, 8, index)).toBeFalse();
  for (const part of source.parts) {
    const x = part.ring.reduce((sum, p) => sum + p[0], 0) / part.ring.length;
    const z = part.ring.reduce((sum, p) => sum + p[1], 0) / part.ring.length;
    expect(pedestrianPointIsBlocked(x, z, 5.3, index)).toBeTrue();
    expect(isHansaLibraryReplacementColumnV237(x, z)).toBeTrue();
    const roof = hansaLibraryRoofAtV237(part, x, z);
    expect(roof).not.toBeNull();
    expect(roof!).toBeGreaterThan(8.9);
    expect(roof!).toBeLessThanOrEqual(part.topY + 1e-6);
    expect(hansaLibraryRoofAtV237(part, -1953.5, 155.6)).toBeNull();
  }
});
