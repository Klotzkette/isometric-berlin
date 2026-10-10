import type { InstancedMesh } from "three";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import { restoreDrawnWaterBoundary } from "./drawnWaterBoundary";
import ownership from "./data/altMitteGroundSeamsV206.json";

/**
 * Reuse the existing exact land-complement writer only for source-proven
 * grass/road conflicts in Alt-Mitte. Source roads and outside run XYZ/paint stay
 * exact; prior authored/water exclusions survive. Drawn construction only.
 */
export function restoreAltMitteGroundSeamsV206(slabs: InstancedMesh, ground: VoxelPayload): void {
  const previous = new Set(slabs.children);
  const previousWaterCount = slabs.userData.exactWaterBoundaryCells;
  restoreDrawnWaterBoundary(slabs, ground, ownership);
  let applied = false;
  for (const child of slabs.children) {
    if (previous.has(child)) continue;
    child.name = "Exact retained grass outside Alt-Mitte source roads v206";
    child.userData.altMitteGroundSeamsV206 = true;
    child.userData.correctionPolicy = "Only proven coarse grass overlap; original outside XYZ and instance color retained";
    child.traverse(object => {
      object.userData.altMitteGroundSeamsV206 = true;
      if (object !== child) object.name = `Alt-Mitte retained grass complement ${object.name.split(" ").at(-1)}`;
      // The shared ground-complement flag also selects the established
      // Day/Night/Snowstorm ground-material lifecycle; it is not provenance.
    });
    applied = true;
  }
  if (applied) slabs.userData.altMitteGroundSeamCellsV206 = slabs.userData.exactWaterBoundaryCells;
  if (previousWaterCount === undefined) delete slabs.userData.exactWaterBoundaryCells;
  else slabs.userData.exactWaterBoundaryCells = previousWaterCount;
}
