/**
 * The "Goldelse" — Friedrich Drake's gilded bronze Viktoria on top of the
 * Siegessäule, cast by Hermann Gladenbeck.
 *
 * Documented facts this model is built from (de.wikipedia "Siegessäule
 * (Berlin)"): the figure is 8.32 m tall and weighs 35 t; she "hält in der
 * Rechten einen Lorbeerkranz in die Höhe, in der Linken ein Feldzeichen mit
 * dem Eisernen Kreuz. Auf ihrem Helm sitzt ein Adler." Since the 1939 move
 * from the Königsplatz to the Großer Stern she faces WEST, towards today's
 * Ernst-Reuter-Platz — before the move she looked south. Nothing here is
 * invented beyond the silhouette needed to read those attributes.
 *
 * Everything is emitted in a local right-handed frame and mapped to world
 * coordinates by the caller, so the figure can be aimed down the Straße des
 * 17. Juni axis without duplicating trigonometry:
 *
 *   +x  the direction she faces (west)
 *   +y  up, 0 at the soles of her feet
 *   +z  the figure's own left — so the standard is at +z, the wreath at -z
 *
 * The wings are deliberately flat plates rather than solids. That is the
 * house drawing style (flat authored elements, thin ink outlines), and it is
 * also the only honest choice: feather-level relief would be far below one
 * screen pixel at the 67 m the figure actually sits at.
 */

/** Published height of the bronze figure, soles to the raised laurel wreath. */
export const GOLDELSE_HEIGHT_M = 8.32;

/** Gilded bronze in full light, and the shaded tone for undersides. */
export const GOLDELSE_GOLD = 0xd4af37;
export const GOLDELSE_GOLD_SHADED = 0xb08a2b;

export type GoldelsePart = {
  name: string;
  tone: number;
  triangles: Float32Array;
};

export type GoldelseFigure = {
  /** Solid parts, already in world coordinates. */
  parts: GoldelsePart[];
  /** Drawn detail lines (feathers, robe folds) as flat x,y,z pairs. */
  inkSegments: number[];
  /** Height actually occupied, for the assertion that we match 8.32 m. */
  heightM: number;
};

export type GoldelseOptions = {
  /** World position of the soles of her feet. */
  base: [number, number, number];
  /** Unit direction she faces, in the world xz-plane. */
  facing: [number, number];
};

type Local = [number, number, number];
type Outline = [number, number][];

/** A vertical prism whose radius changes with height (torso, gown, neck). */
function taperedPrism(
  centreZ: number,
  bottomY: number,
  topY: number,
  bottomRadius: number,
  topRadius: number,
  segments: number,
): Local[] {
  const triangles: Local[] = [];
  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2;
    const a1 = ((index + 1) / segments) * Math.PI * 2;
    const ring = (angle: number, radius: number, y: number): Local => [
      Math.cos(angle) * radius,
      y,
      centreZ + Math.sin(angle) * radius,
    ];
    const b0 = ring(a0, bottomRadius, bottomY);
    const b1 = ring(a1, bottomRadius, bottomY);
    const t0 = ring(a0, topRadius, topY);
    const t1 = ring(a1, topRadius, topY);
    triangles.push(b0, b1, t1, b0, t1, t0);
    triangles.push([0, topY, centreZ], t0, t1);
    triangles.push([0, bottomY, centreZ], b1, b0);
  }
  return triangles;
}

/**
 * A box whose long axis runs from `from` to `to` — used for the arms and the
 * staff, which are neither vertical nor axis-aligned.
 */
function strut(from: Local, to: Local, thickness: number): Local[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const ax: Local = [dx / length, dy / length, dz / length];
  // Any vector not parallel to the strut works as the seed for the frame.
  const seed: Local = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (a: Local, b: Local): Local => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const normalise = (v: Local): Local => {
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  };
  const u = normalise(cross(ax, seed));
  const v = normalise(cross(ax, u));
  const half = thickness / 2;
  const corner = (end: Local, su: number, sv: number): Local => [
    end[0] + u[0] * su * half + v[0] * sv * half,
    end[1] + u[1] * su * half + v[1] * sv * half,
    end[2] + u[2] * su * half + v[2] * sv * half,
  ];
  const quads: Local[][] = [];
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let index = 0; index < 4; index += 1) {
    const [s0u, s0v] = signs[index];
    const [s1u, s1v] = signs[(index + 1) % 4];
    quads.push([
      corner(from, s0u, s0v),
      corner(to, s0u, s0v),
      corner(to, s1u, s1v),
      corner(from, s1u, s1v),
    ]);
  }
  quads.push(signs.map(([su, sv]) => corner(to, su, sv)));
  quads.push(signs.map(([su, sv]) => corner(from, su, sv)).reverse());
  const triangles: Local[] = [];
  for (const [a, b, c, d] of quads) {
    triangles.push(a, b, c, a, c, d);
  }
  return triangles;
}

