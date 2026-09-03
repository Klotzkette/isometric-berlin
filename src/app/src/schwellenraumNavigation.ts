import type {
  PedestrianEnvironment,
  PedestrianObstacle,
  PedestrianPolygonObstacle,
} from "./pedestrianNavigation";
import {
  pedestrianObstacleCellKey,
  pointInPedestrianRing,
} from "./pedestrianNavigation";

/** A compact camera body: large enough to keep the lens out of thin walls. */
export const SCHWELLENRAUM_FLIGHT_RADIUS_M = 0.62;
/** Swept collision sampling prevents fast input from skipping narrow solids. */
export const SCHWELLENRAUM_FLIGHT_STEP_M = 0.28;

export type SchwellenraumPoint = {
  x: number;
  y: number;
  z: number;
};

export type SchwellenraumFlightResult = {
  applied: SchwellenraumPoint;
  blocked: boolean;
  position: SchwellenraumPoint;
};

export type SchwellenraumFlightScratch = {
  applied: SchwellenraumPoint;
  axisOrder: [number, number, number];
  candidate: SchwellenraumPoint;
  increment: SchwellenraumPoint;
  nearbyObstacles: Set<PedestrianObstacle>;
  position: SchwellenraumPoint;
  result: SchwellenraumFlightResult;
};

export function createSchwellenraumFlightScratch(): SchwellenraumFlightScratch {
  const applied = { x: 0, y: 0, z: 0 };
  const position = { x: 0, y: 0, z: 0 };
  return {
    applied,
    axisOrder: [0, 1, 2],
    candidate: { x: 0, y: 0, z: 0 },
    increment: { x: 0, y: 0, z: 0 },
    nearbyObstacles: new Set(),
    position,
    result: { applied, blocked: false, position },
  };
}

function squaredDistanceToSegment(
  x: number,
  z: number,
  from: readonly number[],
  to: readonly number[],
): number {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const progress =
    lengthSquared > 1e-12
      ? Math.max(
          0,
          Math.min(
            1,
            ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared,
          ),
        )
      : 0;
  return (
    (x - (from[0] + dx * progress)) ** 2 + (z - (from[1] + dz * progress)) ** 2
  );
}

function squaredDistanceToRing(
  x: number,
  z: number,
  ring: ReadonlyArray<readonly number[]>,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length; index += 1) {
    nearest = Math.min(
      nearest,
      squaredDistanceToSegment(
        x,
        z,
        ring[index],
        ring[(index + 1) % ring.length],
      ),
    );
  }
  return nearest;
}

function sphereTouchesPolygon(
  point: SchwellenraumPoint,
  obstacle: PedestrianPolygonObstacle,
  radius: number,
): boolean {
  const x = point.x / obstacle.coordinateScale;
  const z = point.z / obstacle.coordinateScale;
  const radiusSquared = (radius / obstacle.coordinateScale) ** 2;
  const insideOuter = pointInPedestrianRing(x, z, obstacle.ring);
  if (
    !insideOuter &&
    squaredDistanceToRing(x, z, obstacle.ring) > radiusSquared
  ) {
    return false;
  }
  for (const hole of obstacle.holes) {
    if (
      pointInPedestrianRing(x, z, hole) &&
      squaredDistanceToRing(x, z, hole) > radiusSquared
    ) {
      return false;
    }
  }
  return true;
}

function sphereSampleSome(
  point: SchwellenraumPoint,
  radius: number,
  tester: (x: number, y: number, z: number) => boolean,
): boolean {
  return (
    tester(point.x, point.y, point.z) ||
    tester(point.x - radius, point.y, point.z) ||
    tester(point.x + radius, point.y, point.z) ||
    tester(point.x, point.y - radius, point.z) ||
    tester(point.x, point.y + radius, point.z) ||
    tester(point.x, point.y, point.z - radius) ||
    tester(point.x, point.y, point.z + radius)
  );
}

