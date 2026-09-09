import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";

import { REGIERUNGSVIERTEL_FLIGHT_BOUNDS } from "../src/cameraNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { worldCameraFarM } from "../src/worldCameraDepth";

const MAX_ISOMETRIC_ORBIT_M =
  (2_600 * Math.tan((39 * Math.PI) / 360)) /
  Math.tan((16 * Math.PI) / 360);

const payload = (await Bun.file(
  new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url),
).json()) as PrismPayload;

describe("complete-city camera depth", () => {
  test("keeps a real opposite-corner building formerly clipped at an allowed view", () => {
    const building = payload.buildings.find((part) => part.id === "27336024");
    expect(building).toBeDefined();
    const sourceCorner = building!.ring.find(
      ([x, z]) => x === 22_713 && z === 29_088,
    );
    expect(sourceCorner).toBeDefined();
    const target = new Vector3(
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.x,
      100,
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.z,
    );
    const point = new Vector3(
      sourceCorner![0] / 10,
      (building!.y0_dm + building!.h_dm) / 10,
      sourceCorner![1] / 10,
    );
    const direction = point.clone().sub(target).normalize();
    const camera = new PerspectiveCamera(16, 1, 0.25, 16_000);
    camera.position.copy(target).addScaledVector(direction, -MAX_ISOMETRIC_ORBIT_M);
    expect(camera.position.y).toBeGreaterThan(0);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const oldProjection = point.clone().project(camera);
    expect(Math.abs(oldProjection.x)).toBeLessThan(1e-10);
    expect(Math.abs(oldProjection.y)).toBeLessThan(1e-10);
    expect(oldProjection.z).toBeGreaterThan(1);

    camera.far = worldCameraFarM(MAX_ISOMETRIC_ORBIT_M);
    camera.updateProjectionMatrix();
    const correctedProjection = point.clone().project(camera);
    expect(correctedProjection.z).toBeGreaterThan(-1);
    expect(correctedProjection.z).toBeLessThan(1);
    expect(camera.near).toBe(0.25);
    expect(camera.far).toBe(18_000);
  });

  test("contains every delivered roof corner from every extreme target at maximum orbit", () => {
    const bounds = REGIERUNGSVIERTEL_FLIGHT_BOUNDS;
    let worstCameraDistanceM = 0;
    let sampledCorners = 0;
    for (const tx of [bounds.min.x, bounds.max.x]) {
      for (const ty of [bounds.min.y, bounds.max.y]) {
        for (const tz of [bounds.min.z, bounds.max.z]) {
          for (const building of payload.buildings) {
            const roofY = (building.y0_dm + building.h_dm) / 10;
            for (const [x, z] of building.ring) {
              worstCameraDistanceM = Math.max(
                worstCameraDistanceM,
                Math.hypot(x / 10 - tx, roofY - ty, z / 10 - tz) +
                  MAX_ISOMETRIC_ORBIT_M,
              );
              sampledCorners += 1;
            }
          }
        }
      }
    }
    expect(sampledCorners).toBeGreaterThan(1_000_000);
    expect(worstCameraDistanceM).toBeGreaterThan(16_000);
    expect(worstCameraDistanceM).toBeLessThan(worldCameraFarM(MAX_ISOMETRIC_ORBIT_M));
  });

  test("preserves the existing close-depth precision and bounds ordinary views", () => {
    const near = 0.25;
    const newFar = worldCameraFarM(MAX_ISOMETRIC_ORBIT_M);
    // The local world-distance per depth-buffer step is proportional to
    // (far - near) / far when the near plane and point distance are fixed.
    const depthStepRatio = ((newFar - near) / newFar) / ((16_000 - near) / 16_000);
    expect(depthStepRatio).toBeGreaterThanOrEqual(1);
    expect(depthStepRatio).toBeLessThan(1.000_002);
    expect(worldCameraFarM(2_600)).toBe(16_000);
    expect(worldCameraFarM(0)).toBe(16_000);
  });
});
