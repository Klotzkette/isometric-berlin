import type { InstancedMesh } from 'three';
import type { VoxelPayload } from './MinecraftVoxelWorld';
import { restoreDrawnWaterBoundary } from './drawnWaterBoundary';
import ownership from './data/jamesSimonTerrainBoundary.json';

/**
 * Give only the complete James-Simon foundations ownership of their ground.
 * The bounded offline table retains the exact outside land, including the
 * existing shoreline clip, while the shared writer preserves run height/paint.
 * Call BEFORE restoreDrawnWaterBoundary; its later pass then owns all other cells.
 */
export function restoreJamesSimonGroundOwnership(slabs: InstancedMesh, ground: VoxelPayload): void {
  const previous = new Set(slabs.children);
  restoreDrawnWaterBoundary(slabs, ground, ownership);
  for (const child of slabs.children) {
    if (previous.has(child)) continue;
    child.name = 'Exact ground complements outside James-Simon foundations';
    child.userData.jamesSimonGroundOwnership = true;
    child.traverse(object => {
      if (object === child) return;
      object.name = 'Retained ground outside James-Simon source and stair foundations';
      object.userData.jamesSimonGroundOwnership = true;
      delete object.userData.exactWaterBoundaryLand;
    });
  }
  if (slabs.children.length > previous.size) {
    slabs.userData.jamesSimonOwnedFoundationCells = slabs.userData.exactWaterBoundaryCells;
    delete slabs.userData.exactWaterBoundaryCells;
  }
}
