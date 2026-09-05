import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Uint8BufferAttribute,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";

/**
 * The flat-tone + ink-line kit the drawn accessory layers share.
 *
 * Every drawn group in the viewer follows the same recipe: solid-colour
 * boxes merged into one mesh, an `EdgesGeometry` outline merged into one
 * `LineSegments`, and a day/night material pair swapped by the tone rig.
 * Keeping it here means a new accessory is a list of boxes, not another
 * copy of the plumbing.
 */

export type Builder = {
  edges: BufferGeometry[];
  /** Optional second mesh that glows after dark (lampions, signs). */
  lamps: BufferGeometry[];
  parts: BufferGeometry[];
};

export function createBuilder(): Builder {
  return { edges: [], lamps: [], parts: [] };
}

export function paintGeometry(geometry: BufferGeometry, color: number): void {
  geometry.deleteAttribute("uv");
  // Every finished kit uses MeshBasicMaterial by day and a flat-shaded
  // MeshStandardMaterial at night. Neither shader reads vertex normals: the
  // latter derives the face normal from screen-space derivatives. Dropping
  // this dormant Float32 attribute preserves the pixels and removes three
  // floats per vertex from merge, transfer and GPU storage.
  geometry.deleteAttribute("normal");
  const shade = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Uint8Array(positions.count * 3);
  const red = Math.round(shade.r * 255);
  const green = Math.round(shade.g * 255);
  const blue = Math.round(shade.b * 255);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = red;
    colors[index * 3 + 1] = green;
    colors[index * 3 + 2] = blue;
  }
  // The display target is 8-bit sRGB. A normalized byte attribute therefore
  // preserves the final palette while cutting its GPU/transfer footprint by
  // 75 percent compared with three Float32 values per vertex.
  geometry.setAttribute("color", new Uint8BufferAttribute(colors, 3, true));
}

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const BOX_POSITIONS = UNIT_BOX.getAttribute("position").array;
const BOX_INDICES = UNIT_BOX.index!.array;
const UNIT_BOX_EDGES = new EdgesGeometry(
  UNIT_BOX,
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
);
const BOX_EDGE_CORNERS = Array.from(
  { length: UNIT_BOX_EDGES.getAttribute("position").count },
  (_, edgeVertex) => {
    const edge = UNIT_BOX_EDGES.getAttribute("position");
    for (let vertex = 0; vertex < BOX_POSITIONS.length / 3; vertex += 1) {
      if (
        BOX_POSITIONS[vertex * 3] === edge.getX(edgeVertex) &&
        BOX_POSITIONS[vertex * 3 + 1] === edge.getY(edgeVertex) &&
        BOX_POSITIONS[vertex * 3 + 2] === edge.getZ(edgeVertex)
      ) return vertex;
    }
    throw new Error("Box outline vertex is not a box corner");
  },
);
UNIT_BOX_EDGES.dispose();
UNIT_BOX.dispose();
const BOX_ADJACENT_CORNERS = [1, 2, 5] as const;

/** Rigid, positive-size single-segment boxes keep Three.js's edge order. */
export function boxOutlineGeometry(geometry: BufferGeometry): BufferGeometry {
  const position = geometry.getAttribute("position");
  // Extremely thin/collapsed boxes can have coincident quantised corners.
  // Keep Three.js's full edge classification for those exceptional parts.
  let minEdgeSquared = Number.POSITIVE_INFINITY;
  let maxCoordinate = 1;
  for (const b of BOX_ADJACENT_CORNERS) {
    let distanceSquared = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      const from = position.array[axis];
      const to = position.array[b * 3 + axis];
      distanceSquared += (to - from) ** 2;
      maxCoordinate = Math.max(maxCoordinate, Math.abs(from), Math.abs(to));
    }
    minEdgeSquared = Math.min(minEdgeSquared, distanceSquared);
  }
  if (
    position.count !== 24 ||
    !Number.isFinite(minEdgeSquared) ||
    !Number.isFinite(maxCoordinate) ||
    minEdgeSquared <= Math.max(0.005, maxCoordinate / 100_000) ** 2
  ) return new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES);

  const positions = new Float32Array(BOX_EDGE_CORNERS.length * 3);
  for (let index = 0; index < BOX_EDGE_CORNERS.length; index += 1) {
    const corner = BOX_EDGE_CORNERS[index] * 3;
    positions[index * 3] = position.array[corner];
    positions[index * 3 + 1] = position.array[corner + 1];
    positions[index * 3 + 2] = position.array[corner + 2];
  }
  const edges = new BufferGeometry();
  edges.setAttribute("position", new BufferAttribute(positions, 3));
  return edges;
}

