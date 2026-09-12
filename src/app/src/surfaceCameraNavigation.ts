import { PerspectiveCamera, Vector3 } from "three";

// Close flight/orbit stays on the surface. A deliberately wide overview still
// permits the existing underside inspection, independently of the current lens.
export const SURFACE_CAMERA_CLEARANCE_M = 1.2;
export const SURFACE_MAX_POLAR = Math.PI / 2 - Math.PI / 60;
export const UNDERSIDE_OVERVIEW_HALF_HEIGHT_M = 250;

export function surfaceOrbitMaxPolar(camera: PerspectiveCamera, target: Vector3): number {
  const halfHeight = camera.position.distanceTo(target) * Math.tan(camera.fov * Math.PI / 360);
  return halfHeight >= UNDERSIDE_OVERVIEW_HALF_HEIGHT_M ? Math.PI - 0.06 : SURFACE_MAX_POLAR;
}

/** Looking upward above the city is not an underground cutaway. A small
 * hysteresis band prevents whole-world visibility chatter at the ground plane.
 */
export function surfaceUndersideView(
  camera: PerspectiveCamera,
  target: Vector3,
  groundAt: ((x: number, z: number) => number | null) | undefined,
  previouslyUnderneath = false,
): boolean {
  const sampled = groundAt?.(camera.position.x, camera.position.z);
  const ground = sampled != null && Number.isFinite(sampled) ? sampled : 0;
  const threshold = previouslyUnderneath ? 0.15 : -0.35;
  return camera.position.y < ground + threshold &&
    camera.position.y - target.y < threshold;
}

/** Clamp the actual camera, not just its target; horizontal travel stays fast.
 * Tunnel/portal traversal is explicitly exempt. Walking has its own ground solver.
 */
export function constrainSurfaceCameraRig(
  camera: PerspectiveCamera,
  target: Vector3,
  groundAt: ((x: number, z: number) => number | null) | undefined,
  insideTunnel = false,
  offset = new Vector3(),
  allowUnderside = false,
): boolean {
  if (insideTunnel) return false;
  const wideOverview = surfaceOrbitMaxPolar(camera, target) > Math.PI / 2;
  offset.copy(camera.position).sub(target);
  const distance = offset.length();
  if (!Number.isFinite(distance) || distance < 1e-6) return false;
  // A deliberate wide orbit below its focal point can inspect the underside.
  // Mere downward translation while looking down must still keep a floor.
  if (allowUnderside && wideOverview && offset.y < -0.35) return false;
  let changed = false;
  const minRise = distance * Math.cos(SURFACE_MAX_POLAR);
  if (!wideOverview && offset.y < minRise - 1e-8) {
    const horizontal = Math.hypot(offset.x, offset.z);
    const radius = distance * Math.sin(SURFACE_MAX_POLAR);
    if (horizontal > 1e-8) {
      offset.x *= radius / horizontal;
      offset.z *= radius / horizontal;
    } else {
      offset.set(0, 0, radius);
    }
    offset.y = minRise;
    camera.position.copy(target).add(offset);
    changed = true;
  }
  const sampled = groundAt?.(camera.position.x, camera.position.z);
  const floor = (sampled !== null && sampled !== undefined && Number.isFinite(sampled) ? sampled : 0) +
    SURFACE_CAMERA_CLEARANCE_M;
  if (camera.position.y < floor - 1e-8) {
    const lift = floor - camera.position.y;
    camera.position.y = floor;
    target.y += lift;
    changed = true;
  }
  if (changed) {
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  return changed;
}
