import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  HAUPTBAHNHOF_INTERIOR_PROFILE,
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

describe("Hauptbahnhof current concourse", () => {
  test("keeps official facts separate from presentation estimates", () => {
    expect(HAUPTBAHNHOF_INTERIOR_PROFILE.levelCount).toBe(5);
    expect(HAUPTBAHNHOF_INTERIOR_PROFILE.geometryStatus).toContain(
      "not surveyed geometry",
    );
    expect(HAUPTBAHNHOF_INTERIOR_PROFILE.sources).toContain(
      "https://www.bahnhof.de/downloads/station-plans/1071.pdf",
    );
    expect(HAUPTBAHNHOF_INTERIOR_PROFILE.sources).toContain(
      "https://www.bahnhof.de/berlin-hauptbahnhof/einkaufen-und-essen/einstein-kaffee",
    );
  });

  test("builds the blue timetable board at the photo-referenced scale", () => {
    const root = station();
    const board = root.getObjectByName(
      "Hauptbahnhof blue departure board",
    ) as Mesh;
    const boardSize = new Box3().setFromObject(board).getSize(new Vector3());
    expect(boardSize.y).toBeCloseTo(
      HAUPTBAHNHOF_INTERIOR_PROFILE.departureBoard.heightM,
      4,
    );
    expect(boardSize.z).toBeCloseTo(
      HAUPTBAHNHOF_INTERIOR_PROFILE.departureBoard.widthM,
      4,
    );
    expect(board.userData.geometryStatus).toContain("presentation estimates");
    expect(board.material).toBeInstanceOf(MeshBasicMaterial);
    expect(board.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(board.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(board.userData.visualReference).toContain("owner-supplied");
    expect(
      root.getObjectByName("Hauptbahnhof departure board timetable grid"),
    ).toBeInstanceOf(LineSegments);
    const destinations = root.getObjectByName(
      "Hauptbahnhof instanced departure board destination strokes",
    ) as InstancedMesh;
    expect(destinations).toBeInstanceOf(InstancedMesh);
    expect(destinations.count).toBe(
      HAUPTBAHNHOF_INTERIOR_PROFILE.departureBoard.rowCount * 3,
    );
  });

  test("places Einstein Kaffee and the glass pavilion in the north arm", () => {
    const root = station();
    const cafe = root.getObjectByName(
      "Hauptbahnhof Einstein Kaffee storefront",
    ) as Mesh;
    const fascia = root.getObjectByName(
      "Hauptbahnhof Einstein Kaffee fascia",
    ) as Mesh;
    expect(cafe).toBeInstanceOf(Mesh);
    expect(cafe.position.z).toBeGreaterThan(
      signature.east_west_roof_width_m / 2,
    );
    expect(fascia.userData.lettering).toBe("EINSTEIN KAFFEE");

    const pavilion = root.getObjectByName(
      "Hauptbahnhof central glass service pavilion",
    ) as Group;
    const bounds = new Box3().setFromObject(pavilion);
    const size = bounds.getSize(new Vector3());
    expect(pavilion).toBeInstanceOf(Group);
    expect(size.x).toBeGreaterThanOrEqual(
      HAUPTBAHNHOF_INTERIOR_PROFILE.servicePavilion.widthM,
    );
    expect(size.z).toBeGreaterThanOrEqual(
      HAUPTBAHNHOF_INTERIOR_PROFILE.servicePavilion.depthM,
    );
    expect(bounds.min.z).toBeGreaterThan(signature.east_west_roof_width_m / 2);
    expect(bounds.max.z).toBeLessThan(signature.north_south_hall_length_m / 2);
  });

  test("uses batched static details for wall rhythm and lighting", () => {
    const root = station();
    const columns = root.getObjectByName(
      "Hauptbahnhof instanced interior wall columns",
    ) as InstancedMesh;
    const lights = root.getObjectByName(
      "Hauptbahnhof instanced concourse point lights",
    ) as InstancedMesh;
    const liftHoops = root.getObjectByName(
      "Hauptbahnhof instanced panoramic lift hoops",
    ) as InstancedMesh;
    expect(columns).toBeInstanceOf(InstancedMesh);
    expect(columns.count).toBe(52);
    expect(lights).toBeInstanceOf(InstancedMesh);
    expect(lights.count).toBe(48);
    expect(lights.userData.renderingContract).toContain(
      "no dynamic point lights",
    );
    expect(liftHoops).toBeInstanceOf(InstancedMesh);
    const liftProfile = HAUPTBAHNHOF_INTERIOR_PROFILE.panoramicLifts;
    const hoopCountPerShaft =
      Math.floor(
        (liftProfile.topM - liftProfile.bottomM) /
          liftProfile.ringSpacingM,
      ) + 1;
    expect(liftHoops.count).toBe(liftProfile.count * hoopCountPerShaft);
  });
});
