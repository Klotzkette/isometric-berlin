import { describe, expect, test } from "bun:test";

import {
  Box3,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  ADLER_BRIDGE_EAGLE_COUNT,
  ADLER_BRIDGE_EAGLE_PRIMARY_FEATHERS,
  ADLER_BRIDGE_PROFILE,
  ADLER_BRIDGE_RAIL_BAYS,
  createAdlerBridge,
} from "../src/AdlerBridge";
import { createHistoricParkBridgeCollision } from "../src/HistoricParkBridgeCollision";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import {
  LOEWEN_BRIDGE_PROFILE,
  createLoewenBridge,
} from "../src/LoewenBridge";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";

describe("historic Tiergarten park bridges", () => {
  test("pins Adlerbruecke to the current official inventory and exact OSM axis", () => {
    expect(ADLER_BRIDGE_PROFILE).toMatchObject({
      centreWorldM: [-1197.926, 931.565],
      inventory: {
        areaM2: 25,
        bridgeNumber: "3446098",
        built: 1873,
        conditionGrade: 3.7,
        construction: "Plattenbalkenbruecke, Traegerrostbruecke",
        dataStatus: "06/2025",
        lengthM: 7.3,
        material: "Stahl/Leichtmetall",
        widthM: 3.35,
      },
      kind: "adler",
      osmWayId: "28872983",
    });
    expect(Math.hypot(...ADLER_BRIDGE_PROFILE.axis)).toBeCloseTo(1, 5);
    const [from, to] = ADLER_BRIDGE_PROFILE.sourceEpsg25833Line;
    expect(Math.hypot(to[0] - from[0], to[1] - from[1])).toBeCloseTo(10.18, 2);
    const sourceLength = Math.hypot(to[0] - from[0], to[1] - from[1]);
    expect(ADLER_BRIDGE_PROFILE.axis[0]).toBeCloseTo(
      (to[0] - from[0]) / sourceLength,
      10,
    );
    expect(ADLER_BRIDGE_PROFILE.axis[1]).toBeCloseTo(
      (from[1] - to[1]) / sourceLength,
      10,
    );
    expect(ADLER_BRIDGE_PROFILE.secondaryDimensionConflict).toContain(
      "11.55 x 3.25",
    );
    expect(ADLER_BRIDGE_PROFILE.sourceUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("openstreetmap.org/way/28872983"),
        expect.stringContaining("mpb_anhang_1_brueckenliste_bestand.pdf"),
        expect.stringContaining("denkmaldatenbank.berlin.de"),
      ]),
    );
  });

  test("retains complete free-photo attribution without bundling a texture", () => {
    expect(ADLER_BRIDGE_PROFILE.visualReferences).toHaveLength(3);
    for (const reference of ADLER_BRIDGE_PROFILE.visualReferences) {
      expect(reference).toMatchObject({
        artist: "Lienhard Schulz",
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      });
      expect(reference.pageUrl).toContain("commons.wikimedia.org/wiki/File:");
    }
    const bridge = createAdlerBridge(groundPayload as never);
    bridge.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        expect("map" in material ? material.map : null).toBeFalsy();
      }
    });
  });

  test("draws the two central eagle reliefs, wavy iron rails and brick abutments", () => {
    const bridge = createAdlerBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Adlerbruecke bodies") as Mesh;
    const ink = bridge.getObjectByName(
      "Adlerbruecke ink lines",
    ) as LineSegments;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(bodies.material).toBeInstanceOf(MeshBasicMaterial);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(ink.material).toBeInstanceOf(LineBasicMaterial);
    expect(bodies.geometry.getAttribute("position").count).toBeGreaterThan(
      12_000,
    );
    expect(ink.geometry.getAttribute("position").count).toBeGreaterThan(1_000);
    expect(bridge.userData).toMatchObject({
      eagleCount: ADLER_BRIDGE_EAGLE_COUNT,
      genericBridgeReplacement: true,
      osmWayId: ADLER_BRIDGE_PROFILE.osmWayId,
      railBayCount: ADLER_BRIDGE_RAIL_BAYS,
    });
    expect(ADLER_BRIDGE_EAGLE_PRIMARY_FEATHERS).toBe(18);
  });

  test("keeps the official structural envelope at the mapped centre and bearing", () => {
    const bridge = createAdlerBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Adlerbruecke bodies") as Mesh;
    bodies.geometry.computeBoundingBox();
    const localBounds = bodies.geometry.boundingBox!;
    expect(localBounds.max.x - localBounds.min.x).toBeGreaterThan(7.3);
    expect(localBounds.max.x - localBounds.min.x).toBeLessThan(7.8);
    expect(localBounds.max.z - localBounds.min.z).toBeGreaterThan(4.3);
    expect(localBounds.max.y - localBounds.min.y).toBeGreaterThan(2);
    expect(bridge.position.x).toBeCloseTo(
      ADLER_BRIDGE_PROFILE.centreWorldM[0],
      3,
    );
    expect(bridge.position.z).toBeCloseTo(
      ADLER_BRIDGE_PROFILE.centreWorldM[1],
      3,
    );
    const localAxis = new Vector3(1, 0, 0).applyQuaternion(bridge.quaternion);
    expect(localAxis.x).toBeCloseTo(ADLER_BRIDGE_PROFILE.axis[0], 5);
    expect(localAxis.z).toBeCloseTo(ADLER_BRIDGE_PROFILE.axis[1], 5);
    const worldBounds = new Box3().setFromObject(bridge);
    expect(worldBounds.min.y).toBeGreaterThan(5);
    expect(worldBounds.max.y).toBeLessThan(7.3);
  });

  test("round-trips the shared day/night/snow/Schwellenraum material contract", () => {
    const bridge = createAdlerBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Adlerbruecke bodies") as Mesh;
    const ink = bridge.getObjectByName(
      "Adlerbruecke ink lines",
    ) as LineSegments;
    const dayMaterial = bodies.material;
    const dayInk = (ink.material as LineBasicMaterial).color.getHex();

    setIsoNightPresentation(bridge, true, true, "night");
    expect(bodies.material).toBe(bodies.userData.nightMaterial);
    expect((ink.material as LineBasicMaterial).color.getHex()).not.toBe(dayInk);

    setIsoNightPresentation(bridge, false, true, "snowstorm");
    expect(bodies.material).toBe(dayMaterial);
    setIsoNightPresentation(bridge, false, true, "schwellenraum");
    expect(bodies.material).toBe(dayMaterial);
    setIsoNightPresentation(bridge, false, true, "day");
    expect((ink.material as LineBasicMaterial).color.getHex()).toBe(dayInk);
  });

  test("keeps both bridge decks passable while railings and sculptures stay solid", () => {
    const collision = createHistoricParkBridgeCollision(groundPayload as never);
    const pointAt = (
      centre: readonly [number, number],
      axis: readonly [number, number],
      u: number,
      v: number,
      y: number,
    ): readonly [number, number, number] => [
      centre[0] + u * axis[0] - v * axis[1],
      y,
      centre[1] + u * axis[1] + v * axis[0],
    ];
    const adlerOpen = pointAt(
      ADLER_BRIDGE_PROFILE.centreWorldM,
      ADLER_BRIDGE_PROFILE.axis,
      0,
      0,
      6.5,
    );
    const adlerRail = pointAt(
      ADLER_BRIDGE_PROFILE.centreWorldM,
      ADLER_BRIDGE_PROFILE.axis,
      0,
      ADLER_BRIDGE_PROFILE.inventory.widthM / 2,
      6.35,
    );
    expect(collision.solidAt(...adlerOpen, 0.05)).toBe(false);
    expect(collision.solidAt(...adlerRail, 0.05)).toBe(true);

    const loewenOpen = pointAt(
      LOEWEN_BRIDGE_PROFILE.world,
      LOEWEN_BRIDGE_PROFILE.axis,
      0,
      0,
      6.32,
    );
    const loewenRail = pointAt(
      LOEWEN_BRIDGE_PROFILE.world,
      LOEWEN_BRIDGE_PROFILE.axis,
      0,
      0.94,
      6.02,
    );
    expect(collision.solidAt(...loewenOpen, 0.05)).toBe(false);
    expect(collision.solidAt(...loewenRail, 0.05)).toBe(true);

    const loewenBridge = createLoewenBridge(groundPayload as never);
    const safety = loewenBridge.getObjectByName(
      "Löwenbrücke modern safety system",
    ) as Group;
    const safetyY =
      loewenBridge.position.y +
      (safety.userData.modelHandrailHeightM as number);
    const loewenOpenAtHandrail = pointAt(
      LOEWEN_BRIDGE_PROFILE.world,
      LOEWEN_BRIDGE_PROFILE.axis,
      0,
      0,
      safetyY,
    );
    const loewenModernHandrail = pointAt(
      LOEWEN_BRIDGE_PROFILE.world,
      LOEWEN_BRIDGE_PROFILE.axis,
      0,
      LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM + 0.045,
      safetyY,
    );
    expect(collision.solidAt(...loewenOpenAtHandrail, 0.02)).toBe(false);
    expect(collision.solidAt(...loewenModernHandrail, 0.02)).toBe(true);
  });

  test("keeps both bridge silhouettes while fading only dense ink at overview distance", () => {
    expect(FINE_DETAIL_LAYER_NAMES).toEqual(
      expect.arrayContaining([
        "Adlerbruecke ink lines",
        "Löwenbrücke ink lines",
      ]),
    );
    for (const persistentBodyName of [
      "Adlerbruecke bodies",
      "Löwenbrücke bodies",
    ]) {
      expect(FINE_DETAIL_LAYER_NAMES).not.toContain(persistentBodyName);
    }
  });
});
