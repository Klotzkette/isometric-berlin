import { expect, test } from "bun:test";
import { createDistantBuildingShells } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import { disposeSurroundingCityRoot as disposeObject3D } from "../src/SurroundingCity";
import receipt from "../src/data/aegCampusV241CorePrevious.json";

const originals = receipt.owners.map(owner => owner.prism);

test("AEG replacement is opt-in and leaves changed and unrelated distant source owners intact", () => {
  const changed = { ...originals[0], h_dm: originals[0].h_dm + 1 };
  const unrelated = { ...originals[1], id: "unrelated-v241" };
  const payload = { buildings: [...originals, changed, unrelated], schema_version: 1, classes: [] };
  const before = JSON.stringify(payload);
  const legacy = createDistantBuildingShells(payload, payload.buildings);
  const refined = createDistantBuildingShells(payload, payload.buildings, { architectureV241: true });
  try {
    expect(legacy.userData.visibleBuildingCount).toBe(originals.length + 2);
    expect(refined.userData.visibleBuildingCount).toBe(2);
    expect(JSON.stringify(payload)).toBe(before);
  } finally { disposeObject3D(legacy); disposeObject3D(refined); }
});

test("walking removes only the six exact old AEG obstacles when new campus collision is enabled", () => {
  const changed = { ...originals[0], h_dm: originals[0].h_dm + 1 };
  const source = { buildings: [...originals, changed] };
  const legacy = compilePedestrianObstacles(source);
  const refined = compilePedestrianObstacles(source, () => "day", { replaceAEGCampusPrisms: true });
  expect(legacy.buildingCount - refined.buildingCount).toBe(originals.length);
  expect(refined.buildingCount).toBe(1);
});
