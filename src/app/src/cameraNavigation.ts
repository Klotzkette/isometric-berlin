import { MathUtils, PerspectiveCamera, Vector3 } from "three";

export type CameraFlightBounds = {
  max: Vector3;
  min: Vector3;
};

export const REGIERUNGSVIERTEL_FLIGHT_BOUNDS: CameraFlightBounds = {
  min: new Vector3(-850, -120, -1_100),
  max: new Vector3(850, 280, 1_550),
};

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
