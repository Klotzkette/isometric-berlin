import { describe, expect, test } from "bun:test";
import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import {
  BERLIN_MODERN_PROFILE,
  createExpandedCityDetails,
  expandedCityFocusCamera,
  HAMBURGER_BAHNHOF_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  RIECKHALLEN_PROFILE,
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
    const kollhoff = landmarks.find(
      (landmark) => landmark.name === "Kollhoff-Tower",
    );
    expect(expandedCityFocusCamera(kollhoff!)).toMatchObject({
      distance_m: 176,
      target_height_m: 48,
      target_world: kollhoff?.world,
    });
  });

  test("leaves Kollhoff massing to its complete LoD2 shell", () => {
    const kollhoff = {
      name: "Kollhoff-Tower",
      world: [240.095, 8, 1082.464] as [number, number, number],
    };
    const details = createExpandedCityDetails([kollhoff]);
    expect(details.userData.kollhoffTower).toEqual(KOLLHOFF_TOWER_PROFILE);
    expect(
      details.getObjectByName(
        "Expanded architecture and public-realm details bodies",
      ),
    ).toBeUndefined();
    expect(KOLLHOFF_TOWER_PROFILE.parentBuildingId).toBe(
      "DEBE01YYK0002KM6",
    );
    expect(KOLLHOFF_TOWER_PROFILE.officialHeightM).toBe(103);
    expect(KOLLHOFF_TOWER_PROFILE.storeyCount).toBe(25);
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

  test("keeps Rieckhallen as one low flat goods shed without false peaks", () => {
    const landmark = {
      name: "Rieckhallen",
      world: [10, 8, 20] as [number, number, number],
    };
    const details = createExpandedCityDetails([landmark]);
    expect(details.userData.rieckhallen).toEqual(RIECKHALLEN_PROFILE);
    expect(RIECKHALLEN_PROFILE.sourceBuildingId).toBe("DEBE01YYK0002SQl");
    expect(RIECKHALLEN_PROFILE.roofForm).toBe(
      "flat-mixed-with-low-longitudinal-bands",
    );
    expect(RIECKHALLEN_PROFILE.roofBandCount).toBe(3);
    expect(Math.hypot(...RIECKHALLEN_PROFILE.longAxis)).toBeCloseTo(1, 5);
    expect(Math.hypot(...RIECKHALLEN_PROFILE.crossAxis)).toBeCloseTo(1, 5);

    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const positions = bodies.geometry.getAttribute("position");
    const centerX =
      landmark.world[0] + RIECKHALLEN_PROFILE.centerOffsetFromLandmarkM[0];
    const centerZ =
      landmark.world[2] + RIECKHALLEN_PROFILE.centerOffsetFromLandmarkM[1];
    let maxY = Number.NEGATIVE_INFINITY;
    let minAlong = Number.POSITIVE_INFINITY;
    let maxAlong = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const along =
        (x - centerX) * RIECKHALLEN_PROFILE.longAxis[0] +
        (z - centerZ) * RIECKHALLEN_PROFILE.longAxis[1];
      maxY = Math.max(maxY, y);
      minAlong = Math.min(minAlong, along);
      maxAlong = Math.max(maxAlong, along);
    }
    expect(maxY).toBeLessThan(landmark.world[1] + 10);
    expect(maxAlong - minAlong).toBeGreaterThan(280);
    expect(maxAlong - minAlong).toBeLessThan(282);
    expect(expandedCityFocusCamera(landmark)).toMatchObject({
      distance_m: 292,
      target_world: landmark.world,
    });
  });

  test("grounds berlin modern in its published 120 x 71 x 18 m envelope", () => {
    const landmark = {
      name: "berlin modern — Museum des 20. Jahrhunderts",
      world: [30, 8, 40] as [number, number, number],
    };
    const details = createExpandedCityDetails([landmark]);
    const profile = BERLIN_MODERN_PROFILE;
    expect(details.userData.berlinModern).toEqual(profile);
    expect(profile.geometryStatus).toBe(
      "planning-envelope-not-surveyed-as-built",
    );
    expect(profile.grounded).toBe(true);
    expect(profile.footprintLengthM).toBe(120);
    expect(profile.footprintWidthM).toBe(71);
    expect(profile.bodyHeightM + profile.roofRiseM).toBe(profile.totalHeightM);
    expect(profile.totalHeightM).toBe(18);
    expect(profile.rotationY).toBeCloseTo((-19.74 * Math.PI) / 180, 8);

    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const positions = bodies.geometry.getAttribute("position");
    const cosine = Math.cos(profile.rotationY);
    const sine = Math.sin(profile.rotationY);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < positions.count; index += 1) {
      const dx = positions.getX(index) - landmark.world[0];
      const dz = positions.getZ(index) - landmark.world[2];
      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      minX = Math.min(minX, localX);
      maxX = Math.max(maxX, localX);
      minY = Math.min(minY, positions.getY(index));
      maxY = Math.max(maxY, positions.getY(index));
      minZ = Math.min(minZ, localZ);
      maxZ = Math.max(maxZ, localZ);
    }
    expect(minY).toBeCloseTo(landmark.world[1], 3);
    expect(maxY).toBeCloseTo(
      landmark.world[1] + profile.totalHeightM + 0.26,
      2,
    );
    expect(maxX - minX).toBeGreaterThanOrEqual(profile.footprintWidthM);
    expect(maxX - minX).toBeLessThan(profile.footprintWidthM + 1);
    expect(maxZ - minZ).toBeGreaterThanOrEqual(profile.footprintLengthM);
    expect(maxZ - minZ).toBeLessThan(profile.footprintLengthM + 1);
    expect(expandedCityFocusCamera(landmark)).toMatchObject({
      azimuth_degrees: 160,
      distance_m: 188,
      target_height_m: 9,
      target_world: landmark.world,
    });
  });
});
