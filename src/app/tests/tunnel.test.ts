import { describe, expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh } from "three";

import { createTunnelPortals, RAMP_LENGTH_M } from "../src/TunnelPortals";
import {
  createTunnel,
  setTunnelPresentation,
  shouldUseUnderwaterPresentation,
  type TunnelPayload,
} from "../src/ThreeViewer";

const payload: TunnelPayload = {
  clear_height_m: 5,
  clear_width_each_direction_m: 10.5,
  depth_status: "schematic test depth",
  geometry_status: "test route",
  points: [
    [0, -10, 0],
    [0, -10, 120],
    [80, -10, 200],
  ],
};

describe("Tiergartentunnel rendering budget", () => {
  test("instances repeated fixtures and keeps four distinct blades per fan", () => {
    const tunnel = createTunnel(payload);
    const lamps = tunnel.getObjectByName(
      "Tiergartentunnel instanced ceiling lights",
    );
    const laneMarks = tunnel.getObjectByName(
      "Tiergartentunnel instanced dashed lane markings",
    );
    const fanRings = tunnel.getObjectByName(
      "Tiergartentunnel instanced ventilation fan rings",
    );
    const fanBlades = tunnel.getObjectByName(
      "Tiergartentunnel instanced ventilation fan blades",
    );

    expect(tunnel.visible).toBe(false);
    expect(lamps).toBeInstanceOf(InstancedMesh);
    expect(laneMarks).toBeInstanceOf(InstancedMesh);
    expect(fanRings).toBeInstanceOf(InstancedMesh);
    expect(fanBlades).toBeInstanceOf(InstancedMesh);
    expect((lamps as InstancedMesh).count).toBeGreaterThan(10);
    expect((laneMarks as InstancedMesh).count).toBeGreaterThan(10);
    expect((fanRings as InstancedMesh).count).toBe(2);
    expect((fanBlades as InstancedMesh).count).toBe(8);
    const portals = tunnel.getObjectByName(
      "Tiergartentunnel instanced portal frames",
    );
    expect(portals).toBeInstanceOf(InstancedMesh);
    // One frame per tube at each of the two visible endpoints.
    expect((portals as InstancedMesh).count).toBe(4);
    expect(tunnel.children.length).toBeLessThan(30);
  });

  test("hides above ground and reveals its cutaway below ground", () => {
    const tunnel = createTunnel(payload);
    const casing = tunnel.children[0] as Mesh;
    const lights = tunnel.getObjectByName(
      "Tiergartentunnel instanced ceiling lights",
    ) as Mesh;
    const material = casing.material as Material;

    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeCloseTo(0.19);
    expect(tunnel.visible).toBe(false);

    setTunnelPresentation(tunnel, true);
    expect(tunnel.visible).toBe(true);
    expect(material.opacity).toBeCloseTo(0.58);
    expect(casing.renderOrder).toBe(14);
    expect(lights.renderOrder).toBeGreaterThan(casing.renderOrder);

    setTunnelPresentation(tunnel, false);
    expect(tunnel.visible).toBe(false);
    expect(material.opacity).toBeCloseTo(0.19);
    expect(lights.renderOrder).toBeGreaterThan(casing.renderOrder);
  });

  test("does not hide the underside cutaway behind underwater fog", () => {
    expect(
      shouldUseUnderwaterPresentation({
        cameraY: -40,
        insideTunnel: false,
        underside: false,
      }),
    ).toBe(true);
    expect(
      shouldUseUnderwaterPresentation({
        cameraY: -40,
        insideTunnel: false,
        underside: true,
      }),
    ).toBe(false);
    expect(
      shouldUseUnderwaterPresentation({
        cameraY: -40,
        insideTunnel: true,
        underside: false,
      }),
    ).toBe(false);
  });

  test("gives both mouths a graded ramp between retaining walls", () => {
    const portals = createTunnelPortals({
      clear_height_m: payload.clear_height_m,
      clear_width_each_direction_m: payload.clear_width_each_direction_m,
      points: [
        [0, -10, 0],
        [0, -10, 100],
        [0, -10, 200],
        [0, -10, 400],
        [0, -10, 600],
        [0, -10, 700],
        [0, -10, 800],
      ],
    });
    // Surface geometry, unlike the cutaway: visible in the daylight scene.
    expect(portals.visible).toBe(true);
    for (const label of ["north", "south"]) {
      const deck = portals.children.filter(
        (child) => child.name === `Tiergartentunnel ${label} ramp carriageway deck`,
      );
      const walls = portals.children.filter(
        (child) => child.name === `Tiergartentunnel ${label} ramp retaining wall`,
      );
      const barriers = portals.children.filter(
        (child) => child.name === `Tiergartentunnel ${label} ramp noise barrier`,
      );
      const frames = portals.children.filter(
        (child) => child.name === `Tiergartentunnel ${label} ramp portal frame`,
      );
      // One trough per direction, two walls and two barriers around each.
      expect(deck.length).toBeGreaterThanOrEqual(2);
      expect(walls).toHaveLength(deck.length * 2);
      expect(barriers).toHaveLength(deck.length * 2);
      expect(frames).toHaveLength(2);
      expect(
        portals.getObjectByName(
          `Tiergartentunnel ${label} ramp dashed lane markings`,
        ),
      ).toBeInstanceOf(InstancedMesh);
    }
    // The ramp actually descends: the deepest deck is near tunnel level and
    // the shallowest is up at the street.
    const decks = portals.children.filter((child) =>
      child.name.endsWith("ramp carriageway deck"),
    );
    const ys = decks.map((deck) => deck.position.y);
    expect(Math.min(...ys)).toBeLessThan(-7);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    expect(RAMP_LENGTH_M).toBeGreaterThan(200);
  });

  test("aims both ramps down the real course, not at each other", () => {
    const portals = createTunnelPortals({
      clear_height_m: 5,
      clear_width_each_direction_m: 10.5,
      points: [
        [0, -10, 0],
        [0, -10, 900],
      ],
    });
    const north = portals.children.find(
      (child) => child.name === "Tiergartentunnel north ramp portal frame",
    )!;
    const south = portals.children.find(
      (child) => child.name === "Tiergartentunnel south ramp portal frame",
    )!;
    // Each portal stands one ramp length in from its own end of the course.
    expect(north.position.z).toBeCloseTo(RAMP_LENGTH_M, 3);
    expect(south.position.z).toBeCloseTo(900 - RAMP_LENGTH_M, 3);
  });
});
