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
 * The wings are deliberately built from thin overlapping plates rather than
 * invented volumetric carving. That follows the house drawing style while
 * preserving the primary, secondary and covert feather layers which remain
 * visible from the dedicated landmark camera.
 */

/** Published full height of the bronze figure and its field standard. */
export const GOLDELSE_HEIGHT_M = 8.32;

/**
 * Blattgold in four restrained values. The previous ochre pair was too dark
 * for an unlit Day material and made the figure read as orange bronze. These
 * values preserve shaded folds while letting the sun-facing feathers and
 * jewellery carry the pale, freshly gilded reading visible after the 2011
 * restoration.
 */
export const GOLDELSE_GOLD = 0xffd75a;
export const GOLDELSE_GOLD_HIGHLIGHT = 0xfff0a3;
export const GOLDELSE_GOLD_SHADED = 0xe3ab26;
export const GOLDELSE_GOLD_DEEP = 0xa87412;
export const GOLDELSE_GOLD_TONES = [
  GOLDELSE_GOLD,
  GOLDELSE_GOLD_HIGHLIGHT,
  GOLDELSE_GOLD_SHADED,
  GOLDELSE_GOLD_DEEP,
] as const;

export type GoldelsePart = {
  /** False for tiny layered gilding whose automatic edges would turn black. */
  inked?: boolean;
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
  /** Stable recognition counts used by visual and performance QA. */
  metrics: {
    laurelLeafCount: number;
    primaryFeathersPerWing: number;
    robeFoldCount: number;
    secondaryFeathersPerWing: number;
    standardRibbonCount: number;
  };
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

/** A low-poly round limb or rod between two arbitrary points. */
function roundStrut(
  from: Local,
  to: Local,
  radius: number,
  segments = 8,
): Local[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const axis: Local = [dx / length, dy / length, dz / length];
  const seed: Local = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (a: Local, b: Local): Local => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const normalise = (value: Local): Local => {
    const magnitude = Math.hypot(...value) || 1;
    return value.map((component) => component / magnitude) as Local;
  };
  const u = normalise(cross(axis, seed));
  const v = normalise(cross(axis, u));
  const ring = (centre: Local, angle: number): Local => [
    centre[0] + radius * (u[0] * Math.cos(angle) + v[0] * Math.sin(angle)),
    centre[1] + radius * (u[1] * Math.cos(angle) + v[1] * Math.sin(angle)),
    centre[2] + radius * (u[2] * Math.cos(angle) + v[2] * Math.sin(angle)),
  ];
  const triangles: Local[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle0 = (index / segments) * Math.PI * 2;
    const angle1 = ((index + 1) / segments) * Math.PI * 2;
    const from0 = ring(from, angle0);
    const from1 = ring(from, angle1);
    const to0 = ring(to, angle0);
    const to1 = ring(to, angle1);
    triangles.push(from0, to0, to1, from0, to1, from1);
    triangles.push(from, from1, from0, to, to0, to1);
  }
  return triangles;
}

/** A compact faceted ellipsoid for heads, hands, knees and helmet details. */
function ellipsoid(
  centre: Local,
  radii: Local,
  widthSegments = 10,
  heightSegments = 5,
): Local[] {
  const triangles: Local[] = [];
  const point = (ring: number, segment: number): Local => {
    const phi = (ring / heightSegments) * Math.PI;
    const theta = (segment / widthSegments) * Math.PI * 2;
    return [
      centre[0] + Math.sin(phi) * Math.cos(theta) * radii[0],
      centre[1] + Math.cos(phi) * radii[1],
      centre[2] + Math.sin(phi) * Math.sin(theta) * radii[2],
    ];
  };
  for (let ring = 0; ring < heightSegments; ring += 1) {
    for (let segment = 0; segment < widthSegments; segment += 1) {
      const a = point(ring, segment);
      const b = point(ring + 1, segment);
      const c = point(ring + 1, segment + 1);
      const d = point(ring, segment + 1);
      if (ring > 0) triangles.push(a, b, d);
      if (ring < heightSegments - 1) triangles.push(d, b, c);
    }
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
 * A tapered, slightly bowed feather in the figure's frontal plane. The
 * separate leading and trailing strips let every long flight feather keep a
 * clean silhouette and its own ink edge after geometry merging.
 */
function featherPlate(
  root: [number, number],
  tip: [number, number],
  width: number,
  atX: number,
  thickness: number,
  bowY = 0,
): Local[] {
  const dz = tip[0] - root[0];
  const dy = tip[1] - root[1];
  const length = Math.hypot(dz, dy) || 1;
  const normalZ = -dy / length;
  const normalY = dz / length;
  const middle: [number, number] = [
    (root[0] + tip[0]) / 2,
    (root[1] + tip[1]) / 2 + bowY,
  ];
  const leading: Outline = [
    [root[0] + normalZ * width * 0.46, root[1] + normalY * width * 0.46],
    [middle[0] + normalZ * width * 0.32, middle[1] + normalY * width * 0.32],
    [tip[0] + normalZ * width * 0.04, tip[1] + normalY * width * 0.04],
  ];
  const trailing: Outline = [
    [root[0] - normalZ * width * 0.46, root[1] - normalY * width * 0.46],
    [middle[0] - normalZ * width * 0.32, middle[1] - normalY * width * 0.32],
    [tip[0] - normalZ * width * 0.04, tip[1] - normalY * width * 0.04],
  ];
  return bladePlate(leading, trailing, atX, thickness);
}

/** A convex laurel leaf, rotated tangent to its wreath. */
function leafOutline(
  centreZ: number,
  centreY: number,
  angle: number,
  length: number,
  width: number,
): Outline {
  const alongZ = Math.cos(angle);
  const alongY = Math.sin(angle);
  const acrossZ = -alongY;
  const acrossY = alongZ;
  return [
    [centreZ - alongZ * length / 2, centreY - alongY * length / 2],
    [centreZ + acrossZ * width / 2, centreY + acrossY * width / 2],
    [centreZ + alongZ * length / 2, centreY + alongY * length / 2],
    [centreZ - acrossZ * width / 2, centreY - acrossY * width / 2],
  ];
}

/**
 * A flat ring standing in the (across, up) plane. Exact radii keep both the
 * hand-held laurel wreath and the field-standard frame measurable.
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
  [0.46, 4.72],
  [0.96, 5.42],
  [1.52, 5.96],
  [2.18, 6.34],
  [3.38, 6.5],
];
const WING_TRAILING: Outline = [
  [0.5, 4.3],
  [0.98, 4.5],
  [1.52, 4.72],
  [2.08, 4.88],
  [2.74, 4.84],
];

const PRIMARY_FEATHERS: Array<{
  bowY: number;
  root: [number, number];
  tip: [number, number];
  width: number;
}> = [
  { bowY: 0.08, root: [0.9, 5.55], tip: [3.48, 6.5], width: 0.32 },
  { bowY: 0.08, root: [0.94, 5.44], tip: [3.43, 6.28], width: 0.31 },
  { bowY: 0.06, root: [0.98, 5.32], tip: [3.36, 6.05], width: 0.3 },
  { bowY: 0.05, root: [1.02, 5.2], tip: [3.27, 5.81], width: 0.29 },
  { bowY: 0.03, root: [1.05, 5.08], tip: [3.17, 5.58], width: 0.28 },
  { bowY: 0.01, root: [1.08, 4.98], tip: [3.04, 5.34], width: 0.27 },
  { bowY: -0.01, root: [1.08, 4.9], tip: [2.88, 5.1], width: 0.26 },
  { bowY: -0.03, root: [1.06, 4.82], tip: [2.69, 4.88], width: 0.25 },
  { bowY: -0.05, root: [1.02, 4.74], tip: [2.48, 4.68], width: 0.24 },
  { bowY: -0.07, root: [0.96, 4.66], tip: [2.25, 4.5], width: 0.23 },
];

const SECONDARY_FEATHERS: Array<{
  root: [number, number];
  tip: [number, number];
  width: number;
}> = [
  { root: [0.56, 5.34], tip: [2.4, 6.28], width: 0.34 },
  { root: [0.54, 5.2], tip: [2.22, 6.08], width: 0.34 },
  { root: [0.53, 5.08], tip: [2.03, 5.88], width: 0.33 },
  { root: [0.52, 4.97], tip: [1.83, 5.67], width: 0.32 },
  { root: [0.51, 4.86], tip: [1.63, 5.45], width: 0.31 },
  { root: [0.5, 4.76], tip: [1.43, 5.23], width: 0.29 },
  { root: [0.5, 4.66], tip: [1.23, 5.01], width: 0.27 },
  { root: [0.5, 4.58], tip: [1.05, 4.82], width: 0.25 },
];

/** Robe hem panel, widening towards the feet the way the cast bronze does. */
const ROBE_OUTLINE: Outline = [
  [-0.63, 0.13],
  [0.24, 0.08],
  [1.28, 0.5],
  [1.08, 1.42],
  [0.86, 2.48],
  [0.62, 3.64],
  [-0.56, 3.64],
  [-0.72, 1.72],
];

const ROBE_FOLD_ACROSS = [-0.5, -0.28, -0.05, 0.2, 0.43, 0.68, 0.91] as const;
const STANDARD_RIBBON_COUNT = 3;

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
 * Build the figure. The photographed field-standard finial is the crown of
 * the exact published 8.32 m stack; the hand-held wreath remains below it.
 */
export function createGoldelseFigure({
  base,
  facing,
}: GoldelseOptions): GoldelseFigure {
  const parts: Array<{
    inked?: boolean;
    name: string;
    tone: number;
    local: Local[];
  }> = [];
  const inkLocal: Local[] = [];

  const SHOULDER_Y = 4.64;
  const HEAD_CENTRE_Y = 5.28;
  const HELMET_TOP_Y = 6.08;

  // Drake's 0.92 m shoes remain visible below the wind-lifted hem. The legs
  // are modelled even where the outer robe hides them, so the stance does not
  // collapse into the old single cone when seen from the side.
  for (const [z, back] of [
    [-0.22, false],
    [0.24, true],
  ] as const) {
    parts.push({
      local: strut(
        [back ? -0.26 : -0.2, 0.135, z],
        [back ? 0.66 : 0.72, 0.135, z],
        0.27,
      ),
      name: "Goldelse 0.92 m shoe",
      tone: back ? GOLDELSE_GOLD_SHADED : GOLDELSE_GOLD_HIGHLIGHT,
    });
    parts.push({
      local: roundStrut([0, 0.24, z], [0.04, 2.55, z * 0.7], 0.17, 7),
      name: "Goldelse standing leg",
      tone: back ? GOLDELSE_GOLD_DEEP : GOLDELSE_GOLD,
    });
  }

  parts.push({
    local: taperedPrism(0.08, 0.16, 3.68, 0.72, 0.52, 12),
    name: "Goldelse robe",
    tone: GOLDELSE_GOLD_SHADED,
  });
  parts.push({
    local: plate(ROBE_OUTLINE, 0.48, 0.22),
    name: "Goldelse wind-filled robe front",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    local: plate(
      [
        [0.38, 0.48],
        [1.42, 0.68],
        [1.36, 1.3],
        [0.78, 2.25],
        [0.43, 1.72],
      ],
      0.18,
      0.18,
    ),
    name: "Goldelse wind-filled robe train",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: taperedPrism(0, 3.5, SHOULDER_Y, 0.5, 0.66, 12),
    name: "Goldelse torso",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: plate(
      [
        [-0.57, 3.63],
        [0.58, 3.63],
        [0.66, 4.34],
        [0.38, 4.6],
        [-0.38, 4.6],
        [-0.66, 4.34],
      ],
      0.51,
      0.18,
    ),
    name: "Goldelse gathered bodice",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    local: roundStrut(
      [0, SHOULDER_Y, -0.7],
      [0, SHOULDER_Y, 0.7],
      0.2,
      8,
    ),
    name: "Goldelse shoulders",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: taperedPrism(0, 4.72, 4.98, 0.2, 0.19, 8),
    name: "Goldelse neck",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    local: ellipsoid([0.03, HEAD_CENTRE_Y, 0], [0.31, 0.43, 0.3], 10, 6),
    name: "Goldelse head",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: ellipsoid([0.3, HEAD_CENTRE_Y + 0.02, 0], [0.15, 0.11, 0.1], 8, 4),
    name: "Goldelse face and nose",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    local: ellipsoid([-0.18, HEAD_CENTRE_Y + 0.02, 0], [0.2, 0.4, 0.33], 8, 5),
    name: "Goldelse hair mass",
    tone: GOLDELSE_GOLD_DEEP,
  });

  // The Borussia helmet is a brim, a domed crown and a separately readable
  // eagle, instead of the previous narrow spike.
  parts.push({
    local: taperedPrism(0, 5.61, 5.73, 0.39, 0.37, 12),
    name: "Goldelse helmet brim",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    local: taperedPrism(0, 5.7, HELMET_TOP_Y, 0.34, 0.13, 10),
    name: "Goldelse helmet",
    tone: GOLDELSE_GOLD_SHADED,
  });
  parts.push({
    local: ellipsoid([0, 6.2, 0], [0.13, 0.23, 0.12], 7, 4),
    name: "Goldelse helmet eagle body",
    tone: GOLDELSE_GOLD,
  });
  for (const side of [1, -1]) {
    parts.push({
      local: plate(
        [
          [side * 0.04, 6.17],
          [side * 0.43, 6.34],
          [side * 0.48, 6.43],
          [side * 0.12, 6.34],
        ],
        0,
        0.08,
      ),
      name: "Goldelse helmet eagle wing",
      tone: GOLDELSE_GOLD_HIGHLIGHT,
    });
  }

  // Two broad wing fans. A shaded structural blade preserves the silhouette;
  // individually edged primary, secondary and covert feathers supply the
  // layered anatomy that is unmistakable in the close reference view.
  const leftWing = bladePlate(WING_LEADING, WING_TRAILING, -0.1, 0.28);
  parts.push({ local: leftWing, name: "Goldelse wing", tone: GOLDELSE_GOLD });
  parts.push({
    local: mirrored(leftWing),
    name: "Goldelse wing",
    tone: GOLDELSE_GOLD,
  });
  const primaryLight: Local[] = [];
  const primaryGold: Local[] = [];
  PRIMARY_FEATHERS.forEach((feather, index) => {
    const target = index % 2 === 0 ? primaryLight : primaryGold;
    target.push(
      ...featherPlate(
        feather.root,
        feather.tip,
        feather.width,
        -0.02 + index * 0.004,
        0.1,
        feather.bowY,
      ),
    );
    inkLocal.push(
      [0.055, feather.root[1], feather.root[0]],
      [0.055, feather.tip[1], feather.tip[0]],
      [0.055, feather.root[1], -feather.root[0]],
      [0.055, feather.tip[1], -feather.tip[0]],
    );
  });
  for (const [geometry, tone] of [
    [primaryLight, GOLDELSE_GOLD_HIGHLIGHT],
    [primaryGold, GOLDELSE_GOLD],
  ] as const) {
    parts.push({
      inked: false,
      local: geometry,
      name: "Goldelse primary wing feathers",
      tone,
    });
    parts.push({
      inked: false,
      local: mirrored(geometry),
      name: "Goldelse primary wing feathers",
      tone,
    });
  }
  const secondary: Local[] = [];
  SECONDARY_FEATHERS.forEach((feather, index) => {
    secondary.push(
      ...featherPlate(
        feather.root,
        feather.tip,
        feather.width,
        0.035 + index * 0.003,
        0.11,
        0.04,
      ),
    );
    inkLocal.push(
      [0.1, feather.root[1], feather.root[0]],
      [0.1, feather.tip[1], feather.tip[0]],
      [0.1, feather.root[1], -feather.root[0]],
      [0.1, feather.tip[1], -feather.tip[0]],
    );
  });
  parts.push({
    inked: false,
    local: secondary,
    name: "Goldelse secondary wing feathers",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    inked: false,
    local: mirrored(secondary),
    name: "Goldelse secondary wing feathers",
    tone: GOLDELSE_GOLD,
  });
  const coverts: Local[] = [];
  for (let feather = 0; feather < 9; feather += 1) {
    const angle = -0.48 + feather * 0.12;
    const root: [number, number] = [0.48 + feather * 0.055, 4.67 + feather * 0.07];
    const length = 0.72 + feather * 0.045;
    coverts.push(
      ...featherPlate(
        root,
        [root[0] + Math.cos(angle) * length, root[1] + Math.sin(angle) * length + 0.4],
        0.25,
        0.12,
        0.12,
        0.03,
      ),
    );
  }
  parts.push({
    inked: false,
    local: coverts,
    name: "Goldelse layered wing coverts",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    inked: false,
    local: mirrored(coverts),
    name: "Goldelse layered wing coverts",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });

  // Her right arm rises in two anatomically legible segments to the laurel
  // wreath. The hand meets the lower edge of an annulus carrying real leaf
  // plates rather than relying on a few drawn ticks.
  const rightShoulder: Local = [0.08, SHOULDER_Y - 0.02, -0.62];
  const rightElbow: Local = [0.2, 5.34, -1.32];
  const rightHand: Local = [0.28, 6.68, -1.88];
  for (const [from, to, radius] of [
    [rightShoulder, rightElbow, 0.17],
    [rightElbow, rightHand, 0.145],
  ] as const) {
    parts.push({
      local: roundStrut(from, to, radius, 8),
      name: "Goldelse raised arm",
      tone: GOLDELSE_GOLD_HIGHLIGHT,
    });
  }
  parts.push({
    local: ellipsoid(rightHand, [0.15, 0.18, 0.13], 8, 4),
    name: "Goldelse wreath hand",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  const wreathCentreZ = -1.9;
  const wreathCentreY = 7.16;
  const wreathOuter = 0.5;
  parts.push({
    local: ringPlate(
      wreathCentreZ,
      wreathCentreY,
      wreathOuter,
      wreathOuter - 0.12,
      0.3,
      0.13,
      24,
    ),
    name: "Goldelse laurel wreath",
    tone: GOLDELSE_GOLD,
  });
  const LAUREL_LEAF_COUNT = 20;
  const laurelLeaves: Local[] = [];
  for (let leaf = 0; leaf < LAUREL_LEAF_COUNT; leaf += 1) {
    const angle = (leaf / LAUREL_LEAF_COUNT) * Math.PI * 2;
    const radius = wreathOuter - 0.035;
    const centreZ = wreathCentreZ + Math.cos(angle) * radius;
    const centreY = wreathCentreY + Math.sin(angle) * radius;
    laurelLeaves.push(
      ...plate(
        leafOutline(
          centreZ,
          centreY,
          angle + Math.PI / 2 + (leaf % 2 === 0 ? 0.22 : -0.22),
          0.24,
          0.1,
        ),
        0.37,
        0.07,
      ),
    );
    const leafAxis = angle + Math.PI / 2 + (leaf % 2 === 0 ? 0.22 : -0.22);
    inkLocal.push(
      [
        0.42,
        centreY - Math.sin(leafAxis) * 0.075,
        centreZ - Math.cos(leafAxis) * 0.075,
      ],
      [
        0.42,
        centreY + Math.sin(leafAxis) * 0.075,
        centreZ + Math.cos(leafAxis) * 0.075,
      ],
    );
  }
  parts.push({
    inked: false,
    local: laurelLeaves,
    name: "Goldelse individual laurel leaves",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });

  // Her left arm folds back across the chest to a tall field standard. The
  // photographs clearly show a circular frame around the Iron Cross, a leaf-
  // shaped finial above it and three long wind-blown ribbons.
  const leftShoulder: Local = [0.06, SHOULDER_Y - 0.02, 0.62];
  const leftElbow: Local = [0.22, 4.18, 1.12];
  const leftHand: Local = [0.3, 4.48, 0.82];
  for (const [from, to] of [
    [leftShoulder, leftElbow],
    [leftElbow, leftHand],
  ] as const) {
    parts.push({
      local: roundStrut(from, to, 0.16, 8),
      name: "Goldelse standard arm",
      tone: GOLDELSE_GOLD,
    });
  }
  parts.push({
    local: ellipsoid(leftHand, [0.14, 0.18, 0.13], 8, 4),
    name: "Goldelse standard hand",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  const standardZ = 0.82;
  const standardX = 0.29;
  parts.push({
    local: roundStrut(
      [standardX, 0.88, standardZ],
      [standardX, 7.92, standardZ],
      0.075,
      8,
    ),
    name: "Goldelse field standard",
    tone: GOLDELSE_GOLD_SHADED,
  });
  const standardRingY = 7.5;
  parts.push({
    local: ringPlate(standardZ, standardRingY, 0.43, 0.32, standardX, 0.12, 24),
    name: "Goldelse standard ring",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  for (const armOutline of ironCrossArms(0.27, standardZ, standardRingY)) {
    parts.push({
      inked: false,
      local: plate(armOutline, standardX + 0.07, 0.11),
      name: "Goldelse iron cross",
      tone: GOLDELSE_GOLD_SHADED,
    });
  }
  parts.push({
    local: plate(
      [
        [standardZ, 7.86],
        [standardZ + 0.16, 8.12],
        [standardZ, GOLDELSE_HEIGHT_M],
        [standardZ - 0.16, 8.12],
      ],
      standardX,
      0.12,
    ),
    name: "Goldelse field standard finial",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  const ribbons: Array<[Outline, Outline]> = [
    [
      [[0.76, 7.2], [1.06, 6.38], [1.14, 5.28]],
      [[0.87, 7.18], [1.19, 6.36], [1.29, 5.3]],
    ],
    [
      [[0.73, 7.18], [0.48, 6.3], [0.22, 5.3]],
      [[0.83, 7.16], [0.6, 6.28], [0.36, 5.28]],
    ],
    [
      [[0.81, 7.14], [0.86, 6.22], [0.61, 5.18]],
      [[0.91, 7.12], [0.98, 6.2], [0.75, 5.16]],
    ],
  ];
  const ribbonGeometry: Local[] = [];
  for (const [leading, trailing] of ribbons) {
    ribbonGeometry.push(...bladePlate(leading, trailing, standardX - 0.03, 0.07));
    for (let point = 0; point < leading.length - 1; point += 1) {
      const centre0: Local = [
        standardX + 0.04,
        (leading[point][1] + trailing[point][1]) / 2,
        (leading[point][0] + trailing[point][0]) / 2,
      ];
      const centre1: Local = [
        standardX + 0.04,
        (leading[point + 1][1] + trailing[point + 1][1]) / 2,
        (leading[point + 1][0] + trailing[point + 1][0]) / 2,
      ];
      inkLocal.push(centre0, centre1);
    }
  }
  parts.push({
    inked: false,
    local: ribbonGeometry,
    name: "Goldelse field standard ribbons",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });

  // Curved fold paths and the gathered waist retain fine legibility without
  // adding separate draw calls; the caller merges every part and line batch.
  for (const across of ROBE_FOLD_ACROSS) {
    const fold: Local[] = [
      [0.61, 3.54, across * 0.55],
      [0.64, 2.62, across * 0.66 + 0.08],
      [0.65, 1.55, across * 0.82 + 0.16],
      [0.63, 0.28, across],
    ];
    for (let point = 0; point < fold.length - 1; point += 1) {
      inkLocal.push(fold[point], fold[point + 1]);
    }
  }
  inkLocal.push(
    [0.64, 3.64, -0.55],
    [0.64, 3.64, 0.57],
    [0.36, 5.56, -0.28],
    [0.36, 5.56, 0.28],
    [0.38, 5.31, -0.12],
    [0.38, 5.31, 0.12],
  );

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
    metrics: {
      laurelLeafCount: LAUREL_LEAF_COUNT,
      primaryFeathersPerWing: PRIMARY_FEATHERS.length,
      robeFoldCount: ROBE_FOLD_ACROSS.length,
      secondaryFeathersPerWing: SECONDARY_FEATHERS.length,
      standardRibbonCount: STANDARD_RIBBON_COUNT,
    },
    parts: parts.map(({ inked, local, name, tone }) => ({
      inked,
      name,
      tone,
      triangles: flatten(local),
    })),
  };
}
