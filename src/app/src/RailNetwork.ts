/**
 * The aboveground railway: the Stadtbahn viaduct east and west of the
 * Hauptbahnhof, plus the tracks that run at grade.
 *
 * The drawn city had no railway outside the station model, so the tracks
 * stopped in mid-air over the Humboldthafen. This draws the corridor
 * exported by ``build_rail_lines.py``: a level deck on piers for anything
 * carried, ballast strips that follow the terrain for anything at grade,
 * and a pair of rails stroked along every centreline long enough to read
 * as a line.
 *
 * The deck height is not chosen here — it comes from the payload, which
 * reads it off the station model's own deck so the two are the same table.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

export const RAIL_LINES_FILE = "rail-lines.json";

export type RailSurface = {
  area_m2: number;
  holes: number[][][];
  ring: number[][];
};

export type UndergroundLineFamily =
  | "mainline"
  | "north_south_sbahn"
  | "north_south_sbahn_service"
  | "s_bahn"
  | "subway"
  | "u5";

export type UndergroundTrack = {
  depth_m: number;
  id: string;
  layer: number;
  line_family: UndergroundLineFamily;
  name: string;
  points: number[][];
  railway: "light_rail" | "rail" | "subway";
  service: string;
  track_y_m: number;
};

export type UndergroundPlatform = {
  centre: number[];
  id: string;
  line_family: UndergroundLineFamily;
  name: string;
  ring: number[][];
  track_y_m: number;
};

export type UndergroundEntrance = {
  connects_to: string;
  id: string;
  line_family: UndergroundLineFamily;
  name: string;
  point: number[];
  track_y_m: number;
};

export type TramTrack = { id: string; points: number[][] };

export type RailPayload = {
  deck_top_y_m: number;
  embankment: RailSurface[];
  embankment_tracks: number[][][];
  piers: number[][];
  rail_top_over_deck_m: number;
  route_evidence: Record<
    string,
    { official_sequence: string[]; services: string[]; source: string }
  >;
  schema_version: number;
  tram_catenary: {
    geometry_status: string;
    tracks: TramTrack[];
  };
  underground: {
    entrances: UndergroundEntrance[];
    geometry_status: string;
    platforms: UndergroundPlatform[];
    surface_reference_y_m: number;
    tracks: UndergroundTrack[];
    utility_networks_included: boolean;
  };
  viaduct: RailSurface[];
  viaduct_tracks: number[][][];
};

const DECK_TONE = 0xdcd6ca;
const FASCIA_TONE = 0xc7bfaf;
// The Stadtbahn arches are yellow brick; kept pale so the viaduct reads as
// part of the drawing rather than as a stripe of colour across the map.
const PIER_TONE = 0xc9b7a1;
const BALLAST_TONE = 0xc4bcac;
const RAIL_TONE = 0x6f6a61;
const RAIL_INK = 0x716c62;
const HBF_EAST_STEEL = 0x8f614d;
const HBF_EAST_STEEL_DARK = 0x68483d;

const DECK_THICKNESS_M = 0.9;
const FASCIA_THICKNESS_M = 0.4;
const PIER_SIDE_M = 1.6;
/** Gauge is 1.435 m, so the rails sit this far either side of the centre. */
const RAIL_GAUGE_HALF_M = 0.72;
const RAIL_WIDTH_M = 0.16;
const RAIL_HEIGHT_M = 0.18;
/** Top of the ballast shoulder over the surveyed ground. */
const BALLAST_LIFT_M = 0.35;
/** Nothing shorter than this is worth a box of its own. */
const MIN_SEGMENT_M = 0.4;

export const HBF_EAST_STEEL_SUPPORT_BOUNDS = {
  maxX: 270,
  maxZ: -580,
  minX: -92,
  minZ: -755,
} as const;

type Builder = {
  edges: BufferGeometry[];
  parts: BufferGeometry[];
};