/**
 * A flat drawn element: an outline given as (across, up) points, given
 * thickness along the facing axis and placed at `atX`. This is what the
 * wings, the robe panel and the Iron Cross are made of.
 */
function plate(outline: Outline, atX: number, thickness: number): Local[] {
  const half = thickness / 2;
  const front = atX + half;
  const back = atX - half;
  const triangles: Local[] = [];
  // Fan-triangulate both faces. The outlines here are all star-shaped about
  // their first vertex, so a fan is sufficient and avoids pulling in a
  // triangulator for eight hand-placed points.
  for (let index = 1; index < outline.length - 1; index += 1) {
    const [z0, y0] = outline[0];
    const [z1, y1] = outline[index];
    const [z2, y2] = outline[index + 1];
    triangles.push([front, y0, z0], [front, y1, z1], [front, y2, z2]);
    triangles.push([back, y0, z0], [back, y2, z2], [back, y1, z1]);
  }
  for (let index = 0; index < outline.length; index += 1) {
    const [z0, y0] = outline[index];
    const [z1, y1] = outline[(index + 1) % outline.length];
    triangles.push([front, y0, z0], [back, y0, z0], [back, y1, z1]);
    triangles.push([front, y0, z0], [back, y1, z1], [front, y1, z1]);
  }
  return triangles;
}

/**
 * A blade-shaped flat element built as a strip between a leading and a
 * trailing polyline of equal length. Unlike a fan this stays correct when the
 * silhouette is concave, which a swept wing always is.
 */
function bladePlate(
  leading: Outline,
  trailing: Outline,
  atX: number,
  thickness: number,
): Local[] {
  const half = thickness / 2;
  const front = atX + half;
  const back = atX - half;
  const triangles: Local[] = [];
  const quad = (a: Local, b: Local, c: Local, d: Local): void => {
    triangles.push(a, b, c, a, c, d);
  };
  for (let index = 0; index < leading.length - 1; index += 1) {
    const [lz0, ly0] = leading[index];
    const [lz1, ly1] = leading[index + 1];
    const [tz0, ty0] = trailing[index];
    const [tz1, ty1] = trailing[index + 1];
    quad(
      [front, ly0, lz0],
      [front, ty0, tz0],
      [front, ty1, tz1],
      [front, ly1, lz1],
    );
    quad(
      [back, ly0, lz0],
      [back, ly1, lz1],
      [back, ty1, tz1],
      [back, ty0, tz0],
    );
    quad(
      [front, ly0, lz0],
      [front, ly1, lz1],
      [back, ly1, lz1],
      [back, ly0, lz0],
    );
    quad(
      [front, ty0, tz0],
      [back, ty0, tz0],
      [back, ty1, tz1],
      [front, ty1, tz1],
    );
  }
  return triangles;
}

/**
 * A flat ring standing in the (across, up) plane — the laurel wreath. Built
 * from exact radii so the crown of the wreath lands on a height we can state,
 * which a tube of boxes swept round a circle cannot.
 */
function ringPlate(
  centreZ: number,
  centreY: number,
  outerRadius: number,
  innerRadius: number,
  atX: number,
  thickness: number,
  segments: number,
): Local[] {
  const half = thickness / 2;
  const front = atX + half;
  const back = atX - half;
  const triangles: Local[] = [];
  const quad = (a: Local, b: Local, c: Local, d: Local): void => {
    triangles.push(a, b, c, a, c, d);
  };
  const at = (angle: number, radius: number, x: number): Local => [
    x,
    centreY + Math.sin(angle) * radius,
    centreZ + Math.cos(angle) * radius,
  ];
  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2;
    const a1 = ((index + 1) / segments) * Math.PI * 2;
    quad(
      at(a0, outerRadius, front),
      at(a0, innerRadius, front),
      at(a1, innerRadius, front),
      at(a1, outerRadius, front),
    );
    quad(
      at(a0, outerRadius, back),
      at(a1, outerRadius, back),
      at(a1, innerRadius, back),
      at(a0, innerRadius, back),
    );
    quad(
      at(a0, outerRadius, front),
      at(a1, outerRadius, front),
      at(a1, outerRadius, back),
      at(a0, outerRadius, back),
    );
    quad(
      at(a0, innerRadius, back),
      at(a1, innerRadius, back),
      at(a1, innerRadius, front),
      at(a0, innerRadius, front),
    );
  }
  return triangles;
}

