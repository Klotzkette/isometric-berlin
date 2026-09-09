/** Exact committed OSM axes; height ordinates preserve the prior DGM-linked profile.
 * The 5m relative upper path envelope is a documented landscape display value,
 * not a survey of every intermediate section. */
export const LUDWIG_ERHARD_UFER_WORLD_M = [
  [268.89, 1.692, -317.78],
  [240.53, 1.86, -345.51],
  [198.6, 2.086, -376.21],
  [154.86, 2.237, -397.92],
  [123.4, 1.982, -409.83],
  [106.26, 2.16, -414.97],
  [86.51, 2.164, -419.46],
  [75.63, 2.129, -420.57],
  [41.91, 2.308, -421.66],
  [23.85, 2.362, -421.39],
  [15.07, 2.353, -420.69],
  [-0.7, 2.382, -418.45],
  [-36.98, 2.35, -409.76],
  [-60.73, 2.101, -398.32],
  [-88.06, 1.867, -381.07],
  [-101.12, 1.864, -369.88],
  [-117.12, 1.927, -353.66],
  [-120.98, 2.005, -348.44],
  [-121.24, 2.031, -343.09],
  [-122.65, 2.081, -340.58],
  [-124.93, 2.139, -337.69],
  [-129.97, 2.066, -336.05],
  [-139.87, 2.214, -323.67],
] as const;

export const PANORAMAWEG_WORLD_M = [
  [-124.22, -325.56],
  [-98.49, -360.63],
  [-84.53, -372.27],
  [-70.48, -381.67],
  [-55.74, -390.26],
  [-46.62, -394.77],
  [-38.07, -398.56],
  [-20.48, -405.16],
  [-7.26, -408.73],
  [8.02, -411.42],
  [22.26, -412.29],
  [51.8, -412.48],
  [78.25, -411.51],
  [94.85, -409.16],
  [121.64, -402.9],
  [137.36, -397.98],
  [154.08, -391.58],
] as const;

export type SpreebogenPoint = readonly [number, number];

export const SPREEBOGEN_SHORE_WORLD_M: readonly SpreebogenPoint[] = [
  [-145.7, -328.7],
  [-132.1, -350.9],
  [-127.1, -358.1],
  [-123.1, -363.4],
  [-117.7, -369.8],
  [-109.4, -378.8],
  [-96.7, -389.4],
  [-90.4, -393.9],
  [-83.6, -398.3],
  [-74.6, -403.3],
  [-61.6, -410],
  [-50.1, -415.4],
  [-34.6, -422],
  [-23.7, -425.3],
  [-16.5, -427.2],
  [-3.7, -430.1],
  [7.2, -432],
  [17.1, -433.2],
  [26.1, -433.8],
  [41.1, -434.2],
  [54.9, -434],
  [68.3, -432.6],
  [77.1, -432],
  [93.6, -429.7],
  [116.9, -425.2],
  [141.9, -417.7],
  [159, -410.7],
  [169.2, -405.6],
  [176.3, -401.5],
  [182.9, -397.9],
  [200, -386.7],
  [214.7, -375.6],
  [234.1, -359.7],
  [245.2, -349.8],
  [252, -343.5],
  [268.3, -328],
  [274.7, -321],
];

export const SPREEBOGEN_BANK_SOURCES = {
  park: "https://www.openstreetmap.org/way/737280675",
  lowerPaths: [
    "https://www.openstreetmap.org/way/34834265",
    "https://www.openstreetmap.org/way/1128036906",
  ],
  upperPath: "https://www.openstreetmap.org/way/4395332",
  officialDescription:
    "https://www.berlin.de/sen/uvk/natur-und-gruen/landschaftsplanung/gruene-hauptwege/die-wege-im-ueberblick/artikel.930432.php",
  heightStatus:
    "Lower path ordinates retained from the committed profile; continuous grading and the upper-to-lower envelope up to 5m are procedural display interpolation, not new DGM measurements",
  shoreStatus:
    "Exact retained decimetre vertices of the three committed OSM river surface rings; source data are unchanged",
} as const;

