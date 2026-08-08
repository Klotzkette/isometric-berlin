import { describe, expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh, Raycaster, Vector3 } from "three";

import {
  createTunnelPortals,
  RAMP_LENGTH_M,
  tunnelMouthViews,
} from "../src/TunnelPortals";
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

  test("seals the buried middle tube below the Cube and rail viaduct", () => {
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
    const cap = portals.getObjectByName(
      "Tiergartentunnel buried ground occlusion cap",
    ) as Mesh;
    const southBoreLamp = portals.getObjectByName(
      "Tiergartentunnel south ramp bore ceiling lamp",
    ) as Mesh;
    const capMaterial = cap.material as Material;

    expect(cap).toBeInstanceOf(Mesh);
    expect(capMaterial.depthTest).toBe(true);
    expect(capMaterial.depthWrite).toBe(true);
    // It wins after all forced-depth bore/lamp pieces, but leaves both
    // canonical portal troughs untouched.
    expect(cap.renderOrder).toBeGreaterThan(southBoreLamp.renderOrder);
    expect(cap.userData.coveredRouteRangeM[0]).toBe(RAMP_LENGTH_M);
    expect(cap.userData.coveredRouteRangeM[1]).toBeCloseTo(740, 3);
    expect(cap.userData.exemptPortalTroughs).toEqual(["north", "south"]);
    expect(cap.userData.geometryStatus).toContain("not surveyed");

    // An oblique above-ground ray over the former Hbf/Cube leak reaches the
    // opaque cap before it could reach an underground lane marking or lamp.
    const ray = new Raycaster(
      new Vector3(-32, 42, 360),
      new Vector3(32, -46, -60).normalize(),
    );
    const hit = ray.intersectObject(cap, false)[0];
    expect(hit).toBeDefined();
    expect(hit.point.y).toBeGreaterThan(2);
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
      expect(view.fov_degrees).toBe(39);
      // An oblique look down into the open cut: the camera is walked back
      // up the ramp's own axis and raised, so the polar angle falls out of
      // that stand rather than being a magic number.
      expect(view.polar_degrees).toBeGreaterThan(45);
      expect(view.polar_degrees).toBeLessThan(80);
      // It really does stand back up the ramp, not on the surrounding
      // plaza where the paving plate would block the view.
      expect(view.distance_m).toBeGreaterThan(25);
      expect(view.distance_m).toBeLessThan(50);
      // And it stays ABOVE street level: a camera sunk into the cut flips
      // the viewer into its underside presentation and shows the cutaway
      // instead of the mouth.
      const eyeY =
        view.target_world[1] +
        view.distance_m * Math.cos((view.polar_degrees * Math.PI) / 180);
      expect(eyeY).toBeGreaterThan(4);
      // The camera stands back UP the ramp, against the inward direction:
      // for this straight north-south course that is azimuth 180 for the
      // north bore (camera north of it) and 0 for the south bore.
      const azimuthRad = (view.azimuth_degrees * Math.PI) / 180;
      expect(Math.sign(Math.cos(azimuthRad))).toBe(-inwardZ);
    }
    // The two targets sit at the OPPOSITE deep ends of the course.
    expect(views.north.target_world[2]).toBeLessThan(400);
    expect(views.south.target_world[2]).toBeGreaterThan(400);
  });
});