/** Mirror a part across the figure's centre plane, keeping winding order. */
function mirrored(triangles: Local[]): Local[] {
  const flipped: Local[] = [];
  for (let index = 0; index < triangles.length; index += 3) {
    const [a, b, c] = [
      triangles[index],
      triangles[index + 1],
      triangles[index + 2],
    ];
    flipped.push(
      [a[0], a[1], -a[2]],
      [c[0], c[1], -c[2]],
      [b[0], b[1], -b[2]],
    );
  }
  return flipped;
}

/**
 * One spread wing, as the upper (leading) and lower (trailing) edge of a
 * blade sweeping up and outwards from the shoulder. Paired point-for-point so
 * the strip and the drawn feather lines share the same parameterisation.
 */
const WING_LEADING: Outline = [
  [0.5, 5.62],
  [1.3, 6.42],
  [2.12, 7.22],
  [2.76, 7.9],
  [3.15, 8.02],
];
const WING_TRAILING: Outline = [
  [0.62, 4.86],
  [1.34, 5.42],
  [1.98, 6.1],
  [2.5, 6.82],
  [2.9, 7.26],
];

/** Robe hem panel, widening towards the feet the way the cast bronze does. */
const ROBE_OUTLINE: Outline = [
  [-1.02, 0],
  [1.02, 0],
  [0.86, 1.5],
  [0.7, 3.1],
  [0.58, 4.3],
  [-0.58, 4.3],
  [-0.7, 3.1],
  [-0.86, 1.5],
];

/**
 * The four arms of the Iron Cross, each a convex trapezoid running from the
 * narrow centre out to the flared tip. Four separate convex pieces rather
 * than one cross-shaped polygon, so every piece triangulates cleanly.
 */
function ironCrossArms(
  arm: number,
  centreZ: number,
  centreY: number,
): Outline[] {
  const waist = arm * 0.3;
  const tip = arm * 0.62;
  const trapezoid: Outline = [
    [-waist, 0],
    [-tip, arm],
    [tip, arm],
    [waist, 0],
  ];
  const quarterTurns: Array<(u: number, v: number) => [number, number]> = [
    (u, v) => [u, v],
    (u, v) => [v, -u],
    (u, v) => [-u, -v],
    (u, v) => [-v, u],
  ];
  return quarterTurns.map((turn) =>
    trapezoid.map(([u, v]) => {
      const [rz, ry] = turn(u, v);
      return [centreZ + rz, centreY + ry] as [number, number];
    }),
  );
}

/**
 * Build the figure. Heights are laid out so the wreath she raises tops out at
 * exactly the published 8.32 m.
 */
