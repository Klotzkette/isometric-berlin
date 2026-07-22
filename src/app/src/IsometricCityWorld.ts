import {
  BoxGeometry,
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
  worldGroundSampler,
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
// Fine grey pencil, not black marker ("feine, abgegrenzte Linien"):
// contours delineate the light panels without weighing them down.
export const ISO_INK_COLOR = 0x716c62;
// At night black ink vanishes on dark prisms; a cool moonlit line keeps
// the drawn contours readable.
export const ISO_NIGHT_INK_COLOR = 0x8ea3bd;
export const ISO_EDGE_THRESHOLD_DEGREES = 24;

// Hand-pinned facade tones for hero prisms (payload building ids, last 8
// chars of the LoD2 id), matching the owner's colour direction: the
// Reichstag reads as its real darker grey sandstone (not warm yellow),
// the Chancellery as its real light grey/white.
export const HERO_PRISM_TONES: Record<string, number> = {
  K0002MCN: 0xafaaa0,
  MLwG4KW9: 0xe2e2de,
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
  const DESATURATION = 0.55;
  r += (luma - r) * DESATURATION;
  g += (luma - g) * DESATURATION;
  b += (luma - b) * DESATURATION;
  // Light-panel city: lightness lives in a bright band ("alles in
  // hellen Farben") — pale stone up to near-white, never murky.
  const clamped = Math.min(0.88, Math.max(0.56, luma));
  const bands = 6;
  const quantised = Math.round(clamped * (bands - 1)) / (bands - 1);
  const scale = quantised / Math.max(luma, 1e-3);
  return new Color(clamp01(r * scale), clamp01(g * scale), clamp01(b * scale));
}

// Soft, flat illustration tones for the day ground (NOT the Minecraft
// palette): calm park green, light asphalt, Spree blue, plaza brick.
export const ISO_GROUND_SHADES: Record<string, readonly number[]> = {
  asphalt: [0xa2a39d, 0xadaea7],
  grass: [0x9ecb82, 0xa9d48f, 0x95c47a],
  plazaBrick: [0xd4b096, 0xcaa489],
  // Drawn bridge decks: light stone, clearly distinct from water below.
  bridge: [0xc6c1b5, 0xd0cbbf],
  water: [0x92c4d9, 0x87bad4],
};

// Flat drawn facade tones per building class, with deterministic
// per-building jitter between shades (quantised paint, no gradients).
const FACADE_SHADES: Record<string, readonly number[]> = {
  concrete: [0xece5d4, 0xe3dbc8, 0xf2ecdd, 0xdcd2bd],
  glass: [0xbfd7de, 0xcfe3e8, 0xafc9d3],
};
const FALLBACK_FACADE: readonly number[] = FACADE_SHADES.concrete;

// The Reichstag's LoD2 body is split into many parts whose photo
// samples are muddy shadow tans; the whole ensemble is pinned to its
// real light sandstone by region.
function inReichstagRegion(building: PrismBuilding): boolean {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of building.ring) {
    cx += x / 10;
    cz += z / 10;
  }
  cx /= building.ring.length;
  cz /= building.ring.length;
  return cx >= 260 && cx <= 372 && cz >= -34 && cz <= 115;
}

