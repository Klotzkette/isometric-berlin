import {
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  type VoxelPayload,
  createGroundSlabs,
  groundTopSampler,
} from "./MinecraftVoxelWorld";

/**
 * The drawn isometric city for Day mode: every building extruded from
 * its surveyed LoD2 footprint polygon (exact corners, planar walls,
 * courtyard holes) with hard black ink lines from edge geometry — a
 * true architectural drawing. This REPLACES the lumpy photogrammetry
 * buildings, which no amount of shading could make hard-edged. Ground,
 * water and roads reuse the surveyed run-length slabs with a soft day
 * palette; trees stay on the soft OSM/official park layer per the
 * owner's "nature may stay soft" rule.
 */
export type PrismBuilding = {
  class: number;
  h_dm: number;
  holes?: number[][][];
  id: string;
  ring: number[][];
  roof?: number;
  /** Sampled real median colour of this building (0-255 RGB). */
  tone?: [number, number, number];
  y0_dm: number;
};

export type PrismPayload = {
  buildings: PrismBuilding[];
  classes: string[];
  schema_version: number;
};

export const PRISM_WORLD_FILE = "lod2-prisms.json";
export const ISO_INK_COLOR = 0x24211c;
// At night black ink vanishes on dark prisms; a cool moonlit line keeps
// the drawn contours readable.
export const ISO_NIGHT_INK_COLOR = 0x8ea3bd;
export const ISO_EDGE_THRESHOLD_DEGREES = 24;

// Hand-pinned facade tones for hero prisms (payload building ids, last 8
// chars of the LoD2 id), matching the owner's colour direction: the
// Reichstag reads as its real darker grey sandstone (not warm yellow),
// the Chancellery as its real light grey/white.
export const HERO_PRISM_TONES: Record<string, number> = {
  K0002MCN: 0x9c968a,
  MLwG4KW9: 0xdadad6,
};

// Pinned roof-plate tones: the Reichstag's huge cap (and its corner
// towers) read as the real light stone terrace instead of sun-warmed
// facade brown; the Chancellery roof stays light.
export const HERO_PRISM_ROOF_TONES: Record<string, number> = {
  K0002MCN: 0xb4b8b2,
  K0003Ty1: 0xb4b8b2,
  K0003VDk: 0xb4b8b2,
  MLwG4KW9: 0xd2d5d0,
  UbQkgNZe: 0xb4b8b2,
  ycOYQRVL: 0xb4b8b2,
};

// Buildings whose recognition model draws the COMPLETE structure. Their
// LoD2 prism would swallow the model (the Brandenburg Gate rendered as a
// solid box burying its twelve columns), so these prisms are skipped and
// the model carries the building alone.
export const PRISM_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  // Brandenburger Tor main body — the gate model has columns, passages,
  // attic and Quadriga; side pavilion prisms stay.
  "K0001xqy",
  // Berlin Hauptbahnhof low structures — the metric recognition model
  // draws the whole station (321 m glass barrel, north-south hall, both
  // 46 m office bridges, track deck, trains). The low LoD2 prisms under
  // the halls rendered as opaque slabs that half-buried the glass roof
  // ("Glasdach beim Hbf"); every low prism fully inside the model's
  // hall + bridge envelope is suppressed. The tall Bügel tower prisms
  // are NOT suppressed — they render as transparent glass instead
  // (PRISM_GLASSED_IDS) to give the mullioned bridges their mass.
  "8hUNWvQf", "EKo6tjyY", "K0002KiE", "K0002UK0", "K0003TkC", "K0003TlE",
  "K0003UWM", "K0003Vlz", "OXDNOQlg", "YK0000Ce", "YK0000Cg", "YK0000Ch",
  "YK0000Ci", "YK0000Ck", "YK0000Cm", "YK0000Co", "YK0000Cq", "YK0000Cs",
  "YK0000Cu", "ZoBdHJPp", "hSQsiPVL", "jacWOmHc", "q7Axk9GG",
]);

// Prisms forced into the transparent glass mesh regardless of their
// LoD2 class: the Hauptbahnhof Bügel office-bridge towers, whose real
// facades are full curtain-wall glazing. The recognition model draws
// their mullion grid; these prisms give the grid its glassy body.
export const PRISM_GLASSED_IDS: ReadonlySet<string> = new Set([
  "3F1dLm24", "5gArGdou", "5v0mHg0p", "663NhxsM", "6ZJfG5j0", "D6fKsTRY",
  "Fk2OkM8n", "LAz51fdP", "M7I6Afam", "QaGDo8NZ", "SLLM5yNi", "X2oOtd6Z",
  "XpzUHc7R", "clykH08k", "gqQdZFTa", "hCFTFGrv", "hlYYwDX2", "iiRhAlr6",
  "ldYGmtbR", "m3AE8zAD", "o0aS4DvM", "v3sN8WzM", "zTSJJzrL", "zUU5olBa",
]);

/**
 * Clean a sampled real building colour into a flat illustration paint
 * tone: mild desaturation kills photo chroma noise, the lightness is
 * clamped to a readable band (dark grey stays possible — the Reichstag
 * is grey — but never black) and quantised onto six shared paint levels
 * so neighbouring buildings cohere as one drawing.
 */
