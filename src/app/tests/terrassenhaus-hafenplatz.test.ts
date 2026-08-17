import { describe, expect, test } from "bun:test";
import { Box3, Group, LineSegments, Material, Mesh } from "three";

import {
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  WINDOWS_SUPPRESSED_IDS,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  TERRASSENHAUS_HAFENPLATZ_IDS,
  TERRASSENHAUS_HAFENPLATZ_PERIMETER_IDS,
  TERRASSENHAUS_HAFENPLATZ_PROFILE,
  TERRASSENHAUS_HAFENPLATZ_STEP_CHAINS,
  TERRASSENHAUS_HAFENPLATZ_TONES,
  createTerrassenhausHafenplatz,
} from "../src/TerrassenhausHafenplatz";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;

function model(): Group {
  return createTerrassenhausHafenplatz(prisms);
}

describe("the source-bounded Terrassenhaus Hafenplatz model", () => {
  test("pins all 26 official stepped parts without replacing their shells", () => {
    expect(TERRASSENHAUS_HAFENPLATZ_IDS.size).toBe(26);
    const sourceIds = new Set(prisms.buildings.map((building) => building.id));
    for (const id of TERRASSENHAUS_HAFENPLATZ_IDS) {
      expect(sourceIds.has(id)).toBe(true);
      expect(HERO_PRISM_TONES[id]).toBe(
        TERRASSENHAUS_HAFENPLATZ_TONES.concrete,
      );
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(
        TERRASSENHAUS_HAFENPLATZ_TONES.parapet,
      );
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBe(true);
    }
  });

  test("preserves the measured cross-shaped height cascade", () => {
    const parts = prisms.buildings.filter((building) =>
      TERRASSENHAUS_HAFENPLATZ_IDS.has(building.id),
    );
    const partsById = new Map(parts.map((building) => [building.id, building]));
    const heights = [...new Set(parts.map((building) => building.h_dm))];
    expect(parts).toHaveLength(26);
    expect(Math.max(...parts.map((building) => building.h_dm))).toBe(395);
    expect(Math.min(...parts.map((building) => building.h_dm))).toBe(110);
    expect(heights.length).toBeGreaterThanOrEqual(18);
    expect(TERRASSENHAUS_HAFENPLATZ_STEP_CHAINS).toHaveLength(4);
    for (const chain of TERRASSENHAUS_HAFENPLATZ_STEP_CHAINS) {
      const chainHeights = chain.map((id) => partsById.get(id)?.h_dm ?? 0);
      expect(chainHeights.every((height) => height > 0)).toBe(true);
      for (let index = 1; index < chainHeights.length; index += 1) {
        expect(chainHeights[index]).toBeLessThan(chainHeights[index - 1]);
      }
    }
    const classifiedIds = new Set([
      ...TERRASSENHAUS_HAFENPLATZ_STEP_CHAINS.flat(),
      ...TERRASSENHAUS_HAFENPLATZ_PERIMETER_IDS,
    ]);
    expect(classifiedIds).toEqual(TERRASSENHAUS_HAFENPLATZ_IDS);
  });

  test("adds the photo-bounded windows, panel grid and terrace registers", () => {
    const details = model();
    expect(
      details.getObjectByName(
        "Terrassenhaus Hafenplatz architectural details bodies",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName(
        "Terrassenhaus Hafenplatz architectural details lamps",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName(
        "Terrassenhaus Hafenplatz architectural details ink lines",
      ),
    ).toBeInstanceOf(LineSegments);
    expect(details.userData.detailCounts.sourcePrisms).toBe(26);
    expect(details.userData.detailCounts.steppedHeightTiers).toBeGreaterThan(
      18,
    );
    expect(details.userData.detailCounts.steppedArms).toBe(4);
    expect(details.userData.detailCounts.perimeterSlabs).toBe(5);
    expect(details.userData.detailCounts.windows).toBeGreaterThan(900);
    expect(details.userData.detailCounts.windows).toBeLessThan(1_200);
    expect(details.userData.detailCounts.mullions).toBe(
      details.userData.detailCounts.windows,
    );
    expect(details.userData.detailCounts.spandrelPanels).toBeGreaterThan(900);
    expect(details.userData.detailCounts.facadeBands).toBeGreaterThan(300);
    expect(details.userData.detailCounts.terraceSegments).toBeGreaterThan(350);
    expect(details.userData.detailCounts.balconyRecesses).toBe(6);
    expect(details.userData.detailCounts.louvreSlats).toBe(5);
    expect(details.userData.detailCounts.entrances).toBeGreaterThanOrEqual(6);
  });

  test("locks the supplied-photo daylight palette", () => {
    expect(TERRASSENHAUS_HAFENPLATZ_TONES).toEqual({
      aggregate: 0xaaa9a4,
      aggregateShade: 0x959792,
      balconyRail: 0x747b79,
      concrete: 0xc9c7c0,
      concreteShade: 0xb1b0aa,
      curtain: 0xb7b2a2,
      frameOchre: 0xaa9152,
      glass: 0x63787e,
      glassDark: 0x46595e,
      groundFrame: 0x4b6b70,
      nightGlass: 0xffc979,
      parapet: 0xbdbbb4,
      plaster: 0xcfcdc5,
      recess: 0x3f484a,
    });
  });

  test("keeps additions inside the official ensemble envelope", () => {
    const details = model();
    const bounds = new Box3().setFromObject(details);
    expect(bounds.min.x).toBeGreaterThanOrEqual(261.25);
    expect(bounds.max.x).toBeLessThanOrEqual(349.9);
    expect(bounds.min.z).toBeGreaterThanOrEqual(1548.25);
    expect(bounds.max.z).toBeLessThanOrEqual(1690.25);
    expect(bounds.min.y).toBeGreaterThanOrEqual(4.15);
    expect(bounds.max.y).toBeLessThanOrEqual(43.9);
  });

  test("uses flat procedural colour only and records uncertainty honestly", () => {
    const details = model();
    details.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials as Material[]) {
        expect("map" in material ? material.map : null).toBeFalsy();
      }
    });
    expect(TERRASSENHAUS_HAFENPLATZ_PROFILE.lod2Parent).toBe(
      "DEBE02YY400003Qa",
    );
    expect(TERRASSENHAUS_HAFENPLATZ_PROFILE.geometryStatus).toContain(
      "photo-bounded",
    );
    expect(TERRASSENHAUS_HAFENPLATZ_PROFILE.geometryStatus).toContain(
      "not surveyed facade geometry",
    );
    expect(TERRASSENHAUS_HAFENPLATZ_PROFILE.geometryStatus).toContain(
      "no protected drawing or photo texture is bundled",
    );
    expect(TERRASSENHAUS_HAFENPLATZ_PROFILE.sourceUrls).toContain(
      "https://doi.org/10.25645/24k5-8w4y",
    );
    expect(TERRASSENHAUS_HAFENPLATZ_PROFILE.sourceUrls).toContain(
      "https://fbinter.stadt-berlin.de/fb_daten/beschreibung/lod2_sensw.html",
    );
  });
});
