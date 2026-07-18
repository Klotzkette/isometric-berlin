import {
  BufferGeometry,
  Color,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { type VoxelPayload, createGroundSlabs } from "./MinecraftVoxelWorld";

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

// Buildings whose recognition model draws the COMPLETE structure. Their
// LoD2 prism would swallow the model (the Brandenburg Gate rendered as a
// solid box burying its twelve columns), so these prisms are skipped and
// the model carries the building alone.
export const PRISM_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  // Brandenburger Tor main body — the gate model has columns, passages,
  // attic and Quadriga; side pavilion prisms stay.
  "K0001xqy",
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

export function createIsometricCity(
  prisms: PrismPayload,
  ground: VoxelPayload | null,
): Group {
  const group = new Group();
  group.name = "Drawn isometric city (LoD2 prisms + ink lines)";

  const bodyGeometries = [];
  const edgeGeometries = [];
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
    // Real roof forms from the ALKIS codes: gabled/hipped/shed roofs
    // rise from the eave as fitted flat facets; everything else keeps
    // the exact flat cap.
    let bodyHeight = totalHeight;
    let roofTriangles: Float32Array | null = null;
    const roofCode = building.roof ?? 0;
    if (
      roofCode === ROOF_GABLED ||
      roofCode === ROOF_HIPPED ||
      roofCode === ROOF_SHED
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
    // building can share one material in one merged mesh.
    color.copy(facadeColorFor(building, prisms.classes));
    bakeColor(geometry, color);
    bodyGeometries.push(geometry);
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
  }
  return group;
}
