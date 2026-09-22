/**
 * Exact OSM anchor, with bounded procedural member dimensions shared by the
 * rendered Schiller monument and its navigation solids. Local +X faces east
 * across the square; unrecorded member dimensions are display reconstruction.
 */
export const SCHILLER_MONUMENT_PROFILE = {
  name: "Schiller-Denkmal",
  osmKey: "node/262457570",
  worldM: [1425.438, 5.23, 617.052],
  rotationY: 0.075,
  totalHeightM: 6.5,
  figureHeightM: 2.95,
  figureBaseYLocal: 3.55,
  baseRadiusM: 4,
  stepCount: 6,
  stepHeightM: 0.17,
  stepRadiusReductionM: 0.27,
  fenceRadiusM: 4.9,
  fenceHeightM: 1.1,
  fenceHalfThicknessM: 0.065,
  // Quiet clearance for additive props is separate from physical collision.
  protectionRadiusM: 5.1,
} as const;

const P = SCHILLER_MONUMENT_PROFILE;
const COS = Math.cos(P.rotationY);
const SIN = Math.sin(P.rotationY);

export const SCHILLER_STEP_COURSES = Array.from(
  { length: P.stepCount },
  (_, index) => ({
    radiusM: P.baseRadiusM - index * P.stepRadiusReductionM,
    bottomYLocal: index * P.stepHeightM,
    topYLocal: (index + 1) * P.stepHeightM,
  }),
);

export function schillerOctagonPoints(radiusM: number): [number, number][] {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI / 8 + index * Math.PI / 4;
    return [Math.cos(angle) * radiusM, Math.sin(angle) * radiusM];
  });
}

const FENCE_POINTS = schillerOctagonPoints(P.fenceRadiusM);

export function schillerMonumentLocal(x: number, z: number): [number, number] {
  const dx = x - P.worldM[0];
  const dz = z - P.worldM[2];
  return [COS * dx - SIN * dz, SIN * dx + COS * dz];
}

export function schillerMonumentWorld(u: number, v: number): [number, number] {
  return [P.worldM[0] + COS * u + SIN * v, P.worldM[2] - SIN * u + COS * v];
}

function insideOctagon(u: number, v: number, radiusM: number, padding: number): boolean {
  const apothem = radiusM * Math.cos(Math.PI / 8);
  for (let side = 0; side < 8; side += 1) {
    const normal = Math.PI / 4 + side * Math.PI / 4;
    if (u * Math.cos(normal) + v * Math.sin(normal) > apothem + padding) return false;
  }
  return true;
}

function segmentDistance(
  u: number,
  v: number,
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const du = b[0] - a[0];
  const dv = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / (du * du + dv * dv)));
  return Math.hypot(u - a[0] - du * t, v - a[1] - dv * t);
}

/**
 * Only finite represented solids block the visitor: six stepped octagons,
 * plinth, figure bodies and the eight fence sides. The surrounding square and
 * the air above the enclosure never become a filled protection cylinder.
 */
export function schillerMonumentSolidAt(
  x: number,
  y: number,
  z: number,
  padding = 0,
): boolean {
  if (![x, y, z, padding].every(Number.isFinite)) return false;
  const margin = Math.max(0, padding);
  const localY = y - P.worldM[1];
  if (localY < 0 || localY > P.totalHeightM) return false;
  const [u, v] = schillerMonumentLocal(x, z);
  if (Math.hypot(u, v) > P.fenceRadiusM + P.fenceHalfThicknessM + margin) return false;
  for (const course of SCHILLER_STEP_COURSES) {
    if (localY >= course.bottomYLocal && localY <= course.topYLocal &&
      insideOctagon(u, v, course.radiusM, margin)) return true;
  }
  if (localY <= P.fenceHeightM && FENCE_POINTS.some((a, index) =>
    segmentDistance(u, v, a, FENCE_POINTS[(index + 1) % FENCE_POINTS.length]) <=
      P.fenceHalfThicknessM + margin)) return true;
  if (localY >= 1.02 && localY <= 3.4 &&
    Math.abs(u) <= 1.04 + margin && Math.abs(v) <= 1.04 + margin) return true;
  if (localY >= 3.4 && localY <= 3.47 &&
    Math.abs(u) <= 1.18 + margin && Math.abs(v) <= 1.18 + margin) return true;
  if (localY >= P.figureBaseYLocal &&
    Math.abs(u) <= 0.5 + margin && Math.abs(v) <= 0.45 + margin) return true;
  if (localY >= 1.05 && localY <= 2.6) {
    for (const sideU of [-1, 1]) for (const sideV of [-1, 1]) {
      if (Math.hypot(u - sideU * 1.35, v - sideV * 1.35) <= 0.65 + margin) return true;
    }
  }
  return false;
}
