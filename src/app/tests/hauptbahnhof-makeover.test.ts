import { describe, expect, test } from "bun:test";
import {
  Box3,
  BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

import {
  createArchitecturalSignature,
  type HauptbahnhofModelSignature,
} from "../src/ArchitecturalLandmarks";

const signature: HauptbahnhofModelSignature = {
  anchor_world: [0, 0, 0],
  east_west_roof_length_m: 321,
  east_west_roof_width_m: 40,
  focus_camera: {
    azimuth_degrees: 52,
    distance_m: 370,
    polar_degrees: 42,
    target_height_m: 21,
  },
  geometry_status: "metric test",
  id: "hauptbahnhof-model",
  kind: "hauptbahnhof_model",
  landmark_name: "Berlin Hauptbahnhof",
  north_south_hall_length_m: 180,
  north_south_hall_width_m: 42,
  office_bridge_height_m: 46,
  rotation_y_degrees: 0,
  source_url: "https://www.deutschebahn.com/de/architektur_bahnhof-6878040",
};

function station(): Group {
  const result = createArchitecturalSignature(signature);
  if (!(result instanceof Group)) {
    throw new Error("the Hauptbahnhof signature must build");
  }
  return result;
}

function endTopY(mesh: Mesh, positiveX: boolean): number {
  const positions = mesh.geometry.getAttribute("position") as BufferAttribute;
  let top = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    if ((positiveX && x > 0) || (!positiveX && x < 0)) {
      top = Math.max(top, positions.getY(index));
    }
  }
  return top;
}

describe("Hauptbahnhof facade makeover", () => {
  test("gives the two office bridges mirrored raking crowns", () => {
    const bridges = station().children.filter(
      (child) => child.name === "Hauptbahnhof 46 m office bridge",
    ) as Mesh[];
    expect(bridges).toHaveLength(2);
    expect(endTopY(bridges[0], false)).toBeGreaterThan(
      endTopY(bridges[0], true) + 5,
    );
    expect(endTopY(bridges[1], true)).toBeGreaterThan(
      endTopY(bridges[1], false) + 5,
    );
  });

  test("puts the documented exposed steel order in front of the glass", () => {
    const root = station();
    const columns = root.getObjectByName(
      "Hauptbahnhof instanced office-bridge exoskeleton columns",
    );
    const beams = root.getObjectByName(
      "Hauptbahnhof instanced office-bridge longitudinal exoskeleton beams",
    );
    expect(columns).toBeInstanceOf(InstancedMesh);
    expect(beams).toBeInstanceOf(InstancedMesh);
    expect((columns as InstancedMesh).count).toBeGreaterThanOrEqual(20);
    expect((beams as InstancedMesh).count).toBeGreaterThanOrEqual(8);
    expect(
      root.children.filter(
        (child) =>
          child.name === "Hauptbahnhof office-bridge raking crown beam",
      ),
    ).toHaveLength(4);
  });

  test("fills both entrance gables and projects both glass canopies", () => {
    const root = station();
    for (const name of [
      "Hauptbahnhof Europaplatz entrance facade",
      "Hauptbahnhof Washingtonplatz entrance facade",
    ]) {
      const facade = root.getObjectByName(name) as Mesh;
      const bounds = new Box3().setFromObject(facade);
      expect(bounds.max.y).toBeGreaterThan(26);
      expect(bounds.min.y).toBeCloseTo(0, 4);
    }
    const canopies = root.children.filter(
      (child) =>
        child.name === "Hauptbahnhof entrance cantilevered glass canopy",
    ) as Mesh[];
    expect(canopies).toHaveLength(2);
    for (const canopy of canopies) {
      expect(canopy.material).toBeInstanceOf(MeshPhysicalMaterial);
      expect((canopy.material as MeshPhysicalMaterial).transparent).toBe(true);
      const size = new Box3().setFromObject(canopy).getSize(new Vector3());
      expect(size.x).toBeGreaterThanOrEqual(55);
      expect(size.z).toBeGreaterThanOrEqual(17);
    }
  });

  test("adds station identity and the roof-integrated solar field", () => {
    const root = station();
    expect(
      root.children.filter(
        (child) => child.name === "Hauptbahnhof entrance wordmark",
      ),
    ).toHaveLength(2);
    expect(
      root.getObjectByName("Hauptbahnhof Washingtonplatz DB pylon"),
    ).toBeInstanceOf(Mesh);
    expect(
      root.children.filter(
        (child) =>
          child.name === "Hauptbahnhof Washingtonplatz pylon DB badge",
      ),
    ).toHaveLength(4);
    expect(
      root.children.filter(
        (child) =>
          child.name === "Hauptbahnhof office-bridge rooftop louver bank",
      ),
    ).toHaveLength(4);
    const photovoltaics = root.getObjectByName(
      "Hauptbahnhof instanced roof-integrated photovoltaic modules",
    );
    expect(photovoltaics).toBeInstanceOf(InstancedMesh);
    expect((photovoltaics as InstancedMesh).count).toBe(260);
    expect(photovoltaics!.userData.documentedModuleCount).toBe(780);
  });
});
