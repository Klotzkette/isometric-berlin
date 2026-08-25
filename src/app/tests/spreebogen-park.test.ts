import { describe, expect, test } from "bun:test";
import {
  Box3,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

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
    expect(SPREEBOGEN_PARK_PROFILE.panoramawegWayId).toBe("4395332");
    expect(SPREEBOGEN_PARK_PROFILE.panoramawegWidthM).toBe(2.4);
    expect(SPREEBOGEN_PARK_PROFILE.panoramawegSupportCount).toBe(9);
    expect(SPREEBOGEN_PARK_PROFILE.gartenspurSlabCount).toBe(18);
    expect(SPREEBOGEN_PARK_PROFILE.geometryStatus).toContain("exact path axes");
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
    expect(
      park.getObjectByName(
        "Spreebogenpark Ludwig-Erhard-Ufer stone edge bands",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      park.getObjectByName("Spreebogenpark raised Panoramaweg"),
    ).toBeInstanceOf(Mesh);
    expect(
      park.getObjectByName("Spreebogenpark Panoramaweg ink"),
    ).toBeInstanceOf(LineSegments);
    expect(
      park.getObjectByName("Spreebogenpark Gartenspur slabs"),
    ).toBeInstanceOf(Mesh);
    expect(park.userData.keepInMinecraft).toBe(true);
  });

  test("covers the mapped river edge while keeping a bounded render budget", () => {
    const park = createSpreebogenPark(ground);
    const bounds = new Box3().setFromObject(park);
    expect(bounds.min.x).toBeGreaterThan(-145);
    expect(bounds.min.x).toBeLessThan(-139);
    expect(bounds.max.x).toBeGreaterThan(268);
    expect(bounds.max.x).toBeLessThan(273);
    expect(bounds.min.z).toBeGreaterThan(-425);
    expect(bounds.min.z).toBeLessThan(-420);
    expect(bounds.max.z).toBeLessThanOrEqual(
      SPREEBOGEN_PARK_PROFILE.southZ + 1,
    );
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(8);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(12);

    let drawables = 0;
    let vertices = 0;
    park.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        drawables += 1;
        vertices += object.geometry.getAttribute("position")?.count ?? 0;
      }
    });
    expect(drawables).toBeLessThanOrEqual(12);
    expect(vertices).toBeGreaterThan(4_000);
    expect(vertices).toBeLessThan(9_000);
  });
});
