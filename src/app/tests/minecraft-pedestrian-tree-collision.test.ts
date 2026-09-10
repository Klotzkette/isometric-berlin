import { describe, expect, test } from "bun:test";

import { LENNE_OAK_PROFILE } from "../src/LenneOak";
import type { ParkDetailsPayload, ParkTree } from "../src/ParkDetails";
import {
  addPedestrianParkObstacles,
  createPedestrianParkTreeSolidTester,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import type { MinecraftVoxelDetailProfile } from "../src/MinecraftVoxelWorld";
import type { VisualMode } from "../src/visualMode";

const newlyOmittedPosition = [-1656.21, 5.245, 688.7] as const;
const v127OmittedPosition = [-1652.08, 5.245, 682.89] as const;
const fullOnlyPosition = [1001.2, 4.25, 901.3] as const;
const bothProfilesPosition = [1009.2, 4.25, 901.3] as const;
const lampPosition = [1040, 4.25, 950] as const;

function tree(position: readonly [number, number, number]): ParkTree {
  return {
    crown_radius_m: 4,
    height_m: 16,
    id: `fixture-${position[0]}`,
    leaf_type: "broadleaved",
    position: [...position],
    source: "berlin_official",
    species: "Sommer-Eiche, Stiel-Eiche",
    trunk_radius_m: 0.3,
    variant: 0,
  };
}

function fixture(profile: MinecraftVoxelDetailProfile = "full", cellM = 4) {
  const state = { mode: "day" as VisualMode, voxelAttached: false };
  const environment: PedestrianEnvironment = {
    bounds: { minX: -6000, maxX: 6000, minZ: -6000, maxZ: 6000 },
    groundAt: () => 4.25,
    parkTreeSolidAt: createPedestrianParkTreeSolidTester(
      cellM,
      profile,
      () => state.mode === "minecraft" && state.voxelAttached,
    ),
  };
  const oak: ParkTree = {
    ...tree(LENNE_OAK_PROFILE.position),
    crown_radius_m: LENNE_OAK_PROFILE.crownRadiusM,
    height_m: LENNE_OAK_PROFILE.heightM,
    species: LENNE_OAK_PROFILE.commonName,
    trunk_radius_m: LENNE_OAK_PROFILE.trunkRadiusM,
  };
  const payload: ParkDetailsPayload = {
    paths: [],
    playgrounds: [],
    schema_version: 2,
    source: { attribution: "fixture", geometry_status: "fixture", name: "fixture" },
    street_lights: [{
      height_m: 6,
      id: "lamp",
      light_type: null,
      position: [...lampPosition],
      rotation_degrees: 0,
      street: null,
    }],
    trees: [
      tree(newlyOmittedPosition),
      tree(v127OmittedPosition),
      tree(fullOnlyPosition),
      tree(bothProfilesPosition),
      oak,
    ],
  };
  const obstacles = addPedestrianParkObstacles(environment, payload);
  const blocked = ([x, y, z]: readonly [number, number, number]) =>
    pedestrianPointIsBlocked(x, z, y, obstacles, environment);
  return { blocked, environment, obstacles, state };
}

describe("Minecraft pedestrian tree density collision", () => {
  test("releases a newly omitted real Tiergarten trunk and restores it on returning to Day", () => {
    const { blocked, environment, obstacles, state } = fixture();
    const cells = obstacles.cells;
    const count = obstacles.obstacleCount;
    expect(blocked(newlyOmittedPosition)).toBeTrue();
    state.mode = "minecraft";
    state.voxelAttached = true;
    expect(blocked(newlyOmittedPosition)).toBeFalse();
    expect(blocked(fullOnlyPosition)).toBeTrue();
    expect(blocked(bothProfilesPosition)).toBeTrue();
    expect(blocked(lampPosition)).toBeTrue();
    for (const mode of ["day", "night", "snowstorm", "schwellenraum"] as const) {
      state.mode = mode;
      expect(blocked(newlyOmittedPosition), mode).toBeTrue();
    }
    expect(environment.obstacles).toBe(obstacles);
    expect(obstacles.cells).toBe(cells);
    expect(obstacles.obstacleCount).toBe(count);
    expect(obstacles.treeCount).toBe(5);
  });

  test("releases the new v1.0.27 thinning bucket in both profiles without changing drawn collision", () => {
    const [x, , z] = v127OmittedPosition;
    const hash =
      (Math.imul(Math.floor(x / 4), 73_856_093) ^
        Math.imul(Math.floor(z / 4), 19_349_663)) >>> 0;
    // This exact delivered Tiergarten tree survived both v1.0.26 profiles.
    expect(hash % 3).toBe(0);
    expect(Math.floor(hash / 3) % 6).toBe(4);
    for (const profile of ["full", "mobile"] as const) {
      const { blocked, state } = fixture(profile);
      expect(blocked(v127OmittedPosition)).toBeTrue();
      state.mode = "minecraft";
      state.voxelAttached = true;
      expect(blocked(v127OmittedPosition)).toBeFalse();
      state.mode = "day";
      expect(blocked(v127OmittedPosition)).toBeTrue();
    }
  });

  test("uses the mobile tree subset while retaining Lenné-Eiche in both profiles", () => {
    for (const profile of ["full", "mobile"] as const) {
      const { blocked, obstacles, state } = fixture(profile);
      state.mode = "minecraft";
      state.voxelAttached = true;
      expect(blocked(newlyOmittedPosition)).toBeFalse();
      expect(blocked(fullOnlyPosition)).toBe(profile === "full");
      expect(blocked(bothProfilesPosition)).toBeTrue();
      expect(blocked(LENNE_OAK_PROFILE.position)).toBeTrue();
      const landmark = [...obstacles.cells.values()].flat().find(
        (obstacle) => obstacle.kind === "circle" && obstacle.parkTree === "lenne-oak",
      );
      expect(landmark).toBeDefined();
    }
  });

  test("keeps loading, failed-world fallback and invalid-grid tree collision conservative", () => {
    const { blocked, state } = fixture();
    state.mode = "minecraft";
    expect(blocked(newlyOmittedPosition)).toBeTrue();
    state.voxelAttached = true;
    expect(blocked(newlyOmittedPosition)).toBeFalse();
    state.voxelAttached = false;
    expect(blocked(newlyOmittedPosition)).toBeTrue();
    for (const cellM of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const invalid = fixture("full", cellM);
      invalid.state.mode = "minecraft";
      invalid.state.voxelAttached = true;
      expect(invalid.blocked(newlyOmittedPosition), String(cellM)).toBeTrue();
    }
  });

  test("never releases a lamp or a protected volume through the tree-only hook", () => {
    const { blocked, environment } = fixture();
    environment.parkTreeSolidAt = () => false;
    expect(blocked(newlyOmittedPosition)).toBeFalse();
    expect(blocked(lampPosition)).toBeTrue();
    environment.protectedVolumeAt = () => true;
    expect(blocked(newlyOmittedPosition)).toBeTrue();
  });
});
