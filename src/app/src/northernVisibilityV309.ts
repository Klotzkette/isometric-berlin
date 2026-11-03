import { Box3, Frustum, Matrix4, type Camera } from "three";
import index from "./data/northernFidelityV309Index.json";
const projection = new Matrix4(), frustum = new Frustum(), box = new Box3();
/** Visibility controls only deferred loading. It never extends source coverage
 * or approximates a building, park, railway or school navigation footprint. */
export function northernFidelityVisibleV309(camera: Camera): boolean {
  camera.updateMatrixWorld(); projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
  for (const [west, north, east, south] of index.regions) {
    box.min.set(west, -12, north); box.max.set(east, 410, south);
    if (frustum.intersectsBox(box)) return true;
  }
  return false;
}