function paint(geometry: BufferGeometry, hex: number): BufferGeometry {
  const color = new Color(hex);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

function addBox(
  builder: Builder,
  hex: number,
  size: { x: number; y: number; z: number },
  at: { x: number; y: number; z: number },
  yaw = 0,
): void {
  const box = new BoxGeometry(size.x, size.y, size.z);
  // The plates drop their uvs, so the boxes must too or the merge fails.
  box.deleteAttribute("uv");
  if (yaw !== 0) {
    box.rotateY(yaw);
  }
  box.translate(at.x, at.y, at.z);
  builder.parts.push(paint(box, hex));
}

/** A box laid along `from` → `to`, kept upright, so it can act as a beam. */
function addBeam(
  builder: Builder,
  hex: number,
  from: number[],
  to: number[],
  width: number,
  height: number,
  centreY: number,
): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const run = Math.hypot(dx, dz);
  if (run < MIN_SEGMENT_M) {
    return;
  }
  addBox(
    builder,
    hex,
    { x: width, y: height, z: run },
    { x: (from[0] + to[0]) / 2, y: centreY, z: (from[1] + to[1]) / 2 },
    Math.atan2(dx, dz),
  );
}

function addStrut(
  builder: Builder,
  hex: number,
  from: [number, number, number],
  to: [number, number, number],
  thickness: number,
): void {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < MIN_SEGMENT_M) return;
  const geometry = new BoxGeometry(thickness, length, thickness);
  geometry.deleteAttribute("uv");
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.normalize(),
  );
  geometry.applyQuaternion(quaternion);
  geometry.translate(
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  );
  paint(geometry, hex);
  builder.parts.push(geometry);
}

function isHbfEastSteelSupport(x: number, z: number): boolean {
  const bounds = HBF_EAST_STEEL_SUPPORT_BOUNDS;
  return (
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
  );
}

function ringMetres(ring: number[][]): number[][] {
  return ring.map(([x, z]) => [x / 10, z / 10]);
}

function ringArea(ring: number[][]): number {
  let total = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x0, z0] = ring[index];
    const [x1, z1] = ring[(index + 1) % ring.length];
    total += x0 * z1 - x1 * z0;
  }
  return Math.abs(total) / 2;
}

function surfaceShape(surface: RailSurface): Shape {
  const shape = new Shape();
  ringMetres(surface.ring).forEach(([x, z], index) => {
    if (index === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  });
  for (const hole of surface.holes ?? []) {
    const points = ringMetres(hole);
    // A sliver hole crashes three's earcut triangulator outright, and that
    // would take the whole drawn city down with it.
    if (points.length < 3 || ringArea(points) < 0.05) {
      continue;
    }
    const path = new Path();
    points.forEach(([x, z], index) => {
      if (index === 0) {
        path.moveTo(x, -z);
      } else {
        path.lineTo(x, -z);
      }
    });
    shape.holes.push(path);
  }
  return shape;
}

/**
 * Triangulate a corridor into a horizontal plate. When `heightAt` is given
 * the plate is draped over the terrain instead of lying flat, which is what
 * the at-grade ballast needs.
 */
function addPlate(
  builder: Builder,
  surface: RailSurface,
  hex: number,
  y: number,
  heightAt?: (x: number, z: number) => number | null,
): void {
  let plate: ShapeGeometry;
  try {
    plate = new ShapeGeometry(surfaceShape(surface));
  } catch {
    return;
  }
  plate.deleteAttribute("uv");
  plate.rotateX(-Math.PI / 2);
  if (heightAt) {
    const position = plate.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      const ground = heightAt(position.getX(index), position.getZ(index));
      position.setY(index, (ground ?? 0) + y);
    }
    position.needsUpdate = true;
  } else {
    plate.translate(0, y, 0);
  }
  builder.parts.push(paint(plate, hex));
}

/** The ink line that gives the deck its drawn edge. */
function addOutline(builder: Builder, ring: number[][], y: number): void {
  const points = ringMetres(ring);
  const positions: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const [x0, z0] = points[index];
    const [x1, z1] = points[(index + 1) % points.length];
    positions.push(x0, y, z0, x1, y, z1);
  }
  if (positions.length === 0) {
    return;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  builder.edges.push(geometry);
}

/** Two rails stroked along a centreline, either side of the gauge. */
function addTrack(
  builder: Builder,
  path: number[][],
  railTopAt: (x: number, z: number) => number | null,
): void {
  const points = ringMetres(path);
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, z0] = points[index];
    const [x1, z1] = points[index + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const run = Math.hypot(dx, dz);
    if (run < MIN_SEGMENT_M) {
      continue;
    }
    const nx = (-dz / run) * RAIL_GAUGE_HALF_M;
    const nz = (dx / run) * RAIL_GAUGE_HALF_M;
    const top = railTopAt((x0 + x1) / 2, (z0 + z1) / 2);
    if (top === null) {
      continue;
    }
    for (const side of [-1, 1]) {
      addBeam(
        builder,
        RAIL_TONE,
        [x0 + nx * side, z0 + nz * side],
        [x1 + nx * side, z1 + nz * side],
        RAIL_WIDTH_M,
        RAIL_HEIGHT_M,
        top - RAIL_HEIGHT_M / 2,
      );
    }
  }
}

