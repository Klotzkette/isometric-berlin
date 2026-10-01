import type { InstancedMesh } from 'three';
import type { VoxelPayload } from './MinecraftVoxelWorld';
import { restoreDrawnWaterBoundary } from './drawnWaterBoundary';
import ownership from './data/hbfNorthRailTerrainBoundary.json';
/** Preserve the original height/paint outside the exact railway open-cut. */
export function restoreHbfNorthRailGroundOwnership(slabs:InstancedMesh,ground:VoxelPayload):void {
  const previous=new Set(slabs.children);
  restoreDrawnWaterBoundary(slabs,ground,ownership);
  for(const child of slabs.children){
    if(previous.has(child))continue;
    child.name='Exact terrain complements outside northern Hauptbahnhof rail cuts';
    child.userData.hbfNorthRailGroundOwnership=true;
    child.traverse(object=>{object.userData.hbfNorthRailGroundOwnership=true;delete object.userData.exactWaterBoundaryLand;});
  }
}
