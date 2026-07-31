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
 * The curve is a cubic Hermite through the original vertices, so no vertex
 * moves and the water body keeps its surveyed extent — only intermediate
 * points are inserted. Tangents are the angle bisector at each vertex, scaled
 * by the edge length, which is Catmull-Rom without the overshoot a long edge
 * next to a short one would otherwise produce.
 *
 * Sharp vertices are exempt: a harbour basin corner or the straight edge of a
 * quay is real, and rounding it off would be as wrong as faceting the bends.
 */

export type RingPoint = readonly [number, number];

/**
 * Turns beyond this are treated as built corners and stay sharp. 34° sits
 * above the bends OSM traces along the Spree and below the chamfers on the
 * Humboldthafen basin.
 */
export const BANK_CORNER_DEG = 34;

/** Target spacing of the subdivided line. Roughly a drawn stroke width. */
export const BANK_SEGMENT_M = 5;

/** Ceiling per edge, so one 900 m park boundary cannot flood the buffer. */
const MAX_STEPS_PER_EDGE = 24;

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
    const scale = length[index];
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const tt = t * t;
      const ttt = tt * t;
      const h00 = 2 * ttt - 3 * tt + 1;
      const h10 = ttt - 2 * tt + t;
      const h01 = -2 * ttt + 3 * tt;
      const h11 = ttt - tt;
      out.push([
        h00 * ax + h10 * scale * startX + h01 * bx + h11 * scale * endX,
        h00 * az + h10 * scale * startZ + h01 * bz + h11 * scale * endZ,
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
