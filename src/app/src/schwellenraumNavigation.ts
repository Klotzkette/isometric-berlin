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
    (x - (from[0] + dx * progress)) ** 2 +
    (z - (from[1] + dz * progress)) ** 2
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

function sampledSpherePoints(
  point: SchwellenraumPoint,
  radius: number,
): SchwellenraumPoint[] {
  return [
    point,
    { x: point.x - radius, y: point.y, z: point.z },
    { x: point.x + radius, y: point.y, z: point.z },
    { x: point.x, y: point.y - radius, z: point.z },
    { x: point.x, y: point.y + radius, z: point.z },
    { x: point.x, y: point.y, z: point.z - radius },
    { x: point.x, y: point.y, z: point.z + radius },
  ];
}

function sphereHasInteriorAccess(
  point: SchwellenraumPoint,
  radius: number,
  environment: PedestrianEnvironment,
  obstacle: PedestrianObstacle,
): boolean {
  const tester = environment.walkableInteriorAt;
  return (
    obstacle.kind === "polygon" &&
    tester !== undefined &&
    sampledSpherePoints(point, radius).every((sample) =>
      tester(sample.x, sample.y, sample.z, obstacle.sourceId),
    )
  );
}

function sphereTouchesProtectedVolume(
  point: SchwellenraumPoint,
  radius: number,
  environment: PedestrianEnvironment,
): boolean {
  const tester = environment.protectedVolumeAt;
  return (
    tester !== undefined &&
    sampledSpherePoints(point, radius).some((sample) =>
      tester(sample.x, sample.y, sample.z),
    )
  );
}

function nearbyObstacles(
  point: SchwellenraumPoint,
  radius: number,
  environment: PedestrianEnvironment,
): Set<PedestrianObstacle> {
  const obstacles = environment.obstacles;
  const nearby = new Set<PedestrianObstacle>();
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
      for (const obstacle of obstacles.cells.get(key) ?? []) {
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
): boolean {
  if (
    ![point.x, point.y, point.z, radius].every(Number.isFinite) ||
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
  for (const obstacle of nearbyObstacles(point, radius, environment)) {
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

function add(
  point: SchwellenraumPoint,
  delta: SchwellenraumPoint,
): SchwellenraumPoint {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
    z: point.z + delta.z,
  };
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
): SchwellenraumFlightResult {
  if (
    ![start.x, start.y, start.z, requested.x, requested.y, requested.z].every(
      Number.isFinite,
    )
  ) {
    return {
      applied: { x: 0, y: 0, z: 0 },
      blocked: true,
      position: { ...start },
    };
  }
  const length = Math.hypot(requested.x, requested.y, requested.z);
  if (length <= 1e-9) {
    return {
      applied: { x: 0, y: 0, z: 0 },
      blocked: false,
      position: { ...start },
    };
  }
  const steps = Math.max(1, Math.ceil(length / SCHWELLENRAUM_FLIGHT_STEP_M));
  const increment = {
    x: requested.x / steps,
    y: requested.y / steps,
    z: requested.z / steps,
  };
  let position = { ...start };
  let blocked = false;
  for (let step = 0; step < steps; step += 1) {
    const full = add(position, increment);
    if (!schwellenraumFlightPointIsBlocked(full, environment, radius)) {
      position = full;
      continue;
    }
    blocked = true;
    const axes: Array<readonly ["x" | "y" | "z", number]> = [
      ["x", increment.x],
      ["y", increment.y],
      ["z", increment.z],
    ];
    axes.sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
    let advanced = false;
    for (const [axis, amount] of axes) {
      if (Math.abs(amount) <= 1e-12) {
        continue;
      }
      const axisDelta = { x: 0, y: 0, z: 0 };
      axisDelta[axis] = amount;
      const candidate = add(position, axisDelta);
      if (!schwellenraumFlightPointIsBlocked(candidate, environment, radius)) {
        position = candidate;
        advanced = true;
      }
    }
    if (!advanced) {
      break;
    }
  }
  const applied = {
    x: position.x - start.x,
    y: position.y - start.y,
    z: position.z - start.z,
  };
  return { applied, blocked, position };
}
