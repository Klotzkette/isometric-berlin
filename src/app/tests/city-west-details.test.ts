import { describe, expect, test } from "bun:test";
import {
  Box3,
  Color,
  Raycaster,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";

import {
  CITY_WEST_PROFILE,
  CITY_WEST_RENDER_BUDGET,
  CITY_WEST_SOURCE_URLS,
  createCityWestDetails,
} from "../src/CityWestDetails";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";

function geometryBudget(root: Object3D): {
  renderables: number;
  vertices: number;
} {
  let renderables = 0;
  let vertices = 0;
  root.traverse((object) => {
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    if (!geometry) return;
    renderables += 1;
    vertices += geometry.getAttribute("position")?.count ?? 0;
  });
  return { renderables, vertices };
}

function hasGeometryColor(root: Object3D, color: number): boolean {
  const target = new Color(color);
  const compactPaletteTolerance = 1 / 255 + Number.EPSILON;
  let found = false;
  root.traverse((object) => {
    if (found) return;
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    const colors = geometry?.getAttribute("color");
    if (!colors) return;
    for (let index = 0; index < colors.count; index += 1) {
      if (
        Math.abs(colors.getX(index) - target.r) <= compactPaletteTolerance &&
        Math.abs(colors.getY(index) - target.g) <= compactPaletteTolerance &&
        Math.abs(colors.getZ(index) - target.b) <= compactPaletteTolerance
      ) {
        found = true;
        return;
      }
    }
  });
  return found;
}

function localPoint(
  center: readonly [number, number],
  rotationY: number,
  localX: number,
  localZ: number,
): readonly [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    center[0] + cosine * localX + sine * localZ,
    center[1] - sine * localX + cosine * localZ,
  ];
}