function nearest(
  path: readonly SpreebogenPoint[],
  x: number,
  z: number,
): { index: number; t: number; distance: number } {
  let best = { index: 0, t: 0, distance: Infinity };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)),
    );
    const distance = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    if (distance < best.distance) best = { index: i, t, distance };
  }
  return best;
}
const lower2d = LUDWIG_ERHARD_UFER_WORLD_M.map((p) => [p[0], p[2]] as const);
export const SPREEBOGEN_BANK_BOUNDS = {
  minX: -148,
  maxX: 278,
  minZ: -439,
  maxZ: -230,
} as const;
const inBounds = (x: number, z: number): boolean =>
  x >= SPREEBOGEN_BANK_BOUNDS.minX &&
  x <= SPREEBOGEN_BANK_BOUNDS.maxX &&
  z >= SPREEBOGEN_BANK_BOUNDS.minZ &&
  z <= SPREEBOGEN_BANK_BOUNDS.maxZ;

export function spreebogenLowerPathYAt(x: number, z: number): number {
  const q = nearest(lower2d, x, z),
    a = LUDWIG_ERHARD_UFER_WORLD_M[q.index],
    b = LUDWIG_ERHARD_UFER_WORLD_M[q.index + 1];
  return a[1] + (b[1] - a[1]) * q.t;
}

/** Lower promenade and the actual land strip to its OSM shore only. */
export function spreebogenPromenadeYAt(x: number, z: number): number | null {
  if (!inBounds(x, z)) return null;
  const q = nearest(lower2d, x, z),
    a = lower2d[q.index],
    b = lower2d[q.index + 1];
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const inland = ((x - a[0]) * dz - (z - a[1]) * dx) / length;
  // A round endcap is deliberately not extended along another bank.
  if (q.distance > 18 || inland > 2.12) return null;
  const shore = nearest(SPREEBOGEN_SHORE_WORLD_M, x, z);
  const sa = SPREEBOGEN_SHORE_WORLD_M[shore.index],
    sb = SPREEBOGEN_SHORE_WORLD_M[shore.index + 1];
  const shoreInland =
    ((x - sa[0]) * (sb[1] - sa[1]) - (z - sa[1]) * (sb[0] - sa[0])) /
    Math.hypot(sb[0] - sa[0], sb[1] - sa[1]);
  // Shore runs west -> east; its land lies to the right/south.
  if (shoreInland > 0.15) return null;
  return ribbonYAt(lowerSections, x, z) ?? spreebogenLowerPathYAt(x, z) + 0.055;
}

/** Optional replacement for coarse terrain only in the owned promenade strip. */
export function spreebogenTerrainYAt(
  x: number,
  z: number,
  fallback: number,
): number {
  return spreebogenPromenadeYAt(x, z) ?? spreebogenParkGradeAt(x, z, fallback);
}

/** Quay stone cap at the retained shoreline; all other banks keep their sampler. */
export function spreebogenBankTopAt(x: number, z: number): number | null {
  if (!inBounds(x, z) || nearest(SPREEBOGEN_SHORE_WORLD_M, x, z).distance > 4.5)
    return null;
  return spreebogenLowerPathYAt(x, z) + 0.1;
}

export function spreebogenPanoramaYAt(index: number): number {
  const [x, z] = PANORAMAWEG_WORLD_M[index];
  const t = index / (PANORAMAWEG_WORLD_M.length - 1);
  return (
    spreebogenLowerPathYAt(x, z) + 0.15 + 4.85 * Math.sin(t * Math.PI) ** 0.72
  );
}

/** The same triangulated cross-section used by rendered path and navigation. */
export function spreebogenWalkSurfaceAt(
  x: number,
  z: number,
  currentY = Infinity,
  minecraft = false,
  mobileLike = false,
): number | null {
  if (!inBounds(x, z)) return null;
  if (minecraft) {
    const profile = minecraftPathProfile(mobileLike);
    const key = `${Math.floor(x / profile.step)}:${Math.floor(z / profile.step)}`;
    const upper = profile.upper.get(key);
    if (upper && currentY >= upper.y - 0.65) return upper.y;
    return profile.lower.get(key)?.y ?? spreebogenPromenadeYAt(x, z);
  }
  const lower = spreebogenPromenadeYAt(x, z);
  const q = nearest(PANORAMAWEG_WORLD_M, x, z);
  if (q.distance <= 1.2) {
    const upper = ribbonYAt(upperSections, x, z);
    if (upper !== null && currentY >= upper - 0.65) return upper;
  }
  return lower;
}

