import { MathUtils, Vector3 } from "three";

import { RAMP_LENGTH_M, TUNNEL_SURFACE_Y } from "./TunnelPortals";

export type TunnelFlightDirection = "north-to-south" | "south-to-north";

export type TunnelFlightPlan = {
  cumulativeM: number[];
  direction: TunnelFlightDirection;
  durationMs: number;
  entryPortalM: number;
  exitPortalM: number;
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
// The surface portal centreline is the ramp deck centre. This puts the camera
// about 1.35 m above the 0.4 m-thick carriageway rendered by TunnelPortals.
const CAMERA_EYE_ABOVE_RAMP_CENTRE_M = 1.55;
// The committed terrain samples run around 5.2 m above the world datum. The
// portal deck itself is lower because it sits in an open cutting, but the
// guided flight must begin and end above the uncut terrain shell.
export const TUNNEL_EXTERIOR_EYE_Y = 5.2 + CAMERA_EYE_ABOVE_RAMP_CENTRE_M;
const LOOK_AHEAD_M = 34;
const ENTRY_FRAMING_LOOK_AHEAD_M = 64;
const MIN_SEGMENT_M = 1e-4;
const MAX_MITER_RATIO = 1.35;

type ProfiledRoute = {
  entryPortalIndex: number;
  exitPortalIndex: number;
  points: Vector3[];
};

function horizontalDistance(first: Vector3, second: Vector3): number {
  return Math.hypot(second.x - first.x, second.z - first.z);
}

function portalExtension(first: Vector3, second: Vector3): Vector3 {
  const outward = first.clone().sub(second);
  outward.y = 0;
  if (outward.lengthSq() < 1e-6) {
    outward.set(0, 0, -1);
  }
  const extension = first
    .clone()
    .add(outward.normalize().multiplyScalar(PORTAL_APPROACH_M));
  extension.y = TUNNEL_EXTERIOR_EYE_Y;
  return extension;
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

function horizontalCumulativeDistances(points: Vector3[]): number[] {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(
      distances[index - 1] +
        horizontalDistance(points[index - 1], points[index]),
    );
  }
  return distances;
}

function pointAtHorizontalDistance(
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

function rightNormal(first: Vector3, second: Vector3): Vector3 {
  const dx = second.x - first.x;
  const dz = second.z - first.z;
  const length = Math.hypot(dx, dz) || 1;
  return new Vector3(-dz / length, 0, dx / length);
}

/** Offset a polyline into its right-hand tube with bounded corner mitres. */
function shiftIntoTravelTube(
  points: Vector3[],
  tubeCentreOffsetM: number,
): Vector3[] {
  const segmentNormals = points
    .slice(0, -1)
    .map((point, index) => rightNormal(point, points[index + 1]));
  return points.map((point, index) => {
    if (index === 0) {
      return point
        .clone()
        .addScaledVector(segmentNormals[0], tubeCentreOffsetM);
    }
    if (index === points.length - 1) {
      return point
        .clone()
        .addScaledVector(segmentNormals.at(-1)!, tubeCentreOffsetM);
    }
    const incoming = segmentNormals[index - 1];
    const outgoing = segmentNormals[index];
    const miter = incoming.clone().add(outgoing);
    if (miter.lengthSq() < 1e-6) {
      return point.clone().addScaledVector(outgoing, tubeCentreOffsetM);
    }
    miter.normalize();
    const projection = miter.dot(outgoing);
    if (projection <= 0.1) {
      return point.clone().addScaledVector(outgoing, tubeCentreOffsetM);
    }
    const miterLength = Math.min(
      tubeCentreOffsetM / projection,
      tubeCentreOffsetM * MAX_MITER_RATIO,
    );
    return point.clone().addScaledVector(miter, miterLength);
  });
}

function profilePortalRamps(points: Vector3[]): ProfiledRoute {
  const sourceCumulativeM = horizontalCumulativeDistances(points);
  const totalM = sourceCumulativeM[sourceCumulativeM.length - 1];
  // Short synthetic routes remain usable without letting their ramps cross.
  // The committed Tiergartentunnel is long enough to use the full 260 m.
  const rampLengthM = Math.min(RAMP_LENGTH_M, totalM * 0.45);
  const entryPortalAtM = rampLengthM;
  const exitPortalAtM = totalM - rampLengthM;
  const sampleDistances = [...sourceCumulativeM, entryPortalAtM, exitPortalAtM]
    .sort((first, second) => first - second)
    .filter(
      (distance, index, distances) =>
        index === 0 || Math.abs(distance - distances[index - 1]) > 1e-6,
    );
  const surfaceEyeY = TUNNEL_SURFACE_Y + CAMERA_EYE_ABOVE_RAMP_CENTRE_M;
  const profiled = sampleDistances.map((distanceM) => {
    const point = pointAtHorizontalDistance(
      points,
      sourceCumulativeM,
      distanceM,
    );
    const boreEyeY = point.y + CAMERA_EYE_FROM_TUBE_CENTRE_M;
    if (distanceM <= entryPortalAtM) {
      point.y = MathUtils.lerp(
        surfaceEyeY,
        boreEyeY,
        distanceM / (entryPortalAtM || 1),
      );
    } else if (distanceM >= exitPortalAtM) {
      point.y = MathUtils.lerp(
        boreEyeY,
        surfaceEyeY,
        (distanceM - exitPortalAtM) / (rampLengthM || 1),
      );
    } else {
      point.y = boreEyeY;
    }
    return point;
  });
  return {
    entryPortalIndex: sampleDistances.findIndex(
      (distance) => Math.abs(distance - entryPortalAtM) < 1e-6,
    ),
    exitPortalIndex: sampleDistances.findIndex(
      (distance) => Math.abs(distance - exitPortalAtM) < 1e-6,
    ),
    points: profiled,
  };
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

function targetAt(
  points: Vector3[],
  cumulativeM: number[],
  distanceM: number,
): Vector3 {
  const totalM = cumulativeM[cumulativeM.length - 1];
  if (distanceM <= totalM) {
    return positionAt(points, cumulativeM, distanceM);
  }
  const end = points[points.length - 1];
  const before = points[points.length - 2];
  const forward = end.clone().sub(before).normalize();
  return end.clone().addScaledVector(forward, distanceM - totalM);
}

export function createTunnelFlightPlan(
  sourcePoints: Array<[number, number, number]>,
  direction: TunnelFlightDirection,
  tubeCentreOffsetM = 6.1,
): TunnelFlightPlan {
  if (
    sourcePoints.length < 2 ||
    !Number.isFinite(tubeCentreOffsetM) ||
    tubeCentreOffsetM <= 0 ||
    sourcePoints.some((point) => point.some((value) => !Number.isFinite(value)))
  ) {
    throw new Error("A tunnel flight needs a finite route and tube offset");
  }
  const centreline = sourcePoints.map((point) => new Vector3(...point));
  const ordered =
    direction === "north-to-south" ? centreline : [...centreline].reverse();
  const usable = ordered.filter(
    (point, index) =>
      index === 0 ||
      horizontalDistance(ordered[index - 1], point) > MIN_SEGMENT_M,
  );
  if (usable.length < 2) {
    throw new Error("A tunnel flight needs two distinct plan positions");
  }

  const profiled = profilePortalRamps(usable);
  const travelTube = shiftIntoTravelTube(profiled.points, tubeCentreOffsetM);
  const points = [
    portalExtension(travelTube[0], travelTube[1]),
    ...travelTube,
    portalExtension(
      travelTube[travelTube.length - 1],
      travelTube[travelTube.length - 2],
    ),
  ];
  const cumulativeM = cumulativeDistances(points);
  const totalM = cumulativeM[cumulativeM.length - 1];
  return {
    cumulativeM,
    direction,
    durationMs: MathUtils.clamp((totalM / 42) * 1_000, 18_000, 58_000),
    entryPortalM: cumulativeM[profiled.entryPortalIndex + 1],
    exitPortalM: cumulativeM[profiled.exitPortalIndex + 1],
    points,
    totalM,
  };
}

export function tunnelFlightPose(
  plan: TunnelFlightPlan,
  elapsedMs: number,
): TunnelFlightPose {
  const raw = MathUtils.clamp(elapsedMs / plan.durationMs, 0, 1);
  // Join the short acceleration and braking curves to the constant-speed
  // bore section with matching derivatives. MathUtils.smoothstep ends with a
  // zero derivative and caused a small speed snap at both joins.
  const edge = 0.055;
  const easeIntoLinear = (value: number) => value * value * (2 - value);
  const progress =
    raw < edge
      ? edge * easeIntoLinear(raw / edge)
      : raw > 1 - edge
        ? 1 - edge * easeIntoLinear((1 - raw) / edge)
        : raw;
  const distance = progress * plan.totalM;
  const position = positionAt(plan.points, plan.cumulativeM, distance);
  // From the exterior stand, look past the ramp lip instead of at empty road
  // immediately in front of the camera. Blend back to the normal bore lead as
  // the vehicle descends, keeping the transition free of a camera snap.
  const entryBlend = MathUtils.clamp(distance / plan.entryPortalM, 0, 1);
  const lookAheadM = MathUtils.lerp(
    ENTRY_FRAMING_LOOK_AHEAD_M,
    LOOK_AHEAD_M,
    MathUtils.smoothstep(entryBlend, 0, 1),
  );
  const target = targetAt(
    plan.points,
    plan.cumulativeM,
    distance + lookAheadM,
  );
  return { done: raw >= 1, position, progress: raw, target };
}