/** Same 24 indexed vertices, without allocating normals/UVs the kit discards. */
function unlitBoxGeometry(sx: number, sy: number, sz: number): BufferGeometry {
  if (![sx, sy, sz].every((size) => Number.isFinite(size) && size > 0))
    return new BoxGeometry(sx, sy, sz);
  const positions = new Float32Array(BOX_POSITIONS.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = BOX_POSITIONS[i] * sx;
    positions[i + 1] = BOX_POSITIONS[i + 1] * sy;
    positions[i + 2] = BOX_POSITIONS[i + 2] * sz;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(new Uint16Array(BOX_INDICES), 1));
  return geometry;
}

export function addBox(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY = 0,
  inked = true,
): void {
  const geometry = unlitBoxGeometry(sx, sy, sz);
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      sx > 0 && sy > 0 && sz > 0
        ? boxOutlineGeometry(geometry)
        : new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

export function addCone(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
  inked = true,
): void {
  const geometry = new CylinderGeometry(0, radius, height, segments);
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

export function addCylinder(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
  lamp = false,
): void {
  const geometry = new CylinderGeometry(radius, radius, height, segments);
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
}

/**
 * A partial (sliced) cylinder, for the rounded-corner "pill" massing seen
 * on buildings like the Amtssitz am Spreebogen: a full drum sliced to the
 * wedge needed to close off a straight run of wall. `rotationY` orients the
 * slice; `thetaStart`/`thetaLength` pick which wedge of the drum is kept,
 * in the same radians convention as `CylinderGeometry`.
 */
export function addPartialCylinder(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
  thetaStart: number,
  thetaLength: number,
  rotationY = 0,
  inked = true,
): void {
  const geometry = new CylinderGeometry(
    radius,
    radius,
    height,
    segments,
    1,
    true,
    thetaStart,
    thetaLength,
  );
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

export type DrawnGroupOptions = {
  /** Emissive colour for the `lamps` mesh after dark. */
  lampEmissive?: number;
  lampEmissiveIntensity?: number;
  /** Base name; meshes become "<name> bodies" / "<name> ink lines". */
  name: string;
};

/**
 * Merge a builder into the standard group. Returns null when nothing was
 * drawn, so callers can skip adding an empty group to the scene.
 */
export function finishDrawnGroup(
  builder: Builder,
  options: DrawnGroupOptions,
): Group | null {
  if (builder.parts.length === 0 && builder.lamps.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = options.name;

  // mergeGeometries reads geometries[0] before checking the length, so an
  // empty bucket throws rather than returning null. Most kits use only some
  // of the three buckets.
  const merged =
    builder.parts.length > 0 ? mergeGeometries(builder.parts, false) : null;
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = `${options.name} bodies`;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    group.add(mesh);
    for (const part of builder.parts) {
      part.dispose();
    }
  }
  const lampGeometry =
    builder.lamps.length > 0 ? mergeGeometries(builder.lamps, false) : null;
  if (lampGeometry) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.6,
      vertexColors: true,
    });
    nightMaterial.userData.nightEmissive = options.lampEmissive ?? 0xffb457;
    nightMaterial.userData.nightEmissiveIntensity =
      options.lampEmissiveIntensity ?? 1.1;
    const lamps = new Mesh(lampGeometry, dayMaterial);
    lamps.name = `${options.name} lamps`;
    lamps.userData.dayMaterial = dayMaterial;
    lamps.userData.nightMaterial = nightMaterial;
    group.add(lamps);
    for (const lamp of builder.lamps) {
      lamp.dispose();
    }
  }
  const inkGeometry =
    builder.edges.length > 0 ? mergeGeometries(builder.edges, false) : null;
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    ink.name = `${options.name} ink lines`;
    ink.renderOrder = 2;
    group.add(ink);
    for (const edge of builder.edges) {
      edge.dispose();
    }
  }
  return group;
}

/** Every mesh name `finishDrawnGroup` can produce, for the tone rig. */
export function drawnGroupMeshNames(name: string): string[] {
  return [`${name} bodies`, `${name} lamps`];
}