/** Only displayed coarse cells under the replacement strip / intersecting its shore. */
export function isSpreebogenRasterReplacementAt(
  x: number,
  z: number,
  cell: number,
): boolean {
  if (!inBounds(x, z)) return false;
  return (
    inPark(x, z) ||
    spreebogenPromenadeYAt(x, z) !== null ||
    nearest(SPREEBOGEN_SHORE_WORLD_M, x, z).distance <= cell * Math.SQRT1_2
  );
}

export type SpreebogenPathSection = {
  left: [number, number, number];
  right: [number, number, number];
  centre: [number, number, number];
};
export function spreebogenPathSections(
  path: readonly SpreebogenPoint[],
  height: (i: number) => number,
  width: number,
): SpreebogenPathSection[] {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz) || 1;
    return {
      left: [
        p[0] - ((dz / length) * width) / 2,
        height(i),
        p[1] + ((dx / length) * width) / 2,
      ],
      right: [
        p[0] + ((dz / length) * width) / 2,
        height(i),
        p[1] - ((dx / length) * width) / 2,
      ],
      centre: [p[0], height(i), p[1]],
    };
  });
}
function ribbonYAt(
  profile: readonly SpreebogenPathSection[],
  x: number,
  z: number,
): number | null {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i],
      b = profile[i + 1];
    for (const [p, q, r] of [
      [a.left, b.left, b.right],
      [a.left, b.right, a.right],
    ]) {
      const dx = q[0] - p[0],
        dz = q[2] - p[2],
        ex = r[0] - p[0],
        ez = r[2] - p[2],
        den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const u = ((x - p[0]) * ez - (z - p[2]) * ex) / den,
        v = (dx * (z - p[2]) - dz * (x - p[0])) / den;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
        return p[1] + u * (q[1] - p[1]) + v * (r[1] - p[1]);
    }
  }
  return null;
}
const lowerSections = spreebogenPathSections(
  lower2d,
  (i) => LUDWIG_ERHARD_UFER_WORLD_M[i][1] + 0.09,
  4,
);
const upperSections = spreebogenPathSections(
  PANORAMAWEG_WORLD_M,
  (i) => spreebogenPanoramaYAt(i) + 0.11,
  2.4,
);

export type SpreebogenMinecraftPathCell = {
  x: number;
  y: number;
  z: number;
  size: number;
  kind: "lower" | "upper";
};
type MinecraftPathProfile = {
  step: number;
  lower: Map<string, SpreebogenMinecraftPathCell>;
  upper: Map<string, SpreebogenMinecraftPathCell>;
};
const minecraftPathProfiles = new Map<boolean, MinecraftPathProfile>();

/** Clip a source triangle against a voxel cell, retaining its interpolated Y. */
function clippedPathTriangle(
  triangle: readonly number[][],
  x0: number,
  z0: number,
  step: number,
): number[][] {
  let polygon = triangle.map((p) => [...p]);
  for (const [axis, boundary, direction] of [
    [0, x0, 1], [0, x0 + step, -1], [2, z0, 1], [2, z0 + step, -1],
  ]) {
    const clipped: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = (a[axis] - boundary) * direction >= 0;
      const insideB = (b[axis] - boundary) * direction >= 0;
      if (insideA) clipped.push(a);
      if (insideA !== insideB) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis]);
        clipped.push(a.map((value, d) => value + (b[d] - value) * t));
      }
    }
    polygon = clipped;
    if (!polygon.length) break;
  }
  return polygon;
}