/**
 * The whole aboveground railway as one group, ready to join the drawn city
 * so it inherits its day/night and visibility handling.
 */
export function createRailNetwork(
  payload: RailPayload,
  ground: VoxelPayload,
): Group | null {
  const sample = worldGroundSampler(ground);
  const builder: Builder = { edges: [], parts: [] };
  const deckTop = payload.deck_top_y_m;
  const deckBottom = deckTop - DECK_THICKNESS_M;
  let hbfEastSteelSupportCount = 0;

  for (const surface of payload.viaduct) {
    addPlate(builder, surface, DECK_TONE, deckTop);
    addOutline(builder, surface.ring, deckTop + 0.02);
    // A fascia band around the rim turns the deck plate into a table with
    // a visible thickness instead of a decal floating over the city.
    const ring = ringMetres(surface.ring);
    for (let index = 0; index < ring.length; index += 1) {
      addBeam(
        builder,
        FASCIA_TONE,
        ring[index],
        ring[(index + 1) % ring.length],
        FASCIA_THICKNESS_M,
        DECK_THICKNESS_M,
        deckTop - DECK_THICKNESS_M / 2,
      );
    }
  }

  for (const [xDm, zDm] of payload.piers) {
    const x = xDm / 10;
    const z = zDm / 10;
    const foot = sample(x, z);
    if (foot === null || foot >= deckBottom) {
      continue;
    }
    if (isHbfEastSteelSupport(x, z)) {
      hbfEastSteelSupportCount += 1;
      const height = deckBottom - foot;
      addBox(
        builder,
        HBF_EAST_STEEL,
        { x: 0.72, y: height, z: 0.72 },
        { x, y: (foot + deckBottom) / 2, z },
      );
      addBox(
        builder,
        HBF_EAST_STEEL_DARK,
        { x: 0.8, y: 0.42, z: 5.8 },
        { x, y: deckBottom - 0.2, z },
      );
      addStrut(
        builder,
        HBF_EAST_STEEL_DARK,
        [x, foot + 0.35, z - 2.1],
        [x, deckBottom - 0.55, z],
        0.28,
      );
      addStrut(
        builder,
        HBF_EAST_STEEL_DARK,
        [x, foot + 0.35, z + 2.1],
        [x, deckBottom - 0.55, z],
        0.28,
      );
      continue;
    }
    addBox(
      builder,
      PIER_TONE,
      { x: PIER_SIDE_M, y: deckBottom - foot, z: PIER_SIDE_M },
      { x, y: (foot + deckBottom) / 2, z },
    );
  }

  const deckRailTop = deckTop + payload.rail_top_over_deck_m;
  for (const path of payload.viaduct_tracks) {
    addTrack(builder, path, () => deckRailTop);
  }

  for (const surface of payload.embankment) {
    addPlate(builder, surface, BALLAST_TONE, BALLAST_LIFT_M, sample);
  }
  for (const path of payload.embankment_tracks) {
    addTrack(builder, path, (x, z) => {
      const foot = sample(x, z);
      return foot === null
        ? null
        : foot + BALLAST_LIFT_M + payload.rail_top_over_deck_m;
    });
  }

  if (builder.parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "OSM aboveground railway";
  group.userData.geometryStatus =
    "OSM plan course; the deck runs level at the station model's own deck height because OSM carries no rail elevation";
  group.userData.hbfEastSteelSupportCount = hbfEastSteelSupportCount;

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.88,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = "railway deck, piers and rails";
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    group.add(mesh);
  }
  for (const part of builder.parts) {
    part.dispose();
  }

  const inkGeometry = mergeGeometries(builder.edges, false);
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      new LineBasicMaterial({ color: RAIL_INK }),
    );
    ink.name = "railway deck ink lines";
    ink.renderOrder = 2;
    group.add(ink);
  }
  for (const edge of builder.edges) {
    edge.dispose();
  }

  return group;
}