function sphereHasInteriorAccess(
  point: SchwellenraumPoint,
  radius: number,
  environment: PedestrianEnvironment,
  obstacle: PedestrianObstacle,
): boolean {
  const tester = environment.walkableInteriorAt;
  if (obstacle.kind !== "polygon" || tester === undefined) return false;
  const sourceId = obstacle.sourceId;
  return (
    tester(point.x, point.y, point.z, sourceId) &&
    tester(point.x - radius, point.y, point.z, sourceId) &&
    tester(point.x + radius, point.y, point.z, sourceId) &&
    tester(point.x, point.y - radius, point.z, sourceId) &&
    tester(point.x, point.y + radius, point.z, sourceId) &&
    tester(point.x, point.y, point.z - radius, sourceId) &&
    tester(point.x, point.y, point.z + radius, sourceId)
  );
}

function sphereTouchesProtectedVolume(
  point: SchwellenraumPoint,
  radius: number,
  environment: PedestrianEnvironment,
): boolean {
  const tester = environment.protectedVolumeAt;
  return tester !== undefined && sphereSampleSome(point, radius, tester);
}

function nearbyObstacles(
  point: SchwellenraumPoint,
  radius: number,
  environment: PedestrianEnvironment,
  output?: Set<PedestrianObstacle>,
): Set<PedestrianObstacle> {
  const obstacles = environment.obstacles;
  const nearby = output ?? new Set<PedestrianObstacle>();
  nearby.clear();
  if (!obstacles) {
    return nearby;
  }
  const minXIndex = Math.floor((point.x - radius) / obstacles.cellSizeM);
  const maxXIndex = Math.floor((point.x + radius) / obstacles.cellSizeM);
  const minZIndex = Math.floor((point.z - radius) / obstacles.cellSizeM);
  const maxZIndex = Math.floor((point.z + radius) / obstacles.cellSizeM);
  for (let zIndex = minZIndex; zIndex <= maxZIndex; zIndex += 1) {
    for (let xIndex = minXIndex; xIndex <= maxXIndex; xIndex += 1) {
      const key = pedestrianObstacleCellKey(xIndex, zIndex);
      const cellObstacles = obstacles.cells.get(key);
      if (!cellObstacles) continue;
      for (const obstacle of cellObstacles) {
        nearby.add(obstacle);
      }
    }
  }
  return nearby;
}

/**
 * Tests the complete flying camera sphere against terrain and the same metric
 * buildings, trees, lights, walls and fixtures used by the walking mode.
 */
export function schwellenraumFlightPointIsBlocked(
  point: SchwellenraumPoint,
  environment: PedestrianEnvironment,
  radius = SCHWELLENRAUM_FLIGHT_RADIUS_M,
  nearbyObstacleScratch?: Set<PedestrianObstacle>,
): boolean {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(point.z) ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    point.x - radius < environment.bounds.minX ||
    point.x + radius > environment.bounds.maxX ||
    point.z - radius < environment.bounds.minZ ||
    point.z + radius > environment.bounds.maxZ
  ) {
    return true;
  }
  if (sphereTouchesProtectedVolume(point, radius, environment)) {
    return true;
  }
  if (environment.interiorSolidAt?.(point.x, point.y, point.z, radius)) {
    return true;
  }
  const groundY = environment.groundAt(point.x, point.z);
  if (groundY === null || point.y - radius < groundY) {
    return true;
  }
  const interiorFloorY = environment.interiorGroundAt?.(
    point.x,
    point.z,
    point.y,
  );
  // Authored floors are two-sided collision planes for flight. Walking uses
  // the same sampler as its supporting ground, so this never turns a ramp or
  // stair into a pedestrian obstacle.
  if (
    typeof interiorFloorY === "number" &&
    Number.isFinite(interiorFloorY) &&
    Math.abs(point.y - interiorFloorY) <= radius + 0.08
  ) {
    return true;
  }
  for (const obstacle of nearbyObstacles(
    point,
    radius,
    environment,
    nearbyObstacleScratch,
  )) {
    if (
      point.y + radius <= obstacle.minY + 0.02 ||
      point.y - radius >= obstacle.maxY - 0.02 ||
      point.x + radius < obstacle.minX ||
      point.x - radius > obstacle.maxX ||
      point.z + radius < obstacle.minZ ||
      point.z - radius > obstacle.maxZ
    ) {
      continue;
    }
    let touches = false;
    if (obstacle.kind === "circle") {
      const combinedRadius = obstacle.radius + radius;
      touches =
        (point.x - obstacle.x) ** 2 + (point.z - obstacle.z) ** 2 <=
        combinedRadius * combinedRadius;
    } else if (obstacle.kind === "segment") {
      const combinedRadius = obstacle.radius + radius;
      touches =
        squaredDistanceToSegment(
          point.x,
          point.z,
          obstacle.from,
          obstacle.to,
        ) <=
        combinedRadius * combinedRadius;
    } else {
      touches = sphereTouchesPolygon(point, obstacle, radius);
    }
    if (
      touches &&
      !sphereHasInteriorAccess(point, radius, environment, obstacle)
    ) {
      return true;
    }
  }
  return false;
}