function facadeColorFor(building: PrismBuilding, classes: string[]): Color {
  const pinned = HERO_PRISM_TONES[building.id];
  if (pinned !== undefined) {
    return new Color(pinned);
  }
  if (inReichstagRegion(building)) {
    return new Color(0xb3aea3);
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
    // Day = unlit exact paint; night = the lit moonlight material.
    bodies.material = night
      ? (bodies.userData.nightMaterial as MeshStandardMaterial)
      : (bodies.userData.dayMaterial as MeshBasicMaterial);
    const nightMaterial = bodies.userData
      .nightMaterial as MeshStandardMaterial;
    nightMaterial.emissive.setHex(night ? 0x1a1608 : 0x000000);
    nightMaterial.emissiveIntensity = night ? 0.55 : 0;
    nightMaterial.needsUpdate = true;
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
  const monumentInk = city.getObjectByName("monument ink lines");
  if (monumentInk instanceof LineSegments) {
    (monumentInk.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const portalInk = city.getObjectByName("tunnel portal ink lines");
  if (portalInk instanceof LineSegments) {
    (portalInk.material as LineBasicMaterial).color.setHex(
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
export const ISO_WINDOW_BAY_PITCH_M = 3.6;
// Slim, elongated panes ("schlanker, länglicher"): tall portrait glass.
export const ISO_WINDOW_WIDTH_M = 1.05;
export const ISO_WINDOW_HEIGHT_M = 1.9;
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
const CIVIC_WINDOW = {
  bayPitch: 4.6,
  floorPitch: 4.4,
  height: 3.0,
  sillStart: 1.05,
  width: 1.3,
};
const HOUSING_WINDOW = {
  bayPitch: ISO_WINDOW_BAY_PITCH_M,
  floorPitch: ISO_WINDOW_FLOOR_PITCH_M,
  height: ISO_WINDOW_HEIGHT_M,
  sillStart: 1.05,
  width: ISO_WINDOW_WIDTH_M,
};
type WindowFormat = typeof HOUSING_WINDOW;

// Hand-pinned facade formats where the generic grid would be wrong
// ("der Reichstag darf nicht falsche Fenster haben"): the Reichstag
// ensemble carries its real rhythm — a high rusticated base, then tall
// arched window rows on a stately pitch, on the towers too.
export const HERO_WINDOW_FORMATS: Record<string, WindowFormat> = {
  K0002MCN: { bayPitch: 5.4, floorPitch: 8.2, height: 4.8, sillStart: 5.2, width: 2.4 },
  K0003Ty1: { bayPitch: 5.2, floorPitch: 8.2, height: 4.4, sillStart: 6, width: 2.2 },
  K0003VDk: { bayPitch: 5.2, floorPitch: 8.2, height: 4.4, sillStart: 6, width: 2.2 },
  UbQkgNZe: { bayPitch: 5.2, floorPitch: 8.2, height: 4.4, sillStart: 6, width: 2.2 },
  ycOYQRVL: { bayPitch: 5.2, floorPitch: 8.2, height: 4.4, sillStart: 6, width: 2.2 },
};
// The Reichstag's entrance is its portico (drawn by the recognition
// model); a generic drawn door on the plinth would be Quatsch.
const DOOR_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  "K0002MCN", "K0003Ty1", "K0003VDk", "UbQkgNZe", "ycOYQRVL",
]);
// The recognition layer draws the Reichstag's REAL fenestration (tall
// arched windows, transoms, mullions from references); generic prism
// panes underneath would double it into mush ("keine falschen Fenster").
const WINDOWS_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  "K0002MCN", "K0003Ty1", "K0003VDk", "UbQkgNZe", "ycOYQRVL",
]);

// One drawn entrance door per building, centred on its longest windowed
// street wall; the ground-floor panes around it step aside.
const DOOR_WIDTH_M = 1.15;
const DOOR_HEIGHT_M = 2.35;
const DOOR_MIN_WALL_M = 5;
const DOOR_CLEARANCE_M = 1.6;
const DOOR_DAY_TONE = 0x5b564e;
const DOOR_NIGHT_TONE = 0x1c232e;
const DOOR_NIGHT_LIT_TONE = 0xd9a45e;
// Cool slate tint mixed into flat roof caps so they read as drawn
// roof plates instead of sun-warmed facade paint.
const ROOF_PLATE_TINT = new Color(0xbcc2c4);
// Hyperdetail bands: a darker plinth (Sockel) at the base and a light
// protruding cornice (Gesims) under the roof edge of every drawn wall.
const SOCKEL_HEIGHT_M = 0.55;
const SOCKEL_DEPTH_M = 0.32;
const CORNICE_HEIGHT_M = 0.22;
const CORNICE_DEPTH_M = 0.48;
const DETAIL_MIN_WALL_M = 2.5;
const DETAIL_MIN_BUILDING_M = 5;
// Rooftop furniture on large flat roofs: HVAC boxes + a glass skylight.
const ROOF_FURNITURE_MIN_AREA_M2 = 600;
const ROOF_FURNITURE_MIN_HEIGHT_M = 8;
// Night light temperature: offices burn cool white, homes warm.
const WINDOW_NIGHT_CIVIC_TONES = [0xdfe8f2, 0xcfe0ee, 0xffd28a] as const;

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
      format.sillStart -
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
  // Quay lines: wherever land meets the Spree/Humboldthafen.
  "asphalt|water",
  "grass|water",
  "plazaBrick|water",
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

/**
 * The Tiergartentunnel's two portals ("dessen Eingänge"): open ramp
 * trenches where the B96 surfaces at both ends of the engineered
 * centreline — sloped deck, retaining walls, portal frame and the dark
 * tube mouth, all drawn and inked like the rest of the city.
 */
function createTunnelPortals(
  points: readonly (readonly [number, number, number])[],
  ground: VoxelPayload,
): Group | null {
  const sample = worldGroundSampler(ground);
  const positions: number[] = [];
  const colors: number[] = [];
  const paint = new Color();
  const pushTriangle = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    tone: number,
  ): void => {
    paint.setHex(tone);
    positions.push(...a, ...b, ...c);
    for (let index = 0; index < 3; index += 1) {
      colors.push(paint.r, paint.g, paint.b);
    }
  };
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    tone: number,
  ): void => {
    pushTriangle(a, b, c, tone);
    pushTriangle(a, c, d, tone);
  };
  const RAMP_LENGTH = 78;
  const HALF_WIDTH = 11;
  const DECK_TONE = 0x54554e;
  const WALL_TONE = 0x9a978c;
  const FRAME_TONE = 0xa6a399;
  const MOUTH_TONE = 0x0c0e10;
  const ends: Array<[readonly [number, number, number], readonly [number, number, number]]> = [
    [points[0], points[1]],
    [points[points.length - 1], points[points.length - 2]],
  ];
  let built = 0;
  for (const [end, inner] of ends) {
    const dirX0 = end[0] - inner[0];
    const dirZ0 = end[2] - inner[2];
    const length = Math.hypot(dirX0, dirZ0);
    if (length < 1e-6) {
      continue;
    }
    const dx = dirX0 / length;
    const dz = dirZ0 / length;
    const nx = -dz;
    const nz = dx;
    const mouthGround = sample(end[0], end[2]);
    if (mouthGround === null) {
      continue;
    }
    const deckMouthY = end[1] + 1.4;
    const steps = 6;
    const at = (
      along: number,
      side: number,
      y: number,
    ): [number, number, number] => [
      end[0] + dx * along + nx * side,
      y,
      end[2] + dz * along + nz * side,
    ];
    for (let step = 0; step < steps; step += 1) {
      const a0 = (step / steps) * RAMP_LENGTH;
      const a1 = ((step + 1) / steps) * RAMP_LENGTH;
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      const g0 = sample(...([at(a0, 0, 0)[0], at(a0, 0, 0)[2]] as [number, number])) ?? mouthGround;
      const g1 = sample(...([at(a1, 0, 0)[0], at(a1, 0, 0)[2]] as [number, number])) ?? mouthGround;
      const y0 = deckMouthY + (g0 + 0.3 - deckMouthY) * t0;
      const y1 = deckMouthY + (g1 + 0.3 - deckMouthY) * t1;
      // Sloped deck.
      pushQuad(
        at(a0, -HALF_WIDTH + 1, y0),
        at(a1, -HALF_WIDTH + 1, y1),
        at(a1, HALF_WIDTH - 1, y1),
        at(a0, HALF_WIDTH - 1, y0),
        DECK_TONE,
      );
      // Retaining walls rise from the deck to just above ground.
      for (const side of [-HALF_WIDTH, HALF_WIDTH]) {
        pushQuad(
          at(a0, side, y0),
          at(a1, side, y1),
          at(a1, side, g1 + 0.7),
          at(a0, side, g0 + 0.7),
          WALL_TONE,
        );
        // Wall coping reads as a drawn edge from above.
        pushQuad(
          at(a0, side - 0.4, g0 + 0.7),
          at(a1, side - 0.4, g1 + 0.7),
          at(a1, side + 0.4, g1 + 0.7),
          at(a0, side + 0.4, g0 + 0.7),
          FRAME_TONE,
        );
      }
    }
    // The dark tube mouth and its portal frame.
    pushQuad(
      at(0, -HALF_WIDTH + 1, deckMouthY),
      at(0, HALF_WIDTH - 1, deckMouthY),
      at(0, HALF_WIDTH - 1, deckMouthY + 5),
      at(0, -HALF_WIDTH + 1, deckMouthY + 5),
      MOUTH_TONE,
    );
    pushQuad(
      at(-1.2, -HALF_WIDTH - 0.6, deckMouthY + 5),
      at(-1.2, HALF_WIDTH + 0.6, deckMouthY + 5),
      at(-1.2, HALF_WIDTH + 0.6, deckMouthY + 6.4),
      at(-1.2, -HALF_WIDTH - 0.6, deckMouthY + 6.4),
      FRAME_TONE,
    );
    built += 1;
  }
  if (built === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const group = new Group();
  group.name = "Tiergartentunnel portals";
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.95,
      side: DoubleSide,
      vertexColors: true,
    }),
  );
  mesh.name = "tunnel portal ramps";
  group.add(mesh);
  const ink = new LineSegments(
    new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES),
    new LineBasicMaterial({ color: ISO_INK_COLOR }),
  );
  ink.name = "tunnel portal ink lines";
  ink.renderOrder = 2;
  group.add(ink);
  return group;
}

