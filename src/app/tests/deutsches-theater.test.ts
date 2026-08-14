import { describe, expect, test } from "bun:test";
import { Box3, Group, LineSegments, Mesh } from "three";

import {
  DEUTSCHES_THEATER_CUSTOM_FACADE_IDS,
  DEUTSCHES_THEATER_IDS,
  DEUTSCHES_THEATER_KAMMERSPIELE_IDS,
  DEUTSCHES_THEATER_MAIN_IDS,
  DEUTSCHES_THEATER_PROFILE,
  DEUTSCHES_THEATER_TONES,
  createDeutschesTheater,
} from "../src/DeutschesTheater";
import {
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  WINDOWS_SUPPRESSED_IDS,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;

function model(): Group {
  return createDeutschesTheater(prisms);
}

describe("the source-bounded Deutsches Theater recognition model", () => {
  test("pins every official part without moving or replacing its shell", () => {
    expect(DEUTSCHES_THEATER_IDS.size).toBe(15);
    expect(DEUTSCHES_THEATER_MAIN_IDS.size).toBe(11);
    expect(DEUTSCHES_THEATER_KAMMERSPIELE_IDS.size).toBe(4);
    const sourceIds = new Set(prisms.buildings.map((building) => building.id));
    for (const id of DEUTSCHES_THEATER_IDS) {
      expect(sourceIds.has(id)).toBe(true);
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(DEUTSCHES_THEATER_TONES.slate);
    }
  });

  test("keeps the main house ivory and the Kammerspiele pale sage", () => {
    for (const id of DEUTSCHES_THEATER_MAIN_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(
        DEUTSCHES_THEATER_TONES.facadeIvory,
      );
    }
    for (const id of DEUTSCHES_THEATER_KAMMERSPIELE_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(
        DEUTSCHES_THEATER_TONES.kammerspiele,
      );
    }
    for (const id of DEUTSCHES_THEATER_CUSTOM_FACADE_IDS) {
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBe(true);
    }
  });

  test("carries the documented facade rhythm and DT rooftop mark", () => {
    const theatre = model();
    expect(
      theatre.getObjectByName("Deutsches Theater architectural details bodies"),
    ).toBeInstanceOf(Mesh);
    expect(
      theatre.getObjectByName("Deutsches Theater architectural details lamps"),
    ).toBeInstanceOf(Mesh);
    expect(
      theatre.getObjectByName(
        "Deutsches Theater architectural details ink lines",
      ),
    ).toBeInstanceOf(LineSegments);
    expect(
      theatre.getObjectByName("DEUTSCHES THEATER Deutsches Theater lettering"),
    ).toBeInstanceOf(Mesh);
    expect(
      theatre.getObjectByName("KAMMERSPIELE Deutsches Theater lettering"),
    ).toBeInstanceOf(Mesh);
    expect(theatre.userData.rooftopMark).toBe("DT");
    expect(theatre.userData.detailCounts.facadeLabels).toBe(4);
    expect(theatre.userData.detailCounts.windows).toBeGreaterThan(150);
    expect(theatre.userData.detailCounts.sourcePrisms).toBe(15);
  });

  test("keeps every added detail inside the official ensemble envelope", () => {
    const theatre = model();
    const bounds = new Box3().setFromObject(theatre);
    expect(bounds.min.x).toBeGreaterThanOrEqual(709);
    expect(bounds.max.x).toBeLessThanOrEqual(807);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-632);
    expect(bounds.max.z).toBeLessThanOrEqual(-548);
    expect(bounds.min.y).toBeGreaterThanOrEqual(5.19);
    expect(bounds.max.y).toBeLessThanOrEqual(30.51);
    expect(theatre.userData.geometryStatus).toContain("exact Berlin LoD2");
    expect(theatre.userData.geometryStatus).toContain("photo-bounded");
  });

  test("records authoritative and current visual references", () => {
    expect(DEUTSCHES_THEATER_PROFILE.lod2Parent).toBe("DEBE01YYK00002VR");
    expect(DEUTSCHES_THEATER_PROFILE.osmNodeId).toBe("345806623");
    expect(DEUTSCHES_THEATER_PROFILE.sourceUrls).toContain(
      "https://www.deutschestheater.de/das-deutsche-theater/profil",
    );
    expect(
      DEUTSCHES_THEATER_PROFILE.sourceUrls.some((url) =>
        url.includes("2024-05-09"),
      ),
    ).toBe(true);
  });
});
