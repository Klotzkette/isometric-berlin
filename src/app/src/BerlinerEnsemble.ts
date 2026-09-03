import {
  BoxGeometry,
  BufferGeometry,
  Camera,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
import {
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";

type FacadeWall = {
  dirX: number;
  dirZ: number;
  index: number;
  length: number;
  nx: number;
  nz: number;
  x1: number;
  z1: number;
};

export const BERLINER_ENSEMBLE_MAIN_ID = "6lQyofA6";
export const BERLINER_ENSEMBLE_CORNER_ID = "5UbqhW10";
export const BERLINER_ENSEMBLE_SHOW_FACADE_ID = "o3ZOA8rr";
export const BERLINER_ENSEMBLE_RETURN_ID = "7Nu07Ngx";

/** Every Berlin LoD2 part of named parent DEBE01YYK00004vY. */
export const BERLINER_ENSEMBLE_IDS: ReadonlySet<string> = new Set([
  BERLINER_ENSEMBLE_MAIN_ID,
  BERLINER_ENSEMBLE_CORNER_ID,
  BERLINER_ENSEMBLE_SHOW_FACADE_ID,
  BERLINER_ENSEMBLE_RETURN_ID,
]);

/** Dedicated public-art models own these exact OSM source points. */
export const BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS: ReadonlySet<string> =
  new Set(["node/988668382", "node/13841652635"]);

export const BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX = 3;
export const BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES = [
  0, 2, 4,
] as const;
export const BERLINER_ENSEMBLE_PROJECTING_RETURN_WALL_INDICES = [
  1, 3, 5, 7,
] as const;
export const BERLINER_ENSEMBLE_PROJECTING_INTERNAL_WALL_INDEX = 6;
export const BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX = 18;
export const BERLINER_ENSEMBLE_PUBLIC_FACADE_AZIMUTH_DEGREES = 128.274;
export const BERLINER_ENSEMBLE_FOCUS_AZIMUTH_DEGREES = 121;
export const BERLINER_ENSEMBLE_FACADE_SURFACE_PROJECTION_M = 0.22;
export const BERLINER_ENSEMBLE_MAX_FACADE_DETAIL_PROJECTION_M = 0.79;
/** Photo-bounded against the 3.91 m roof-stage crown in the 2019/2023 views. */
export const BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M = 4.8;
export const BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M = 34.58;
export const BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS = 120;
export const BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_RADIANS_PER_SECOND =
  (Math.PI * 2) / BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS;
export const BERLINER_ENSEMBLE_ROOF_SIGN_PIVOT_MARKER =
  "berlinerEnsembleRoofSignPivot";
export const BERLINER_ENSEMBLE_ROOF_SIGN_INSTANCES_MARKER =
  "berlinerEnsembleRoofSignInstances";
export const BERLINER_ENSEMBLE_ROOF_CAP_TOP_Y_M = 29.58;
export const BERLINER_ENSEMBLE_ROOF_TOWER_ANCHOR_WORLD_M = [
  1006.916, -323.789,
] as const;
export const BERLINER_ENSEMBLE_ROOF_TOWER_ROTATION_DEGREES =
  -142.25319137054232;
export const BERLINER_ENSEMBLE_ROOF_CAP_WIDTH_M = 8.5;
export const BERLINER_ENSEMBLE_ROOF_CAP_DEPTH_M = 3.5481558265782067;

export const BERLINER_ENSEMBLE_TONES = {
  drainpipe: 0x66706f,
  facade: 0xb2a691,
  facadeLight: 0xc5baa5,
  facadeReturn: 0xa79b87,
  frame: 0x303b3c,
  granite: 0x77584b,
  glass: 0x344447,
  lamp: 0xe3dfd2,
  nightGlass: 0xffc979,
  plinth: 0x555a58,
  poster: 0xd2cdc2,
  sandstone: 0xc8b991,
  signMetal: 0x6b6760,
  slate: 0x41494b,
} as const;

export const BERLINER_ENSEMBLE_PROFILE = {
  address: "Bertolt-Brecht-Platz 1, 10117 Berlin",
  architect: "Heinrich Seeling",
  built: "1891-1892",
  brechtMonumentWorld: [1026.376, -349.777] as const,
  brechtOsmKey: "node/988668382",
  brechtTurntableDiameterM: 6,
  facade: {
    maxAuthoredDetailProjectionM:
      BERLINER_ENSEMBLE_MAX_FACADE_DETAIL_PROJECTION_M,
    mainEndWallIndex: BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
    projectingInternalWallIndex:
      BERLINER_ENSEMBLE_PROJECTING_INTERNAL_WALL_INDEX,
    projectingReturnWallIndices:
      BERLINER_ENSEMBLE_PROJECTING_RETURN_WALL_INDICES,
    projectingWallIndices: BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES,
    publicNormalAzimuthDegrees: BERLINER_ENSEMBLE_PUBLIC_FACADE_AZIMUTH_DEGREES,
    rhythm:
      "3 round arches + entrance + 3 round arches; 2 upper arches + neutral poster + 2 upper arches",
    sourceMainPrismId: BERLINER_ENSEMBLE_MAIN_ID,
    sourceProjectingPrismId: BERLINER_ENSEMBLE_SHOW_FACADE_ID,
    surfaceProjectionM: BERLINER_ENSEMBLE_FACADE_SURFACE_PROJECTION_M,
  },
  focus: {
    azimuthDegrees: BERLINER_ENSEMBLE_FOCUS_AZIMUTH_DEGREES,
    targetWorldM: [988.9, 4, -327.3] as const,
  },
  geometryStatus:
    "all four official Berlin LoD2 parts and their measured heights remain visible and collision-authoritative; the current stripped taupe plaster, exact stepped show-facade walls, openings, shallow entrance-risalit articulation, roof cap and open sign are thin source-bound recognition overlays; packaged reference thumbnails serve QA/attribution only and no photo texture is used; no replacement envelope and no invented 1892 ornament",
  heleneWeigelCourtyardWorld: [965.8, -361.8] as const,
  heleneWeigelOsmKey: "node/13841652635",
  lod2Function: 3032,
  lod2Parent: "DEBE01YYK00004vY",
  name: "Berliner Ensemble / Theater am Schiffbauerdamm",
  osm: {
    amenity: "theatre",
    buildingRefLda: "09011192",
    buildingWayId: "43017010",
    siteWayId: "422928025",
  },
  roofSign: {
    centreY: BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
    diameterM: BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M,
    presentationAnimated: true,
    realWorldRotates: true,
    rotationPeriodSeconds: BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS,
    schwellenraumAnimated: true,
    visualModes: ["day", "night", "snowstorm", "minecraft", "schwellenraum"],
  },
  roofTower: {
    anchorStatus:
      "measured high point of the official 6lQyofA6 photo mesh; the adjoining 5UbqhW10 wall-18 axis supplies only the cap orientation, while the cap footprint is bounded to the four-part LoD2 union",
    anchorWorldM: BERLINER_ENSEMBLE_ROOF_TOWER_ANCHOR_WORLD_M,
    capContainment: {
      baseDepthM: BERLINER_ENSEMBLE_ROOF_CAP_DEPTH_M,
      baseWidthM: BERLINER_ENSEMBLE_ROOF_CAP_WIDTH_M,
      depthFractionOfWallFrame: 0.92,
      maxDepthM: 3.55,
      maxWidthM: 8.5,
      widthFractionOfWallFrame: 0.86,
    },
    containmentFramePrismId: BERLINER_ENSEMBLE_CORNER_ID,
    containmentFrameWallIndex: BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX,
    footprintSourcePrismIds: [...BERLINER_ENSEMBLE_IDS],
    sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
  },
  sourcePartRoles: {
    [BERLINER_ENSEMBLE_MAIN_ID]:
      "main theatre body; wall 3 contributes only the two exposed end pieces beside the projecting facade shell; the official photo mesh also locates the tall roof-tower high point on this part",
    [BERLINER_ENSEMBLE_CORNER_ID]:
      "irregular corner/entrance part; wall 18 binds the porch, granite columns and large arched poster field and supplies the adjacent roof-cap axis, but this lower part is not claimed as the tall roof tower",
    [BERLINER_ENSEMBLE_SHOW_FACADE_ID]:
      "real projecting show-facade shell; public faces 0/2/4 carry the 2+entrance+2 central ground rhythm and 2+poster+2 upper rhythm; returns 1/3/5/7 remain visible",
    [BERLINER_ENSEMBLE_RETURN_ID]:
      "short subordinate return part retained as LoD2 with only plinth/eave recognition strips",
  },
  sourceUrls: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011192",
    "https://d-4.de/en/theater-am-schiffbauerdamm/",
    "https://www.berliner-ensemble.de/index.php/das-theater-am-schiffbauerdamm",
    "https://www.berliner-ensemble.de/magazin/berlin-leuchtet",
    "https://www.tagesspiegel.de/berlin/berliner-wirtschaft/leuchtreklame-1899-das-manoli-rad-liess-berlin-durchdrehen-11247823.html",
    "https://www.openstreetmap.org/way/422928025",
    "https://www.openstreetmap.org/way/43017010",
    "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
  ],
  /** Existing public-art sources retained for CentralCivicDetails. */
  sources: [
    "https://www.berliner-ensemble.de/en/node/67?language_content_entity=de",
    "https://www.berliner-ensemble.de/magazin/berlin-leuchtet",
    "https://bildhauerei-in-berlin.de/bildwerk/bertolt-brecht-denkmal-5412/",
    "https://www.berliner-ensemble.de/eine-skulptur-fuer-helene-weigel",
  ],
  visualReferences: [
    {
      artist: "Yair Haklai",
      geometryStatus:
        "reference-only; thumbnail packaged for QA/attribution and not used as a texture",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Berliner_Ensemble_building_(Theater_am_Schiffbauerdamm).jpg",
      role: "2019 square facade: stripped taupe render, 3+entrance+3 lower rhythm, paired lanterns, shallow dark roof and open roof sign",
      title: "Berliner Ensemble building (Theater am Schiffbauerdamm).jpg",
    },
    {
      artist: "Fridolin freudenfett",
      geometryStatus:
        "reference-only; thumbnail packaged for QA/attribution and not used as a texture",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Mitte_Bertolt-Brecht-Platz_Theater_am_Schiffbauerdamm.JPG",
      role: "2015 frontal facade: two upper windows on each side of the mutable poster and triple end-field openings",
      title: "Mitte Bertolt-Brecht-Platz Theater am Schiffbauerdamm.JPG",
    },
    {
      artist: "Derbrauni",
      geometryStatus:
        "reference-only; thumbnail packaged for QA/attribution and not used as a texture",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Theater_am_Schiffbauerdamm_01.jpg",
      role: "2023 corner detail: truncated slate tower cap, open weathered sign, arched poster field, granite columns, sandstone balcony and lantern pairs",
      title: "Theater am Schiffbauerdamm 01.jpg",
    },
  ],
} as const;

function ringWalls(ring: number[][]): FacadeWall[] {
  let doubleArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[(index + 1) % ring.length];
    doubleArea += x1 * z2 - x2 * z1;
  }
  const flip = doubleArea >= 0 ? 1 : -1;
  const walls: FacadeWall[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const [x1dm, z1dm] = ring[index];
    const [x2dm, z2dm] = ring[(index + 1) % ring.length];
    const x1 = x1dm / 10;
    const z1 = z1dm / 10;
    const dx = x2dm / 10 - x1;
    const dz = z2dm / 10 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) continue;
    const dirX = dx / length;
    const dirZ = dz / length;
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

function wallOf(building: PrismBuilding, index: number): FacadeWall {
  const wall = ringWalls(building.ring).find(
    (candidate) => candidate.index === index,
  );
  if (!wall) {
    throw new Error(
      `Missing wall ${index} on Berliner Ensemble ${building.id}`,
    );
  }
  return wall;
}

function wallPoint(
  wall: FacadeWall,
  along: number,
  y: number,
  outward: number,
): [number, number, number] {
  return [
    wall.x1 + wall.dirX * along + wall.nx * outward,
    y,
    wall.z1 + wall.dirZ * along + wall.nz * outward,
  ];
}

function wallRotation(wall: FacadeWall): number {
  return -Math.atan2(wall.dirZ, wall.dirX);
}

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  lamp = false,
  inked = false,
): void {
  const edgeGeometry = inked
    ? new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES)
    : null;
  const renderedGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
  if (renderedGeometry !== geometry) geometry.dispose();
  paintGeometry(renderedGeometry, color);
  (lamp ? builder.lamps : builder.parts).push(renderedGeometry);
  if (edgeGeometry) builder.edges.push(edgeGeometry);
}

