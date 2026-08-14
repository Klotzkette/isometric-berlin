import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import type {
  RailPayload,
  UndergroundLineFamily,
  UndergroundPlatform,
} from "./RailNetwork";
import type { VisualMode } from "./visualMode";

/**
 * A source-led architectural cutaway of Berlin's mapped passenger tunnels.
 *
 * Horizontal courses, platforms and entrance points come from the committed
 * OSM extract. OSM has no surveyed tunnel depth or section, so the open frames,
 * shafts and vertical separation deliberately use the approximation metadata
 * exported beside them. No water, sewer, power or invented utility grid is
 * drawn. The result is an original pale-plane/ink cutaway language rather than
 * an imitation of any one illustrator.
 */

const TRACK_BED_WIDTH_M = 4.9;
const TRACK_BED_THICKNESS_M = 0.28;
const RAIL_GAUGE_HALF_M = 0.72;
const TUNNEL_HALF_WIDTH_M = 3.25;
const TUNNEL_HEIGHT_M = 4.8;
const FRAME_SPACING_M = 24;
const ENTRANCE_SHAFT_HALF_WIDTH_M = 1.4;
const PLATFORM_TOP_OFFSET_M = 0.38;
const PLATFORM_FASCIA_BOTTOM_OFFSET_M = 0.04;
const PLATFORM_INK_LIFT_M = 0.025;
const TRAM_WIRE_HEIGHT_M = 5.8;
const TRAM_MAST_SPACING_M = 35;

const ROUTE_COLORS: Record<
  VisualMode,
  Record<UndergroundLineFamily, number>
> = {
  day: {
    mainline: 0xa36d55,
    north_south_sbahn: 0x4f9975,
    north_south_sbahn_service: 0x77a58b,
    s_bahn: 0x75a66d,
    subway: 0x668baa,
    u5: 0xc99b32,
  },
  minecraft: {
    mainline: 0xa76142,
    north_south_sbahn: 0x3d9a62,
    north_south_sbahn_service: 0x68a37b,
    s_bahn: 0x55a85a,
    subway: 0x4a83b7,
    u5: 0xd9a821,
  },
  night: {
    mainline: 0xd28e67,
    north_south_sbahn: 0x80d8a3,
    north_south_sbahn_service: 0x8ebca0,
    s_bahn: 0x9bda8b,
    subway: 0x83bce5,
    u5: 0xf1c65a,
  },
  snowstorm: {
    mainline: 0xa87a68,
    north_south_sbahn: 0x659f83,
    north_south_sbahn_service: 0x86aa96,
    s_bahn: 0x83ab7e,
    subway: 0x7597b0,
    u5: 0xc4a357,
  },
};

const STRUCTURE_COLORS: Record<VisualMode, number> = {
  day: 0x5d625e,
  minecraft: 0x566158,
  night: 0xa9c7d3,
  snowstorm: 0x69777a,
};

const PLATFORM_COLORS: Record<VisualMode, number> = {
  day: 0xe7dfcb,
  minecraft: 0xd8caa9,
  night: 0x66747d,
  snowstorm: 0xe7e6df,
};

const PLATFORM_FASCIA_COLORS: Record<VisualMode, number> = {
  day: 0xc8bda8,
  minecraft: 0xb7a482,
  night: 0x4e5b63,
  snowstorm: 0xcbd0cd,
};

type SurfaceBuilder = {
  indices: number[];
  positions: number[];
};