export function createGoldelseFigure({
  base,
  facing,
}: GoldelseOptions): GoldelseFigure {
  const parts: Array<{ name: string; tone: number; local: Local[] }> = [];
  const inkLocal: Local[] = [];

  const SHOULDER_Y = 5.85;
  const HEAD_Y = 6.18;
  const HELMET_Y = 6.95;

  // Robe and body. The gown is a flat drawn panel in front of a tapered
  // solid, which is what gives the silhouette its skirt without making the
  // figure read as a cone from the side.
  parts.push({
    local: taperedPrism(0, 0, 4.35, 0.94, 0.62, 10),
    name: "Goldelse robe",
    tone: GOLDELSE_GOLD_SHADED,
  });
  parts.push({
    local: plate(ROBE_OUTLINE, 0.5, 0.26),
    name: "Goldelse robe front",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: taperedPrism(0, 4.35, SHOULDER_Y, 0.62, 0.72, 10),
    name: "Goldelse torso",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: taperedPrism(0, SHOULDER_Y, HEAD_Y, 0.72, 0.24, 8),
    name: "Goldelse shoulders",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: taperedPrism(0, HEAD_Y, HEAD_Y + 0.52, 0.3, 0.32, 8),
    name: "Goldelse head",
    tone: GOLDELSE_GOLD,
  });

  // Helmet with the eagle on top, both documented attributes.
  parts.push({
    local: taperedPrism(0, HEAD_Y + 0.44, HELMET_Y, 0.38, 0.2, 8),
    name: "Goldelse helmet",
    tone: GOLDELSE_GOLD_SHADED,
  });
  parts.push({
    local: taperedPrism(0, HELMET_Y, HELMET_Y + 0.34, 0.16, 0.1, 6),
    name: "Goldelse helmet eagle body",
    tone: GOLDELSE_GOLD,
  });
  for (const side of [1, -1]) {
    parts.push({
      local: plate(
        [
          [side * 0.08, HELMET_Y + 0.06],
          [side * 0.46, HELMET_Y + 0.3],
          [side * 0.5, HELMET_Y + 0.42],
          [side * 0.12, HELMET_Y + 0.3],
        ],
        0,
        0.09,
      ),
      name: "Goldelse helmet eagle wing",
      tone: GOLDELSE_GOLD,
    });
  }

  // Spread wings, plus the drawn feather lines across each blade.
  const leftWing = bladePlate(WING_LEADING, WING_TRAILING, 0, 0.34);
  parts.push({ local: leftWing, name: "Goldelse wing", tone: GOLDELSE_GOLD });
  parts.push({
    local: mirrored(leftWing),
    name: "Goldelse wing",
    tone: GOLDELSE_GOLD,
  });
  WING_LEADING.forEach(([leadZ, leadY], index) => {
    const [trailZ, trailY] = WING_TRAILING[index];
    for (const side of [1, -1]) {
      inkLocal.push([0.19, leadY, side * leadZ], [0.19, trailY, side * trailZ]);
    }
  });

  // Right arm raised with the laurel wreath; the wreath crown is the top of
  // the published 8.32 m.
  const rightShoulder: Local = [0.1, SHOULDER_Y - 0.1, -0.62];
  const rightHand: Local = [0.62, 7.42, -0.95];
  parts.push({
    local: strut(rightShoulder, rightHand, 0.3),
    name: "Goldelse raised arm",
    tone: GOLDELSE_GOLD,
  });
  // The crown of the wreath is the top of the figure, so its outer radius is
  // set from the published total height rather than chosen.
  const wreathCentreY = 7.82;
  const wreathOuter = GOLDELSE_HEIGHT_M - wreathCentreY;
  parts.push({
    local: ringPlate(-0.95, wreathCentreY, wreathOuter, wreathOuter - 0.15, 0.66, 0.16, 16),
    name: "Goldelse laurel wreath",
    tone: GOLDELSE_GOLD,
  });
  // Laurel leaves, drawn as short ticks around the ring.
  for (let leaf = 0; leaf < 16; leaf += 1) {
    const angle = (leaf / 16) * Math.PI * 2;
    inkLocal.push(
      [
        0.75,
        wreathCentreY + Math.sin(angle) * (wreathOuter - 0.14),
        -0.95 + Math.cos(angle) * (wreathOuter - 0.14),
      ],
      [
        0.75,
        wreathCentreY + Math.sin(angle + 0.24) * wreathOuter,
        -0.95 + Math.cos(angle + 0.24) * wreathOuter,
      ],
    );
  }

  // Left arm holding the Feldzeichen: a staff carrying the Iron Cross.
  const leftShoulder: Local = [0.08, SHOULDER_Y - 0.15, 0.62];
  const leftHand: Local = [0.42, 4.55, 1.02];
  parts.push({
    local: strut(leftShoulder, leftHand, 0.3),
    name: "Goldelse standard arm",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: strut([0.42, 3.3, 1.06], [0.42, 7.5, 1.06], 0.19),
    name: "Goldelse field standard",
    tone: GOLDELSE_GOLD_SHADED,
  });
  for (const armOutline of ironCrossArms(0.78, 1.06, 7.52)) {
    parts.push({
      local: plate(armOutline, 0.42, 0.14),
      name: "Goldelse iron cross",
      tone: GOLDELSE_GOLD,
    });
  }

  // Robe folds, drawn straight down the gown the way the cast is chased.
  for (const across of [-0.62, -0.24, 0.14, 0.52]) {
    inkLocal.push([0.64, 0.16, across], [0.62, 4.1, across * 0.7]);
  }

  const [ax, az] = facing;
  const [ox, oy, oz] = base;
  // The figure's left is up × facing in a right-handed Y-up frame.
  const toWorld = ([lx, ly, lz]: Local): Local => [
    ox + ax * lx + az * lz,
    oy + ly,
    oz + az * lx - ax * lz,
  ];
  const flatten = (triangles: Local[]): Float32Array => {
    const flat = new Float32Array(triangles.length * 3);
    triangles.forEach((point, index) => {
      const [wx, wy, wz] = toWorld(point);
      flat[index * 3] = wx;
      flat[index * 3 + 1] = wy;
      flat[index * 3 + 2] = wz;
    });
    return flat;
  };

  const inkSegments: number[] = [];
  for (const point of inkLocal) {
    inkSegments.push(...toWorld(point));
  }
  let heightM = 0;
  for (const part of parts) {
    for (const [, y] of part.local) {
      heightM = Math.max(heightM, y);
    }
  }
  return {
    heightM,
    inkSegments,
    parts: parts.map(({ local, name, tone }) => ({
      name,
      tone,
      triangles: flatten(local),
    })),
  };
}