function addWallBox(
  builder: Builder,
  wall: FacadeWall,
  color: number,
  along: number,
  y: number,
  outward: number,
  width: number,
  height: number,
  depth: number,
  lamp = false,
  inked = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(wallRotation(wall));
  const [x, resolvedY, z] = wallPoint(wall, along, y, outward);
  geometry.translate(x, resolvedY, z);
  addPaintedGeometry(builder, geometry, color, lamp, inked);
}

function archGeometry(width: number, height: number): ShapeGeometry {
  const radius = width / 2;
  const springY = Math.max(0.2, height - radius);
  const shape = new Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, springY);
  shape.absarc(0, springY, radius, 0, Math.PI, false);
  shape.closePath();
  return new ShapeGeometry(shape, 18);
}

function addWallArch(
  builder: Builder,
  wall: FacadeWall,
  color: number,
  along: number,
  bottomY: number,
  outward: number,
  width: number,
  height: number,
  inked = false,
): void {
  const geometry = archGeometry(width, height);
  geometry.rotateY(wallRotation(wall));
  const [x, y, z] = wallPoint(wall, along, bottomY, outward);
  geometry.translate(x, y, z);
  addPaintedGeometry(builder, geometry, color, false, inked);
}

function addFramedArch(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  bottomY: number,
  width: number,
  height: number,
  mullionCount = 1,
): void {
  addWallArch(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.facadeLight,
    along,
    bottomY - 0.16,
    0.18,
    width + 0.32,
    height + 0.32,
    true,
  );
  addWallArch(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.glass,
    along,
    bottomY,
    0.205,
    width,
    height,
  );
  const mullionHeight = height * 0.88;
  for (let index = 1; index <= mullionCount; index += 1) {
    const offset = -width / 2 + (width * index) / Math.max(2, mullionCount + 1);
    addWallBox(
      builder,
      wall,
      BERLINER_ENSEMBLE_TONES.frame,
      along + offset,
      bottomY + mullionHeight / 2,
      0.235,
      0.08,
      mullionHeight,
      0.06,
    );
  }
  addWallBox(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.frame,
    along,
    bottomY + height * 0.48,
    0.235,
    width - 0.14,
    0.08,
    0.06,
  );
}

