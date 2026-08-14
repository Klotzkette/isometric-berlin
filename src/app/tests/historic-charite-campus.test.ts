import { describe, expect, test } from "bun:test";
import { Box3, Group, LineSegments, Mesh } from "three";

import {
  CHARITE_ALTHOFF_TOWER_ID,
  CHARITE_FRIEDRICH_ALTHOFF_IDS,
  CHARITE_MEDICAL_MUSEUM_IDS,
  CHARITE_VIROLOGY_IDS,
  HISTORIC_CHARITE_IDS,
  HISTORIC_CHARITE_PROFILE,
  HISTORIC_CHARITE_TONES,
  createHistoricChariteCampus,
  historicChariteRoofCode,
} from "../src/HistoricChariteCampus";
import {
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  WINDOWS_SUPPRESSED_IDS,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;

function model(): Group {
  return createHistoricChariteCampus(prisms);
}

describe("the source-distinct historic Charite campus", () => {
  test("pins all three ensembles to their official LoD2 parts", () => {
    expect(CHARITE_VIROLOGY_IDS.size).toBe(6);
    expect(CHARITE_MEDICAL_MUSEUM_IDS.size).toBe(20);
    expect(CHARITE_FRIEDRICH_ALTHOFF_IDS.size).toBe(6);
    expect(HISTORIC_CHARITE_IDS.size).toBe(32);
    const sourceIds = new Set(prisms.buildings.map((building) => building.id));
    for (const id of HISTORIC_CHARITE_IDS) {
      expect(sourceIds.has(id)).toBe(true);
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBe(true);
    }
  });

  test("does not mislabel the post-war Virology building as historic brick", () => {
    expect(HISTORIC_CHARITE_PROFILE.virology.built).toEqual([1956, 1960]);
    expect(HISTORIC_CHARITE_PROFILE.virology.facade).toContain("post-war");
    expect(HISTORIC_CHARITE_PROFILE.museum.built).toEqual([1899, 1905]);
    expect(HISTORIC_CHARITE_PROFILE.althoff.built).toBe(1901);
    for (const id of CHARITE_VIROLOGY_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(HISTORIC_CHARITE_TONES.virologyFacade);
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(0x77827d);
    }
    for (const id of CHARITE_MEDICAL_MUSEUM_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(HISTORIC_CHARITE_TONES.museumFacade);
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(HISTORIC_CHARITE_TONES.slate);
    }
  });

  test("turns documented mixed heritage roofs into bounded hipped caps", () => {
    expect(historicChariteRoofCode("gwXjAt32", 5000)).toBe(3200);
    expect(historicChariteRoofCode("t76KCSEh", 5000)).toBe(3200);
    expect(historicChariteRoofCode(CHARITE_ALTHOFF_TOWER_ID, 5000)).toBe(5000);
    expect(historicChariteRoofCode("mEGhfy5X", 5000)).toBe(5000);
    expect(historicChariteRoofCode("WCl6Bw6x", 1000)).toBe(1000);
  });

  test("draws separate masonry and post-war facade layers", () => {
    const campus = model();
    const heritage = campus.getObjectByName(
      "Charite heritage facade details bodies",
    );
    const heritageLamps = campus.getObjectByName(
      "Charite heritage facade details lamps",
    );
    const heritageInk = campus.getObjectByName(
      "Charite heritage facade details ink lines",
    );
    const virology = campus.getObjectByName(
      "Charite Virology post-war facade details bodies",
    );
    const virologyLamps = campus.getObjectByName(
      "Charite Virology post-war facade details lamps",
    );
    expect(heritage).toBeInstanceOf(Mesh);
    expect(heritageLamps).toBeInstanceOf(Mesh);
    expect(heritageInk).toBeInstanceOf(LineSegments);
    expect(virology).toBeInstanceOf(Mesh);
    expect(virologyLamps).toBeInstanceOf(Mesh);
    expect(campus.userData.detailCounts.sourcePrisms).toBe(32);
    expect(campus.userData.detailCounts.museumWindows).toBeGreaterThan(350);
    expect(campus.userData.detailCounts.althoffWindows).toBeGreaterThan(90);
    expect(campus.userData.detailCounts.virologyWindows).toBeGreaterThan(70);
    expect(campus.userData.detailCounts.ivyPatches).toBeGreaterThan(0);
  });

  test("keeps the Althoff helm inside the measured source height", () => {
    const campus = model();
    const bounds = new Box3().setFromObject(campus);
    expect(bounds.max.y).toBeLessThanOrEqual(27.346);
    expect(bounds.min.x).toBeLessThan(194);
    expect(bounds.max.x).toBeGreaterThan(510);
    expect(campus.userData.geometryStatus).toContain("LoD2 shells retained");
    expect(campus.userData.geometryStatus).toContain("unsurveyed");
  });
});