export function cleanedTone(tone: [number, number, number]): Color {
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  let r = tone[0] / 255;
  let g = tone[1] / 255;
  let b = tone[2] / 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const DESATURATION = 0.25;
  r += (luma - r) * DESATURATION;
  g += (luma - g) * DESATURATION;
  b += (luma - b) * DESATURATION;
  const clamped = Math.min(0.88, Math.max(0.34, luma));
  const bands = 6;
  const quantised = Math.round(clamped * (bands - 1)) / (bands - 1);
  const scale = quantised / Math.max(luma, 1e-3);
  return new Color(clamp01(r * scale), clamp01(g * scale), clamp01(b * scale));
}

// Soft, flat illustration tones for the day ground (NOT the Minecraft
// palette): calm park green, light asphalt, Spree blue, plaza brick.
export const ISO_GROUND_SHADES: Record<string, readonly number[]> = {
  asphalt: [0x8f8f8a, 0x9a9a94],
  grass: [0x8fbf72, 0x9cc981, 0x86b96a],
  plazaBrick: [0xc9a084, 0xbf9478],
  // Drawn bridge decks: light stone, clearly distinct from water below.
  bridge: [0xb9b4a8, 0xc4bfb3],
  water: [0x7fb6cf, 0x74acca],
};

// Flat drawn facade tones per building class, with deterministic
// per-building jitter between shades (quantised paint, no gradients).
const FACADE_SHADES: Record<string, readonly number[]> = {
  concrete: [0xece5d4, 0xe3dbc8, 0xf2ecdd, 0xdcd2bd],
  glass: [0xbfd7de, 0xcfe3e8, 0xafc9d3],
};
const FALLBACK_FACADE: readonly number[] = FACADE_SHADES.concrete;

