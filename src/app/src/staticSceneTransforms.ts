import type { Object3D } from "three";

/** Freeze a fixed container without changing animation policy below it. */
export function freezeStaticSceneTransform<T extends Object3D>(object: T): T {
  if (object.matrixAutoUpdate) object.updateMatrix();
  object.matrixAutoUpdate = false;
  object.matrixWorldNeedsUpdate = true;
  return object;
}

/** Opt in only after an immutable geometry layer has its final local poses. */
export function freezeStaticSceneTransforms<T extends Object3D>(root: T): T {
  root.traverse(freezeStaticSceneTransform);
  // Keep matrixWorldAutoUpdate enabled: attaching this layer to a moved parent
  // must still update its world transforms, bounds and raycast coordinates.
  return root;
}
