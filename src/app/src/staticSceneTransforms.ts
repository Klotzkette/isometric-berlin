import type { Object3D } from "three";

/** Opt in only after an immutable geometry layer has its final local poses. */
export function freezeStaticSceneTransforms<T extends Object3D>(root: T): T {
  root.traverse((object) => {
    if (object.matrixAutoUpdate) object.updateMatrix();
    object.matrixAutoUpdate = false;
    object.matrixWorldNeedsUpdate = true;
  });
  // Keep matrixWorldAutoUpdate enabled: attaching this layer to a moved parent
  // must still update its world transforms, bounds and raycast coordinates.
  return root;
}
