import { MathUtils, Vector3 } from "three";

export type TunnelFlightDirection = "north-to-south" | "south-to-north";

export type TunnelFlightPlan = {
  cumulativeM: number[];
  direction: TunnelFlightDirection;
  durationMs: number;
  points: Vector3[];
  totalM: number;
};

export type TunnelFlightPose = {
  done: boolean;
  position: Vector3;
  progress: number;
  target: Vector3;
};

const PORTAL_APPROACH_M = 46;
// The payload line follows the tube centre, not the carriageway. A driver's
// eye is roughly 0.8 m below that centre in the 5 m clear-height bore.
const CAMERA_EYE_FROM_TUBE_CENTRE_M = -0.8;
const LOOK_AHEAD_M = 28;

function portalExtension(first: Vector3, second: Vector3): Vector3 {
  const outward = first.clone().sub(second);
  outward.y = 0;
  if (outward.lengthSq() < 1e-6) {
    outward.set(0, 0, -1);
  }
  return first
    .clone()
    .add(outward.normalize().multiplyScalar(PORTAL_APPROACH_M))
    .setY(3.2);
}

function cumulativeDistances(points: Vector3[]): number[] {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(
      distances[index - 1] + points[index].distanceTo(points[index - 1]),
    );
  }
  return distances;
}

function shiftIntoTravelTube(
  points: Vector3[],
  tubeCentreOffsetM: number,
): Vector3[] {
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const tangent = after.clone().sub(before);
    const length = Math.hypot(tangent.x, tangent.z) || 1;
    // Right-hand traffic: this normal points to the right of the current
    // travel direction, so reversing the route selects the opposite tube.
    const right = new Vector3(-tangent.z / length, 0, tangent.x / length);
    return point.clone().addScaledVector(right, tubeCentreOffsetM);
  });
}

function positionAt(
  points: Vector3[],
  cumulativeM: number[],
  distanceM: number,
): Vector3 {
  const total = cumulativeM[cumulativeM.length - 1];
  const distance = MathUtils.clamp(distanceM, 0, total);
  let upper = 1;
  while (upper < cumulativeM.length && cumulativeM[upper] < distance) {
    upper += 1;
  }
  upper = Math.min(upper, cumulativeM.length - 1);
  const lower = upper - 1;
  const span = cumulativeM[upper] - cumulativeM[lower];
  const t = span > 1e-6 ? (distance - cumulativeM[lower]) / span : 0;
  return points[lower].clone().lerp(points[upper], t);
}

export function createTunnelFlightPlan(
  sourcePoints: Array<[number, number, number]>,
  direction: TunnelFlightDirection,
  tubeCentreOffsetM = 6.1,
): TunnelFlightPlan {
  if (sourcePoints.length < 2) {
    throw new Error("A tunnel flight needs at least two centreline points");
  }
  const centreline = sourcePoints.map((point) => new Vector3(...point));
  const ordered =
    direction === "north-to-south" ? centreline : [...centreline].reverse();
  const travelTube = shiftIntoTravelTube(ordered, tubeCentreOffsetM);
  const extended = [
    portalExtension(travelTube[0], travelTube[1]),
    ...travelTube,
    portalExtension(
      travelTube[travelTube.length - 1],
      travelTube[travelTube.length - 2],
    ),
  ];
  const points = extended;
  const cumulativeM = cumulativeDistances(points);
  const totalM = cumulativeM[cumulativeM.length - 1];
  return {
    cumulativeM,
    direction,
    durationMs: MathUtils.clamp((totalM / 42) * 1_000, 18_000, 58_000),
    points,
    totalM,
  };
}

export function tunnelFlightPose(
  plan: TunnelFlightPlan,
  elapsedMs: number,
): TunnelFlightPose {
  const raw = MathUtils.clamp(elapsedMs / plan.durationMs, 0, 1);
  // Short ease-in/out, almost constant speed for the long bore itself.
  const edge = 0.055;
  const progress =
    raw < edge
      ? edge * MathUtils.smoothstep(raw / edge, 0, 1)
      : raw > 1 - edge
        ? 1 - edge + edge * MathUtils.smoothstep((raw - 1 + edge) / edge, 0, 1)
        : raw;
  const distance = progress * plan.totalM;
  const position = positionAt(plan.points, plan.cumulativeM, distance);
  position.y += CAMERA_EYE_FROM_TUBE_CENTRE_M;
  const target = positionAt(
    plan.points,
    plan.cumulativeM,
    Math.min(plan.totalM, distance + LOOK_AHEAD_M),
  );
  target.y += CAMERA_EYE_FROM_TUBE_CENTRE_M * 0.92;
  return { done: raw >= 1, position, progress: raw, target };
}
