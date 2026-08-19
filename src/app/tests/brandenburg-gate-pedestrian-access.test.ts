import { describe, expect, test } from "bun:test";

import { BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE } from "../src/ArchitecturalLandmarks";
import {
  BRANDENBURG_GATE_PUBLIC_PASSAGES,
  MINECRAFT_HERO_PORTALS,
  minecraftHeroLocalToWorld,
} from "../src/MinecraftHeroNavigation";
import { MINECRAFT_ARCHITECTURAL_PROFILES } from "../src/MinecraftArchitecturalLandmarks";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createPedestrianEnvironment,
  createPedestrianState,
  pedestrianPointIsBlocked,
  stepPedestrian,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";

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
const scenePayload = (await Bun.file(
  new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url),
).json()) as {
  architectural_signatures: Array<{
    anchor_world: [number, number, number];
    kind: string;
    rotation_y_degrees: number;
  }>;
};
const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

const MODES: readonly VisualMode[] = [
  "day",
  "night",
  "minecraft",
  "snowstorm",
  "schwellenraum",
];
const gateProfile = MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate;
const gateSourceIds = new Set<string>(gateProfile.sourcePrismIds);
const gateBuildings = {
  buildings: prismPayload.buildings.filter(({ id }) => gateSourceIds.has(id)),
};

function gateEnvironment(mode: VisualMode): PedestrianEnvironment {
  const environment = createPedestrianEnvironment(
    groundPayload,
    { water: [] },
    null,
    gateBuildings,
  );
  environment.walkableInteriorAt = (x, y, z, sourceId) =>
    visualModeWalkableInteriorAt(mode, x, y, z, sourceId);
  return environment;
}

function gateColumnAxes(): number[] {
  const clearWidths = [
    BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
    BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
    BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.centralPassageWidthM,
    BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
    BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
  ];
  const spacings = clearWidths.map(
    (width) =>
      width + BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.columnBaseDiameterM,
  );
  const axes = [-spacings.reduce((sum, spacing) => sum + spacing, 0) / 2];
  for (const spacing of spacings) {
    axes.push((axes.at(-1) ?? 0) + spacing);
  }
  return axes;
}

