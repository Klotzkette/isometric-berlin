import { describe, expect, test } from "bun:test";
import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import {
  createExpandedCityDetails,
  expandedCityFocusCamera,
  HAMBURGER_BAHNHOF_PROFILE,
} from "../src/ExpandedCityDetails";

const landmarks = [
  "Hamburger Bahnhof",
  "Rieckhallen",
  "Sozialgericht Berlin",
  "Berliner Philharmonie",
  "Kammermusiksaal",
  "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)",
  "berlin modern — Museum des 20. Jahrhunderts",
  "Neue Nationalgalerie",
  "Der Bogenschütze (Henry Moore)",
  "Tilla-Durieux-Park",
  "Anhalter Bahnhof",
  "Charlottenburger Tor",
  "WELT Balloon",
  "Kollhoff-Tower",
  "Spanische Botschaft",
  "Café am Neuen See",
  "KPMG Europacity",
  "DKB Campus Upbeat",
].map((name, index) => ({
  name,
  world: [index * 120, 3.8, (index % 4) * 160] as [number, number, number],
}));

describe("task-10 expanded city recognition details", () => {
  test("merges the architecture into one outlined flat-paint draw layer", () => {
    const details = createExpandedCityDetails(landmarks);
    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(bodies.geometry.getAttribute("color").count).toBeGreaterThan(1_000);
    expect(bodies.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(bodies.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(
      details.getObjectByName(
        "Expanded architecture and public-realm details ink lines",
      ),
    ).toBeDefined();
  });

  test("adds company and balloon signs as drawn lettering", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.getObjectByName("KPMG rooftop lettering")).toBeDefined();
    expect(details.getObjectByName("DKB rooftop lettering")).toBeDefined();
    expect(details.getObjectByName("WELT rooftop lettering")).toBeDefined();
  });

  test("grounds both company signs on recognisable building masses", () => {
    const details = createExpandedCityDetails(landmarks);
    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    expect(bounds.max.y).toBeGreaterThan(65);
    expect(details.userData.geometryStatus).toContain("Open-data-positioned");
  });

  test("keeps the WELT balloon tall but introduces no duplicate Carillon", () => {
    const details = createExpandedCityDetails(landmarks);
    const bounds = new Box3().setFromObject(details);
    expect(bounds.max.y).toBeGreaterThan(85);
    expect(
      details.getObjectByName("Granular 42 m Carillon im Tiergarten"),
    ).toBeUndefined();
    expect(details.userData.geometryStatus).toContain("LoD2 remains");
  });

  test("frames tall and edge-of-map additions without clipping", () => {
    const welt = landmarks.find((landmark) => landmark.name === "WELT Balloon");
    const dkb = landmarks.find(
      (landmark) => landmark.name === "DKB Campus Upbeat",
    );
    expect(welt).toBeDefined();
    expect(dkb).toBeDefined();
    expect(expandedCityFocusCamera(welt!)).toMatchObject({
      distance_m: 218,
      target_height_m: 53,
      target_world: welt?.world,
    });
    expect(expandedCityFocusCamera(dkb!)).toMatchObject({
      distance_m: 232,
      target_height_m: 32,
    });
  });

  test("pins Hamburger Bahnhof to its measured tower facade", () => {
    const profile = HAMBURGER_BAHNHOF_PROFILE;
    expect(profile.facadeRotationY).toBeCloseTo(Math.PI / 6, 10);
    expect(Math.hypot(...profile.facadeAxis)).toBeCloseTo(1, 3);
    expect(Math.hypot(...profile.facadeNormal)).toBeCloseTo(1, 3);
    expect(
      profile.facadeAxis[0] * profile.facadeNormal[0] +
        profile.facadeAxis[1] * profile.facadeNormal[1],
    ).toBeCloseTo(0, 3);
    expect(profile.sourceTowerIds).toEqual([
      "DEBE3DIkXt8PMip6",
      "DEBE3DlXyRYPJvcY",
    ]);
    expect(profile.towerHeightM).toBeCloseTo(26.25, 2);
    expect(profile.towerCentresM).toEqual([-11.43, 11.43]);
    expect(profile.roofForm).toBe("flat-cornice");
    expect(profile.grounded).toBe(true);
  });

  test("focuses the real Hamburger Bahnhof facade instead of the hall POI", () => {
    const hamburger = landmarks.find(
      (landmark) => landmark.name === "Hamburger Bahnhof",
    );
    expect(hamburger).toBeDefined();
    const camera = expandedCityFocusCamera(hamburger!);
    expect(camera).toMatchObject({
      azimuth_degrees: 10,
      distance_m: 124,
      polar_degrees: 58,
      target_height_m: 11,
    });
    expect(camera?.target_world[0]).toBeCloseTo(
      hamburger!.world[0] +
        HAMBURGER_BAHNHOF_PROFILE.facadeOffsetFromLandmarkM[0],
      6,
    );
    expect(camera?.target_world[1]).toBe(hamburger!.world[1]);
    expect(camera?.target_world[2]).toBeCloseTo(
      hamburger!.world[2] +
        HAMBURGER_BAHNHOF_PROFILE.facadeOffsetFromLandmarkM[1],
      6,
    );
  });

  test("builds the documented flat front and inscription", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.hamburgerBahnhof).toEqual(
      HAMBURGER_BAHNHOF_PROFILE,
    );
    expect(
      details.getObjectByName("Hamburger Bahnhof facade inscription"),
    ).toBeDefined();
    expect(HAMBURGER_BAHNHOF_PROFILE.upperArcadeCount).toBe(6);
    expect(HAMBURGER_BAHNHOF_PROFILE.lowerArchCount).toBe(2);
    expect(HAMBURGER_BAHNHOF_PROFILE.forecourtTreatment).toBe(
      "axial-path-and-rondel",
    );
    const litArches = details.getObjectByName(
      "Expanded architecture and public-realm details lamps",
    ) as Mesh;
    expect(litArches).toBeInstanceOf(Mesh);
    expect(litArches.userData.nightMaterial).toBeInstanceOf(
      MeshStandardMaterial,
    );
  });
});
