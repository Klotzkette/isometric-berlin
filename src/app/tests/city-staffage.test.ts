import { describe, expect, test } from "bun:test";
import { Group } from "three";

import { createCityStaffage } from "../src/CityStaffage";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = groundJson as unknown as VoxelPayload;

describe("sparse city-life staffage", () => {
  test("remains sparse, diverse and explicitly illustrative", () => {
    const group = createCityStaffage(ground);
    expect(group).toBeInstanceOf(Group);
    expect(group!.userData.peopleCount).toBe(18);
    expect(group!.userData.peopleCount).toBeLessThanOrEqual(20);
    expect(group!.userData.bvgBusCount).toBe(2);
    expect(group!.userData.carCount).toBe(3);
    expect(group!.userData.bicycleCount).toBe(2);
    expect(group!.userData.eScooterCount).toBe(2);
    expect(group!.userData.strollerCount).toBe(2);
    expect(group!.userData.geometryStatus).toContain("Illustrative static");
  });
});
