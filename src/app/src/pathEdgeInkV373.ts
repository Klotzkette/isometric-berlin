import type { InstancedMesh } from "three";

// Each entry holds XYZ segment pairs on the literal, equal-height slab owners.
// An empty array records a raster line fully inside a continuous finish.
const pathInk = new WeakMap<InstancedMesh, ReadonlyMap<number, readonly number[]>>();

export function getPathEdgeInkV373(slabs: InstancedMesh) {
  return pathInk.get(slabs);
}

export function setPathEdgeInkV373(
  slabs: InstancedMesh, edges: ReadonlyMap<number, readonly number[]>,
) {
  pathInk.set(slabs, edges);
}

/** The kerb builder consumes each table once; the finished scene owns XYZ only. */
export function releasePathEdgeInkV373(slabs: InstancedMesh) {
  pathInk.delete(slabs);
}
