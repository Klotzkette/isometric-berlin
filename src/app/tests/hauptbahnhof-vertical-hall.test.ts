import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  HAUPTBAHNHOF_INTERIOR_LEVELS,
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

const root = createArchitecturalSignature(signature) as Group;

describe("Hauptbahnhof vertical interior hall", () => {
  test("uses one ordered contract for all five public levels", () => {
    expect(HAUPTBAHNHOF_INTERIOR_LEVELS).toHaveLength(5);
    expect(HAUPTBAHNHOF_INTERIOR_PROFILE.levelCount).toBe(5);
    expect(
      HAUPTBAHNHOF_INTERIOR_LEVELS.map((level) => level.id),
    ).toEqual([
      "upper-rail",
      "upper-gallery",
      "ground-concourse",
      "lower-gallery",
      "deep-rail",
    ]);
    expect(
      HAUPTBAHNHOF_INTERIOR_LEVELS.map((level) => level.elevationM),
    ).toEqual([10.75, 4.6, 0, -5.4, -14.53]);
    expect(root.userData.interiorLevels).toHaveLength(5);
  });

  test("turns the gallery edges and cross links into transparent architecture", () => {
    const galleryGlass = root.getObjectByName(
      "Hauptbahnhof instanced gallery glass balustrade panels",
    ) as InstancedMesh;
    const bridgeDecks = root.getObjectByName(
      "Hauptbahnhof instanced concourse cross bridges",
    ) as InstancedMesh;
    const bridgeGlass = root.getObjectByName(
      "Hauptbahnhof instanced cross-bridge glass balustrades",
    ) as InstancedMesh;
    expect(galleryGlass).toBeInstanceOf(InstancedMesh);
    expect(galleryGlass.count).toBe(12);
    expect((galleryGlass.material as MeshStandardMaterial).transparent).toBe(
      true,
    );
    expect(bridgeDecks).toBeInstanceOf(InstancedMesh);
    expect(bridgeDecks.count).toBe(
      HAUPTBAHNHOF_INTERIOR_PROFILE.crossBridgeCount,
    );
    expect(bridgeGlass.count).toBe(
      HAUPTBAHNHOF_INTERIOR_PROFILE.crossBridgeCount * 2,
    );
    expect((bridgeGlass.material as MeshStandardMaterial).transparent).toBe(
      true,
    );
  });

  test("keeps the upper deck visibly carried by a batched Y-column order", () => {
    const columns = root.getObjectByName(
      "Hauptbahnhof instanced atrium support columns",
    ) as InstancedMesh;
    const branches = root.getObjectByName(
      "Hauptbahnhof instanced atrium Y support branches",
    ) as InstancedMesh;
    expect(columns).toBeInstanceOf(InstancedMesh);
    expect(columns.count).toBe(12);
    expect(branches).toBeInstanceOf(InstancedMesh);
    expect(branches.count).toBe(24);
  });

  test("runs four cylindrical panoramic lifts through every level", () => {
    const liftProfile = HAUPTBAHNHOF_INTERIOR_PROFILE.panoramicLifts;
    const shafts = root.children.filter(
      (child) => child.name === "Hauptbahnhof cylindrical glass lift shaft",
    ) as Mesh[];
    expect(shafts).toHaveLength(liftProfile.count);
    for (const shaft of shafts) {
      expect(shaft.geometry.type).toBe("CylinderGeometry");
      expect((shaft.material as MeshStandardMaterial).transparent).toBe(true);
      expect((shaft.material as MeshStandardMaterial).opacity).toBeLessThan(
        0.5,
      );
      expect(shaft.userData.servedLevelIds).toEqual(
        HAUPTBAHNHOF_INTERIOR_LEVELS.map((level) => level.id),
      );
      const bounds = new Box3().setFromObject(shaft);
      const size = bounds.getSize(new Vector3());
      expect(size.y).toBeCloseTo(liftProfile.topM - liftProfile.bottomM, 4);
      expect(bounds.min.y).toBeLessThan(
        HAUPTBAHNHOF_INTERIOR_LEVELS[4].elevationM,
      );
      expect(bounds.max.y).toBeGreaterThan(
        HAUPTBAHNHOF_INTERIOR_LEVELS[0].elevationM,
      );
    }
  });

  test("gives the lift tubes rings, all landing doors and visible cabins", () => {
    const liftProfile = HAUPTBAHNHOF_INTERIOR_PROFILE.panoramicLifts;
    const frames = root.getObjectByName(
      "Hauptbahnhof instanced cylindrical lift frames",
    ) as InstancedMesh;
    const hoops = root.getObjectByName(
      "Hauptbahnhof instanced panoramic lift hoops",
    ) as InstancedMesh;
    const collars = root.getObjectByName(
      "Hauptbahnhof instanced panoramic lift landing collars",
    ) as InstancedMesh;
    const doors = root.getObjectByName(
      "Hauptbahnhof instanced panoramic lift landing doors",
    ) as InstancedMesh;
    const cabins = root.children.filter(
      (child) => child.name === "Hauptbahnhof lift car",
    ) as Mesh[];
    const hoopCountPerShaft =
      Math.floor(
        (liftProfile.topM - liftProfile.bottomM) /
          liftProfile.ringSpacingM,
      ) + 1;
    expect(frames.count).toBe(
      liftProfile.count * liftProfile.verticalMullionsPerShaft,
    );
    expect(hoops.count).toBe(liftProfile.count * hoopCountPerShaft);
    expect(collars.count).toBe(
      liftProfile.count * liftProfile.landingElevationsM.length,
    );
    expect(doors.count).toBe(
      liftProfile.count * liftProfile.landingElevationsM.length * 2,
    );
    expect(cabins).toHaveLength(liftProfile.count);
    expect(new Set(cabins.map((cabin) => cabin.userData.levelId)).size).toBe(
      liftProfile.count,
    );
    for (const cabin of cabins) {
      expect(cabin.geometry.type).toBe("CylinderGeometry");
      expect((cabin.material as MeshStandardMaterial).transparent).toBe(true);
    }
  });
});
