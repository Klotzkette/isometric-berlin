import { expect, test } from "bun:test";
import { LEIPZIGER_SOURCE_PARTS, LEIPZIGER_SOURCE_PRISM_IDS, LEIPZIGER_SOURCE_PROFILES, leipzigerPartSolidBase } from "../src/leipzigerPlatzSourceProfile";
import { POTSDAMER_MINISTRY_BUILDINGS } from "../src/potsdamerMinistrySourceProfile";
import { POTSDAMER_MINISTRY_REPLACEMENT_IDS } from "../src/potsdamerMinistryProfile";
import { createDistantBuildingShells, PRISM_SUPPRESSED_IDS, type PrismPayload } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";

const buildings = [
  ...LEIPZIGER_SOURCE_PROFILES.flatMap(p => p.previous_display_prisms),
  ...POTSDAMER_MINISTRY_BUILDINGS.flatMap(p => p.previousDisplayPrisms),
] as PrismPayload["buildings"];

test("all replaced source parts remain present in pedestrian geometry with their exact footprints", () => {
  const index = compilePedestrianObstacles({ buildings });
  const unique = new Set([...index.cells.values()].flat());
  expect(index.buildingCount).toBe(LEIPZIGER_SOURCE_PARTS.length + POTSDAMER_MINISTRY_REPLACEMENT_IDS.size);
  for (const part of [...LEIPZIGER_SOURCE_PARTS, ...POTSDAMER_MINISTRY_BUILDINGS.flatMap(b => b.officialParts)]) {
    const obstacle = [...unique].find(o => o.sourceId === part.id);
    expect(obstacle?.kind).toBe("polygon");
    if (obstacle?.kind !== "polygon") throw new Error(part.id);
    expect(obstacle.coordinateScale).toBe(1);
    expect(obstacle.ring).toEqual(part.ring);
    expect(obstacle.holes).toEqual(part.holes);
  }
  for (const id of [...LEIPZIGER_SOURCE_PRISM_IDS, ...POTSDAMER_MINISTRY_REPLACEMENT_IDS]) {
    expect(PRISM_SUPPRESSED_IDS.has(id)).toBeTrue();
  }
});

test("Mall's glass-covered Piazza stays traversable without changing its measured roof", () => {
  const index = compilePedestrianObstacles({ buildings });
  for (const [x,z] of [[631.15,925],[633.51,953.6],[635.86,983]]) {
    expect(pedestrianPointIsBlocked(x,z,5.4,index)).toBeFalse();
  }
  const canopy = LEIPZIGER_SOURCE_PARTS.find(p => p.id === "DEBE00YY1mc0004E")!;
  expect(leipzigerPartSolidBase(canopy)).toBeGreaterThan(21);
  expect(canopy.surfaces.some(s => s.kind === "WallSurface")).toBeTrue(); // Raw evidence is not erased.
  const roofOnly = LEIPZIGER_SOURCE_PARTS.find(p => p.id === "DEBE3DP5ii5cXk3Q")!;
  expect(leipzigerPartSolidBase(roofOnly)).toBeGreaterThan(roofOnly.ground_y_m+2);
});

test("distant and streaming fallback cannot cover replacement roofs or passages with old caps", () => {
  const payload = { classes: ["concrete"], buildings } as PrismPayload;
  const coverage = createDistantBuildingShells(payload, buildings);
  expect(coverage.userData.sourceBuildingCount).toBe(buildings.length);
  expect(coverage.userData.visibleBuildingCount).toBe(0);
  expect(coverage.children).toHaveLength(0);
});
