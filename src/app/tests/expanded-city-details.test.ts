import { describe, expect, test } from "bun:test";
import {
  Box3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";

import {
  AMANO_GRAND_CENTRAL_PROFILE,
  BERLIN_MODERN_PROFILE,
  createExpandedCityDetails,
  EUROPACITY_PROFILE,
  expandedCityFocusCamera,
  funboxEntranceFocusCamera,
  HAMBURGER_BAHNHOF_PROFILE,
  INVALIDENFRIEDHOF_DETAIL_PROFILE,
  KONRAD_ADENAUER_HAUS_PROFILE,
  KULTURFORUM_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  MOABIT_PRISON_MEMORIAL_PROFILE,
  MOABIT_PRISON_PARK_SOURCE_PROFILE,
  NORTHERN_CITY_PROFILE,
  RIECKHALLEN_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
  POTSDAMER_PUBLIC_REALM_PROFILE,
  TILLA_DURIEUX_PROFILE,
  WELT_BALLOON_PROFILE,
} from "../src/ExpandedCityDetails";
import { moabitPrisonMemorialSolidAt } from "../src/MoabitPrisonMemorialPark";
import { pedestrianPointIsBlocked } from "../src/pedestrianNavigation";

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

type Point2 = readonly [number, number];

function pointToSegmentDistance(
  point: Point2,
  start: Point2,
  end: Point2,
): number {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaZ) /
              lengthSquared,
          ),
        );
  return Math.hypot(
    point[0] - (start[0] + amount * deltaX),
    point[1] - (start[1] + amount * deltaZ),
  );
}

