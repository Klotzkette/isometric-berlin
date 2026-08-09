/**
 * The one part of the Quadriga whose shape is genuinely specified rather
 * than eyeballed: the **Iron Cross** (Eisernes Kreuz) that Karl Friedrich
 * Schinkel added to Victoria's standard in 1814.
 *
 * An Iron Cross is a *cross pattée* — four equal arms that widen from a
 * narrow waist to a flat tip, with concave flanks. That is a defined
 * geometric figure, so it is built here from explicit ratios and a real
 * curve instead of being approximated with two crossed boxes. Everything
 * downstream (the extruded cross, its raised rim, the test that pins it)
 * reads from these constants, which is what lets the emblem hold up when
 * the camera goes all the way in.
 *
 * The RATIOS are exact and pinned by test. The absolute SIZE on the
 * Quadriga is reference-derived, not surveyed, and is labelled as such
 * wherever it is used — see `QUADRIGA_GEOMETRY_STATUS`.
 */

/** Cross-pattée proportions, as fractions of the full tip-to-tip span. */
export const IRON_CROSS_PROFILE = {
  /** Half-width of the arm where it leaves the centre (the waist). */
  waistHalfWidth: 0.0943,
  /** Half-width of the arm at its flat outer tip. */
  tipHalfWidth: 0.22,
  /** Distance from centre to the flat tip, i.e. half the span. */
  armLength: 0.5,
  /**
   * Where along the arm the flank's control point sits (a fraction of
   * `armLength`, NOT of the span), and how far in it pulls. Together
   * these make the concave sweep that separates a cross pattée from a
   * plain flared cross: a straight taper reads as a "plus" sign, the
   * concave flank reads as the Iron Cross.
   *
   * Measured as a fraction of the arm deliberately. Read as a fraction of
   * the span, 0.62 puts the control point BEYOND the tip and the Bézier
   * bulges past it, so the cross came out 4.4 % too wide across the arms.
   */
  flankControlAlong: 0.62,
  flankControlHalfWidth: 0.1065,
  /** Steps used to walk each concave flank. Even → symmetric arms. */
  flankSteps: 6,
} as const;

export type Point2 = readonly [number, number];

/**
 * One quadrant's worth of the outline: from the waist on one side of an
 * arm, along the concave flank, across the flat tip, and back down the
 * far flank to the next waist. Walking this four times at 90° gives the
 * closed cross.
 */
function armOutline(span: number): Point2[] {
  const {
    armLength,
    flankControlAlong,
    flankControlHalfWidth,
    flankSteps,
    tipHalfWidth,
    waistHalfWidth,
  } = IRON_CROSS_PROFILE;
  const length = armLength * span;
  const waist = waistHalfWidth * span;
  const tip = tipHalfWidth * span;
  const controlX = flankControlAlong * length;
  const controlY = flankControlHalfWidth * span;
  const points: Point2[] = [];
  // Quadratic Bézier from the waist out to the tip corner, on the −y flank.
  for (let step = 0; step <= flankSteps; step += 1) {
    const t = step / flankSteps;
    const inverse = 1 - t;
    const x =
      inverse * inverse * waist + 2 * inverse * t * controlX + t * t * length;
    const y =
      inverse * inverse * -waist +
      2 * inverse * t * -controlY +
      t * t * -tip;
    points.push([x, y]);
  }
  // Flat tip.
  points.push([length, tip]);
  // Back down the +y flank, mirrored.
  for (let step = flankSteps - 1; step >= 0; step -= 1) {
    const t = step / flankSteps;
    const inverse = 1 - t;
    const x =
      inverse * inverse * waist + 2 * inverse * t * controlX + t * t * length;
    const y =
      inverse * inverse * waist + 2 * inverse * t * controlY + t * t * tip;
    points.push([x, y]);
  }
  return points;
}

/**
 * The closed outline of an Iron Cross of the given tip-to-tip span, in
 * metres, centred on the origin in its own plane. Four arms at 90°.
 */
export function ironCrossOutline(span: number): Point2[] {
  const arm = armOutline(span);
  const outline: Point2[] = [];
  for (let quarter = 0; quarter < 4; quarter += 1) {
    const angle = (quarter * Math.PI) / 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (const [x, y] of arm) {
      outline.push([x * cosine - y * sine, x * sine + y * cosine]);
    }
  }
  return outline;
}

/** Shoelace area of a closed outline, in the units it was built with. */
export function outlineArea(outline: readonly Point2[]): number {
  let sum = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const [x0, y0] = outline[index];
    const [x1, y1] = outline[(index + 1) % outline.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

/**
 * The oak wreath Schinkel set around the cross. Leaf anchors are returned
 * as angle + radius pairs so the builder can place a real leaf at each,
 * rather than drawing a smooth ring that reads as a washer.
 *
 * Oak, not laurel: the 1814 standard carries an *Eichenkranz*. The two
 * differ visibly at this zoom — an oak leaf is lobed and clusters in
 * pairs, a laurel leaf is a smooth lance — so the distinction is worth
 * keeping even though both are commonly called a victory wreath.
 */
export const OAK_WREATH = {
  leafCount: 22,
  /** Leaves alternate slightly in and out, the way a bound wreath sits. */
  radialJitter: 0.055,
  /** Each leaf is tipped out of the wreath plane, alternating sides. */
  tiltRadians: 0.42,
} as const;

export function oakWreathLeaves(
  radius: number,
): Array<{ angle: number; radius: number; tilt: number }> {
  const leaves: Array<{ angle: number; radius: number; tilt: number }> = [];
  for (let index = 0; index < OAK_WREATH.leafCount; index += 1) {
    const angle = (index / OAK_WREATH.leafCount) * Math.PI * 2;
    const side = index % 2 === 0 ? 1 : -1;
    leaves.push({
      angle,
      radius: radius * (1 + side * OAK_WREATH.radialJitter),
      tilt: side * OAK_WREATH.tiltRadians,
    });
  }
  return leaves;
}
