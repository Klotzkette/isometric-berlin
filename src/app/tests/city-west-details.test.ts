import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  Box3,
  Color,
  Raycaster,
  Vector3,
  type Mesh,
  type BufferGeometry,
  type Object3D,
} from "three";

import {
  CITY_WEST_PROFILE,
  CITY_WEST_RENDER_BUDGET,
  CITY_WEST_SOURCE_URLS,
  createCityWestDetails,
  createMinecraftEuropaCenter,
  isEuropaCenterStarTarget,
  updateEuropaCenterStars,
} from "../src/CityWestDetails";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";

import {
  GEDAECHTNISKIRCHE_RETAINED_WINGS,
  GEDAECHTNISKIRCHE_RETAINED_WING_AREA_M2,
} from "../src/gedaechtniskircheSourceParts";
import {
  createMinecraftGedaechtniskirche,
  GEDAECHTNISKIRCHE_MINECRAFT_REPLACEMENT_IDS,
  isGedaechtniskircheReplacementCell,
  gedaechtniskircheRuinSolidAt,
} from "../src/MinecraftGedaechtniskirche";

function geometryBudget(root: Object3D): {
  renderables: number;
  vertices: number;
  geometryBytes: number;
} {
  let renderables = 0;
  let vertices = 0;
  const buffers = new Set<ArrayBufferLike>();
  root.traverse((object) => {
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    if (!geometry) return;
    renderables += 1;
    vertices += geometry.getAttribute("position")?.count ?? 0;
    for (const attribute of Object.values(geometry.attributes)) {
      buffers.add(attribute.array.buffer);
    }
    if (geometry.index) buffers.add(geometry.index.array.buffer);
  });
  return {
    renderables,
    vertices,
    geometryBytes: [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0),
  };
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

function geometryDigest(root: Object3D): string {
  const hash = createHash("sha256");
  root.traverse((object) => {
    const geometry = (object as Mesh).geometry;
    if (!geometry) return;
    for (const attribute of Object.values(geometry.attributes))
      hash.update(new Uint8Array(attribute.array.buffer));
    if (geometry.index) hash.update(new Uint8Array(geometry.index.array.buffer));
  });
  return hash.digest("hex");
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

function ruinRay(
  localX: number,
  height: number,
  localZ: number,
  endX: number,
  endZ: number,
): Raycaster {
  const profile = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
  const a = localPoint(profile.centerWorldM, profile.rotationY, localX, localZ);
  const b = localPoint(profile.centerWorldM, profile.rotationY, endX, endZ);
  const ray = new Raycaster(
    new Vector3(a[0], CITY_WEST_PROFILE.groundY + height, a[1]),
    new Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize(),
    0,
    Math.hypot(b[0] - a[0], b[1] - a[1]),
  );
  ray.params.Line.threshold = 0.01;
  return ray;
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
      CITY_WEST_PROFILE.europaCenter.curtainWall.mobileLongFaceStoreyRows,
    ).toBe(17);
    expect(CITY_WEST_PROFILE.europaCenter.curtainWall.geometryStatus).toContain(
      "no facade photograph or texture",
    );
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
      CITY_WEST_PROFILE.europaCenter.breitscheidplatzFrontage.roofSigns.texts,
    ).toEqual(["RBB", "94.3"]);
    expect(CITY_WEST_PROFILE.europaCenter.roofStar.rotationsPerMinute).toBe(2);

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
    expect(CITY_WEST_PROFILE.allianzHaus.roofWordmark.geometryStatus).toContain(
      "no font, image, or texture",
    );

    expect(CITY_WEST_PROFILE.kranzlerEck.sourceRotundaPartId).toBe(
      "OSM-way-474593825",
    );
    expect(CITY_WEST_PROFILE.kranzlerEck.rotundaDiameterM).toBeCloseTo(16.9, 2);
    expect(CITY_WEST_PROFILE.urania.sourceBuildingId).toBe("OSM-way-11687794");
    expect(CITY_WEST_PROFILE.urania.rearVolumeStatus).toContain(
      "no component survey",
    );
  });

  test("derives the Allianz tower axis without mirroring the OSM ring", () => {
    const profile = CITY_WEST_PROFILE.allianzHaus;
    const [[startX, startZ], [endX, endZ]] = profile.sourceAxisWorldM;
    const projectedAxisRotation = -Math.atan2(endZ - startZ, endX - startX);

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
    expect(station.longDistanceHall.sourceBuildingId).toBe("OSM-way-96955257");
    expect(station.sBahnHall.sourceBuildingId).toBe("OSM-way-20145539");
    expect(station.longDistanceHall.centerWorldM).toEqual([
      -2660.478, 1186.912,
    ]);
    expect(station.longDistanceHall.lengthM).toBeCloseTo(257.65, 2);
    expect(station.longDistanceHall.widthM).toBeCloseTo(71.61, 2);
    expect((station.longDistanceHall.rotationY * 180) / Math.PI).toBeCloseTo(
      61.26,
      2,
    );
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
    expect(profile.oldTower.portal.clearWidthM).toBe(3.2);
    expect(profile.oldTower.clock.hourMarkers).toBe(12);
    expect(profile.oldTower.belfryArchesPerLongFace).toBe(2);
    expect(profile.oldTower.belfry.sides).toBe(8);
    expect(profile.oldTower.brokenCrown.patinaColor).toBe("green-grey");
    expect(profile.oldTower.facadeDetailStatus).toContain("not a stone-by-stone");
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
    expect(hasGeometryColor(ensemble!, 0x657e79)).toBe(true);
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
      new Vector3(portalStartX, CITY_WEST_PROFILE.groundY + 4, portalStartZ),
      portalDirection,
      0,
      24,
    );
    ensemble!.updateMatrixWorld(true);
    expect(portalRay.intersectObject(ensemble!, true)).toHaveLength(0);
  });

  test("separates narrow hall entrances from the raised ruined openings", () => {
    const root = createCityWestDetails("full");
    const ensemble = root.getObjectByName(
      "Gedächtniskirche and Breitscheidplatz ensemble",
    )!;
    root.updateMatrixWorld(true);
    // A person can enter the surviving hall. The former oversized ten-metre
    // ground tunnel must remain solid at both flanks of this real doorway.
    expect(ruinRay(0, 2, -11, 0, 11).intersectObject(ensemble, true)).toHaveLength(0);
    for (const side of [-1, 1]) {
      expect(
        ruinRay(side * 4, 2, -11, side * 4, -7).intersectObject(ensemble, true).length,
      ).toBeGreaterThan(0);
    }
    // Circular west breach and rough east arch have visible depth above the
    // memorial hall. Test each face locally so far walls cannot mask a cap.
    expect(ruinRay(0, 17.3, -11, 0, -6).intersectObject(ensemble, true)).toHaveLength(0);
    expect(ruinRay(0, 17.3, 11, 0, 6).intersectObject(ensemble, true)).toHaveLength(0);
    // The former nave arch starts lower than the west rose opening. Identical
    // circular holes painted on both facades would erase this real asymmetry.
    expect(ruinRay(0, 9.3, 11, 0, 6).intersectObject(ensemble, true)).toHaveLength(0);
    expect(ruinRay(0, 9.3, -11, 0, -6).intersectObject(ensemble, true).length).toBeGreaterThan(0);
  });

  test("has eight genuinely open belfry faces with solid supporting piers", () => {
    const root = createCityWestDetails();
    const ensemble = root.getObjectByName(
      "Gedächtniskirche and Breitscheidplatz ensemble",
    )!;
    root.updateMatrixWorld(true);
    const belfry = CITY_WEST_PROFILE.gedaechtniskirche.oldTower.belfry;
    const width = 2 * belfry.radiusM * Math.sin(Math.PI / 8);
    for (let face = 0; face < 8; face += 1) {
      const yaw = face * Math.PI / 4;
      const projected = (u: number, r: number): readonly [number, number] => [
        u * Math.cos(yaw) + r * Math.sin(yaw),
        r * Math.cos(yaw) - u * Math.sin(yaw),
      ];
      const openingU = face % 2 === 0 ? 1.5 : 0;
      const a = projected(openingU, 12), b = projected(openingU, 8);
      expect(ruinRay(a[0], 49, a[1], b[0], b[1]).intersectObject(ensemble, true)).toHaveLength(0);
      const c = projected(width / 2 - 0.45, 12), d = projected(width / 2 - 0.45, 8);
      expect(ruinRay(c[0], 49, c[1], d[0], d[1]).intersectObject(ensemble, true).length).toBeGreaterThan(0);
    }
  });

  test("preserves the unequal northwest and southwest subsidiary spires", () => {
    const root = createCityWestDetails();
    root.updateMatrixWorld(true);
    const profile = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
    const [tall, short] = profile.sideTurrets;
    expect(tall.centerLocalM[0]).toBeLessThan(0);
    expect(short.centerLocalM[0]).toBeGreaterThan(0);
    expect(tall.centerLocalM[1]).toBeLessThan(0);
    expect(short.centerLocalM[1]).toBeLessThan(0);
    expect(tall.crossTopM - short.crossTopM).toBeGreaterThan(10);
    for (const turret of profile.sideTurrets) {
      const [x,z] = localPoint(profile.centerWorldM, profile.rotationY, ...turret.centerLocalM);
      const ray = new Raycaster(new Vector3(x, 5.2 + 60, z), new Vector3(0,-1,0), 0, 30);
      const hits = ray.intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y - 5.2).toBeCloseTo(turret.crossTopM, 2);
    }
  });

  test("keeps dense square glass cells on the actual octagonal and hexagonal planes", () => {
    const root = createCityWestDetails("mobile");
    const glass = root.getObjectByName(
      "Gedächtniskirche blue concrete-glass cells lamps",
    ) as Mesh;
    expect(glass).toBeDefined();
    const position = glass.geometry.getAttribute("position");
    expect(position.count).toBe(33_696);
    const church = CITY_WEST_PROFILE.gedaechtniskirche.church;
    const bell = CITY_WEST_PROFILE.gedaechtniskirche.bellTower;
    const facesSeen = new Set<string>();
    for (let vertex = 0; vertex < position.count; vertex += 4) {
      let x = 0,
        z = 0;
      for (let corner = 0; corner < 4; corner += 1) {
        x += position.getX(vertex + corner) / 4;
        z += position.getZ(vertex + corner) / 4;
      }
      const building =
        Math.abs(x - church.centerWorldM[0]) < 20 ? church : bell;
      const apothem =
        (building.diameterM / 2) * Math.cos(Math.PI / building.facadeSides) +
        0.025;
      const dx = x - building.centerWorldM[0],
        dz = z - building.centerWorldM[1];
      let face = -1;
      for (let side = 0; side < building.facadeSides; side += 1) {
        const theta = ((side + 0.5) * Math.PI * 2) / building.facadeSides;
        if (
          Math.abs(dx * Math.sin(theta) + dz * Math.cos(theta) - apothem) <
          0.001
        )
          face = side;
      }
      expect(face).toBeGreaterThanOrEqual(0);
      facesSeen.add(`${building.facadeSides}:${face}`);
      const width = Math.hypot(
        position.getX(vertex + 1) - position.getX(vertex),
        position.getZ(vertex + 1) - position.getZ(vertex),
      );
      const height = position.getY(vertex + 2) - position.getY(vertex + 1);
      expect(width / height).toBeGreaterThan(0.9);
      expect(width / height).toBeLessThan(1.1);
    }
    expect(facesSeen.size).toBe(14);
    expect(glass.userData.nightMaterial.userData.nightEmissive).toBe(0x234bad);
  });

  test("retains a hollow broken crown rather than a filled tower cap", () => {
    const root = createCityWestDetails();
    root.updateMatrixWorld(true);
    const profile = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
    expect(profile.clockFaceCount).toBe(4);
    expect(profile.crownWallCount).toBe(8);
    const centreRay = new Raycaster(
      new Vector3(
        profile.centerWorldM[0],
        GROUND_TOP(),
        profile.centerWorldM[1],
      ),
      new Vector3(0, -1, 0),
      0,
      11,
    );
    expect(centreRay.intersectObject(root, true)).toHaveLength(0);
    function GROUND_TOP(): number {
      return CITY_WEST_PROFILE.groundY + 71.1;
    }
  });

  test("provides one bounded native Minecraft reading with a clear lower portal", () => {
    const root = createMinecraftGedaechtniskirche();
    root.updateMatrixWorld(true);
    expect(root.children).toHaveLength(1);
    expect(root.userData.instanceCount).toBeLessThanOrEqual(
      root.userData.instanceBudget,
    );
    expect(root.userData.instanceCount).toBe(16_295);
    expect(GEDAECHTNISKIRCHE_MINECRAFT_REPLACEMENT_IDS).toHaveLength(5);
    expect(isGedaechtniskircheReplacementCell(-2472, 1521)).toBe(true);
    expect(isGedaechtniskircheReplacementCell(-2495, 1511)).toBe(true);
    expect(isGedaechtniskircheReplacementCell(-2450, 1500)).toBe(false);
    const profile = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
    const a = localPoint(profile.centerWorldM, profile.rotationY, 0, -11);
    const b = localPoint(profile.centerWorldM, profile.rotationY, 0, 11);
    const ray = new Raycaster(
      new Vector3(a[0], CITY_WEST_PROFILE.groundY + 4, a[1]),
      new Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize(),
      0,
      22,
    );
    expect(ray.intersectObject(root, true)).toHaveLength(0);
    expect(
      new Box3().setFromObject(root).max.y - CITY_WEST_PROFILE.groundY,
    ).toBeCloseTo(71, 3);
  });

  test("retains the measured low-wing envelope and collides with hall walls only", () => {
    let area = 0;
    for (const wing of GEDAECHTNISKIRCHE_RETAINED_WINGS) {
      let signed = 0;
      for (let i = 0; i < wing.ring.length; i += 1) {
        const a = wing.ring[i],
          b = wing.ring[(i + 1) % wing.ring.length];
        signed += a[0] * b[1] - b[0] * a[1];
      }
      area += Math.abs(signed) / 2;
      expect([5.2, 14.0]).toContain(wing.baseY);
      expect(wing.topY).toBe(14.2);
    }
    expect(area).toBeCloseTo(GEDAECHTNISKIRCHE_RETAINED_WING_AREA_M2, 5);
    expect(area).toBeCloseTo(112.9650867, 5);
    const profile = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
    const centre = profile.centerWorldM;
    expect(gedaechtniskircheRuinSolidAt(centre[0], 9.2, centre[1], 0.42)).toBe(
      false,
    );
    const pier = localPoint(centre, profile.rotationY, 14.95, 0);
    expect(gedaechtniskircheRuinSolidAt(pier[0], 9.2, pier[1], 0.42)).toBe(
      true,
    );
    expect(gedaechtniskircheRuinSolidAt(centre[0], 41.6, centre[1], 0.42)).toBe(
      true,
    );
    const native = createMinecraftGedaechtniskirche();
    expect((native.children[0] as Mesh).material.vertexColors).toBe(false);
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
    const towers = details.getObjectByName("City West towers and Kranzler Eck");
    expect(towers).toBeDefined();
    const bounds = new Box3().setFromObject(towers!);
    expect(bounds.max.y - CITY_WEST_PROFILE.groundY).toBeCloseTo(103, 1);
    expect(hasGeometryColor(towers!, 0x34474a)).toBe(true);
    expect(hasGeometryColor(towers!, 0x666d6b)).toBe(true);
    expect(hasGeometryColor(towers!, 0x477b80)).toBe(true);
    expect(hasGeometryColor(towers!, 0xc83d39)).toBe(true);
  });

  test("rotates each mode's own star around its mast even after transform freezing", () => {
    for (const root of [createCityWestDetails(), createMinecraftEuropaCenter()]) {
      const targets: Object3D[] = [];
      root.traverse((object) => {
        if (isEuropaCenterStarTarget(object)) targets.push(object);
      });
      expect(targets).toHaveLength(1);
      const star = targets[0];
      const centre = star.position.clone();
      const originalBuffers: ArrayBufferLike[] = [];
      root.traverse((object) => {
        const geometry = (object as Mesh).geometry;
        if (geometry) for (const attribute of Object.values(geometry.attributes))
          originalBuffers.push(attribute.array.buffer);
      });
      const originalDigest = geometryDigest(root);
      freezeStaticSceneTransforms(root);
      expect(star.matrixAutoUpdate).toBe(false);
      updateEuropaCenterStars(targets, 0);
      const originalMatrix = star.matrix.clone();
      updateEuropaCenterStars(targets, 7.5);
      expect(star.rotation.y).toBeCloseTo(CITY_WEST_PROFILE.europaCenter.rotationY + Math.PI / 2);
      expect(star.matrix.equals(originalMatrix)).toBe(false);
      expect(star.position.equals(centre)).toBe(true);
      root.updateMatrixWorld(true);
      expect(new Vector3().setFromMatrixPosition(star.matrixWorld).distanceTo(centre)).toBeLessThan(1e-8);
      updateEuropaCenterStars(targets, 30);
      expect(star.matrix.equals(originalMatrix)).toBe(true);
      for (let frame = 0; frame < 1000; frame += 1)
        updateEuropaCenterStars(targets, frame / 60);
      expect(geometryDigest(root)).toBe(originalDigest);
      const currentBuffers: ArrayBufferLike[] = [];
      root.traverse((object) => {
        const geometry = (object as Mesh).geometry;
        if (geometry) for (const attribute of Object.values(geometry.attributes))
          currentBuffers.push(attribute.array.buffer);
      });
      expect(currentBuffers).toHaveLength(originalBuffers.length);
      currentBuffers.forEach((buffer, index) => expect(buffer).toBe(originalBuffers[index]));
      expect(star.userData.centreWorld).toEqual(centre.toArray());
    }
  });

  test("adds bounded native Europa surfaces without deleting the full mapped podium", () => {
    const root = createMinecraftEuropaCenter();
    const budget = geometryBudget(root);
    expect(budget.renderables).toBe(2);
    expect(root.userData.instanceCount).toBeLessThanOrEqual(root.userData.instanceBudget);
    expect(root.userData.preservedSourcePrismIds).toEqual(["54276972"]);
    expect(CITY_WEST_PROFILE.europaCenter.curtainWall.longFaceMullionBays).toBe(22);
    expect(CITY_WEST_PROFILE.europaCenter.curtainWall.spandrelHeightM).toBe(1.5);
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.geometry) return;
      expect(mesh.geometry.type).toBe("BoxGeometry");
      expect(mesh.userData.blockNative).toBe(true);
      expect(mesh.userData.textureFree).toBe(true);
    });
    const bounds = new Box3().setFromObject(root);
    expect(bounds.max.y).toBeCloseTo(CITY_WEST_PROFILE.groundY + 103, 3);
  });

  test("retains every non-Europa ensemble byte-for-byte and the full mobile geometry", () => {
    const root = createCityWestDetails();
    // Frozen v1.0.60 source geometry; this task owns only Europa-Center.
    for (const [name, digest] of [
      ["Bahnhof Zoo steel-glass halls", "53f341968805478a4f82a415f4ebd2bf8a71faa6bc3a31bee9ad69ad167da956"],
      ["Gedächtniskirche and Breitscheidplatz ensemble", "a7a96bb7f4fe4578fc3ad9d9cce6526cc8c35baf57ec8c17c20ecb389b71a41a"],
      ["Urania mirrored entrance ensemble", "91401346bb807c600ca0b5297af29afd899bb35a6c1f77543d182676e5256f76"],
    ]) expect(geometryDigest(root.getObjectByName(name)!)).toBe(digest);
    expect(geometryDigest(createCityWestDetails("mobile"))).toBe(geometryDigest(root));
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
    expect(fullBudget.geometryBytes).toBeLessThanOrEqual(
      CITY_WEST_RENDER_BUDGET.full.maxGeometryBytes,
    );
    expect(mobileBudget.geometryBytes).toBeLessThanOrEqual(
      CITY_WEST_RENDER_BUDGET.mobile.maxGeometryBytes,
    );
    expect(mobileBudget).toEqual(fullBudget);
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
    expect(cityWest?.userData.detailProfile).toBe("full");
  });
});
