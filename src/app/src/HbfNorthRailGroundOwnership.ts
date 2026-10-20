import type { InstancedMesh } from 'three';
import type { VoxelPayload } from './MinecraftVoxelWorld';
import { restoreDrawnWaterBoundary } from './drawnWaterBoundary';
import ownership from './data/hbfNorthRailTerrainBoundary.json';
import drawnOwnership from './data/hbfDrawnTerrainBoundaryV252.json';
/** Preserve the original height/paint outside the exact railway open-cut. */
export function restoreHbfNorthRailGroundOwnership(slabs:InstancedMesh,ground:VoxelPayload,drawnAtrium=false):void {
  const previous=new Set(slabs.children);
  restoreDrawnWaterBoundary(slabs,ground,drawnAtrium ? drawnOwnership : ownership);
  for(const child of slabs.children){
    if(previous.has(child))continue;
    child.name='Exact terrain complements outside northern Hauptbahnhof rail cuts';
    child.userData.hbfNorthRailGroundOwnership=true;
    if(drawnAtrium) {
      child.name='Exact terrain complements outside Hauptbahnhof rail cuts and existing atrium';
      child.userData.hbfAtriumGroundOwnershipV252=true;
    }
    child.traverse(object=>{object.userData.hbfNorthRailGroundOwnership=true;delete object.userData.exactWaterBoundaryLand;});
  }
}