describe("Brandenburg Gate pedestrian access", () => {
  test("opens every one of the five historic passages in all visual modes", () => {
    expect(BRANDENBURG_GATE_PUBLIC_PASSAGES).toHaveLength(5);
    for (const mode of MODES) {
      const environment = gateEnvironment(mode);
      for (const passage of BRANDENBURG_GATE_PUBLIC_PASSAGES) {
        for (let localX = -8.2; localX <= 8.2; localX += 0.4) {
          const [x, , z] = minecraftHeroLocalToWorld(passage.frame, [
            localX,
            0,
            passage.centerLocalM[2],
          ]);
          const groundY = environment.groundAt(x, z);
          expect(groundY).not.toBeNull();
          expect(
            pedestrianPointIsBlocked(
              x,
              z,
              groundY!,
              environment.obstacles,
              environment,
            ),
          ).toBeFalse();
        }
      }
    }
  });

  test("walks continuously through every passage in both directions", () => {
    const rotationRadians = (gateProfile.rotationDegrees * Math.PI) / 180;
    for (const mode of MODES) {
      const environment = gateEnvironment(mode);
      for (const passage of BRANDENBURG_GATE_PUBLIC_PASSAGES) {
        for (const direction of [-1, 1] as const) {
          const startWorld = minecraftHeroLocalToWorld(passage.frame, [
            direction * -8.2,
            0,
            passage.centerLocalM[2],
          ]);
          const forwardX = direction * Math.cos(rotationRadians);
          const forwardZ = direction * -Math.sin(rotationRadians);
          let state = createPedestrianState(environment, {
            x: startWorld[0],
            yaw: Math.atan2(forwardX, -forwardZ),
            z: startWorld[2],
          });
          for (let step = 0; step < 54; step += 1) {
            state = stepPedestrian(
              state,
              { forward: 1, look: 0, sprint: false, strafe: 0, turn: 0 },
              0.05,
              environment,
            ).state;
          }
          const dx = state.x - startWorld[0];
          const dz = state.z - startWorld[2];
          const forwardProgress = dx * forwardX + dz * forwardZ;
          const lateralDrift = Math.abs(dx * -forwardZ + dz * forwardX);
          expect(forwardProgress).toBeGreaterThan(16.5);
          expect(lateralDrift).toBeLessThan(0.02);
        }
      }
    }
  });

  test("keeps all twelve columns, the lintel and both side pavilions solid", () => {
    for (const mode of MODES) {
      const environment = gateEnvironment(mode);
      for (const rowX of [-4.25, 4.25]) {
        for (const columnAxisZ of gateColumnAxes()) {
          const [x, , z] = minecraftHeroLocalToWorld(
            BRANDENBURG_GATE_PUBLIC_PASSAGES[0].frame,
            [rowX, 0, columnAxisZ],
          );
          const groundY = environment.groundAt(x, z);
          expect(groundY).not.toBeNull();
          expect(
            pedestrianPointIsBlocked(
              x,
              z,
              groundY!,
              environment.obstacles,
              environment,
            ),
          ).toBeTrue();
        }
      }

      const middle = BRANDENBURG_GATE_PUBLIC_PASSAGES[2];
      const aboveLintel = minecraftHeroLocalToWorld(middle.frame, [
        0,
        13.2,
        middle.centerLocalM[2],
      ]);
      expect(
        visualModeWalkableInteriorAt(
          mode,
          ...aboveLintel,
          gateProfile.sourcePrismIds[0],
        ),
      ).toBeFalse();
      for (const pavilionSourceId of gateProfile.sourcePrismIds.slice(1)) {
        expect(
          visualModeWalkableInteriorAt(
            mode,
            ...minecraftHeroLocalToWorld(middle.frame, middle.centerLocalM),
            pavilionSourceId,
          ),
        ).toBeFalse();
      }
    }
  });

  test("keeps station access confined to its two authored interior modes", () => {
    const stationPortal = MINECRAFT_HERO_PORTALS.find(
      ({ id }) => id === "hauptbahnhof-europaplatz-portal",
    );
    expect(stationPortal).toBeDefined();
    const world = minecraftHeroLocalToWorld(
      stationPortal!.frame,
      stationPortal!.centerLocalM,
    );
    for (const mode of MODES) {
      expect(
        visualModeWalkableInteriorAt(
          mode,
          ...world,
          stationPortal!.sourceBuildingIds[0],
        ),
      ).toBe(mode === "minecraft" || mode === "schwellenraum");
    }
  });

  test("shares its metric frame and five widths with the rendered Gate", () => {
    const signature = scenePayload.architectural_signatures.find(
      ({ kind }) => kind === "brandenburg_gate_model",
    );
    expect(signature).toBeDefined();
    expect(BRANDENBURG_GATE_PUBLIC_PASSAGES.map(({ sizeM }) => sizeM[2])).toEqual([
      BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
      BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
      BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.centralPassageWidthM,
      BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
      BRANDENBURG_GATE_PHOTO_DETAIL_PROFILE.sidePassageWidthM,
    ]);
    for (const passage of BRANDENBURG_GATE_PUBLIC_PASSAGES) {
      expect(passage.frame.anchorWorld).toEqual(signature!.anchor_world);
      expect(passage.frame.rotationDegrees).toBe(
        signature!.rotation_y_degrees,
      );
    }
  });

  test("wires the shared access policy into warm and cold-start worlds", () => {
    const isoBuilder = viewerSource.slice(
      viewerSource.indexOf("function ensureIsoWorld"),
      viewerSource.indexOf("function ensureVoxelWorld"),
    );
    const voxelBuilder = viewerSource.slice(
      viewerSource.indexOf("function ensureVoxelWorld"),
      viewerSource.indexOf("const PHOTO_FOV_DEGREES"),
    );
    expect(isoBuilder).toContain("visualModeWalkableInteriorAt(");
    expect(voxelBuilder).toContain("visualModeWalkableInteriorAt(");
  });
});
