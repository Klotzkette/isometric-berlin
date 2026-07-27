import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
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
// Versioned visible-map radius (metres): half the larger span of the
// drawn envelope incl. the extrapolated surround. The areal-expansion
// contract grows this by exactly +100 m per run: v0.24.0 was 2110 m
// (envelope z −2000…2420), v0.26.0 is 2310 m (z −2100…2520),
// v0.31.0 was 2810 m (z −2600…3020), v0.32.0 is 2910 m (z −2700…3120).
export const VISIBLE_RADIUS_M = 2910;
export const EXTRAPOLATED_WEST_M = -2620;
export const EXTRAPOLATED_MARGIN_M = 1620;
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
  K0002MCN: 0xb2ada2,
  MLwG4KW9: 0xeeeeea,
};

// Pinned roof-plate tones: the Reichstag's huge cap (and its corner
// towers) read as the real light stone terrace instead of sun-warmed
// facade brown; the Chancellery roof stays light.
export const HERO_PRISM_ROOF_TONES: Record<string, number> = {
  K0002MCN: 0xe1e3dc,
  K0003Ty1: 0xe1e3dc,
  K0003VDk: 0xe1e3dc,
  MLwG4KW9: 0xeff1ec,
  UbQkgNZe: 0xe1e3dc,
  ycOYQRVL: 0xe1e3dc,
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
  // Bright ivory band: no murky greys or dark yellows survive.
  // Ten bands rather than six: the raised floor would otherwise collapse
  // every facade onto two paint levels and flatten the drawing.
  const clamped = Math.min(0.88, Math.max(0.68, luma));
  const bands = 10;
  const quantised = Math.round(clamped * (bands - 1)) / (bands - 1);
  const scale = quantised / Math.max(luma, 1e-3);
  return new Color(clamp01(r * scale), clamp01(g * scale), clamp01(b * scale));
}

// Soft, flat illustration tones for the day ground (NOT the Minecraft
// palette): calm park green, light asphalt, Spree blue, plaza brick.
export const ISO_GROUND_SHADES: Record<string, readonly number[]> = {
  asphalt: [0xcbccc5, 0xcdcec7],
  // Closely spaced sage lawns avoid noisy stripes while retaining enough
  // separation to read the park as a drawn surface.
  grass: [0xc7dab9, 0xc8dbba, 0xc6d9b8],
  plazaBrick: [0xecd9c3, 0xead6c0],
  // Drawn bridge decks: light stone, clearly distinct from water below.
  bridge: [0xe3dfd5, 0xe5e1d7],
  water: [0xb6d7e6, 0xb4d6e5],
};

