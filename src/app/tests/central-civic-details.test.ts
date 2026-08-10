import { describe, expect, test } from "bun:test";
import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import {
  BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD,
  BUNDESTAG_KITA_SOURCE,
  BUNDESTAG_KITA_WORLD,
  CUBE_BERLIN_FOOTPRINT_WORLD,
  CUBE_BERLIN_HEIGHT_M,
  CUBE_BERLIN_PRISM_IDS,
  PARISER_PLATZ_GARDENS,
  TEAR_PALACE_FOOTPRINT_WORLD,
  TEAR_PALACE_PRISM_IDS,
  centralCivicDetailsVisible,
  centralCivicFocusCamera,
  createCentralCivicDetails,
  FUTURIUM_BUILDING_ID,
  FUTURIUM_DREHMOMENT_WORLD,
  FUTURIUM_FOOTPRINT_WORLD,
  FUTURIUM_HEIGHT_M,
  TOPOGRAPHY_WALL_LENGTH_M,
  TOPOGRAPHY_WALL_ROTATION_RAD,
  TOPOGRAPHY_WALL_SECTION_COUNT,
} from "../src/CentralCivicDetails";

const names = [
  "Tramhaltestelle S+U Hauptbahnhof",
  "S15-Station Berlin Hauptbahnhof",
  "Oggi's Gemüsekebab",
  "Taxistand Washingtonplatz",
  "Futurium",
  "Bundesministerium für Forschung, Technologie und Raumfahrt",
  "Parlament der Bäume gegen Krieg und Gewalt",
  "Berliner Ensemble",
  "Bahnhof Berlin Friedrichstraße",
  "Bundesministerium der Finanzen / Detlev-Rohwedder-Haus",
  "Gropius Bau",
  "Abgeordnetenhaus von Berlin",
  "Topographie des Terrors",
  "Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend",
];

const landmarks = names.map((name, index) => ({
  name,
  world: [index * 280, 4, (index % 3) * 320] as [number, number, number],
}));

describe("task-11 central transit and civic details", () => {
  test("batches official-anchor recognition details into one flat draw layer", () => {
    const details = createCentralCivicDetails(landmarks);
    const bodies = details.getObjectByName(
      "Central transit and civic details bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(bodies.geometry.getAttribute("color").count).toBeGreaterThan(8_000);
    expect(bodies.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(bodies.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(details.userData.keepInMinecraft).toBe(true);
    expect(details.userData.geometryStatus).toContain("LoD2");
  });

  test("ships night-capable windows and headlamps without landmark dots", () => {
    const details = createCentralCivicDetails(landmarks);
    const lamps = details.getObjectByName(
      "Central transit and civic details lamps",
    ) as Mesh;
    expect(lamps).toBeInstanceOf(Mesh);
    expect(lamps.geometry.getAttribute("color").count).toBeGreaterThan(4_000);
    expect(lamps.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(details.getObjectByName("landmark dots")).toBeUndefined();
  });

  test("adds transit, theatre and S15 lettering", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(details.getObjectByName("OGGI civic lettering")).toBeDefined();
    expect(
      details.getObjectByName("BERLINER ENSEMBLE civic lettering"),
    ).toBeDefined();
    expect(details.getObjectByName("S15 civic lettering")).toBeDefined();
    expect(
      details.getObjectByName("Berliner Ensemble circular rooftop sign"),
    ).toBeDefined();
    expect(
      details.getObjectByName("Berliner Ensemble red circular roof emblem"),
    ).toBeDefined();
  });

  test("pins Pariser Platz, Cube and Tränenpalast to surveyed outlines", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(PARISER_PLATZ_GARDENS).toHaveLength(2);
    expect(BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD).toEqual([
      576.06, 4.8, 286.37,
    ]);
    expect(details.userData.pariserPlatz).toMatchObject({
      gardens: PARISER_PLATZ_GARDENS,
      subwayEntranceWorld: BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD,
    });
    expect(CUBE_BERLIN_HEIGHT_M).toBe(43.6);
    expect(CUBE_BERLIN_FOOTPRINT_WORLD).toHaveLength(4);
    expect(details.userData.cubeBerlin).toMatchObject({
      footprintWorld: CUBE_BERLIN_FOOTPRINT_WORLD,
      heightM: CUBE_BERLIN_HEIGHT_M,
      prismIds: CUBE_BERLIN_PRISM_IDS,
    });
    expect(TEAR_PALACE_FOOTPRINT_WORLD.length).toBeGreaterThan(10);
    expect(details.userData.tearPalace).toMatchObject({
      footprintWorld: TEAR_PALACE_FOOTPRINT_WORLD,
      prismIds: TEAR_PALACE_PRISM_IDS,
    });
    expect(details.userData.friedrichstrasseStation).toMatchObject({
      footprintM: [146, 72],
      roofCount: 2,
    });
    expect(details.userData.economicsMinistry.source).toContain("Berlin LoD2");
  });

  test("keeps the Topography wall as the documented 200 m ruin", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(TOPOGRAPHY_WALL_LENGTH_M).toBe(200);
    expect(TOPOGRAPHY_WALL_SECTION_COUNT).toBe(20);
    expect(TOPOGRAPHY_WALL_ROTATION_RAD).toBeCloseTo(0.0742, 4);
    expect(details.userData.topographyWall).toMatchObject({
      lengthM: 200,
      sectionCount: 20,
      state: "preserved 1989/90 ruin with security fence",
      traceRotationRad: TOPOGRAPHY_WALL_ROTATION_RAD,
    });
  });

  test("anchors the Bundestag Kita to OSM and LoD2 evidence", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(BUNDESTAG_KITA_WORLD).toEqual([255.8, 5.245, -250.4]);
    expect(details.userData.bundestagKita).toEqual({
      geometryAnchor: "OSM way 30349234 + Berlin LoD2",
      source: BUNDESTAG_KITA_SOURCE,
      world: BUNDESTAG_KITA_WORLD,
    });
  });

  test("rebuilds Futurium from its metric LoD2 footprint", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(details.userData.futurium).toEqual({
      buildingId: FUTURIUM_BUILDING_ID,
      drehmomentWorld: FUTURIUM_DREHMOMENT_WORLD,
      footprintAreaM2: 4034,
      footprintWorld: FUTURIUM_FOOTPRINT_WORLD,
      heightM: FUTURIUM_HEIGHT_M,
      source: "Berlin LoD2 + OSM + Futurium architecture specification",
    });
    expect(FUTURIUM_HEIGHT_M).toBeCloseTo(19.9);
    expect(FUTURIUM_FOOTPRINT_WORLD).toHaveLength(5);
  });

  test("provides contextual camera framing for the new QA anchors", () => {
    const futurium = landmarks.find(({ name }) => name === "Futurium")!;
    const tram = landmarks.find(({ name }) =>
      name.startsWith("Tramhaltestelle"),
    )!;
    expect(centralCivicFocusCamera(futurium)).toMatchObject({
      distance_m: 168,
      target_world: futurium.world,
    });
    expect(centralCivicFocusCamera(tram)).toMatchObject({
      distance_m: 176,
      target_world: tram.world,
    });
  });

  test("keeps the same recognition coordinates in every surface mode", () => {
    for (const mode of ["day", "night", "minecraft", "snowstorm"]) {
      expect(centralCivicDetailsVisible(false), mode).toBe(true);
    }
    expect(centralCivicDetailsVisible(true)).toBe(false);
  });
});
