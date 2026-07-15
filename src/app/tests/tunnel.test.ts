import { describe, expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh } from "three";

import {
  createTunnel,
  setTunnelPresentation,
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
    const material = casing.material as Material;

    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeCloseTo(0.19);
    expect(tunnel.visible).toBe(false);

    setTunnelPresentation(tunnel, true);
    expect(tunnel.visible).toBe(true);
    expect(material.opacity).toBeCloseTo(0.58);
    expect(casing.renderOrder).toBe(14);

    setTunnelPresentation(tunnel, false);
    expect(tunnel.visible).toBe(false);
    expect(material.opacity).toBeCloseTo(0.19);
  });
});
