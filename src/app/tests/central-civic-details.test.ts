import { describe, expect, test } from "bun:test";
import {
  Box3,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import {
  BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD,
  BERLINER_ENSEMBLE_PROFILE,
  PARISER_PLATZ_PHOTO_DETAIL_PROFILE,
  BUNDESTAG_KITA_BODY_FOOTPRINT_WORLD,
  BUNDESTAG_KITA_DIAGONAL_PATH_OSM_WAY_ID,
  BUNDESTAG_KITA_DIAGONAL_PATH_WORLD,
  BUNDESTAG_KITA_PATH_CLEARANCE_M,
  BUNDESTAG_KITA_ROOF_FOOTPRINT_WORLD,
  BUNDESTAG_KITA_SOURCE,
  BUNDESTAG_KITA_WORLD,
  BUNDESTAG_SPREE_CONNECTION_PROFILE,
  CUBE_BERLIN_FACADE_PROFILE,
  CUBE_BERLIN_FOOTPRINT_WORLD,
  CUBE_BERLIN_HEIGHT_M,
  CUBE_BERLIN_PRISM_IDS,
  EMBASSY_DETAIL_PROFILES,
  FRIEDRICHSTRASSE_STATION_HEIGHT_M,
  FRIEDRICHSTRASSE_STATION_LENGTH_M,
  FRIEDRICHSTRASSE_STATION_PLATFORM_COUNT,
  FRIEDRICHSTRASSE_STATION_ROTATION_RAD,
  FRIEDRICHSTRASSE_STATION_SOURCE,
  FRIEDRICHSTRASSE_STATION_TRACK_COUNT,
  FRIEDRICHSTRASSE_STATION_WIDTH_M,
  HAUPTBAHNHOF_TRAM_OSM_ROTATION_RAD,
  HAUPTBAHNHOF_TRAM_SOURCE_WAY_ID,
  MELH_SPREE_FRONT_PROFILE,
  OGGIS_MUBIS_PROFILE,
  PARISER_PLATZ_CENTRAL_PAVING,
  PARISER_PLATZ_GARDENS,
  TEAR_PALACE_FOOTPRINT_WORLD,
  TEAR_PALACE_PRISM_IDS,
  centralCivicDetailsVisible,
  centralCivicFocusCamera,
  createCentralCivicDetails,
  createBundestagSpreeConnection,
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
  "Pariser Platz",
  "Reichstagsvorfeld / Berlin-Pavillon",
];

const landmarks = names.map((name, index) => ({
  name,
  world: [index * 280, 4, (index % 3) * 320] as [number, number, number],
}));

type Point2 = readonly [number, number];

function pointSegmentDistance(point: Point2, start: Point2, end: Point2) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared,
    ),
  );
  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dz),
  );
}

