import { describe, expect, test } from "bun:test";

import { BUNDESTAG_SPREE_CONNECTION_PROFILE } from "../src/CentralCivicDetails";
import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  hauptbahnhofEastWestCurveAt,
} from "../src/MinecraftArchitecturalLandmarks";
import {
  MINECRAFT_HERO_PORTALS,
  minecraftHeroCollisionEnabled,
  minecraftHeroGroundAt,
  minecraftHeroLocalToWorld,
  minecraftHeroSolidAt,
  minecraftHeroWalkableAt,
  reconcileMinecraftHeroCameraRig,
  resolveMinecraftHeroFlightTranslation,
} from "../src/MinecraftHeroNavigation";
import {
  compilePedestrianObstacles,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import { domeRadius } from "../src/ReichstagDome";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();
const prismPayload = (await Bun.file(
  new URL(
    "../public/mesh/regierungsviertel/lod2-prisms.json",
    import.meta.url,
  ),
).json()) as Parameters<typeof compilePedestrianObstacles>[0];

function localRingDm(
  frame: (typeof MINECRAFT_HERO_PORTALS)[number]["frame"],
  points: ReadonlyArray<readonly [number, number]>,
): number[][] {
  return points.map(([x, z]) => {
    const world = minecraftHeroLocalToWorld(frame, [x, 0, z]);
    return [Math.round(world[0] * 10), Math.round(world[2] * 10)];
  });
}

describe("Minecraft hero navigation", () => {
  test("is an exact Minecraft-only policy", () => {
    expect(minecraftHeroCollisionEnabled("minecraft")).toBeTrue();
    for (const mode of [
      "day",
      "night",
      "snowstorm",
      "schwellenraum",
    ] as const) {
      expect(minecraftHeroCollisionEnabled(mode)).toBeFalse();
    }
  });

  test("opens all five historic Gate passages but neither columns nor pavilions", () => {
    const passages = MINECRAFT_HERO_PORTALS.filter(
      ({ landmark }) => landmark === "Brandenburger Tor",
    );
    expect(passages).toHaveLength(5);
    for (const passage of passages) {
      const world = minecraftHeroLocalToWorld(
        passage.frame,
        passage.centerLocalM,
      );
      expect(
        minecraftHeroWalkableAt(
          ...world,
          MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate.sourcePrismIds[0],
        ),
      ).toBeTrue();
      expect(
        minecraftHeroWalkableAt(
          ...world,
          MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate.sourcePrismIds[1],
        ),
      ).toBeFalse();
    }

    const betweenPassages =
      (passages[1].centerLocalM[2] + passages[2].centerLocalM[2]) / 2;
    const columnWorld = minecraftHeroLocalToWorld(passages[0].frame, [
      0,
      6,
      betweenPassages,
    ]);
    expect(
      minecraftHeroWalkableAt(
        ...columnWorld,
        MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate.sourcePrismIds[0],
      ),
    ).toBeFalse();

    const aboveLintel = minecraftHeroLocalToWorld(passages[0].frame, [
      0,
      13.2,
      passages[2].centerLocalM[2],
    ]);
    expect(
      minecraftHeroWalkableAt(
        ...aboveLintel,
        MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate.sourcePrismIds[0],
      ),
    ).toBeFalse();

    const gateBuildings = prismPayload.buildings.filter((building) =>
      building.ring.some(
        ([xDm, zDm]) =>
          xDm / 10 > 380 &&
          xDm / 10 < 460 &&
          zDm / 10 > 250 &&
          zDm / 10 < 350,
      ),
    );
    const gateObstacles = compilePedestrianObstacles({
      buildings: gateBuildings,
    });
    for (const passage of passages) {
      const world = minecraftHeroLocalToWorld(passage.frame, [
        0,
        0,
        passage.centerLocalM[2],
      ]);
      expect(
        pedestrianPointIsBlocked(
          world[0],
          world[2],
          passage.frame.anchorWorld[1],
          gateObstacles,
          {
            interiorSolidAt: minecraftHeroSolidAt,
            walkableInteriorAt: minecraftHeroWalkableAt,
          },
        ),
      ).toBeFalse();
    }
  });

  test("connects all four real Hauptbahnhof hall ends through narrow axes", () => {
    const entries = MINECRAFT_HERO_PORTALS.filter(
      ({ landmark }) => landmark === "Berlin Hauptbahnhof",
    );
    expect(entries.map(({ id }) => id)).toEqual([
      "hauptbahnhof-europaplatz-portal",
      "hauptbahnhof-washingtonplatz-portal",
      "hauptbahnhof-west-hall-portal",
      "hauptbahnhof-east-hall-portal",
    ]);
    const sourceId =
      MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.sourcePrismIds[0];
    const entrance = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.entrances;
    const northSouth = entrance.northSouth;
    const eastWest = entrance.eastWest;
    const walkingY =
      MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.publicFloorTopLocalY + 0.1;
    for (const localZ of [
      -northSouth.endLocalZ,
      -80,
      0,
      80,
      northSouth.endLocalZ,
    ]) {
      const world = minecraftHeroLocalToWorld(entries[0].frame, [
        0,
        walkingY,
        localZ,
      ]);
      expect(minecraftHeroWalkableAt(...world, sourceId)).toBeTrue();
    }
    for (const localX of [
      -eastWest.endLocalX,
      -80,
      80,
      eastWest.endLocalX,
    ]) {
      const world = minecraftHeroLocalToWorld(entries[0].frame, [
        localX,
        walkingY,
        hauptbahnhofEastWestCurveAt(localX),
      ]);
      expect(minecraftHeroWalkableAt(...world, sourceId)).toBeTrue();
    }
    const stationCenter = minecraftHeroLocalToWorld(entries[0].frame, [
      0,
      walkingY,
      0,
    ]);
    expect(minecraftHeroWalkableAt(...stationCenter, "iiRhAlr6")).toBeTrue();
    expect(minecraftHeroWalkableAt(...stationCenter, "5gArGdou")).toBeTrue();
    const outsideDoor = minecraftHeroLocalToWorld(entries[0].frame, [
      northSouth.clearHalfWidthM + 0.8,
      walkingY,
      -northSouth.endLocalZ,
    ]);
    const aboveDoor = minecraftHeroLocalToWorld(entries[0].frame, [
      0,
      northSouth.clearHeightM + 0.2,
      -northSouth.endLocalZ,
    ]);
    expect(minecraftHeroWalkableAt(...outsideDoor, sourceId)).toBeFalse();
    expect(minecraftHeroWalkableAt(...aboveDoor, sourceId)).toBeFalse();
    expect(minecraftHeroWalkableAt(...entries[0].frame.anchorWorld, "other")).toBeFalse();

    const floorWorld = minecraftHeroLocalToWorld(entries[0].frame, [0, 0, 0]);
    expect(minecraftHeroGroundAt(floorWorld[0], floorWorld[2])).toBeCloseTo(
      MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.anchorWorld[1] +
        MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.publicFloorTopLocalY,
    );
    const outsideHall = minecraftHeroLocalToWorld(entries[0].frame, [80, 0, 80]);
    expect(minecraftHeroGroundAt(outsideHall[0], outsideHall[2])).toBeNull();

    const stationEnvironment: PedestrianEnvironment = {
      bounds: { maxX: 1_000, maxZ: 1_000, minX: -1_000, minZ: -1_000 },
      groundAt: () =>
        MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.anchorWorld[1],
      interiorGroundAt: minecraftHeroGroundAt,
      water: [],
    };
    const aboveFloor = minecraftHeroLocalToWorld(entries[0].frame, [
      0,
      MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.publicFloorTopLocalY + 3,
      0,
    ]);
    const descent = resolveMinecraftHeroFlightTranslation(
      { x: aboveFloor[0], y: aboveFloor[1], z: aboveFloor[2] },
      { x: 0, y: -5, z: 0 },
      stationEnvironment,
    );
    expect(descent.blocked).toBeTrue();
    expect(descent.position.y).toBeGreaterThan(
      MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.anchorWorld[1] +
        MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.publicFloorTopLocalY +
        0.5,
    );

    expect(northSouth).toEqual({
      clearHeightM: 9.1,
      clearHalfWidthM: 6,
      endLocalZ: 89.1,
    });
    expect(eastWest).toEqual({
      clearHeightM: 13.1,
      clearHalfWidthM: 14,
      endLocalX: 160.6,
    });
  });

  test("opens all four office-bridge end frames and their interior axes", () => {
    const profile = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
    const officeEntries = MINECRAFT_HERO_PORTALS.filter(
      ({ landmark }) => landmark === "Berlin Hauptbahnhof office bridge",
    );
    expect(officeEntries.map(({ id }) => id)).toEqual([
      "hauptbahnhof-office-west-north-portal",
      "hauptbahnhof-office-west-south-portal",
      "hauptbahnhof-office-east-north-portal",
      "hauptbahnhof-office-east-south-portal",
    ]);
    expect(profile.officeEntrances).toEqual({
      bridgeCentresLocalX: [-35, 35],
      clearHeightM: 7.9,
      clearHalfWidthM: 4,
      endLocalZ: 90.4,
    });
    const sourceId = profile.sourcePrismIds[0];
    const walkingY = profile.publicFloorTopLocalY + 0.1;
    for (const centerX of profile.officeEntrances.bridgeCentresLocalX) {
      for (const localZ of [
        -profile.officeEntrances.endLocalZ,
        0,
        profile.officeEntrances.endLocalZ,
      ]) {
        const world = minecraftHeroLocalToWorld(profile, [
          centerX,
          walkingY,
          localZ,
        ]);
        expect(minecraftHeroWalkableAt(...world, sourceId)).toBeTrue();
        expect(minecraftHeroGroundAt(world[0], world[2])).toBeCloseTo(
          profile.anchorWorld[1] + profile.publicFloorTopLocalY,
        );
      }
    }
    const outsideFrame = minecraftHeroLocalToWorld(profile, [
      profile.officeEntrances.bridgeCentresLocalX[0] +
        profile.officeEntrances.clearHalfWidthM +
        0.8,
      walkingY,
      -profile.officeEntrances.endLocalZ,
    ]);
    const aboveFrame = minecraftHeroLocalToWorld(profile, [
      profile.officeEntrances.bridgeCentresLocalX[0],
      profile.officeEntrances.clearHeightM + 0.2,
      -profile.officeEntrances.endLocalZ,
    ]);
    expect(minecraftHeroWalkableAt(...outsideFrame, sourceId)).toBeFalse();
    expect(minecraftHeroWalkableAt(...aboveFrame, sourceId)).toBeFalse();
  });

  test("opens all eight station and office ends through the committed LoD2 stack", () => {
    const profile = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
    const stationBuildings = prismPayload.buildings.filter((building) =>
      building.ring.some(
        ([xDm, zDm]) =>
          xDm / 10 > -350 &&
          xDm / 10 < 100 &&
          zDm / 10 > -900 &&
          zDm / 10 < -500,
      ),
    );
    const obstacles = compilePedestrianObstacles({
      buildings: stationBuildings,
    });
    const bodyBottomY =
      profile.anchorWorld[1] + profile.publicFloorTopLocalY;
    const localPoints = [
      [0, -profile.entrances.northSouth.endLocalZ + 3],
      [0, profile.entrances.northSouth.endLocalZ - 3],
      [
        -profile.entrances.eastWest.endLocalX + 3,
        hauptbahnhofEastWestCurveAt(
          -profile.entrances.eastWest.endLocalX + 3,
        ),
      ],
      [
        profile.entrances.eastWest.endLocalX - 3,
        hauptbahnhofEastWestCurveAt(
          profile.entrances.eastWest.endLocalX - 3,
        ),
      ],
      ...profile.officeEntrances.bridgeCentresLocalX.flatMap((centerX) => [
        [centerX, -profile.officeEntrances.endLocalZ + 3] as const,
        [centerX, profile.officeEntrances.endLocalZ - 3] as const,
      ]),
    ] as const;
    const worlds = localPoints.map(([x, z]) =>
      minecraftHeroLocalToWorld(profile, [
        x,
        profile.publicFloorTopLocalY,
        z,
      ]),
    );
    expect(
      pedestrianPointIsBlocked(
        worlds[0][0],
        worlds[0][2],
        bodyBottomY,
        obstacles,
      ),
    ).toBeTrue();
    for (const [x, , z] of worlds) {
      expect(
        pedestrianPointIsBlocked(x, z, bodyBottomY, obstacles, {
          interiorSolidAt: minecraftHeroSolidAt,
          walkableInteriorAt: minecraftHeroWalkableAt,
        }),
      ).toBeFalse();
    }
  });

  test("does not invent public openings through Reichstag or Chancellery", () => {
    const reichstag = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
    const chancellery = MINECRAFT_ARCHITECTURAL_PROFILES.chancellery;
    expect(
      minecraftHeroWalkableAt(
        ...reichstag.anchorWorld,
        reichstag.sourcePrismIds[0],
      ),
    ).toBeFalse();
    expect(
      minecraftHeroWalkableAt(
        ...chancellery.anchorWorld,
        chancellery.centralSourcePrismIds[0],
      ),
    ).toBeFalse();
  });

  test("keeps the block dome and Quadriga solid without sealing the oculus", () => {
    const dome = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag.dome;
    const normalizedY = 0.62;
    const shellRadius = domeRadius(normalizedY, dome.diameterM);
    expect(
      minecraftHeroSolidAt(
        dome.anchorWorld[0] + shellRadius,
        dome.anchorWorld[1] + normalizedY * dome.heightM,
        dome.anchorWorld[2],
      ),
    ).toBeTrue();
    expect(
      minecraftHeroSolidAt(
        dome.anchorWorld[0],
        dome.anchorWorld[1] + dome.heightM,
        dome.anchorWorld[2],
        0.62,
      ),
    ).toBeFalse();

    const gateProfile = MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate;
    const quadriga = minecraftHeroLocalToWorld(gateProfile, [0, 24, 0]);
    expect(minecraftHeroSolidAt(...quadriga)).toBeTrue();
  });

  test("removes the false Bundestag wall while retaining every real bridge part", () => {
    const lower = BUNDESTAG_SPREE_CONNECTION_PROFILE.lowerBridge;
    const upper = BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge;
    const upperMidpoint = [
      (upper.centrelineWorld[0][0] + upper.centrelineWorld[1][0]) / 2,
      (upper.centrelineWorld[0][1] + upper.centrelineWorld[1][1]) / 2,
    ] as const;
    expect(
      minecraftHeroWalkableAt(
        upperMidpoint[0],
        10,
        upperMidpoint[1],
        "K0001zDa",
      ),
    ).toBeTrue();
    expect(
      minecraftHeroWalkableAt(
        upperMidpoint[0],
        10,
        upperMidpoint[1],
        "another-building",
      ),
    ).toBeFalse();
    expect(
      minecraftHeroSolidAt(
        upperMidpoint[0],
        upper.deckY - 0.35,
        upperMidpoint[1],
      ),
    ).toBeTrue();
    expect(
      minecraftHeroSolidAt(
        upperMidpoint[0],
        upper.roofY,
        upperMidpoint[1],
      ),
    ).toBeTrue();

    const lowerMidpointX =
      (lower.centrelineWorld[0][0] + lower.centrelineWorld[1][0]) / 2;
    const lowerMidpointZ =
      (lower.centrelineWorld[0][1] + lower.centrelineWorld[1][1]) / 2 +
      lower.curveSagittaM;
    expect(
      minecraftHeroSolidAt(
        lowerMidpointX,
        lower.deckY - 0.35,
        lowerMidpointZ,
      ),
    ).toBeTrue();
    expect(minecraftHeroSolidAt(upperMidpoint[0], 10, upperMidpoint[1])).toBeFalse();
  });

  test("walking and fast flight cross a passage but cannot cross its column bay", () => {
    const gatePassages = MINECRAFT_HERO_PORTALS.filter(
      ({ landmark }) => landmark === "Brandenburger Tor",
    );
    const frame = gatePassages[0].frame;
    const sourceId =
      MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate.sourcePrismIds[0];
    const obstacle = compilePedestrianObstacles({
      buildings: [
        {
          class: 0,
          h_dm: 140,
          holes: [],
          id: sourceId,
          ring: localRingDm(frame, [
            [-5, -19],
            [5, -19],
            [5, 19],
            [-5, 19],
          ]),
          y0_dm: Math.round(frame.anchorWorld[1] * 10),
        },
      ],
    });
    const environment: PedestrianEnvironment = {
      bounds: { maxX: 1_000, maxZ: 1_000, minX: -1_000, minZ: -1_000 },
      groundAt: () => frame.anchorWorld[1],
      interiorSolidAt: minecraftHeroSolidAt,
      obstacles: obstacle,
      walkableInteriorAt: minecraftHeroWalkableAt,
      water: [],
    };
    const passageCenter = gatePassages[2].centerLocalM[2];
    const walkWorld = minecraftHeroLocalToWorld(frame, [0, 0, passageCenter]);
    expect(
      pedestrianPointIsBlocked(
        walkWorld[0],
        walkWorld[2],
        frame.anchorWorld[1],
        obstacle,
        environment,
      ),
    ).toBeFalse();

    const columnZ =
      (gatePassages[1].centerLocalM[2] + gatePassages[2].centerLocalM[2]) / 2;
    const columnWorld = minecraftHeroLocalToWorld(frame, [0, 0, columnZ]);
    expect(
      pedestrianPointIsBlocked(
        columnWorld[0],
        columnWorld[2],
        frame.anchorWorld[1],
        obstacle,
        environment,
      ),
    ).toBeTrue();

    const start = minecraftHeroLocalToWorld(frame, [-10, 6.15, passageCenter]);
    const end = minecraftHeroLocalToWorld(frame, [10, 6.15, passageCenter]);
    const crossed = resolveMinecraftHeroFlightTranslation(
      { x: start[0], y: start[1], z: start[2] },
      { x: end[0] - start[0], y: 0, z: end[2] - start[2] },
      environment,
    );
    expect(crossed.blocked).toBeFalse();
    expect(crossed.position.x).toBeCloseTo(end[0], 4);
    expect(crossed.position.z).toBeCloseTo(end[2], 4);

    const blockedStart = minecraftHeroLocalToWorld(frame, [-10, 6.15, columnZ]);
    const blockedEnd = minecraftHeroLocalToWorld(frame, [10, 6.15, columnZ]);
    expect(
      resolveMinecraftHeroFlightTranslation(
        { x: blockedStart[0], y: blockedStart[1], z: blockedStart[2] },
        {
          x: blockedEnd[0] - blockedStart[0],
          y: 0,
          z: blockedEnd[2] - blockedStart[2],
        },
        environment,
      ).blocked,
    ).toBeTrue();
  });

  test("reconciles direct pan, orbit and zoom poses without crossing a wall", () => {
    const obstacles = compilePedestrianObstacles({
      buildings: [
        {
          class: 0,
          h_dm: 120,
          holes: [],
          id: "wall",
          ring: [
            [-5, -10],
            [5, -10],
            [5, 10],
            [-5, 10],
          ],
          y0_dm: 0,
        },
      ],
    });
    const environment: PedestrianEnvironment = {
      bounds: { maxX: 100, maxZ: 100, minX: -100, minZ: -100 },
      groundAt: () => 0,
      obstacles,
      water: [],
    };
    const previous = {
      camera: { x: -3, y: 5, z: 0 },
      target: { x: -3, y: 5, z: -10 },
    };
    const panned = reconcileMinecraftHeroCameraRig(
      previous,
      {
        camera: { x: 3, y: 5, z: 0 },
        target: { x: 3, y: 5, z: -10 },
      },
      environment,
    );
    expect(panned.blocked).toBeTrue();
    expect(panned.camera.x).toBeLessThan(-1);
    expect(panned.target.x - previous.target.x).toBeCloseTo(
      panned.camera.x - previous.camera.x,
    );

    const orbited = reconcileMinecraftHeroCameraRig(
      previous,
      {
        camera: { x: 3, y: 5, z: 0 },
        target: { x: 0, y: 5, z: 0 },
      },
      environment,
    );
    expect(orbited.blocked).toBeTrue();
    expect(orbited.camera.x).toBeLessThan(-1);
    expect(orbited.target).toEqual({ x: 0, y: 5, z: 0 });

    const zoomed = reconcileMinecraftHeroCameraRig(
      previous,
      {
        camera: { x: 3, y: 5, z: 0 },
        target: { x: -1, y: 5, z: -8 },
      },
      environment,
    );
    expect(zoomed.blocked).toBeTrue();
    expect(zoomed.camera.x).toBeLessThan(-1);
    expect(zoomed.target).toEqual({ x: -1, y: 5, z: -8 });
  });

  test("ThreeViewer wires both walking and flight only through the mode gate", () => {
    expect(viewerSource).toContain("minecraftHeroWalkableAt(x, y, z, sourceId)");
    expect(viewerSource).toContain("minecraftHeroSolidAt(x, y, z, radius)");
    expect(viewerSource).toContain("resolveMinecraftHeroFlightTranslation");
    expect(viewerSource).toContain("reconcileMinecraftHeroCameraRig");
    expect(viewerSource).toContain(
      'controls.addEventListener("change", onControlsChange)',
    );
    expect(viewerSource).toContain("minecraftHeroCollisionEnabled(runtime.lightingMode)");
    const voxelBuilder = viewerSource.slice(
      viewerSource.indexOf("function ensureVoxelWorld"),
      viewerSource.indexOf("const PHOTO_FOV_DEGREES"),
    );
    expect(voxelBuilder).toContain("createPedestrianEnvironment(");
    expect(voxelBuilder).toContain("runtime.pedestrian.environment = environment");
    expect(voxelBuilder.indexOf("runtime.pedestrian.environment = environment")).toBeLessThan(
      voxelBuilder.indexOf("void fetchSurfacePayload(runtime)"),
    );
  });
});
