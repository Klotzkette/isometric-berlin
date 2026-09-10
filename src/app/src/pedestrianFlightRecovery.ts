import type { PedestrianEnvironment, PedestrianViewPoint } from "./pedestrianNavigation";
import { schwellenraumFlightPointIsBlocked } from "./schwellenraumNavigation";

export const PEDESTRIAN_FLIGHT_RECOVERY_HEIGHT_M = 256;
const COLUMN_SAMPLE_M = 0.5;

/**
 * Last resort for an explicit walking recovery request, never a mode change.
 * Move above the obstruction at the exact same X/Z rather than restore an old
 * free-flight pose. Check the entire bounded column so an empty room below a
 * solid roof cannot be mistaken for a usable flight exit.
 */
export function findPedestrianFlightRecoveryPosition(
  camera: PedestrianViewPoint,
  environment: PedestrianEnvironment,
  maxEyeY = 280,
): PedestrianViewPoint | null {
  if (![camera.x, camera.y, camera.z, maxEyeY].every(Number.isFinite)) return null;
  const ceiling = Math.min(camera.y + PEDESTRIAN_FLIGHT_RECOVERY_HEIGHT_M, maxEyeY);
  if (ceiling < camera.y + 2) return null;
  const point = { ...camera };
  let lastBlockedY = camera.y;
  const steps = Math.ceil((ceiling - camera.y) / COLUMN_SAMPLE_M);
  for (let step = 0; step <= steps; step += 1) {
    point.y = Math.min(ceiling, camera.y + step * COLUMN_SAMPLE_M);
    if (schwellenraumFlightPointIsBlocked(point, environment)) {
      lastBlockedY = point.y;
    }
  }
  point.y = Math.max(camera.y + 2, lastBlockedY + 1.25);
  if (point.y > ceiling || schwellenraumFlightPointIsBlocked(point, environment)) return null;
  return point;
}
