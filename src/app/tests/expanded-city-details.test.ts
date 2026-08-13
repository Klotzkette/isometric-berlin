import { describe, expect, test } from "bun:test";
import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import {
  AMANO_GRAND_CENTRAL_PROFILE,
  BERLIN_MODERN_PROFILE,
  createExpandedCityDetails,
  EUROPACITY_PROFILE,
  expandedCityFocusCamera,
  HAMBURGER_BAHNHOF_PROFILE,
  KULTURFORUM_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  MOABIT_PRISON_PARK_PROFILE,
  NORTHERN_CITY_PROFILE,
  RIECKHALLEN_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
} from "../src/ExpandedCityDetails";

const landmarks = [
  "Hamburger Bahnhof",
  "Rieckhallen",
  "Sozialgericht Berlin",
  "Berliner Philharmonie",
  "Gemäldegalerie",
  "Kammermusiksaal",
  "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)",
  "berlin modern — Museum des 20. Jahrhunderts",
  "Neue Nationalgalerie",
  "St. Matthäus-Kirche",
  "Der Bogenschütze (Henry Moore)",
  "Tilla-Durieux-Park",
  "Anhalter Bahnhof",
  "Charlottenburger Tor",
  "WELT Balloon",
  "Kollhoff-Tower",
  "Mall of Berlin",
  "Spanische Botschaft",
  "Café am Neuen See",
  "KPMG Europacity",
  "DKB Campus Upbeat",
  "Geschichtspark Ehemaliges Zellengefängnis Moabit",
  "Oggi's Gemüsekebab",
].map((name, index) => ({
  name,
  world: [index * 120, 3.8, (index % 4) * 160] as [number, number, number],
}));