function flightAxisAmount(point: SchwellenraumPoint, axis: number): number {
  return axis === 0 ? point.x : axis === 1 ? point.y : point.z;
}

/**
 * Applies a swept 3D translation with facade/roof sliding. Each substep tests
 * the full diagonal first, then independent axes; fast flight therefore cannot
 * jump across a thin facade and a glancing approach does not feel sticky.
 */
export function resolveSchwellenraumFlightTranslation(
  start: SchwellenraumPoint,
  requested: SchwellenraumPoint,
  environment: PedestrianEnvironment,
  radius = SCHWELLENRAUM_FLIGHT_RADIUS_M,
  scratch?: SchwellenraumFlightScratch,
): SchwellenraumFlightResult {
  const state = scratch ?? createSchwellenraumFlightScratch();
  const { applied, axisOrder, candidate, increment, position, result } = state;
  position.x = start.x;
  position.y = start.y;
  position.z = start.z;
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(start.z) ||
    !Number.isFinite(requested.x) ||
    !Number.isFinite(requested.y) ||
    !Number.isFinite(requested.z)
  ) {
    applied.x = 0;
    applied.y = 0;
    applied.z = 0;
    result.blocked = true;
    return result;
  }
  const length = Math.hypot(requested.x, requested.y, requested.z);
  if (length <= 1e-9) {
    applied.x = 0;
    applied.y = 0;
    applied.z = 0;
    result.blocked = false;
    return result;
  }
  const steps = Math.max(1, Math.ceil(length / SCHWELLENRAUM_FLIGHT_STEP_M));
  increment.x = requested.x / steps;
  increment.y = requested.y / steps;
  increment.z = requested.z / steps;
  let blocked = false;
  for (let step = 0; step < steps; step += 1) {
    candidate.x = position.x + increment.x;
    candidate.y = position.y + increment.y;
    candidate.z = position.z + increment.z;
    if (
      !schwellenraumFlightPointIsBlocked(
        candidate,
        environment,
        radius,
        state.nearbyObstacles,
      )
    ) {
      position.x = candidate.x;
      position.y = candidate.y;
      position.z = candidate.z;
      continue;
    }
    blocked = true;
    axisOrder[0] = 0;
    axisOrder[1] = 1;
    axisOrder[2] = 2;
    for (let index = 1; index < axisOrder.length; index += 1) {
      const axis = axisOrder[index];
      let positionIndex = index;
      while (
        positionIndex > 0 &&
        Math.abs(flightAxisAmount(increment, axisOrder[positionIndex - 1])) <
          Math.abs(flightAxisAmount(increment, axis))
      ) {
        axisOrder[positionIndex] = axisOrder[positionIndex - 1];
        positionIndex -= 1;
      }
      axisOrder[positionIndex] = axis;
    }
    let advanced = false;
    for (const axis of axisOrder) {
      const amount = flightAxisAmount(increment, axis);
      if (Math.abs(amount) <= 1e-12) {
        continue;
      }
      candidate.x = position.x + (axis === 0 ? amount : 0);
      candidate.y = position.y + (axis === 1 ? amount : 0);
      candidate.z = position.z + (axis === 2 ? amount : 0);
      if (
        !schwellenraumFlightPointIsBlocked(
          candidate,
          environment,
          radius,
          state.nearbyObstacles,
        )
      ) {
        position.x = candidate.x;
        position.y = candidate.y;
        position.z = candidate.z;
        advanced = true;
      }
    }
    if (!advanced) {
      break;
    }
  }
  applied.x = position.x - start.x;
  applied.y = position.y - start.y;
  applied.z = position.z - start.z;
  result.blocked = blocked;
  return result;
}