function addWallSkin(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  along: number,
  width: number,
  color: number = BERLINER_ENSEMBLE_TONES.facade,
): void {
  const bottom = building.y0_dm / 10;
  const height = building.h_dm / 10;
  addWallBox(
    builder,
    wall,
    color,
    along,
    bottom + height / 2,
    0.055,
    Math.max(0.12, width - 0.04),
    height - 0.08,
    0.1,
  );
}

function addBand(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  width: number,
  y: number,
  height: number,
): void {
  addWallBox(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.facadeLight,
    along,
    y,
    0.145,
    Math.max(0.1, width - 0.08),
    height,
    0.16,
    false,
    true,
  );
}

function addPlinth(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  width: number,
  bottomY: number,
): void {
  addWallBox(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.plinth,
    along,
    bottomY + 0.38,
    0.165,
    Math.max(0.1, width - 0.08),
    0.76,
    0.18,
  );
}

function addLanternPair(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  y: number,
): number {
  for (const offset of [-0.27, 0.27]) {
    addWallBox(
      builder,
      wall,
      BERLINER_ENSEMBLE_TONES.frame,
      along + offset,
      y,
      0.29,
      0.08,
      0.08,
      0.42,
    );
    const [x, resolvedY, z] = wallPoint(wall, along + offset, y, 0.52);
    const lamp = new BoxGeometry(0.26, 0.34, 0.22);
    lamp.rotateY(wallRotation(wall));
    lamp.translate(x, resolvedY, z);
    addPaintedGeometry(builder, lamp, BERLINER_ENSEMBLE_TONES.lamp, true, true);
  }
  return 2;
}

