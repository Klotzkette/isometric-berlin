import { describe, expect, test } from "bun:test";

import { Mesh } from "three";

import {
  createSmoothSurfaces,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import {
  HUMBOLDTHAFEN_NORTH_CREST_M,
  HUMBOLDTHAFEN_NORTH_WATERLINE_M,
  LEGACY_WRONG_SANDKRUG_AXIS,
  SANDKRUG_OSM_CARRIAGEWAYS,
  SANDKRUG_OSM_DECK,
  SANDKRUG_STRUCTURE_PROFILE,
  createNorthernHumboldthafenRefinements,
  isNorthernHumboldthafenQuayEdge,
} from "../src/HumboldthafenRefinements";
import {
  WATER_TOP_Y,
  type VoxelPayload,
  worldGroundSampler,
} from "../src/MinecraftVoxelWorld";
import surfacePayloadJson from "../public/mesh/regierungsviertel/surface-polygons.json";
import voxelPayloadJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = voxelPayloadJson as unknown as VoxelPayload;
const surfaces = surfacePayloadJson as unknown as SurfacePayload;

describe("source-bound northern Humboldthafen", () => {
  test("pins each Sandkrug carriageway to its own OSM bounds", () => {
    expect(SANDKRUG_OSM_CARRIAGEWAYS.map(({ wayId }) => wayId)).toEqual([
      36260393, 248010193,
    ]);
    for (const carriageway of SANDKRUG_OSM_CARRIAGEWAYS) {
      const xs = carriageway.points.map(([x]) => x);
      const zs = carriageway.points.map(([, z]) => z);
      expect(carriageway.bounds).toEqual({
        maxX: Math.max(...xs),
        maxZ: Math.max(...zs),
        minX: Math.min(...xs),
        minZ: Math.min(...zs),
      });
    }
    expect(SANDKRUG_OSM_CARRIAGEWAYS[0].bounds).toEqual({
      maxX: 202.532,
      maxZ: -977.198,
      minX: 172.324,
      minZ: -991.05,
    });
    expect(SANDKRUG_OSM_CARRIAGEWAYS[1].bounds).toEqual({
      maxX: 198.19,
      maxZ: -989.219,
      minX: 168.231,
      minZ: -1002.854,
    });
  });

  test("derives the deck bearing from both ways and rejects the old profile", () => {
    const eastboundAxes = SANDKRUG_OSM_CARRIAGEWAYS.map(({ points }, index) => {
      const [from, to] = index === 0 ? points : [points[1], points[0]];
      const dx = to[0] - from[0];
      const dz = to[1] - from[1];
      const length = Math.hypot(dx, dz);
      return [dx / length, dz / length] as const;
    });
    for (const axis of eastboundAxes) {
      expect(
        axis[0] * SANDKRUG_OSM_DECK.axis[0] +
          axis[1] * SANDKRUG_OSM_DECK.axis[1],
      ).toBeGreaterThan(0.999);
    }
    const legacyDot = Math.abs(
      LEGACY_WRONG_SANDKRUG_AXIS[0] * SANDKRUG_OSM_DECK.axis[0] +
        LEGACY_WRONG_SANDKRUG_AXIS[1] * SANDKRUG_OSM_DECK.axis[1],
    );
    expect(legacyDot).toBeLessThan(0.2);
    expect(SANDKRUG_OSM_DECK.centreWorldM).toEqual([185.31925, -990.08025]);
  });

  test("pins the Sandkrug steel-frame section to the engineer profile", () => {
    expect(SANDKRUG_STRUCTURE_PROFILE).toMatchObject({
      bridgeInventoryId: "BW 3446035",
      clearanceM: 4.93,
      clearSpanM: 21,
      frameStemCount: 5,
      lampMastCount: 4,
      roadwayWidthM: 18.7,
      structuralDepthM: 1.28,
    });
    expect(SANDKRUG_STRUCTURE_PROFILE.construction).toContain("steel frame");
    expect(SANDKRUG_STRUCTURE_PROFILE.engineerSourceUrl).toContain(
      "grassl-ing.de",
    );
  });

  test("replaces only the northern horizontal quay run", () => {
    expect(isNorthernHumboldthafenQuayEdge(-5.8, -847.1, 24.1, -846.4)).toBe(
      true,
    );
    expect(
      isNorthernHumboldthafenQuayEdge(28.5, -846.3, 101.591, -844.435),
    ).toBe(true);
    expect(isNorthernHumboldthafenQuayEdge(148.7, -843.2, 161.9, -802.7)).toBe(
      false,
    );
    expect(isNorthernHumboldthafenQuayEdge(-35, -445, -61, -445)).toBe(false);
  });

  test("ties the visual slope top to DGM and creates no walkable berm", () => {
    const details = createNorthernHumboldthafenRefinements(ground);
    const bodies = details.getObjectByName(
      "northern Humboldthafen refinements bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(details.userData.visualOnly).toBe(true);
    expect(details.userData.collisionSource).toContain("no collision shelf");
    expect(details.userData.waterlineWay).toBe(52189421);
    expect(details.userData.staticAllModes).toBe(true);
    expect(
      details.userData.pathWays.map(({ id }: { id: number }) => id),
    ).toEqual(
      expect.arrayContaining([
        237691534, 1087036419, 1087036421, 1087036422, 1087036423, 896110818,
        1190534970, 1190534971,
      ]),
    );

    const positions = bodies.geometry.getAttribute("position");
    const sample = worldGroundSampler(ground);
    const crestX = HUMBOLDTHAFEN_NORTH_WATERLINE_M[0][0];
    const [[ax, az], [bx, bz]] = HUMBOLDTHAFEN_NORTH_CREST_M;
    const t = (crestX - ax) / (bx - ax);
    const crestZ = az + (bz - az) * t;
    const expectedTop = sample(crestX, crestZ)! + 0.025;
    let foundDgmTop = false;
    let foundWaterToe = false;
    for (let index = 0; index < positions.count; index += 1) {
      if (
        Math.abs(positions.getX(index) - crestX) < 0.002 &&
        Math.abs(positions.getZ(index) - crestZ) < 0.002 &&
        Math.abs(positions.getY(index) - expectedTop) < 0.002
      ) {
        foundDgmTop = true;
      }
      if (
        Math.abs(positions.getX(index) - crestX) < 0.002 &&
        Math.abs(
          positions.getZ(index) - HUMBOLDTHAFEN_NORTH_WATERLINE_M[0][1],
        ) < 0.002 &&
        Math.abs(
          positions.getY(index) -
            ((ground.water_top_y_m ?? WATER_TOP_Y) + 0.06),
        ) < 0.002
      ) {
        foundWaterToe = true;
      }
    }
    expect(foundDgmTop).toBe(true);
    expect(foundWaterToe).toBe(true);
    expect(
      details.children.filter((child) => child instanceof Mesh),
    ).toHaveLength(1);
  });

  test("suppresses the old smooth vertical wall on the replacement run", () => {
    const harbour = surfaces.water.find(
      (entry) => entry.name === "Humboldthafen",
    )!;
    const smooth = createSmoothSurfaces(
      {
        parks: [],
        roads: [],
        schema_version: surfaces.schema_version,
        water: [harbour],
      },
      ground.water_top_y_m,
      ground.water_top_y_m + 5.35,
      worldGroundSampler(ground),
    );
    const walls = smooth.getObjectByName("smooth quay walls") as Mesh;
    const positions = walls.geometry.getAttribute("position");
    let oldNorthWallVertices = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      if (x >= -5.8 && x <= 101.591 && z >= -850.5 && z <= -840.5) {
        oldNorthWallVertices += 1;
      }
    }
    expect(oldNorthWallVertices).toBe(0);
  });
});