// Flat drawn facade tones per building class, with deterministic
// per-building jitter between shades (quantised paint, no gradients).
const FACADE_SHADES: Record<string, readonly number[]> = {
  concrete: [0xf4eee0, 0xeee7d7, 0xf8f4ea, 0xe9e1cf],
  glass: [0xd2e5ea, 0xdeedf1, 0xc6dbe3],
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

// The whole city leans toward one warm ivory register ("wie eine
// wunderbare Elfenbeinpalastdarstellung") while each building keeps
// enough of its own sampled hue to stay recognisably itself.
const IVORY = new Color(0xf8f3e6);

function facadeColorFor(building: PrismBuilding, classes: string[]): Color {
  const pinned = HERO_PRISM_TONES[building.id];
  if (pinned !== undefined) {
    return new Color(pinned).lerp(IVORY, 0.18);
  }
  if (inReichstagRegion(building)) {
    return new Color(0xc2bdb0).lerp(IVORY, 0.2);
  }
  // Each building carries its sampled real colour ("den jeweiligen
  // Gebäudetyp angleichen"); the shared class shades are only the
  // fallback for footprints without a valid sample.
  if (building.tone) {
    return cleanedTone(building.tone).lerp(IVORY, 0.42);
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
  const backdrop = city.getObjectByName("presentation paper backdrop");
  if (backdrop instanceof Mesh) {
    backdrop.material = night
      ? (backdrop.userData.nightMaterial as MeshBasicMaterial)
      : (backdrop.userData.dayMaterial as MeshBasicMaterial);
  }
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
    glass.material = night
      ? (glass.userData.nightMaterial as MeshStandardMaterial)
      : (glass.userData.dayMaterial as MeshBasicMaterial);
    const nightMaterial = glass.userData
      .nightMaterial as MeshStandardMaterial;
    nightMaterial.emissive.setHex(night ? 0x0e1a24 : 0x000000);
    nightMaterial.emissiveIntensity = night ? 0.7 : 0;
    nightMaterial.needsUpdate = true;
  }
  const surround = city.getObjectByName(
    "extrapolated west ground and Siegessäule",
  );
  if (surround instanceof Mesh) {
    surround.material = night
      ? (surround.userData.nightMaterial as MeshStandardMaterial)
      : (surround.userData.dayMaterial as MeshBasicMaterial);
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
  // Accessory meshes share the prism convention: exact flat paint by
  // day (unlit), the lit material only under the night rig.
  for (const name of [
    "drawn quay walls",
    "bridge structure bodies",
    "Adlon bodies",
    "Paul-Löbe canopy bodies",
    "tunnel portal ramps",
    "monument bodies",
  ]) {
    const accessory = city.getObjectByName(name);
    if (accessory instanceof Mesh && accessory.userData.dayMaterial) {
      accessory.material = night
        ? (accessory.userData.nightMaterial as MeshStandardMaterial)
        : (accessory.userData.dayMaterial as MeshBasicMaterial);
    }
  }
  // The extrapolated west follows the same ink and lamp conventions.
  const adlonInk = city.getObjectByName("Adlon ink lines");
  if (adlonInk instanceof LineSegments) {
    (adlonInk.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const canopyInk = city.getObjectByName("Paul-Löbe canopy ink lines");
  if (canopyInk instanceof LineSegments) {
    (canopyInk.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const westInk = city.getObjectByName("extrapolated west ink lines");
  if (westInk instanceof LineSegments) {
    (westInk.material as LineBasicMaterial).color.setHex(
      night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
    );
  }
  const lampHeads = city.getObjectByName("extrapolated lamp heads");
  if (lampHeads instanceof InstancedMesh) {
    // Neutral fixture by day, warm glow only after dark.
    (lampHeads.material as MeshBasicMaterial).color.setHex(
      night ? 0xffd9a0 : 0xb9b3a6,
    );
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
  // Facade axes: fine ink by day, dimmed to a whisper at night so the
  // warm light strips carry the reading instead.
  const axes = city.getObjectByName("LoD2 facade axes");
  if (axes instanceof LineSegments) {
    const material = axes.material as LineBasicMaterial;
    material.color.setHex(night ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR);
    material.opacity = night ? 0.12 : 0.34;
  }
  const strips = city.getObjectByName("LoD2 facade night strips");
  if (strips) {
    strips.visible = night;
  }
  const waterSurface = city.getObjectByName("drawn water surface");
  if (waterSurface instanceof InstancedMesh) {
    (waterSurface.material as MeshBasicMaterial).color.setHex(
      night ? 0x27435c : 0x9fc7d8,
    );
    (waterSurface.material as MeshBasicMaterial).opacity = night ? 0.6 : 0.45;
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
  const railingInk = city.getObjectByName("bridge structure ink lines");
  if (railingInk instanceof LineSegments) {
    (railingInk.material as LineBasicMaterial).color.setHex(
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
// Warm grey joinery — dark enough to draw the opening, light enough not
// to blacken the ivory facades when the whole quarter is in frame.
const WINDOW_BAR_TONE = 0x8b8578;
// Cool pale glass against the brightened ivory walls: light enough to
// stay in the drawing's register, dark enough that a 1 px pane still
// registers as an opening from the overview.
const WINDOW_DAY_TONE = 0xb4c4cc;

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
// Doors sit proud of the Sockel band (0.16 m half-depth), never inside it.
const DOOR_FACE_OFFSET_M = 0.26;
const DOOR_HEIGHT_M = 2.35;
const DOOR_MIN_WALL_M = 5;
const DOOR_CLEARANCE_M = 1.6;
const DOOR_DAY_TONE = 0x5b564e;
const DOOR_NIGHT_TONE = 0x1c232e;
const DOOR_NIGHT_LIT_TONE = 0xd9a45e;
// Cool slate tint mixed into flat roof caps so they read as drawn
// roof plates instead of sun-warmed facade paint.
const ROOF_PLATE_TINT = new Color(0xcdd2d4);
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
  // Joinery is instanced separately: drawing Sprossen into all ~120k
  // ordinary panes would cost more triangles than the whole city.
  joinery: boolean;
  night: Color;
  nx: number;
  nz: number;
  px: number;
  py: number;
  pz: number;
  tone: Color;
  width: number;
};

// Drawn window joinery in the unit pane's own space (x,y ∈ [-0.5, 0.5],
// +z outward), so it can ride the very same instance matrices as the
// panes: a reveal frame (Laibung) around the opening, one vertical
// mullion and one transom in the upper third (Sprossen). Without these
// a pane is a bare rectangle — the "hässliche Quadratfenster" the style
// contract rules out.
const WINDOW_REVEAL_T = 0.075;
const WINDOW_MULLION_HALF = 0.032;
const WINDOW_TRANSOM_Y = 0.17;
const WINDOW_TRANSOM_HALF = 0.03;
const WINDOW_BAR_OUT = 0.02;

export function windowBarGeometry(): BufferGeometry {
  const t = WINDOW_REVEAL_T;
  const inner = 0.5 - t;
  const quads: Array<[number, number, number, number]> = [
    [-0.5, -0.5, -0.5 + t, 0.5],
    [0.5 - t, -0.5, 0.5, 0.5],
    [-inner, -0.5, inner, -0.5 + t],
    [-inner, 0.5 - t, inner, 0.5],
    [-WINDOW_MULLION_HALF, -inner, WINDOW_MULLION_HALF, inner],
    [
      -inner,
      WINDOW_TRANSOM_Y - WINDOW_TRANSOM_HALF,
      inner,
      WINDOW_TRANSOM_Y + WINDOW_TRANSOM_HALF,
    ],
  ];
  const positions: number[] = [];
  for (const [x0, y0, x1, y1] of quads) {
    for (const [px, py] of [
      [x0, y0], [x1, y0], [x1, y1],
      [x0, y0], [x1, y1], [x0, y1],
    ] as const) {
      positions.push(px, py, WINDOW_BAR_OUT);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

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
  const DECK_TONE = 0xb6b7b0;
  const WALL_TONE = 0xb2afa4;
  const FRAME_TONE = 0xbbb8ae;
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
    // Lane markings down the ramp: the B96 carries two lanes per bore,
    // so a dashed centre line and two solid edge lines read as road.
    const LANE_TONE = 0xeeeadd;
    for (let step = 0; step < 26; step += 1) {
      const a0 = (step / 26) * RAMP_LENGTH;
      const a1 = ((step + 0.55) / 26) * RAMP_LENGTH;
      const t0 = step / 26;
      const g0 = sample(...([at(a0, 0, 0)[0], at(a0, 0, 0)[2]] as [number, number])) ?? mouthGround;
      const y0 = deckMouthY + (g0 + 0.3 - deckMouthY) * t0 + 0.06;
      // Dashed centre line.
      pushQuad(
        at(a0, -0.18, y0),
        at(a1, -0.18, y0),
        at(a1, 0.18, y0),
        at(a0, 0.18, y0),
        LANE_TONE,
      );
      // Solid edge lines.
      for (const side of [-HALF_WIDTH + 1.6, HALF_WIDTH - 1.6]) {
        const a2 = ((step + 1) / 26) * RAMP_LENGTH;
        pushQuad(
          at(a0, side - 0.15, y0),
          at(a2, side - 0.15, y0),
          at(a2, side + 0.15, y0),
          at(a0, side + 0.15, y0),
          LANE_TONE,
        );
      }
    }
    // Crash barriers along both retaining walls.
    const BARRIER_TONE = 0xdbd5c6;
    for (let step = 0; step < 8; step += 1) {
      const a0 = (step / 8) * RAMP_LENGTH;
      const a1 = ((step + 1) / 8) * RAMP_LENGTH;
      const t0 = step / 8;
      const t1 = (step + 1) / 8;
      const g0 = sample(...([at(a0, 0, 0)[0], at(a0, 0, 0)[2]] as [number, number])) ?? mouthGround;
      const g1 = sample(...([at(a1, 0, 0)[0], at(a1, 0, 0)[2]] as [number, number])) ?? mouthGround;
      const y0 = deckMouthY + (g0 + 0.3 - deckMouthY) * t0 + 0.75;
      const y1 = deckMouthY + (g1 + 0.3 - deckMouthY) * t1 + 0.75;
      for (const side of [-HALF_WIDTH + 0.7, HALF_WIDTH - 0.7]) {
        pushQuad(
          at(a0, side, y0),
          at(a1, side, y1),
          at(a1, side, y1 + 0.42),
          at(a0, side, y0 + 0.42),
          BARRIER_TONE,
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
    // Portal cap above the mouth — the built structure, not a hole.
    pushQuad(
      at(-2.4, -HALF_WIDTH - 0.6, deckMouthY + 6.4),
      at(-2.4, HALF_WIDTH + 0.6, deckMouthY + 6.4),
      at(1.2, HALF_WIDTH + 0.6, deckMouthY + 6.4),
      at(1.2, -HALF_WIDTH - 0.6, deckMouthY + 6.4),
      FRAME_TONE,
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
  const portalDay = new MeshBasicMaterial({
    side: DoubleSide,
    vertexColors: true,
  });
  const portalNight = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0,
    roughness: 0.95,
    side: DoubleSide,
    vertexColors: true,
  });
  const mesh = new Mesh(geometry, portalDay);
  mesh.userData.dayMaterial = portalDay;
  mesh.userData.nightMaterial = portalNight;
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

// Embankment furniture: balustrade proportions and the shortest run
// that still earns a flight of steps down to the water.
const RAIL_HEIGHT_M = 1.05;
const RAIL_BAR_M = 0.12;
const RAIL_POST_SPACING_M = 3.2;
const RAIL_POST_W_M = 0.11;
export const STAIR_MIN_RUN_M = 26;
const STAIR_WIDTH_M = 4.2;

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
    towardWaterX: number,
    towardWaterZ: number,
  ): void => {
    const top = sample(xOffset, zOffset) + 0.22;
    const bottom = waterTop - 2.4;
    if (top <= bottom) {
      return;
    }
    const ax = (min_x_idx + x1) * cell;
    const az = (min_z_idx + z1) * cell;
    const bx = (min_x_idx + x2) * cell;
    const bz = (min_z_idx + z2) * cell;
    paint.setHex((xOffset * 31 + zOffset * 17) % 2 === 0 ? 0xa5a193 : 0xadaa9c);
    for (const [px, py, pz] of [
      [ax, bottom, az], [bx, bottom, bz], [bx, top, bz],
      [ax, bottom, az], [bx, top, bz], [ax, top, az],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
    // The riverside promenade: a light boardwalk ledge just above the
    // water, jutting from the quay wall — the "Weg zum Ufer".
    const ledgeY = waterTop + 0.55;
    const jut = 2.2;
    paint.setHex(0xe4ddcb);
    for (const [px, py, pz] of [
      [ax, ledgeY, az], [bx, ledgeY, bz],
      [bx + towardWaterX * jut, ledgeY, bz + towardWaterZ * jut],
      [ax, ledgeY, az],
      [bx + towardWaterX * jut, ledgeY, bz + towardWaterZ * jut],
      [ax + towardWaterX * jut, ledgeY, az + towardWaterZ * jut],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
    // Its thin front face down to the water keeps the ledge readable.
    paint.setHex(0xd0c9b7);
    for (const [px, py, pz] of [
      [ax + towardWaterX * jut, ledgeY, az + towardWaterZ * jut],
      [bx + towardWaterX * jut, ledgeY, bz + towardWaterZ * jut],
      [bx + towardWaterX * jut, waterTop - 0.3, bz + towardWaterZ * jut],
      [ax + towardWaterX * jut, ledgeY, az + towardWaterZ * jut],
      [bx + towardWaterX * jut, waterTop - 0.3, bz + towardWaterZ * jut],
      [ax + towardWaterX * jut, waterTop - 0.3, az + towardWaterZ * jut],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
    const runLength = Math.hypot(bx - ax, bz - az);
    if (runLength < 1e-3) {
      return;
    }
    const ux = (bx - ax) / runLength;
    const uz = (bz - az) / runLength;
    const quad = (
      x0: number, y0: number, z0: number,
      x1v: number, y1v: number, z1v: number,
      x2: number, y2: number, z2: number,
      x3: number, y3: number, z3: number,
    ): void => {
      for (const [px, py, pz] of [
        [x0, y0, z0], [x1v, y1v, z1v], [x2, y2, z2],
        [x0, y0, z0], [x2, y2, z2], [x3, y3, z3],
      ] as const) {
        positions.push(px, py, pz);
        colors.push(paint.r, paint.g, paint.b);
      }
    };
    // Promenade balustrade: slim drawn posts on the embankment edge with
    // a continuous top rail, so the quay is walkable instead of a bare
    // drop into the Spree.
    paint.setHex(0xada89a);
    const railTop = top + RAIL_HEIGHT_M;
    quad(
      ax, railTop, az,
      bx, railTop, bz,
      bx, railTop - RAIL_BAR_M, bz,
      ax, railTop - RAIL_BAR_M, az,
    );
    const postCount = Math.max(1, Math.round(runLength / RAIL_POST_SPACING_M));
    for (let index = 0; index <= postCount; index += 1) {
      const t = (index / postCount) * runLength;
      const sx = ax + ux * t;
      const sz = az + uz * t;
      const ex = sx + ux * RAIL_POST_W_M;
      const ez = sz + uz * RAIL_POST_W_M;
      quad(sx, top, sz, ex, top, ez, ex, railTop, ez, sx, railTop, sz);
    }
    // A drawn flight of steps down to the water wherever the embankment
    // runs long enough to carry one ("Treppen ans Wasser").
    if (runLength >= STAIR_MIN_RUN_M) {
      paint.setHex(0xd8d1bf);
      const mid = runLength / 2 - STAIR_WIDTH_M / 2;
      const steps = 5;
      for (let step = 0; step < steps; step += 1) {
        const y = top - ((top - waterTop) * (step + 1)) / steps;
        const outset = ((step + 1) / steps) * jut;
        const sx = ax + ux * mid;
        const sz = az + uz * mid;
        const ex = sx + ux * STAIR_WIDTH_M;
        const ez = sz + uz * STAIR_WIDTH_M;
        quad(
          sx + towardWaterX * outset, y, sz + towardWaterZ * outset,
          ex + towardWaterX * outset, y, ez + towardWaterZ * outset,
          ex + towardWaterX * (outset - jut / steps), y, ez + towardWaterZ * (outset - jut / steps),
          sx + towardWaterX * (outset - jut / steps), y, sz + towardWaterZ * (outset - jut / steps),
        );
      }
    }
  };
  // Merge consecutive boundary cells into RUNS before building, so the
  // quay reads as a continuous embankment line instead of a per-cell
  // staircase ("nicht ausgefranst und zackig, sondern normal").
  const isLand = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < cols && z < rows && landClasses.has(classGrid[z * cols + x]);
  const isWater = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < cols && z < rows && classGrid[z * cols + x] === waterClass;
  // Vertical faces (water east/west of land): merge along z.
  for (const dir of [1, -1] as const) {
    for (let x = 0; x < cols; x += 1) {
      let z = 0;
      while (z < rows) {
        if (!(isLand(x, z) && isWater(x + dir, z))) {
          z += 1;
          continue;
        }
        const start = z;
        while (z < rows && isLand(x, z) && isWater(x + dir, z)) {
          z += 1;
        }
        const edgeX = dir === 1 ? x + 1 : x;
        wall(edgeX, start, edgeX, z, x, start, dir, 0);
      }
    }
  }
  // Horizontal faces (water north/south of land): merge along x.
  for (const dir of [1, -1] as const) {
    for (let z = 0; z < rows; z += 1) {
      let x = 0;
      while (x < cols) {
        if (!(isLand(x, z) && isWater(x, z + dir))) {
          x += 1;
          continue;
        }
        const start = x;
        while (x < cols && isLand(x, z) && isWater(x, z + dir)) {
          x += 1;
        }
        const edgeZ = dir === 1 ? z + 1 : z;
        wall(start, edgeZ, x, edgeZ, start, z, 0, dir);
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
  const quayDay = new MeshBasicMaterial({
    side: DoubleSide,
    vertexColors: true,
  });
  const quayNight = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0,
    roughness: 0.95,
    side: DoubleSide,
    vertexColors: true,
  });
  const mesh = new Mesh(geometry, quayDay);
  mesh.userData.dayMaterial = quayDay;
  mesh.userData.nightMaterial = quayNight;
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
/**
 * Bridge railings: wherever a bridge deck cell borders water, a slim
 * drawn parapet rises from the deck edge — the Gustav-Heinemann-Brücke
 * and its siblings stop being flat strips ironed over the Spree.
 */
/**
 * Real bridge structures ("müssen durch die Luft gehen"): the surveyed
 * bridge cells are clustered into individual bridges (Moltkebrücke,
 * Gustav-Heinemann-Brücke, Hugo-Preuß-Brücke …), each one fitted to an
 * oriented rectangle. Every bridge then gets drawn abutments at the
 * banks, stone piers standing in the riverbed, segmental arch webs
 * spanning between them and an elevated deck plate — so the bridge
 * carries itself through the air instead of being painted onto the
 * water. Positions and extents come from the ground grid; the drawing
 * is ours.
 */
function bridgeClusters(ground: VoxelPayload): Array<Array<[number, number]>> {
  const { cols, rows } = ground.grid;
  const bridgeClass = ground.classes.indexOf("bridge");
  if (bridgeClass < 0) {
    return [];
  }
  const grid = new Int16Array(cols * rows).fill(-1);
  ground.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      for (let step = 0; step < run; step += 1) {
        const x = xStart + step;
        if (x >= 0 && x < cols && zOffset < rows) {
          grid[zOffset * cols + x] = classId;
        }
      }
    }
  });
  const seen = new Uint8Array(cols * rows);
  const clusters: Array<Array<[number, number]>> = [];
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = z * cols + x;
      if (grid[index] !== bridgeClass || seen[index]) {
        continue;
      }
      const stack: Array<[number, number]> = [[x, z]];
      seen[index] = 1;
      const cluster: Array<[number, number]> = [];
      while (stack.length > 0) {
        const [cx, cz] = stack.pop() as [number, number];
        cluster.push([cx, cz]);
        // Radius 2: one carriageway interrupted by water cells must
        // still form a SINGLE bridge, otherwise each fragment builds
        // its own short deck and the span reads as zigzag steps.
        for (let dz = -2; dz <= 2; dz += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) {
              continue;
            }
            const nIndex = nz * cols + nx;
            if (grid[nIndex] === bridgeClass && !seen[nIndex]) {
              seen[nIndex] = 1;
              stack.push([nx, nz]);
            }
          }
        }
      }
      clusters.push(cluster);
    }
  }
  return clusters;
}

export const BRIDGE_MIN_CLUSTER_CELLS = 12;

function createBridgeStructures(ground: VoxelPayload): Group | null {
  const clusters = bridgeClusters(ground).filter(
    (cluster) => cluster.length >= BRIDGE_MIN_CLUSTER_CELLS,
  );
  if (clusters.length === 0) {
    return null;
  }
  const cell = ground.cell_m;
  const { min_x_idx, min_z_idx } = ground.grid;
  const sample = groundTopSampler(ground);
  const waterTop = ground.water_top_y_m ?? 1.31;
  const BED_Y = waterTop - 2.45;
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const STONE = new Color(0xdedacd);
  const STONE_DARK = new Color(0xcdc7b7);
  const DECK = new Color(0xc4c5bd);
  const addPart = (
    triangles: Float32Array,
    tone: Color,
    inked = true,
  ): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    if (inked) {
      edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
    }
  };
  for (const cluster of clusters) {
    const points = cluster.map(
      ([x, z]) =>
        [(min_x_idx + x + 0.5) * cell, (min_z_idx + z + 0.5) * cell] as [
          number,
          number,
        ],
    );
    const rect = fitRectangle(points);
    if (!rect) {
      continue;
    }
    // Deck height: the highest surveyed ground under the bridge cells —
    // that is the bank level the carriageway runs at.
    let deckY = waterTop + 3.4;
    for (const [x, z] of cluster) {
      deckY = Math.max(deckY, sample(x, z) + 0.55);
    }
    const [ax, az] = rect.axis;
    const nx = -az;
    const nz = ax;
    // Road bridges over the Spree are 18–26 m wide and rest on both
    // banks: widen thin clusters and extend the span onto the abutments.
    const halfLength = Math.max(rect.halfLength, cell) + 5;
    const halfWidth = Math.max(rect.halfWidth, 8.5);
    const [cx, cz] = rect.center;
    const at = (u: number, v: number): [number, number] => [
      cx + ax * u + nx * v,
      cz + az * u + nz * v,
    ];
    // Elevated deck plate.
    addPart(
      boxTriangles(cx, deckY - 0.35, cz, rect.axis, halfLength * 2, 0.7, halfWidth * 2),
      DECK,
    );
    // Two longitudinal edge beams give the deck its drawn thickness,
    // and a slim parapet rides each deck edge.
    for (const side of [-1, 1]) {
      const [bx, bz] = at(0, side * (halfWidth - 0.35));
      addPart(
        boxTriangles(bx, deckY - 0.95, bz, rect.axis, halfLength * 2, 0.6, 0.7),
        STONE_DARK,
      );
      const [rx, rz] = at(0, side * halfWidth);
      addPart(
        boxTriangles(rx, deckY + 0.55, rz, rect.axis, halfLength * 2, 1.1, 0.16),
        STONE,
      );
    }
    // Piers every ~22 m, standing on the riverbed, plus segmental arch
    // webs between them so the span reads as structure, not a slab.
    const spanCount = Math.max(1, Math.round((halfLength * 2) / 22));
    const pierHeight = deckY - 1.25 - BED_Y;
    for (let index = 0; index <= spanCount; index += 1) {
      const u = -halfLength + (index / spanCount) * halfLength * 2;
      const inner = index > 0 && index < spanCount;
      const [px, pz] = at(u, 0);
      const pierWidth = inner ? 2.6 : 4.2;
      addPart(
        boxTriangles(
          px,
          BED_Y + pierHeight / 2,
          pz,
          rect.axis,
          pierWidth,
          pierHeight,
          halfWidth * 2 - 0.6,
        ),
        inner ? STONE : STONE_DARK,
      );
      if (index < spanCount) {
        // Segmental arch drawn as two slender side girders that dip
        // between the piers — visible from the side, never breaking
        // through the deck plate above.
        const spanLength = (halfLength * 2) / spanCount;
        const steps = 5;
        const maxDip = Math.min(2.4, pierHeight * 0.45);
        for (let step = 0; step < steps; step += 1) {
          const t = (step + 0.5) / steps;
          const dip = Math.sin(t * Math.PI) * maxDip;
          const [wx, wz] = at(u + spanLength * t, 0);
          for (const side of [-1, 1]) {
            const gx = wx + nx * side * (halfWidth - 0.9);
            const gz = wz + nz * side * (halfWidth - 0.9);
            addPart(
              boxTriangles(
                gx,
                deckY - 1.6 - dip / 2,
                gz,
                rect.axis,
                spanLength / steps + 0.1,
                0.9 + dip,
                0.85,
              ),
              STONE,
              false,
            );
          }
        }
      }
    }
  }
  if (parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "drawn bridge structures";
  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "bridge structure bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      new LineBasicMaterial({ color: ISO_INK_COLOR }),
    );
    lines.name = "bridge structure ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

function createBridgeRailings(ground: VoxelPayload): Group | null {
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
  const bridgeClass = ground.classes.indexOf("bridge");
  const waterClass = ground.classes.indexOf("water");
  if (bridgeClass < 0 || waterClass < 0) {
    return null;
  }
  const sample = groundTopSampler(ground);
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const tone = new Color(0xdfdaca);
  const rail = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    xOffset: number,
    zOffset: number,
  ): void => {
    const deckTop = sample(xOffset, zOffset);
    const midX = ((min_x_idx + x1) * cell + (min_x_idx + x2) * cell) / 2;
    const midZ = ((min_z_idx + z1) * cell + (min_z_idx + z2) * cell) / 2;
    const dirX = ((x2 - x1) * cell) / Math.hypot((x2 - x1) * cell, (z2 - z1) * cell);
    const dirZ = ((z2 - z1) * cell) / Math.hypot((x2 - x1) * cell, (z2 - z1) * cell);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        boxTriangles(midX, deckTop + 0.55, midZ, [dirX, dirZ], cell, 1.05, 0.16),
        3,
      ),
    );
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
  };
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (classGrid[z * cols + x] !== bridgeClass) {
        continue;
      }
      if (x + 1 >= cols || classGrid[z * cols + x + 1] === waterClass) {
        rail(x + 1, z, x + 1, z + 1, x, z);
      }
      if (x === 0 || classGrid[z * cols + x - 1] === waterClass) {
        rail(x, z, x, z + 1, x, z);
      }
      if (z + 1 >= rows || classGrid[(z + 1) * cols + x] === waterClass) {
        rail(x, z + 1, x + 1, z + 1, x, z);
      }
      if (z === 0 || classGrid[(z - 1) * cols + x] === waterClass) {
        rail(x, z, x + 1, z, x, z);
      }
    }
  }
  if (parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "drawn bridge railings";
  const merged = mergeGeometries(parts, false);
  if (merged) {
    const railDay = new MeshBasicMaterial({ vertexColors: true });
    const railNight = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, railDay);
    mesh.userData.dayMaterial = railDay;
    mesh.userData.nightMaterial = railNight;
    mesh.name = "bridge railing bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      new LineBasicMaterial({ color: ISO_INK_COLOR }),
    );
    lines.name = "bridge railing ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

export function createWestTiergarten(): Group {
  const group = new Group();
  group.name = "extrapolated west Tiergarten (Siegessäule)";
  group.userData.extrapolated = true;
  group.userData.visibleRadiusM = VISIBLE_RADIUS_M;
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
  const WEST = EXTRAPOLATED_WEST_M;
  const V022_WEST = -1720;
  const V023_WEST = -1820;
  const V024_WEST = -1920;
  const V025_WEST = -2020;
  const V026_WEST = -2120;
  const V027_WEST = -2220;
  const V028_WEST = -2320;
  const V029_WEST = -2420;
  const V030_WEST = -2520;
  const EAST = -658;
  const NORTH = -160;
  const SOUTH = 960;
  // A recessed paper ground closes transparent gaps between the bounded
  // official grid, the western park and the three margin bands. It sits below
  // water and terrain, so it cannot move or cover surveyed geometry; it only
  // prevents trees from appearing to float against the sky at maximum flight.
  const PAPER_EAST = 1680;
  const PAPER_NORTH = -2100;
  const PAPER_SOUTH = 2520;
  addPart(
    boxTriangles(
      (WEST + PAPER_EAST) / 2,
      GROUND_TOP - 4.2,
      (PAPER_NORTH + PAPER_SOUTH) / 2,
      [1, 0],
      PAPER_EAST - WEST,
      1.2,
      PAPER_SOUTH - PAPER_NORTH,
    ),
    0xe9efe4,
    false,
  );
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
  addPart(prismTriangles(SX, GROUND_TOP + 0.7, SZ, 22, 1.4, 12), 0xcbc8be);
  addPart(boxTriangles(SX, GROUND_TOP + 4.9, SZ, axis, 23, 7, 23), 0x9a5f4c);
  addPart(prismTriangles(SX, GROUND_TOP + 10.4, SZ, 9, 4, 12), 0xcbc8be);
  let columnBase = GROUND_TOP + 12.4;
  for (const [radius, height] of [
    [4.4, 14], [4.0, 13], [3.6, 12], [3.2, 11],
  ] as const) {
    addPart(prismTriangles(SX, columnBase + height / 2, SZ, radius, height, 12), 0xc9b98f);
    columnBase += height;
    addPart(prismTriangles(SX, columnBase + 0.4, SZ, radius + 0.5, 0.8, 12), 0xd4af37);
    columnBase += 0.8;
  }
  addPart(prismTriangles(SX, columnBase + 1.1, SZ, 4.6, 2.2, 12), 0xcbc8be);
  // Gilded Viktoria: body, raised wreath arm, wings.
  addPart(boxTriangles(SX, columnBase + 5.4, SZ, axis, 2.2, 6.4, 2.2), 0xd4af37);
  addPart(boxTriangles(SX, columnBase + 9.2, SZ, axis, 0.7, 3.4, 0.7), 0xd4af37);
  addPart(boxTriangles(SX, columnBase + 6.6, SZ, [axis[1], -axis[0]], 5.6, 2.6, 0.5), 0xd4af37);
  // "Umkreis ausweiten": a calm paper-pale margin carries the map on
  // the other three sides too — the drawing fades into light ground
  // instead of a void. No buildings are invented; Unter den Linden
  // continues east from the Gate as a drawn axis.
  const MARGIN = EXTRAPOLATED_MARGIN_M;
  const previousHorizontalCenter = (EAST + 1150) / 2 - 245;
  const horizontalOuterEast =
    previousHorizontalCenter + (1150 - WEST) / 2;
  const horizontalCenter = (WEST + horizontalOuterEast) / 2;
  const horizontalWidth = horizontalOuterEast - WEST;
  const marginBands: Array<[number, number, number, number]> = [
    // [centerX, centerZ, sizeX, sizeZ]
    [horizontalCenter, -1030 - MARGIN / 2, horizontalWidth, MARGIN],
    [horizontalCenter, 1451 + MARGIN / 2, horizontalWidth, MARGIN],
    [601 + MARGIN / 2, (1451 - 1030) / 2, MARGIN, 1451 + 1030],
  ];
  const MARGIN_TONES = [0xe6ece1, 0xebf0e6];
  marginBands.forEach(([cx, cz, sx, sz], index) => {
    addPart(
      boxTriangles(cx, GROUND_TOP - 1.6, cz, [1, 0], sx, 2.6, sz),
      MARGIN_TONES[index % 2],
      false,
    );
  });
  // The margin used to be three blank slabs, which read as unfinished
  // paper next to the drawn centre. A 140 m field grid of hairlines gives
  // it the same drawn surface quality without inventing buildings: it is
  // cartographic ruling, not surveyed content.
  const FIELD_PITCH_M = 140;
  const fieldLines: number[] = [];
  const fieldY = GROUND_TOP - 0.28;
  for (const [cx, cz, sx, sz] of marginBands) {
    const x0 = cx - sx / 2;
    const z0 = cz - sz / 2;
    for (let x = x0; x <= cx + sx / 2 + 1e-6; x += FIELD_PITCH_M) {
      fieldLines.push(x, fieldY, z0, x, fieldY, cz + sz / 2);
    }
    for (let z = z0; z <= cz + sz / 2 + 1e-6; z += FIELD_PITCH_M) {
      fieldLines.push(x0, fieldY, z, cx + sx / 2, fieldY, z);
    }
  }
  const fieldGrid = new BufferGeometry();
  fieldGrid.setAttribute(
    "position",
    new Float32BufferAttribute(fieldLines, 3),
  );
  edgeGeometries.push(fieldGrid);
  // Unter den Linden, continuing east from Pariser Platz.
  addPart(
    boxTriangles(601 + MARGIN / 2, GROUND_TOP - 1.35, 292, [1, 0], MARGIN, 3, 40),
    ISO_GROUND_SHADES.asphalt[0],
    false,
  );

  // Park trees: keep every published population fixed, then add a separate
  // deterministic population only inside this release's 100 m western strip.
  // This grows vegetation without moving any previously rendered point.
  const trunkSpots: Array<[number, number]> = [];
  for (let index = 0; index < 720; index += 1) {
    const hx = (Math.imul(index + 1, 2654435761) >>> 9) % 10_000;
    const hz = (Math.imul(index + 7, 40503) >>> 3) % 10_000;
    const x =
      V022_WEST +
      20 +
      ((EAST - V022_WEST - 40) * hx) / 10_000;
    const z = NORTH + 20 + ((SOUTH - NORTH - 40) * hz) / 10_000;
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34 || Math.hypot(x - SX, z - SZ) < 112) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  for (let index = 0; index < 84; index += 1) {
    const hx = (Math.imul(index + 101, 2246822519) >>> 8) % 10_000;
    const hz = (Math.imul(index + 211, 3266489917) >>> 7) % 10_000;
    const x =
      V023_WEST + 10 + ((V022_WEST - V023_WEST - 20) * hx) / 10_000;
    const z = NORTH + 20 + ((SOUTH - NORTH - 40) * hz) / 10_000;
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.24.0 adds trees only to its own −1920…−1820 m strip. Keeping the
  // preceding ranges anchored to their release constants prevents cumulative
  // runs from silently moving previously published vegetation.
  for (let index = 0; index < 84; index += 1) {
    const hx = (Math.imul(index + 307, 668265263) >>> 8) % 10_000;
    const hz = (Math.imul(index + 419, 374761393) >>> 7) % 10_000;
    const x =
      V024_WEST +
      10 +
      ((V023_WEST - V024_WEST - 20) * hx) / 10_000;
    const z = NORTH + 20 + ((SOUTH - NORTH - 40) * hz) / 10_000;
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.25.0 grows only the −2020…−1920 m strip. Distinct hash seeds keep
  // the added trees deterministic without repeating a previous distribution.
  for (let index = 0; index < 84; index += 1) {
    const hx = (Math.imul(index + 523, 1103515245) >>> 8) % 10_000;
    const hz = (Math.imul(index + 631, 214013) >>> 7) % 10_000;
    const x =
      V025_WEST +
      10 +
      ((V024_WEST - V025_WEST - 20) * hx) / 10_000;
    const z = NORTH + 20 + ((SOUTH - NORTH - 40) * hz) / 10_000;
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.26.0 adds a fifth immutable population only in the new
  // −2120…−2020 m strip. An avalanche mix avoids the visible diagonal lattice
  // produced by a linear integer sequence; prior strips remain byte-stable.
  const stripUnit = (index: number, seed: number): number => {
    let value = Math.imul(index + seed, 0x9e3779b1);
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
  };
  for (let index = 0; index < 84; index += 1) {
    const x =
      V026_WEST + 10 + (V025_WEST - V026_WEST - 20) * stripUnit(index, 743);
    const z =
      NORTH + 20 + (SOUTH - NORTH - 40) * stripUnit(index, 857);
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.27.0 grows only the −2220…−2120 m strip with fresh avalanche
  // seeds; every previously published strip stays byte-stable.
  for (let index = 0; index < 84; index += 1) {
    const x =
      V027_WEST + 10 + (V026_WEST - V027_WEST - 20) * stripUnit(index, 1249);
    const z = NORTH + 20 + (SOUTH - NORTH - 40) * stripUnit(index, 1361);
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.28.0 grows only the −2320…−2220 m strip.
  for (let index = 0; index < 84; index += 1) {
    const x =
      V028_WEST + 10 + (V027_WEST - V028_WEST - 20) * stripUnit(index, 1543);
    const z = NORTH + 20 + (SOUTH - NORTH - 40) * stripUnit(index, 1667);
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.29.0 grows only the −2420…−2320 m strip.
  for (let index = 0; index < 84; index += 1) {
    const x =
      V029_WEST + 10 + (V028_WEST - V029_WEST - 20) * stripUnit(index, 1901);
    const z = NORTH + 20 + (SOUTH - NORTH - 40) * stripUnit(index, 2029);
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.30.0 grows only the −2520…−2420 m strip.
  for (let index = 0; index < 84; index += 1) {
    const x =
      V030_WEST + 10 + (V029_WEST - V030_WEST - 20) * stripUnit(index, 2297);
    const z = NORTH + 20 + (SOUTH - NORTH - 40) * stripUnit(index, 2411);
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
      continue;
    }
    trunkSpots.push([x, z]);
  }
  // v0.32.0 grows only the new −2620…−2520 m strip.
  for (let index = 0; index < 84; index += 1) {
    const x =
      WEST + 10 + (V030_WEST - WEST - 20) * stripUnit(index, 2749);
    const z = NORTH + 20 + (SOUTH - NORTH - 40) * stripUnit(index, 2861);
    const axisZ =
      AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.abs(z - axisZ) < 34) {
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
    new IcosahedronGeometry(1, 1),
    new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }),
    trunkSpots.length * 2,
  );
  crowns.name = "extrapolated tree crowns";
  const matrix = new Matrix4();
  const crownPaint = new Color();
  const CROWN_TONES = [0x7da371, 0x8db07e, 0x76996d] as const;
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

  // Candelabra rows along Straße des 17. Juni and a ring of lights
  // around the Großer Stern — warm dots that carry the axis at night.
  const lampSpots: Array<[number, number]> = [];
  const lampCount = Math.floor(Math.abs(AXIS_TO[0] - EAST) / 42);
  for (let index = 0; index <= lampCount; index += 1) {
    const x = EAST + (AXIS_TO[0] - EAST) * (index / Math.max(1, lampCount));
    const z = AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
    if (Math.hypot(x - SX, z - SZ) < 118) {
      continue;
    }
    const nx = -axis[1];
    const nz = axis[0];
    lampSpots.push([x + nx * 26, z + nz * 26]);
    lampSpots.push([x - nx * 26, z - nz * 26]);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    lampSpots.push([SX + Math.cos(angle) * 112, SZ + Math.sin(angle) * 112]);
  }
  const lampPoles = new InstancedMesh(
    new BoxGeometry(0.16, 4.6, 0.16),
    new MeshStandardMaterial({
      color: 0x565a5c,
      flatShading: true,
      roughness: 0.9,
    }),
    lampSpots.length,
  );
  lampPoles.name = "extrapolated lamp poles";
  const lampHeads = new InstancedMesh(
    new BoxGeometry(0.42, 0.5, 0.42),
    new MeshBasicMaterial({ color: 0xb9b3a6 }),
    lampSpots.length,
  );
  lampHeads.name = "extrapolated lamp heads";
  const lampMatrix = new Matrix4();
  lampSpots.forEach(([x, z], index) => {
    lampMatrix.identity();
    lampMatrix.setPosition(x, GROUND_TOP + 2.3, z);
    lampPoles.setMatrixAt(index, lampMatrix);
    lampMatrix.setPosition(x, GROUND_TOP + 4.85, z);
    lampHeads.setMatrixAt(index, lampMatrix);
  });
  lampPoles.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;
  lampPoles.frustumCulled = false;
  lampHeads.frustumCulled = false;
  group.add(lampPoles);
  group.add(lampHeads);

  const merged = mergeGeometries(bodyGeometries, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
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

/**
 * Non-geographic presentation floor below the complete metric model. Camera
 * targets are bounded to the published 2310 m data envelope, but a distant
 * oblique lens can still see beyond that envelope. This unlit paper stage
 * prevents the sky from showing through behind edge trees without pretending
 * that the stage contains surveyed roads, buildings or vegetation.
 */
function createPresentationBackdrop(): Mesh {
  const geometry = new PlaneGeometry(16_000, 16_000);
  geometry.rotateX(-Math.PI / 2);
  const dayMaterial = new MeshBasicMaterial({ color: 0xe9efe4 });
  const nightMaterial = new MeshBasicMaterial({ color: 0x07131f });
  const backdrop = new Mesh(geometry, dayMaterial);
  backdrop.name = "presentation paper backdrop";
  backdrop.position.set(-220, -8, 210);
  backdrop.receiveShadow = false;
  backdrop.userData.dayMaterial = dayMaterial;
  backdrop.userData.nightMaterial = nightMaterial;
  backdrop.userData.presentationOnly = true;
  return backdrop;
}

/**
 * Hotel Adlon Kempinski, EXTRAPOLATED (owner-approved): the shipped
 * LoD2 extract is clipped just west of Unter den Linden 77, so the
 * hotel's block is absent from the surveyed data. It is drawn here at
 * its documented position (52.5161 N, 13.3800 E → world 573/324) after
 * published dimensions: a closed perimeter block around a courtyard,
 * ~35 m to the eaves, sandstone-cream facade with a mansard attic and
 * the Pariser-Platz corner risalit. Marked userData.extrapolated; no
 * claim of surveyed geometry.
 */
export const ADLON_WORLD: [number, number] = [573.4, 323.8];

export function createHotelAdlon(): Group {
  const group = new Group();
  group.name = "extrapolated Hotel Adlon";
  group.userData.extrapolated = true;
  const [ax, az] = ADLON_WORLD;
  const GROUND = 3.2;
  const EAVES = 31.5;
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const FACADE = new Color(0xf2ebda);
  const SOCKEL = new Color(0xe6dfcd);
  const ROOF = new Color(0xd3d6cf);
  const add = (
    triangles: Float32Array,
    tone: Color,
    inked = true,
  ): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    if (inked) {
      edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
    }
  };
  // Perimeter block: four wings around a courtyard (58 × 46 m outer).
  const halfX = 29;
  const halfZ = 23;
  const wing = 13;
  const wings: Array<[number, number, number, number]> = [
    [0, -halfZ + wing / 2, halfX * 2, wing],
    [0, halfZ - wing / 2, halfX * 2, wing],
    [-halfX + wing / 2, 0, wing, halfZ * 2 - wing * 2],
    [halfX - wing / 2, 0, wing, halfZ * 2 - wing * 2],
  ];
  for (const [ox, oz, sx, sz] of wings) {
    add(
      boxTriangles(
        ax + ox,
        GROUND + (EAVES - GROUND) / 2,
        az + oz,
        [1, 0],
        sx,
        EAVES - GROUND,
        sz,
      ),
      FACADE,
    );
    // Sockel band and eaves cornice, matching the city convention.
    add(
      boxTriangles(ax + ox, GROUND + 0.35, az + oz, [1, 0], sx + 0.5, 0.7, sz + 0.5),
      SOCKEL,
    );
    add(
      boxTriangles(ax + ox, EAVES + 0.2, az + oz, [1, 0], sx + 0.9, 0.5, sz + 0.9),
      SOCKEL,
    );
    // Mansard attic storey, stepped in.
    add(
      boxTriangles(ax + ox, EAVES + 2.1, az + oz, [1, 0], sx - 2.2, 3.4, sz - 2.2),
      ROOF,
    );
  }
  // The Pariser-Platz corner risalit rises one storey higher.
  add(
    boxTriangles(ax - halfX + 9, GROUND + (EAVES + 3 - GROUND) / 2, az - halfZ + 9, [1, 0], 18, EAVES + 3 - GROUND, 18),
    FACADE,
  );
  add(
    boxTriangles(ax - halfX + 9, EAVES + 5.4, az - halfZ + 9, [1, 0], 15.8, 3.8, 15.8),
    ROOF,
  );
  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "Adlon bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      new LineBasicMaterial({ color: ISO_INK_COLOR }),
    );
    lines.name = "Adlon ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

/**
 * Paul-Löbe-Haus west portico. The LoD2 extract carries the building as a
 * plain 157 m bar (prism 0sVYAxtY, x 154.6…312.1, z −153.0…−117.3), so the
 * one feature that makes the west front recognisable from the Chancellery
 * side is missing: the wide flat canopy that cantilevers over the entrance
 * forecourt on slender columns. Drawn here after the built architecture
 * (Stephan Braunfels, 2001) as flat inked elements.
 */
export const PAUL_LOEBE_WEST_FACE_X = 154.6;
const PAUL_LOEBE_CANOPY_Z = -135.15;
const PAUL_LOEBE_GROUND_Y = 4.2;
const PAUL_LOEBE_CANOPY_SPAN_Z = 31;
const PAUL_LOEBE_CANOPY_REACH_M = 12.5;
const PAUL_LOEBE_CANOPY_TOP_Y = 17.4;
const PAUL_LOEBE_CANOPY_SLAB_M = 0.75;
const PAUL_LOEBE_COLUMN_COUNT = 6;
const PAUL_LOEBE_COLUMN_W = 0.62;

export function createPaulLoebeCanopy(): Group {
  const group = new Group();
  group.name = "Paul-Löbe-Haus west canopy";
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const SLAB = new Color(0xf1ece0);
  const FASCIA = new Color(0xe1dbcb);
  const COLUMN = new Color(0xe8e2d5);
  const add = (triangles: Float32Array, tone: Color): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
  };

  const outerX = PAUL_LOEBE_WEST_FACE_X - PAUL_LOEBE_CANOPY_REACH_M;
  const slabCenterX = PAUL_LOEBE_WEST_FACE_X - PAUL_LOEBE_CANOPY_REACH_M / 2;
  add(
    boxTriangles(
      slabCenterX,
      PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M / 2,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      PAUL_LOEBE_CANOPY_REACH_M,
      PAUL_LOEBE_CANOPY_SLAB_M,
      PAUL_LOEBE_CANOPY_SPAN_Z,
    ),
    SLAB,
  );
  // A slim fascia along the free edge: the drawn shadow line that makes the
  // cantilever legible from the isometric camera.
  add(
    boxTriangles(
      outerX + 0.22,
      PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M - 0.22,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      0.44,
      0.44,
      PAUL_LOEBE_CANOPY_SPAN_Z,
    ),
    FASCIA,
  );

  const columnHeight =
    PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M - PAUL_LOEBE_GROUND_Y;
  const firstZ = PAUL_LOEBE_CANOPY_Z - PAUL_LOEBE_CANOPY_SPAN_Z / 2 + 2.6;
  const stepZ = (PAUL_LOEBE_CANOPY_SPAN_Z - 5.2) / (PAUL_LOEBE_COLUMN_COUNT - 1);
  for (let index = 0; index < PAUL_LOEBE_COLUMN_COUNT; index += 1) {
    add(
      boxTriangles(
        outerX + 0.9,
        PAUL_LOEBE_GROUND_Y + columnHeight / 2,
        firstZ + stepZ * index,
        [1, 0],
        PAUL_LOEBE_COLUMN_W,
        columnHeight,
        PAUL_LOEBE_COLUMN_W,
      ),
      COLUMN,
    );
  }

  // Entrance platform under the canopy, one drawn step above the forecourt.
  add(
    boxTriangles(
      slabCenterX,
      PAUL_LOEBE_GROUND_Y + 0.18,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      PAUL_LOEBE_CANOPY_REACH_M + 1.6,
      0.36,
      PAUL_LOEBE_CANOPY_SPAN_Z + 1.6,
    ),
    FASCIA,
  );

  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "Paul-Löbe canopy bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      new LineBasicMaterial({ color: ISO_INK_COLOR }),
    );
    lines.name = "Paul-Löbe canopy ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
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
  // Slender facade glazing axes: ink lines by day, warm strips by night.
  const facadeAxisPositions: number[] = [];
  const windowAxes: Array<{
    dirX: number;
    dirZ: number;
    lit: boolean;
    litTone: number;
    nx: number;
    nz: number;
    x: number;
    yTop: number;
    yBottom: number;
    z: number;
  }> = [];
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
    const pinnedRoof =
      HERO_PRISM_ROOF_TONES[building.id] ??
      (inReichstagRegion(building) ? 0xe1e3dc : undefined);
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
    // Every wall carries slender floor-to-cornice glazing LINES on the
    // surveyed bay rhythm, plus — since v0.32.0 — a drawn portrait pane
    // at every bay/storey crossing, so ordinary blocks read as finely
    // fenestrated instead of blank even in the overview. Formats follow
    // the building's own kind: piano-nobile for civic monuments, housing
    // proportions elsewhere. At night a deterministic share is lit.
    // Hero buildings (Reichstag) keep their referenced real windows.
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
      const format = isCivic ? CIVIC_WINDOW : HOUSING_WINDOW;
      const bayPitch = format.bayPitch;
      const axisTop = y0 + bodyHeight - 0.9;
      const axisBottom = y0 + 1.2;
      const nightStrip = isCivic
        ? WINDOW_NIGHT_CIVIC_TONES
        : WINDOW_NIGHT_LIT_TONES;
      const litLimit = Math.round(WINDOW_LIT_FRACTION * 1000);
      const walls = wallsOf(building);
      let doorWall = -1;
      let doorLength = DOOR_SUPPRESSED_IDS.has(building.id)
        ? Number.POSITIVE_INFINITY
        : DOOR_MIN_WALL_M;
      for (const wall of walls) {
        if (wall.length >= doorLength) {
          doorWall = wall.index;
          doorLength = wall.length;
        }
      }
      if (axisTop > axisBottom + 1) {
        for (const wall of walls) {
          if (wall.length < WINDOW_MIN_WALL_M) {
            continue;
          }
          const axes = Math.floor((wall.length - 1.2) / bayPitch);
          if (axes < 1) {
            continue;
          }
          const first = (wall.length - (axes - 1) * bayPitch) / 2;
          const ox = wall.nx * WINDOW_FACE_OFFSET_M;
          const oz = wall.nz * WINDOW_FACE_OFFSET_M;
          const grid = windowGrid(wall.length, bodyHeight, format);
          const sillOf = (floor: number): number =>
            y0 + format.sillStart + floor * format.floorPitch;
          // Storey bands: one hairline per floor across the whole wall,
          // so the facade keeps a legible horizontal rhythm at the zoom
          // levels where individual panes fall below a pixel.
          if (grid) {
            for (let floor = 0; floor < grid.floors; floor += 1) {
              const bandY = sillOf(floor) - 0.28;
              facadeAxisPositions.push(
                wall.x1 + ox, bandY, wall.z1 + oz,
                wall.x1 + wall.dirX * wall.length + ox, bandY,
                wall.z1 + wall.dirZ * wall.length + oz,
              );
            }
          }
          for (let axis = 0; axis < axes; axis += 1) {
            const along = first + axis * bayPitch;
            const x = wall.x1 + wall.dirX * along + ox;
            const z = wall.z1 + wall.dirZ * along + oz;
            // Slender glazing line as ink (the facade axis).
            facadeAxisPositions.push(x, axisBottom, z, x, axisTop, z);
            if (grid) {
              for (let floor = 0; floor < grid.floors; floor += 1) {
                const py = sillOf(floor) + format.height / 2;
                const roll = hash32(
                  building.id,
                  wall.index * 9173 + axis * 131 + floor * 17,
                );
                windows.push({
                  dirX: wall.dirX,
                  dirZ: wall.dirZ,
                  height: format.height,
                  joinery: isCivic,
                  night: new Color(
                    roll % 1000 < litLimit
                      ? nightStrip[roll % nightStrip.length]
                      : WINDOW_NIGHT_DARK_TONE,
                  ),
                  nx: wall.nx,
                  nz: wall.nz,
                  px: x,
                  py,
                  pz: z,
                  tone: new Color(WINDOW_DAY_TONE),
                  width: format.width,
                });
              }
            }
            // A warm-lit vertical strip on ~38% of axes at night.
            const roll =
              hash32(building.id, wall.index * 2801 + axis * 53) % 1000;
            windowAxes.push({
              dirX: wall.dirX,
              dirZ: wall.dirZ,
              lit: roll < litLimit,
              litTone: nightStrip[roll % nightStrip.length],
              nx: wall.nx,
              nz: wall.nz,
              x,
              yTop: axisTop,
              yBottom: axisBottom,
              z,
            });
          }
          if (wall.index === doorWall) {
            const doorAlong = wall.length / 2;
            windows.push({
              dirX: wall.dirX,
              dirZ: wall.dirZ,
              height: DOOR_HEIGHT_M,
              joinery: true,
              night: new Color(DOOR_NIGHT_LIT_TONE),
              nx: wall.nx,
              nz: wall.nz,
              px:
                wall.x1 + wall.dirX * doorAlong + wall.nx * DOOR_FACE_OFFSET_M,
              py: y0 + DOOR_HEIGHT_M / 2,
              pz:
                wall.z1 + wall.dirZ * doorAlong + wall.nz * DOOR_FACE_OFFSET_M,
              tone: new Color(DOOR_DAY_TONE),
              width: DOOR_WIDTH_M,
            });
          }
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
                mx, y0 + bodyHeight - CORNICE_HEIGHT_M / 2 - 0.04, mz,
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
      bakeColor(restaurant, new Color(0xc8ccc6).multiplyScalar(0.96));
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
    const dayMaterial = new MeshBasicMaterial({
      opacity: 0.52,
      transparent: true,
      vertexColors: true,
    });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      opacity: 0.52,
      roughness: 0.35,
      transparent: true,
      vertexColors: true,
    });
    const mesh = new Mesh(glass, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
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

    // The same matrices carry the drawn joinery, so the wide civic
    // openings read as framed windows with Sprossen instead of flat
    // rectangles. Housing panes stay bare: Sprossen on all of them would
    // cost more triangles than the rest of the city together.
    const framed = windows.filter((spec) => spec.joinery);
    if (framed.length > 0) {
      const bars = new InstancedMesh(
        windowBarGeometry(),
        new MeshBasicMaterial({ color: WINDOW_BAR_TONE, side: DoubleSide }),
        framed.length,
      );
      bars.name = "LoD2 prism window bars";
      framed.forEach((spec, index) => {
        matrix.set(
          spec.dirX * spec.width, 0, spec.nx, spec.px,
          0, spec.height, 0, spec.py,
          spec.dirZ * spec.width, 0, spec.nz, spec.pz,
          0, 0, 0, 1,
        );
        bars.setMatrixAt(index, matrix);
      });
      bars.instanceMatrix.needsUpdate = true;
      bars.frustumCulled = false;
      bars.renderOrder = 2;
      group.add(bars);
    }
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

  // Facade glazing axes: fine ink lines (day). A subtle grey so they
  // articulate without weighing the pale panels down.
  if (facadeAxisPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(facadeAxisPositions, 3),
    );
    const axes = new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: ISO_INK_COLOR,
        opacity: 0.34,
        transparent: true,
      }),
    );
    axes.name = "LoD2 facade axes";
    axes.renderOrder = 2;
    group.add(axes);
  }
  // Night light strips: thin warm vertical bars on the lit axes only,
  // hidden by day. Instanced quads (0.28 m wide) facing outward.
  if (windowAxes.length > 0) {
    const lit = windowAxes.filter((axis) => axis.lit);
    if (lit.length > 0) {
      const strips = new InstancedMesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
        lit.length,
      );
      strips.name = "LoD2 facade night strips";
      strips.visible = false;
      const matrix = new Matrix4();
      const tone = new Color();
      lit.forEach((axis, index) => {
        const height = axis.yTop - axis.yBottom;
        matrix.set(
          axis.dirX * 0.28, 0, axis.nx, axis.x,
          0, height, 0, (axis.yTop + axis.yBottom) / 2,
          axis.dirZ * 0.28, 0, axis.nz, axis.z,
          0, 0, 0, 1,
        );
        strips.setMatrixAt(index, matrix);
        strips.setColorAt(index, tone.setHex(axis.litTone));
      });
      strips.instanceMatrix.needsUpdate = true;
      if (strips.instanceColor) {
        strips.instanceColor.needsUpdate = true;
      }
      strips.frustumCulled = false;
      group.add(strips);
    }
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
      { emissive: 0x000000, skipBridge: true, skipWater: true },
    );
    group.add(slabs);
    // Transparent rivers with a visible bed ("Flüsse müssen
    // durchsichtig sein mit Flussbett"): a pale glass-like surface
    // plate floats over a sandy riverbed ~2.2 m below.
    const waterClass = ground.classes.indexOf("water");
    if (waterClass >= 0) {
      const cell = ground.cell_m;
      const { min_x_idx, min_z_idx } = ground.grid;
      const waterTop = ground.water_top_y_m ?? 1.31;
      const waterRuns: Array<[number, number, number]> = [];
      ground.ground_rows.forEach((row, zOffset) => {
        for (const [xStart, run, classId] of row) {
          if (classId === waterClass) {
            waterRuns.push([xStart, zOffset, run]);
          }
        }
      });
      const bed = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({ vertexColors: false, color: 0xffffff }),
        Math.max(1, waterRuns.length),
      );
      bed.name = "drawn river bed";
      const surface = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({
          color: 0x9fc7d8,
          opacity: 0.45,
          transparent: true,
          depthWrite: false,
        }),
        Math.max(1, waterRuns.length),
      );
      surface.name = "drawn water surface";
      surface.renderOrder = 1;
      const matrix = new Matrix4();
      const bedPaint = new Color();
      const BED_TONES = [0xd8cfb8, 0xcdc3ac] as const;
      waterRuns.forEach(([xStart, zOffset, run], index) => {
        const cx = (min_x_idx + xStart + run / 2) * cell;
        const cz = (min_z_idx + zOffset + 0.5) * cell;
        matrix.makeScale(run * cell, 0.5, cell);
        matrix.setPosition(cx, waterTop - 2.2 - 0.25, cz);
        bed.setMatrixAt(index, matrix);
        bed.setColorAt(
          index,
          bedPaint.setHex(BED_TONES[(xStart * 31 + zOffset * 17) % 2]),
        );
        matrix.makeScale(run * cell, 0.14, cell);
        matrix.setPosition(cx, waterTop - 0.07, cz);
        surface.setMatrixAt(index, matrix);
      });
      bed.instanceMatrix.needsUpdate = true;
      if (bed.instanceColor) {
        bed.instanceColor.needsUpdate = true;
      }
      surface.instanceMatrix.needsUpdate = true;
      bed.frustumCulled = false;
      surface.frustumCulled = false;
      group.add(bed);
      group.add(surface);
    }
    const kerbs = createKerbLines(ground);
    if (kerbs) {
      group.add(kerbs);
    }
    const quays = createQuayWalls(ground);
    if (quays) {
      group.add(quays);
    }
    const bridges = createBridgeStructures(ground);
    if (bridges) {
      group.add(bridges);
    }
  }
  group.add(createPresentationBackdrop());
  group.add(createWestTiergarten());
  group.add(createHotelAdlon());
  group.add(createPaulLoebeCanopy());
  return group;
}
