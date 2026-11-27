/**
 * The "Goldelse" — Friedrich Drake's gilded bronze Viktoria on top of the
 * Siegessäule, cast by Hermann Gladenbeck.
 *
 * Documented facts this model is built from (de.wikipedia "Siegessäule
 * (Berlin)"): the figure is 8.32 m tall and weighs 35 t; she "hält in der
 * Rechten einen Lorbeerkranz in die Höhe, in der Linken ein Feldzeichen mit
 * dem Eisernen Kreuz. Auf ihrem Helm sitzt ein Adler." Since the 1939 move
 * from the Königsplatz to the Großer Stern she faces WEST, towards today's
 * Ernst-Reuter-Platz — before the move she looked south. No
 * source positions are changed by the local silhouette refinement. The body,
 * drapery and feather subdivisions remain procedural display fits; see
 * the reference inventory in SiegessaeuleProfile for the available views.
 *
 * Everything is emitted in a local right-handed frame and mapped to world
 * coordinates by the caller, so the figure can be aimed down the Straße des
 * 17. Juni axis without duplicating trigonometry:
 *
 *   +x  the direction she faces (west)
 *   +y  up, 0 at the soles of her feet
 *   +z  the figure's own left — so the standard is at +z, the wreath at -z
 *
 * The wings carry overlapping primary and secondary feathers and coverts.
 * Each vane has a raised shaft and tapers into the swept rear silhouette.
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
  /** Drawn leaf veins as flat x,y,z pairs. */
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

type BodyRing = {
  y: number;
  x: number;
  z: number;
  depth: number;
  breadth: number;
};

/** Oval anatomical sections: fuller hips/chest with a gathered waist. */
const ROBE_RINGS: BodyRing[] = [
  { y: 0.16, x: -0.02, z: 0.1, depth: 0.74, breadth: 0.8 },
  { y: 0.62, x: -0.03, z: 0.11, depth: 0.76, breadth: 0.84 },
  { y: 1.18, x: -0.03, z: 0.1, depth: 0.73, breadth: 0.82 },
  { y: 1.78, x: 0.01, z: 0.07, depth: 0.7, breadth: 0.83 },
  { y: 2.38, x: 0.06, z: 0.02, depth: 0.67, breadth: 0.86 },
  { y: 2.94, x: 0.08, z: -0.02, depth: 0.69, breadth: 0.9 },
  { y: 3.38, x: 0.07, z: -0.02, depth: 0.63, breadth: 0.78 },
  { y: 3.68, x: 0.05, z: 0, depth: 0.57, breadth: 0.64 },
];
const TORSO_RINGS: BodyRing[] = [
  { y: 3.5, x: 0.05, z: 0, depth: 0.59, breadth: 0.66 },
  { y: 3.72, x: 0.07, z: 0, depth: 0.56, breadth: 0.63 },
  { y: 3.94, x: 0.1, z: 0, depth: 0.63, breadth: 0.72 },
  { y: 4.16, x: 0.12, z: 0, depth: 0.67, breadth: 0.79 },
  { y: 4.38, x: 0.09, z: 0, depth: 0.62, breadth: 0.78 },
  { y: 4.58, x: 0.04, z: 0, depth: 0.5, breadth: 0.69 },
  { y: 4.76, x: 0, z: 0, depth: 0.3, breadth: 0.36 },
];

/** Closed, finely faceted body, without a separate mesh per anatomical ring. */
function ovalLoft(rings: BodyRing[], segments = 24): Local[] {
  const triangles: Local[] = [];
  const point = (ring: BodyRing, index: number): Local => {
    const angle = index / segments * Math.PI * 2;
    return [ring.x + Math.cos(angle) * ring.depth, ring.y,
      ring.z + Math.sin(angle) * ring.breadth];
  };
  for (let row = 0; row < rings.length - 1; row += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = point(rings[row], segment), b = point(rings[row], segment + 1);
      const c = point(rings[row + 1], segment + 1), d = point(rings[row + 1], segment);
      triangles.push(a, b, c, a, c, d);
    }
  }
  const bottom = rings[0], top = rings[rings.length - 1];
  for (let segment = 0; segment < segments; segment += 1) {
    triangles.push([bottom.x, bottom.y, bottom.z], point(bottom, segment + 1), point(bottom, segment));
    triangles.push([top.x, top.y, top.z], point(top, segment), point(top, segment + 1));
  }
  return triangles;
}

