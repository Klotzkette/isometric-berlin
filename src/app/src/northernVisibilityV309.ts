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

/** Broad phase for navigation. A cell can only reject an unrelated point.
 * Hits still go through the complete live model and the exact source shape.
 * Include neighbouring native cell centres, boundary tolerances and the
 * usual walking capsule. Larger callers take the exact path directly. */
const navigationCells = new Map<number, Set<number>>();
const cellSize = 256;
const maxRadius = 8;
for (const [west, north, east, south] of index.regions) {
  const margin = maxRadius + 4;
  for (let x = Math.floor((west - margin) / cellSize); x <= Math.floor((east + margin) / cellSize); x++) {
    let column = navigationCells.get(x);
    if (!column) navigationCells.set(x, column = new Set());
    for (let z = Math.floor((north - margin) / cellSize); z <= Math.floor((south + margin) / cellSize); z++) {
      column.add(z);
    }
  }
}

export function northernNavigationNearV309(x: number, z: number, radius = 0): boolean {
  return radius > maxRadius || navigationCells.get(Math.floor(x / cellSize))?.has(Math.floor(z / cellSize)) === true;
}
