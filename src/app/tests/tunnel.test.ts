import { describe, expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh, Vector3 } from "three";
import scenePayload from "../public/mesh/regierungsviertel/scene.json";

import {
  createTunnelPortals,
  RAMP_LENGTH_M,
  setTunnelPortalPresentation,
  tunnelMouthViews,
} from "../src/TunnelPortals";
import { createTunnelFlightPlan } from "../src/tunnelFlight";
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
    expect((fanRings as InstancedMesh).count).toBe(4);
    expect((fanBlades as InstancedMesh).count).toBe(16);
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

    setTunnelPresentation(tunnel, false, true);
    expect(tunnel.visible).toBe(true);
    expect(material.opacity).toBe(1);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(true);

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
        (child) =>
          child.name === `Tiergartentunnel ${label} ramp carriageway deck`,
      );
      const walls = portals.children.filter(
        (child) =>
          child.name === `Tiergartentunnel ${label} ramp retaining wall`,
      );
      const barriers = portals.children.filter(
        (child) =>
          child.name === `Tiergartentunnel ${label} ramp noise barrier`,
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

    // The mouths are genuinely OPEN ("man muss … tief hineinschauen
    // können"): past each portal frame a real bore recedes — deck, walls,
    // ceiling, a row of lamps marching into the dark and a near-black
    // depth cap — one per tube, two tubes per mouth. All of it sits below
    // street level so it can only be seen through the mouth.
    for (const label of ["north", "south"]) {
      const prefix = `Tiergartentunnel ${label} ramp bore`;
      const parts = (suffix: string) =>
        portals.children.filter(
          (child) => child.name === `${prefix} ${suffix}`,
        );
      expect(parts("deck")).toHaveLength(2);
      expect(parts("ceiling")).toHaveLength(2);
      expect(parts("wall")).toHaveLength(4);
      expect(parts("safety guide")).toHaveLength(4);
      expect(parts("depth cap")).toHaveLength(2);
      const lamps = parts("ceiling lamp");
      expect(lamps.length).toBeGreaterThanOrEqual(8);
      for (const piece of [...parts("deck"), ...parts("depth cap"), ...lamps]) {
        expect(piece.position.y).toBeLessThan(0);
        // The official mesh is a closed, uncut ground shell. Daylight portal
        // pieces must render over that shell rather than vanish under it.
        const material = piece.material as Material;
        expect(material.depthTest).toBe(false);
        expect(material.depthWrite).toBe(false);
      }
    }
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

  test("aligns both directional flight tubes with the rendered portal mouths", () => {
    const course: [number, number, number][] = [
      [0, -10, 0],
      [0, -10, 400],
      [0, -10, 900],
    ];
    const width = 10.5;
    const offset = width / 2 + 0.85;
    const portals = createTunnelPortals({
      clear_height_m: 5,
      clear_width_each_direction_m: width,
      points: course,
    });
    const northFrames = portals.children.filter(
      (child) => child.name === "Tiergartentunnel north ramp portal frame",
    );
    const southFrames = portals.children.filter(
      (child) => child.name === "Tiergartentunnel south ramp portal frame",
    );
    const southbound = createTunnelFlightPlan(course, "north-to-south", offset);
    const northbound = createTunnelFlightPlan(course, "south-to-north", offset);
    const pointAtPortal = (
      plan: ReturnType<typeof createTunnelFlightPlan>,
      distanceM: number,
    ) => {
      const index = plan.cumulativeM.findIndex(
        (distance) => Math.abs(distance - distanceM) < 1e-6,
      );
      return plan.points[index];
    };

    const southboundEntry = pointAtPortal(southbound, southbound.entryPortalM);
    const southboundExit = pointAtPortal(southbound, southbound.exitPortalM);
    const northboundEntry = pointAtPortal(northbound, northbound.entryPortalM);
    const northboundExit = pointAtPortal(northbound, northbound.exitPortalM);
    expect(
      northFrames.some(
        (frame) =>
          Math.hypot(
            frame.position.x - southboundEntry.x,
            frame.position.z - southboundEntry.z,
          ) < 1e-6,
      ),
    ).toBe(true);
    expect(
      southFrames.some(
        (frame) =>
          Math.hypot(
            frame.position.x - southboundExit.x,
            frame.position.z - southboundExit.z,
          ) < 1e-6,
      ),
    ).toBe(true);
    expect(
      southFrames.some(
        (frame) =>
          Math.hypot(
            frame.position.x - northboundEntry.x,
            frame.position.z - northboundEntry.z,
          ) < 1e-6,
      ),
    ).toBe(true);
    expect(
      northFrames.some(
        (frame) =>
          Math.hypot(
            frame.position.x - northboundExit.x,
            frame.position.z - northboundExit.z,
          ) < 1e-6,
      ),
    ).toBe(true);
  });

  test("contains no route-spanning surface cap or default-visible bore", () => {
    const portals = createTunnelPortals({
      clear_height_m: 5,
      clear_width_each_direction_m: 10.5,
      points: [
        [0, -10, 0],
        [0, -10, 300],
        [0, -10, 700],
        [0, -10, 1000],
      ],
    });
    expect(
      portals.getObjectByName(
        "Tiergartentunnel buried ground occlusion cap",
      ),
    ).toBeUndefined();
    const bores = portals.children.filter((object) =>
      object.name.includes(" ramp bore "),
    );
    expect(bores.length).toBeGreaterThan(20);
    expect(bores.every((object) => object.visible === false)).toBe(true);
  });

  test("reveals bore details only for an explicit tunnel-mouth focus", () => {
    const portals = createTunnelPortals({
      clear_height_m: 5,
      clear_width_each_direction_m: 10.5,
      points: [
        [0, -10, 0],
        [0, -10, 500],
        [0, -10, 1000],
      ],
    });
    const bore = portals.getObjectByName(
      "Tiergartentunnel south ramp bore ceiling lamp",
    )!;
    const ramp = portals.getObjectByName(
      "Tiergartentunnel south ramp carriageway deck",
    )!;

    setTunnelPortalPresentation(portals, false, false);
    expect(portals.visible).toBe(true);
    expect(ramp.visible).toBe(true);
    expect(bore.visible).toBe(false);
    const rampMaterial = (ramp as Mesh).material as Material;
    expect(rampMaterial.depthTest).toBe(true);
    expect(rampMaterial.depthWrite).toBe(true);

    setTunnelPortalPresentation(portals, false, false, true);
    expect(portals.visible).toBe(true);
    expect(ramp.visible).toBe(true);
    expect(bore.visible).toBe(true);
    expect(rampMaterial.depthTest).toBe(false);
    expect(rampMaterial.depthWrite).toBe(false);

    // Leaving the authored bore shot restores real occlusion. In particular,
    // the south ramp can no longer paint through the Potsdamer-Platz ensemble.
    setTunnelPortalPresentation(portals, false, false, false);
    expect(rampMaterial.depthTest).toBe(true);
    expect(rampMaterial.depthWrite).toBe(true);

    setTunnelPortalPresentation(portals, false, true, true);
    expect(portals.visible).toBe(true);
    expect(ramp.visible).toBe(true);
    expect(bore.visible).toBe(false);

    setTunnelPortalPresentation(portals, true, false, true);
    expect(portals.visible).toBe(false);
    expect(bore.visible).toBe(false);
  });

  test("keeps every real-route bore hidden in an ordinary exterior view", () => {
    const realRoute = scenePayload.tiergartentunnel as TunnelPayload;
    const portals = createTunnelPortals(realRoute);
    const bores = portals.children.filter((object) =>
      object.name.includes(" ramp bore "),
    );

    expect(bores.length).toBeGreaterThan(20);
    expect(bores.every((object) => object.visible === false)).toBe(true);
    expect(
      portals.children.some((object) =>
        object.name.includes("buried ground occlusion cap"),
      ),
    ).toBe(false);
    const visibleDepthBypasses: string[] = [];
    portals.traverse((object) => {
      if (!(object instanceof Mesh) || !object.visible) {
        return;
      }
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      if (materials.some((material) => !material.depthTest)) {
        visibleDepthBypasses.push(object.name);
      }
    });
    expect(visibleDepthBypasses).toEqual([]);
  });

  test("both bore views stand low on the axis and aim inside the tube", () => {
    const course: [number, number, number][] = [
      [0, -10, 0],
      [0, -10, 100],
      [0, -10, 200],
      [0, -10, 400],
      [0, -10, 600],
      [0, -10, 700],
      [0, -10, 800],
    ];
    const views = tunnelMouthViews({
      clear_height_m: 5,
      clear_width_each_direction_m: 10.5,
      points: course,
    })!;
    expect(views).not.toBeNull();
    for (const [view, inwardZ] of [
      [views.north, 1],
      [views.south, -1],
    ] as const) {
      // The target sits INSIDE the bore, at half its clear height above
      // the tunnel floor.
      expect(view.target_world[1]).toBeCloseTo(-10 + 2.5, 1);
      expect(view.target_height_m).toBe(0);
      // The tunnel is a close photographic view. Applying the drawn city's
      // 16° FOV dolly factor would move the stand out over its forecourt.
      expect(view.fov_degrees).toBeGreaterThanOrEqual(36);
      expect(view.fov_degrees).toBeLessThanOrEqual(38);
      // A nearly horizontal sight line follows the ramp through the lamp row
      // instead of looking down through the portal beam.
      expect(view.polar_degrees).toBeGreaterThan(86);
      expect(view.polar_degrees).toBeLessThan(91);
      // It really does stand back up the ramp, not on the surrounding
      // plaza where the paving plate would block the view.
      expect(view.distance_m).toBeGreaterThan(20);
      expect(view.distance_m).toBeLessThan(50);
      // The authored portal camera follows the ramp grade. ThreeViewer keeps
      // this explicit bore shot out of the generic underside/underwater mode.
      const eyeY =
        view.target_world[1] +
        view.distance_m * Math.cos((view.polar_degrees * Math.PI) / 180);
      expect(eyeY).toBeGreaterThan(-9);
      expect(eyeY).toBeLessThan(-6.5);
      // The camera stands back UP the ramp, against the inward direction:
      // for this straight north-south course that is azimuth 180 for the
      // north bore (camera north of it) and 0 for the south bore.
      const azimuthRad = (view.azimuth_degrees * Math.PI) / 180;
      expect(Math.sign(Math.cos(azimuthRad))).toBe(-inwardZ);
    }
    // The two targets sit at the OPPOSITE deep ends of the course.
    expect(views.north.target_world[2]).toBeLessThan(400);
    expect(views.south.target_world[2]).toBeGreaterThan(400);
    expect(views.south.fov_degrees).toBeLessThan(views.north.fov_degrees);
  });
});
