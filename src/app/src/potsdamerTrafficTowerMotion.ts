import { type Camera, type Object3D, Vector3 } from "three";
import { updatePotsdamerTrafficTower } from "./PotsdamerTrafficTower";
import { POTSDAMER_TRAFFIC_TOWER_PROFILE } from "./potsdamerTrafficTowerProfile";

/** Only a changed visible signal requests a new frame; no continuous render. */
export function updateVisiblePotsdamerTrafficTower(
  tower: Object3D,
  camera: Camera,
  seconds: number,
  reducedMotion: boolean,
  lightsOn: boolean,
  hidden: boolean,
  underside: boolean,
  screen: Vector3,
): boolean {
  if (hidden || underside) return false;
  for (let ancestor: Object3D | null = tower; ancestor; ancestor = ancestor.parent) {
    if (!ancestor.visible) return false;
  }
  camera.updateMatrixWorld();
  tower.updateWorldMatrix(true, false);
  screen.set(0, POTSDAMER_TRAFFIC_TOWER_PROFILE.signalCentreM, 0)
    .applyMatrix4(tower.matrixWorld).project(camera);
  if (Math.abs(screen.x) > 1.08 || Math.abs(screen.y) > 1.08 ||
      screen.z < -1 || screen.z > 1) return false;
  return updatePotsdamerTrafficTower(tower, seconds, reducedMotion, lightsOn);
}
