import { describe, expect, test } from "bun:test";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createPedestrianEnvironment,
  PEDESTRIAN_BODY_RADIUS_M,
  PEDESTRIAN_EYE_HEIGHT_M,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
import {
  WAGNER_MEMORIAL_PROFILE,
  wagnerMemorialSolidAt,
  wagnerMemorialWalkableInteriorAt,
} from "../src/WagnerMemorial";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";

type PrismFixture = NonNullable<
  Parameters<typeof createPedestrianEnvironment>[3]
> & {
  buildings: Array<{ id: string }>;
};

const prismPayload = (await Bun.file(
  new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url),
).json()) as PrismFixture;
const groundPayload = (await Bun.file(
  new URL(
    "../public/mesh/regierungsviertel/ground-context.json",
    import.meta.url,
  ),
).json()) as VoxelPayload;

const MODES: readonly VisualMode[] = [
  "day",
  "night",
  "minecraft",
  "snowstorm",
  "schwellenraum",
];
const wagnerBuildings = {
  buildings: prismPayload.buildings.filter(
    ({ id }) => id === WAGNER_MEMORIAL_PROFILE.lod2.payloadId,
  ),
};

function localToWorld(localX: number, localZ: number): [number, number] {
  const [worldX, , worldZ] = WAGNER_MEMORIAL_PROFILE.worldM;
  const cosine = Math.cos(WAGNER_MEMORIAL_PROFILE.rotationY);
  const sine = Math.sin(WAGNER_MEMORIAL_PROFILE.rotationY);
  return [
    worldX + cosine * localX + sine * localZ,
    worldZ - sine * localX + cosine * localZ,
  ];
}

function environment(mode: VisualMode): PedestrianEnvironment {
  const result = createPedestrianEnvironment(
    groundPayload,
    { water: [] },
    null,
    wagnerBuildings,
  );
  result.walkableInteriorAt = (x, y, z, sourceId) =>
    visualModeWalkableInteriorAt(mode, x, y, z, sourceId);
  // The navigation blocker has already offset its body samples by 0.42 m;
  // passing that radius again would double-inflate the marble footprint.
  result.interiorSolidAt = (x, y, z) => wagnerMemorialSolidAt(x, y, z, 0);
  return result;
}

function capsuleBodySamples(
  x: number,
  z: number,
  bodyBottomY: number,
): Array<readonly [number, number, number]> {
  const bodyMiddleY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M / 2;
  return [
    [x, bodyBottomY, z],
    [x, bodyMiddleY, z],
    [x, bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M, z],
    [x - PEDESTRIAN_BODY_RADIUS_M, bodyMiddleY, z],
    [x + PEDESTRIAN_BODY_RADIUS_M, bodyMiddleY, z],
    [x, bodyMiddleY, z - PEDESTRIAN_BODY_RADIUS_M],
    [x, bodyMiddleY, z + PEDESTRIAN_BODY_RADIUS_M],
  ];
}

