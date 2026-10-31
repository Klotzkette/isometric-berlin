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
 * Preserve source-footprint envelopes for every refinement district, including
 * roofs and courtyard openings, so suspension or detail eviction never reopens
 * city-sized gaps. Mobile coverage spans the full source inventory.
 */
export function createProgressiveBuildingCoverage(
  prisms: PrismPayload,
  partition: ReturnType<typeof splitProgressiveBuildings>,
  options: { historicDomV288?: boolean; potsdamerCorridorV288?: boolean; potsdamerStationPhoto?: boolean; golgathaV270?: boolean; tachelesFrontsV270?: boolean; technikmuseumV272?: boolean; operaTheatresV274?: boolean; tiergartenWerkhofV275?: boolean; steppengartenShelterV283?: boolean; bayerCampusV277?: boolean; lehrterV277?: boolean; rkiMoabitV277?: boolean; verkehrskanzelV276?: boolean; zooWestV276?: boolean; zooHousesV282?: boolean; moabitLandmarksV269?: boolean; northernSitesV266?: boolean; tempodromAnhalterV266?: boolean; chariteBridgesV265?: boolean; architectureV241?: boolean; includeLegacyTownhallEnvelopes?: boolean; includeLegacyDistrictCourtEnvelopes?: boolean; includeLegacyWeddingStationRoof?: boolean; includeLegacySchlossplatzEnvelopes?: boolean; includeLegacyColonnadesEnvelopes?: boolean } = {},
): Group {
  const coverage = new Group();
  coverage.name = COVERAGE_NAME;
  const distant = createDistantBuildingShells(prisms, partition.omitted, options);
  distant.name = "Permanent distant building coverage";
  coverage.add(distant);
  partition.remaining.forEach((buildings, index) => {
    const preview = createDistantBuildingShells(prisms, buildings, options);
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

/** Restore the permanent source envelope before releasing a distant district. */
export function restoreBuildingPreview(world: Object3D, previewId: string): void {
  const coverage = world.getObjectByName(COVERAGE_NAME);
  const preview = coverage?.children.find(
    (child) => child.userData.progressiveBuildingPreviewId === previewId,
  );
  if (preview) preview.visible = true;
}

/** Restore coverage before disposing partial exact geometry on a pause. */
export function restoreBuildingPreviews(world: Object3D | null): void {
  const coverage = world?.getObjectByName(COVERAGE_NAME);
  for (const preview of coverage?.children ?? []) preview.visible = true;
}
