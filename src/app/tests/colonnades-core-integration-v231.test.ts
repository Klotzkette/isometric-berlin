import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Group } from "three";
import receipt from "../src/data/colonnadesCorePreviousV231.json";
import { createIsometricCityCore, createDistantBuildingShells, type PrismBuilding, type PrismPayload } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import { createProgressiveBuildingCoverage, hideReplacedBuildingPreview, restoreBuildingPreview, restoreBuildingPreviews } from "../src/progressiveBuildingCoverage";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const payload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8")) as PrismPayload;
const originals = receipt.owners.map(o => o.prism) as PrismBuilding[];
const neighbour = payload.buildings.find(p => p.id === "42698898")!;
const changed = { ...originals[0], h_dm: originals[0].h_dm + 1 };
const source = [...originals, neighbour, changed], retained = [neighbour, changed];

test("actual core and distant constructors retain exactly the complement, with reversible defaults", () => {
  const audit = (buildings: PrismBuilding[], replace = false) => {
    const root = createIsometricCityCore({ ...payload, buildings }, null, null, null,
      { includeContext: false, includeLegacyColonnadesEnvelopes: !replace });
    try { return staticGeometryAudit(root); } finally { disposeStaticAudit(root); }
  };
  expect(audit(source, true)).toEqual(audit(retained));
  expect(audit(source)).not.toEqual(audit(source, true));
  expect(audit([...originals, ...retained])).toEqual(audit(source));
  const filtered = createDistantBuildingShells(payload, source, { includeLegacyColonnadesEnvelopes: false });
  const control = createDistantBuildingShells(payload, retained);
  try { expect(staticGeometryAudit(filtered)).toEqual(staticGeometryAudit(control)); }
  finally { disposeStaticAudit(filtered); disposeStaticAudit(control); }
});

test("preview restore never recreates the retired walls or false roofs", () => {
  const world = new Group();
  const partition = { initial: [], remaining: [[originals[0], neighbour], [originals[1], changed]], omitted: [] };
  const controlPartition = { initial: [], remaining: [[neighbour], [changed]], omitted: [] };
  const preview = createProgressiveBuildingCoverage(payload, partition, { includeLegacyColonnadesEnvelopes: false });
  const control = createProgressiveBuildingCoverage(payload, controlPartition); world.add(preview);
  try {
    const proof = staticGeometryAudit(control);
    expect(staticGeometryAudit(preview)).toEqual(proof);
    hideReplacedBuildingPreview(world, "buildings-preview-1");
    restoreBuildingPreview(world, "buildings-preview-1");
    expect(staticGeometryAudit(preview)).toEqual(proof);
    hideReplacedBuildingPreview(world, "buildings-preview-2");
    restoreBuildingPreviews(world);
    expect(staticGeometryAudit(preview)).toEqual(proof);
  } finally { disposeStaticAudit(world); disposeStaticAudit(control); }
});

test("actual navigation removes only old originals and preserves adjacent and altered source obstacles", () => {
  const audit = (buildings: PrismBuilding[], replace = false) => {
    const index = compilePedestrianObstacles({ buildings }, () => "day", { replaceColonnadesPrisms: replace });
    return JSON.stringify({ buildingCount: index.buildingCount, cells: [...index.cells] });
  };
  expect(audit(source, true)).toEqual(audit(retained));
  expect(audit(source)).not.toEqual(audit(source, true));
  const index = compilePedestrianObstacles({ buildings: source }, () => "day", { replaceColonnadesPrisms: true });
  const ids = new Set([...index.cells.values()].flat().map(o => o.sourceId));
  expect(ids.has(neighbour.id)).toBe(true);
  expect(ids.has(changed.id)).toBe(true);
  expect(ids.has(originals[1].id)).toBe(false);
});