/**
 * Quay walls ("die Spree mit Vertiefung"): wherever the surveyed ground
 * grid puts land next to water, a vertical stone wall drops from the
 * bank down past the water line — the river reads as a real recessed
 * channel with drawn embankments instead of a flat blue sheet.
 */
function createQuayWalls(ground: VoxelPayload): Mesh | null {
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
  const waterClass = ground.classes.indexOf("water");
  const landClasses = new Set(
    ["asphalt", "grass", "plazaBrick"].map((name) =>
      ground.classes.indexOf(name),
    ),
  );
  if (waterClass < 0) {
    return null;
  }
  const sample = groundTopSampler(ground);
  const waterTop = ground.water_top_y_m ?? 1.31;
  const positions: number[] = [];
  const colors: number[] = [];
  const paint = new Color();
  const wall = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    xOffset: number,
    zOffset: number,
  ): void => {
    const top = sample(xOffset, zOffset) + 0.22;
    const bottom = waterTop - 0.55;
    if (top <= bottom) {
      return;
    }
    const ax = (min_x_idx + x1) * cell;
    const az = (min_z_idx + z1) * cell;
    const bx = (min_x_idx + x2) * cell;
    const bz = (min_z_idx + z2) * cell;
    paint.setHex((xOffset * 31 + zOffset * 17) % 2 === 0 ? 0x8d897c : 0x969284);
    for (const [px, py, pz] of [
      [ax, bottom, az], [bx, bottom, bz], [bx, top, bz],
      [ax, bottom, az], [bx, top, bz], [ax, top, az],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
  };
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const here = classGrid[z * cols + x];
      if (!landClasses.has(here)) {
        continue;
      }
      if (x + 1 < cols && classGrid[z * cols + x + 1] === waterClass) {
        wall(x + 1, z, x + 1, z + 1, x, z);
      }
      if (x > 0 && classGrid[z * cols + x - 1] === waterClass) {
        wall(x, z, x, z + 1, x, z);
      }
      if (z + 1 < rows && classGrid[(z + 1) * cols + x] === waterClass) {
        wall(x, z + 1, x + 1, z + 1, x, z);
      }
      if (z > 0 && classGrid[(z - 1) * cols + x] === waterClass) {
        wall(x, z, x + 1, z, x, z);
      }
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.95,
      side: DoubleSide,
      vertexColors: true,
    }),
  );
  mesh.name = "drawn quay walls";
  return mesh;
}