function facadeColorFor(building: PrismBuilding, classes: string[]): Color {
  const pinned = HERO_PRISM_TONES[building.id];
  if (pinned !== undefined) {
    return new Color(pinned);
  }
  // Each building carries its sampled real colour ("den jeweiligen
  // Gebäudetyp angleichen"); the shared class shades are only the
  // fallback for footprints without a valid sample.
  if (building.tone) {
    return cleanedTone(building.tone);
  }
  const className = classes[building.class] ?? "concrete";
  const shades = FACADE_SHADES[className] ?? FALLBACK_FACADE;
  let hash = 0;
  for (const char of building.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return new Color(shades[hash % shades.length]);
}

/**
 * Relight the drawn city for night: brighten the ink to a moonlit line
 * (black contours disappear on dark prisms) and give the prism bodies a
 * faint warm emissive floor so windowsill-height masses stay readable
 * under the dim night rig. Day restores pure black ink and no emissive.
 */
export function setIsoNightPresentation(city: Group, night: boolean): void {
  const ink = city.getObjectByName("LoD2 prism ink lines");
  if (ink instanceof LineSegments) {
    (ink.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const bodies = city.getObjectByName("LoD2 prism buildings");
  if (bodies instanceof Mesh) {
    const material = bodies.material as MeshStandardMaterial;
    material.emissive.setHex(night ? 0x1a1608 : 0x000000);
    material.emissiveIntensity = night ? 0.55 : 0;
    material.needsUpdate = true;
  }
  const glass = city.getObjectByName("LoD2 glass prisms");
  if (glass instanceof Mesh) {
    const material = glass.material as MeshStandardMaterial;
    material.emissive.setHex(night ? 0x0e1a24 : 0x000000);
    material.emissiveIntensity = night ? 0.7 : 0;
    material.needsUpdate = true;
  }
  // Windows swap their whole baked palette: cool drawn panes by day, a
  // deterministic scatter of warm-lit rooms after dark.
  const panes = city.getObjectByName("LoD2 prism windows");
  if (panes instanceof InstancedMesh && panes.instanceColor) {
    const target = night
      ? (panes.userData.nightColors as Float32Array | undefined)
      : (panes.userData.dayColors as Float32Array | undefined);
    if (target) {
      (panes.instanceColor.array as Float32Array).set(target);
      panes.instanceColor.needsUpdate = true;
    }
  }
  const trace = city.getObjectByName("Tiergartentunnel underground trace");
  if (trace instanceof LineSegments) {
    (trace.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const mullions = city.getObjectByName("LoD2 glass mullions");
  if (mullions instanceof LineSegments) {
    (mullions.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const kerbs = city.getObjectByName("drawn kerb lines");
  if (kerbs instanceof LineSegments) {
    (kerbs.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
}

// ALKIS roof-form codes carried in the payload. 3100 Satteldach,
// 3200 Walmdach, 2100 Pultdach; everything else stays a flat cap.
export const ROOF_GABLED = 3100;
export const ROOF_HIPPED = 3200;
export const ROOF_SHED = 2100;
// Only near-rectangular footprints get a fitted procedural roof.
export const ROOF_MIN_RECTANGULARITY = 0.72;

type FittedRect = {
  axis: [number, number];
  center: [number, number];
  halfLength: number;
  halfWidth: number;
  rectangularity: number;
};

function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
  ): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (const p of [...sorted].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function ringArea(ring: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

/**
 * Oriented minimum-area bounding rectangle via rotating calipers over
 * the convex hull, plus how rectangular the footprint actually is.
 */
export function fitRectangle(
  ring: Array<[number, number]>,
): FittedRect | null {
  if (ring.length < 3) {
    return null;
  }
  const hull = convexHull(ring);
  if (hull.length < 3) {
    return null;
  }
  let best: FittedRect | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let i = 0; i < hull.length; i += 1) {
    const [x1, z1] = hull[i];
    const [x2, z2] = hull[(i + 1) % hull.length];
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 1e-6) {
      continue;
    }
    const ax = (x2 - x1) / length;
    const az = (z2 - z1) / length;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const [px, pz] of hull) {
      const u = px * ax + pz * az;
      const v = -px * az + pz * ax;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = {
        axis:
          maxU - minU >= maxV - minV ? [ax, az] : [-az, ax],
        center: [cu * ax - cv * az, cu * az + cv * ax],
        halfLength: Math.max(maxU - minU, maxV - minV) / 2,
        halfWidth: Math.min(maxU - minU, maxV - minV) / 2,
        rectangularity: 0,
      };
    }
  }
  if (!best || bestArea < 1e-6) {
    return null;
  }
  best.rectangularity = ringArea(ring) / bestArea;
  return best;
}

function shapeFromRings(building: PrismBuilding): Shape {
  const shape = new Shape();
  building.ring.forEach(([xDm, zDm], index) => {
    // Shape lives in XY; after rotateX(-90°) shape-Y becomes -world-Z,
    // so feed -z to land on the correct scene position.
    const x = xDm / 10;
    const y = -zDm / 10;
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  for (const hole of building.holes ?? []) {
    const path = new Path();
    hole.forEach(([xDm, zDm], index) => {
      const x = xDm / 10;
      const y = -zDm / 10;
      if (index === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    });
    shape.holes.push(path);
  }
  return shape;
}

/**
 * Procedural pitched roof (flat faces only) fitted to the footprint's
 * oriented rectangle, for the ALKIS roof codes carried in the payload.
 * Returns non-indexed triangles or null (flat cap stays). The roof rect
 * gets a small 0.35 m eave overhang; the exact ring walls run to the
 * eave and the flat cap underneath closes the body, so the building is
 * visually watertight without cutting the true footprint.
 */
export function buildRoofGeometry(
  rect: FittedRect,
  eaveY: number,
  ridgeY: number,
  roofCode: number,
): Float32Array | null {
  const overhang = 0.35;
  const [ax, az] = rect.axis;
  const nx = -az;
  const nz = ax;
  const hl = rect.halfLength + overhang;
  const hw = rect.halfWidth + overhang;
  const [cx, cz] = rect.center;
  const corner = (u: number, v: number, y: number): [number, number, number] => [
    cx + ax * u + nx * v,
    y,
    cz + az * u + nz * v,
  ];
  const triangles: number[] = [];
  const push = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): void => {
    triangles.push(...a, ...b, ...c);
  };
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ): void => {
    push(a, b, c);
    push(a, c, d);
  };
  if (roofCode === ROOF_GABLED) {
    const r1 = corner(-hl, 0, ridgeY);
    const r2 = corner(hl, 0, ridgeY);
    quad(corner(-hl, -hw, eaveY), corner(hl, -hw, eaveY), r2, r1);
    quad(r1, r2, corner(hl, hw, eaveY), corner(-hl, hw, eaveY));
    // Vertical gable-end triangles close the two open ends.
    push(corner(-hl, hw, eaveY), r1, corner(-hl, -hw, eaveY));
    push(corner(hl, -hw, eaveY), r2, corner(hl, hw, eaveY));
  } else if (roofCode === ROOF_HIPPED) {
    const inset = Math.min(hw, hl * 0.6);
    const r1 = corner(-hl + inset, 0, ridgeY);
    const r2 = corner(hl - inset, 0, ridgeY);
    quad(corner(-hl, -hw, eaveY), corner(hl, -hw, eaveY), r2, r1);
    quad(r1, r2, corner(hl, hw, eaveY), corner(-hl, hw, eaveY));
    push(corner(-hl, hw, eaveY), r1, corner(-hl, -hw, eaveY));
    push(corner(hl, -hw, eaveY), r2, corner(hl, hw, eaveY));
  } else if (roofCode === ROOF_SHED) {
    // Single slope across the short axis; deterministic high side.
    const high1 = corner(-hl, -hw, ridgeY);
    const high2 = corner(hl, -hw, ridgeY);
    const low1 = corner(hl, hw, eaveY);
    const low2 = corner(-hl, hw, eaveY);
    quad(high1, high2, low1, low2);
    // Vertical skirts close the slope: two side triangles + back face.
    push(corner(-hl, -hw, eaveY), high1, low2);
    push(low1, high2, corner(hl, -hw, eaveY));
    quad(corner(hl, -hw, eaveY), high2, high1, corner(-hl, -hw, eaveY));
  } else {
    return null;
  }
  return new Float32Array(triangles);
}

/** The eave-to-ridge rise for a fitted roof, bounded to stay plausible. */
export function roofRise(rect: FittedRect, totalHeight: number): number {
  const rise = Math.min(5, Math.max(1.2, rect.halfWidth * 2 * 0.3));
  return rise < totalHeight * 0.6 ? rise : 0;
}

// Ligne-claire fenestration: every opaque prism carries flat window
// panes derived from its surveyed geometry — floors from the measured
// LoD2 height at a 3.1 m storey pitch, bays from each wall's true
// length. That is as close to "where the windows really are" as the
// open data goes: the counts and rhythm are real, the exact panes are
// drawn regularly like an architectural elevation.
export const ISO_WINDOW_FLOOR_PITCH_M = 3.1;
export const ISO_WINDOW_BAY_PITCH_M = 3.4;
export const ISO_WINDOW_WIDTH_M = 1.25;
export const ISO_WINDOW_HEIGHT_M = 1.55;
const WINDOW_SILL_START_M = 1.05;
const WINDOW_EAVE_CLEARANCE_M = 0.55;
const WINDOW_MIN_WALL_M = 2.6;
const WINDOW_MIN_BUILDING_M = 4;
const WINDOW_FACE_OFFSET_M = 0.07;
// Deterministic share of warm-lit windows after dark.
const WINDOW_LIT_FRACTION = 0.38;
const WINDOW_NIGHT_LIT_TONES = [0xffd28a, 0xffc36e, 0xf3dfa8] as const;
const WINDOW_NIGHT_DARK_TONE = 0x18202c;

// Monumental civic buildings (large surveyed footprint AND height) get
// piano-nobile proportions instead of housing storeys: taller windows
// on a wider floor/bay pitch, the way the Reichstag's elevation reads.
export const CIVIC_FOOTPRINT_M2 = 2500;
export const CIVIC_HEIGHT_M = 16;
const CIVIC_WINDOW = { bayPitch: 4.4, floorPitch: 4.4, height: 2.6, width: 1.5 };
const HOUSING_WINDOW = {
  bayPitch: ISO_WINDOW_BAY_PITCH_M,
  floorPitch: ISO_WINDOW_FLOOR_PITCH_M,
  height: ISO_WINDOW_HEIGHT_M,
  width: ISO_WINDOW_WIDTH_M,
};
type WindowFormat = typeof HOUSING_WINDOW;

// One drawn entrance door per building, centred on its longest windowed
// street wall; the ground-floor panes around it step aside.
const DOOR_WIDTH_M = 1.15;
const DOOR_HEIGHT_M = 2.35;
const DOOR_MIN_WALL_M = 5;
const DOOR_CLEARANCE_M = 1.6;
const DOOR_DAY_TONE = 0x2f2b26;
const DOOR_NIGHT_TONE = 0x1c232e;
const DOOR_NIGHT_LIT_TONE = 0xd9a45e;
// Cool slate tint mixed into flat roof caps so they read as drawn
// roof plates instead of sun-warmed facade paint.
const ROOF_PLATE_TINT = new Color(0x8f989e);

/** Bay/floor grid for one wall; null when the wall carries no windows. */
export function windowGrid(
  wallLength: number,
  bodyHeight: number,
  format: WindowFormat = HOUSING_WINDOW,
): { bays: number; floors: number; firstOffset: number } | null {
  if (wallLength < WINDOW_MIN_WALL_M) {
    return null;
  }
  const bays = Math.floor(
    (wallLength - format.width - 0.9) / format.bayPitch + 1,
  );
  const floors = Math.floor(
    (bodyHeight -
      WINDOW_SILL_START_M -
      format.height -
      WINDOW_EAVE_CLEARANCE_M) /
      format.floorPitch + 1,
  );
  if (bays < 1 || floors < 1) {
    return null;
  }
  return {
    bays,
    floors,
    firstOffset: (wallLength - (bays - 1) * format.bayPitch) / 2,
  };
}

type WindowInstance = {
  dirX: number;
  dirZ: number;
  height: number;
  night: Color;
  nx: number;
  nz: number;
  px: number;
  py: number;
  pz: number;
  tone: Color;
  width: number;
};

function hash32(seed: string, salt: number): number {
  let hash = salt >>> 0;
  for (const char of seed) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

type PrismWall = {
  dirX: number;
  dirZ: number;
  index: number;
  length: number;
  nx: number;
  nz: number;
  x1: number;
  z1: number;
};

/** Outer-ring walls in metres with outward normals (shoelace winding). */
function wallsOf(building: PrismBuilding): PrismWall[] {
  const ring = building.ring;
  let doubleArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[(index + 1) % ring.length];
    doubleArea += (x1 / 10) * (z2 / 10) - (x2 / 10) * (z1 / 10);
  }
  const flip = doubleArea >= 0 ? 1 : -1;
  const walls: PrismWall[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const [x1dm, z1dm] = ring[index];
    const [x2dm, z2dm] = ring[(index + 1) % ring.length];
    const x1 = x1dm / 10;
    const z1 = z1dm / 10;
    const wallX = x2dm / 10 - x1;
    const wallZ = z2dm / 10 - z1;
    const length = Math.hypot(wallX, wallZ);
    if (length < 1e-6) {
      continue;
    }
    const dirX = wallX / length;
    const dirZ = wallZ / length;
    walls.push({
      dirX,
      dirZ,
      index,
      length,
      nx: dirZ * flip,
      nz: -dirX * flip,
      x1,
      z1,
    });
  }
  return walls;
}

/** Axis-aligned-to-`axis` box as non-indexed triangles (chimneys). */
function boxTriangles(
  cx: number,
  cy: number,
  cz: number,
  axis: [number, number],
  sizeAlong: number,
  sizeUp: number,
  sizeAcross: number,
): Float32Array {
  const [ax, az] = axis;
  const nx = -az;
  const nz = ax;
  const corner = (u: number, y: number, v: number): [number, number, number] => [
    cx + ax * u * sizeAlong * 0.5 + nx * v * sizeAcross * 0.5,
    cy + y * sizeUp * 0.5,
    cz + az * u * sizeAlong * 0.5 + nz * v * sizeAcross * 0.5,
  ];
  const quads: Array<[number, number, number][]> = [
    [corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)],
    [corner(-1, -1, -1), corner(-1, 1, -1), corner(-1, 1, 1), corner(-1, -1, 1)],
    [corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [corner(-1, -1, -1), corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1)],
    [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)],
  ];
  const triangles: number[] = [];
  for (const [a, b, c, d] of quads) {
    triangles.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return new Float32Array(triangles);
}

/**
 * The Tiergartentunnel is real but invisible from the surface — so the
 * drawn city marks it the way a technical drawing marks hidden edges:
 * two dashed ink lines along the tube walls, clipped to the surveyed
 * ground grid. The full cutaway still lives below the horizon.
 */
function createTunnelTrace(
  points: readonly (readonly [number, number, number])[],
  ground: VoxelPayload,
): LineSegments | null {
  const sample = groundTopSampler(ground);
  const cell = ground.cell_m;
  const { cols, min_x_idx, min_z_idx, rows } = ground.grid;
  const groundYAt = (x: number, z: number): number | null => {
    const xOffset = x / cell - min_x_idx;
    const zOffset = z / cell - min_z_idx;
    if (xOffset < 0 || zOffset < 0 || xOffset >= cols || zOffset >= rows) {
      return null;
    }
    return sample(xOffset, zOffset);
  };
  const DASH_M = 7;
  const GAP_M = 5;
  const HALF_WIDTH_M = 10.5;
  const positions: number[] = [];
  let phase = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, , z1] = points[index];
    const [x2, , z2] = points[index + 1];
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 1e-6) {
      continue;
    }
    const dx = (x2 - x1) / length;
    const dz = (z2 - z1) / length;
    for (let along = 0; along < length; along += 1) {
      const on = phase < DASH_M;
      phase += 1;
      if (phase >= DASH_M + GAP_M) {
        phase = 0;
      }
      if (!on) {
        continue;
      }
      const step = Math.min(1, length - along);
      for (const side of [-HALF_WIDTH_M, HALF_WIDTH_M]) {
        const ax = x1 + dx * along - dz * side;
        const az = z1 + dz * along + dx * side;
        const bx = ax + dx * step;
        const bz = az + dz * step;
        const ya = groundYAt(ax, az);
        const yb = groundYAt(bx, bz);
        if (ya === null || yb === null) {
          continue;
        }
        positions.push(ax, ya + 0.35, az, bx, yb + 0.35, bz);
      }
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const trace = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: ISO_INK_COLOR,
      opacity: 0.5,
      transparent: true,
    }),
  );
  trace.name = "Tiergartentunnel underground trace";
  trace.renderOrder = 3;
  return trace;
}

// Ground-class pairs whose shared cell edge gets a drawn kerb line.
const KERB_PAIRS = new Set([
  "asphalt|grass",
  "asphalt|plazaBrick",
  "grass|plazaBrick",
]);

/**
 * Kerb ink: the surveyed run-length ground grid knows exactly where
 * roads meet lawns and plazas — draw those cell boundaries as thin ink
 * lines, the ligne-claire ground the buildings already live on.
 */
function createKerbLines(ground: VoxelPayload): LineSegments | null {
  const cell = ground.cell_m;
  const { cols, min_x_idx, min_z_idx, rows } = ground.grid;
  const classGrid = new Int16Array(cols * rows).fill(-1);
  ground.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      for (let step = 0; step < run; step += 1) {
        const x = xStart + step;
        if (x >= 0 && x < cols) {
          classGrid[zOffset * cols + x] = classId;
        }
      }
    }
  });
  const nameOf = (id: number): string | null =>
    id >= 0 ? (ground.classes[id] ?? null) : null;
  const kerbPair = (a: number, b: number): boolean => {
    if (a === b) {
      return false;
    }
    const nameA = nameOf(a);
    const nameB = nameOf(b);
    if (!nameA || !nameB) {
      return false;
    }
    return KERB_PAIRS.has(
      nameA < nameB ? `${nameA}|${nameB}` : `${nameB}|${nameA}`,
    );
  };
  const sample = groundTopSampler(ground);
  const positions: number[] = [];
  const edge = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    xOffset: number,
    zOffset: number,
  ): void => {
    const y = sample(xOffset, zOffset) + 0.22;
    positions.push(
      (min_x_idx + x1) * cell, y, (min_z_idx + z1) * cell,
      (min_x_idx + x2) * cell, y, (min_z_idx + z2) * cell,
    );
  };
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const here = classGrid[z * cols + x];
      if (x + 1 < cols && kerbPair(here, classGrid[z * cols + x + 1])) {
        edge(x + 1, z, x + 1, z + 1, x, z);
      }
      if (z + 1 < rows && kerbPair(here, classGrid[(z + 1) * cols + x])) {
        edge(x, z + 1, x + 1, z + 1, x, z);
      }
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const kerbs = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: ISO_INK_COLOR,
      opacity: 0.32,
      transparent: true,
    }),
  );
  kerbs.name = "drawn kerb lines";
  kerbs.renderOrder = 2;
  return kerbs;
}