function addQuad(
  builder: SurfaceBuilder,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
): void {
  const base = builder.positions.length / 3;
  builder.positions.push(...a, ...b, ...c, ...d);
  builder.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addStripSegment(
  builder: SurfaceBuilder,
  from: number[],
  to: number[],
  y: number,
): void {
  const x0 = from[0] / 10;
  const z0 = from[1] / 10;
  const x1 = to[0] / 10;
  const z1 = to[1] / 10;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const run = Math.hypot(dx, dz);
  if (run < 0.2) return;
  const nx = (-dz / run) * (TRACK_BED_WIDTH_M / 2);
  const nz = (dx / run) * (TRACK_BED_WIDTH_M / 2);
  const top = y;
  const bottom = y - TRACK_BED_THICKNESS_M;
  const left0: [number, number, number] = [x0 + nx, top, z0 + nz];
  const left1: [number, number, number] = [x1 + nx, top, z1 + nz];
  const right1: [number, number, number] = [x1 - nx, top, z1 - nz];
  const right0: [number, number, number] = [x0 - nx, top, z0 - nz];
  addQuad(builder, left0, left1, right1, right0);
  addQuad(
    builder,
    [left0[0], bottom, left0[2]],
    [left1[0], bottom, left1[2]],
    left1,
    left0,
  );
  addQuad(
    builder,
    right0,
    right1,
    [right1[0], bottom, right1[2]],
    [right0[0], bottom, right0[2]],
  );
}

function finishSurface(builder: SurfaceBuilder): BufferGeometry | null {
  if (builder.indices.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(builder.positions, 3),
  );
  geometry.setIndex(builder.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function pushSegment(
  positions: number[],
  a: [number, number, number],
  b: [number, number, number],
): void {
  positions.push(...a, ...b);
}

function addTrackLines(
  positions: number[],
  from: number[],
  to: number[],
  y: number,
): void {
  const x0 = from[0] / 10;
  const z0 = from[1] / 10;
  const x1 = to[0] / 10;
  const z1 = to[1] / 10;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const run = Math.hypot(dx, dz);
  if (run < 0.2) return;
  const nx = (-dz / run) * RAIL_GAUGE_HALF_M;
  const nz = (dx / run) * RAIL_GAUGE_HALF_M;
  for (const side of [-1, 1]) {
    pushSegment(
      positions,
      [x0 + nx * side, y + 0.16, z0 + nz * side],
      [x1 + nx * side, y + 0.16, z1 + nz * side],
    );
  }
  const frameNx = (-dz / run) * TUNNEL_HALF_WIDTH_M;
  const frameNz = (dx / run) * TUNNEL_HALF_WIDTH_M;
  pushSegment(
    positions,
    [x0 + frameNx, y + TUNNEL_HEIGHT_M, z0 + frameNz],
    [x1 + frameNx, y + TUNNEL_HEIGHT_M, z1 + frameNz],
  );
  pushSegment(
    positions,
    [x0 - frameNx, y + TUNNEL_HEIGHT_M, z0 - frameNz],
    [x1 - frameNx, y + TUNNEL_HEIGHT_M, z1 - frameNz],
  );

  const frames = Math.floor(run / FRAME_SPACING_M);
  for (let index = 0; index <= frames; index += 1) {
    const t = frames === 0 ? 0.5 : index / frames;
    const x = x0 + dx * t;
    const z = z0 + dz * t;
    const left: [number, number, number] = [
      x + frameNx,
      y + 0.05,
      z + frameNz,
    ];
    const leftTop: [number, number, number] = [
      x + frameNx,
      y + TUNNEL_HEIGHT_M,
      z + frameNz,
    ];
    const rightTop: [number, number, number] = [
      x - frameNx,
      y + TUNNEL_HEIGHT_M,
      z - frameNz,
    ];
    const right: [number, number, number] = [
      x - frameNx,
      y + 0.05,
      z - frameNz,
    ];
    pushSegment(positions, left, leftTop);
    pushSegment(positions, leftTop, rightTop);
    pushSegment(positions, rightTop, right);
  }
}

function makeLineSegments(
  positions: number[],
  color: number,
  name: string,
  palette?: Record<VisualMode, number>,
): LineSegments | null {
  if (positions.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color });
  material.toneMapped = false;
  if (palette) material.userData.modePalette = palette;
  const lines = new LineSegments(geometry, material);
  lines.name = name;
  lines.frustumCulled = true;
  return lines;
}

function platformShape(platform: UndergroundPlatform): ShapeGeometry | null {
  if (platform.ring.length < 4) return null;
  const shape = new Shape();
  platform.ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x / 10, -z / 10);
    else shape.lineTo(x / 10, -z / 10);
  });
  const geometry = new ShapeGeometry(shape);
  geometry.deleteAttribute("uv");
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, platform.track_y_m + PLATFORM_TOP_OFFSET_M, 0);
  return geometry;
}

