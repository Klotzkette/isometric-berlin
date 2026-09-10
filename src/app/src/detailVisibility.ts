import { Box3, type Object3D, type Vector3 } from "three";
import {
  nextDetailFadeVisible,
  type DetailFadeRangeM,
} from "./fineDetailFade";

export type DistanceDetailTarget = {
  object: Object3D;
  bounds: Box3;
  rangeM: DetailFadeRangeM;
  distanceVisible: boolean;
  authoredVisible: boolean;
  appliedVisible: boolean | null;
};

/** Static geometry owns these bounds; no vertex or instance walk runs in RAF. */
export function createDistanceDetailTarget(
  object: Object3D,
  rangeM: DetailFadeRangeM,
): DistanceDetailTarget {
  object.updateWorldMatrix(true, true);
  return {
    object,
    bounds: new Box3().setFromObject(object),
    rangeM,
    distanceVisible: true,
    authoredVisible: object.visible,
    appliedVisible: null,
  };
}

/** Release only our own last value before lighting/voxel policy takes over. */
export function restoreDistanceDetailTarget(target: DistanceDetailTarget): void {
  if (
    target.appliedVisible !== null &&
    target.object.visible === target.appliedVisible
  ) {
    target.object.visible = target.authoredVisible;
  }
  target.appliedVisible = null;
}

/**
 * Small ornament follows its nearest actual world bounds, never the orbit
 * target. A lateral pan or a walk therefore reveals existing detail in the
 * same frame. Structural/facade groups are deliberately never registered.
 */
export function updateDistanceDetailTarget(
  target: DistanceDetailTarget,
  cameraPosition: Vector3,
): boolean {
  if (
    target.appliedVisible === null ||
    target.object.visible !== target.appliedVisible
  ) {
    target.authoredVisible = target.object.visible;
  }
  const distanceM = target.bounds.isEmpty()
    ? 0
    : target.bounds.distanceToPoint(cameraPosition);
  target.distanceVisible = nextDetailFadeVisible(
    { distanceM, visible: target.distanceVisible },
    target.rangeM,
  );
  const visible = target.authoredVisible && target.distanceVisible;
  const changed = target.object.visible !== visible;
  target.object.visible = visible;
  target.appliedVisible = visible;
  return changed;
}
