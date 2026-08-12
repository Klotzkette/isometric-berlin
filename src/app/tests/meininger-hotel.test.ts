import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import { PRISM_SUPPRESSED_IDS } from "../src/IsometricCityWorld";
import {
  MEININGER_HOTEL_PROFILE,
  createMeiningerHotel,
} from "../src/MeiningerHotel";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = groundJson as unknown as VoxelPayload;

function hotel(): Group {
  return createMeiningerHotel(ground);
}

describe("the measured MEININGER Hotel at Hauptbahnhof", () => {
  test("pins the model to the official LoD2 shell and current OSM semantics", () => {
    const model = hotel();
    expect(MEININGER_HOTEL_PROFILE.lod2BuildingId).toBe("DEBE01YYK0002MxA");
    expect(MEININGER_HOTEL_PROFILE.payloadId).toBe("K0002MxA");
    expect(MEININGER_HOTEL_PROFILE.osmWayId).toBe("38383464");
    expect(MEININGER_HOTEL_PROFILE.measuredHeightM).toBeCloseTo(31.082, 3);
    expect(MEININGER_HOTEL_PROFILE.levels).toBe(10);
    expect(MEININGER_HOTEL_PROFILE.rooms).toBe(296);
    expect(MEININGER_HOTEL_PROFILE.footprintLocalM).toHaveLength(13);
    expect(model.position.x).toBeCloseTo(MEININGER_HOTEL_PROFILE.world[0], 6);
    expect(model.position.z).toBeCloseTo(MEININGER_HOTEL_PROFILE.world[1], 6);
    expect(model.rotation.y).toBeCloseTo(MEININGER_HOTEL_PROFILE.rotationY, 8);
    expect(model.userData.geometryStatus).toContain("LoD2 footprint");
    expect(model.userData.geometryStatus).toContain("unsurveyed window");
  });

  test("replaces the generic prism without exceeding its measured envelope", () => {
    const model = hotel();
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    expect(PRISM_SUPPRESSED_IDS.has(MEININGER_HOTEL_PROFILE.payloadId)).toBe(
      true,
    );
    expect(model.userData.groundY).toBeCloseTo(4.8, 4);
    expect(bounds.min.y).toBeGreaterThanOrEqual(model.userData.groundY - 0.01);
    expect(bounds.max.y).toBeLessThanOrEqual(
      model.userData.groundY + MEININGER_HOTEL_PROFILE.measuredHeightM + 0.01,
    );
    expect(size.x).toBeGreaterThan(49);
    expect(size.z).toBeGreaterThan(28);
  });

  test("draws a stable shell, fine facade layer and sparse warm night rooms", () => {
    const model = hotel();
    const shell = model.getObjectByName(
      "MEININGER Hotel surveyed shell bodies",
    ) as Mesh;
    const windows = model.getObjectByName(
      "MEININGER Hotel facade details bodies",
    ) as Mesh;
    const litWindows = model.getObjectByName(
      "MEININGER Hotel facade details lamps",
    ) as Mesh;
    const ink = model.getObjectByName(
      "MEININGER Hotel surveyed shell ink lines",
    );
    expect(shell).toBeInstanceOf(Mesh);
    expect(windows).toBeInstanceOf(Mesh);
    expect(litWindows).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(shell.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(shell.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(litWindows.userData.nightMaterial).toBeInstanceOf(
      MeshStandardMaterial,
    );
    expect(model.userData.detailCounts.windowCount).toBe(252);
    expect(model.userData.detailCounts.litWindowCount).toBeGreaterThan(25);
    expect(model.userData.detailCounts.litWindowCount).toBeLessThan(60);
    expect(model.userData.detailCounts.bollards).toBe(8);
  });

  test("keeps both photographed signs generated and mode-stable", () => {
    const model = hotel();
    for (const [name, lettering] of [
      ["MEININGER HOTELS entrance lettering", "MEININGER HOTELS"],
      ["MEININGER Hotel rooftop lettering", "MEININGER"],
    ] as const) {
      const sign = model.getObjectByName(name) as Mesh;
      expect(sign).toBeInstanceOf(Mesh);
      expect(sign.userData.lettering).toBe(lettering);
      expect(sign.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(sign.userData.nightMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(sign.userData.visualReference).toContain("owner-supplied");
      expect((sign.material as MeshBasicMaterial).map).toBeNull();
    }
  });
});