function platformRingPoints(
  platform: UndergroundPlatform,
): Array<[number, number]> {
  const points = platform.ring.map(
    ([x, z]) => [x / 10, z / 10] as [number, number],
  );
  const first = points[0];
  const last = points.at(-1);
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    points.pop();
  }
  return points;
}

function createPlatforms(platforms: UndergroundPlatform[]): Mesh | null {
  const geometries = platforms
    .map(platformShape)
    .filter((entry): entry is ShapeGeometry => entry !== null);
  if (geometries.length === 0) return null;
  const geometry = mergeGeometries(geometries, false);
  for (const entry of geometries) entry.dispose();
  if (!geometry) return null;
  const material = new MeshBasicMaterial({
    color: PLATFORM_COLORS.day,
    side: DoubleSide,
  });
  material.userData.modePalette = PLATFORM_COLORS;
  const mesh = new Mesh(geometry, material);
  mesh.name = "mapped underground station platforms";
  mesh.userData.planGeometry = "committed OSM platform rings";
  return mesh;
}

function createPlatformFascias(
  platforms: UndergroundPlatform[],
): Mesh | null {
  const builder: SurfaceBuilder = { indices: [], positions: [] };
  for (const platform of platforms) {
    const points = platformRingPoints(platform);
    const top = platform.track_y_m + PLATFORM_TOP_OFFSET_M;
    const bottom = platform.track_y_m + PLATFORM_FASCIA_BOTTOM_OFFSET_M;
    for (let index = 0; index < points.length; index += 1) {
      const [x0, z0] = points[index];
      const [x1, z1] = points[(index + 1) % points.length];
      addQuad(
        builder,
        [x0, top, z0],
        [x1, top, z1],
        [x1, bottom, z1],
        [x0, bottom, z0],
      );
    }
  }
  const geometry = finishSurface(builder);
  if (!geometry) return null;
  const material = new MeshBasicMaterial({
    color: PLATFORM_FASCIA_COLORS.day,
    side: DoubleSide,
  });
  material.userData.modePalette = PLATFORM_FASCIA_COLORS;
  const mesh = new Mesh(geometry, material);
  mesh.name = "mapped underground platform edge fascias";
  mesh.userData.planGeometry = "committed OSM platform-ring edges";
  mesh.userData.verticalGeometry = "schematic 0.34 m drawing thickness";
  return mesh;
}

function addPlatformSectionFrames(
  platforms: UndergroundPlatform[],
  positions: number[],
): void {
  for (const platform of platforms) {
    const points = platformRingPoints(platform);
    const platformY =
      platform.track_y_m + PLATFORM_TOP_OFFSET_M + PLATFORM_INK_LIFT_M;
    const ceilingY =
      platform.track_y_m + TUNNEL_HEIGHT_M + PLATFORM_INK_LIFT_M;
    for (let index = 0; index < points.length; index += 1) {
      const [x0, z0] = points[index];
      const [x1, z1] = points[(index + 1) % points.length];
      pushSegment(positions, [x0, platformY, z0], [x1, platformY, z1]);
      pushSegment(positions, [x0, ceilingY, z0], [x1, ceilingY, z1]);
      pushSegment(positions, [x0, platformY, z0], [x0, ceilingY, z0]);
    }
  }
}

