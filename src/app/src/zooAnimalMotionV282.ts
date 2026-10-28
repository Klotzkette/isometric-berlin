/** Shared pose math only: no renderer, mode-specific geometry or second loop. */
export const ZOO_ANIMAL_FRAME_INTERVAL_MS_V282 = 100;
export const ZOO_ANIMAL_MAX_DELTA_SECONDS_V282 = 0.1;
export const ZOO_ANIMAL_MAX_BOB_M_V282 = 0.04;
const MAX_ROUTE_POINTS = 64;

export interface ZooAnimalClockV282 {
  elapsedSeconds: number;
  lastTimestampMs: number | null;
  lastPaintTimestampMs: number | null;
}

export interface ZooAnimalRouteDefinitionV282 {
  readonly animalId: string;
  readonly siteId: string;
  /** Metre coordinates, implicitly closed; do not repeat the first point. */
  readonly routeXZ: readonly (readonly [number, number])[];
  /** Illustrative metres per second, strictly positive. */
  readonly speed: number;
  /** Fraction of a complete route; finite values wrap into [0, 1). */
  readonly phase: number;
  readonly groundY: number;
}

interface SegmentV282 {
  readonly x: number;
  readonly z: number;
  readonly dx: number;
  readonly dz: number;
  readonly length: number;
  readonly startDistance: number;
  readonly endDistance: number;
  readonly quarterTurn: 0 | 1 | 2 | 3;
}

export interface ZooAnimalRouteV282 extends ZooAnimalRouteDefinitionV282 {
  readonly segments: readonly SegmentV282[];
  readonly length: number;
  readonly periodSeconds: number;
  readonly strideCount: number;
}

export interface ZooAnimalPoseV282 {
  x: number;
  y: number;
  z: number;
  /** A +X-facing body uses THREE Y turns: +X=0, -Z=1, -X=2, +Z=3. */
  quarterTurn: 0 | 1 | 2 | 3;
  /** Bounded [-1, 1] phase for independent legs, wings or tail cues. */
  gait: number;
}

export function createZooAnimalClockV282(): ZooAnimalClockV282 {
  return { elapsedSeconds: 0, lastTimestampMs: null, lastPaintTimestampMs: null };
}

/**
 * Advance once per zoo in the existing viewer loop, independent of the active
 * drawn/native family. `active` already includes visibility, reduced motion,
 * page/context state and the caller's frustum/distance checks. Presentation is
 * due on first entry/resume, then at most 10 Hz. Pauses never accrue catch-up.
 */
export function advanceZooAnimalClockV282(
  clock: ZooAnimalClockV282, timestampMs: number, active: boolean,
): boolean {
  if (!active || !Number.isFinite(timestampMs)) {
    clock.lastTimestampMs = null;
    clock.lastPaintTimestampMs = null;
    return false;
  }
  if (clock.lastTimestampMs === null) {
    clock.lastTimestampMs = timestampMs;
    clock.lastPaintTimestampMs = timestampMs;
    return true;
  }
  const deltaMs = timestampMs - clock.lastTimestampMs;
  clock.lastTimestampMs = timestampMs;
  if (deltaMs < 0) {
    // A restarted/rewound timestamp source must not stall the paint deadline.
    clock.lastPaintTimestampMs = timestampMs;
    return false;
  }
  clock.elapsedSeconds += Math.min(ZOO_ANIMAL_MAX_DELTA_SECONDS_V282, deltaMs / 1000);
  if (clock.lastPaintTimestampMs !== null &&
      timestampMs - clock.lastPaintTimestampMs < ZOO_ANIMAL_FRAME_INTERVAL_MS_V282) return false;
  clock.lastPaintTimestampMs = timestampMs;
  return true;
}

/**
 * Validate and copy once at construction. Enclosure/obstacle clearance belongs
 * to the source-bound placement owner, not this renderer-independent sampler.
 * Two points describe back-and-forth pacing; longer routes must also close on
 * a cardinal segment. No per-frame route validation, arrays or object creation.
 */
export function prepareZooAnimalRouteV282(
  definition: ZooAnimalRouteDefinitionV282,
): ZooAnimalRouteV282 {
  if (typeof definition.animalId !== "string" || !definition.animalId.trim() ||
      typeof definition.siteId !== "string" || !definition.siteId.trim() ||
      !Number.isFinite(definition.speed) || definition.speed <= 0 ||
      !Number.isFinite(definition.phase) || !Number.isFinite(definition.groundY) ||
      !Array.isArray(definition.routeXZ) || definition.routeXZ.length < 2 ||
      definition.routeXZ.length > MAX_ROUTE_POINTS) {
    throw new Error("Invalid zoo animal route identity, speed or coordinates");
  }
  const points: (readonly [number, number])[] = [];
  for (const point of definition.routeXZ) {
    if (!Array.isArray(point) || point.length !== 2 ||
        !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      throw new Error("Zoo animal route coordinates must be finite X/Z pairs");
    }
    points.push(Object.freeze([point[0], point[1]] as [number, number]));
  }
  const segments: SegmentV282[] = [];
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const segmentLength = Math.abs(dx) + Math.abs(dz);
    if (!Number.isFinite(segmentLength) || segmentLength <= 0 || (dx !== 0 && dz !== 0)) {
      throw new Error("Zoo animal routes require nonzero cardinal segments, including closure");
    }
    const endDistance = length + segmentLength;
    if (!Number.isFinite(endDistance)) throw new Error("Zoo animal route length is not finite");
    segments.push(Object.freeze({ x: a[0], z: a[1], dx, dz, length: segmentLength,
      startDistance: length, endDistance,
      quarterTurn: dx > 0 ? 0 : dz < 0 ? 1 : dx < 0 ? 2 : 3 }));
    length = endDistance;
  }
  const periodSeconds = length / definition.speed;
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) {
    throw new Error("Zoo animal route period must be finite and positive");
  }
  const phase = definition.phase % 1;
  return Object.freeze({ animalId: definition.animalId, siteId: definition.siteId,
    routeXZ: Object.freeze(points), speed: definition.speed,
    phase: phase < 0 ? phase + 1 : phase === 0 ? 0 : phase, groundY: definition.groundY,
    segments: Object.freeze(segments), length, periodSeconds,
    strideCount: Math.max(1, Math.round(length / 1.2)) });
}

/** Sample into the caller-owned output; the same input yields both families' pose. */
export function sampleZooAnimalPoseV282(
  animal: ZooAnimalRouteV282, elapsedSeconds: number, output: ZooAnimalPoseV282,
): ZooAnimalPoseV282 {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error("Zoo animal elapsed time must be finite and nonnegative");
  }
  // Reduce time before multiplication so even a large finite time cannot
  // overflow distance. A whole number of strides also closes the gait seam.
  const cycle = ((elapsedSeconds % animal.periodSeconds) / animal.periodSeconds + animal.phase) % 1;
  const distance = cycle * animal.length;
  let segment = animal.segments[animal.segments.length - 1];
  for (let i = 0; i < animal.segments.length; i++) {
    if (distance < animal.segments[i].endDistance) { segment = animal.segments[i]; break; }
  }
  const along = Math.max(0, Math.min(1, (distance - segment.startDistance) / segment.length));
  output.x = segment.x + segment.dx * along;
  output.z = segment.z + segment.dz * along;
  output.quarterTurn = segment.quarterTurn;
  output.gait = Math.sin(((cycle * animal.strideCount) % 1) * Math.PI * 2);
  output.y = animal.groundY + Math.abs(output.gait) * ZOO_ANIMAL_MAX_BOB_M_V282;
  return output;
}