describe("City West and Urania recognition details", () => {
  test("pins the official cues to explicit OSM building parts", () => {
    expect(CITY_WEST_PROFILE.coordinateFrame).toContain("EPSG:25833");
    expect(CITY_WEST_PROFILE.europaCenter.centerWorldM).toEqual([
      -2308.337, 1585.347,
    ]);
    expect(CITY_WEST_PROFILE.europaCenter.sourceTowerPartId).toBe(
      "OSM-way-26408382",
    );
    expect(CITY_WEST_PROFILE.europaCenter.starDiameterM).toBe(10);
    expect(CITY_WEST_PROFILE.europaCenter.overallHeightM).toBe(103);
    expect(CITY_WEST_PROFILE.europaCenter.officeFloorCount).toBe(21);
    expect(CITY_WEST_PROFILE.europaCenter.curtainWall.storeyRows).toBe(21);
    expect(
      CITY_WEST_PROFILE.europaCenter.curtainWall
        .mobileLongFaceStoreyRows,
    ).toBe(17);
    expect(
      CITY_WEST_PROFILE.europaCenter.curtainWall.geometryStatus,
    ).toContain("no facade photograph or texture");
    expect(
      CITY_WEST_PROFILE.europaCenter.breitscheidplatzFrontage.sourcePartId,
    ).toBe("OSM-way-26408381");
    expect(
      CITY_WEST_PROFILE.europaCenter.breitscheidplatzFrontage.footprintM,
    ).toEqual([18.3, 69.41]);
    expect(
      CITY_WEST_PROFILE.europaCenter.breitscheidplatzFrontage.baseStoreys,
    ).toBe(2);
    expect(
      CITY_WEST_PROFILE.europaCenter.breitscheidplatzFrontage.officeStoreys,
    ).toBe(3);
    expect(
      CITY_WEST_PROFILE.europaCenter.breitscheidplatzFrontage.roofSigns
        .texts,
    ).toEqual(["RBB", "94.3"]);
    expect(
      CITY_WEST_PROFILE.europaCenter.roofStar.rotationsPerMinute,
    ).toBe(2);

    expect(CITY_WEST_PROFILE.allianzHaus.sourceTowerPartId).toBe(
      "OSM-way-363431228",
    );
    expect(CITY_WEST_PROFILE.allianzHaus.sourceLowWingPartId).toBe(
      "OSM-way-363431190",
    );
    expect(CITY_WEST_PROFILE.allianzHaus.floorCount).toBe(14);
    expect(CITY_WEST_PROFILE.allianzHaus.lowWingFloorCount).toBe(6);
    expect(CITY_WEST_PROFILE.allianzHaus.heightStatus).toContain("inferred");
    expect(CITY_WEST_PROFILE.allianzHaus.roofWordmark.text).toBe("ALLIANZ");
    expect(
      CITY_WEST_PROFILE.allianzHaus.roofWordmark.geometryStatus,
    ).toContain("no font, image, or texture");

    expect(CITY_WEST_PROFILE.kranzlerEck.sourceRotundaPartId).toBe(
      "OSM-way-474593825",
    );
    expect(CITY_WEST_PROFILE.kranzlerEck.rotundaDiameterM).toBeCloseTo(
      16.9,
      2,
    );
    expect(CITY_WEST_PROFILE.urania.sourceBuildingId).toBe(
      "OSM-way-11687794",
    );
    expect(CITY_WEST_PROFILE.urania.rearVolumeStatus).toContain(
      "no component survey",
    );
  });

  test("derives the Allianz tower axis without mirroring the OSM ring", () => {
    const profile = CITY_WEST_PROFILE.allianzHaus;
    const [[startX, startZ], [endX, endZ]] = profile.sourceAxisWorldM;
    const projectedAxisRotation = -Math.atan2(
      endZ - startZ,
      endX - startX,
    );

    expect(profile.centerWorldM).toEqual([-2809.432, 1748.781]);
    expect(profile.towerFootprintM).toEqual([45.457, 17.317]);
    expect(profile.rotationY).toBeLessThan(0);
    expect(profile.rotationY).toBeCloseTo(projectedAxisRotation, 3);
    expect((profile.rotationY * 180) / Math.PI).toBeCloseTo(-9.588, 3);
  });

  test("keeps the two Bahnhof-Zoo halls distinct and source-sized", () => {
    const station = CITY_WEST_PROFILE.bahnhofZoo;
    expect(station.longDistanceHall.heightAboveViaductM).toBe(14);
    expect(station.sBahnHall.heightAboveViaductM).toBe(9.6);
    expect(station.longDistanceHall.sourceBuildingId).toBe(
      "OSM-way-96955257",
    );
    expect(station.sBahnHall.sourceBuildingId).toBe("OSM-way-20145539");
    expect(station.longDistanceHall.centerWorldM).toEqual([
      -2660.478, 1186.912,
    ]);
    expect(station.longDistanceHall.lengthM).toBeCloseTo(257.65, 2);
    expect(station.longDistanceHall.widthM).toBeCloseTo(71.61, 2);
    expect(
      (station.longDistanceHall.rotationY * 180) / Math.PI,
    ).toBeCloseTo(61.26, 2);
    expect(station.longDistanceHall.footprintStatus).toContain(
      "projected OSM outer ring",
    );
    expect(station.sBahnHall.centerWorldM).toEqual([-2742.039, 1293.831]);
    expect(station.sBahnHall.lengthM).toBeCloseTo(171.428, 3);
    expect(station.sBahnHall.widthM).toBeCloseTo(21.87, 2);

    const details = createCityWestDetails("full");
    const halls = details.getObjectByName("Bahnhof Zoo steel-glass halls");
    expect(halls).toBeDefined();
    const bounds = new Box3().setFromObject(halls!);
    expect(bounds.min.x).toBeCloseTo(-2793.37, 1);
    expect(bounds.max.x).toBeCloseTo(-2566.9, 1);
    expect(bounds.min.z).toBeCloseTo(1056.61, 1);
    expect(bounds.max.z).toBeCloseTo(1374.24, 1);
    expect(bounds.max.y - CITY_WEST_PROFILE.groundY).toBeCloseTo(22, 1);
  });

  test("reconstructs the five-part church ensemble and plaza landmark", () => {
    const profile = CITY_WEST_PROFILE.gedaechtniskirche;
    expect(profile.oldTower.heightM).toBe(71);
    expect(profile.oldTower.originalHeightM).toBe(113);
    expect(profile.oldTower.portal.openThrough).toBe(true);
    expect(profile.oldTower.portal.clearWidthM).toBe(10.5);
    expect(profile.oldTower.clock.hourMarkers).toBe(12);
    expect(profile.oldTower.belfryArchesPerLongFace).toBe(3);
    expect(profile.oldTower.brokenCrown.patinaColor).toBe("green-grey");
    expect(profile.oldTower.brokenCrown.status).toContain(
      "no photograph or texture",
    );
    expect(profile.church.diameterM).toBe(35);
    expect(profile.church.heightM).toBe(20.5);
    expect(profile.bellTower.diameterM).toBe(12);
    expect(profile.bellTower.heightM).toBe(53.3);
    expect(profile.bellTower.facadeSides).toBe(6);
    expect(profile.bellTower.honeycombWindowCount).toBe(5152);
    expect(profile.bellTower.finial.poleLengthM).toBe(5.3);
    expect(profile.bellTower.finial.crossHeightM).toBe(1.8);
    expect(profile.podiumHeightM).toBe(0.8);
    expect(CITY_WEST_PROFILE.breitscheidplatz.globeDiameterM).toBe(8.5);
    expect(CITY_WEST_PROFILE.breitscheidplatz.fountainBasinM).toBe(16);

    const details = createCityWestDetails("full");
    const ensemble = details.getObjectByName(
      "Gedächtniskirche and Breitscheidplatz ensemble",
    );
    expect(ensemble).toBeDefined();
    const bounds = new Box3().setFromObject(ensemble!);
    expect(bounds.max.y - CITY_WEST_PROFILE.groundY).toBeCloseTo(71, 1);
    expect(bounds.min.x).toBeLessThan(profile.foyerCenterWorldM[0]);
    expect(bounds.max.x).toBeGreaterThan(
      CITY_WEST_PROFILE.breitscheidplatz.fountainCenterWorldM[0],
    );
    expect(hasGeometryColor(ensemble!, 0xd1ad4a)).toBe(true);
    expect(hasGeometryColor(ensemble!, 0x63847e)).toBe(true);
    expect(hasGeometryColor(ensemble!, 0x8a8d89)).toBe(true);

    const [portalStartX, portalStartZ] = localPoint(
      profile.oldTower.centerWorldM,
      profile.oldTower.rotationY,
      0,
      -12,
    );
    const [portalEndX, portalEndZ] = localPoint(
      profile.oldTower.centerWorldM,
      profile.oldTower.rotationY,
      0,
      12,
    );
    const portalDirection = new Vector3(
      portalEndX - portalStartX,
      0,
      portalEndZ - portalStartZ,
    ).normalize();
    const portalRay = new Raycaster(
      new Vector3(
        portalStartX,
        CITY_WEST_PROFILE.groundY + 4,
        portalStartZ,
      ),
      portalDirection,
      0,
      24,
    );
    ensemble!.updateMatrixWorld(true);
    expect(portalRay.intersectObject(ensemble!, true)).toHaveLength(0);
  });

  test("renders the Europa-Center curtain wall, frontage and three-spoke star", () => {
    const profile = CITY_WEST_PROFILE.europaCenter;
    const [frontageX, frontageZ] = localPoint(
      profile.centerWorldM,
      profile.rotationY,
      ...profile.breitscheidplatzFrontage.centerOffsetM,
    );
    expect(frontageX).toBeCloseTo(-2307.33, 2);
    expect(frontageZ).toBeCloseTo(1518.33, 2);
    expect(profile.roofStar.geometryStatus).toContain("three radial spokes");

    const details = createCityWestDetails("full");
    const towers = details.getObjectByName(
      "City West towers and Kranzler Eck",
    );
    expect(towers).toBeDefined();
    const bounds = new Box3().setFromObject(towers!);
    expect(bounds.max.y - CITY_WEST_PROFILE.groundY).toBeCloseTo(103, 1);
    expect(hasGeometryColor(towers!, 0x34474a)).toBe(true);
    expect(hasGeometryColor(towers!, 0x666d6b)).toBe(true);
    expect(hasGeometryColor(towers!, 0x477b80)).toBe(true);
    expect(hasGeometryColor(towers!, 0xc83d39)).toBe(true);
  });

  test("merges ornament into four batches within full and mobile budgets", () => {
    const full = createCityWestDetails("full");
    const mobile = createCityWestDetails("mobile");
    expect(full.children).toHaveLength(4);
    expect(mobile.children).toHaveLength(4);
    expect(full.userData.batchPolicy).toContain("merged into four");

    const fullBudget = geometryBudget(full);
    const mobileBudget = geometryBudget(mobile);
    expect(fullBudget.renderables).toBeLessThanOrEqual(
      CITY_WEST_RENDER_BUDGET.full.maxRenderables,
    );
    expect(fullBudget.vertices).toBeLessThanOrEqual(
      CITY_WEST_RENDER_BUDGET.full.maxVertices,
    );
    expect(mobileBudget.renderables).toBeLessThanOrEqual(
      CITY_WEST_RENDER_BUDGET.mobile.maxRenderables,
    );
    expect(mobileBudget.vertices).toBeLessThanOrEqual(
      CITY_WEST_RENDER_BUDGET.mobile.maxVertices,
    );
    expect(mobileBudget.vertices).toBeLessThan(fullBudget.vertices * 0.65);
  });

  test("publishes primary sources and follows the expanded mobile profile", () => {
    expect(CITY_WEST_SOURCE_URLS.length).toBeGreaterThanOrEqual(30);
    expect(CITY_WEST_SOURCE_URLS).toContain(
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096462",
    );
    expect(CITY_WEST_SOURCE_URLS).toContain(
      "https://europa-center-berlin.de/timeline/eroeffnung/",
    );
    expect(CITY_WEST_SOURCE_URLS).toContain(
      "https://www.gedaechtniskirche-berlin.de/gebaeude/architektur",
    );
    expect(CITY_WEST_SOURCE_URLS).toContain(
      "https://www.urania.de/urania-berlin/",
    );
    for (const wayId of [
      "1054276972",
      "26408382",
      "26408381",
      "48757012",
      "363431228",
      "363431190",
      "22986477",
      "474593825",
      "96955257",
      "20145539",
      "421829986",
      "15218371",
      "15218372",
      "15218373",
      "15218374",
      "15218375",
      "120866116",
      "11687794",
    ]) {
      expect(CITY_WEST_SOURCE_URLS).toContain(
        `https://www.openstreetmap.org/way/${wayId}`,
      );
    }

    const expanded = createExpandedCityDetails([], {
      detailProfile: "mobile",
    });
    expect(expanded.userData.cityWest).toBe(CITY_WEST_PROFILE);
    const cityWest = expanded.getObjectByName(
      "City West and Urania recognition details",
    );
    expect(cityWest?.userData.detailProfile).toBe("mobile");
  });
});