function addEntranceShafts(payload: RailPayload, positions: number[]): void {
  const top = payload.underground.surface_reference_y_m + 0.5;
  for (const entrance of payload.underground.entrances) {
    const x = entrance.point[0] / 10;
    const z = entrance.point[1] / 10;
    const bottom = entrance.track_y_m + 0.55;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const;
    for (const [sideX, sideZ] of corners) {
      pushSegment(
        positions,
        [
          x + sideX * ENTRANCE_SHAFT_HALF_WIDTH_M,
          top,
          z + sideZ * ENTRANCE_SHAFT_HALF_WIDTH_M,
        ],
        [
          x + sideX * ENTRANCE_SHAFT_HALF_WIDTH_M,
          bottom,
          z + sideZ * ENTRANCE_SHAFT_HALF_WIDTH_M,
        ],
      );
    }
    const levels = Math.max(2, Math.round((top - bottom) / 4));
    for (let level = 0; level <= levels; level += 1) {
      const y = bottom + ((top - bottom) * level) / levels;
      for (let index = 0; index < corners.length; index += 1) {
        const [sideX0, sideZ0] = corners[index];
        const [sideX1, sideZ1] = corners[(index + 1) % corners.length];
        pushSegment(
          positions,
          [
            x + sideX0 * ENTRANCE_SHAFT_HALF_WIDTH_M,
            y,
            z + sideZ0 * ENTRANCE_SHAFT_HALF_WIDTH_M,
          ],
          [
            x + sideX1 * ENTRANCE_SHAFT_HALF_WIDTH_M,
            y,
            z + sideZ1 * ENTRANCE_SHAFT_HALF_WIDTH_M,
          ],
        );
      }
    }
  }
}

export function setUndergroundPresentation(
  root: Group,
  mode: VisualMode,
): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    const material = object.material;
    if (Array.isArray(material) || !(material instanceof MeshBasicMaterial || material instanceof LineBasicMaterial)) {
      return;
    }
    const palette = material.userData.modePalette as
      | Record<VisualMode, number>
      | undefined;
    if (palette) material.color.setHex(palette[mode]);
  });
}

export function createUndergroundNetwork(payload: RailPayload): Group | null {
  if (payload.underground.tracks.length === 0) return null;
  const group = new Group();
  group.name = "Mapped underground passenger network cutaway";
  group.userData.geometryStatus = payload.underground.geometry_status;
  group.userData.utilityNetworksIncluded =
    payload.underground.utility_networks_included;
  group.userData.routeEvidence = payload.route_evidence;
  group.userData.evidenceBoundary = {
    omitted: [
      "building services",
      "district heating",
      "power",
      "sewer",
      "telecom",
      "unmapped passages",
      "water",
    ],
    planGeometry: "committed OSM tracks, platforms and entrance points",
    verticalGeometry: "schematic layer-based drawing, not survey data",
  };

  const familySurfaces = new Map<UndergroundLineFamily, SurfaceBuilder>();
  const familyLines = new Map<UndergroundLineFamily, number[]>();
  for (const track of payload.underground.tracks) {
    const surfaces = familySurfaces.get(track.line_family) ?? {
      indices: [],
      positions: [],
    };
    const lines = familyLines.get(track.line_family) ?? [];
    familySurfaces.set(track.line_family, surfaces);
    familyLines.set(track.line_family, lines);
    for (let index = 0; index < track.points.length - 1; index += 1) {
      addStripSegment(
        surfaces,
        track.points[index],
        track.points[index + 1],
        track.track_y_m,
      );
      addTrackLines(
        lines,
        track.points[index],
        track.points[index + 1],
        track.track_y_m,
      );
    }
  }

  for (const [family, builder] of familySurfaces) {
    const geometry = finishSurface(builder);
    if (!geometry) continue;
    const material = new MeshBasicMaterial({
      color: ROUTE_COLORS.day[family],
      side: DoubleSide,
    });
    material.userData.modePalette = Object.fromEntries(
      (Object.keys(ROUTE_COLORS) as VisualMode[]).map((mode) => [
        mode,
        ROUTE_COLORS[mode][family],
      ]),
    );
    const mesh = new Mesh(geometry, material);
    mesh.name = `underground ${family} track beds`;
    group.add(mesh);
    const lines = makeLineSegments(
      familyLines.get(family) ?? [],
      ROUTE_COLORS.day[family],
      `underground ${family} rails and section frames`,
      material.userData.modePalette as Record<VisualMode, number>,
    );
    if (lines) group.add(lines);
  }

  const platforms = createPlatforms(payload.underground.platforms);
  if (platforms) group.add(platforms);

  const platformFascias = createPlatformFascias(
    payload.underground.platforms,
  );
  if (platformFascias) group.add(platformFascias);

  const platformFramePositions: number[] = [];
  addPlatformSectionFrames(
    payload.underground.platforms,
    platformFramePositions,
  );
  const platformFrames = makeLineSegments(
    platformFramePositions,
    STRUCTURE_COLORS.day,
    "mapped platform edges with schematic station section frames",
    STRUCTURE_COLORS,
  );
  if (platformFrames) {
    platformFrames.userData.planGeometry = "committed OSM platform rings";
    platformFrames.userData.verticalGeometry =
      "schematic open projection to the documented cutaway height";
    group.add(platformFrames);
  }

  const shaftPositions: number[] = [];
  addEntranceShafts(payload, shaftPositions);
  const shafts = makeLineSegments(
    shaftPositions,
    STRUCTURE_COLORS.day,
    "mapped subway entrances with schematic shafts and landings",
    STRUCTURE_COLORS,
  );
  if (shafts) {
    shafts.userData.planGeometry = "committed OSM subway entrance points";
    shafts.userData.verticalGeometry =
      "schematic open shafts and level frames, not surveyed structures";
    group.add(shafts);
  }

  setUndergroundPresentation(group, "day");
  return group;
}

