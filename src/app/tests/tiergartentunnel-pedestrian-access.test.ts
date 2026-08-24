import { describe, expect, test } from "bun:test";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createPedestrianEnvironment,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import {
  createTunnelInteriorTester,
  tunnelWalkCourses,
  type TunnelPortalCourseInput,
} from "../src/TunnelPortals";
import type { VisualMode } from "../src/visualMode";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";

type PrismFixture = NonNullable<
  Parameters<typeof createPedestrianEnvironment>[3]
>;

const prismPayload = (await Bun.file(
  new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url),
).json()) as PrismFixture;
const groundPayload = (await Bun.file(
  new URL(
    "../public/mesh/regierungsviertel/ground-context.json",
    import.meta.url,
  ),
).json()) as VoxelPayload;
const scenePayload = (await Bun.file(
  new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url),
).json()) as { tiergartentunnel: TunnelPortalCourseInput };
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
const route = scenePayload.tiergartentunnel;
const courses = tunnelWalkCourses(route);
const tunnelInteriorAt = createTunnelInteriorTester(route);

function tunnelEnvironment(mode: VisualMode): PedestrianEnvironment {
  const environment = createPedestrianEnvironment(
    groundPayload,
    { water: [] },
    route,
    prismPayload,
  );
  environment.walkableInteriorAt = (x, y, z, sourceId) =>
    tunnelInteriorAt(x, y, z) ||
    visualModeWalkableInteriorAt(mode, x, y, z, sourceId);
  // Deliberately hostile fallbacks prove that every capsule sample remains in
  // the protected bore and that no mode-specific solid can close the route.
  environment.protectedVolumeAt = (x, y, z) => !tunnelInteriorAt(x, y, z);
  environment.interiorSolidAt = (x, y, z) => !tunnelInteriorAt(x, y, z);
  return environment;
}

describe("Tiergartentunnel pedestrian access", () => {
  test("keeps both tubes and all eight portal courses clear in every mode", () => {
    expect(courses.filter(({ kind }) => kind === "tube")).toHaveLength(2);
    expect(courses.filter(({ kind }) => kind === "portal")).toHaveLength(8);

    for (const mode of MODES) {
      const environment = tunnelEnvironment(mode);
      const failures: string[] = [];
      let sampleCount = 0;
      for (const [courseIndex, course] of courses.entries()) {
        for (
          let pointIndex = 0;
          pointIndex < course.points.length - 1;
          pointIndex += 1
        ) {
          const from = course.points[pointIndex];
          const to = course.points[pointIndex + 1];
          const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
          const steps = Math.max(1, Math.ceil(distance / 2));
          for (let step = 0; step <= steps; step += 1) {
            const progress = step / steps;
            const x = from[0] + (to[0] - from[0]) * progress;
            const expectedY = from[1] + (to[1] - from[1]) * progress;
            const z = from[2] + (to[2] - from[2]) * progress;
            const ground = environment.resolveGround?.(
              x,
              z,
              "tunnel",
              expectedY,
            );
            sampleCount += 1;
            if (
              !ground ||
              ground.layer !== "tunnel" ||
              Math.abs(ground.y - expectedY) > 0.05 ||
              pedestrianPointIsBlocked(
                x,
                z,
                ground.y,
                environment.obstacles,
                environment,
              )
            ) {
              failures.push(
                `${course.kind} ${courseIndex}:${pointIndex}:${step} at ${x.toFixed(2)},${expectedY.toFixed(2)},${z.toFixed(2)}`,
              );
            }
          }
        }
      }
      expect(sampleCount).toBeGreaterThan(3_000);
      expect(
        failures,
        `${mode}: ${failures.slice(0, 8).join(" | ")}`,
      ).toEqual([]);
    }
  });

  test("gives the tunnel corridor priority in warm and cold world builders", () => {
    const isoBuilder = viewerSource.slice(
      viewerSource.indexOf("function ensureIsoWorld"),
      viewerSource.indexOf("function ensureVoxelWorld"),
    );
    const voxelBuilder = viewerSource.slice(
      viewerSource.indexOf("function ensureVoxelWorld"),
      viewerSource.indexOf("const PHOTO_FOV_DEGREES"),
    );
    for (const builder of [isoBuilder, voxelBuilder]) {
      expect(builder).toContain("runtime.tunnelInteriorAt?.(x, y, z) === true");
      expect(builder).toContain("return false;");
      expect(builder).toContain("visualModeWalkableInteriorAt(");
    }
    expect(isoBuilder).toContain(
      "runtime.tunnelInteriorAt?.(x, y, z) !== true",
    );
  });
});
