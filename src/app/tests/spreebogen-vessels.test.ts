import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { WATER_TOP_Y } from "../src/MinecraftVoxelWorld";
import { createVessels } from "../src/Vessels";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = voxelPayload as unknown as VoxelPayload;
const waterTopY = ground.ground?.water_top_y_m ?? WATER_TOP_Y;

describe("drawn vessels (owner-requested staffage)", () => {
  const vessels = createVessels(waterTopY);

  test("both boats are drawn as flat tones with ink lines", () => {
    expect(vessels.getObjectByName("vessel bodies")).toBeInstanceOf(Mesh);
    expect(vessels.getObjectByName("vessel ink lines")).toBeInstanceOf(
      LineSegments,
    );
  });

  test("the group says it is invented, because OSM maps no boats", () => {
    expect(vessels.userData.extrapolated).toBe(true);
  });

  test("the hulls sit on the water, not above or under it", () => {
    const bodies = vessels.getObjectByName("vessel bodies") as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    // Freeboard and superstructure above the waterline, keel below it.
    expect(bounds.min.y).toBeLessThan(waterTopY);
    expect(bounds.min.y).toBeGreaterThan(waterTopY - 3);
    expect(bounds.max.y).toBeGreaterThan(waterTopY + 2);
    expect(bounds.max.y).toBeLessThan(waterTopY + 12);
  });

  test("the barge lies in the Humboldthafen and the yacht on the Spree", () => {
    const bounds = new Box3().setFromObject(vessels);
    // Humboldthafen spans z −847…−528, the Spree off the Kanzleramt z ≈ −404.
    expect(bounds.min.z).toBeLessThan(-600);
    expect(bounds.max.z).toBeGreaterThan(-420);
  });

  test("the lampions carry a warm night emissive", () => {
    const lampions = vessels.getObjectByName("vessel lamps") as Mesh;
    expect(lampions).toBeInstanceOf(Mesh);
    const night = lampions.userData.nightMaterial;
    expect(night.userData.nightEmissive).toBe(0xffb457);
    expect(night.userData.nightEmissiveIntensity).toBeGreaterThan(1);
  });

  test("adds static close-range wake ribbons without animation shimmer", () => {
    const wakes = vessels.getObjectByName("vessel wake ribbons");
    expect(wakes).toBeDefined();
    expect(wakes?.userData.staticAntiFlicker).toBe(true);
  });
});
