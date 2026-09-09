import { Group, type Object3D } from "three";
import {
  createDistantBuildingShells,
  type PrismPayload,
} from "./IsometricCityWorld";
import type { splitProgressiveBuildings } from "./progressiveWorld";

const COVERAGE_NAME = "Startup complete building coverage";

/**
 * Publish every source building with the first interactive frame. These small
 * buffers belong to the preview world, not the disposable refinement worker.
 * Keep the temporary shells for a paused worker's restart (at most 8,580 boxes
 * on desktop / 3,440 on mobile), so hiding a tab never reopens city-sized gaps.
 */
export function createProgressiveBuildingCoverage(
  prisms: PrismPayload,
  partition: ReturnType<typeof splitProgressiveBuildings>,
): Group {
  const coverage = new Group();
  coverage.name = COVERAGE_NAME;
  const distant = createDistantBuildingShells(prisms, partition.omitted);
  distant.name = "Permanent distant building coverage";
  coverage.add(distant);
  partition.remaining.forEach((buildings, index) => {
    const preview = createDistantBuildingShells(prisms, buildings);
    preview.name = `Building refinement fallback ${index + 1}`;
    preview.userData.progressiveBuildingPreviewId = `buildings-preview-${index + 1}`;
    coverage.add(preview);
  });
  return coverage;
}

/** Call only after the replacement is fully materialised and in the scene. */
export function hideReplacedBuildingPreview(
  world: Object3D,
  previewId: string | undefined,
): void {
  if (!previewId) return;
  const coverage = world.getObjectByName(COVERAGE_NAME);
  const preview = coverage?.children.find(
    (child) => child.userData.progressiveBuildingPreviewId === previewId,
  );
  if (preview) preview.visible = false;
}

/** Restore coverage before disposing partial exact geometry on a pause. */
export function restoreBuildingPreviews(world: Object3D | null): void {
  const coverage = world?.getObjectByName(COVERAGE_NAME);
  for (const preview of coverage?.children ?? []) preview.visible = true;
}
