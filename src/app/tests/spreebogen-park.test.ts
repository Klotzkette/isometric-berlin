import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createSpreebogenPark,
  SPREEBOGEN_PARK_PROFILE,
} from "../src/SpreebogenPark";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = voxelPayload as unknown as VoxelPayload;

describe("Spreebogenpark landscape window", () => {
  test("keeps the documented OSM and landscape-design evidence", () => {
    expect(SPREEBOGEN_PARK_PROFILE.osmWayId).toBe("737280675");
    expect(SPREEBOGEN_PARK_PROFILE.landscapeWindowWidthM).toBe(17);
    expect(SPREEBOGEN_PARK_PROFILE.maximumRiseM).toBe(6.8);
    expect(SPREEBOGEN_PARK_PROFILE.ludwigErhardUferWayIds).toEqual([
      "34834265",
      "1128036906",
    ]);
    expect(SPREEBOGEN_PARK_PROFILE.sourceUrls).toHaveLength(3);
    expect(SPREEBOGEN_PARK_PROFILE.sourceUrls[1]).toContain("berlin.de");
  });

  test("builds two rising lawns and two Corten retaining walls", () => {
    const park = createSpreebogenPark(ground);
    const westLawn = park.getObjectByName(
      "Spreebogenpark west rising lawn",
    ) as Mesh;
    const eastLawn = park.getObjectByName(
      "Spreebogenpark east rising lawn",
    ) as Mesh;
    const westWall = park.getObjectByName(
      "Spreebogenpark west Corten wall",
    ) as Mesh;
    const eastWall = park.getObjectByName(
      "Spreebogenpark east Corten wall",
    ) as Mesh;

    for (const mesh of [westLawn, eastLawn, westWall, eastWall]) {
      expect(mesh).toBeInstanceOf(Mesh);
      expect(mesh.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(mesh.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    }
    expect(
      (westWall.userData.dayMaterial as MeshBasicMaterial).color.getHex(),
    ).toBe(0x4b332d);
    expect(
      (westWall.userData.nightMaterial as MeshStandardMaterial).color.getHex(),
    ).toBe(0x201918);
    expect(westLawn.geometry.getAttribute("position").count).toBe(
      SPREEBOGEN_PARK_PROFILE.lawnRows * 6,
    );
    expect(eastLawn.geometry.getAttribute("position").count).toBe(
      SPREEBOGEN_PARK_PROFILE.lawnRows * 6,
    );
    expect(
      park.getObjectByName("Spreebogenpark former Alsenstrasse axis"),
    ).toBeInstanceOf(LineSegments);
    expect(park.userData.keepInMinecraft).toBe(true);
  });

  test("stays inside the park and rises by the documented amount", () => {
    const park = createSpreebogenPark(ground);
    const bounds = new Box3().setFromObject(park);
    expect(bounds.min.x).toBeGreaterThan(-85);
    expect(bounds.max.x).toBeLessThan(125);
    expect(bounds.min.z).toBeGreaterThanOrEqual(
      SPREEBOGEN_PARK_PROFILE.northZ,
    );
    expect(bounds.max.z).toBeLessThanOrEqual(
      SPREEBOGEN_PARK_PROFILE.southZ,
    );
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(6);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(9);
  });
});