export function createIsometricCity(
  prisms: PrismPayload,
  ground: VoxelPayload | null,
  tunnelPoints?: readonly (readonly [number, number, number])[] | null,
): Group {
  const group = new Group();
  group.name = "Drawn isometric city (LoD2 prisms + ink lines)";

  const bodyGeometries = [];
  const glassGeometries = [];
  const edgeGeometries = [];
  const windows: WindowInstance[] = [];
  const mullionPositions: number[] = [];
  const color = new Color();
  const bakeColor = (geometry: BufferGeometry, tone: Color): void => {
    const positions = geometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    for (let index = 0; index < positions.count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  };
  for (const building of prisms.buildings) {
    if (building.ring.length < 3 || PRISM_SUPPRESSED_IDS.has(building.id)) {
      continue;
    }
    const y0 = building.y0_dm / 10;
    const totalHeight = Math.max(2.5, building.h_dm / 10);
    const isGlass =
      (prisms.classes[building.class] ?? "concrete") === "glass" ||
      PRISM_GLASSED_IDS.has(building.id);
    // Real roof forms from the ALKIS codes: gabled/hipped/shed roofs
    // rise from the eave as fitted flat facets; everything else keeps
    // the exact flat cap. Glass volumes stay clean transparent boxes.
    let bodyHeight = totalHeight;
    let roofTriangles: Float32Array | null = null;
    let roofRect: ReturnType<typeof fitRectangle> = null;
    const roofCode = building.roof ?? 0;
    if (
      !isGlass &&
      (roofCode === ROOF_GABLED ||
        roofCode === ROOF_HIPPED ||
        roofCode === ROOF_SHED)
    ) {
      const ringMeters = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const rect = fitRectangle(ringMeters);
      if (rect && rect.rectangularity >= ROOF_MIN_RECTANGULARITY) {
        const rise = roofRise(rect, totalHeight);
        if (rise > 0) {
          roofTriangles = buildRoofGeometry(
            rect,
            y0 + totalHeight - rise,
            y0 + totalHeight,
            roofCode,
          );
          if (roofTriangles) {
            bodyHeight = totalHeight - rise;
            roofRect = rect;
          }
        }
      }
    }
    const geometry = new ExtrudeGeometry(shapeFromRings(building), {
      bevelEnabled: false,
      depth: bodyHeight,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y0, 0);
    geometry.deleteAttribute("uv");
    // Ink lines first (edges of the un-coloured prism)…
    const edges = new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES);
    edgeGeometries.push(edges);
    // …then bake the flat facade tone as vertex colour so every
    // building can share one material in one merged mesh. Glass-class
    // volumes go to their own transparent mesh in a cool glass family
    // (their photo-sampled tones are muddy reflections, not paint).
    if (isGlass) {
      const glassShades = FACADE_SHADES.glass;
      color.setHex(glassShades[hash32(building.id, 5) % glassShades.length]);
      bakeColor(geometry, color);
      glassGeometries.push(geometry);
      // Curtain-wall mullions: the transparent volume gets its drawn
      // glazing grid — verticals on the bay pitch, horizontals on the
      // storey pitch — as ink lines just outside each surveyed wall.
      for (const wall of wallsOf(building)) {
        if (wall.length < WINDOW_MIN_WALL_M || totalHeight < 5) {
          continue;
        }
        const ox = wall.nx * WINDOW_FACE_OFFSET_M;
        const oz = wall.nz * WINDOW_FACE_OFFSET_M;
        const verticals = Math.floor(wall.length / ISO_WINDOW_BAY_PITCH_M);
        const vStart = (wall.length - verticals * ISO_WINDOW_BAY_PITCH_M) / 2;
        for (let step = 0; step <= verticals; step += 1) {
          const along = vStart + step * ISO_WINDOW_BAY_PITCH_M;
          const x = wall.x1 + wall.dirX * along + ox;
          const z = wall.z1 + wall.dirZ * along + oz;
          mullionPositions.push(x, y0 + 0.15, z, x, y0 + totalHeight - 0.15, z);
        }
        const storeys = Math.floor((totalHeight - 1) / ISO_WINDOW_FLOOR_PITCH_M);
        for (let step = 1; step <= storeys; step += 1) {
          const y = y0 + step * ISO_WINDOW_FLOOR_PITCH_M;
          mullionPositions.push(
            wall.x1 + ox, y, wall.z1 + oz,
            wall.x1 + wall.dirX * wall.length + ox, y,
            wall.z1 + wall.dirZ * wall.length + oz,
          );
        }
      }
      continue;
    }
    color.copy(facadeColorFor(building, prisms.classes));
    bakeColor(geometry, color);
    // Flat caps read as drawn roof plates, not sun-baked facade paint:
    // recolour up-facing cap vertices cooler and slightly darker (the
    // Reichstag's huge roof was one warm brown slab).
    const pinnedRoof = HERO_PRISM_ROOF_TONES[building.id];
    const capTone =
      pinnedRoof !== undefined
        ? new Color(pinnedRoof)
        : color.clone().multiplyScalar(0.9).lerp(ROOF_PLATE_TINT, 0.4);
    const bodyNormals = geometry.getAttribute("normal");
    const bodyPositions = geometry.getAttribute("position");
    const bodyColors = geometry.getAttribute("color");
    const capY = y0 + bodyHeight - 0.05;
    for (let index = 0; index < bodyPositions.count; index += 1) {
      if (bodyNormals.getY(index) > 0.7 && bodyPositions.getY(index) > capY) {
        bodyColors.setXYZ(index, capTone.r, capTone.g, capTone.b);
      }
    }
    bodyGeometries.push(geometry);
    // Monumental flat roofs carry a drawn parapet rim (the Reichstag's
    // balustrade line), inked like every other edge.
    if (
      !roofTriangles &&
      totalHeight >= CIVIC_HEIGHT_M &&
      ringArea(
        building.ring.map(([x, z]) => [x / 10, z / 10] as [number, number]),
      ) >= CIVIC_FOOTPRINT_M2
    ) {
      for (const wall of wallsOf(building)) {
        if (wall.length < 3) {
          continue;
        }
        const parapet = new BufferGeometry();
        parapet.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(
              wall.x1 + (wall.dirX * wall.length) / 2,
              y0 + totalHeight + 0.35,
              wall.z1 + (wall.dirZ * wall.length) / 2,
              [wall.dirX, wall.dirZ],
              wall.length,
              0.7,
              0.4,
            ),
            3,
          ),
        );
        parapet.computeVertexNormals();
        edgeGeometries.push(
          new EdgesGeometry(parapet, ISO_EDGE_THRESHOLD_DEGREES),
        );
        bakeColor(parapet, capTone.clone().multiplyScalar(0.94));
        bodyGeometries.push(parapet);
      }
    }
    // Ligne-claire windows: real floor count from the measured height,
    // real bay rhythm from each surveyed wall, on the outer ring of
    // every building tall enough to have storeys. Monumental civic
    // footprints get piano-nobile formats; every building gets one
    // drawn entrance door on its longest windowed wall.
    if (totalHeight >= WINDOW_MIN_BUILDING_M) {
      const ringMeters2 = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const isCivic =
        ringArea(ringMeters2) >= CIVIC_FOOTPRINT_M2 &&
        totalHeight >= CIVIC_HEIGHT_M;
      const format = isCivic ? CIVIC_WINDOW : HOUSING_WINDOW;
      const windDay = color
        .clone()
        .multiplyScalar(0.5)
        .lerp(new Color(0x46525e), 0.6);
      const nightLit = new Color();
      const nightDark = new Color(WINDOW_NIGHT_DARK_TONE);
      const litLimit = Math.round(WINDOW_LIT_FRACTION * 1000);
      const walls = wallsOf(building);
      // The entrance door lives on the longest wall that carries
      // windows and enough width to step around it.
      let doorWall = -1;
      let doorLength = DOOR_MIN_WALL_M;
      for (const wall of walls) {
        if (wall.length >= doorLength && windowGrid(wall.length, bodyHeight, format)) {
          doorWall = wall.index;
          doorLength = wall.length;
        }
      }
      for (const wall of walls) {
        const grid = windowGrid(wall.length, bodyHeight, format);
        if (!grid) {
          continue;
        }
        const hasDoor = wall.index === doorWall;
        const doorAlong = wall.length / 2;
        for (let bay = 0; bay < grid.bays; bay += 1) {
          const along = grid.firstOffset + bay * format.bayPitch;
          for (let floor = 0; floor < grid.floors; floor += 1) {
            if (
              hasDoor &&
              floor === 0 &&
              Math.abs(along - doorAlong) < DOOR_CLEARANCE_M
            ) {
              continue;
            }
            const sill = WINDOW_SILL_START_M + floor * format.floorPitch;
            const roll = hash32(building.id, wall.index * 2801 + bay * 53 + floor) % 1000;
            if (roll < litLimit) {
              nightLit.setHex(
                WINDOW_NIGHT_LIT_TONES[roll % WINDOW_NIGHT_LIT_TONES.length],
              );
            }
            windows.push({
              dirX: wall.dirX,
              dirZ: wall.dirZ,
              height: format.height,
              night: (roll < litLimit ? nightLit : nightDark).clone(),
              nx: wall.nx,
              nz: wall.nz,
              px: wall.x1 + wall.dirX * along + wall.nx * WINDOW_FACE_OFFSET_M,
              py: y0 + sill + format.height / 2,
              pz: wall.z1 + wall.dirZ * along + wall.nz * WINDOW_FACE_OFFSET_M,
              tone: windDay.clone(),
              width: format.width,
            });
          }
        }
        if (hasDoor) {
          const litDoor = hash32(building.id, 77) % 1000 < 200;
          windows.push({
            dirX: wall.dirX,
            dirZ: wall.dirZ,
            height: DOOR_HEIGHT_M,
            night: new Color(litDoor ? DOOR_NIGHT_LIT_TONE : DOOR_NIGHT_TONE),
            nx: wall.nx,
            nz: wall.nz,
            px:
              wall.x1 + wall.dirX * doorAlong + wall.nx * WINDOW_FACE_OFFSET_M,
            py: y0 + DOOR_HEIGHT_M / 2,
            pz:
              wall.z1 + wall.dirZ * doorAlong + wall.nz * WINDOW_FACE_OFFSET_M,
            tone: new Color(DOOR_DAY_TONE),
            width: DOOR_WIDTH_M,
          });
        }
      }
    }
    if (roofTriangles) {
      const roofGeometry = new BufferGeometry();
      roofGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(roofTriangles, 3),
      );
      roofGeometry.computeVertexNormals();
      edgeGeometries.push(
        new EdgesGeometry(roofGeometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
      // Roof paint reads slightly darker than the facade, like a
      // drawn tiled surface.
      bakeColor(roofGeometry, color.clone().multiplyScalar(0.82));
      bodyGeometries.push(roofGeometry);
      // Gabled houses get their chimneys back: small drawn stacks on
      // the ridge (one, or two on long roofs), inked like everything.
      if (roofCode === ROOF_GABLED && roofRect && roofRect.halfLength > 5) {
        const ridgeY = y0 + totalHeight;
        const stackOffsets =
          roofRect.halfLength > 10 ? [-0.45, 0.45] : [0.4];
        for (const offset of stackOffsets) {
          const chimney = new BufferGeometry();
          chimney.setAttribute(
            "position",
            new Float32BufferAttribute(
              boxTriangles(
                roofRect.center[0] + roofRect.axis[0] * roofRect.halfLength * offset,
                ridgeY + 0.45,
                roofRect.center[1] + roofRect.axis[1] * roofRect.halfLength * offset,
                roofRect.axis,
                0.9,
                1.5,
                0.9,
              ),
              3,
            ),
          );
          chimney.computeVertexNormals();
          edgeGeometries.push(
            new EdgesGeometry(chimney, ISO_EDGE_THRESHOLD_DEGREES),
          );
          bakeColor(chimney, color.clone().multiplyScalar(0.66));
          bodyGeometries.push(chimney);
        }
      }
    }
  }

  const bodies = mergeGeometries(bodyGeometries, false);
  if (bodies) {
    const mesh = new Mesh(
      bodies,
      new MeshStandardMaterial({
        flatShading: true,
        metalness: 0,
        roughness: 0.95,
        vertexColors: true,
      }),
    );
    mesh.name = "LoD2 prism buildings";
    group.add(mesh);
    for (const geometry of bodyGeometries) {
      geometry.dispose();
    }
  }

  const glass = mergeGeometries(glassGeometries, false);
  if (glass) {
    const mesh = new Mesh(
      glass,
      new MeshStandardMaterial({
        flatShading: true,
        metalness: 0,
        opacity: 0.52,
        roughness: 0.35,
        transparent: true,
        vertexColors: true,
      }),
    );
    mesh.name = "LoD2 glass prisms";
    // Transparent glass draws after the opaque city; the ink lines
    // (renderOrder 2) still sit on top of it.
    mesh.renderOrder = 1;
    group.add(mesh);
    for (const geometry of glassGeometries) {
      geometry.dispose();
    }
  }

  if (windows.length > 0) {
    // DoubleSide: the wall basis (dir, up, outward) is left-handed, so
    // the instanced plane's winding flips; culling front faces would
    // hide every pane.
    const pane = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
      windows.length,
    );
    pane.name = "LoD2 prism windows";
    const matrix = new Matrix4();
    const dayColors = new Float32Array(windows.length * 3);
    const nightColors = new Float32Array(windows.length * 3);
    windows.forEach((spec, index) => {
      matrix.set(
        spec.dirX * spec.width, 0, spec.nx, spec.px,
        0, spec.height, 0, spec.py,
        spec.dirZ * spec.width, 0, spec.nz, spec.pz,
        0, 0, 0, 1,
      );
      pane.setMatrixAt(index, matrix);
      pane.setColorAt(index, spec.tone);
      dayColors[index * 3] = spec.tone.r;
      dayColors[index * 3 + 1] = spec.tone.g;
      dayColors[index * 3 + 2] = spec.tone.b;
      nightColors[index * 3] = spec.night.r;
      nightColors[index * 3 + 1] = spec.night.g;
      nightColors[index * 3 + 2] = spec.night.b;
    });
    pane.userData.dayColors = dayColors;
    pane.userData.nightColors = nightColors;
    pane.instanceMatrix.needsUpdate = true;
    if (pane.instanceColor) {
      pane.instanceColor.needsUpdate = true;
    }
    pane.frustumCulled = false;
    group.add(pane);
  }

  if (mullionPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(mullionPositions, 3),
    );
    const mullions = new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: ISO_INK_COLOR,
        opacity: 0.55,
        transparent: true,
      }),
    );
    mullions.name = "LoD2 glass mullions";
    mullions.renderOrder = 2;
    group.add(mullions);
  }

  if (tunnelPoints && tunnelPoints.length >= 2 && ground) {
    const trace = createTunnelTrace(tunnelPoints, ground);
    if (trace) {
      group.add(trace);
    }
  }

  const edges = mergeGeometries(edgeGeometries, false);
  if (edges) {
    const ink = new LineSegments(
      edges,
      new LineBasicMaterial({ color: ISO_INK_COLOR }),
    );
    ink.name = "LoD2 prism ink lines";
    // Draw the ink after the bodies so lines sit on the surfaces.
    ink.renderOrder = 2;
    group.add(ink);
    for (const geometry of edgeGeometries) {
      geometry.dispose();
    }
  }

  if (ground) {
    const slabs = createGroundSlabs(
      ground,
      "Drawn ground slabs",
      ISO_GROUND_SHADES,
    );
    group.add(slabs);
    const kerbs = createKerbLines(ground);
    if (kerbs) {
      group.add(kerbs);
    }
  }
  return group;
}
