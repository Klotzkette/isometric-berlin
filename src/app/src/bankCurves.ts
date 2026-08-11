/**
 * Curve subdivision for the OSM surface rings.
 *
 * The exported polygons are true OSM geometry, but OSM traces a river bank
 * with a vertex every ten to twenty metres, so drawing the ring edge for edge
 * gives a shoreline made of visible facets — the "zackige Ufer". Every part of
 * the embankment has to follow the *same* line (water plate, quay wall, bank
 * path, shoreline ink), so the smoothing happens once here and the result is
 * handed to all of them.
 *
 * The curve is a cubic Hermite through the exported mapped vertices, so no
 * retained vertex moves and the water body keeps its mapped extent — only intermediate
 * points are inserted. Tangents are the angle bisector at each vertex, scaled
 * by the shorter adjacent edge, which is Catmull-Rom without the overshoot a
 * long edge next to a short one would otherwise produce.
 *
 * Sharp vertices are exempt: a harbour basin corner or the straight edge of a
 * quay is real, and rounding it off would be as wrong as faceting the bends.
 */

export type RingPoint = readonly [number, number];

/**
 * Turns beyond this are treated as built corners and stay sharp. Natural OSM
 * banks can legitimately turn by 40–60° between sparse survey nodes, while a
 * built quay or basin corner is normally close to 90°.
 */
export const BANK_CORNER_DEG = 68;

/** Target spacing of the subdivided line at close architectural zoom. */
export const BANK_SEGMENT_M = 2.5;

/** Ceiling per edge, so one 900 m park boundary cannot flood the buffer. */
const MAX_STEPS_PER_EDGE = 48;

export type DensifyOptions = {
  cornerDeg?: number;
  maxSegmentM?: number;
};

function dropRepeats(points: readonly RingPoint[]): [number, number][] {
  const kept: [number, number][] = [];
  for (const [x, z] of points) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(x - last[0], z - last[1]) > 1e-3) {
      kept.push([x, z]);
    }
  }
  // Rings arrive closed; the repeated first point would read as a zero edge.
  while (
    kept.length > 1 &&
    Math.hypot(kept[0][0] - kept[kept.length - 1][0], kept[0][1] - kept[kept.length - 1][1]) <=
      1e-3
  ) {
    kept.pop();
  }
  return kept;
}

/**
 * Subdivide a closed ring into a smooth polyline through its own vertices.
 * Returns the open ring (no repeated closing point), in the input's units.
 */
export function densifyRing(
  ring: readonly RingPoint[],
  options: DensifyOptions = {},
): [number, number][] {
  const points = dropRepeats(ring);
  const count = points.length;
  if (count < 3) {
    return points;
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cornerCos = Math.cos(((options.cornerDeg ?? BANK_CORNER_DEG) * Math.PI) / 180);
  const maxSegment = options.maxSegmentM ?? BANK_SEGMENT_M;

  const unitX = new Float64Array(count);
  const unitZ = new Float64Array(count);
  const length = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[(index + 1) % count];
    const run = Math.hypot(bx - ax, bz - az) || 1;
    length[index] = run;
    unitX[index] = (bx - ax) / run;
    unitZ[index] = (bz - az) / run;
  }

  // Tangent at each vertex, plus whether the vertex is a built corner. At a
  // corner the two sides get their own edge direction, which keeps the
  // approach straight into the angle.
  const isCorner: boolean[] = [];
  const tangentX = new Float64Array(count);
  const tangentZ = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const previous = (index + count - 1) % count;
    const dot = unitX[previous] * unitX[index] + unitZ[previous] * unitZ[index];
    isCorner[index] = dot < cornerCos;
    const bx = unitX[previous] + unitX[index];
    const bz = unitZ[previous] + unitZ[index];
    const span = Math.hypot(bx, bz);
    if (span < 1e-6) {
      tangentX[index] = unitX[index];
      tangentZ[index] = unitZ[index];
    } else {
      tangentX[index] = bx / span;
      tangentZ[index] = bz / span;
    }
  }

  const out: [number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [ax, az] = points[index];
    const [bx, bz] = points[next];
    out.push([ax, az]);
    const startX = isCorner[index] ? unitX[index] : tangentX[index];
    const startZ = isCorner[index] ? unitZ[index] : tangentZ[index];
    const endX = isCorner[next] ? unitX[index] : tangentX[next];
    const endZ = isCorner[next] ? unitZ[index] : tangentZ[next];
    // Both tangents already along the edge: the Hermite is that straight
    // line, so inserting points on it would only cost vertices.
    if (
      Math.abs(startX - unitX[index]) < 1e-6 &&
      Math.abs(startZ - unitZ[index]) < 1e-6 &&
      Math.abs(endX - unitX[index]) < 1e-6 &&
      Math.abs(endZ - unitZ[index]) < 1e-6
    ) {
      continue;
    }
    const steps = Math.min(
      MAX_STEPS_PER_EDGE,
      Math.max(1, Math.ceil(length[index] / maxSegment)),
    );
    const previousLength = length[(index + count - 1) % count];
    const nextLength = length[next];
    const startScale = Math.min(length[index], previousLength);
    const endScale = Math.min(length[index], nextLength);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const tt = t * t;
      const ttt = tt * t;
      const h00 = 2 * ttt - 3 * tt + 1;
      const h10 = ttt - 2 * tt + t;
      const h01 = -2 * ttt + 3 * tt;
      const h11 = ttt - tt;
      // Never expand the mapped footprint. Even a clamped tangent can
      // overshoot a global extremum by a few centimetres on a highly uneven
      // trace; clipping only inserted points to the source bounds preserves
      // the exact mapped envelope while retaining the curved interpolation.
      out.push([
        Math.max(
          minX,
          Math.min(
            maxX,
            h00 * ax +
              h10 * startScale * startX +
              h01 * bx +
              h11 * endScale * endX,
          ),
        ),
        Math.max(
          minZ,
          Math.min(
            maxZ,
            h00 * az +
              h10 * startScale * startZ +
              h01 * bz +
              h11 * endScale * endZ,
          ),
        ),
      ]);
    }
  }
  return out;
}

/**
 * Largest direction change between consecutive segments, in degrees. Used by
 * the tests to prove the smoothed line has no facets left where the raw ring
 * had them.
 */
export function sharpestTurnDeg(ring: readonly RingPoint[]): number {
  const points = dropRepeats(ring);
  const count = points.length;
  if (count < 3) {
    return 0;
  }
  let sharpest = 0;
  for (let index = 0; index < count; index += 1) {
    const [ax, az] = points[(index + count - 1) % count];
    const [bx, bz] = points[index];
    const [cx, cz] = points[(index + 1) % count];
    const inRun = Math.hypot(bx - ax, bz - az);
    const outRun = Math.hypot(cx - bx, cz - bz);
    if (inRun < 1e-9 || outRun < 1e-9) {
      continue;
    }
    const dot = ((bx - ax) * (cx - bx) + (bz - az) * (cz - bz)) / (inRun * outRun);
    sharpest = Math.max(sharpest, Math.acos(Math.min(1, Math.max(-1, dot))));
  }
  return (sharpest * 180) / Math.PI;
}