function projectionAlong(wall: FacadeWall, x: number, z: number): number {
  return (x - wall.x1) * wall.dirX + (z - wall.z1) * wall.dirZ;
}

function addMainShowFacade(
  builder: Builder,
  main: PrismBuilding,
  projection: PrismBuilding,
): {
  endWidthsM: [number, number];
  groundWindows: number;
  lanterns: number;
  neutralPosters: number;
  upperWindows: number;
  vents: number;
} {
  const mainWall = wallOf(main, BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX);
  const internal = wallOf(
    projection,
    BERLINER_ENSEMBLE_PROJECTING_INTERNAL_WALL_INDEX,
  );
  const sharedA = projectionAlong(mainWall, internal.x1, internal.z1);
  const sharedB = projectionAlong(
    mainWall,
    internal.x1 + internal.dirX * internal.length,
    internal.z1 + internal.dirZ * internal.length,
  );
  const sharedStart = Math.max(0, Math.min(sharedA, sharedB));
  const sharedEnd = Math.min(mainWall.length, Math.max(sharedA, sharedB));
  const endRanges = [
    [0, sharedStart],
    [sharedEnd, mainWall.length],
  ] as const;
  let groundWindows = 0;
  let upperWindows = 0;
  let vents = 0;
  let lanterns = 0;

  for (const [start, end] of endRanges) {
    const width = end - start;
    const centre = start + width / 2;
    addWallSkin(builder, main, mainWall, centre, width);
    addPlinth(builder, mainWall, centre, width, main.y0_dm / 10);
    addBand(builder, mainWall, centre, width, 9.56, 0.28);
    addBand(builder, mainWall, centre, width, 17.72, 0.32);
    addBand(builder, mainWall, centre, width, 22.76, 0.42);
    addFramedArch(builder, mainWall, centre, 4.78, 2.35, 4.25, 1);
    groundWindows += 1;
    for (const fraction of [0.34, 0.5, 0.66]) {
      addWallArch(
        builder,
        mainWall,
        BERLINER_ENSEMBLE_TONES.frame,
        start + width * fraction,
        18.72,
        0.205,
        0.52,
        2.02,
        true,
      );
      vents += 1;
    }
    lanterns += addLanternPair(builder, mainWall, centre, 9.98);
  }

  const frontWalls = BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES.map(
    (index) => wallOf(projection, index),
  );
  const returnWalls = BERLINER_ENSEMBLE_PROJECTING_RETURN_WALL_INDICES.map(
    (index) => wallOf(projection, index),
  );
  for (const wall of frontWalls) {
    addWallSkin(builder, projection, wall, wall.length / 2, wall.length);
    addPlinth(
      builder,
      wall,
      wall.length / 2,
      wall.length,
      projection.y0_dm / 10,
    );
    addBand(builder, wall, wall.length / 2, wall.length, 9.56, 0.28);
    addBand(builder, wall, wall.length / 2, wall.length, 17.72, 0.32);
    addBand(builder, wall, wall.length / 2, wall.length, 19.74, 0.38);
  }
  for (const wall of returnWalls) {
    addWallSkin(
      builder,
      projection,
      wall,
      wall.length / 2,
      wall.length,
      BERLINER_ENSEMBLE_TONES.facadeReturn,
    );
  }

  for (const wall of [frontWalls[0], frontWalls[2]]) {
    for (const fraction of [0.29, 0.71]) {
      const along = wall.length * fraction;
      addFramedArch(builder, wall, along, 4.78, 2.35, 4.25, 1);
      addFramedArch(builder, wall, along, 10.28, 2.48, 6.18, 1);
      groundWindows += 1;
      upperWindows += 1;
      lanterns += addLanternPair(builder, wall, along, 9.98);
    }
  }

  const entranceWall = frontWalls[1];
  const entranceAlong = entranceWall.length / 2;
  addFramedArch(builder, entranceWall, entranceAlong, 4.72, 3.72, 4.5, 2);
  addWallBox(
    builder,
    entranceWall,
    BERLINER_ENSEMBLE_TONES.poster,
    entranceAlong,
    13.75,
    0.22,
    Math.min(5.28, entranceWall.length - 0.6),
    7.0,
    0.06,
    false,
    true,
  );
  addWallBox(
    builder,
    entranceWall,
    BERLINER_ENSEMBLE_TONES.frame,
    entranceAlong,
    17.44,
    0.25,
    Math.min(5.58, entranceWall.length - 0.34),
    0.12,
    0.08,
  );
  lanterns += addLanternPair(builder, entranceWall, entranceAlong, 9.98);

  return {
    endWidthsM: [endRanges[0][1], mainWall.length - endRanges[1][0]],
    groundWindows,
    lanterns,
    neutralPosters: 1,
    upperWindows,
    vents,
  };
}

function addDownpipe(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  bottomY: number,
  height: number,
): void {
  const [x, y, z] = wallPoint(wall, along, bottomY + height / 2, 0.28);
  const pipe = new CylinderGeometry(0.075, 0.075, height, 8);
  pipe.translate(x, y, z);
  addPaintedGeometry(builder, pipe, BERLINER_ENSEMBLE_TONES.drainpipe);
}

