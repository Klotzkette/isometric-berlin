import { describe, expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh } from "three";
import scenePayload from "../public/mesh/regierungsviertel/scene.json";

import {
  createTunnelPortalApproachTester,
  createTunnelPortals,
  setTunnelPortalPresentation,
  tunnelMouthViews,
  type TunnelPortalId,
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

const realRoute = scenePayload.tiergartentunnel as TunnelPayload;
const portalIds = [
  "minna_cauer",
  "invalidenstrasse",
  "kemperplatz",
  "reichpietschufer",
] as const satisfies readonly TunnelPortalId[];

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
});

describe("measured Tiergartentunnel entrances", () => {
  test("builds four access sites and eight source-backed carriageways", () => {
    const portals = createTunnelPortals(realRoute);
    expect(portals.visible).toBe(true);
    expect(portals.userData.portalApproachCount).toBe(4);
    expect(portals.userData.carriagewayCount).toBe(8);

    for (const portalId of portalIds) {
      const approach = realRoute.portal_approaches?.[portalId];
      expect(approach).toBeDefined();
      expect(approach!.carriageways).toHaveLength(2);
      for (const carriageway of approach!.carriageways) {
        const label = `Tiergartentunnel ${portalId} ${carriageway.id} ramp`;
        const deck = portals.getObjectByName(
          `${label} carriageway deck`,
        ) as Mesh;
        expect(deck).toBeDefined();
        expect(deck.userData.carriagewayId).toBe(carriageway.id);
        expect(deck.userData.osmProfileSamples).toBe(
          carriageway.points.length + 1,
        );
        expect(deck.userData.maximumWidthM).toBeCloseTo(
          Math.max(...carriageway.widths_m),
          6,
        );
        expect(
          portals.children.filter(
            (child) => child.name === `${label} retaining wall`,
          ),
        ).toHaveLength(2);
        expect(
          portals.children.filter(
            (child) => child.name === `${label} safety railing`,
          ),
        ).toHaveLength(2);
        expect(
          portals.children.filter(
            (child) => child.name === `${label} acoustic wall slats`,
          ),
        ).toHaveLength(2);
        expect(
          portals.getObjectByName(`${label} instanced wall lights`),
        ).toBeInstanceOf(InstancedMesh);
        expect(
          portals.getObjectByName(`${label} dashed lane markings`),
        ).toBeInstanceOf(InstancedMesh);

        const bounds = deck.geometry.boundingBox!;
        expect(
          Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z),
        ).toBeLessThan(150);
      }
      const portalLabel = `Tiergartentunnel ${portalId} shared portal`;
      expect(portals.getObjectByName(`${portalLabel} head beam`)).toBeDefined();
      expect(portals.getObjectByName(`${portalLabel} coping`)).toBeDefined();
      expect(
        portals.children.filter((child) =>
          child.name.startsWith(`${portalLabel} jamb `),
        ),
      ).toHaveLength(3);
      const centreJamb = portals.getObjectByName(
        `${portalLabel} jamb 2`,
      ) as Mesh<BoxGeometry>;
      expect(centreJamb.geometry.parameters.width).toBeGreaterThanOrEqual(0.8);
      expect(
        portals.children
          .filter((child) => child.name.endsWith(" lane-control gantry"))
          .filter((child) => child.name.startsWith(portalLabel)),
      ).toHaveLength(2);
      const expectedThresholdLamps = approach!.carriageways.reduce(
        (total, carriageway) => total + carriageway.lane_count,
        0,
      );
      expect(
        portals.children
          .filter((child) => child.name.includes(" threshold lamp "))
          .filter((child) => child.name.startsWith(portalLabel)),
      ).toHaveLength(expectedThresholdLamps);
    }
  });

  test("uses one square shared headwall instead of crossed per-lane beams", () => {
    const portals = createTunnelPortals(realRoute);
    expect(
      portals.children.filter((child) => child.name.endsWith(" head beam")),
    ).toHaveLength(4);
    expect(
      portals.children.filter((child) => child.name.endsWith(" portal frame")),
    ).toHaveLength(0);
    expect(
      portals.children.filter((child) => child.name.endsWith(" coping")),
    ).toHaveLength(4);
  });

  test("continues both carriageways on one shared axis behind each portal", () => {
    const portals = createTunnelPortals(realRoute);
    for (const portalId of portalIds) {
      const lamps = portals.children.filter(
        (child) =>
          child.name.startsWith(`Tiergartentunnel ${portalId} `) &&
          child.name.endsWith("bore ceiling lamp"),
      );
      expect(lamps.length).toBeGreaterThan(1);
      const bearings = new Set(
        lamps.map((lamp) => Math.round(lamp.rotation.y * 1_000_000)),
      );
      expect(bearings.size).toBe(1);
    }
  });

  test("never invents a generic 260 metre surface ramp", () => {
    const portals = createTunnelPortals({
      clear_height_m: 5,
      clear_width_each_direction_m: 10.5,
      points: [
        [0, -10, 0],
        [0, -10, 900],
      ],
    });
    expect(portals.children).toHaveLength(0);
    expect(portals.userData.portalApproachCount).toBe(0);
    expect(portals.userData.carriagewayCount).toBe(0);
  });

  test("keeps exterior close-ups depth-tested and the buried bore occluded", () => {
    const portals = createTunnelPortals(realRoute);
    const label = "Tiergartentunnel reichpietschufer east ramp";
    const bore = portals.getObjectByName(`${label} bore ceiling lamp`)!;
    const boreMaterial = (bore as Mesh).material as Material;
    const ramp = portals.getObjectByName(`${label} carriageway deck`) as Mesh;
    const rampMaterial = ramp.material as Material;

    setTunnelPortalPresentation(portals, false, false);
    expect(portals.visible).toBe(true);
    expect(ramp.visible).toBe(true);
    expect(bore.visible).toBe(false);
    expect(boreMaterial.depthTest).toBe(true);
    expect(boreMaterial.depthWrite).toBe(true);
    expect(rampMaterial.depthTest).toBe(true);
    expect(rampMaterial.depthWrite).toBe(true);

    setTunnelPortalPresentation(portals, false, false, true);
    expect(bore.visible).toBe(false);
    expect(boreMaterial.depthTest).toBe(true);
    expect(boreMaterial.depthWrite).toBe(true);
    expect(rampMaterial.depthTest).toBe(true);
    expect(rampMaterial.depthWrite).toBe(true);
    expect(
      portals.getObjectByName(
        "Tiergartentunnel reichpietschufer shared portal east opening shadow",
      )!.visible,
    ).toBe(true);

    setTunnelPortalPresentation(portals, false, true, true);
    expect(portals.visible).toBe(true);
    expect(bore.visible).toBe(false);
    expect(
      portals.getObjectByName(
        "Tiergartentunnel reichpietschufer shared portal east opening shadow",
      )!.visible,
    ).toBe(true);
    expect(boreMaterial.depthTest).toBe(true);
    expect(boreMaterial.depthWrite).toBe(true);

    setTunnelPortalPresentation(portals, true, false, true);
    expect(portals.visible).toBe(false);
    expect(bore.visible).toBe(false);
  });

  test("contains no route-spanning surface cap or default-visible bore", () => {
    const portals = createTunnelPortals(realRoute);
    expect(
      portals.getObjectByName("Tiergartentunnel buried ground occlusion cap"),
    ).toBeUndefined();
    const bores = portals.children.filter((object) =>
      object.name.includes(" ramp bore "),
    );
    expect(bores.length).toBeGreaterThan(70);
    expect(bores.every((object) => object.visible === false)).toBe(true);
  });

  test("keeps every visible exterior material behind the depth buffer", () => {
    const portals = createTunnelPortals(realRoute);
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

  test("keeps recessed mouths and buried helper bores dark in the day style", () => {
    const portals = createTunnelPortals(realRoute);
    const darkMaterialNames: string[] = [];
    portals.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      if (
        object.name.includes("opening shadow") ||
        object.name.includes("bore depth cap")
      ) {
        for (const material of materials) {
          if (material.userData.preserveAuthoredDark === true) {
            darkMaterialNames.push(object.name);
          }
        }
      }
    });
    expect(
      darkMaterialNames.filter((name) => name.includes("opening shadow")),
    ).toHaveLength(8);
    expect(
      darkMaterialNames.filter((name) => name.includes("bore depth cap")),
    ).toHaveLength(8);
  });

  test("cuts the ground only along the eight mapped carriageways", () => {
    const insideApproach = createTunnelPortalApproachTester(realRoute);
    for (const approach of Object.values(realRoute.portal_approaches ?? {})) {
      for (const carriageway of approach.carriageways) {
        for (const point of [
          carriageway.points[0],
          carriageway.points.at(-1)!,
        ]) {
          expect(insideApproach(point[0], point[2])).toBe(true);
        }
      }
    }
    expect(insideApproach(2_500, 2_500)).toBe(false);
    const kemper = realRoute.portal_approaches!.kemperplatz!.carriageways[0];
    expect(insideApproach(kemper.points[0][0] + 24, kemper.points[0][2])).toBe(
      false,
    );
  });

  test("can clear an entire coarse terrain cell at a portal edge", () => {
    const oneCarriageway = {
      points: [
        [0, -3, 0],
        [0, -8, 40],
      ] as [number, number, number][],
      portal_approaches: {
        kemperplatz: {
          carriageways: [
            {
              id: "east",
              lane_count: 2,
              osm_way_ids: ["test"],
              points: [
                [0, 4, 0],
                [0, 0, 40],
              ] as [number, number, number][],
              widths_m: [6, 6],
            },
          ],
          geometry_status: "test",
          label: "test",
          structure: "open_cut" as const,
        },
      },
    };
    const centreOnly = createTunnelPortalApproachTester(oneCarriageway);
    const wholeFourMetreCell = createTunnelPortalApproachTester(
      oneCarriageway,
      4 / Math.SQRT2,
    );

    expect(centreOnly(5.55, 20)).toBe(false);
    expect(wholeFourMetreCell(5.55, 20)).toBe(true);
  });

  test("provides low bore views for both endpoints and both branches", () => {
    const views = tunnelMouthViews(realRoute)!;
    expect(views).not.toBeNull();
    expect(views.invalidenstrasse).toBeDefined();
    expect(views.kemperplatz).toBeDefined();
    for (const [portalId, view] of [
      ["minna_cauer", views.north],
      ["invalidenstrasse", views.invalidenstrasse!],
      ["kemperplatz", views.kemperplatz!],
      ["reichpietschufer", views.south],
    ] as const) {
      const mouth =
        realRoute.portal_approaches![portalId]!.carriageways[0].points.at(-1)!;
      expect(
        Math.hypot(
          view.target_world[0] - mouth[0],
          view.target_world[2] - mouth[2],
        ),
      ).toBeCloseTo(10, 4);
      expect(view.target_height_m).toBe(0);
      expect(view.fov_degrees).toBe(48);
      expect(view.distance_m).toBeGreaterThan(20);
      expect(view.distance_m).toBeLessThan(60);
      expect(view.polar_degrees).toBeGreaterThan(80);
      expect(view.polar_degrees).toBeLessThan(100);
    }
  });
});
