import type { InstancedMesh } from 'three';
import type { VoxelPayload } from './MinecraftVoxelWorld';
import { restoreDrawnWaterBoundary } from './drawnWaterBoundary';
import ownership from './data/hbfInteriorTerrainBoundaryV291.json';
/** Both families keep exact source terrain outside the railway/hall union. */
export function restoreHbfNorthRailGroundOwnership(slabs:InstancedMesh,ground:VoxelPayload,drawnAtrium=false):void {
  const previous=new Set(slabs.children);
  restoreDrawnWaterBoundary(slabs,ground,ownership);
  for(const child of slabs.children){
    if(previous.has(child))continue;
    child.name='Exact terrain complements outside Hauptbahnhof rail cuts and complete interior';
    child.userData.hbfNorthRailGroundOwnership=true;
    child.userData.hbfInteriorGroundOwnershipV291=true;
    if(drawnAtrium) {
      // Retain the existing drawn marker for consumers of the earlier receipt.
      child.userData.hbfAtriumGroundOwnershipV252=true;
    }
    child.traverse(object=>{
      object.userData.hbfNorthRailGroundOwnership=true;
      object.userData.hbfInteriorGroundOwnershipV291=true;
      delete object.userData.exactWaterBoundaryLand;
    });
  }
}