function addTowerEntrance(
  builder: Builder,
  tower: PrismBuilding,
): { graniteColumns: number; neutralPosters: number } {
  const wall = wallOf(tower, BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX);
  const bottom = tower.y0_dm / 10;
  addWallSkin(builder, tower, wall, wall.length / 2, wall.length);
  addPlinth(builder, wall, wall.length / 2, wall.length, bottom);
  addWallBox(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.glass,
    wall.length / 2,
    bottom + 2.2,
    0.2,
    wall.length - 0.36,
    4.0,
    0.08,
  );
  const columnCount = 4;
  for (let index = 0; index < columnCount; index += 1) {
    const along = 0.43 + ((wall.length - 0.86) * index) / (columnCount - 1);
    const [x, y, z] = wallPoint(wall, along, bottom + 2.15, 0.54);
    const column = new CylinderGeometry(0.16, 0.19, 4.1, 12);
    column.translate(x, y, z);
    addPaintedGeometry(
      builder,
      column,
      BERLINER_ENSEMBLE_TONES.granite,
      false,
      true,
    );
  }
  addWallBox(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.sandstone,
    wall.length / 2,
    bottom + 4.55,
    0.48,
    wall.length - 0.18,
    0.68,
    0.62,
    false,
    true,
  );
  addWallArch(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.facadeLight,
    wall.length / 2,
    bottom + 5.15,
    0.17,
    wall.length - 0.34,
    8.45,
    true,
  );
  addWallArch(
    builder,
    wall,
    BERLINER_ENSEMBLE_TONES.poster,
    wall.length / 2,
    bottom + 5.43,
    0.205,
    wall.length - 0.68,
    7.85,
  );
  return { graniteColumns: columnCount, neutralPosters: 1 };
}

function addReturnPart(builder: Builder, building: PrismBuilding): number {
  let skins = 0;
  for (const index of [0, 1, 2]) {
    const wall = wallOf(building, index);
    addWallSkin(
      builder,
      building,
      wall,
      wall.length / 2,
      wall.length,
      BERLINER_ENSEMBLE_TONES.facadeReturn,
    );
    addPlinth(builder, wall, wall.length / 2, wall.length, building.y0_dm / 10);
    addBand(
      builder,
      wall,
      wall.length / 2,
      wall.length,
      building.y0_dm / 10 + building.h_dm / 10 - 0.42,
      0.34,
    );
    skins += 1;
  }
  return skins;
}

type AxisBounds = {
  centreX: number;
  centreZ: number;
  depth: number;
  width: number;
};

function axisBounds(building: PrismBuilding, wall: FacadeWall): AxisBounds {
  const along: number[] = [];
  const depth: number[] = [];
  for (const [xDm, zDm] of building.ring) {
    const x = xDm / 10;
    const z = zDm / 10;
    along.push(x * wall.dirX + z * wall.dirZ);
    depth.push(x * wall.nx + z * wall.nz);
  }
  const minAlong = Math.min(...along);
  const maxAlong = Math.max(...along);
  const minDepth = Math.min(...depth);
  const maxDepth = Math.max(...depth);
  const centreAlong = (minAlong + maxAlong) / 2;
  const centreDepth = (minDepth + maxDepth) / 2;
  return {
    centreX: wall.dirX * centreAlong + wall.nx * centreDepth,
    centreZ: wall.dirZ * centreAlong + wall.nz * centreDepth,
    depth: maxDepth - minDepth,
    width: maxAlong - minAlong,
  };
}

