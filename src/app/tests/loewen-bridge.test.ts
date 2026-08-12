import { describe, expect, test } from "bun:test";

import {
  Box3,
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
  LOEWEN_BRIDGE_TRUSS_BAYS,
  createLoewenBridge,
} from "../src/LoewenBridge";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";
import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

describe("Löwenbrücke recognition model", () => {
  test("pins the published dimensions to the committed OSM centreline", () => {
    expect(LOEWEN_BRIDGE_PROFILE).toMatchObject({
      clearSpanM: 13,
      kind: "suspension",
      name: "Löwenbrücke",
      osmWayId: "1411957328",
      surveyedDeck: { halfLengthM: 8.65, halfWidthM: 1 },
      world: [-1766.908, 680.6395],
    });
    expect(Math.hypot(...LOEWEN_BRIDGE_PROFILE.axis)).toBeCloseTo(1, 5);
    expect(LOEWEN_BRIDGE_PROFILE.sourceUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("openstreetmap.org/way/1411957328"),
        expect.stringContaining("berlin.de/landesdenkmalamt"),
      ]),
    );
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
      osmWayId: LOEWEN_BRIDGE_PROFILE.osmWayId,
      trussBayCount: LOEWEN_BRIDGE_TRUSS_BAYS,
    });
  });

  test("keeps the authored bridge at the measured centre, bearing and scale", () => {
    const bridge = createLoewenBridge(groundPayload as never);
    const bodies = bridge.getObjectByName("Löwenbrücke bodies") as Mesh;
    bodies.geometry.computeBoundingBox();
    const localBounds = bodies.geometry.boundingBox!;

    expect(localBounds.max.x - localBounds.min.x).toBeCloseTo(17.3, 2);
    // The lion plinths sit outside the two-metre walking deck, as in the
    // photographs; their full sculptural envelope remains compact.
    expect(localBounds.max.z - localBounds.min.z).toBeGreaterThan(4);
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
    const dayMaterial = bodies.material;
    const dayInk = (ink.material as LineBasicMaterial).color.getHex();

    setIsoNightPresentation(bridge, true, true, "night");
    expect(bodies.material).toBe(bodies.userData.nightMaterial);
    expect((ink.material as LineBasicMaterial).color.getHex()).not.toBe(dayInk);

    setIsoNightPresentation(bridge, false, true, "day");
    expect(bodies.material).toBe(dayMaterial);
    expect((ink.material as LineBasicMaterial).color.getHex()).toBe(dayInk);
  });

  test("drops its centimetre-scale joinery before it can shimmer at overview distance", () => {
    expect(FINE_DETAIL_LAYER_NAMES).toEqual(
      expect.arrayContaining(["Löwenbrücke bodies", "Löwenbrücke ink lines"]),
    );
  });
});
