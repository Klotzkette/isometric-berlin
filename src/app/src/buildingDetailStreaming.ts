import type { PrismBuilding } from "./IsometricCityWorld";

export const MOBILE_DETAIL_BATCH_SIZE = 240;
export const MOBILE_DETAIL_RESIDENT_LIMIT = 3_600;
export const MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS = Math.floor(
  MOBILE_DETAIL_RESIDENT_LIMIT / MOBILE_DETAIL_BATCH_SIZE,
);

export type BuildingDetailDistrict = {
  readonly id: string;
  readonly previewId: string;
  readonly count: number;
  readonly center: readonly [number, number];
  readonly bounds: readonly [number, number, number, number];
};

/**
 * Retain only compact spatial metadata in the viewer. District IDs refer to
 * the immutable source partition, never to its current camera priority.
 */
export function buildingDetailDistricts(
  batches: readonly (readonly PrismBuilding[])[],
): readonly BuildingDetailDistrict[] {
  const districts: BuildingDetailDistrict[] = [];
  batches.forEach((buildings, index) => {
    if (buildings.length === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const building of buildings) {
      for (const [xDm, zDm] of building.ring) {
        minX = Math.min(minX, xDm / 10);
        minZ = Math.min(minZ, zDm / 10);
        maxX = Math.max(maxX, xDm / 10);
        maxZ = Math.max(maxZ, zDm / 10);
      }
    }
    // Empty source rings have no drawable footprint, but must not introduce
    // infinite bounds or change the IDs/counts of later source districts.
    if (minX === Number.POSITIVE_INFINITY) {
      minX = minZ = maxX = maxZ = 0;
    }
    districts.push({
      id: `buildings-${index + 1}`,
      previewId: `buildings-preview-${index + 1}`,
      count: buildings.length,
      center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
      bounds: [minX, minZ, maxX, maxZ],
    });
  });
  return districts;
}

function distanceToDistrictSquared(
  district: BuildingDetailDistrict,
  point: readonly [number, number],
): number {
  const [minX, minZ, maxX, maxZ] = district.bounds;
  const dx = Math.max(minX - point[0], 0, point[0] - maxX);
  const dz = Math.max(minZ - point[1], 0, point[1] - maxZ);
  return dx * dx + dz * dz;
}

/**
 * The exact-detail budget follows the camera across the entire source area.
 * Two local districts per one lookahead district keep the current view first
 * while preparing the route ahead. Both source-part and draw-call counts stay
 * bounded, including sparse edge districts and overlapping view/lookahead.
 */
export function selectBuildingDetailDistricts(
  districts: readonly BuildingDetailDistrict[],
  focus: readonly [number, number],
  ahead: readonly [number, number] = focus,
): string[] {
  const ordered = (point: readonly [number, number]): BuildingDetailDistrict[] =>
    districts
      .map((district, index) => ({
        district,
        index,
        distance: distanceToDistrictSquared(district, point),
      }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)
      .map(({ district }) => district);
  const priorities = [ordered(focus), ordered(ahead)];
  const cursors = [0, 0];
  const selected: string[] = [];
  const selectedIds = new Set<string>();
  let residentCount = 0;
  const take = (priority: number): boolean => {
    const candidates = priorities[priority];
    while (cursors[priority] < candidates.length) {
      const district = candidates[cursors[priority]++];
      if (
        selectedIds.has(district.id) ||
        district.count <= 0 ||
        residentCount + district.count > MOBILE_DETAIL_RESIDENT_LIMIT
      ) {
        continue;
      }
      selected.push(district.id);
      selectedIds.add(district.id);
      residentCount += district.count;
      return true;
    }
    return false;
  };
  while (selected.length < MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS) {
    const priority = selected.length % 3 === 2 ? 1 : 0;
    if (!take(priority) && !take(1 - priority)) break;
  }
  return selected;
}
