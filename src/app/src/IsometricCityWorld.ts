import {
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
  y0_dm: number;
};

export type PrismPayload = {
  buildings: PrismBuilding[];
  classes: string[];
  schema_version: number;
};

export const PRISM_WORLD_FILE = "lod2-prisms.json";
export const ISO_INK_COLOR = 0x24211c;
export const ISO_EDGE_THRESHOLD_DEGREES = 24;

// Soft, flat illustration tones for the day ground (NOT the Minecraft
// palette): calm park green, light asphalt, Spree blue, plaza brick.
export const ISO_GROUND_SHADES: Record<string, readonly number[]> = {
  asphalt: [0x8f8f8a, 0x9a9a94],
  grass: [0x8fbf72, 0x9cc981, 0x86b96a],
  plazaBrick: [0xc9a084, 0xbf9478],
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
  const className = classes[building.class] ?? "concrete";
  const shades = FACADE_SHADES[className] ?? FALLBACK_FACADE;
  let hash = 0;
  for (const char of building.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return new Color(shades[hash % shades.length]);
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

export function createIsometricCity(
  prisms: PrismPayload,
  ground: VoxelPayload | null,
): Group {
  const group = new Group();
  group.name = "Drawn isometric city (LoD2 prisms + ink lines)";

  const bodyGeometries = [];
  const edgeGeometries = [];
  const color = new Color();
  for (const building of prisms.buildings) {
    if (building.ring.length < 3) {
      continue;
    }
    const geometry = new ExtrudeGeometry(shapeFromRings(building), {
      bevelEnabled: false,
      depth: Math.max(2.5, building.h_dm / 10),
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, building.y0_dm / 10, 0);
    // Ink lines first (edges of the un-coloured prism)…
    const edges = new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES);
    edgeGeometries.push(edges);
    // …then bake the flat facade tone as vertex colour so every
    // building can share one material in one merged mesh.
    color.copy(facadeColorFor(building, prisms.classes));
    const positions = geometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    for (let index = 0; index < positions.count; index += 1) {
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    bodyGeometries.push(geometry);
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
