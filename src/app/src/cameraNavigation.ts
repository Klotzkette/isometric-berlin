import { MathUtils, PerspectiveCamera, Vector3 } from "three";

export type CameraFlightBounds = {
  max: Vector3;
  min: Vector3;
};

export type CameraPose = {
  position: Vector3;
  target: Vector3;
};

export const REGIERUNGSVIERTEL_FLIGHT_BOUNDS: CameraFlightBounds = {
  min: new Vector3(-850, -120, -1_100),
  max: new Vector3(850, 280, 1_550),
};

export function captureCameraPose(
  camera: PerspectiveCamera,
  target: Vector3,
): CameraPose {
  return { position: camera.position.clone(), target: target.clone() };
}

function vectorIsFinite(vector: Vector3): boolean {
  return [vector.x, vector.y, vector.z].every(Number.isFinite);
}

export function stabilizeCameraRig(
  camera: PerspectiveCamera,
  target: Vector3,
  lastSafePose: CameraPose,
  minDistance: number,
  maxDistance: number,
  bounds = REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
): { changed: boolean; pose: CameraPose; recovered: boolean } {
  const distance = camera.position.distanceTo(target);
  if (
    !vectorIsFinite(camera.position) ||
    !vectorIsFinite(target) ||
    !Number.isFinite(distance) ||
    distance < 1e-6
  ) {
    camera.position.copy(lastSafePose.position);
    target.copy(lastSafePose.target);
    camera.updateMatrixWorld();
    return {
      changed: true,
      pose: captureCameraPose(camera, target),
      recovered: true,
    };
  }

  let changed = false;
  const boundedTarget = target.clone().clamp(bounds.min, bounds.max);
  if (!boundedTarget.equals(target)) {
    const correction = boundedTarget.sub(target);
    target.add(correction);
    camera.position.add(correction);
    changed = true;
  }

  const offset = camera.position.clone().sub(target);
  const distanceBeforeClamp = offset.length();
  const boundedDistance = MathUtils.clamp(
    distanceBeforeClamp,
    minDistance,
    maxDistance,
  );
  if (Math.abs(distanceBeforeClamp - boundedDistance) > 1e-6) {
    camera.position.copy(target).add(offset.setLength(boundedDistance));
    changed = true;
  }
  camera.updateMatrixWorld();
  return {
    changed,
    pose: captureCameraPose(camera, target),
    recovered: false,
  };
}

export function screenRelativeFlightDelta(
  camera: PerspectiveCamera,
  target: Vector3,
  horizontal: number,
  vertical: number,
): Vector3 {
  camera.updateMatrixWorld();
  const distance = camera.position.distanceTo(target);
  const step = MathUtils.clamp(distance * 0.055, 3.5, 58);
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  return right
    .multiplyScalar(horizontal * step)
    .add(up.multiplyScalar(vertical * step));
}

export function flyCameraInViewPlane(
  camera: PerspectiveCamera,
  target: Vector3,
  horizontal: number,
  vertical: number,
  bounds = REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
): Vector3 {
  const requested = screenRelativeFlightDelta(
    camera,
    target,
    horizontal,
    vertical,
  );
  const nextTarget = target.clone().add(requested);
  nextTarget.clamp(bounds.min, bounds.max);
  const applied = nextTarget.sub(target);
  target.add(applied);
  camera.position.add(applied);
  camera.updateMatrixWorld();
  return applied;
}

export function viewHeadingFlightDelta(
  camera: PerspectiveCamera,
  target: Vector3,
  strafe: number,
  forward: number,
): Vector3 {
  camera.updateMatrixWorld();
  const distance = camera.position.distanceTo(target);
  const step = MathUtils.clamp(distance * 0.055, 3.5, 58);
  const heading = target.clone().sub(camera.position);
  heading.y = 0;
  if (heading.lengthSq() < 1e-6) {
    camera.getWorldDirection(heading);
    heading.y = 0;
  }
  heading.normalize();
  const right = new Vector3().crossVectors(heading, camera.up).normalize();
  return heading
    .multiplyScalar(forward * step)
    .add(right.multiplyScalar(strafe * step));
}

export const TWO_FINGER_PAN_PIXELS_PER_UNIT = 72;

// Direct-manipulation two-finger pan: the content under the fingers must
// follow them (finger right → content right, finger down → content down),
// like Google Maps. Translating the whole camera rig by D makes the content
// appear to move by −D, so the rig has to travel OPPOSITE the finger delta.
// Screen-space right maps to +strafe and the into-scene heading projects
// toward the top of the screen, hence the sign flips below. Both axes were
// previously inverted (rig followed the fingers instead of the content),
// which is the "immer noch konträr" complaint.
export function twoFingerPanFlight(
  deltaX: number,
  deltaY: number,
  pixelsPerUnit = TWO_FINGER_PAN_PIXELS_PER_UNIT,
): { forward: number; strafe: number } {
  return {
    forward: deltaY / pixelsPerUnit,
    strafe: -deltaX / pixelsPerUnit,
  };
}

export function flyCameraAlongViewHeading(
  camera: PerspectiveCamera,
  target: Vector3,
  strafe: number,
  forward: number,
  bounds = REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
): Vector3 {
  const requested = viewHeadingFlightDelta(camera, target, strafe, forward);
  const nextTarget = target.clone().add(requested).clamp(bounds.min, bounds.max);
  const applied = nextTarget.sub(target);
  target.add(applied);
  camera.position.add(applied);
  camera.updateMatrixWorld();
  return applied;
}