function segmentDistance(
  a0: Point2,
  a1: Point2,
  b0: Point2,
  b1: Point2,
): number {
  const cross = (p0: Point2, p1: Point2, p2: Point2): number =>
    (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
  const aSide0 = cross(a0, a1, b0);
  const aSide1 = cross(a0, a1, b1);
  const bSide0 = cross(b0, b1, a0);
  const bSide1 = cross(b0, b1, a1);
  const oppositeSides = (first: number, second: number): boolean =>
    (first > 0 && second < 0) || (first < 0 && second > 0);
  const onSegment = (point: Point2, start: Point2, end: Point2): boolean =>
    Math.abs(cross(start, end, point)) < 1e-9 &&
    point[0] >= Math.min(start[0], end[0]) &&
    point[0] <= Math.max(start[0], end[0]) &&
    point[1] >= Math.min(start[1], end[1]) &&
    point[1] <= Math.max(start[1], end[1]);
  if (
    (oppositeSides(aSide0, aSide1) && oppositeSides(bSide0, bSide1)) ||
    onSegment(b0, a0, a1) ||
    onSegment(b1, a0, a1) ||
    onSegment(a0, b0, b1) ||
    onSegment(a1, b0, b1)
  ) {
    return 0;
  }
  return Math.min(
    pointToSegmentDistance(a0, b0, b1),
    pointToSegmentDistance(a1, b0, b1),
    pointToSegmentDistance(b0, a0, a1),
    pointToSegmentDistance(b1, a0, a1),
  );
}

function polylineDistance(a: readonly Point2[], b: readonly Point2[]): number {
  let closest = Number.POSITIVE_INFINITY;
  for (let aIndex = 0; aIndex < a.length - 1; aIndex += 1) {
    for (let bIndex = 0; bIndex < b.length - 1; bIndex += 1) {
      closest = Math.min(
        closest,
        segmentDistance(a[aIndex], a[aIndex + 1], b[bIndex], b[bIndex + 1]),
      );
    }
  }
  return closest;
}

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
    expect(KULTURFORUM_PROFILE.philharmonie.mainSourcePartId).toBe(
      "DEBE3DTtXzEkeXsu",
    );
    expect(KULTURFORUM_PROFILE.philharmonie.facadeBayCount).toBe(11);
    expect(KULTURFORUM_PROFILE.kammermusiksaal.mainSourcePartId).toBe(
      "DEBE3DbyaJ0e8oAr",
    );
    expect(KULTURFORUM_PROFILE.kammermusiksaal.facadeBayCount).toBe(9);
    expect(KULTURFORUM_PROFILE.staatsbibliothek.sourcePartCount).toBe(56);
    expect(KULTURFORUM_PROFILE.piazzetta.geometryStatus).toContain(
      "not surveyed paving",
    );
    expect(KULTURFORUM_PROFILE.sources).toHaveLength(3);
  });

  test("documents the source boundary of Potsdamer details", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.potsdamerDetails).toEqual(POTSDAMER_DETAIL_PROFILE);
    expect(details.userData.potsdamerPublicRealm).toEqual(
      POTSDAMER_PUBLIC_REALM_PROFILE,
    );
    expect(POTSDAMER_DETAIL_PROFILE.geometryStatus).toContain("schematic");
    expect(POTSDAMER_DETAIL_PROFILE.bahnTower.parentBuildingId).toBe(
      "DEBE01YYK0002KhX",
    );
    expect(POTSDAMER_DETAIL_PROFILE.bahnTower.measuredHeightM).toBeCloseTo(
      103.192,
      3,
    );
    expect(POTSDAMER_DETAIL_PROFILE.bahnTower.sourcePartIds).toHaveLength(3);
    expect(POTSDAMER_DETAIL_PROFILE.bahnTower.facadeArcWorldM).toHaveLength(12);
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
    expect(
      details.getObjectByName(POTSDAMER_PUBLIC_REALM_PROFILE.name),
    ).toBeDefined();
    const mall = landmarks.find(
      (landmark) => landmark.name === "Mall of Berlin",
    );
    expect(expandedCityFocusCamera(mall!)).toMatchObject({
      azimuth_degrees: 180,
      target_world: [mall!.world[0], mall!.world[1], mall!.world[2] - 48],
    });
  });

  test("rebuilds both Potsdamer station halls on their LoD2 squares", () => {
    const details = createExpandedCityDetails(landmarks);
    const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
    expect(profile.halls).toHaveLength(2);
    expect(profile.halls.map((hall) => hall.sourceBuildingId)).toEqual([
      "DEBE01YYK0002SCt",
      "DEBE01YYK0000BRX",
    ]);
    expect(profile.geometryStatus).toContain("Berlin LoD2 footprint rings");
    expect(profile.geometryStatus).toContain("not a component survey");
    expect(profile.roofBayCountAcross).toBe(10);
    expect(profile.roofBayCountDepth).toBe(6);

    expect(
      profile.halls.map((hall) => hall.footprintRingWorldM.length),
    ).toEqual([6, 10]);
    for (const hall of profile.halls) {
      const doubledArea = hall.footprintRingWorldM.reduce(
        (sum, [x, z], index, ring) => {
          const [nextX, nextZ] = ring[(index + 1) % ring.length];
          return sum + x * nextZ - nextX * z;
        },
        0,
      );
      expect(Math.abs(doubledArea) / 2).toBeCloseTo(hall.footprintAreaM2, 2);
      expect(hall.footprintSizeM[0]).toBeCloseTo(26.27, 1);
      expect(hall.footprintSizeM[1]).toBeCloseTo(26.25, 1);
    }
    expect(
      Math.hypot(
        profile.halls[1].centerWorldM[0] - profile.halls[0].centerWorldM[0],
        profile.halls[1].centerWorldM[1] - profile.halls[0].centerWorldM[1],
      ),
    ).toBeCloseTo(124.84, 1);

    const halls = details.getObjectByName(
      "Potsdamer Platz station entrance halls",
    );
    expect(halls).toBeDefined();
    const bounds = new Box3().setFromObject(halls!);
    expect(bounds.min.x).toBeCloseTo(267.4, 1);
    expect(bounds.max.x).toBeCloseTo(310.2, 1);
    expect(bounds.min.z).toBeCloseTo(999.9, 1);
    expect(bounds.max.z).toBeCloseTo(1152.8, 1);
    expect(bounds.max.y).toBeCloseTo(20.1, 1);
    expect(
      details.getObjectByName("Potsdamer Platz north hall fascia lettering"),
    ).toBeDefined();
    expect(
      details.getObjectByName("Potsdamer Platz south hall fascia lettering"),
    ).toBeDefined();
  });

  test("models Tilla-Durieux as one counter-twisted grass strip", () => {
    const details = createExpandedCityDetails(landmarks);
    const profile = TILLA_DURIEUX_PROFILE;
    expect(details.userData.tillaDurieux).toEqual(profile);
    expect(profile.surfaceForm).toContain("single grass strip");
    expect(profile.northLawn.osmWayId).toBe("840814492");
    expect(profile.southLawn.osmWayId).toBe("840814493");
    expect(profile.lawnWidthM).toBe(30);
    expect(profile.maxHeightM).toBeCloseTo(4.5, 3);
    expect(profile.seesawCount).toBe(5);
    expect(profile.seesawLengthM).toBe(21);
    expect(profile.centralCourtWidthM).toBe(profile.lawnWidthM);

    // North: the west edge falls away; south: the twist reverses. This is the
    // defining lawn sculpture, not two offset green boxes.
    expect(profile.northLawn.endHeightsM.west).toBeLessThan(
      profile.northLawn.endHeightsM.east,
    );
    expect(profile.southLawn.endHeightsM.west).toBeGreaterThan(
      profile.southLawn.endHeightsM.east,
    );
    expect(profile.northLawn.courtHeightsM).toEqual({ east: 1.7, west: 1.3 });
    expect(profile.southLawn.courtHeightsM).toEqual({ east: 0.7, west: 2.2 });
    expect(profile.centralCourtWorldM[1]).toBeGreaterThan(
      profile.northLawn.centerEastWorldM[1],
    );
    expect(profile.centralCourtWorldM[1]).toBeLessThan(
      profile.southLawn.centerEastWorldM[1],
    );

    const lawn = details.getObjectByName(
      "Tilla-Durieux-Park lawn sculpture bodies",
    ) as Mesh;
    expect(lawn).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(lawn);
    expect(bounds.min.x).toBeCloseTo(130.4, 0);
    expect(bounds.max.x).toBeCloseTo(304.9, 0);
    expect(bounds.min.z).toBeCloseTo(1205.8, 0);
    expect(bounds.max.z).toBeCloseTo(1619.5, 0);
    expect(bounds.min.y).toBeCloseTo(profile.groundY - profile.terrainBuryM, 2);
    expect(bounds.max.y).toBeCloseTo(profile.groundY + profile.maxHeightM, 2);
    expect(
      details.getObjectByName("Tilla-Durieux-Park lawn sculpture ink lines"),
    ).toBeDefined();

    // The drawn body is unlit by day and flat-shaded at night, so retaining a
    // per-vertex normal buffer would only duplicate data. The downward raycasts
    // below still verify the visible top-face winding.
    expect(lawn.geometry.getAttribute("normal")).toBeUndefined();

    const raycaster = new Raycaster();
    for (const [x, z] of [
      [250, 1314],
      [166, 1520],
    ] as const) {
      raycaster.set(new Vector3(x, 30, z), new Vector3(0, -1, 0));
      expect(raycaster.intersectObject(lawn).length).toBeGreaterThan(0);
    }
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

  test("reconstructs the Konrad-Adenauer-Haus from its surveyed glass plan", () => {
    const details = createExpandedCityDetails(landmarks);
    const profile = KONRAD_ADENAUER_HAUS_PROFILE;
    expect(details.userData.konradAdenauerHaus).toEqual(profile);
    expect(profile.osmWayId).toBe("25999445");
    expect(profile.buildingStoreys).toBe(6);
    expect(profile.glassEnvelopeStoreys).toBe(4);
    expect(profile.upperDeckStoreys).toBe(2);
    expect(profile.winterGardenRole).toContain("climate buffer");
    expect(profile.eavesHeightM).toBe(18);
    expect(profile.signageRendered).toBe(false);
    expect(profile.footprintWorldM).toHaveLength(6);
    const envelope = details.getObjectByName(
      "Konrad-Adenauer-Haus glass envelope bodies",
    ) as Mesh;
    expect(envelope).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(envelope);
    // The source polygon itself is exact; the rendered bounds include the
    // 16 cm facade-grid stroke just outside that plan.
    expect(Math.abs(bounds.min.x - -1436.888)).toBeLessThan(0.3);
    expect(Math.abs(bounds.max.x - -1378.764)).toBeLessThan(0.3);
    expect(Math.abs(bounds.min.z - 1299.21)).toBeLessThan(0.3);
    expect(Math.abs(bounds.max.z - 1379.604)).toBeLessThan(0.3);
    expect(bounds.max.y).toBeGreaterThan(profile.groundY + 24);
    expect(profile.sources).toHaveLength(5);
  });

  test("adds company signs and the blue-striped WELT balloon livery", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.getObjectByName("KPMG rooftop lettering")).toBeDefined();
    expect(details.getObjectByName("KPMG side lettering")).toBeDefined();
    expect(details.getObjectByName("DKB rooftop lettering")).toBeDefined();
    const envelope = details.getObjectByName(
      "WELT Balloon white envelope with blue stripes and curved black lettering",
    ) as Mesh;
    expect(envelope).toBeInstanceOf(Mesh);
    expect(envelope.userData.lettering).toBe("WELT");
    expect(envelope.userData.letteringColor).toBe(0x111416);
    expect(envelope.userData.livery).toContain("white");
    expect(envelope.userData.livery).toContain("blue");
    expect(envelope.userData.stripeColor).toBe(0x0b63a1);
    expect(envelope.userData.stripeCount).toBe(2);
    expect(details.getObjectByName("WELT rooftop lettering")).toBeUndefined();
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

  test("mounts exactly one dedicated source-bound Moabit memorial model", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.userData.moabitPrisonPark).toEqual(
      MOABIT_PRISON_MEMORIAL_PROFILE,
    );
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.sourceParkWayId).toBe("498278335");
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.parkRingWorldM).toHaveLength(22);
    expect(
      MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM,
    ).toHaveLength(4);
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallWayIds).toEqual([
      "53178124",
      "105495351",
      "498279237",
      "498279239",
    ]);
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.entranceCount).toBe(3);
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.circularYardCount).toBe(3);
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.reconstructedCellCount).toBe(0);
    expect(MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallHeightM).toBe(5);
    const dedicatedName =
      "Geschichtspark Moabit dedicated source-bound memorial park";
    let dedicatedCount = 0;
    details.traverse((object) => {
      if (object.name === dedicatedName) dedicatedCount += 1;
    });
    expect(dedicatedCount).toBe(1);
    expect(details.getObjectByName(dedicatedName)?.userData.detailProfile).toBe(
      "full",
    );
    expect(
      details.getObjectByName("Geschichtspark Moabit mapped walls and plan"),
    ).toBeUndefined();

    const mobile = createExpandedCityDetails(landmarks, {
      detailProfile: "mobile",
    });
    expect(mobile.getObjectByName(dedicatedName)?.userData.detailProfile).toBe(
      "mobile",
    );
  });

  test("keeps the polygonal Moabit walls safely west of the B96", () => {
    const profile = MOABIT_PRISON_PARK_SOURCE_PROFILE;
    const closedParkRing = [
      ...profile.parkRingWorldM,
      profile.parkRingWorldM[0],
    ] as readonly Point2[];
    const parkClearance = polylineDistance(
      closedParkRing,
      profile.b96CenterlineWorldM,
    );
    expect(parkClearance).toBeCloseTo(
      profile.minimumB96CenterlineClearanceM,
      1,
    );
    expect(parkClearance).toBeGreaterThan(17);

    const wallClearance = Math.min(
      ...profile.preservedWallPathsWorldM.map((path) =>
        polylineDistance(path, profile.b96CenterlineWorldM),
      ),
    );
    expect(wallClearance).toBeGreaterThan(17);
    const easternmostWallX = Math.max(
      ...profile.preservedWallPathsWorldM.flatMap((path) =>
        path.map(([x]) => x),
      ),
    );
    const westernmostRoadX = Math.min(
      ...profile.b96CenterlineWorldM.map(([x]) => x),
    );
    expect(easternmostWallX).toBeLessThan(westernmostRoadX);

    const rendered = createExpandedCityDetails([
      {
        name: "Geschichtspark Ehemaliges Zellengefängnis Moabit",
        world: [0, profile.groundY, 0],
      },
    ]).getObjectByName(
      "Geschichtspark Moabit dedicated source-bound memorial park",
    );
    const renderedBounds = new Box3().setFromObject(rendered!);
    expect(renderedBounds.max.x).toBeLessThanOrEqual(
      Math.max(...profile.parkRingWorldM.map(([x]) => x)) + 0.1,
    );
    expect(renderedBounds.max.x).toBeLessThan(westernmostRoadX);
  });

  test("keeps all three mapped Moabit gates and the retained-cell approach capsule-clear", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    const paths = profile.preservedWallPathsWorldM;
    const gateEndpointPairs = [
      [paths[0].at(-1)!, paths[1][0]],
      [paths[0].at(-1)!, paths[2][0]],
      [paths[2].at(-1)!, paths[3][0]],
    ] as const;
    const access = {
      // pedestrianPointIsBlocked already offsets seven body samples by the
      // 0.42 m capsule radius; do not inflate the analytical memorial twice.
      interiorSolidAt: (x: number, y: number, z: number) =>
        moabitPrisonMemorialSolidAt(x, y, z, 0),
    };

    for (const [start, end] of gateEndpointPairs) {
      const midpointX = (start[0] + end[0]) / 2;
      const midpointZ = (start[1] + end[1]) / 2;
      const deltaX = end[0] - start[0];
      const deltaZ = end[1] - start[1];
      const length = Math.hypot(deltaX, deltaZ);
      const normalX = -deltaZ / length;
      const normalZ = deltaX / length;
      for (let offset = -3; offset <= 3; offset += 0.15) {
        expect(
          pedestrianPointIsBlocked(
            midpointX + normalX * offset,
            midpointZ + normalZ * offset,
            profile.groundY,
            undefined,
            access,
          ),
          `mapped gate ${start.join(",")} -> ${end.join(",")} at ${offset.toFixed(2)} m`,
        ).toBeFalse();
      }
    }

    const panopticon = profile.panopticon.centerWorldM;
    const cellFootprint = profile.walkInCell.footprintWorldM;
    const cellCenter: Point2 = [
      cellFootprint.reduce((sum, point) => sum + point[0], 0) /
        cellFootprint.length,
      cellFootprint.reduce((sum, point) => sum + point[1], 0) /
        cellFootprint.length,
    ];
    const approachX = cellCenter[0] - panopticon[0];
    const approachZ = cellCenter[1] - panopticon[1];
    const approachLength = Math.hypot(approachX, approachZ);
    for (let distance = 8; distance <= approachLength - 3; distance += 0.2) {
      expect(
        pedestrianPointIsBlocked(
          panopticon[0] + (approachX / approachLength) * distance,
          panopticon[1] + (approachZ / approachLength) * distance,
          profile.groundY,
          undefined,
          access,
        ),
        `retained-cell approach at ${distance.toFixed(2)} m`,
      ).toBeFalse();
    }

    const wall = paths[0];
    const wallMidpoint: Point2 = [
      (wall[0][0] + wall[1][0]) / 2,
      (wall[0][1] + wall[1][1]) / 2,
    ];
    expect(
      pedestrianPointIsBlocked(
        wallMidpoint[0],
        wallMidpoint[1],
        profile.groundY,
        undefined,
        access,
      ),
    ).toBeTrue();
    const panopticonPost = profile.panopticon.ringWorldM[0];
    expect(
      pedestrianPointIsBlocked(
        panopticonPost[0],
        panopticonPost[1],
        profile.groundY,
        undefined,
        access,
      ),
    ).toBeTrue();
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
    expect(profile.entranceDomeWidthM).toBeCloseTo(19.2, 1);
    expect(profile.entranceDomeHeightM).toBeCloseTo(8.3, 1);
    expect(profile.entranceHoardingPanelCount).toBe(6);
    expect(profile.ownerReferenceCount).toBe(2);
    expect(profile.footprintWidthM * profile.footprintLengthM).toBeGreaterThan(
      profile.sourceAreaM2,
    );
    expect(profile.eventListingWorldM).toEqual([-140.167, -1134.842]);
    expect(profile.geometryStatus).toContain("free Wunderland lot");
    expect(profile.sources).toHaveLength(3);
    expect(
      details.getObjectByName("FUNBOX.COM entrance dome FUN lettering"),
    ).toBeDefined();
    expect(
      details.getObjectByName("FUNBOX.COM entrance dome BOX.COM lettering"),
    ).toBeDefined();
    expect(
      details.getObjectByName("FUNBOX ticket kiosk lettering"),
    ).toBeDefined();
    const entranceFocus = funboxEntranceFocusCamera();
    expect(entranceFocus).toMatchObject({
      azimuth_degrees: 90,
      distance_m: 90,
      polar_degrees: 62,
      target_height_m: 3.5,
    });
    expect(entranceFocus.target_world).toEqual([
      profile.centerWorldM[0] + Math.sin(profile.rotationY) * 52,
      profile.groundY,
      profile.centerWorldM[1] + Math.cos(profile.rotationY) * 52,
    ]);

    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    expect(bounds.min.y).toBeCloseTo(profile.groundY, 2);
    expect(bounds.max.y).toBeGreaterThan(profile.groundY + 8.5);
    expect(bounds.max.y).toBeLessThan(profile.groundY + 10);
    const horizontalSpans = [
      bounds.max.x - bounds.min.x,
      bounds.max.z - bounds.min.z,
    ].sort((left, right) => left - right);
    expect(horizontalSpans[0]).toBeGreaterThan(40);
    expect(horizontalSpans[1]).toBeGreaterThan(90);
    expect(expandedCityFocusCamera(oggi)).toMatchObject({
      azimuth_degrees: 156,
      distance_m: 60,
      polar_degrees: 75,
      target_height_m: 2.5,
      target_world: [oggi.world[0] + 4, oggi.world[1], oggi.world[2] + 2],
    });
  });

  test("keeps the Panke mouth as an east-west fish passage into Nordhafen", () => {
    const details = createExpandedCityDetails([]);
    const profile = NORTHERN_CITY_PROFILE.pankeMouth;
    expect(profile.flowDirection).toBe(
      "east-to-west-into-the-Nordhafen-forebasin",
    );
    expect(profile.fishPassDropM).toBe(2);
    expect(profile.osmWaterPolygonAreaM2).toBe(2_197);
    const fishPass = details.getObjectByName("Panke mouth fish-pass details");
    expect(fishPass).toBeDefined();
    expect(fishPass?.userData.sourceUrl).toContain("berlin.de");
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
    expect(profile.einz.primaryFinEveryBays).toBe(4);
    expect(profile.einz.entranceCanopyWidthM).toBeCloseTo(13.2, 1);
    expect(profile.einz.ownerReferenceCount).toBe(1);
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
    expect(
      INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.vonRauch
        .absorbedGenericSourcePointsWorldM,
    ).toContain(profile.graveWorldM[15]);
    details.updateMatrixWorld(true);
    const [absorbedX, absorbedZ] = profile.graveWorldM[15];
    const absorbedIntersections = new Raycaster(
      new Vector3(
        absorbedX,
        INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 3,
        absorbedZ,
      ),
      new Vector3(0, -1, 0),
      0,
      4,
    ).intersectObject(bodies);
    expect(absorbedIntersections).not.toHaveLength(0);
    expect(
      absorbedIntersections.some(
        ({ point }) =>
          point.y > INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 0.4,
      ),
    ).toBeFalse();
    expect(
      details.getObjectByName("Invalidenfriedhof granular isometric details"),
    ).toBeDefined();
    expect(details.userData.invalidenfriedhofDetails).toBe(
      INVALIDENFRIEDHOF_DETAIL_PROFILE,
    );
    expect(details.userData.sourceUrls).toEqual(
      expect.arrayContaining([
        INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell.sourceUrl,
        INVALIDENFRIEDHOF_DETAIL_PROFILE.litfinWatchtower.sourceUrl,
      ]),
    );
  });

  test("keeps the WELT balloon tall but introduces no duplicate Carillon", () => {
    const details = createExpandedCityDetails(landmarks);
    const bounds = new Box3().setFromObject(details);
    expect(bounds.max.y).toBeGreaterThan(85);
    expect(
      details.getObjectByName("Granular 42 m Carillon im Tiergarten"),
    ).toBeUndefined();
    expect(details.userData.geometryStatus).toContain("LoD2 remains");
    expect(details.userData.weltBalloon).toEqual(WELT_BALLOON_PROFILE);
    expect(WELT_BALLOON_PROFILE.model).toBe("FK-5500/STU");
    expect(WELT_BALLOON_PROFILE.envelopeDiameterM).toBeCloseTo(22.67, 2);
    expect(WELT_BALLOON_PROFILE.gondolaDiameterM).toBeCloseTo(5.9, 2);
    expect(WELT_BALLOON_PROFILE.tetherDiameterM).toBeCloseTo(0.022, 3);
    expect(WELT_BALLOON_PROFILE.repeatedWordCount).toBe(4);
    expect(WELT_BALLOON_PROFILE.envelopeBlueStripeColor).toBe(0x0b63a1);
    expect(WELT_BALLOON_PROFILE.envelopeBlueStripeCount).toBe(2);
    expect(WELT_BALLOON_PROFILE.visualReferences).toHaveLength(2);
    expect(
      WELT_BALLOON_PROFILE.visualReferences.every(
        (reference) => reference.artist && reference.license,
      ),
    ).toBe(true);
    expect(
      details.getObjectByName(
        "WELT Balloon gondola cable net and ground winch bodies",
      ),
    ).toBeDefined();
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
      distance_m: 182,
      target_height_m: 35,
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
