import { Vector3, type PerspectiveCamera } from "three";
import type { CameraPose } from "./cameraNavigation";
import type { PedestrianRecoveryHistory, PedestrianState } from "./pedestrianNavigation";

type Point = [number, number, number];
type StoredPose = { position: Point; target: Point };

/** Only small numeric data crosses the mobile renderer's disposal boundary. */
export type NavigationSnapshot = {
  pose: StoredPose;
  fov: number;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
  focusedCameraFov: number | null;
  underside: boolean;
  pedestrian: {
    enabled: boolean;
    requested: boolean;
    state: PedestrianState | null;
    savedPose: StoredPose | null;
    savedFov: number;
    savedNear: number;
    savedUnderside: boolean;
    recoveryHistory: PedestrianRecoveryHistory;
  };
};

type NavigationRuntime = {
  camera: PerspectiveCamera;
  controls: { target: Vector3; minDistance: number; maxDistance: number; enabled: boolean };
  focusedCameraFov: number | null;
  underside: boolean;
  pedestrian: Omit<NavigationSnapshot["pedestrian"], "savedPose"> & {
    savedPose: CameraPose | null;
    cameraDirty: boolean;
  };
};

const storePose = (position: Vector3, target: Vector3): StoredPose => ({
  position: position.toArray(), target: target.toArray(),
});

export function captureNavigationSnapshot(runtime: NavigationRuntime): NavigationSnapshot {
  const { camera, controls, pedestrian } = runtime;
  return {
    pose: storePose(camera.position, controls.target),
    fov: camera.fov, near: camera.near, far: camera.far,
    minDistance: controls.minDistance, maxDistance: controls.maxDistance,
    focusedCameraFov: runtime.focusedCameraFov, underside: runtime.underside,
    pedestrian: {
      enabled: pedestrian.enabled, requested: pedestrian.requested,
      state: pedestrian.state ? { ...pedestrian.state } : null,
      savedPose: pedestrian.savedPose
        ? storePose(pedestrian.savedPose.position, pedestrian.savedPose.target) : null,
      savedFov: pedestrian.savedFov, savedNear: pedestrian.savedNear,
      savedUnderside: pedestrian.savedUnderside,
      recoveryHistory: structuredClone(pedestrian.recoveryHistory),
    },
  };
}

export function restoreNavigationSnapshot(runtime: NavigationRuntime, snapshot: NavigationSnapshot): void {
  const { camera, controls, pedestrian } = runtime;
  camera.position.fromArray(snapshot.pose.position);
  controls.target.fromArray(snapshot.pose.target);
  camera.fov = snapshot.fov;
  camera.near = snapshot.near;
  camera.far = snapshot.far;
  controls.minDistance = snapshot.minDistance;
  controls.maxDistance = snapshot.maxDistance;
  runtime.focusedCameraFov = snapshot.focusedCameraFov;
  runtime.underside = snapshot.underside;
  Object.assign(pedestrian, structuredClone(snapshot.pedestrian));
  pedestrian.savedPose = snapshot.pedestrian.savedPose ? {
    position: new Vector3().fromArray(snapshot.pedestrian.savedPose.position),
    target: new Vector3().fromArray(snapshot.pedestrian.savedPose.target),
  } : null;
  pedestrian.cameraDirty = pedestrian.enabled;
  controls.enabled = !pedestrian.enabled;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
}
