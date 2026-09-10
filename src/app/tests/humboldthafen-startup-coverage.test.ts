import { describe, expect, test } from "bun:test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import {
  HUMBOLDTHAFEN_BUILDING_IDS,
  harbourPrismContains,
} from "../src/HumboldthafenBuildings";
import { ECONOMIC_MINISTRY_IDS, createEconomicMinistryDetails } from "../src/EconomicMinistryDetails";
import { createIsometricCity, setIsoNightPresentation, type PrismPayload } from "../src/IsometricCityWorld";
import { createProgressiveBuildingCoverage } from "../src/progressiveBuildingCoverage";
import {
  DESKTOP_INITIAL_BUILDING_COUNT, DESKTOP_TOTAL_BUILDING_LIMIT,
  MOBILE_INITIAL_BUILDING_COUNT, MOBILE_TOTAL_BUILDING_LIMIT,
  PROGRESSIVE_BUILDING_BATCH_SIZE, splitProgressiveBuildings,
} from "../src/progressiveWorld";
import type { VisualMode } from "../src/visualMode";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const requestedIds = new Set([...HUMBOLDTHAFEN_BUILDING_IDS, ...ECONOMIC_MINISTRY_IDS]);

describe("Humboldthafen source footprints in the actual startup partition", () => {
  for (const mobile of [true, false]) {
    test(`${mobile ? "mobile" : "desktop"}: all 72 parts are exact before interaction without raising the city budget`, () => {
      const partition = splitProgressiveBuildings(
        payload.buildings,
        mobile ? MOBILE_INITIAL_BUILDING_COUNT : DESKTOP_INITIAL_BUILDING_COUNT,
        PROGRESSIVE_BUILDING_BATCH_SIZE,
        mobile ? MOBILE_TOTAL_BUILDING_LIMIT : DESKTOP_TOTAL_BUILDING_LIMIT,
        !mobile,
      );
      const initialIds = new Set(partition.initial.map(b => b.id));
      expect(requestedIds.size).toBe(72);
      for (const id of requestedIds) expect(initialIds.has(id)).toBeTrue();
      expect(partition.initial.length).toBe(mobile ? 160 : 420);
      expect(partition.initial.length + partition.remaining.flat().length).toBe(mobile ? 3600 : 9000);
      expect([...partition.omitted, ...partition.remaining.flat()].some(b => requestedIds.has(b.id))).toBeFalse();
    });
  }

  test("mobile startup keeps the ministry's eleven source courts and harbour courtyard open in every drawn mode", () => {
    const partition = splitProgressiveBuildings(payload.buildings, MOBILE_INITIAL_BUILDING_COUNT, PROGRESSIVE_BUILDING_BATCH_SIZE, MOBILE_TOTAL_BUILDING_LIMIT);
    const wanted = (buildings: PrismPayload["buildings"]) => buildings.filter(b => requestedIds.has(b.id));
    // Keep the production partition, including permanent and temporary boxes.
    // Merely testing the isolated authored building missed the phone defect.
    const localPartition = {
      initial: wanted(partition.initial),
      omitted: wanted(partition.omitted),
      remaining: partition.remaining.map(wanted),
    };
    const root = new Group().add(
      createIsometricCity(payload, null, null, null, { buildings: localPartition.initial, includeContext: false }),
      createProgressiveBuildingCoverage(payload, localPartition),
      createEconomicMinistryDetails(payload),
    );
    root.updateMatrixWorld(true);
    const main = payload.buildings.find(b => b.id === "K00008CN")!;
    const courts = main.holes!.map(hole => [
      hole.reduce((sum, p) => sum + p[0], 0) / hole.length / 10,
      hole.reduce((sum, p) => sum + p[1], 0) / hole.length / 10,
    ]);
    expect(courts.length).toBe(11);
    for (const [x, z] of courts) expect(harbourPrismContains(main, x, z)).toBeFalse();
    courts.push([140, -885]);
    // The old H4 longest-edge box covered 528.316 m² of mapped water.
    // This point is inside that false corner, well outside its LoD2 ring.
    courts.push([188.2751047, -898.0614511]);
    // H3's west wedge likewise must not become a bounding-box roof.
    courts.push([58.494818, -910.95]);
    try {
      for (const mode of ["day", "night", "snowstorm", "schwellenraum"] as VisualMode[]) {
        setIsoNightPresentation(root, mode === "night", true, mode);
        const visibleMeshes: Mesh[] = [];
        root.traverseVisible(o => { if (o instanceof Mesh) visibleMeshes.push(o); });
        for (const [x, z] of courts) {
          const ray = new Raycaster(new Vector3(x, 80, z), new Vector3(0, -1, 0), 0, 70);
          expect(ray.intersectObjects(visibleMeshes, false)).toHaveLength(0);
        }
        // Actual upper roofs remain: removing all geometry would pass the
        // courtyard check but leave the user's buildings absent again.
        for (const [x, z] of [[70, -865], [125, -864], [206, -1030]]) {
          const ray = new Raycaster(new Vector3(x, 80, z), new Vector3(0, -1, 0), 0, 79);
          expect(ray.intersectObjects(visibleMeshes, false).length).toBeGreaterThan(0);
        }
      }
    } finally {
      root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    }
  });
});
