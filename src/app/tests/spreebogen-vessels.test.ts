import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { WATER_TOP_Y } from "../src/MinecraftVoxelWorld";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import {
  REAL_SPREE_VESSEL_PROFILES,
  REEDEREI_RIEDEL_FLEET_SOURCE,
} from "../src/SpreeVesselProfiles";
import { createVessels } from "../src/Vessels";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = voxelPayload as unknown as VoxelPayload;
const waterTopY = ground.ground?.water_top_y_m ?? WATER_TOP_Y;

describe("source-bound drawn Spree vessels", () => {
  const vessels = createVessels(waterTopY);

  test("both boats are drawn as flat tones with ink lines", () => {
    expect(vessels.getObjectByName("vessel bodies")).toBeInstanceOf(Mesh);
    expect(vessels.getObjectByName("vessel ink lines")).toBeInstanceOf(
      LineSegments,
    );
  });

  test("binds real vessel profiles to the operator's primary fleet data", () => {
    expect(vessels.userData.extrapolated).toBe(false);
    expect(vessels.userData.sourceBound).toBe(true);
    expect(vessels.userData.properNamesVerified).toBe(true);
    expect(vessels.userData.properNameRendered).toBe(false);
    expect(vessels.userData.placementObserved).toBe(false);
    expect(vessels.userData.staticAntiFlicker).toBe(true);
    expect(vessels.userData.primarySource).toBe(REEDEREI_RIEDEL_FLEET_SOURCE);
    expect(vessels.userData.vessels).toEqual(
      REAL_SPREE_VESSEL_PROFILES.map((profile) => ({
        beamM: profile.beamM,
        buildYear: profile.buildYear,
        displayPositionWorldM: [...profile.displayPositionWorldM],
        draughtM: profile.draughtM,
        lengthM: profile.lengthM,
        name: profile.name,
        type: profile.type,
      })),
    );
    expect(vessels.getObjectByName("yacht stern name")).toBeUndefined();
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

  test("keeps every body vertex inside each exact published envelope", () => {
    const bodies = vessels.getObjectByName("vessel bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const minima = new Map<string, number>();
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const profile = REAL_SPREE_VESSEL_PROFILES.reduce(
        (nearest, candidate) => {
          const candidateDistance = Math.hypot(
            x - candidate.displayPositionWorldM[0],
            z - candidate.displayPositionWorldM[1],
          );
          const nearestDistance = Math.hypot(
            x - nearest.displayPositionWorldM[0],
            z - nearest.displayPositionWorldM[1],
          );
          return candidateDistance < nearestDistance ? candidate : nearest;
        },
      );
      const dx = x - profile.displayPositionWorldM[0];
      const dz = z - profile.displayPositionWorldM[1];
      const [hx, hz] = profile.heading;
      const along = dx * hx + dz * hz;
      const across = -dx * hz + dz * hx;
      expect(Math.abs(along)).toBeLessThanOrEqual(profile.lengthM / 2 + 0.02);
      expect(Math.abs(across)).toBeLessThanOrEqual(profile.beamM / 2 + 0.02);
      minima.set(
        profile.name,
        Math.min(minima.get(profile.name) ?? Infinity, y),
      );
    }
    for (const profile of REAL_SPREE_VESSEL_PROFILES) {
      expect(minima.get(profile.name)).toBeCloseTo(
        waterTopY - profile.draughtM,
        4,
      );
    }
  });

  test("the salon vessel lies in the Humboldthafen and panorama vessel on the Spree", () => {
    const bounds = new Box3().setFromObject(vessels);
    // Humboldthafen spans z −847…−528, the Spree off the Kanzleramt z ≈ −404.
    expect(bounds.min.z).toBeLessThan(-600);
    expect(bounds.max.z).toBeGreaterThan(-420);
  });

  test("navigation lamps stay restrained and contain no party lampions", () => {
    const lamps = vessels.getObjectByName("vessel lamps") as Mesh;
    expect(lamps).toBeInstanceOf(Mesh);
    const night = lamps.userData.nightMaterial;
    expect(night.userData.nightEmissive).toBe(0xf3e8c5);
    expect(night.userData.nightEmissiveIntensity).toBe(0.6);
  });

  test("adds static close-range wake ribbons without animation shimmer", () => {
    const wakes = vessels.getObjectByName("vessel wake ribbons");
    expect(wakes).toBeDefined();
    expect(wakes?.userData.staticAntiFlicker).toBe(true);
    expect(wakes?.userData.hiddenInSchwellenraum).toBe(true);
    setIsoNightPresentation(vessels, false, true, "schwellenraum");
    expect(wakes?.visible).toBe(false);
    setIsoNightPresentation(vessels, false, true, "day");
    expect(wakes?.visible).toBe(true);
  });
});