describe("Richard-Wagner-Denkmal pedestrian access", () => {
  test("keeps the real approach and side corridors free in every mode", () => {
    expect(wagnerBuildings.buildings).toHaveLength(1);
    for (const [localX, localZ, rawPrismClosesCorridor] of [
      [0, -4.55, true],
      [0, 4.55, false],
      [-3.55, 0, true],
    ] as const) {
      const [x, z] = localToWorld(localX, localZ);
      const raw = createPedestrianEnvironment(
        groundPayload,
        { water: [] },
        null,
        wagnerBuildings,
      );
      const rawGroundY = raw.groundAt(x, z);
      expect(rawGroundY).not.toBeNull();
      expect(
        pedestrianPointIsBlocked(x, z, rawGroundY!, raw.obstacles, raw),
      ).toBe(rawPrismClosesCorridor);

      for (const mode of MODES) {
        const access = environment(mode);
        const groundY = access.groundAt(x, z);
        expect(groundY).not.toBeNull();
        expect(
          pedestrianPointIsBlocked(x, z, groundY!, access.obstacles, access),
          mode,
        ).toBeFalse();
      }
    }
  });

  test("sweeps one complete capsule through both open shelter ends", () => {
    // This west aisle misses every represented marble mass and canopy post.
    // The 0.18 m sweep is finer than the runtime's 0.22 m collision step and
    // starts/ends outside the exact, slightly skewed SR00009n source ring.
    const sweep = Array.from({ length: 67 }, (_, index) => 4.85 - index * 0.18);
    expect(sweep.at(-1)).toBeCloseTo(-7.03, 8);

    for (const mode of MODES) {
      const access = environment(mode);
      for (const localZ of sweep) {
        const [x, z] = localToWorld(-3.55, localZ);
        const groundY = access.groundAt(x, z);
        expect(groundY).not.toBeNull();
        expect(
          pedestrianPointIsBlocked(x, z, groundY!, access.obstacles, access),
          `${mode} local z=${localZ.toFixed(2)}`,
        ).toBeFalse();
      }
    }
  });

  test("admits all seven capsule samples while crossing either source-ring edge", () => {
    for (const localZ of [4.2, -6.4] as const) {
      const [x, z] = localToWorld(-3.55, localZ);
      const access = environment("day");
      const groundY = access.groundAt(x, z);
      expect(groundY).not.toBeNull();
      const samples = capsuleBodySamples(x, z, groundY!);
      expect(samples).toHaveLength(7);
      for (const [sampleX, sampleY, sampleZ] of samples) {
        expect(
          wagnerMemorialWalkableInteriorAt(
            sampleX,
            sampleY,
            sampleZ,
            WAGNER_MEMORIAL_PROFILE.lod2.payloadId,
          ),
          `edge ${localZ}: sample ${sampleX},${sampleY},${sampleZ}`,
        ).toBeTrue();
      }
    }
  });

  test("keeps the near rear centre correctly blocked by Alberich and the Rheingold", () => {
    const [x, z] = localToWorld(0, -3.8);
    for (const mode of MODES) {
      const access = environment(mode);
      const groundY = access.groundAt(x, z);
      expect(groundY).not.toBeNull();
      expect(
        pedestrianPointIsBlocked(x, z, groundY!, access.obstacles, access),
        mode,
      ).toBeTrue();
    }
  });

  test("keeps the marble core, side sculpture groups and canopy posts solid", () => {
    const access = environment("day");
    for (const [localX, localZ] of [
      [0, 0],
      [-1.95, 0.25],
      [2.12, 0.18],
      [-4.35, -4.85],
      [4.35, 4.85],
    ] as const) {
      const [x, z] = localToWorld(localX, localZ);
      const groundY = access.groundAt(x, z);
      expect(groundY).not.toBeNull();
      expect(
        pedestrianPointIsBlocked(x, z, groundY!, access.obstacles, access),
      ).toBeTrue();
    }
  });

  test("never opens a foreign prism or space beyond its bounded capsule margin", () => {
    const [approachX, approachZ] = localToWorld(0, 3.8);
    expect(
      wagnerMemorialWalkableInteriorAt(
        approachX,
        WAGNER_MEMORIAL_PROFILE.groundY + 1,
        approachZ,
        "not-SR00009n",
      ),
    ).toBeFalse();
    expect(
      wagnerMemorialWalkableInteriorAt(
        WAGNER_MEMORIAL_PROFILE.worldM[0] + 12,
        WAGNER_MEMORIAL_PROFILE.groundY + 1,
        WAGNER_MEMORIAL_PROFILE.worldM[2],
        WAGNER_MEMORIAL_PROFILE.lod2.payloadId,
      ),
    ).toBeFalse();
    const [pastMarginX, pastMarginZ] = localToWorld(-3.55, 5);
    expect(
      wagnerMemorialWalkableInteriorAt(
        pastMarginX,
        WAGNER_MEMORIAL_PROFILE.groundY + 1,
        pastMarginZ,
        WAGNER_MEMORIAL_PROFILE.lod2.payloadId,
      ),
    ).toBeFalse();
  });
});