function minecraftPathProfile(mobileLike: boolean): MinecraftPathProfile {
  const cached = minecraftPathProfiles.get(mobileLike);
  if (cached) return cached;
  const step = mobileLike ? 2 : 1.4;
  const result: MinecraftPathProfile = { step, lower: new Map(), upper: new Map() };
  for (const kind of ["lower", "upper"] as const) {
    const sections = kind === "lower" ? lowerSections : upperSections;
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i], b = sections[i + 1];
      for (const triangle of [[a.left, b.left, b.right], [a.left, b.right, a.right]]) {
        const x0 = Math.floor(Math.min(...triangle.map((p) => p[0])) / step);
        const x1 = Math.floor(Math.max(...triangle.map((p) => p[0])) / step);
        const z0 = Math.floor(Math.min(...triangle.map((p) => p[2])) / step);
        const z1 = Math.floor(Math.max(...triangle.map((p) => p[2])) / step);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
          const clipped = clippedPathTriangle(triangle, x * step, z * step, step);
          let area = 0;
          for (let k = 0; k < clipped.length; k++) {
            const p = clipped[k], q = clipped[(k + 1) % clipped.length];
            area += p[0] * q[2] - p[2] * q[0];
          }
          if (Math.abs(area) < 1e-8) continue;
          const y = clipped.reduce((sum, p) => sum + p[1], 0) / clipped.length;
          const key = `${x}:${z}`;
          if ((result[kind].get(key)?.y ?? -Infinity) >= y) continue;
          result[kind].set(key, { x: (x + 0.5) * step, y, z: (z + 0.5) * step, size: step, kind });
        }
      }
    }
  }
  minecraftPathProfiles.set(mobileLike, result);
  return result;
}

/** Every cell intersecting a path has a deck; rendering and walking share its top. */
export function spreebogenMinecraftPathCells(mobileLike = false): readonly SpreebogenMinecraftPathCell[] {
  const profile = minecraftPathProfile(mobileLike);
  return [...profile.lower.values(), ...profile.upper.values()];
}

export const SPREEBOGEN_PARK_RING_DM = [
  [1419, -4177],
  [1829, -3979],
  [2000, -3867],
  [2341, -3597],
  [2747, -3210],
  [2462, -3036],
  [1573, -2304],
  [1451, -2306],
  [197, -2338],
  [208, -2730],
  [-307, -2736],
  [-318, -2349],
  [-483, -2352],
  [-1457, -3287],
  [-1271, -3581],
  [-1094, -3788],
  [-836, -3983],
  [-346, -4220],
  [-37, -4301],
  [261, -4338],
  [549, -4340],
  [1169, -4252],
  [1419, -4177],
] as const;

export function isSpreebogenParkSurface(surface: {
  name?: string;
  ring: readonly (readonly number[])[];
}): boolean {
  return (
    surface.name === "Spreebogenpark" &&
    surface.ring.length === SPREEBOGEN_PARK_RING_DM.length &&
    surface.ring.every(
      (p, i) =>
        p[0] === SPREEBOGEN_PARK_RING_DM[i][0] &&
        p[1] === SPREEBOGEN_PARK_RING_DM[i][1],
    )
  );
}
function inPark(x: number, z: number): boolean {
  let inside = false;
  for (
    let i = 0, j = SPREEBOGEN_PARK_RING_DM.length - 1;
    i < SPREEBOGEN_PARK_RING_DM.length;
    j = i++
  ) {
    const a = SPREEBOGEN_PARK_RING_DM[i],
      b = SPREEBOGEN_PARK_RING_DM[j],
      ax = a[0] / 10,
      az = a[1] / 10,
      bx = b[0] / 10,
      bz = b[1] / 10;
    // ShapeGeometry stores float32 vertices. Treat the retained source boundary
    // as inside despite sub-millimetre rounding, or its edge vertices fall back
    // to the old high terrain and create spikes along the river.
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 0.0001) return true;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}
/** Local presentation terrain, retaining the source grid elsewhere. */
export function spreebogenParkGradeAt(
  x: number,
  z: number,
  fallback: number,
): number {
  if (!inBounds(x, z) || !inPark(x, z)) return fallback;
  const q = nearest(lower2d, x, z),
    a = lower2d[q.index],
    b = lower2d[q.index + 1],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const inland = ((x - a[0]) * dz - (z - a[1]) * dx) / length;
  if (inland < 14 && q.distance < 20) {
    const lower = spreebogenLowerPathYAt(x, z) + 0.015;
    const t = Math.max(0, Math.min(1, (inland - 4) / 10));
    return lower * (1 - t) + fallback * t;
  }
  return fallback;
}