/** N-gon prism (top fan + side quads) for round drawn structures. */
function prismTriangles(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
): Float32Array {
  const triangles: number[] = [];
  const top = cy + height / 2;
  const bottom = cy - height / 2;
  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2;
    const a1 = ((index + 1) / segments) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * radius;
    const z0 = cz + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const z1 = cz + Math.sin(a1) * radius;
    triangles.push(cx, top, cz, x1, top, z1, x0, top, z0);
    triangles.push(x0, bottom, z0, x1, bottom, z1, x1, top, z1);
    triangles.push(x0, bottom, z0, x1, top, z1, x0, top, z0);
  }
  return new Float32Array(triangles);
}

/**
 * The western Großer Tiergarten, EXTRAPOLATED (owner-approved): the
 * shipped open data ends at the bounds polygon, but the park factually
 * continues west to the Großer Stern. This group extends the lawn, the
 * Straße des 17. Juni axis and a drawn Siegessäule (67 m column, gilded
 * Viktoria, published dimensions) so the west horizon stops being a
 * void. No buildings are invented — parkland and one documented
 * monument only. Marked via userData.extrapolated.
 */
export function createWestTiergarten(): Group {
  const group = new Group();
  group.name = "extrapolated west Tiergarten (Siegessäule)";
  group.userData.extrapolated = true;
  const bodyGeometries: BufferGeometry[] = [];
  const edgeGeometries: BufferGeometry[] = [];
  const addPart = (
    triangles: Float32Array,
    tone: number,
    inked = true,
  ): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const paint = new Color(tone);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = paint.r;
      colors[index * 3 + 1] = paint.g;
      colors[index * 3 + 2] = paint.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    bodyGeometries.push(geometry);
    if (inked) {
      edgeGeometries.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
    }
  };
  const GROUND_TOP = 2.1;
  // Lawn bands (alternating drawn greens like the surveyed ground).
  const WEST = -1620;
  const EAST = -658;
  const NORTH = -160;
  const SOUTH = 960;
  const bands = 8;
  for (let band = 0; band < bands; band += 1) {
    const z0 = NORTH + ((SOUTH - NORTH) / bands) * band;
    const z1 = NORTH + ((SOUTH - NORTH) / bands) * (band + 1);
    addPart(
      boxTriangles(
        (WEST + EAST) / 2, GROUND_TOP - 1.5, (z0 + z1) / 2,
        [1, 0], EAST - WEST, 3, z1 - z0,
      ),
      ISO_GROUND_SHADES.grass[band % 3],
      false,
    );
  }
  // Straße des 17. Juni: the real axis from the Gate to the Großer Stern.
  const AXIS_FROM: [number, number] = [372, 292];
  const AXIS_TO: [number, number] = [-1459, 456];
  const axisDx = AXIS_TO[0] - AXIS_FROM[0];
  const axisDz = AXIS_TO[1] - AXIS_FROM[1];
  const axisLength = Math.hypot(axisDx, axisDz);
  const axis: [number, number] = [axisDx / axisLength, axisDz / axisLength];
  const roadCenterX = (EAST + AXIS_TO[0]) / 2;
  const roadCenterZ =
    AXIS_FROM[1] + ((roadCenterX - AXIS_FROM[0]) * axisDz) / axisDx;
  addPart(
    boxTriangles(
      roadCenterX, GROUND_TOP - 1.35, roadCenterZ,
      axis, Math.abs(AXIS_TO[0] - EAST) + 90, 3, 42,
    ),
    ISO_GROUND_SHADES.asphalt[0],
    false,
  );
  // Großer Stern circle and the Siegessäule.
  const SX = AXIS_TO[0];
  const SZ = AXIS_TO[1];
  addPart(prismTriangles(SX, GROUND_TOP - 1.3, SZ, 100, 3.2, 16), ISO_GROUND_SHADES.asphalt[1], false);
  addPart(prismTriangles(SX, GROUND_TOP + 0.7, SZ, 22, 1.4, 12), 0xb9b6ac);
  addPart(boxTriangles(SX, GROUND_TOP + 4.9, SZ, axis, 23, 7, 23), 0x9a5f4c);
  addPart(prismTriangles(SX, GROUND_TOP + 10.4, SZ, 9, 4, 12), 0xb9b6ac);
  let columnBase = GROUND_TOP + 12.4;
  for (const [radius, height] of [
    [4.4, 14], [4.0, 13], [3.6, 12], [3.2, 11],
  ] as const) {
    addPart(prismTriangles(SX, columnBase + height / 2, SZ, radius, height, 12), 0xc9b98f);
    columnBase += height;
    addPart(prismTriangles(SX, columnBase + 0.4, SZ, radius + 0.5, 0.8, 12), 0xd4af37);
    columnBase += 0.8;
  }
  addPart(prismTriangles(SX, columnBase + 1.1, SZ, 4.6, 2.2, 12), 0xb9b6ac);
  // Gilded Viktoria: body, raised wreath arm, wings.
  addPart(boxTriangles(SX, columnBase + 5.4, SZ, axis, 2.2, 6.4, 2.2), 0xd4af37);
  addPart(boxTriangles(SX, columnBase + 9.2, SZ, axis, 0.7, 3.4, 0.7), 0xd4af37);
  addPart(boxTriangles(SX, columnBase + 6.6, SZ, [axis[1], -axis[0]], 5.6, 2.6, 0.5), 0xd4af37);
  // "Umkreis ausweiten": a calm paper-pale margin carries the map on
  // the other three sides too — the drawing fades into light ground
  // instead of a void. No buildings are invented; Unter den Linden
  // continues east from the Gate as a drawn axis.
  const MARGIN = 520;
  const marginBands: Array<[number, number, number, number]> = [
    // [centerX, centerZ, sizeX, sizeZ]
    [(EAST + 1150) / 2 - 245, -1030 - MARGIN / 2, 1150 - WEST, MARGIN],
    [(EAST + 1150) / 2 - 245, 1451 + MARGIN / 2, 1150 - WEST, MARGIN],
    [601 + MARGIN / 2, (1451 - 1030) / 2, MARGIN, 1451 + 1030],
  ];
  const MARGIN_TONES = [0xd3dcc8, 0xdae2d0];
  marginBands.forEach(([cx, cz, sx, sz], index) => {
    addPart(
      boxTriangles(cx, GROUND_TOP - 1.6, cz, [1, 0], sx, 2.6, sz),
      MARGIN_TONES[index % 2],
      false,
    );
  });
  // Unter den Linden, continuing east from Pariser Platz.
  addPart(
    boxTriangles(601 + MARGIN / 2, GROUND_TOP - 1.35, 292, [1, 0], MARGIN, 3, 40),
    ISO_GROUND_SHADES.asphalt[0],
    false,
  );

  // Park trees: deterministic scatter off the road and the star circle.
  const trunkSpots: Array<[number, number]> = [];
  for (let index = 0; index < 720; index += 1) {
    const hx = (Math.imul(index + 1, 2654435761) >>> 9) % 10_000;
    const hz = (Math.imul(index + 7, 40503) >>> 3) % 10_000;
    const x = WEST + 20 + ((EAST - WEST - 40) * hx) / 10_000;
    const z = NORTH + 20 + ((SOUTH - NORTH - 40) * hz) / 10_000;
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34 || Math.hypot(x - SX, z - SZ) < 112) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  const trunks = new InstancedMesh(
    new BoxGeometry(0.5, 3.4, 0.5),
    new MeshStandardMaterial({ color: 0x6f5a41, flatShading: true, roughness: 0.9 }),
    trunkSpots.length,
  );
  trunks.name = "extrapolated tree trunks";
  const crowns = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }),
    trunkSpots.length * 2,
  );
  crowns.name = "extrapolated tree crowns";
  const matrix = new Matrix4();
  const crownPaint = new Color();
  const CROWN_TONES = [0x4d7c46, 0x5d8e4f, 0x487550] as const;
  trunkSpots.forEach(([x, z], index) => {
    matrix.identity();
    matrix.setPosition(x, GROUND_TOP + 1.7, z);
    trunks.setMatrixAt(index, matrix);
    const size = 3.6 + ((index * 37) % 5) * 0.55;
    crownPaint.setHex(CROWN_TONES[index % CROWN_TONES.length]);
    matrix.makeScale(size, size * 0.85, size);
    matrix.setPosition(x, GROUND_TOP + 3.4 + size * 0.4, z);
    crowns.setMatrixAt(index * 2, matrix);
    matrix.makeScale(size * 0.6, size * 0.55, size * 0.6);
    matrix.setPosition(x + size * 0.28, GROUND_TOP + 3.4 + size * 0.82, z - size * 0.2);
    crowns.setMatrixAt(index * 2 + 1, matrix);
    crowns.setColorAt(index * 2, crownPaint);
    crowns.setColorAt(index * 2 + 1, crownPaint.clone().multiplyScalar(1.12));
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) {
    crowns.instanceColor.needsUpdate = true;
  }
  trunks.frustumCulled = false;
  crowns.frustumCulled = false;

  const merged = mergeGeometries(bodyGeometries, false);
  if (merged) {
    const mesh = new Mesh(
      merged,
      new MeshStandardMaterial({
        flatShading: true,
        metalness: 0,
        roughness: 0.9,
        vertexColors: true,
      }),
    );
    mesh.name = "extrapolated west ground and Siegessäule";
    group.add(mesh);
    for (const geometry of bodyGeometries) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edgeGeometries, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      new LineBasicMaterial({ color: ISO_INK_COLOR }),
    );
    lines.name = "extrapolated west ink lines";
    lines.renderOrder = 2;
    group.add(lines);
  }
  group.add(trunks);
  group.add(crowns);
  return group;
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
        : color.clone().multiplyScalar(0.97).lerp(ROOF_PLATE_TINT, 0.45);
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
    if (
      totalHeight >= WINDOW_MIN_BUILDING_M &&
      !WINDOWS_SUPPRESSED_IDS.has(building.id)
    ) {
      const ringMeters2 = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const isCivic =
        ringArea(ringMeters2) >= CIVIC_FOOTPRINT_M2 &&
        totalHeight >= CIVIC_HEIGHT_M;
      const format =
        HERO_WINDOW_FORMATS[building.id] ??
        (isCivic ? CIVIC_WINDOW : HOUSING_WINDOW);
      // Windows read as light glass panels ("feine, weiße, helle
      // Paneele"), a touch cooler and brighter than the facade — never
      // as dark punched slits.
      const windDay = new Color(0xe6eef4).lerp(color, 0.22);
      const sillDay = color.clone().multiplyScalar(0.9);
      const sillNight = new Color(0x232a33);
      const nightLit = new Color();
      const nightDark = new Color(WINDOW_NIGHT_DARK_TONE);
      const litLimit = Math.round(WINDOW_LIT_FRACTION * 1000);
      const nightTones = isCivic
        ? WINDOW_NIGHT_CIVIC_TONES
        : WINDOW_NIGHT_LIT_TONES;
      const walls = wallsOf(building);
      // The entrance door lives on the longest wall that carries
      // windows and enough width to step around it.
      let doorWall = -1;
      let doorLength = DOOR_SUPPRESSED_IDS.has(building.id)
        ? Number.POSITIVE_INFINITY
        : DOOR_MIN_WALL_M;
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
            const sill = format.sillStart + floor * format.floorPitch;
            const roll = hash32(building.id, wall.index * 2801 + bay * 53 + floor) % 1000;
            if (roll < litLimit) {
              nightLit.setHex(nightTones[roll % nightTones.length]);
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
            // A light sill ledge under every pane — the elevation's
            // fine horizontal grain.
            windows.push({
              dirX: wall.dirX,
              dirZ: wall.dirZ,
              height: 0.1,
              night: sillNight.clone(),
              nx: wall.nx,
              nz: wall.nz,
              px:
                wall.x1 + wall.dirX * along + wall.nx * (WINDOW_FACE_OFFSET_M + 0.03),
              py: y0 + sill - 0.06,
              pz:
                wall.z1 + wall.dirZ * along + wall.nz * (WINDOW_FACE_OFFSET_M + 0.03),
              tone: sillDay.clone(),
              width: format.width + 0.34,
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
    // Hyperdetail bands: darker Sockel at the base of every wall and a
    // light protruding Gesims under the flat roof edge (pitched roofs
    // already carry their eaves).
    if (totalHeight >= DETAIL_MIN_BUILDING_M) {
      const sockelTone = color.clone().multiplyScalar(0.92);
      const corniceTone = color
        .clone()
        .multiplyScalar(0.95)
        .lerp(ROOF_PLATE_TINT, 0.15);
      for (const wall of wallsOf(building)) {
        if (wall.length < DETAIL_MIN_WALL_M) {
          continue;
        }
        const mx = wall.x1 + (wall.dirX * wall.length) / 2;
        const mz = wall.z1 + (wall.dirZ * wall.length) / 2;
        const sockel = new BufferGeometry();
        sockel.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(
              mx, y0 + SOCKEL_HEIGHT_M / 2, mz,
              [wall.dirX, wall.dirZ],
              wall.length + 0.08, SOCKEL_HEIGHT_M, SOCKEL_DEPTH_M,
            ),
            3,
          ),
        );
        sockel.computeVertexNormals();
        bakeColor(sockel, sockelTone);
        bodyGeometries.push(sockel);
        if (!roofTriangles) {
          const cornice = new BufferGeometry();
          cornice.setAttribute(
            "position",
            new Float32BufferAttribute(
              boxTriangles(
                mx, y0 + bodyHeight - CORNICE_HEIGHT_M / 2, mz,
                [wall.dirX, wall.dirZ],
                wall.length + 0.1, CORNICE_HEIGHT_M, CORNICE_DEPTH_M,
              ),
              3,
            ),
          );
          cornice.computeVertexNormals();
          edgeGeometries.push(
            new EdgesGeometry(cornice, ISO_EDGE_THRESHOLD_DEGREES),
          );
          bakeColor(cornice, corniceTone);
          bodyGeometries.push(cornice);
        }
      }
    }
    // Rooftop furniture on large flat roofs: a couple of drawn HVAC
    // boxes and a glass skylight strip — the isometric view lives on
    // its roofscape.
    if (building.id === "K0002MCN") {
      // The Reichstag roof at drawing quality: the two glass skylight
      // bands flanking the dome over the plenary hall, and the
      // roof-garden restaurant block at the south-west corner.
      const domeX = 317.73;
      const domeZ = 40.48;
      const roofTop = y0 + totalHeight;
      for (const side of [-26, 26]) {
        const skylight = new BufferGeometry();
        skylight.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(domeX, roofTop + 0.35, domeZ + side, [1, 0], 38, 0.7, 7),
            3,
          ),
        );
        skylight.computeVertexNormals();
        edgeGeometries.push(new EdgesGeometry(skylight, ISO_EDGE_THRESHOLD_DEGREES));
        bakeColor(skylight, new Color(FACADE_SHADES.glass[0]));
        glassGeometries.push(skylight);
      }
      const restaurant = new BufferGeometry();
      restaurant.setAttribute(
        "position",
        new Float32BufferAttribute(
          boxTriangles(284, roofTop + 1.8, 86, [1, 0], 16, 3.6, 10),
          3,
        ),
      );
      restaurant.computeVertexNormals();
      edgeGeometries.push(new EdgesGeometry(restaurant, ISO_EDGE_THRESHOLD_DEGREES));
      bakeColor(restaurant, new Color(0xb4b8b2).multiplyScalar(0.96));
      bodyGeometries.push(restaurant);
      const restaurantGlass = new BufferGeometry();
      restaurantGlass.setAttribute(
        "position",
        new Float32BufferAttribute(
          boxTriangles(284, roofTop + 2.4, 81.4, [1, 0], 15, 2, 0.4),
          3,
        ),
      );
      restaurantGlass.computeVertexNormals();
      bakeColor(restaurantGlass, new Color(FACADE_SHADES.glass[1]));
      glassGeometries.push(restaurantGlass);
    }
    if (
      !roofTriangles &&
      totalHeight >= ROOF_FURNITURE_MIN_HEIGHT_M &&
      HERO_PRISM_ROOF_TONES[building.id] === undefined
    ) {
      const ringMeters3 = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      if (ringArea(ringMeters3) >= ROOF_FURNITURE_MIN_AREA_M2) {
        const rect = fitRectangle(ringMeters3);
        if (rect && rect.halfWidth > 5) {
          const topY = y0 + totalHeight;
          const across: [number, number] = [-rect.axis[1], rect.axis[0]];
          const hvacTone = color.clone().multiplyScalar(0.88).lerp(ROOF_PLATE_TINT, 0.35);
          const count = 1 + (hash32(building.id, 9) % 2);
          for (let unit = 0; unit < count; unit += 1) {
            const u =
              (((hash32(building.id, 11 + unit) % 100) / 100) - 0.5) *
              rect.halfLength * 1.05;
            const v =
              (((hash32(building.id, 31 + unit) % 100) / 100) - 0.5) *
              rect.halfWidth * 0.85;
            const hvac = new BufferGeometry();
            hvac.setAttribute(
              "position",
              new Float32BufferAttribute(
                boxTriangles(
                  rect.center[0] + rect.axis[0] * u + across[0] * v,
                  topY + 0.55,
                  rect.center[1] + rect.axis[1] * u + across[1] * v,
                  rect.axis,
                  2.4, 1.1, 1.7,
                ),
                3,
              ),
            );
            hvac.computeVertexNormals();
            edgeGeometries.push(
              new EdgesGeometry(hvac, ISO_EDGE_THRESHOLD_DEGREES),
            );
            bakeColor(hvac, hvacTone);
            bodyGeometries.push(hvac);
          }
          // The skylight strip joins the transparent glass mesh.
          const skylight = new BufferGeometry();
          skylight.setAttribute(
            "position",
            new Float32BufferAttribute(
              boxTriangles(
                rect.center[0], topY + 0.3, rect.center[1],
                rect.axis,
                rect.halfLength * 0.9, 0.6, 1.7,
              ),
              3,
            ),
          );
          skylight.computeVertexNormals();
          edgeGeometries.push(
            new EdgesGeometry(skylight, ISO_EDGE_THRESHOLD_DEGREES),
          );
          const glassShades = FACADE_SHADES.glass;
          bakeColor(
            skylight,
            new Color(glassShades[hash32(building.id, 3) % glassShades.length]),
          );
          glassGeometries.push(skylight);
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
      bakeColor(roofGeometry, color.clone().multiplyScalar(0.9));
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
    // Day is TRUE ligne claire: facades render their exact baked paint,
    // unlit (MeshBasic) — no sun-browning, no murky shadow sides;
    // colour and the fine ink separate the planes ("Leichtigkeit").
    // Night swaps to the lit material for the moonlit mood.
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.95,
      vertexColors: true,
    });
    const mesh = new Mesh(bodies, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
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
    const portals = createTunnelPortals(tunnelPoints, ground);
    if (portals) {
      group.add(portals);
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
    const quays = createQuayWalls(ground);
    if (quays) {
      group.add(quays);
    }
  }
  group.add(createWestTiergarten());
  return group;
}