/** Contact wires follow real OSM tram courses; height and mast rhythm are approximate. */
export function createTramCatenary(
  payload: RailPayload,
  ground: VoxelPayload,
): Group | null {
  const sample = worldGroundSampler(ground);
  const wires: number[] = [];
  const masts: number[] = [];
  const mastKeys = new Set<string>();
  for (const track of payload.tram_catenary.tracks) {
    for (let index = 0; index < track.points.length - 1; index += 1) {
      const [x0dm, z0dm] = track.points[index];
      const [x1dm, z1dm] = track.points[index + 1];
      const x0 = x0dm / 10;
      const z0 = z0dm / 10;
      const x1 = x1dm / 10;
      const z1 = z1dm / 10;
      const run = Math.hypot(x1 - x0, z1 - z0);
      if (run < 0.5) continue;
      const y0 = (sample(x0, z0) ?? 5.2) + TRAM_WIRE_HEIGHT_M;
      const y1 = (sample(x1, z1) ?? 5.2) + TRAM_WIRE_HEIGHT_M;
      pushSegment(wires, [x0, y0, z0], [x1, y1, z1]);
      const count = Math.floor(run / TRAM_MAST_SPACING_M);
      for (let mast = 0; mast <= count; mast += 1) {
        const t = count === 0 ? 0.5 : mast / count;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const key = `${Math.round(x / 12)}:${Math.round(z / 12)}`;
        if (mastKeys.has(key)) continue;
        mastKeys.add(key);
        const groundY = sample(x, z) ?? 5.2;
        pushSegment(
          masts,
          [x, groundY + 0.1, z],
          [x, groundY + TRAM_WIRE_HEIGHT_M + 0.3, z],
        );
      }
    }
  }
  const group = new Group();
  group.name = "OSM tram overhead contact system";
  group.userData.geometryStatus = payload.tram_catenary.geometry_status;
  const wireLines = makeLineSegments(
    wires,
    0x5f6664,
    "tram contact wires",
  );
  const mastLines = makeLineSegments(
    masts,
    0x636966,
    "tram catenary masts",
  );
  if (wireLines) group.add(wireLines);
  if (mastLines) group.add(mastLines);
  return group.children.length > 0 ? group : null;
}
