import { describe, expect, test } from "bun:test";

import {
  INVALIDENFRIEDHOF_DETAIL_PROFILE,
  invalidenfriedhofWalkableInteriorAt,
} from "../src/InvalidenfriedhofDetails";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createPedestrianEnvironment,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
import {
  invalidenfriedhofPedestrianSolidAt,
  visualModeWalkableInteriorAt,
} from "../src/visualModePedestrianAccess";

type PrismFixture = NonNullable<
  Parameters<typeof createPedestrianEnvironment>[3]
> & {
  buildings: Array<{ id: string }>;
};

const prismPayload = (await Bun.file(
  new URL(
    "../public/mesh/regierungsviertel/lod2-prisms.json",
    import.meta.url,
  ),
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
const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
const bellBuildings = {
  buildings: prismPayload.buildings.filter(
    ({ id }) => id === bell.lod2BuildingPartId,
  ),
};

function environment(mode: VisualMode): PedestrianEnvironment {
  const result = createPedestrianEnvironment(
    groundPayload,
    { water: [] },
    null,
    bellBuildings,
  );
  result.walkableInteriorAt = (x, y, z, sourceId) =>
    visualModeWalkableInteriorAt(mode, x, y, z, sourceId);
  result.interiorSolidAt = invalidenfriedhofPedestrianSolidAt;
  return result;
}

function bellLocalToWorld(localX: number, localZ: number): [number, number] {
  const cosine = Math.cos(bell.rotationY);
  const sine = Math.sin(bell.rotationY);
  return [
    bell.centerWorldM[0] + cosine * localX + sine * localZ,
    bell.centerWorldM[2] - sine * localX + cosine * localZ,
  ];
}

describe("Invalidenfriedhof pedestrian access", () => {
  test("opens the real bell undercroft bays through the raw LoD2 footprint", () => {
    expect(bellBuildings.buildings).toHaveLength(1);
    const [openX, openZ] = bellLocalToWorld(0, 1.45);
    for (const mode of MODES) {
      const access = environment(mode);
      const groundY = access.groundAt(openX, openZ);
      expect(groundY).not.toBeNull();
      expect(
        pedestrianPointIsBlocked(
          openX,
          openZ,
          groundY!,
          access.obstacles,
          access,
        ),
        mode,
      ).toBeFalse();
    }
  });

  test("keeps the four steel legs, bell and upper envelope solid", () => {
    const access = environment("day");
    const [legX, legZ] = bellLocalToWorld(2.05, 2.05);
    expect(
      invalidenfriedhofWalkableInteriorAt(
        legX,
        bell.centerWorldM[1] + 1,
        legZ,
        bell.lod2BuildingPartId,
      ),
    ).toBeFalse();
    expect(
      pedestrianPointIsBlocked(
        legX,
        legZ,
        bell.centerWorldM[1],
        access.obstacles,
        access,
      ),
    ).toBeTrue();
    for (const heightAboveGround of [2.9, 4.3, 8.5]) {
      expect(
        invalidenfriedhofWalkableInteriorAt(
          bell.centerWorldM[0],
          bell.centerWorldM[1] + heightAboveGround,
          bell.centerWorldM[2],
          bell.lod2BuildingPartId,
        ),
      ).toBeFalse();
    }
  });

  test("uses the pedestrian capsule radius beside a steel leg", () => {
    const heightAboveGround = 1;
    const legInset = (heightAboveGround / 4.25) * 0.43;
    const legCenter = 2.05 - legInset;
    const [nearLegX, nearLegZ] = bellLocalToWorld(
      legCenter - 0.4,
      legCenter,
    );
    const y = bell.centerWorldM[1] + heightAboveGround;

    expect(invalidenfriedhofPedestrianSolidAt(nearLegX, y, nearLegZ, 0)).toBeFalse();
    expect(
      invalidenfriedhofPedestrianSolidAt(nearLegX, y, nearLegZ, 0.35),
    ).toBeTrue();
    expect(
      invalidenfriedhofWalkableInteriorAt(
        nearLegX,
        y,
        nearLegZ,
        bell.lod2BuildingPartId,
        0,
      ),
    ).toBeTrue();
    expect(
      invalidenfriedhofWalkableInteriorAt(
        nearLegX,
        y,
        nearLegZ,
        bell.lod2BuildingPartId,
        0.35,
      ),
    ).toBeFalse();
  });

  test("never opens a foreign prism or a point outside the bell footprint", () => {
    expect(
      invalidenfriedhofWalkableInteriorAt(
        bell.centerWorldM[0],
        bell.centerWorldM[1] + 1,
        bell.centerWorldM[2],
        "1pC0000R",
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofWalkableInteriorAt(
        bell.centerWorldM[0] + 10,
        bell.centerWorldM[1] + 1,
        bell.centerWorldM[2],
        bell.lod2BuildingPartId,
      ),
    ).toBeFalse();
  });
});
