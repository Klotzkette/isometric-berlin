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
  TERRASSENHAUS_HAFENPLATZ_PROFILE,
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
    const heights = [...new Set(parts.map((building) => building.h_dm))];
    expect(parts).toHaveLength(26);
    expect(Math.max(...parts.map((building) => building.h_dm))).toBe(395);
    expect(Math.min(...parts.map((building) => building.h_dm))).toBe(110);
    expect(heights.length).toBeGreaterThanOrEqual(18);
  });

  test("adds a dense ochre-framed window and spandrel register", () => {
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
    expect(details.userData.detailCounts.windows).toBeGreaterThan(400);
    expect(details.userData.detailCounts.facadeBands).toBeGreaterThan(120);
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
  });
});
