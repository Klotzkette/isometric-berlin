import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh } from "three";

import {
  ECONOMIC_MINISTRY_DETAIL_FACADE_IDS,
  ECONOMIC_MINISTRY_HISTORIC_WING_IDS,
  ECONOMIC_MINISTRY_IDS,
  ECONOMIC_MINISTRY_MAIN_ID,
  ECONOMIC_MINISTRY_MODERN_CANAL_ID,
  ECONOMIC_MINISTRY_NORTH_WING_ID,
  ECONOMIC_MINISTRY_PRISM_ROOF_TONES,
  ECONOMIC_MINISTRY_PRISM_TONES,
  ECONOMIC_MINISTRY_PROFILE,
  ECONOMIC_MINISTRY_SOUTH_WING_ID,
  createEconomicMinistryDetails,
  economicMinistryRoofCode,
} from "../src/EconomicMinistryDetails";
import {
  GENERIC_CHIMNEY_SUPPRESSED_IDS,
  GENERIC_FACADE_TRIM_SUPPRESSED_IDS,
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  PRISM_SUPPRESSED_IDS,
  WINDOWS_SUPPRESSED_IDS,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;
const ministryPrisms: PrismPayload = {
  ...prisms,
  buildings: prisms.buildings.filter(({ id }) =>
    ECONOMIC_MINISTRY_IDS.has(id),
  ),
};

describe("Bundeswirtschaftsministerium at the canal", () => {
  test("binds the complete source set to the official site and two Invalidenhaus wings", () => {
    expect(ECONOMIC_MINISTRY_PROFILE.osmOfficeWay).toBe(24911034);
    expect(ECONOMIC_MINISTRY_PROFILE.osmHistoricBuildingWays).toEqual([
      28880802, 28880803,
    ]);
    expect(ECONOMIC_MINISTRY_PROFILE.sourcePrismIds).toEqual([
      "K00008CN",
      "yAAWS2KQ",
      "-3202585",
      "K0000EU2",
      "K0000B4S",
      "K0000A7g",
    ]);
    const payloadIds = new Set(prisms.buildings.map(({ id }) => id));
    for (const id of ECONOMIC_MINISTRY_IDS) {
      expect(payloadIds.has(id)).toBeTrue();
      expect(HERO_PRISM_TONES[id]).toBe(
        ECONOMIC_MINISTRY_PRISM_TONES[id],
      );
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(
        ECONOMIC_MINISTRY_PRISM_ROOF_TONES[id],
      );
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
    }
  });

  test("replaces generic facade grids only where the dedicated layer is complete", () => {
    expect(ECONOMIC_MINISTRY_DETAIL_FACADE_IDS).toEqual(
      new Set(["yAAWS2KQ", "K0000EU2", "K0000B4S"]),
    );
    for (const id of ECONOMIC_MINISTRY_DETAIL_FACADE_IDS) {
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(id)).toBeTrue();
    }
    expect(GENERIC_CHIMNEY_SUPPRESSED_IDS.has("yAAWS2KQ")).toBeTrue();
    expect(WINDOWS_SUPPRESSED_IDS.has("-3202585")).toBeFalse();
    expect(WINDOWS_SUPPRESSED_IDS.has("K0000A7g")).toBeFalse();
    // The new main-house layer covers selected street walls only. Its other
    // walls and eleven courts must retain the ordinary source facade pass.
    expect(WINDOWS_SUPPRESSED_IDS.has(ECONOMIC_MINISTRY_MAIN_ID)).toBeFalse();
  });

  test("corrects only the two documented historic wings to hipped roofs", () => {
    expect(ECONOMIC_MINISTRY_HISTORIC_WING_IDS).toEqual(
      new Set(["K0000EU2", "K0000B4S"]),
    );
    expect(economicMinistryRoofCode(ECONOMIC_MINISTRY_SOUTH_WING_ID, 5000)).toBe(
      3200,
    );
    expect(economicMinistryRoofCode(ECONOMIC_MINISTRY_NORTH_WING_ID, 5000)).toBe(
      3200,
    );
    expect(economicMinistryRoofCode(ECONOMIC_MINISTRY_MODERN_CANAL_ID, 3100)).toBe(
      3100,
    );
    expect(economicMinistryRoofCode(ECONOMIC_MINISTRY_MAIN_ID, 9999)).toBe(9999);
  });

  test("adds one merged facade layer with canal bays, court grids and entrances", () => {
    const details = createEconomicMinistryDetails(ministryPrisms);
    expect(details.userData.replacesLoD2).toBeFalse();
    expect(details.userData.hasOpaqueEnvelope).toBeFalse();
    expect(details.userData.staticAllModes).toBeTrue();
    expect(details.userData.maxFacadeProjectionM).toBe(0.6);
    expect(details.userData.detailCounts).toEqual({
      canalFacadeBays: 44,
      canalFacadeWindows: 220,
      courtyardPiers: 24,
      historicEntrances: 2,
      northHistoricBullseyes: 1,
      mainHouseWindows: 60,
      mainHouseRisalits: 3,
      framedHistoricWindows: 240,
      historicWindows: 240,
      sourcePrisms: 6,
    });
    expect(
      details.getObjectByName(
        "Bundeswirtschaftsministerium architectural details bodies",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName(
        "Bundeswirtschaftsministerium architectural details lamps",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName(
        "Bundeswirtschaftsministerium architectural details ink lines",
      ),
    ).toBeInstanceOf(LineSegments);
  });

  test("keeps every projection tightly on the real ministry envelope", () => {
    const bounds = new Box3().setFromObject(
      createEconomicMinistryDetails(ministryPrisms),
    );
    expect(bounds.min.x).toBeGreaterThan(57);
    expect(bounds.max.x).toBeLessThan(305);
    expect(bounds.min.z).toBeGreaterThan(-1341);
    expect(bounds.max.z).toBeLessThan(-1017);
    expect(bounds.min.y).toBeGreaterThan(5);
    expect(bounds.max.y).toBeLessThan(24.8);
  });

  test("adds the Invalidenstrasse facade without altering its official body or courts", () => {
    const source = ministryPrisms.buildings.find(({ id }) => id === ECONOMIC_MINISTRY_MAIN_ID)!;
    const before = JSON.stringify(source);
    expect(source.h_dm).toBe(181);
    expect(source.y0_dm).toBe(54);
    expect(source.holes).toHaveLength(11);
    const complete = createEconomicMinistryDetails(ministryPrisms);
    const prior = createEconomicMinistryDetails({
      ...ministryPrisms,
      buildings: ministryPrisms.buildings.filter(({ id }) => id !== source.id),
    });
    expect(prior.userData.detailCounts.mainHouseWindows).toBe(0);
    expect(complete.userData.detailCounts.mainHouseWindows).toBe(60);
    expect(new Box3().setFromObject(prior).max.z).toBeLessThan(-1156);
    expect(new Box3().setFromObject(complete).max.z).toBeGreaterThan(-1018);
    expect(JSON.stringify(source)).toBe(before);
  });

  test("keeps the six-part detail overlay merged and within a finite geometry budget", () => {
    let renderables = 0;
    let bytes = 0;
    createEconomicMinistryDetails(ministryPrisms).traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      renderables += 1;
      for (const attribute of Object.values(object.geometry.attributes)) {
        bytes += attribute.array.byteLength;
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += object.geometry.index?.array.byteLength ?? 0;
    });
    expect(renderables).toBe(3);
    // 1,206,636 measured bytes including ink, now covering the main facade,
    // framed individual court windows, pediments and the north bullseye.
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(1_300_000);
  });
});
