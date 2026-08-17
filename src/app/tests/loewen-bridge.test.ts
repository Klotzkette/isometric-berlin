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

import {
  LOEWEN_BRIDGE_DECK_BOARD_COUNT,
  LOEWEN_BRIDGE_HANGERS_PER_SIDE,
  LOEWEN_BRIDGE_LION_COUNT,
  LOEWEN_BRIDGE_MAIN_CABLE_COUNT,
  LOEWEN_BRIDGE_PROFILE,
  LOEWEN_BRIDGE_SAFETY_HANDRAIL_COUNT,
  LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD,
  LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT,
  LOEWEN_BRIDGE_SAFETY_POST_COUNT,
  LOEWEN_BRIDGE_TRUSS_BAYS,
  createLoewenBridge,
} from "../src/LoewenBridge";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";
import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

describe("Löwenbrücke recognition model", () => {
  test("pins the published dimensions to the committed OSM centreline", () => {
    expect(LOEWEN_BRIDGE_PROFILE).toMatchObject({
      engineering: {
        mainSpanM: 17.6,
        openSpiralRopeCount: 4,
        openSpiralRopeDiameterMm: 31.3,
        overallLengthM: 26.8,
        superstructureDepthM: 0.8,
      },
      inventory: {
        areaM2: 34,
        bridgeNumber: "3446527",
        built: 2025,
        dataStatus: "06/2025",
        lengthM: 18.3,
        material: "Holz",
        widthM: 1.88,
      },
      kind: "suspension",
      name: "Löwenbrücke",
      osmWayId: "1411957328",
      surveyedDeck: { halfLengthM: 9.15, halfWidthM: 0.94 },
      world: [-1766.908, 680.6395],
    });
    expect(Math.hypot(...LOEWEN_BRIDGE_PROFILE.axis)).toBeCloseTo(1, 5);
    expect(LOEWEN_BRIDGE_PROFILE.sourceUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("openstreetmap.org/way/1411957328"),
        expect.stringContaining("berlin.de/landesdenkmalamt"),
        expect.stringContaining("sbp.de/projekt/loewenbruecke"),
        expect.stringContaining("commons.wikimedia.org/wiki/File:"),
      ]),
    );
    expect(LOEWEN_BRIDGE_PROFILE.visualReferences).toHaveLength(2);
    for (const reference of LOEWEN_BRIDGE_PROFILE.visualReferences) {
      expect(reference).toMatchObject({
        artist: "Singlespeedfahrer",
        captured: "2025-07-04",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      });
      expect(reference.pageUrl).toContain("commons.wikimedia.org/wiki/File:");
    }
  });

  test("draws the timber suspension system and all four lions as real geometry", () => {
    const bridge = createLoewenBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Löwenbrücke bodies") as Mesh;
    const ink = bridge.getObjectByName("Löwenbrücke ink lines") as LineSegments;

    expect(bodies).toBeInstanceOf(Mesh);
    expect(bodies.material).toBeInstanceOf(MeshBasicMaterial);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(ink.material).toBeInstanceOf(LineBasicMaterial);
    expect(bodies.geometry.getAttribute("position").count).toBeGreaterThan(
      15_000,
    );
    expect(ink.geometry.getAttribute("position").count).toBeGreaterThan(2_000);
    expect(bridge.userData).toMatchObject({
      deckBoardCount: LOEWEN_BRIDGE_DECK_BOARD_COUNT,
      hangerCount: LOEWEN_BRIDGE_HANGERS_PER_SIDE * 2,
      keepInMinecraft: true,
      lionCount: LOEWEN_BRIDGE_LION_COUNT,
      mainCableCount: LOEWEN_BRIDGE_MAIN_CABLE_COUNT,
      modernSafetyHandrailCount: LOEWEN_BRIDGE_SAFETY_HANDRAIL_COUNT,
      modernSafetyMeshDiagonalsPerField:
        LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD,
      modernSafetyMeshFieldCount: LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT,
      modernSafetyPostCount: LOEWEN_BRIDGE_SAFETY_POST_COUNT,
      osmWayId: LOEWEN_BRIDGE_PROFILE.osmWayId,
      trussBayCount: LOEWEN_BRIDGE_TRUSS_BAYS,
      visualReferences: LOEWEN_BRIDGE_PROFILE.visualReferences,
    });
  });

  test("adds the recognisably modern steel-rope handrails and mesh safety fields", () => {
    const bridge = createLoewenBridge(groundPayload as never);
    const safety = bridge.getObjectByName(
      "Löwenbrücke modern safety system",
    ) as Group;
    const handrails = bridge.getObjectByName(
      "Löwenbrücke modern safety handrails bodies",
    ) as Mesh;
    const posts = bridge.getObjectByName(
      "Löwenbrücke modern safety posts bodies",
    ) as Mesh;
    const meshFields = bridge.getObjectByName(
      "Löwenbrücke modern safety mesh fields",
    ) as LineSegments;

    expect(safety).toBeInstanceOf(Group);
    expect(handrails).toBeInstanceOf(Mesh);
    expect(posts).toBeInstanceOf(Mesh);
    expect(meshFields).toBeInstanceOf(LineSegments);
    expect(meshFields.material).toBeInstanceOf(LineBasicMaterial);
    expect(safety.userData).toMatchObject({
      handrailCount: LOEWEN_BRIDGE_SAFETY_HANDRAIL_COUNT,
      meshDiagonalsPerField:
        LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD,
      meshFieldCount: LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT,
      photoBounded: true,
      postCount: LOEWEN_BRIDGE_SAFETY_POST_COUNT,
    });
    expect(meshFields.geometry.getAttribute("position").count).toBe(
      LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT *
        LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD *
        2,
    );
    handrails.geometry.computeBoundingBox();
    const handrailBounds = handrails.geometry.boundingBox!;
    expect(handrailBounds.min.y).toBeGreaterThan(1.09);
    expect(handrailBounds.max.y).toBeLessThan(1.15);
    expect(handrailBounds.max.x - handrailBounds.min.x).toBeCloseTo(18.3, 2);
    // Both safety systems stay outside the published 1.88 m walking width.
    const handrailPositions = handrails.geometry.getAttribute("position");
    for (let index = 0; index < handrailPositions.count; index += 1) {
      expect(Math.abs(handrailPositions.getZ(index))).toBeGreaterThan(0.94);
    }
  });

  test("keeps the authored bridge at the measured centre, bearing and scale", () => {
    const bridge = createLoewenBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Löwenbrücke bodies") as Mesh;
    bodies.geometry.computeBoundingBox();
    const localBounds = bodies.geometry.boundingBox!;

    expect(localBounds.max.x - localBounds.min.x).toBeCloseTo(26.8, 2);
    // The lion plinths sit outside the two-metre walking deck, as in the
    // photographs; their full sculptural envelope remains compact.
    expect(localBounds.max.z - localBounds.min.z).toBeGreaterThanOrEqual(4);
    expect(localBounds.max.y - localBounds.min.y).toBeGreaterThan(2);
    expect(bridge.position.x).toBeCloseTo(LOEWEN_BRIDGE_PROFILE.world[0], 3);
    expect(bridge.position.z).toBeCloseTo(LOEWEN_BRIDGE_PROFILE.world[1], 3);

    bridge.updateWorldMatrix(true, true);
    const worldBounds = new Box3().setFromObject(bridge);
    expect(worldBounds.min.y).toBeGreaterThan(4.8);
    expect(worldBounds.max.y).toBeLessThan(8);

    const localAxis = new Vector3(1, 0, 0).applyQuaternion(bridge.quaternion);
    expect(localAxis.x).toBeCloseTo(LOEWEN_BRIDGE_PROFILE.axis[0], 5);
    expect(localAxis.z).toBeCloseTo(LOEWEN_BRIDGE_PROFILE.axis[1], 5);
  });

  test("round-trips its flat day paint and moonlit night material", () => {
    const bridge = createLoewenBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Löwenbrücke bodies") as Mesh;
    const ink = bridge.getObjectByName("Löwenbrücke ink lines") as LineSegments;
    const safetyHandrails = bridge.getObjectByName(
      "Löwenbrücke modern safety handrails bodies",
    ) as Mesh;
    const safetyMesh = bridge.getObjectByName(
      "Löwenbrücke modern safety mesh fields",
    ) as LineSegments;
    const dayMaterial = bodies.material;
    const safetyDayMaterial = safetyHandrails.material;
    const dayInk = (ink.material as LineBasicMaterial).color.getHex();
    const safetyDayInk = (
      safetyMesh.material as LineBasicMaterial
    ).color.getHex();

    setIsoNightPresentation(bridge, true, true, "night");
    expect(bodies.material).toBe(bodies.userData.nightMaterial);
    expect(safetyHandrails.material).toBe(
      safetyHandrails.userData.nightMaterial,
    );
    expect((ink.material as LineBasicMaterial).color.getHex()).not.toBe(dayInk);
    expect((safetyMesh.material as LineBasicMaterial).color.getHex()).not.toBe(
      safetyDayInk,
    );

    setIsoNightPresentation(bridge, false, true, "snowstorm");
    expect(bodies.material).toBe(dayMaterial);
    expect(safetyHandrails.material).toBe(safetyDayMaterial);
    expect((safetyMesh.material as LineBasicMaterial).color.getHex()).not.toBe(
      safetyDayInk,
    );

    setIsoNightPresentation(bridge, false, true, "schwellenraum");
    expect(bodies.material).toBe(dayMaterial);
    expect(safetyHandrails.material).toBe(safetyDayMaterial);
    expect((safetyMesh.material as LineBasicMaterial).color.getHex()).toBe(
      safetyDayInk,
    );

    setIsoNightPresentation(bridge, false, true, "day");
    expect(bodies.material).toBe(dayMaterial);
    expect((ink.material as LineBasicMaterial).color.getHex()).toBe(dayInk);
  });

  test("keeps its silhouette while dense ink fades at overview distance", () => {
    expect(FINE_DETAIL_LAYER_NAMES).toEqual(
      expect.arrayContaining([
        "Löwenbrücke ink lines",
        "Löwenbrücke modern safety posts bodies",
        "Löwenbrücke modern safety posts ink lines",
        "Löwenbrücke modern safety mesh fields",
      ]),
    );
    expect(FINE_DETAIL_LAYER_NAMES).not.toContain("Löwenbrücke bodies");
    expect(FINE_DETAIL_LAYER_NAMES).not.toContain(
      "Löwenbrücke modern safety handrails bodies",
    );
  });
});