function doubleSidedQuadGeometry(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
): BufferGeometry {
  const vertices = [
    ...a,
    ...b,
    ...c,
    ...a,
    ...c,
    ...d,
    ...c,
    ...b,
    ...a,
    ...d,
    ...c,
    ...a,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function axisPoint(
  centre: AxisBounds,
  wall: FacadeWall,
  along: number,
  depth: number,
  y: number,
): [number, number, number] {
  return [
    centre.centreX + wall.dirX * along + wall.nx * depth,
    y,
    centre.centreZ + wall.dirZ * along + wall.nz * depth,
  ];
}

function addAxisBox(
  builder: Builder,
  wall: FacadeWall,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  inked = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(wallRotation(wall));
  geometry.translate(x, y, z);
  addPaintedGeometry(builder, geometry, color, false, inked);
}

function addTowerRoofCap(
  builder: Builder,
  tower: PrismBuilding,
): {
  baseAreaM2: number;
  baseFootprintWorld: readonly (readonly [number, number])[];
  centreX: number;
  centreZ: number;
  stageTopY: number;
} {
  const front = wallOf(tower, BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX);
  const sourceBounds = axisBounds(tower, front);
  const [sourceCentroidX, sourceCentroidZ] =
    BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM;
  const bounds: AxisBounds = {
    ...sourceBounds,
    centreX: sourceCentroidX,
    centreZ: sourceCentroidZ,
  };
  const baseY = tower.y0_dm / 10 + tower.h_dm / 10 + 0.04;
  const topY = BERLINER_ENSEMBLE_ROOF_CAP_TOP_Y_M;
  const containment = BERLINER_ENSEMBLE_PROFILE.roofTower.capContainment;
  const baseWidth = Math.min(
    containment.baseWidthM,
    containment.maxWidthM,
    bounds.width * containment.widthFractionOfWallFrame,
  );
  const baseDepth = Math.min(
    containment.baseDepthM,
    containment.maxDepthM,
    bounds.depth * containment.depthFractionOfWallFrame,
  );
  const topWidth = baseWidth * 0.46;
  const topDepth = baseDepth * 0.46;
  const baseCorners = [
    axisPoint(bounds, front, -baseWidth / 2, -baseDepth / 2, baseY),
    axisPoint(bounds, front, baseWidth / 2, -baseDepth / 2, baseY),
    axisPoint(bounds, front, baseWidth / 2, baseDepth / 2, baseY),
    axisPoint(bounds, front, -baseWidth / 2, baseDepth / 2, baseY),
  ] as const;
  const topCorners = [
    axisPoint(bounds, front, -topWidth / 2, -topDepth / 2, topY),
    axisPoint(bounds, front, topWidth / 2, -topDepth / 2, topY),
    axisPoint(bounds, front, topWidth / 2, topDepth / 2, topY),
    axisPoint(bounds, front, -topWidth / 2, topDepth / 2, topY),
  ] as const;
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    addPaintedGeometry(
      builder,
      doubleSidedQuadGeometry(
        baseCorners[side],
        baseCorners[next],
        topCorners[next],
        topCorners[side],
      ),
      BERLINER_ENSEMBLE_TONES.slate,
      false,
      true,
    );
  }

  const stageHeight = 1.16;
  const stageY = topY + stageHeight / 2;
  for (const depthSign of [-1, 1]) {
    const [x, , z] = axisPoint(
      bounds,
      front,
      0,
      (depthSign * topDepth) / 2,
      stageY,
    );
    addAxisBox(
      builder,
      front,
      BERLINER_ENSEMBLE_TONES.signMetal,
      x,
      topY + 0.14,
      z,
      topWidth,
      0.16,
      0.13,
    );
    addAxisBox(
      builder,
      front,
      BERLINER_ENSEMBLE_TONES.signMetal,
      x,
      topY + stageHeight - 0.12,
      z,
      topWidth,
      0.16,
      0.13,
    );
  }
  for (const alongSign of [-1, 1]) {
    const [x, , z] = axisPoint(
      bounds,
      front,
      (alongSign * topWidth) / 2,
      0,
      stageY,
    );
    addAxisBox(
      builder,
      front,
      BERLINER_ENSEMBLE_TONES.signMetal,
      x,
      topY + 0.14,
      z,
      0.13,
      0.16,
      topDepth,
    );
    addAxisBox(
      builder,
      front,
      BERLINER_ENSEMBLE_TONES.signMetal,
      x,
      topY + stageHeight - 0.12,
      z,
      0.13,
      0.16,
      topDepth,
    );
  }
  for (const along of [
    -topWidth / 2,
    -topWidth / 6,
    topWidth / 6,
    topWidth / 2,
  ]) {
    for (const depth of [-topDepth / 2, topDepth / 2]) {
      const [x, , z] = axisPoint(bounds, front, along, depth, stageY);
      addAxisBox(
        builder,
        front,
        BERLINER_ENSEMBLE_TONES.signMetal,
        x,
        stageY,
        z,
        0.13,
        stageHeight,
        0.13,
      );
    }
  }
  return {
    baseAreaM2: baseWidth * baseDepth,
    baseFootprintWorld: baseCorners.map(([x, , z]) => [x, z] as const),
    centreX: bounds.centreX,
    centreZ: bounds.centreZ,
    stageTopY: topY + stageHeight,
  };
}

function createRoofSign(
  centreX: number,
  centreZ: number,
  rotationY: number,
  stageTopY: number,
): Group {
  const group = new Group();
  group.name = "Berliner Ensemble open roof sign";
  group.userData = {
    antiFlickerDecision:
      "one fixed-step 12 Hz desktop / 8 Hz touch phase drives the real slow rotation in all five modes; reduced-motion, hidden, underside, far and off-screen views freeze without transform accumulation",
    geometryStatus:
      "open metal/neon ring and two-line lettering, photo-bounded to 4.8 m and deliberately smaller than the removed seven-metre sign",
    presentationAnimated: true,
    realWorldRotates: true,
    rotationPeriodSeconds: BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS,
    schwellenraumAnimated: true,
    sourceUrl: "https://www.berliner-ensemble.de/magazin/berlin-leuchtet",
  };
  const radius = BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M / 2;
  const pivot = new Group();
  pivot.name = "Berliner Ensemble rotating roof-sign pivot";
  pivot.position.set(centreX, 0, centreZ);
  pivot.rotation.y = rotationY;
  pivot.userData = {
    [BERLINER_ENSEMBLE_ROOF_SIGN_PIVOT_MARKER]: true,
    baseRotationY: rotationY,
    centreWorld: [centreX, BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M, centreZ],
    rotationPeriodSeconds: BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS,
  };
  const dayMaterial = new MeshBasicMaterial({
    color: BERLINER_ENSEMBLE_TONES.signMetal,
    side: DoubleSide,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: 0x8d4b43,
    emissive: 0xd45548,
    emissiveIntensity: 0.78,
    side: DoubleSide,
  });
  const ring = new Mesh(new TorusGeometry(radius, 0.13, 8, 64), dayMaterial);
  ring.name = "Berliner Ensemble open circular roof-sign ring";
  ring.position.set(0, BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M, 0);
  ring.userData.dayMaterial = dayMaterial;
  ring.userData.nightMaterial = nightMaterial;
  pivot.add(ring);

  const supportHeight =
    BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M - stageTopY - radius * 0.68;
  for (const offset of [-radius * 0.48, radius * 0.48]) {
    const x = centreX + Math.cos(-rotationY) * offset;
    const z = centreZ + Math.sin(-rotationY) * offset;
    const supportDay = new MeshBasicMaterial({
      color: BERLINER_ENSEMBLE_TONES.signMetal,
    });
    const supportNight = new MeshStandardMaterial({
      color: BERLINER_ENSEMBLE_TONES.signMetal,
      roughness: 0.88,
    });
    const support = new Mesh(
      new BoxGeometry(0.14, supportHeight, 0.14),
      supportDay,
    );
    support.name = "Berliner Ensemble roof-sign support";
    support.position.set(x, stageTopY + supportHeight / 2, z);
    support.userData.dayMaterial = supportDay;
    support.userData.nightMaterial = supportNight;
    group.add(support);
  }

  for (const [text, y] of [
    ["BERLINER", BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M + 0.58],
    ["ENSEMBLE", BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M - 0.48],
  ] as const) {
    const texture = createLetteringTexture({
      bandHeightM: 0.72,
      bandWidthM: 3.9,
      capHeightM: 0.5,
      fieldColor: "rgba(0,0,0,0)",
      letterColor: "#dedbd2",
      text,
      texelsPerMetre: 180,
    });
    const textDay = new MeshBasicMaterial({
      alphaTest: 0.05,
      color: texture ? 0xffffff : 0xdedbd2,
      depthWrite: false,
      map: texture ?? null,
      side: DoubleSide,
      transparent: true,
    });
    const textNight = new MeshStandardMaterial({
      alphaTest: 0.05,
      color: texture ? 0xffffff : 0xf2e1c9,
      depthWrite: false,
      emissive: 0xf3d5ae,
      emissiveIntensity: 0.78,
      map: texture ?? null,
      side: DoubleSide,
      transparent: true,
    });
    const lettering = new Mesh(new PlaneGeometry(3.9, 0.72), textDay);
    lettering.name = `Berliner Ensemble roof-sign ${text} lettering`;
    lettering.position.set(0, y, 0.075);
    lettering.userData.dayMaterial = textDay;
    lettering.userData.nightMaterial = textNight;
    pivot.add(lettering);
  }
  group.add(pivot);
  return group;
}

export type BerlinerEnsembleRoofSignMotionDecision = {
  animate: boolean;
  environmentalMotion: boolean;
};

export type BerlinerEnsembleRoofSignMotionOptions = {
  enabled: boolean;
  fineDetailVisible: boolean;
  frameIntervalMs: number;
  hidden: boolean;
  lastFrameAt: number;
  onScreen: boolean;
  reducedMotion: boolean;
  timestamp: number;
  underside: boolean;
};

/**
 * Cadence gate shared by the smooth and block-native sign. It deliberately
 * carries no mode check: the owner asked for the real rotation in all five
 * modes, while visibility/accessibility remain the bounded stop conditions.
 */
export function berlinerEnsembleRoofSignMotionDecision(
  {
    enabled,
    fineDetailVisible,
    frameIntervalMs,
    hidden,
    lastFrameAt,
    onScreen,
    reducedMotion,
    timestamp,
    underside,
  }: BerlinerEnsembleRoofSignMotionOptions,
  output?: BerlinerEnsembleRoofSignMotionDecision,
): BerlinerEnsembleRoofSignMotionDecision {
  const animate =
    enabled &&
    fineDetailVisible &&
    !hidden &&
    onScreen &&
    !reducedMotion &&
    !underside &&
    timestamp - lastFrameAt + Number.EPSILON * 1_000 >= frameIntervalMs;
  const decision = output ?? { animate: false, environmentalMotion: false };
  decision.animate = animate;
  decision.environmentalMotion = animate;
  return decision;
}

export function isBerlinerEnsembleRoofSignTarget(object: Object3D): boolean {
  return (
    object.userData[BERLINER_ENSEMBLE_ROOF_SIGN_PIVOT_MARKER] === true ||
    object.userData[BERLINER_ENSEMBLE_ROOF_SIGN_INSTANCES_MARKER] === true
  );
}

/** Collect once at attachment time; the render loop never traverses the city. */
export function collectBerlinerEnsembleRoofSignTargets(
  root: Object3D,
): Object3D[] {
  const targets: Object3D[] = [];
  root.traverse((object) => {
    if (isBerlinerEnsembleRoofSignTarget(object)) targets.push(object);
  });
  return targets;
}

function effectivelyVisible(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

/** Cheap point-frustum test for the two cached sign targets. */
export function isBerlinerEnsembleRoofSignOnScreen(
  targets: readonly Object3D[],
  camera: Camera,
  scratch = new Vector3(),
): boolean {
  camera.updateMatrixWorld();
  for (const target of targets) {
    if (!effectivelyVisible(target)) continue;
    const centre = target.userData.centreWorld as
      readonly [number, number, number] | undefined;
    if (!centre) continue;
    scratch.fromArray(centre).project(camera);
    if (
      scratch.z >= -1 &&
      scratch.z <= 1 &&
      Math.abs(scratch.x) <= 1.08 &&
      Math.abs(scratch.y) <= 1.08
    ) {
      return true;
    }
  }
  return false;
}

type RoofSignInstanceSpec = {
  index: number;
  position: readonly [number, number, number];
  rotationY: number;
  size: readonly [number, number, number];
};

const roofSignUpdateMatrix = new Matrix4();
const roofSignUpdateScale = new Vector3();

/** Advance both presentations from one absolute phase; mode switches do not jump. */
export function updateBerlinerEnsembleRoofSign(
  targets: readonly Object3D[],
  elapsedSeconds: number,
): void {
  const phase =
    Math.max(0, elapsedSeconds) *
    BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_RADIANS_PER_SECOND;
  const matrix = roofSignUpdateMatrix;
  const scale = roofSignUpdateScale;
  for (const target of targets) {
    if (target.userData[BERLINER_ENSEMBLE_ROOF_SIGN_PIVOT_MARKER] === true) {
      const baseRotationY = Number(target.userData.baseRotationY);
      if (Number.isFinite(baseRotationY)) {
        target.rotation.y = baseRotationY + phase;
      }
      continue;
    }
    if (
      !(target instanceof InstancedMesh) ||
      target.userData[BERLINER_ENSEMBLE_ROOF_SIGN_INSTANCES_MARKER] !== true
    ) {
      continue;
    }
    const centre = target.userData.rotationCentreWorld as
      readonly [number, number] | undefined;
    const instances = target.userData.rotatingInstances as
      readonly RoofSignInstanceSpec[] | undefined;
    if (!centre || !instances) continue;
    const cosine = Math.cos(phase);
    const sine = Math.sin(phase);
    for (const instance of instances) {
      const dx = instance.position[0] - centre[0];
      const dz = instance.position[2] - centre[1];
      matrix.makeRotationY(instance.rotationY + phase);
      scale.fromArray(instance.size);
      matrix.scale(scale);
      matrix.setPosition(
        centre[0] + cosine * dx + sine * dz,
        instance.position[1],
        centre[1] - sine * dx + cosine * dz,
      );
      target.setMatrixAt(instance.index, matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Current, source-bound exterior recognition over the four untouched LoD2
 * shells. No mesh here owns collision or reconstructs a full building mass.
 */
export function createBerlinerEnsemble(prisms: PrismPayload): Group {
  const group = new Group();
  group.name = "Berliner Ensemble details";
  const byId = new Map(
    prisms.buildings.map((building) => [building.id, building]),
  );
  const main = byId.get(BERLINER_ENSEMBLE_MAIN_ID);
  const corner = byId.get(BERLINER_ENSEMBLE_CORNER_ID);
  const projection = byId.get(BERLINER_ENSEMBLE_SHOW_FACADE_ID);
  const returnPart = byId.get(BERLINER_ENSEMBLE_RETURN_ID);
  if (!main || !corner || !projection || !returnPart) {
    group.userData.geometryStatus = "required LoD2 parts missing";
    return group;
  }

  const builder = createBuilder();
  const facade = addMainShowFacade(builder, main, projection);
  const towerDetail = addTowerEntrance(builder, corner);
  const returnSkins = addReturnPart(builder, returnPart);
  const mainWall = wallOf(main, BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX);
  addDownpipe(builder, mainWall, 0.28, main.y0_dm / 10, 18.55);
  addDownpipe(
    builder,
    mainWall,
    mainWall.length - 0.28,
    main.y0_dm / 10,
    18.55,
  );
  const roof = addTowerRoofCap(builder, corner);
  // PlaneGeometry reads from its +Z face. Face the two-sided lettering toward
  // Bertolt-Brecht-Platz so its back face is never the public, mirrored view.
  const signRotationY = wallRotation(mainWall) + Math.PI;
  const details = finishDrawnGroup(builder, {
    lampEmissive: BERLINER_ENSEMBLE_TONES.nightGlass,
    lampEmissiveIntensity: 0.68,
    name: "Berliner Ensemble architectural details",
  });
  if (details) group.add(details);
  group.add(
    createRoofSign(roof.centreX, roof.centreZ, signRotationY, roof.stageTopY),
  );

  group.userData.architecturalProfile = BERLINER_ENSEMBLE_PROFILE;
  group.userData.detailCounts = {
    downpipes: 2,
    graniteColumns: towerDetail.graniteColumns,
    groundEntrances: 1,
    groundWindows: facade.groundWindows,
    lanterns: facade.lanterns,
    neutralPosters: facade.neutralPosters + towerDetail.neutralPosters,
    returnSkins,
    sourcePrisms: BERLINER_ENSEMBLE_IDS.size,
    upperWindows: facade.upperWindows,
    ventOpenings: facade.vents,
  };
  group.userData.geometryStatus = BERLINER_ENSEMBLE_PROFILE.geometryStatus;
  group.userData.hasOpaqueEnvelope = false;
  group.userData.facadeSurfaceProjectionM =
    BERLINER_ENSEMBLE_FACADE_SURFACE_PROJECTION_M;
  group.userData.maxFacadeProjectionM =
    BERLINER_ENSEMBLE_MAX_FACADE_DETAIL_PROJECTION_M;
  group.userData.replacesLoD2 = false;
  group.userData.sourcePrismIds = [...BERLINER_ENSEMBLE_IDS];
  group.userData.visualReferences = BERLINER_ENSEMBLE_PROFILE.visualReferences;
  group.userData.wallBindings = {
    main: {
      exposedEndWidthsM: facade.endWidthsM,
      sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
      wallIndex: BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
    },
    projection: {
      internalWallIndex: BERLINER_ENSEMBLE_PROJECTING_INTERNAL_WALL_INDEX,
      returnWallIndices: BERLINER_ENSEMBLE_PROJECTING_RETURN_WALL_INDICES,
      sourcePrismId: BERLINER_ENSEMBLE_SHOW_FACADE_ID,
      wallIndices: BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES,
    },
    tower: {
      sourcePrismId: BERLINER_ENSEMBLE_CORNER_ID,
      wallIndex: BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX,
    },
  };
  group.userData.roofSignBinding = {
    rotationY: signRotationY,
    sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
    wallIndex: BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
  };
  group.userData.roofTowerBinding = {
    anchorWorldM: [roof.centreX, roof.centreZ],
    baseAreaM2: roof.baseAreaM2,
    baseFootprintWorld: roof.baseFootprintWorld,
    containmentFramePrismId: BERLINER_ENSEMBLE_CORNER_ID,
    containmentFrameWallIndex: BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX,
    footprintSourcePrismIds:
      BERLINER_ENSEMBLE_PROFILE.roofTower.footprintSourcePrismIds,
    sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
  };
  return group;
}
