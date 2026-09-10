import type { PrismBuilding } from "./IsometricCityWorld";
import { Vector3, type PerspectiveCamera } from "three";

export const MOBILE_DETAIL_BATCH_SIZE = 240;
export const MOBILE_DETAIL_RESIDENT_LIMIT = 3_600;
export const MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS = Math.floor(
  MOBILE_DETAIL_RESIDENT_LIMIT / MOBILE_DETAIL_BATCH_SIZE,
);
export const MOBILE_DETAIL_VIEW_REACH_M = 2_400;
export const MOBILE_DETAIL_RETAIN_DISTANCE_M = 120;

type GroundPoint = readonly [number, number];

export type BuildingDetailSelectionOptions = {
  readonly viewPoints?: readonly GroundPoint[];
  /** Attached, cached and still-requested districts may all retain priority. */
  readonly retainedIds?: readonly string[];
};

const DETAIL_VIEW_SAMPLES = [
  [0, 0.78], [-0.78, 0.60], [0.78, 0.60], [-0.65, 0], [0.65, 0],
] as const;

/**
 * Ground positions distributed across the actual lens and viewport. Upper
 * rays that pass above the horizon keep their horizontal direction, bounded
 * to the same preparation reach; they must not send work towards infinity.
 */
export function buildingDetailViewPoints(
  camera: PerspectiveCamera,
  focus: { readonly x: number; readonly y: number; readonly z: number },
): readonly GroundPoint[] {
  camera.updateMatrixWorld();
  const points: GroundPoint[] = [];
  const direction = new Vector3();
  const point = new Vector3();
  // Pedestrian focus is the eye itself. A plane just below it supplies a
  // useful ground projection instead of making every ray stop at its origin.
  const eyeFocus = Math.hypot(
    camera.position.x - focus.x,
    camera.position.y - focus.y,
    camera.position.z - focus.z,
  ) < 0.01;
  const planeY = focus.y - (eyeFocus ? 1.7 : 0);
  for (const [x, y] of DETAIL_VIEW_SAMPLES) {
    direction.set(x, y, 0.5).unproject(camera).sub(camera.position);
    const amount = (planeY - camera.position.y) / direction.y;
    if (Number.isFinite(amount) && amount > 0) {
      point.copy(camera.position).addScaledVector(direction, amount);
    } else {
      const horizontalLength = Math.hypot(direction.x, direction.z);
      const reach = horizontalLength > 1e-8
        ? MOBILE_DETAIL_VIEW_REACH_M / horizontalLength : 0;
      point.set(focus.x + direction.x * reach, planeY, focus.z + direction.z * reach);
    }
    const dx = point.x - focus.x;
    const dz = point.z - focus.z;
    const distance = Math.hypot(dx, dz);
    const scale = distance > MOBILE_DETAIL_VIEW_REACH_M
      ? MOBILE_DETAIL_VIEW_REACH_M / distance : 1;
    points.push(Number.isFinite(distance)
      ? [focus.x + dx * scale, focus.z + dz * scale]
      : [focus.x, focus.z]);
  }
  return points;
}

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
 * With a camera projection, three local districts protect the current
 * neighbourhood, nine view selections prepare the visible horizon and three
 * lookahead selections prepare travel. Source-only callers retain the original
 * two-local/one-lookahead ordering. Both source-part and draw-call counts stay
 * bounded, including sparse edge districts and overlapping priorities.
 */
export function selectBuildingDetailDistricts(
  districts: readonly BuildingDetailDistrict[],
  focus: readonly [number, number],
  ahead: readonly [number, number] = focus,
  options: BuildingDetailSelectionOptions = {},
): string[] {
  const retained = new Set(options.retainedIds);
  const ordered = (point: GroundPoint, preferRetained = true): BuildingDetailDistrict[] =>
    districts
      .map((district, index) => ({
        district,
        index,
        distance: Math.max(0, Math.sqrt(distanceToDistrictSquared(district, point)) -
          (preferRetained && retained.has(district.id) ? MOBILE_DETAIL_RETAIN_DISTANCE_M : 0)),
      }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)
      .map(({ district }) => district);
  const viewPoints = options.viewPoints?.filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z)) ?? [];
  const viewAware = viewPoints.length > 0;
  const priorities = viewAware
    ? [ordered(focus, false), ordered(focus), ordered(ahead), ...viewPoints.map((point) => ordered(point))]
    : [ordered(focus), ordered(ahead)];
  const cursors = priorities.map(() => 0);
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
  if (viewAware) {
    // Keep the current neighbourhood first, then spread the remaining work
    // over nine lens samples and three route-ahead selections. Reusing the
    // sample order makes slight orbit/position changes deterministic.
    take(0);
    take(1);
    take(1);
    let viewIndex = 0;
    for (let slot = 0; slot < 12 && selected.length < MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS; slot++) {
      const priority = slot % 4 === 3 ? 2 : 3 + (viewIndex++ % viewPoints.length);
      if (!take(priority)) take(1);
    }
    return selected;
  }
  while (selected.length < MOBILE_DETAIL_MAX_RESIDENT_DISTRICTS) {
    const priority = selected.length % 3 === 2 ? 1 : 0;
    if (!take(priority) && !take(1 - priority)) break;
  }
  return selected;
}