/** The skirt opens around the forward knee and flies back into a rolled hem. */
function skirtPanels(): { front: Local[]; back: Local[]; hem: Local[] } {
  const front: Local[] = [], back: Local[] = [], hem: Local[] = [];
  const columns = 60;
  const point = (row: number, column: number): Local => {
    const ring = ROBE_RINGS[row];
    const angle = 2 * Math.PI * (column % columns) / columns - Math.PI / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    const low = Math.max(0, 1 - ring.y / 2.94);
    const train = low * low * (1 - c) / 2;
    const wave = Math.cos(SKIRT_FOLDS * angle + 0.61 * ring.y + 0.55 * s);
    const fold = 0.22 * low * wave;
    return [
      ring.x + c * (ring.depth + fold) - train * (1.35 + 0.29 * s) + low * 0.22 * Math.max(c, 0),
      ring.y + low * low * (0.14 * (1 + wave) + 0.49 * train),
      ring.z + s * (ring.breadth + fold + 0.3 * low) + 0.46 * train,
    ];
  };
  for (let column = 0; column < columns; column++) {
    const side = column < columns / 2 ? front : back;
    for (let row = 0; row < ROBE_RINGS.length - 1; row++) {
      const a = point(row, column), b = point(row, column + 1);
      const c = point(row + 1, column + 1), d = point(row + 1, column);
      side.push(a, b, c, a, c, d);
    }
    const a = point(0, column), b = point(0, column + 1);
    const inward = ([x, y, z]: Local): Local => [0.84 * x, y + 0.11, 0.84 * z];
    const innerA = inward(a), innerB = inward(b);
    hem.push(a, innerA, innerB, a, innerB, b, innerA, [0, 0.42, 0.1], innerB);
  }
  return { front, back, hem };
}

/** Drapery follows the oval volume, with small raised folds instead of a flat bib. */
function gatheredDrapery(rings: BodyRing[], folds: number): Local[] {
  const columns = folds * 4;
  const triangles: Local[] = [];
  const point = (row: number, column: number): Local => {
    const ring = rings[row];
    const t = column / columns;
    const across = (t * 2 - 1) * 0.88;
    // Slight diagonal gathering and rounded ridges describe cast fabric; the
    // bounded offsets are not claimed as measured folds in Drake's bronze.
    const phase = t * folds * Math.PI * 2 + (t - 0.5) * row * 0.78;
    const ridge = 0.025 + (0.5 + Math.cos(phase) * 0.5) * 0.085;
    return [ring.x + ring.depth * Math.sqrt(1 - across * across) + ridge,
      ring.y + (Math.cos(t * Math.PI * 2) + 1) * (row / (rings.length - 1)) * -0.075,
      ring.z + ring.breadth * across];
  };
  for (let row = 0; row < rings.length - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = point(row, column), b = point(row, column + 1);
      const c = point(row + 1, column + 1), d = point(row + 1, column);
      triangles.push(a, b, c, a, c, d);
    }
  }
  return triangles;
}

/** The short belted overfold hangs free around the hips, including the rear. */
function overfall(): Local[] {
  const result: Local[] = [];
  const segments = 40;
  const point = (row: number, segment: number): Local => {
    const angle = segment % segments / segments * Math.PI * 2;
    const t = row / 4, flare = 1 - t, across = Math.sin(angle), front = Math.cos(angle);
    const wave = Math.cos(8 * angle + 0.55 * t);
    const edgeY = 2.66 + front * 0.18 - across * 0.21 + 0.19 * wave;
    const relief = flare * (0.12 + 0.11 * wave);
    return [0.08 + front * (0.60 + 0.22 * flare + relief),
      edgeY + (3.76 - edgeY) * t, across * (0.66 + 0.27 * flare + relief)];
  };
  for (let segment = 0; segment < segments; segment++) {
    for (let row = 0; row < 4; row++) {
      const a = point(row, segment), b = point(row, segment + 1);
      const c = point(row + 1, segment + 1), d = point(row + 1, segment);
      result.push(a, b, c, a, c, d);
    }
  }
  return result;
}

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

