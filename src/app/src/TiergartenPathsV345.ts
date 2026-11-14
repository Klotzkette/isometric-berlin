import type { InstancedMesh } from "three";
import type { SurfacePayload } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import { restoreDrawnWaterBoundary } from "./drawnWaterBoundary";
import { tiergartenPathSourceGuardV345 } from "./tiergartenPathSourceGuardV345";
import ownership from "./data/tiergartenPathsV345.json";

const applied = new WeakSet<InstancedMesh>();

/** Main-thread-only complement writer; it never changes a path or walking height. */
export function restoreTiergartenPathsV345(slabs: InstancedMesh, ground: VoxelPayload, surfaces: SurfacePayload): boolean {
  if (applied.has(slabs) || !slabs.userData.roadGroundCellsV343) return false;
  if (tiergartenPathSourceGuardV345(ground,surfaces) !== ownership.sourceGuard) return false;
  const previous = new Set(slabs.children), oldWaterCount = slabs.userData.exactWaterBoundaryCells;
  restoreDrawnWaterBoundary(slabs,ground,{...ownership,depth_m:3});
  const added = slabs.children.filter(child=>!previous.has(child));
  if (oldWaterCount === undefined) delete slabs.userData.exactWaterBoundaryCells;
  else slabs.userData.exactWaterBoundaryCells = oldWaterCount;
  if (!added.length) return false;
  for (const child of added) {
    child.name = "Original ground outside proved Tiergarten path occlusions v345";
    child.traverse(object=>{ object.userData.tiergartenPathsV345 = true; });
  }
  applied.add(slabs);
  slabs.userData.tiergartenPathsV345 = ownership.counts;
  return true;
}