describe("task-10 expanded city recognition details", () => {
  test("anchors the Kulturforum buildings independently from entrance POIs", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.kulturforum).toEqual(KULTURFORUM_PROFILE);
    expect(KULTURFORUM_PROFILE.gemaldegalerie.centerWorldM).toEqual([
      -473.956, 1138.208,
    ]);
    expect(KULTURFORUM_PROFILE.gemaldegalerie.sourceBuildingIds).toEqual([
      "DEBE01YYK0002V5W",
      "DEBE01YYK0002Sq5",
    ]);
    expect(KULTURFORUM_PROFILE.philharmonie.heightM).toBeCloseTo(35.665, 3);
    expect(KULTURFORUM_PROFILE.staatsbibliothek.sourcePartCount).toBe(56);
    expect(KULTURFORUM_PROFILE.piazzetta.geometryStatus).toContain(
      "not surveyed paving",
    );
    expect(KULTURFORUM_PROFILE.sources).toHaveLength(3);
  });

  test("documents the source boundary of Potsdamer details", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.potsdamerDetails).toEqual(POTSDAMER_DETAIL_PROFILE);
    expect(POTSDAMER_DETAIL_PROFILE.geometryStatus).toContain("schematic");
    expect(POTSDAMER_DETAIL_PROFILE.mallSouthFacadeOffsetM).toBeCloseTo(
      -59.5,
      3,
    );
    expect(
      details.getObjectByName("Spielbank Berlin facade lettering"),
    ).toBeDefined();
    expect(
      details.getObjectByName("Taylor Wessing facade lettering"),
    ).toBeDefined();
    const mall = landmarks.find(
      (landmark) => landmark.name === "Mall of Berlin",
    );
    expect(expandedCityFocusCamera(mall!)).toMatchObject({
      azimuth_degrees: 180,
      target_world: [mall!.world[0], mall!.world[1], mall!.world[2] - 48],
    });
  });

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
    expect(details.getObjectByName("KPMG side lettering")).toBeDefined();
    expect(details.getObjectByName("DKB rooftop lettering")).toBeDefined();
    expect(details.getObjectByName("WELT rooftop lettering")).toBeDefined();
    expect(
      details.getObjectByName("AMANO Grand Central facade lettering"),
    ).toBeDefined();
  });

  test("anchors AMANO facade detail to OSM and the official LoD2 height", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.amanoGrandCentral).toEqual(
      AMANO_GRAND_CENTRAL_PROFILE,
    );
    expect(AMANO_GRAND_CENTRAL_PROFILE.osmWayId).toBe("237687062");
    expect(AMANO_GRAND_CENTRAL_PROFILE.sourceBuildingPartId).toBe(
      "DEBE3DLXM9FjJbtp",
    );
    expect(AMANO_GRAND_CENTRAL_PROFILE.officialHeightM).toBeCloseTo(27.819, 3);
    expect(AMANO_GRAND_CENTRAL_PROFILE.storeysBelowSetback).toBe(6);
    expect(AMANO_GRAND_CENTRAL_PROFILE.geometryStatus).toContain("LoD2 height");
  });

  test("reconstructs the documented Moabit prison-park reading", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.moabitPrisonPark).toEqual(
      MOABIT_PRISON_PARK_PROFILE,
    );
    expect(MOABIT_PRISON_PARK_PROFILE.sourceParkWayId).toBe("498278335");
    expect(MOABIT_PRISON_PARK_PROFILE.wallSideCount).toBe(3);
    expect(MOABIT_PRISON_PARK_PROFILE.entranceCount).toBe(3);
    expect(MOABIT_PRISON_PARK_PROFILE.circularYardCount).toBe(3);
    expect(MOABIT_PRISON_PARK_PROFILE.reconstructedCellCount).toBe(1);
    expect(MOABIT_PRISON_PARK_PROFILE.preservedWallHeightM).toBe(5);
  });

  test("places the temporary FUNBOX on the event lot opposite its address anchor", () => {
    const oggi = {
      name: "Oggi's Gemüsekebab",
      world: [-150.861, 4.2, -1179.35] as [number, number, number],
    };
    const details = createExpandedCityDetails([oggi]);
    const profile = NORTHERN_CITY_PROFILE.funbox;
    expect(details.userData.northernCity).toEqual(NORTHERN_CITY_PROFILE);
    expect(profile.osmAddressNodeId).toBe("7029312961");
    expect(profile.sourceAreaM2).toBe(4_000);
    expect(profile.sourceZoneCount).toBe(10);
    expect(profile.footprintWidthM * profile.footprintLengthM).toBeGreaterThan(
      profile.sourceAreaM2,
    );
    expect(profile.eventListingWorldM).toEqual([-140.167, -1134.842]);
    expect(profile.geometryStatus).toContain("free Wunderland lot");
    expect(profile.sources).toHaveLength(3);
    expect(
      details.getObjectByName("FUNBOX entrance WELCOME lettering"),
    ).toBeDefined();
    expect(
      details.getObjectByName("FUNBOX ticket kiosk lettering"),
    ).toBeDefined();

    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    expect(bounds.min.y).toBeCloseTo(profile.groundY, 2);
    expect(bounds.max.y).toBeGreaterThan(profile.groundY + 8.5);
    expect(bounds.max.y).toBeLessThan(profile.groundY + 10);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(60);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(90);
    expect(expandedCityFocusCamera(oggi)).toMatchObject({
      distance_m: 142,
      target_world: [
        profile.centerWorldM[0],
        oggi.world[1],
        profile.centerWorldM[1],
      ],
    });
  });

  test("grounds both company signs on recognisable building masses", () => {
    const details = createExpandedCityDetails(landmarks);
    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    expect(bounds.max.y).toBeGreaterThan(65);
    expect(details.userData.geometryStatus).toContain("Open-data-positioned");
    expect(details.userData.europacity).toEqual(EUROPACITY_PROFILE);
  });

  test("keeps Europacity geometry tied to metric and published sources", () => {
    const profile = EUROPACITY_PROFILE;
    expect(profile.einz.sourceTowerPartId).toBe("DEBE3De9JUgwVTiy");
    expect(profile.einz.measuredHeightM).toBeCloseTo(83.794, 3);
    expect(profile.einz.floorCount).toBe(22);
    expect(profile.einz.facadeGridM).toBe(1.35);
    expect(profile.einz.facadeBayCounts).toEqual([32, 18]);
    expect(profile.einz.dgmSceneGroundY).toBeCloseTo(5.51, 2);
    expect(profile.einz.podium.sourcePartId).toBe("DEBE3DMnbuS0Za6I");
    expect(profile.einz.podium.floorCount).toBe(6);
    expect(profile.einz.podium.measuredHeightM).toBeCloseTo(26.426, 3);
    expect(profile.europaplatzNorth.currentState).toContain("temporary 2026");
    expect(profile.europaplatzNorth.youngTreeCount).toBe(14);
    expect(profile.europaplatzNorth.lampCount).toBe(8);
    expect(profile.europaplatzNorth.constructionZoneCount).toBe(2);
    expect(profile.lehrterCampus.footprintWorldM).toHaveLength(6);
    expect(profile.lehrterCampus.currentState).toContain(
      "ground-floor concrete frame",
    );
    expect(profile.lehrterCampus.currentState).toContain(
      "full-height envelope is deliberately not rendered",
    );
    expect(profile.lehrterCampus.plannedEnvelopeHeightM).toBe(35.5);
    expect(profile.lehrterCampus.plannedStoreyCount).toBe(9);
    expect(profile.lehrterCampus.currentSlabTopM).toBeLessThan(6);
    expect(profile.lehrterCampus.geometryStatus).toContain("not a surveyed");
    expect(profile.lehrterCampus.observedOn).toBe("2026-08");
    expect(profile.fiftyHertz.sourceTowerPartId).toBe("DEBE3Dyir4lZjw1O");
    expect(profile.fiftyHertz.measuredHeightM).toBeCloseTo(54.975, 3);
    expect(profile.fiftyHertz.floorCount).toBe(13);
    expect(profile.fiftyHertz.groundY).toBeCloseTo(4.7, 1);
    expect(profile.fiftyHertz.dgmSceneGroundY).toBeCloseTo(4.57, 2);
    expect(profile.fiftyHertz.storeyTiers).toEqual([7, 13]);
    expect(profile.upbeat.osmWayId).toBe("1214009386");
    expect(profile.upbeat.footprintWorldM).toHaveLength(61);
    expect(profile.upbeat.storeyTiers).toEqual([5, 11, 19]);
    expect(profile.upbeat.heightM).toBe(82);
    expect(profile.upbeat.facadeBayPitchM).toBe(1.45);
    expect(profile.upbeat.facadeMaterial).toContain("anodised aluminium");
    expect(profile.upbeat.completedState).toContain("March 2026");
    expect(profile.upbeat.groundY).toBeCloseTo(2.92, 2);
    expect(profile.upbeat.terrainDgm1).toEqual({
      dhhn2016MedianM: 32.92,
      sampleCount: 2905,
      sceneRangeM: [1.62, 7.07],
      verticalOriginM: 30,
    });
    expect(profile.upbeat.tierTopHeightsM).toEqual([21.579, 47.474, 82]);
    expect(profile.einz.groundY + profile.einz.measuredHeightM).toBeGreaterThan(
      profile.upbeat.groundY + profile.upbeat.heightM,
    );
    expect(profile.upbeat.geometryStatus).toContain("plan-derived tier clips");
    expect(profile.sources).toHaveLength(15);
  });

  test("reconstructs the Invalidenfriedhof walls and mapped grave field", () => {
    const details = createExpandedCityDetails(landmarks);
    const profile = NORTHERN_CITY_PROFILE.invalidenfriedhof;
    expect(profile.cemeteryOsmWayId).toBe("51804411");
    expect(profile.graveWorldM.length).toBeGreaterThan(30);
    expect(profile.hinterlandWallOsmWayIds).toEqual([
      "1504490299",
      "1504490297",
    ]);
    expect(profile.geometryStatus).toContain("1902 canal brick boundary");
    expect(profile.sources).toHaveLength(3);
    const bodies = details.getObjectByName(
      "Invalidenfriedhof surveyed walls and graves bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(new Box3().setFromObject(bodies).min.z).toBeLessThan(-1580);
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
      distance_m: 244,
      target_height_m: 38,
      target_world: [
        EUROPACITY_PROFILE.upbeat.centerWorldM[0],
        dkb!.world[1],
        EUROPACITY_PROFILE.upbeat.centerWorldM[1],
      ],
    });
    const kpmg = landmarks.find(
      (landmark) => landmark.name === "KPMG Europacity",
    );
    expect(expandedCityFocusCamera(kpmg!)).toMatchObject({
      distance_m: 214,
      target_height_m: 42,
      target_world: [
        EUROPACITY_PROFILE.einz.centerWorldM[0],
        kpmg!.world[1],
        EUROPACITY_PROFILE.einz.centerWorldM[1],
      ],
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
    expect(KOLLHOFF_TOWER_PROFILE.parentBuildingId).toBe("DEBE01YYK0002KM6");
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