/** A low-poly round limb or rod between two arbitrary points. */
function roundStrut(
  from: Local,
  to: Local,
  radius: number,
  segments = 8,
  endRadius = radius,
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
  const ring = (centre: Local, angle: number, r: number): Local => [
    centre[0] + r * (u[0] * Math.cos(angle) + v[0] * Math.sin(angle)),
    centre[1] + r * (u[1] * Math.cos(angle) + v[1] * Math.sin(angle)),
    centre[2] + r * (u[2] * Math.cos(angle) + v[2] * Math.sin(angle)),
  ];
  const triangles: Local[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle0 = (index / segments) * Math.PI * 2;
    const angle1 = ((index + 1) / segments) * Math.PI * 2;
    const from0 = ring(from, angle0, radius);
    const from1 = ring(from, angle1, radius);
    const to0 = ring(to, angle0, endRadius);
    const to1 = ring(to, angle1, endRadius);
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

/** Sweep away from the shoulder and rise towards the outermost primaries. */
function wingPoint(depth: number, y: number, across: number): Local {
  const span = Math.max(0, (across - 0.46) / 3.02);
  return [depth - 0.31 - 0.7 * span - 1.82 * span * span,
    y + 0.28 * span + 1.99 * span * span, across];
}

/** Closed vanes with a raised shaft, two sloping webs and a rounded tip. */
function featherPlate(
  root: [number, number], tip: [number, number], width: number,
  atX: number, thickness: number, bowY = 0,
): Local[] {
  const dz = tip[0] - root[0], dy = tip[1] - root[1];
  const length = Math.hypot(dz, dy);
  const vertices: Local[] = [];
  let previous: Local[] = [];
  const sections = length > 2.0 ? 5 : length > 1.0 ? 4 : 3;
  for (let step = 0; step <= sections; step++) {
    const t = step / sections;
    const z = root[0] + dz * t, y = root[1] + dy * t + bowY * 4 * t * (1 - t);
    const w = width * (0.4 + 0.31 * Math.sin(Math.PI * t) - 0.31 * t);
    const sideY = dz / length * w, sideZ = -dy / length * w;
    const ring = [
      wingPoint(atX + thickness * (1 - 0.5 * t), y, z),
      wingPoint(atX, y - sideY, z - sideZ),
      wingPoint(atX - thickness * 0.46, y, z),
      wingPoint(atX, y + sideY, z + sideZ),
    ];
    if (step === 0) vertices.push(ring[0], ring[2], ring[1], ring[0], ring[3], ring[2]);
    else for (let edge = 0; edge < 4; edge++) {
      const next = (edge + 1) % 4;
      vertices.push(previous[edge], previous[next], ring[next], previous[edge], ring[next], ring[edge]);
    }
    previous = ring;
  }
  vertices.push(previous[0], previous[1], previous[2], previous[0], previous[2], previous[3]);
  return vertices;
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
 * shoulder blade. The exposed feathers continue past this support.
 */
const WING_LEADING: Outline = [
  [0.46, 4.72],
  [0.96, 4.62],
  [1.52, 4.32],
  [1.86, 4.13],
  [2.04, 4.06],
];
const WING_TRAILING: Outline = [
  [0.5, 4.3],
  [0.98, 3.76],
  [1.52, 3.34],
  [1.72, 3.34],
  [1.86, 3.29],
];

const PRIMARY_FEATHERS: Array<{
  bowY: number;
  root: [number, number];
  tip: [number, number];
  width: number;
}> = [
  { bowY: -0.08, root: [0.9, 4.66], tip: [3.48, 3.95], width: 0.3 },
  { bowY: -0.12, root: [0.94, 4.54], tip: [3.43, 3.7], width: 0.29 },
  { bowY: -0.14, root: [0.98, 4.42], tip: [3.36, 3.45], width: 0.28 },
  { bowY: -0.16, root: [1.02, 4.3], tip: [3.27, 3.21], width: 0.28 },
  { bowY: -0.18, root: [1.05, 4.18], tip: [3.1, 2.99], width: 0.27 },
  { bowY: -0.2, root: [1.08, 4.08], tip: [2.88, 2.82], width: 0.26 },
  { bowY: -0.21, root: [1.08, 4], tip: [2.62, 2.74], width: 0.25 },
  { bowY: -0.21, root: [1.06, 3.92], tip: [2.34, 2.72], width: 0.24 },
  { bowY: -0.19, root: [1.02, 3.84], tip: [2.06, 2.78], width: 0.23 },
  { bowY: -0.16, root: [0.96, 3.78], tip: [1.78, 2.9], width: 0.22 },
];

const SECONDARY_FEATHERS: Array<{
  root: [number, number];
  tip: [number, number];
  width: number;
}> = [
  { root: [0.56, 4.69], tip: [2.4, 4.03], width: 0.31 },
  { root: [0.54, 4.58], tip: [2.22, 3.84], width: 0.31 },
  { root: [0.53, 4.47], tip: [2.03, 3.65], width: 0.3 },
  { root: [0.52, 4.36], tip: [1.83, 3.46], width: 0.29 },
  { root: [0.51, 4.25], tip: [1.63, 3.29], width: 0.28 },
  { root: [0.5, 4.14], tip: [1.43, 3.15], width: 0.27 },
  { root: [0.5, 4.03], tip: [1.23, 3.04], width: 0.25 },
  { root: [0.5, 3.92], tip: [1.05, 3.04], width: 0.23 },
];

const SKIRT_FOLDS = 10;
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
  const waist = arm * 0.23;
  const tip = arm * 0.50;
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
      local: ovalLoft([
        { x: back ? -0.1 : 0.58, y: 0, z, depth: 0.46, breadth: 0.15 },
        { x: back ? -0.1 : 0.58, y: 0.10, z, depth: 0.46, breadth: 0.18 },
        { x: back ? -0.18 : 0.49, y: 0.25, z, depth: 0.24, breadth: 0.13 },
      ], 8),
      inked: false,
      name: "Goldelse 0.92 m shoe",
      tone: back ? GOLDELSE_GOLD_SHADED : GOLDELSE_GOLD_HIGHLIGHT,
    });
    parts.push({
      local: roundStrut([back ? -0.17 : 0.47, 0.24, z], [0.04, 2.55, z * 0.7], 0.17, 7),
      name: "Goldelse standing leg",
      tone: back ? GOLDELSE_GOLD_DEEP : GOLDELSE_GOLD,
    });
  }

  const skirt = skirtPanels();
  parts.push({
    inked: false,
    local: skirt.back,
    name: "Goldelse robe",
    tone: GOLDELSE_GOLD_SHADED,
  });
  parts.push({
    inked: false,
    local: skirt.front,
    name: "Goldelse wind-filled robe front",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: skirt.hem,
    inked: false,
    name: "Goldelse wind-filled robe train",
    tone: GOLDELSE_GOLD_SHADED,
  });
  parts.push({
    inked: false,
    local: ovalLoft(TORSO_RINGS),
    name: "Goldelse torso",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    inked: false,
    local: gatheredDrapery(TORSO_RINGS, 5),
    name: "Goldelse gathered bodice",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    inked: false,
    local: overfall(),
    name: "Goldelse folded overfall",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: [
      ...roundStrut([0, SHOULDER_Y, -0.7], [0, SHOULDER_Y, 0.7], 0.24, 12),
      ...roundStrut([0.08, 4.62, -0.61], [0.27, 5.03, -1.21], 0.22, 14, 0.32),
      ...roundStrut([0.06, 4.63, 0.6], [0.19, 4.25, 0.82], 0.25, 14, 0.30),
    ],
    inked: false,
    name: "Goldelse shoulders",
    tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: taperedPrism(0, 4.72, 4.98, 0.22, 0.21, 16),
    inked: false,
    name: "Goldelse neck",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  // The bare chin, cheekbones and the undercut brim stay separate at tour distance.
  const head = ellipsoid([0.04, HEAD_CENTRE_Y, 0], [0.34, 0.46, 0.33], 20, 12);
  parts.push({
    local: head.map(([x, y, z]) => {
      const jaw = Math.min(1, Math.max(0, (5.37 - y) / 0.44));
      return [x + 0.11 * jaw, y, z * (1 - 0.38 * jaw)];
    }),
    inked: false, name: "Goldelse head", tone: GOLDELSE_GOLD,
  });
  const face: Local[] = ovalLoft([
    { x: 0.385, y: 5.22, z: 0, depth: 0.082, breadth: 0.072 },
    { x: 0.438, y: 5.255, z: 0, depth: 0.070, breadth: 0.058 },
    { x: 0.392, y: 5.36, z: 0, depth: 0.067, breadth: 0.043 },
    { x: 0.344, y: 5.48, z: 0, depth: 0.049, breadth: 0.059 },
  ], 8);
  const hair = ellipsoid([-0.16, 5.24, 0], [0.25, 0.46, 0.34], 14, 8);
  for (const side of [-1, 1]) {
    face.push(...roundStrut([0.384, 5.43, 0.04 * side], [0.298, 5.445, 0.227 * side], 0.040, 8, 0.026));
    face.push(...ellipsoid([0.347, 5.367, 0.142 * side], [0.031, 0.029, 0.075], 8, 4));
    hair.push(...ellipsoid([0.374, 5.36, 0.14 * side], [0.012, 0.018, 0.024], 6, 4));
    for (let lock = 0; lock < 3; lock++) {
      hair.push(...roundStrut([0.11 - lock * 0.105, 5.55, (0.27 + 0.018 * lock) * side],
        [-0.04 - lock * 0.10, 4.87 + 0.04 * lock, (0.39 + 0.02 * lock) * side], 0.083, 6, 0.046));
    }
  }
  face.push(...ellipsoid([0.363, 5.115, 0], [0.038, 0.036, 0.094], 10, 4));
  parts.push({ local: face, inked: false, name: "Goldelse face and nose", tone: GOLDELSE_GOLD });
  parts.push({ local: hair, inked: false, name: "Goldelse hair mass", tone: GOLDELSE_GOLD_DEEP });

  const brim = ovalLoft([
    { x: 0.025, y: 5.58, z: 0, depth: 0.40, breadth: 0.36 },
    { x: 0.04, y: 5.69, z: 0, depth: 0.42, breadth: 0.37 },
  ], 18);
  parts.push({
    local: brim.map(([x, y, z]) => [x, y + x * 0.18 - z * z * 0.36, z]),
    inked: false, name: "Goldelse helmet brim", tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    local: ovalLoft([
      { x: 0, y: 5.63, z: 0, depth: 0.39, breadth: 0.36 },
      { x: -0.02, y: 5.81, z: 0, depth: 0.33, breadth: 0.31 },
      { x: -0.05, y: 5.97, z: 0, depth: 0.21, breadth: 0.20 },
      { x: -0.06, y: HELMET_TOP_Y, z: 0, depth: 0.1, breadth: 0.08 },
    ], 16),
    inked: false, name: "Goldelse helmet", tone: GOLDELSE_GOLD,
  });
  parts.push({
    local: [
      ...ellipsoid([-0.05, 6.16, 0], [0.13, 0.15, 0.105], 10, 5),
      ...ellipsoid([0.035, 6.28, 0], [0.086, 0.10, 0.078], 8, 4),
      ...roundStrut([0.085, 6.29, 0], [0.194, 6.26, -0.015], 0.047, 6, 0.009),
    ],
    inked: false, name: "Goldelse helmet eagle body", tone: GOLDELSE_GOLD,
  });
  for (const side of [-1, 1]) {
    const wing = bladePlate([[0.04, 6.17], [0.23, 6.36], [0.42, 6.43], [0.64, 6.39]],
      [[0.04, 6.11], [0.24, 6.22], [0.39, 6.26], [0.64, 6.34]], -0.06, 0.055);
    for (let feather = 0; feather < 4; feather++) {
      const root = 0.22 + 0.085 * feather;
      wing.push(...plate([[root, 6.30], [root + 0.066, 6.22 + 0.016 * feather],
        [root + 0.125, 6.30 + 0.01 * feather]], -0.06, 0.045));
    }
    parts.push({ local: side === 1 ? wing : mirrored(wing),
      inked: false, name: "Goldelse helmet eagle wing", tone: GOLDELSE_GOLD_HIGHLIGHT });
  }

  // Two broad wing fans. A shaded structural blade preserves the silhouette;
  // individually edged primary, secondary and covert feathers supply the
  // layered anatomy that is unmistakable in the close reference view.
  const leftWing = bladePlate(WING_LEADING, WING_TRAILING, -0.1, 0.24)
    .map(([x, y, z]) => wingPoint(x, y, z));
  parts.push({ inked: false, local: leftWing, name: "Goldelse wing", tone: GOLDELSE_GOLD });
  parts.push({
    inked: false,
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
    const angle = -0.42 - feather * 0.09;
    const root: [number, number] = [0.5 + feather * 0.055, 4.67 - feather * 0.045];
    const length = 0.62 + feather * 0.025;
    coverts.push(
      ...featherPlate(
        root,
        [root[0] + Math.cos(angle) * length, root[1] + Math.sin(angle) * length],
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
  const rightElbow: Local = [0.52, 5.61, -1.98];
  const rightHand: Local = [0.92, 7.1, -2.34];
  for (const [from, to, radius, tip] of [
    [rightShoulder, rightElbow, 0.26, 0.185],
    [rightElbow, rightHand, 0.205, 0.115],
  ] as const) {
    parts.push({
      local: roundStrut(from, to, radius, 16, tip),
      inked: false,
      name: "Goldelse raised arm",
      tone: GOLDELSE_GOLD_HIGHLIGHT,
    });
  }
  parts.push({
    local: ellipsoid(rightHand, [0.16, 0.19, 0.13], 10, 6),
    inked: false,
    name: "Goldelse wreath hand",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  const wreathCentreZ = -2.35;
  const wreathCentreY = 7.58;
  const wreathOuter = 0.5;
  parts.push({
    local: ringPlate(
      wreathCentreZ,
      wreathCentreY,
      wreathOuter,
      wreathOuter - 0.085,
      0.92,
      0.09,
      24,
    ),
    inked: false,
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
    const branch = Math.cos(angle) >= 0 ? 1 : -1;
    const leafAxis = angle + branch * (Math.PI / 2 + (leaf % 2 === 0 ? 0.55 : -0.48));
    laurelLeaves.push(
      ...plate(
        leafOutline(
          centreZ,
          centreY,
          leafAxis,
          0.32,
          0.13,
        ),
        0.97,
        0.06,
      ),
    );
    inkLocal.push(
      [
        1.01,
        centreY - Math.sin(leafAxis) * 0.075,
        centreZ - Math.cos(leafAxis) * 0.075,
      ],
      [
        1.01,
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
  const leftElbow: Local = [0.29, 3.71, 1.03];
  const leftHand: Local = [0.51, 4.82, 0.89];
  for (const [from, to] of [
    [leftShoulder, leftElbow],
    [leftElbow, leftHand],
  ] as const) {
    parts.push({
      local: roundStrut(from, to, 0.20, 16, 0.145),
      inked: false,
      name: "Goldelse standard arm",
      tone: GOLDELSE_GOLD,
    });
  }
  parts.push({
    local: ellipsoid(leftHand, [0.15, 0.175, 0.145], 10, 6),
    inked: false,
    name: "Goldelse standard hand",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  parts.push({
    inked: false,
    local: [
      ...ellipsoid(rightElbow, [0.19, 0.20, 0.19], 10, 5),
      ...ellipsoid(leftElbow, [0.17, 0.19, 0.17], 10, 5),
    ],
    name: "Goldelse rounded elbows",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  const standardZ = 1.14;
  const standardX = 0.59;
  parts.push({
    local: roundStrut(
      [0.46, 3.16, 0.75],
      [standardX, 7.19, standardZ],
      0.075,
      8,
    ),
    inked: false,
    name: "Goldelse field standard",
    tone: GOLDELSE_GOLD_SHADED,
  });
  const standardRingY = 7.55;
  parts.push({
    local: ringPlate(standardZ, standardRingY, 0.405, 0.347, standardX, 0.12, 24),
    inked: false,
    name: "Goldelse standard ring",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  for (const armOutline of ironCrossArms(0.337, standardZ, standardRingY)) {
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
    inked: false,
    name: "Goldelse field standard finial",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });
  const ribbonGeometry: Local[] = [];
  for (let ribbon = 0; ribbon < STANDARD_RIBBON_COUNT; ribbon++) {
    const edge = (step: number, side: number): Local => {
      const t = step / 7, turn = t * (3.6 + ribbon * 0.52) + ribbon * 1.77;
      const bow = Math.sin(Math.PI * t);
      return [standardX - (0.23 + 0.54 * Math.cos(turn)) * bow + side * 0.07 * Math.cos(turn),
        7.22 - t * (2.28 + 0.10 * ribbon),
        standardZ + (0.39 + 0.64 * Math.sin(turn)) * bow + side * 0.07 * Math.sin(turn)];
    };
    for (let step = 0; step < 7; step++) {
      const a = edge(step, -1), b = edge(step, 1), c = edge(step + 1, 1), d = edge(step + 1, -1);
      ribbonGeometry.push(a, b, c, a, c, d, a, c, b, a, d, c);
    }
  }
  parts.push({
    inked: false,
    local: ribbonGeometry,
    name: "Goldelse field standard ribbons",
    tone: GOLDELSE_GOLD_HIGHLIGHT,
  });

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
      robeFoldCount: SKIRT_FOLDS,
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