function cross(a: Point2, b: Point2, c: Point2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(
  a: Point2,
  b: Point2,
  c: Point2,
  d: Point2,
): boolean {
  return (
    cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
  );
}

function segmentDistance(a: Point2, b: Point2, c: Point2, d: Point2): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

function minimumRingToLineDistance(
  ring: readonly Point2[],
  line: readonly Point2[],
): number {
  return Math.min(
    ...ring.flatMap((start, ringIndex) =>
      line
        .slice(0, -1)
        .map((lineStart, lineIndex) =>
          segmentDistance(
            start,
            ring[(ringIndex + 1) % ring.length],
            lineStart,
            line[lineIndex + 1],
          ),
        ),
    ),
  );
}

describe("task-11 central transit and civic details", () => {
  test("aligns the Hauptbahnhof tram platform with its OSM track axis", () => {
    expect(HAUPTBAHNHOF_TRAM_SOURCE_WAY_ID).toBe("1049894514");
    expect(HAUPTBAHNHOF_TRAM_OSM_ROTATION_RAD).toBeCloseTo(0.4461257685, 8);
  });

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
    expect(details.userData.oggisMubis).toMatchObject({
      ownerReferenceCount: 1,
      photographsBundled: false,
    });
  });

  test("replaces the false Spree wall with both open Bundestag bridges and the mapped MELH front", () => {
    const connection = createBundestagSpreeConnection();
    expect(connection.userData.keepInMinecraft).toBe(true);
    expect(connection.userData.photoTexturesBundled).toBe(false);
    expect(BUNDESTAG_SPREE_CONNECTION_PROFILE).toMatchObject({
      lowerBridge: {
        curveSagittaM: -1.31,
        name: "Marie-Elisabeth-Lüders-Steg",
      },
      osmWayId: "30596778",
      upperBridge: {
        lod2BuildingId: "DEBE01YYK0001zDa",
        name: "Jakob-Maria-Mierscheid-Steg",
        structuralHeightM: 10,
        widthM: 2.9,
      },
    });
    expect(
      BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge.deckY -
        BUNDESTAG_SPREE_CONNECTION_PROFILE.lowerBridge.deckY,
    ).toBeGreaterThan(10);
    const [upperStart, upperEnd] =
      BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge.centrelineWorld;
    expect(
      Math.hypot(
        upperEnd[0] - upperStart[0],
        upperEnd[1] - upperStart[1],
      ),
    ).toBeCloseTo(62.6065, 3);
    expect(
      BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge.envelopeTopY -
        BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge.envelopeBottomY,
    ).toBe(10);
    expect(BUNDESTAG_SPREE_CONNECTION_PROFILE.sources).toEqual(
      expect.arrayContaining([
        "https://www.openstreetmap.org/way/30596778",
        "https://www.bundestag.de/webarchiv/textarchiv/2012/40236033_kw33_melh_haus-209142",
        "https://bilddatenbank.bundestag.de/site/picture-detail?id=5005709",
        expect.stringContaining("bundestag.de/resource/blob/272544/"),
      ]),
    );

    const bridges = connection.getObjectByName("Bundestag Spree bridges");
    const lowerBridgeBodies = connection.getObjectByName(
      "Marie-Elisabeth-Lüders-Steg bodies",
    );
    const upperBridgeBodies = connection.getObjectByName(
      "Jakob-Maria-Mierscheid-Steg bodies",
    );
    expect(bridges?.userData).toMatchObject({
      lowerBridgeName: "Marie-Elisabeth-Lüders-Steg",
      openFrame: true,
      upperBridgeName: "Jakob-Maria-Mierscheid-Steg",
    });
    expect(lowerBridgeBodies).toBeInstanceOf(Mesh);
    expect(upperBridgeBodies).toBeInstanceOf(Mesh);
    const lowerBridgeBounds = new Box3().setFromObject(lowerBridgeBodies!);
    const upperBridgeBounds = new Box3().setFromObject(upperBridgeBodies!);
    expect(lowerBridgeBounds.max.x - lowerBridgeBounds.min.x).toBeGreaterThan(
      129,
    );
    expect(lowerBridgeBounds.min.y).toBeLessThan(7.1);
    expect(Math.abs(BUNDESTAG_SPREE_CONNECTION_PROFILE.lowerBridge.curveSagittaM))
      .toBeGreaterThan(1);
    expect(Math.abs(BUNDESTAG_SPREE_CONNECTION_PROFILE.lowerBridge.curveSagittaM))
      .toBeLessThan(2);
    expect(upperBridgeBounds.max.x - upperBridgeBounds.min.x).toBeGreaterThan(
      62.5,
    );
    expect(upperBridgeBounds.max.x - upperBridgeBounds.min.x).toBeLessThan(63);
    expect(upperBridgeBounds.min.y).toBeCloseTo(
      BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge.envelopeBottomY,
      3,
    );
    expect(upperBridgeBounds.max.y).toBeCloseTo(
      BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge.envelopeTopY,
      3,
    );

    const frontage = connection.getObjectByName(
      "Marie-Elisabeth-Lüders-Haus Spree facade",
    );
    expect(frontage?.userData).toMatchObject({
      canopySupportCount: 3,
      circularOpening: true,
      stairOsmWayId: "1393129898",
      stairWidensUpward: true,
    });
    expect(MELH_SPREE_FRONT_PROFILE.stair).toMatchObject({
      centrelineWorld: [
        [411.10745, -109.12252],
        [443.184148, -98.40888],
      ],
      osmWayId: "1393129898",
      widthBottomM: 3,
      widthTopM: 25,
    });
    expect(MELH_SPREE_FRONT_PROFILE.stair.widthTopM).toBeGreaterThan(
      MELH_SPREE_FRONT_PROFILE.stair.widthBottomM * 8,
    );

    const details = createCentralCivicDetails(landmarks);
    expect(details.userData.bundestagSpreeConnection).toEqual({
      bridge: BUNDESTAG_SPREE_CONNECTION_PROFILE,
      facade: MELH_SPREE_FRONT_PROFILE,
      sourceStack: "Berlin LoD2 + OSM + Deutscher Bundestag",
    });
    expect(
      details.getObjectByName(
        "Bundestag Spree connection recognition model",
      ),
    ).toBeDefined();
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

  test("adds transit and S15 lettering without the retired theatre shell", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(details.userData.hauptbahnhofTransit).toEqual({
      taxiCount: 5,
      taxiType: "Berlin ivory saloons with roof signs, lamps and four wheels",
      tramCount: 1,
      tramType:
        "yellow five-section Flexity presentation model with articulated joints, doors, bogies and pantograph",
    });
    expect(details.getObjectByName("OGGI civic lettering")).toBeDefined();
    expect(
      details.getObjectByName("GEMUESEKEBAB civic lettering"),
    ).toBeDefined();
    expect(details.getObjectByName("MUBIS civic lettering")).toBeDefined();
    expect(details.getObjectByName("CITY IMBISS civic lettering")).toBeDefined();
    const oggiAnchor = landmarks.find(
      ({ name }) => name === "Oggi's Gemüsekebab",
    )!;
    const mubisSign = details.getObjectByName("MUBIS civic lettering")!;
    const rotation = OGGIS_MUBIS_PROFILE.rotationY;
    const localX = OGGIS_MUBIS_PROFILE.mubis.centerLocalX;
    const localZ = -2.56;
    expect(mubisSign.position.x).toBeCloseTo(
      oggiAnchor.world[0] + localX * Math.cos(rotation) + localZ * Math.sin(rotation),
      5,
    );
    expect(mubisSign.position.z).toBeCloseTo(
      oggiAnchor.world[2] - localX * Math.sin(rotation) + localZ * Math.cos(rotation),
      5,
    );
    expect(mubisSign.rotation.y).toBeCloseTo(rotation + Math.PI, 5);
    expect(OGGIS_MUBIS_PROFILE.oggi.widthM).toBeCloseTo(8.8, 1);
    expect(OGGIS_MUBIS_PROFILE.mubis.centerLocalX).toBeCloseTo(9.2, 1);
    expect(details.getObjectByName("S15 civic lettering")).toBeDefined();
    expect(
      details.getObjectByName("Berliner Ensemble circular rooftop sign"),
    ).toBeUndefined();
    expect(
      details.getObjectByName("Berliner Ensemble open red neon roof ring"),
    ).toBeUndefined();
    expect(
      details.getObjectByName("BERLINER ENSEMBLE civic lettering"),
    ).toBeUndefined();
    expect(
      details.getObjectByName("Berliner Ensemble details"),
    ).toBeUndefined();
  });

  test("keeps Brecht on the square and Weigel in the theatre courtyard", () => {
    const details = createCentralCivicDetails(landmarks);
    const publicArt = details.getObjectByName(
      "Berliner Ensemble public-art details",
    );
    expect(publicArt).toBeDefined();
    expect(publicArt?.userData.brechtSite).toBe("Bertolt-Brecht-Platz");
    expect(publicArt?.userData.heleneWeigelSite).toBe("Helene-Weigel-Hof");
    expect(publicArt?.userData.brechtMonumentWorld).toEqual([
      1026.376, -349.777,
    ]);
    expect(publicArt?.userData.heleneWeigelCourtyardWorld).toEqual([
      965.8, -361.8,
    ]);
    expect(publicArt?.userData.brechtOsmKey).toBe("node/988668382");
    expect(publicArt?.userData.heleneWeigelOsmKey).toBe("node/13841652635");
    expect(BERLINER_ENSEMBLE_PROFILE.sources).toHaveLength(4);
  });

  test("pins Pariser Platz, Cube and Tränenpalast to surveyed outlines", () => {
    const details = createCentralCivicDetails(landmarks);
    expect(PARISER_PLATZ_GARDENS).toHaveLength(2);
    expect(PARISER_PLATZ_CENTRAL_PAVING).toEqual({
      centre: [497.05, 294.5],
      rotationRad: 0.087,
      size: [76.4, 23.8],
      topY: 5.03,
    });
    expect(BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD).toEqual([
      576.06, 4.8, 286.37,
    ]);
    expect(details.userData.pariserPlatz).toMatchObject({
      gardens: PARISER_PLATZ_GARDENS,
      photoDetailProfile: PARISER_PLATZ_PHOTO_DETAIL_PROFILE,
      subwayEntranceWorld: BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD,
    });
    const pariserPlatzDetails = details.getObjectByName(
      "Pariser Platz photo-bounded fine detail",
    );
    expect(pariserPlatzDetails).toBeDefined();
    expect(pariserPlatzDetails!.userData).toMatchObject({
      ...PARISER_PLATZ_PHOTO_DETAIL_PROFILE,
      photographsBundled: false,
    });
    expect(PARISER_PLATZ_PHOTO_DETAIL_PROFILE).toMatchObject({
      continuousFlowerBedCount: 8,
      formalLawnCount: 2,
      formalTopiaryCount: 4,
      fountainBasinCount: 2,
      fountainJetCount: 2,
      gardenRailPostCount: 96,
      sourceViewCount: 6,
    });
    const civicBodies = details.getObjectByName(
      "Central transit and civic details bodies",
    ) as Mesh;
    const civicColours = civicBodies.geometry.getAttribute("color");
    const civicPositions = civicBodies.geometry.getAttribute("position");
    const lawnColour = new Color(0x8db978);
    const hasFormalLawn = Array.from(
      { length: civicColours.count },
      (_, index) =>
        Math.abs(civicColours.getX(index) - lawnColour.r) < 0.00001 &&
        Math.abs(civicColours.getY(index) - lawnColour.g) < 0.00001 &&
        Math.abs(civicColours.getZ(index) - lawnColour.b) < 0.00001,
    ).some(Boolean);
    expect(hasFormalLawn).toBe(true);
    const pavingColour = new Color(0xc3c3bd);
    const pavingVertices = Array.from(
      { length: civicColours.count },
      (_, index) => index,
    ).filter(
      (index) =>
        Math.abs(civicColours.getX(index) - pavingColour.r) < 0.00001 &&
        Math.abs(civicColours.getY(index) - pavingColour.g) < 0.00001 &&
        Math.abs(civicColours.getZ(index) - pavingColour.b) < 0.00001,
    );
    expect(pavingVertices).toHaveLength(24);
    expect(
      Math.max(...pavingVertices.map((index) => civicPositions.getY(index))),
    ).toBeCloseTo(PARISER_PLATZ_CENTRAL_PAVING.topY, 4);
    expect(
      pariserPlatzDetails!.getObjectByName(
        "Pariser Platz photo-bounded fine detail lamps",
      ),
    ).toBeDefined();
    expect(CUBE_BERLIN_HEIGHT_M).toBe(43.6);
    expect(CUBE_BERLIN_FOOTPRINT_WORLD).toHaveLength(4);
    expect(CUBE_BERLIN_FACADE_PROFILE).toEqual({
      facadeCount: 4,
      foldFacetCount: 16,
      glassElementTypes: 12,
      nightWindowCount: 28,
      officialCubeSideM: 42.5,
      panelColumnsPerFacade: 22,
      roofTenantSign: "GLEISS LUTZ",
      sourceUrl: "https://3xn.com/project/cube-berlin",
      storeyBands: 10,
    });
    expect(
      details.getObjectByName("GLEISS LUTZ civic lettering"),
    ).toBeDefined();
    expect(details.userData.cubeBerlin).toMatchObject({
      facadeProfile: CUBE_BERLIN_FACADE_PROFILE,
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
      curveSagM: 6,
      entranceDetails:
        "stepped clinker portal, black terracotta, five-door vestibule, clock and glass canopy",
      footprintM: [
        FRIEDRICHSTRASSE_STATION_LENGTH_M,
        FRIEDRICHSTRASSE_STATION_WIDTH_M,
      ],
      heightM: FRIEDRICHSTRASSE_STATION_HEIGHT_M,
      platformCount: FRIEDRICHSTRASSE_STATION_PLATFORM_COUNT,
      roofCount: 2,
      roofProfile:
        "two shallow Tudor-arch sheds on the surveyed Stadtbahn curve",
      sourceUrl: FRIEDRICHSTRASSE_STATION_SOURCE,
      trackCount: FRIEDRICHSTRASSE_STATION_TRACK_COUNT,
    });
    expect(FRIEDRICHSTRASSE_STATION_ROTATION_RAD).toBeCloseTo(-0.31);
    expect(details.userData.economicsMinistry.source).toContain("Berlin LoD2");
  });

  test("pins the three embassy facades to their Berlin LoD2 envelopes", () => {
    expect(EMBASSY_DETAIL_PROFILES.france).toMatchObject({
      anchorWorld: [540.48, 4.7, 204.53],
      buildingId: "DEBE3DvO9qerwgls",
    });
    expect(EMBASSY_DETAIL_PROFILES.france.description).toContain(
      "Rue de France",
    );
    expect(EMBASSY_DETAIL_PROFILES.unitedKingdom).toMatchObject({
      anchorWorld: [619.47, 4.6, 368.73],
      buildingId: "DEBE3DzLVkos5eqV",
    });
    expect(EMBASSY_DETAIL_PROFILES.unitedKingdom.description).toContain(
      "purple cylindrical",
    );
    expect(EMBASSY_DETAIL_PROFILES.hungary).toMatchObject({
      anchorWorld: [646.74, 4.7, 235.81],
      buildingId: "DEBE3DsydVaNVYh5",
    });
    expect(EMBASSY_DETAIL_PROFILES.hungary.description).toContain(
      "fully glazed base",
    );
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
      bodyFootprintWorld: BUNDESTAG_KITA_BODY_FOOTPRINT_WORLD,
      diagonalPathOsmWayId: BUNDESTAG_KITA_DIAGONAL_PATH_OSM_WAY_ID,
      diagonalPathWorld: BUNDESTAG_KITA_DIAGONAL_PATH_WORLD,
      geometryAnchor: "OSM way 30349234 + Berlin LoD2",
      pathClearanceM: BUNDESTAG_KITA_PATH_CLEARANCE_M,
      roofFootprintWorld: BUNDESTAG_KITA_ROOF_FOOTPRINT_WORLD,
      source: BUNDESTAG_KITA_SOURCE,
      world: BUNDESTAG_KITA_WORLD,
    });
    expect(BUNDESTAG_KITA_BODY_FOOTPRINT_WORLD).toHaveLength(7);
    expect(BUNDESTAG_KITA_ROOF_FOOTPRINT_WORLD).toHaveLength(8);
    expect(BUNDESTAG_KITA_PATH_CLEARANCE_M).toBeGreaterThanOrEqual(2.3);
    expect(
      minimumRingToLineDistance(
        BUNDESTAG_KITA_BODY_FOOTPRINT_WORLD,
        BUNDESTAG_KITA_DIAGONAL_PATH_WORLD,
      ),
    ).toBeGreaterThan(BUNDESTAG_KITA_PATH_CLEARANCE_M);
    expect(
      minimumRingToLineDistance(
        BUNDESTAG_KITA_ROOF_FOOTPRINT_WORLD,
        BUNDESTAG_KITA_DIAGONAL_PATH_WORLD,
      ),
    ).toBeGreaterThan(BUNDESTAG_KITA_PATH_CLEARANCE_M);
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
    const pariserPlatz = landmarks.find(
      ({ name }) => name === "Pariser Platz",
    )!;
    const ensemble = landmarks.find(
      ({ name }) => name === "Berliner Ensemble",
    )!;
    const tram = landmarks.find(({ name }) =>
      name.startsWith("Tramhaltestelle"),
    )!;
    const friedrichstrasse = landmarks.find(
      ({ name }) => name === "Bahnhof Berlin Friedrichstraße",
    )!;
    const pavilion = landmarks.find(
      ({ name }) => name === "Reichstagsvorfeld / Berlin-Pavillon",
    )!;
    const oggi = landmarks.find(
      ({ name }) => name === "Oggi's Gemüsekebab",
    )!;
    expect(centralCivicFocusCamera(futurium)).toMatchObject({
      distance_m: 168,
      target_world: futurium.world,
    });
    expect(centralCivicFocusCamera(pariserPlatz)).toEqual({
      azimuth_degrees: 88,
      distance_m: 128,
      polar_degrees: 72,
      target_height_m: 7,
      target_world: pariserPlatz.world,
    });
    expect(centralCivicFocusCamera(ensemble)).toMatchObject({
      azimuth_degrees: 121,
      distance_m: 128,
      polar_degrees: 62,
      target_height_m: 10.5,
      target_world: [988.9, 4, -327.3],
    });
    expect(centralCivicFocusCamera(tram)).toMatchObject({
      distance_m: 176,
      target_world: tram.world,
    });
    expect(centralCivicFocusCamera(oggi)).toMatchObject({
      azimuth_degrees: 156,
      distance_m: 60,
      polar_degrees: 75,
      target_height_m: 2.5,
      target_world: [
        oggi.world[0] + OGGIS_MUBIS_PROFILE.focusTargetOffsetWorldM[0],
        oggi.world[1],
        oggi.world[2] + OGGIS_MUBIS_PROFILE.focusTargetOffsetWorldM[1],
      ],
    });
    expect(centralCivicFocusCamera(friedrichstrasse)).toMatchObject({
      azimuth_degrees: -138,
      distance_m: 224,
      target_world: [
        friedrichstrasse.world[0] + 2.4,
        friedrichstrasse.world[1],
        friedrichstrasse.world[2] - 12.2,
      ],
    });
    expect(centralCivicFocusCamera(pavilion)).toMatchObject({
      azimuth_degrees: 192,
      distance_m: 56,
      polar_degrees: 76,
      target_world: [156.05, 7.6, 144.35],
    });
  });

  test("keeps the same recognition coordinates in every surface mode", () => {
    for (const mode of ["day", "night", "minecraft", "snowstorm"]) {
      expect(centralCivicDetailsVisible(false), mode).toBe(true);
    }
    expect(centralCivicDetailsVisible(true)).toBe(false);
  });
});
