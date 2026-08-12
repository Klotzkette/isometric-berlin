import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { FocusCamera } from "./ArchitecturalLandmarks";
import { createLetteringTexture } from "./drawnLettering";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  addCone,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

export type CentralCivicLandmark = {
  name: string;
  world: [number, number, number];
};

const FOCUS: Record<string, Omit<FocusCamera, "target_world">> = {
  "Abgeordnetenhaus von Berlin": {
    azimuth_degrees: 28,
    distance_m: 142,
    polar_degrees: 59,
    target_height_m: 13,
  },
  "Bahnhof Berlin Friedrichstraße": {
    azimuth_degrees: -138,
    distance_m: 224,
    polar_degrees: 64,
    target_height_m: 14,
  },
  "Berliner Ensemble": {
    azimuth_degrees: 24,
    distance_m: 146,
    polar_degrees: 58,
    target_height_m: 17,
  },
  "Bundesministerium der Finanzen / Detlev-Rohwedder-Haus": {
    azimuth_degrees: -68,
    distance_m: 224,
    polar_degrees: 58,
    target_height_m: 17,
  },
  Futurium: {
    azimuth_degrees: 22,
    distance_m: 168,
    polar_degrees: 56,
    target_height_m: 14,
  },
  "Gropius Bau": {
    azimuth_degrees: 18,
    distance_m: 178,
    polar_degrees: 59,
    target_height_m: 14,
  },
  "Parlament der Bäume gegen Krieg und Gewalt": {
    azimuth_degrees: 20,
    distance_m: 124,
    polar_degrees: 48,
    target_height_m: 5,
  },
  "S15-Station Berlin Hauptbahnhof": {
    azimuth_degrees: -25,
    distance_m: 148,
    polar_degrees: 52,
    target_height_m: 5,
  },
  "Topographie des Terrors": {
    azimuth_degrees: 20,
    distance_m: 164,
    polar_degrees: 51,
    target_height_m: 6,
  },
  "Tramhaltestelle S+U Hauptbahnhof": {
    azimuth_degrees: -30,
    distance_m: 176,
    polar_degrees: 56,
    target_height_m: 6,
  },
};

export function centralCivicFocusCamera(
  landmark: CentralCivicLandmark,
): FocusCamera | null {
  const preset = FOCUS[landmark.name];
  if (!preset) return null;
  const targetWorld: [number, number, number] =
    landmark.name === "Berliner Ensemble"
      ? [landmark.world[0] + 24, landmark.world[1], landmark.world[2] + 13]
      : landmark.name === "Bahnhof Berlin Friedrichstraße"
        ? [
            landmark.world[0] + 2.4,
            landmark.world[1],
            landmark.world[2] - 12.2,
          ]
      : landmark.world;
  return { ...preset, target_world: targetWorld };
}

export function centralCivicDetailsVisible(underside: boolean): boolean {
  return !underside;
}

const IVORY = 0xf0ede4;
const LIMESTONE = 0xd8d0bf;
const SANDSTONE = 0xc9b897;
const BRICK = 0xaa624d;
const DARK_BRICK = 0x75463c;
const GLASS = 0x8ec5d0;
const DARK_GLASS = 0x29434a;
const INK = 0x30383a;
const STEEL = 0x778183;
const BVG_YELLOW = 0xf4cf18;
const SIGNAL_RED = 0xd94b3e;
const TRANSIT_BLUE = 0x2878b9;
const GARDEN_GREEN = 0x5e9b66;
const FOLIAGE = 0x4f8a58;
const LIGHT_GREEN = 0x95bd75;
const TAXI_IVORY = 0xe9dfbd;
const WALL_CONCRETE = 0xa8a69e;
const WALL_CONCRETE_DARK = 0x87877f;
const WALL_PIPE = 0x9a9992;
const WALL_FENCE = 0x555d5e;
const KITA_BLUE = 0x3f78a8;
const KITA_RED = 0xd65342;
const KITA_YELLOW = 0xf0c73b;

/**
 * Berlin LoD2 envelope and Landesdenkmalamt profile for Bahnhof
 * Friedrichstraße. The model stays on the surveyed station anchor and uses
 * the documented broad Stadtbahn curve instead of a generic straight shed.
 */
export const FRIEDRICHSTRASSE_STATION_LENGTH_M = 169;
export const FRIEDRICHSTRASSE_STATION_WIDTH_M = 60;
export const FRIEDRICHSTRASSE_STATION_HEIGHT_M = 27.928;
export const FRIEDRICHSTRASSE_STATION_ROTATION_RAD = -0.31;
export const FRIEDRICHSTRASSE_STATION_PLATFORM_COUNT = 3;
export const FRIEDRICHSTRASSE_STATION_TRACK_COUNT = 6;
export const FRIEDRICHSTRASSE_STATION_SOURCE =
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080415";

const FRIEDRICHSTRASSE_HALF_LENGTH_M =
  FRIEDRICHSTRASSE_STATION_LENGTH_M / 2;
const FRIEDRICHSTRASSE_HALF_WIDTH_M =
  FRIEDRICHSTRASSE_STATION_WIDTH_M / 2;
const FRIEDRICHSTRASSE_CURVE_CENTRE_Z_M = -10;
const FRIEDRICHSTRASSE_CURVE_SAG_M = 6;
const FRIEDRICHSTRASSE_PLATFORM_Y_M = 10.8;
const FRIEDRICHSTRASSE_EAVES_Y_M = 18.2;
const FRIEDRICHSTRASSE_STATION_GLASS = 0x45656a;
const FRIEDRICHSTRASSE_ROOF_RISE_M =
  FRIEDRICHSTRASSE_STATION_HEIGHT_M - FRIEDRICHSTRASSE_EAVES_Y_M;

export const CUBE_BERLIN_FOOTPRINT_WORLD = [
  [-167.14, -533.37],
  [-151.44, -494.12],
  [-111.77, -509.91],
  [-127.47, -549.16],
] as const;
export const CUBE_BERLIN_HEIGHT_M = 43.6;
export const CUBE_BERLIN_PRISM_IDS = [
  "FD4M9wox",
  "VoiEX357",
  "lXwHgFCt",
  "MwfoOvua",
] as const;
export const CUBE_BERLIN_FACADE_PROFILE = {
  facadeCount: 4,
  foldFacetCount: 16,
  glassElementTypes: 12,
  nightWindowCount: 28,
  officialCubeSideM: 42.5,
  panelColumnsPerFacade: 22,
  roofTenantSign: "GLEISS LUTZ",
  storeyBands: 10,
  sourceUrl: "https://3xn.com/project/cube-berlin",
} as const;
export const TEAR_PALACE_FOOTPRINT_WORLD = [
  [1048.21, -183.39],
  [1050.44, -187.52],
  [1049.32, -188.34],
  [1063.04, -213.1],
  [1072.14, -210.04],
  [1073.54, -212.54],
  [1079.71, -208.2],
  [1077.7, -206.02],
  [1083.41, -198.58],
  [1064.82, -177.35],
  [1063.82, -178.14],
  [1060.67, -174.51],
] as const;
export const TEAR_PALACE_PRISM_IDS = [
  "U4ubriIq",
  "3z4aOJds",
  "92ZtVVpI",
] as const;
export const PARISER_PLATZ_GARDENS = [
  { centre: [500.7, 334.1], size: [74.3, 22.6] },
  { centre: [494.2, 254.9], size: [75, 23] },
] as const;
export const BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD = [
  576.06, 4.8, 286.37,
] as const;

/** Berlin LoD2 building DEBE00YY20g0005J, in project-world metres. */
export const FUTURIUM_BUILDING_ID = "20g0005J";
export const FUTURIUM_BASE_Y_M = 5.4;
export const FUTURIUM_HEIGHT_M = 19.9;
export const FUTURIUM_FOOTPRINT_WORLD = [
  [181.0, -531.7],
  [182.3, -599.8],
  [214.2, -607.0],
  [252.7, -575.7],
  [208.1, -520.9],
] as const;
export const FUTURIUM_DREHMOMENT_WORLD = [196.184, -505.856] as const;
const FUTURIUM_CENTRE_WORLD = [209.2, -566.6] as const;
const FUTURIUM_SILVER = 0xdde2df;
const FUTURIUM_SILVER_ALT = 0xcbd2d0;
const FUTURIUM_SOLAR = 0x315d69;

/** OSM way 30349234 / Berlin LoD2 centroid, in project-world metres. */
export const BUNDESTAG_KITA_WORLD = [255.8, 5.245, -250.4] as const;
export const BUNDESTAG_KITA_SOURCE =
  "https://www.bundestag.de/besuche/architektur/gebaeude/kindertagesstaette/kindertagesstaette-198806";

export const TOPOGRAPHY_WALL_LENGTH_M = 200;
export const TOPOGRAPHY_WALL_SECTION_COUNT = 20;
export const TOPOGRAPHY_WALL_ROTATION_RAD = 0.0742;

function anchor(
  byName: Map<string, CentralCivicLandmark>,
  name: string,
): Vector3 | null {
  const landmark = byName.get(name);
  return landmark ? new Vector3(...landmark.world) : null;
}

function localPoint(
  point: Vector3,
  x: number,
  z: number,
  rotationY: number,
): { x: number; z: number } {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return {
    x: point.x + x * cosine + z * sine,
    z: point.z - x * sine + z * cosine,
  };
}

function localBox(
  builder: Builder,
  color: number,
  point: Vector3,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY: number,
  inked = true,
): void {
  const local = localPoint(point, x, z, rotationY);
  addBox(
    builder,
    color,
    local.x,
    point.y + y,
    local.z,
    sx,
    sy,
    sz,
    rotationY,
    inked,
  );
}

function localLampBox(
  builder: Builder,
  color: number,
  point: Vector3,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY: number,
): void {
  const local = localPoint(point, x, z, rotationY);
  const geometry = new BoxGeometry(sx, sy, sz);
  geometry.rotateY(rotationY);
  geometry.translate(local.x, point.y + y, local.z);
  paintGeometry(geometry, color);
  builder.lamps.push(geometry);
}

function localWheel(
  builder: Builder,
  point: Vector3,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number,
  rotationY: number,
): void {
  const local = localPoint(point, x, z, rotationY);
  const geometry = new CylinderGeometry(radius, radius, width, 12);
  geometry.applyQuaternion(
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2),
  );
  geometry.rotateY(rotationY);
  geometry.translate(local.x, point.y + y, local.z);
  paintGeometry(geometry, INK);
  builder.parts.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );

  const hub = new CylinderGeometry(radius * 0.42, radius * 0.42, width + 0.03, 12);
  hub.rotateX(Math.PI / 2);
  hub.rotateY(rotationY);
  hub.translate(local.x, point.y + y, local.z);
  paintGeometry(hub, STEEL);
  builder.parts.push(hub);
}

type FootprintPoint = readonly [number, number];

function scaledFootprint(
  ring: readonly FootprintPoint[],
  scale: number,
): [number, number][] {
  return ring.map(([x, z]) => [
    FUTURIUM_CENTRE_WORLD[0] + (x - FUTURIUM_CENTRE_WORLD[0]) * scale,
    FUTURIUM_CENTRE_WORLD[1] + (z - FUTURIUM_CENTRE_WORLD[1]) * scale,
  ]);
}

function addExtrudedFootprint(
  builder: Builder,
  color: number,
  ring: readonly FootprintPoint[],
  y0: number,
  height: number,
  inked = true,
): void {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  const rawGeometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: height,
  });
  rawGeometry.rotateX(-Math.PI / 2);
  rawGeometry.translate(0, y0, 0);
  rawGeometry.deleteAttribute("uv");
  const geometry = mergeVertices(rawGeometry);
  rawGeometry.dispose();
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function scaledRing(
  ring: readonly FootprintPoint[],
  scale: number,
): [number, number][] {
  const centreX = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
  const centreZ = ring.reduce((sum, [, z]) => sum + z, 0) / ring.length;
  return ring.map(([x, z]) => [
    centreX + (x - centreX) * scale,
    centreZ + (z - centreZ) * scale,
  ]);
}

function addTriangle(
  builder: Builder,
  color: number,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): void {
  // Both windings keep the ultra-thin outer-skin facets visible from every
  // camera angle without creating a coplanar box that can shimmer.
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  geometry.computeVertexNormals();
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
}

function addFacadePanel(
  builder: Builder,
  color: number,
  start: FootprintPoint,
  end: FootprintPoint,
  along: number,
  y: number,
  width: number,
  height: number,
): void {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const tx = dx / length;
  const tz = dz / length;
  // The LoD2 ring is counter-clockwise; its right-hand normal faces out.
  const nx = tz;
  const nz = -tx;
  const geometry = new BoxGeometry(width, height, 0.12);
  geometry.rotateY(-Math.atan2(tz, tx));
  geometry.translate(
    start[0] + tx * along + nx * 0.12,
    y,
    start[1] + tz * along + nz * 0.12,
  );
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
}

function addFuturiumFacade(
  builder: Builder,
  ring: readonly FootprintPoint[],
): void {
  const facadeBottom = 10.6;
  const facadeTop = FUTURIUM_BASE_Y_M + FUTURIUM_HEIGHT_M - 0.45;
  const rowPitch = 1.72;
  const rows = Math.floor((facadeTop - facadeBottom) / rowPitch);
  for (let edgeIndex = 0; edgeIndex < ring.length; edgeIndex += 1) {
    const start = ring[edgeIndex];
    const end = ring[(edgeIndex + 1) % ring.length];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const columnPitch = 1.82;
    const columns = Math.max(1, Math.floor(length / columnPitch));
    const actualPitch = length / columns;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        addFacadePanel(
          builder,
          (row + column + edgeIndex) % 3 === 0
            ? FUTURIUM_SILVER_ALT
            : FUTURIUM_SILVER,
          start,
          end,
          actualPitch * (column + 0.5),
          facadeBottom + rowPitch * (row + 0.5),
          actualPitch - 0.13,
          rowPitch - 0.13,
        );
      }
    }
  }
}

function addFuturiumPanorama(
  builder: Builder,
  start: FootprintPoint,
  end: FootprintPoint,
  width: number,
  height: number,
): void {
  const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const centre = edgeLength / 2;
  addFacadePanel(
    builder,
    DARK_GLASS,
    start,
    end,
    centre,
    FUTURIUM_BASE_Y_M + 8.2,
    width,
    height,
  );
  const mullionCount = 14;
  for (let index = 0; index <= mullionCount; index += 1) {
    addFacadePanel(
      builder,
      STEEL,
      start,
      end,
      centre - width / 2 + (index / mullionCount) * width,
      FUTURIUM_BASE_Y_M + 8.2,
      0.09,
      height + 0.08,
    );
  }
}

function addFacadeGrid(
  builder: Builder,
  point: Vector3,
  options: {
    bays: number;
    baySpacing: number;
    color?: number;
    floors: number;
    floorSpacing: number;
    frontZ: number;
    rotationY: number;
    startY: number;
    width?: number;
  },
): void {
  const width = options.width ?? Math.min(2.8, options.baySpacing * 0.66);
  const startX = -((options.bays - 1) * options.baySpacing) / 2;
  for (let floor = 0; floor < options.floors; floor += 1) {
    for (let bay = 0; bay < options.bays; bay += 1) {
      localLampBox(
        builder,
        options.color ?? DARK_GLASS,
        point,
        startX + bay * options.baySpacing,
        options.startY + floor * options.floorSpacing,
        options.frontZ,
        width,
        Math.max(1.25, options.floorSpacing * 0.56),
        0.28,
        options.rotationY,
      );
    }
  }
}

function addTram(
  builder: Builder,
  point: Vector3,
  lateral: number,
  rotationY: number,
  reversed: boolean,
): void {
  const direction = reversed ? -1 : 1;
  const sectionOffsets = [-19, -9.5, 0, 9.5, 19];
  for (const offset of sectionOffsets) {
    localBox(
      builder,
      0xe0b90c,
      point,
      offset * direction,
      0.66,
      lateral,
      8.82,
      0.82,
      2.44,
      rotationY,
    );
    localBox(
      builder,
      BVG_YELLOW,
      point,
      offset * direction,
      1.55,
      lateral,
      8.7,
      2.7,
      2.38,
      rotationY,
    );
    for (const side of [-1, 1]) {
      localLampBox(
        builder,
        DARK_GLASS,
        point,
        offset * direction,
        2.25,
        lateral + side * 1.21,
        7.45,
        1.05,
        0.14,
        rotationY,
      );
      for (const door of [-2.7, 2.7]) {
        localBox(
          builder,
          0xc5a611,
          point,
          (offset + door) * direction,
          1.62,
          lateral + side * 1.225,
          0.12,
          2.15,
          0.08,
          rotationY,
          false,
        );
      }
    }
    // Keep the tram recognisably BVG-yellow from the viewer's usual high
    // isometric angle. A full-width grey roof previously hid almost the whole
    // livery and made the vehicle read as another platform canopy.
    localBox(
      builder,
      BVG_YELLOW,
      point,
      offset * direction,
      3.03,
      lateral,
      8.45,
      0.24,
      2.32,
      rotationY,
    );
    localBox(
      builder,
      STEEL,
      point,
      offset * direction,
      3.28,
      lateral,
      3,
      0.22,
      0.72,
      rotationY,
      false,
    );
  }
  for (const joint of [-14.25, -4.75, 4.75, 14.25]) {
    localBox(
      builder,
      0x41484a,
      point,
      joint * direction,
      1.73,
      lateral,
      0.72,
      2.35,
      2.28,
      rotationY,
    );
  }
  for (const offset of [-17, -7, 7, 17]) {
    localBox(
      builder,
      INK,
      point,
      offset * direction,
      0.42,
      lateral,
      2.4,
      0.65,
      2.48,
      rotationY,
      false,
    );
    for (const side of [-1, 1]) {
      localWheel(
        builder,
        point,
        offset * direction,
        0.72,
        lateral + side * 1.2,
        0.48,
        0.18,
        rotationY,
      );
    }
  }
  for (const end of [-23.72, 23.72]) {
    localLampBox(
      builder,
      DARK_GLASS,
      point,
      end * direction,
      2.22,
      lateral,
      0.12,
      1.08,
      1.72,
      rotationY,
    );
  }
  for (const end of [-24, 24]) {
    localLampBox(
      builder,
      reversed ? SIGNAL_RED : 0xf8f3ce,
      point,
      end * direction,
      1.25,
      lateral,
      0.2,
      0.52,
      1.2,
      rotationY,
    );
  }
  localBox(builder, INK, point, 0, 4.35, lateral, 8, 0.18, 0.18, rotationY);
  localBox(
    builder,
    INK,
    point,
    0,
    3.75,
    lateral,
    0.18,
    1.25,
    0.18,
    rotationY + 0.55,
  );
}

function addHauptbahnhofTransit(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const tram = anchor(byName, "Tramhaltestelle S+U Hauptbahnhof");
  if (tram) {
    const rotation = -0.43;
    localBox(builder, LIMESTONE, tram, 0, 0.18, 0, 64, 0.28, 7.2, rotation);
    for (const x of [-25, -15, -5, 5, 15, 25]) {
      localBox(builder, STEEL, tram, x, 2.1, 0, 0.22, 4, 0.22, rotation);
    }
    localBox(builder, GLASS, tram, 0, 4.25, 0, 57, 0.24, 5.4, rotation);
    addTram(builder, tram, 5, rotation, false);
    // The opposite track stays clear, which makes the one requested yellow
    // Flexity and the paired platforms legible instead of forming a yellow
    // wall across Europaplatz.
  }

  const station = anchor(byName, "S15-Station Berlin Hauptbahnhof");
  if (station) {
    const rotation = -0.43;
    localBox(builder, GLASS, station, 0, 2.35, -13, 15, 4.2, 7.5, rotation);
    localBox(builder, STEEL, station, 0, 4.7, -13, 17, 0.32, 9, rotation);
    localBox(
      builder,
      TRANSIT_BLUE,
      station,
      -8.5,
      3.9,
      -13,
      2.5,
      2.5,
      0.3,
      rotation,
    );
    localBox(
      builder,
      IVORY,
      station,
      -8.5,
      3.9,
      -13.18,
      1.15,
      1.15,
      0.12,
      rotation,
    );
    for (let step = 0; step < 7; step += 1) {
      localBox(
        builder,
        STEEL,
        station,
        2.8 + step * 0.75,
        0.25 - step * 0.22,
        -13,
        0.7,
        0.22,
        4.2,
        rotation,
        false,
      );
    }
  }
}

function addOggiAndTaxis(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const oggi = anchor(byName, "Oggi's Gemüsekebab");
  if (oggi) {
    localBox(builder, IVORY, oggi, 0, 1.65, 0, 8.5, 3.1, 4.2, -0.42);
    localBox(builder, GARDEN_GREEN, oggi, 0, 3.42, 0, 9.1, 0.42, 4.6, -0.42);
    localLampBox(
      builder,
      0xf1eee4,
      oggi,
      0,
      2.25,
      -2.15,
      6.9,
      0.9,
      0.18,
      -0.42,
    );
  }
  const taxis = anchor(byName, "Taxistand Washingtonplatz");
  if (!taxis) return;
  const rotation = -0.34;
  for (let index = 0; index < 5; index += 1) {
    const x = (index - 2) * 6.2;
    const z = index % 2 === 0 ? 0 : 0.12;
    localBox(builder, TAXI_IVORY, taxis, x, 0.67, z, 4.9, 0.94, 1.86, rotation);
    localBox(builder, TAXI_IVORY, taxis, x - 1.78, 1.05, z, 1.35, 0.38, 1.8, rotation);
    localBox(builder, TAXI_IVORY, taxis, x + 1.82, 0.98, z, 1.15, 0.3, 1.8, rotation);
    localBox(
      builder,
      DARK_GLASS,
      taxis,
      x - 0.15,
      1.43,
      z,
      2.45,
      0.92,
      1.58,
      rotation,
    );
    localBox(
      builder,
      TAXI_IVORY,
      taxis,
      x - 0.15,
      1.92,
      z,
      2.18,
      0.12,
      1.48,
      rotation,
    );
    localLampBox(
      builder,
      0xf2c925,
      taxis,
      x - 0.15,
      2.09,
      z,
      0.72,
      0.24,
      0.28,
      rotation,
    );
    for (const wheelX of [-1.52, 1.48]) {
      for (const side of [-1, 1]) {
        localWheel(
          builder,
          taxis,
          x + wheelX,
          0.5,
          z + side * 0.93,
          0.39,
          0.15,
          rotation,
        );
      }
    }
    localLampBox(
      builder,
      0xf8edc4,
      taxis,
      x - 2.42,
      0.72,
      z,
      0.12,
      0.34,
      1.2,
      rotation,
    );
    localLampBox(
      builder,
      SIGNAL_RED,
      taxis,
      x + 2.42,
      0.72,
      z,
      0.12,
      0.3,
      1.15,
      rotation,
    );
  }
  // Berlin taxi-rank sign: blue field on a slender steel pole.
  localBox(builder, STEEL, taxis, -15.1, 1.65, -2.4, 0.12, 3.3, 0.12, rotation);
  localBox(
    builder,
    TRANSIT_BLUE,
    taxis,
    -15.1,
    3.35,
    -2.4,
    0.86,
    0.72,
    0.12,
    rotation,
  );
}

function addFuturium(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  if (!anchor(byName, "Futurium")) return;

  // The old recognition object was a 70 x 84 m box turned almost north-
  // south. The Berlin LoD2 polygon is an irregular 4,034 m² pentagon whose
  // long axis runs about 51 degrees. Build from that polygon so the public
  // forecourts, railway edge and neighbouring Cube no longer overlap it.
  const footprint = FUTURIUM_FOOTPRINT_WORLD;
  const lowerGlass = scaledFootprint(footprint, 0.9);
  addExtrudedFootprint(builder, DARK_GLASS, lowerGlass, FUTURIUM_BASE_Y_M, 5.4);
  addExtrudedFootprint(
    builder,
    DARK_GLASS,
    footprint,
    FUTURIUM_BASE_Y_M + 5.2,
    FUTURIUM_HEIGHT_M - 5.2,
  );
  addFuturiumFacade(builder, footprint);

  // Futurium publishes two 28 m panoramic openings: 11 m high to the
  // railway/north and 8 m high to the Spree/south.
  addFuturiumPanorama(builder, footprint[1], footprint[2], 28, 11);
  addFuturiumPanorama(builder, footprint[4], footprint[0], 28, 8);

  const addEntranceCanopy = (
    start: FootprintPoint,
    end: FootprintPoint,
    depth: number,
  ): void => {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const tx = dx / length;
    const tz = dz / length;
    const nx = tz;
    const nz = -tx;
    addBox(
      builder,
      FUTURIUM_SILVER,
      (start[0] + end[0]) / 2 + nx * (depth / 2 - 0.4),
      FUTURIUM_BASE_Y_M + 13.5,
      (start[1] + end[1]) / 2 + nz * (depth / 2 - 0.4),
      30,
      0.72,
      depth,
      -Math.atan2(tz, tx),
    );
  };
  addEntranceCanopy(footprint[1], footprint[2], 13.5);
  addEntranceCanopy(footprint[4], footprint[0], 13.5);

  // A pale roof basin, perimeter Skywalk and two restrained photovoltaic
  // fields replace the former single oversized black roof plate.
  addExtrudedFootprint(
    builder,
    FUTURIUM_SILVER,
    scaledFootprint(footprint, 0.985),
    FUTURIUM_BASE_Y_M + FUTURIUM_HEIGHT_M - 0.18,
    0.24,
  );
  const roofCentre = new Vector3(
    FUTURIUM_CENTRE_WORLD[0],
    0,
    FUTURIUM_CENTRE_WORLD[1],
  );
  const roofRotation = 0.8876;
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -4; column <= 4; column += 1) {
      localBox(
        builder,
        (row + column) % 2 === 0 ? FUTURIUM_SOLAR : 0x386b78,
        roofCentre,
        column * 5.1,
        FUTURIUM_BASE_Y_M + FUTURIUM_HEIGHT_M + 0.2,
        row * 5.8,
        4.6,
        0.16,
        5.2,
        roofRotation,
        false,
      );
    }
  }
  for (let edgeIndex = 0; edgeIndex < footprint.length; edgeIndex += 1) {
    const start = footprint[edgeIndex];
    const end = footprint[(edgeIndex + 1) % footprint.length];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const rotation = -Math.atan2(dz, dx);
    addBox(
      builder,
      STEEL,
      (start[0] + end[0]) / 2,
      FUTURIUM_BASE_Y_M + FUTURIUM_HEIGHT_M + 0.65,
      (start[1] + end[1]) / 2,
      length,
      0.12,
      0.15,
      rotation,
      false,
    );
    const postCount = Math.max(2, Math.round(length / 2.8));
    for (let post = 0; post <= postCount; post += 1) {
      const t = post / postCount;
      addBox(
        builder,
        STEEL,
        start[0] + dx * t,
        FUTURIUM_BASE_Y_M + FUTURIUM_HEIGHT_M + 0.34,
        start[1] + dz * t,
        0.08,
        0.68,
        0.08,
        0,
        false,
      );
    }
  }

  // realities:united's Drehmoment is source-positioned in the south court,
  // 15 m tall and 4.3 m across. It is not a 15 m-wide vertical cylinder.
  const [drehmomentX, drehmomentZ] = FUTURIUM_DREHMOMENT_WORLD;
  addCylinder(
    builder,
    STEEL,
    drehmomentX,
    FUTURIUM_BASE_Y_M + 7.25,
    drehmomentZ,
    0.12,
    14.5,
    12,
  );
  const disc = new CylinderGeometry(2.15, 2.15, 0.28, 32);
  disc.rotateZ(Math.PI / 2 - 0.18);
  disc.rotateY(0.35);
  disc.translate(drehmomentX, FUTURIUM_BASE_Y_M + 12.65, drehmomentZ);
  paintGeometry(disc, STEEL);
  builder.parts.push(disc);
  builder.edges.push(
    new EdgesGeometry(disc, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );
}

function addGreenFederalCampus(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(
    byName,
    "Bundesministerium für Forschung, Technologie und Raumfahrt",
  );
  if (point) {
    localBox(builder, LIGHT_GREEN, point, 0, 0.22, 10, 76, 0.32, 44, 0.06);
    for (let bay = 0; bay < 13; bay += 1) {
      localLampBox(
        builder,
        GLASS,
        point,
        -36 + bay * 6,
        8.5,
        -23,
        4.4,
        9.8,
        0.25,
        0.06,
      );
    }
    for (let x = -30; x <= 30; x += 12) {
      addCylinder(
        builder,
        DARK_BRICK,
        point.x + x,
        point.y + 4.1,
        point.z + 14,
        0.45,
        8,
        8,
      );
      addCone(
        builder,
        FOLIAGE,
        point.x + x,
        point.y + 10.2,
        point.z + 14,
        3.4,
        6.2,
        10,
      );
    }
  }
  const education = anchor(
    byName,
    "Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend",
  );
  if (!education) return;
  for (let floor = 0; floor < 5; floor += 1) {
    localBox(
      builder,
      floor % 2 === 0 ? GARDEN_GREEN : GLASS,
      education,
      0,
      3.2 + floor * 4.3,
      -7,
      13,
      2.3,
      0.28,
      0.08,
    );
  }
}

function addParliamentOfTrees(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(byName, "Parlament der Bäume gegen Krieg und Gewalt");
  if (!point) return;
  localBox(builder, LIMESTONE, point, 0, 0.18, 0, 55, 0.28, 70, 0.03);
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      const x = column * 7.2 + (row % 2) * 1.6;
      const z = row * 11;
      addCylinder(
        builder,
        DARK_BRICK,
        point.x + x,
        point.y + 3.4,
        point.z + z,
        0.38,
        6.4,
        8,
      );
      addCone(
        builder,
        FOLIAGE,
        point.x + x,
        point.y + 8.6,
        point.z + z,
        2.5,
        5.2,
        10,
      );
    }
  }
  for (let index = 0; index < 8; index += 1) {
    localBox(
      builder,
      index % 3 === 0 ? DARK_BRICK : STEEL,
      point,
      -24.5 + index * 7,
      2.1 + (index % 2) * 0.5,
      31,
      5.2,
      3.6 + (index % 2),
      0.8,
      0.03,
    );
  }
}

function addBundestagKita(builder: Builder): void {
  const point = new Vector3(...BUNDESTAG_KITA_WORLD);
  const rotation = -0.12;
  // Peichl's low, ship-like 1998/99 building is already present in LoD2.
  // These restrained solids only recover its recognition cues at close zoom.
  localBox(builder, IVORY, point, 0, 2.65, 0, 72, 4.8, 17, rotation);
  localBox(builder, KITA_BLUE, point, -24, 2.8, 8.55, 18, 3.9, 0.3, rotation);
  localBox(builder, KITA_RED, point, 0, 2.8, 8.55, 18, 3.9, 0.3, rotation);
  localBox(builder, KITA_YELLOW, point, 24, 2.8, 8.55, 18, 3.9, 0.3, rotation);
  localBox(builder, STEEL, point, 0, 5.2, 0, 76, 0.34, 19, rotation);
  for (const along of [-17, 17]) {
    const position = localPoint(point, along, 0, rotation);
    addCylinder(
      builder,
      along < 0 ? KITA_RED : KITA_BLUE,
      position.x,
      point.y + 6.45,
      position.z,
      2.15,
      2.4,
      18,
    );
  }
  const figures = [KITA_RED, KITA_YELLOW, KITA_BLUE, GARDEN_GREEN];
  figures.forEach((color, index) => {
    const position = localPoint(point, -13.5 + index * 9, -2.7, rotation);
    addCylinder(
      builder,
      color,
      position.x,
      point.y + 7.2 + (index % 2) * 0.35,
      position.z,
      0.58,
      3.5,
      8,
    );
    addCone(
      builder,
      color,
      position.x,
      point.y + 9.55 + (index % 2) * 0.35,
      position.z,
      1.1,
      1.4,
      8,
    );
  });
}

function addPariserPlatzDetails(builder: Builder): void {
  const rotation = 0.087;
  const gardenBaseY = 4.84;
  const flowerPalette = [0x4f72af, 0xf1eee5, 0xb84946] as const;
  PARISER_PLATZ_GARDENS.forEach(({ centre, size }, gardenIndex) => {
    const point = new Vector3(centre[0], gardenBaseY, centre[1]);
    const [width, depth] = size;
    // The lawns and fountains already come from OSM. These raised strips are
    // the narrow flower borders and granite rims documented by Berlin's
    // Pariser-Platz plan, not a second ground surface.
    for (const side of [-1, 1]) {
      localBox(
        builder,
        LIMESTONE,
        point,
        0,
        0.15,
        side * (depth / 2 - 0.35),
        width,
        0.3,
        0.7,
        rotation,
        false,
      );
      localBox(
        builder,
        LIMESTONE,
        point,
        side * (width / 2 - 0.35),
        0.15,
        0,
        0.7,
        0.3,
        depth,
        rotation,
        false,
      );
    }
    for (let index = 0; index < 18; index += 1) {
      const along = -width / 2 + 3 + (index / 17) * (width - 6);
      for (const side of [-1, 1]) {
        const flower = localPoint(
          point,
          along,
          side * (depth / 2 - 1.05),
          rotation,
        );
        addCylinder(
          builder,
          flowerPalette[(index + gardenIndex) % flowerPalette.length],
          flower.x,
          gardenBaseY + 0.32,
          flower.z,
          0.26,
          0.36,
          7,
        );
      }
    }
    for (const x of [-width / 2 + 3.1, width / 2 - 3.1]) {
      for (const z of [-depth / 2 + 3.1, depth / 2 - 3.1]) {
        const topiary = localPoint(point, x, z, rotation);
        addCylinder(
          builder,
          FOLIAGE,
          topiary.x,
          gardenBaseY + 1.15,
          topiary.z,
          1.45,
          2.1,
          14,
        );
      }
    }
    addCylinder(
      builder,
      LIMESTONE,
      centre[0],
      gardenBaseY + 0.12,
      centre[1],
      5.55,
      0.24,
      28,
    );
    addCylinder(
      builder,
      0x7fb8c5,
      centre[0],
      gardenBaseY + 0.26,
      centre[1],
      4.95,
      0.12,
      28,
    );
  });

  // Low black bollards separate the pedestrian square from the vehicle
  // approaches. Their 2.35 m rhythm comes from the mapped street edge.
  for (const z of [247, 259, 323, 335]) {
    for (let x = 438; x <= 548; x += 9.2) {
      addCylinder(builder, INK, x, 5.35, z, 0.14, 1.1, 10);
    }
  }

  const entrance = new Vector3(...BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD);
  const entranceRotation = 0.087;
  localBox(
    builder,
    DARK_GLASS,
    entrance,
    0,
    0.08,
    0,
    10.4,
    0.16,
    5.4,
    entranceRotation,
  );
  for (let step = 0; step < 7; step += 1) {
    localBox(
      builder,
      STEEL,
      entrance,
      0,
      0.18 + step * 0.11,
      -1.9 + step * 0.52,
      8.2,
      0.18,
      0.48,
      entranceRotation,
      false,
    );
  }
  for (const side of [-1, 1]) {
    localBox(
      builder,
      GLASS,
      entrance,
      side * 4.45,
      1.2,
      0,
      0.18,
      2.2,
      5.4,
      entranceRotation,
    );
  }
  const pylon = localPoint(entrance, 6.5, -1.8, entranceRotation);
  addCylinder(builder, STEEL, pylon.x, 6.7, pylon.z, 0.1, 3.8, 10);
  addBox(builder, TRANSIT_BLUE, pylon.x, 8.7, pylon.z, 1.55, 1.55, 0.18);
}

function addPariserPlatzEmbassies(builder: Builder): void {
  // US Embassy, Moore Ruble Yudell (OSM way 195257482): the north facade
  // facing the square is a restrained limestone screen with deep windows.
  const us = new Vector3(459.5, 4.9, 409.8);
  const usRotation = 0.087;
  for (let bay = 0; bay < 11; bay += 1) {
    const x = -27.5 + bay * 5.5;
    localBox(
      builder,
      LIMESTONE,
      us,
      x,
      11,
      -52.95,
      0.52,
      20.5,
      0.55,
      usRotation,
    );
    for (let floor = 0; floor < 4; floor += 1) {
      localLampBox(
        builder,
        DARK_GLASS,
        us,
        x + 2.4,
        4.1 + floor * 4.55,
        -52.82,
        3.65,
        2.35,
        0.3,
        usRotation,
      );
    }
  }
  localBox(builder, 0x4b5556, us, 0, 4.2, -53.15, 7.2, 7.2, 0.48, usRotation);

  // French Embassy, Christian de Portzamparc: a pale, horizontally layered
  // Pariser-Platz facade with a deeper central entrance bay.
  const france = new Vector3(539.7, 4.7, 201.3);
  const franceRotation = 0.087;
  for (let floor = 0; floor < 4; floor += 1) {
    for (let bay = 0; bay < 13; bay += 1) {
      localLampBox(
        builder,
        floor === 0 ? DARK_GLASS : 0x6f8588,
        france,
        -29.4 + bay * 4.9,
        4.1 + floor * 4.45,
        29.95,
        2.85,
        2.35,
        0.3,
        franceRotation,
      );
    }
  }
  for (let bay = 0; bay <= 13; bay += 1) {
    localBox(
      builder,
      SANDSTONE,
      france,
      -31.85 + bay * 4.9,
      11,
      30.2,
      0.34,
      21,
      0.42,
      franceRotation,
      false,
    );
  }
  localBox(
    builder,
    DARK_GLASS,
    france,
    0,
    4.3,
    30.25,
    8.6,
    7.6,
    0.44,
    franceRotation,
  );
}

function addCubeBerlin(builder: Builder): void {
  const baseY = 5.4;
  addExtrudedFootprint(
    builder,
    0xbcd3d5,
    CUBE_BERLIN_FOOTPRINT_WORLD,
    baseY,
    CUBE_BERLIN_HEIGHT_M,
  );
  addExtrudedFootprint(
    builder,
    0x617a7f,
    scaledRing(CUBE_BERLIN_FOOTPRINT_WORLD, 1.008),
    baseY + CUBE_BERLIN_HEIGHT_M,
    0.34,
  );
  const ring = CUBE_BERLIN_FOOTPRINT_WORLD;
  const signedArea = ring.reduce((sum, [x0, z0], index) => {
    const [x1, z1] = ring[(index + 1) % ring.length];
    return sum + x0 * z1 - x1 * z0;
  }, 0);
  for (let edge = 0; edge < ring.length; edge += 1) {
    const [x0, z0] = ring[edge];
    const [x1, z1] = ring[(edge + 1) % ring.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const nx = (signedArea > 0 ? dz : -dz) / length;
    const nz = (signedArea > 0 ? -dx : dx) / length;
    const rotationY = -Math.atan2(dz / length, dx / length);
    const edgePoint = new Vector3(x0, baseY, z0);

    // The real outer skin reads first as a calm glazed grid. The old model
    // split every cell diagonally, producing a noisy checkerboard instead of
    // 3XN's large folded relief. These slim, physically separated mullions
    // preserve the curtain-wall scale without coplanar shimmer.
    for (
      let column = 1;
      column < CUBE_BERLIN_FACADE_PROFILE.panelColumnsPerFacade;
      column += 1
    ) {
      localBox(
        builder,
        0x78949a,
        edgePoint,
        (length * column) / CUBE_BERLIN_FACADE_PROFILE.panelColumnsPerFacade,
        CUBE_BERLIN_HEIGHT_M / 2,
        0.13,
        0.045,
        CUBE_BERLIN_HEIGHT_M - 0.65,
        0.1,
        rotationY,
        false,
      );
    }
    for (
      let storey = 1;
      storey < CUBE_BERLIN_FACADE_PROFILE.storeyBands;
      storey += 1
    ) {
      localBox(
        builder,
        0x829ba0,
        edgePoint,
        length / 2,
        (CUBE_BERLIN_HEIGHT_M * storey) /
          CUBE_BERLIN_FACADE_PROFILE.storeyBands,
        0.13,
        length - 0.18,
        0.055,
        0.1,
        rotationY,
        false,
      );
    }

    localBox(
      builder,
      0x567078,
      edgePoint,
      length / 2,
      2.1,
      0.18,
      length - 0.35,
      3.75,
      0.12,
      rotationY,
      false,
    );

    const facadePoint = (
      u: number,
      v: number,
      outset = 0.24,
    ): readonly [number, number, number] => [
      x0 + dx * u + nx * outset,
      baseY + 0.45 + v * (CUBE_BERLIN_HEIGHT_M - 0.9),
      z0 + dz * u + nz * outset,
    ];
    const mirror = edge % 2 === 1;
    const u = (value: number): number => (mirror ? 1 - value : value);
    const foldPattern: Array<{
      color: number;
      points: [[number, number], [number, number], [number, number]];
    }> = [
      {
        color: edge % 2 === 0 ? 0x3f5960 : 0x526d73,
        points: [
          [u(0.02), 0.86],
          [u(0.52), 1],
          [u(0.47), 0.74],
        ],
      },
      {
        color: 0x4b666d,
        points: [
          [u(0.39), 0.68],
          [u(0.98), 0.5],
          [u(0.53), 0.45],
        ],
      },
      {
        color: 0x66858b,
        points: [
          [u(0.39), 0.68],
          [u(0.53), 0.45],
          [u(0.29), 0.3],
        ],
      },
      {
        color: edge % 2 === 0 ? 0xd7e5e3 : 0x8ca8ad,
        points: [
          [u(0.02), 0.04],
          [u(0.37), 0.3],
          [u(0.57), 0.04],
        ],
      },
    ];
    for (const facet of foldPattern) {
      addTriangle(
        builder,
        facet.color,
        facadePoint(...facet.points[0]),
        facadePoint(...facet.points[1]),
        facadePoint(...facet.points[2]),
      );
    }

    const litWindows = [
      [0.14, 0.18],
      [0.72, 0.2],
      [0.31, 0.38],
      [0.84, 0.5],
      [0.18, 0.64],
      [0.65, 0.76],
      [0.43, 0.89],
    ] as const;
    for (const [along, vertical] of litWindows) {
      const geometry = new BoxGeometry(1.08, 1.05, 0.08);
      geometry.rotateY(rotationY);
      geometry.translate(
        x0 + dx * along + nx * 0.34,
        baseY + 1.1 + vertical * (CUBE_BERLIN_HEIGHT_M - 2.2),
        z0 + dz * along + nz * 0.34,
      );
      paintGeometry(geometry, 0xdce5d8);
      builder.lamps.push(geometry);
    }
  }
}

function addEconomicsMinistry(builder: Builder): void {
  // Restored Invalidenstraße front: long pale facade, red-tiled mansard,
  // and the rounded historic pavilion at its eastern end.
  const historic = new Vector3(255.5, 5.2, -1044.4);
  const rotation = 0.514;
  localBox(builder, SANDSTONE, historic, 0, 1.25, 0.4, 116, 2.5, 0.7, rotation);
  localBox(
    builder,
    LIMESTONE,
    historic,
    0,
    20.3,
    0.4,
    118,
    0.72,
    0.8,
    rotation,
  );
  addFacadeGrid(builder, historic, {
    bays: 19,
    baySpacing: 5.8,
    floors: 4,
    floorSpacing: 4.15,
    frontZ: 0.65,
    rotationY: rotation,
    startY: 4.2,
    width: 2.45,
  });
  for (const z of [-4.6, 4.6]) {
    localBox(
      builder,
      0xa8644d,
      historic,
      0,
      22.15,
      z,
      116,
      0.42,
      7.2,
      rotation,
      false,
    );
  }
  const rotunda = new Vector3(201.5, 5.2, -1015.5);
  addCylinder(builder, LIMESTONE, rotunda.x, 14.2, rotunda.z, 9.2, 18, 30);
  addCone(builder, 0xa8644d, rotunda.x, 25.2, rotunda.z, 10.1, 4, 30);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    addBox(
      builder,
      DARK_GLASS,
      rotunda.x + Math.cos(angle) * 9.18,
      14,
      rotunda.z + Math.sin(angle) * 9.18,
      1.7,
      5.8,
      0.24,
      -angle + Math.PI / 2,
      false,
    );
  }

  // The post-reunification extension keeps the old complex's courtyard
  // scale but uses restrained pale stone and regular contemporary glazing.
  const modern = new Vector3(112, 5.2, -1198);
  addFacadeGrid(builder, modern, {
    bays: 14,
    baySpacing: 5.6,
    color: 0x627d82,
    floors: 4,
    floorSpacing: 4,
    frontZ: 0.35,
    rotationY: rotation,
    startY: 4,
    width: 3.1,
  });
  for (let bay = 0; bay <= 14; bay += 1) {
    localBox(
      builder,
      IVORY,
      modern,
      -39.2 + bay * 5.6,
      10.5,
      0.55,
      0.28,
      18.2,
      0.35,
      rotation,
      false,
    );
  }
}

function addBerlinerEnsemble(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const source = anchor(byName, "Berliner Ensemble");
  if (!source) return;
  const point = source.clone().add(new Vector3(24, 0, 13));
  point.y = 4.05;
  const rotation = -0.12;
  // LoD2 keeps the complete theatre mass. This layer adds only the
  // Schiffbauerdamm facade so it cannot fight a second full-size box.
  localBox(builder, SANDSTONE, point, 0, 19.2, 21.75, 48, 1.0, 0.62, rotation);
  localBox(builder, IVORY, point, 0, 2.2, 21.75, 46, 4.2, 0.6, rotation);
  for (const x of [-17, -11.3, -5.6, 0, 5.6, 11.3, 17]) {
    localBox(
      builder,
      SANDSTONE,
      point,
      x,
      10.1,
      21.75,
      0.72,
      16.8,
      0.65,
      rotation,
    );
  }
  addFacadeGrid(builder, point, {
    bays: 7,
    baySpacing: 5.65,
    floors: 3,
    floorSpacing: 4.6,
    frontZ: 21.98,
    rotationY: rotation,
    startY: 4.5,
    width: 2.5,
  });
  localBox(builder, DARK_BRICK, point, 0, 17.2, 22.2, 22, 1.7, 0.2, rotation);
}

type StationPoint3 = readonly [number, number, number];

function friedrichstrasseCurveZ(along: number): number {
  const normalized = Math.max(
    -1,
    Math.min(1, along / FRIEDRICHSTRASSE_HALF_LENGTH_M),
  );
  return (
    FRIEDRICHSTRASSE_CURVE_CENTRE_Z_M -
    FRIEDRICHSTRASSE_CURVE_SAG_M * normalized * normalized
  );
}

function friedrichstrasseTangentRotation(along: number): number {
  const derivative =
    (-2 * FRIEDRICHSTRASSE_CURVE_SAG_M * along) /
    FRIEDRICHSTRASSE_HALF_LENGTH_M ** 2;
  return FRIEDRICHSTRASSE_STATION_ROTATION_RAD - Math.atan(derivative);
}

function friedrichstrasseWorld(
  point: Vector3,
  along: number,
  across: number,
  y: number,
): StationPoint3 {
  const world = localPoint(
    point,
    along,
    friedrichstrasseCurveZ(along) + across,
    FRIEDRICHSTRASSE_STATION_ROTATION_RAD,
  );
  return [world.x, point.y + y, world.z];
}

function pushStationQuad(
  vertices: number[],
  a: StationPoint3,
  b: StationPoint3,
  c: StationPoint3,
  d: StationPoint3,
  reverse = false,
): void {
  if (reverse) {
    vertices.push(...a, ...c, ...b, ...a, ...d, ...c);
    return;
  }
  vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function addCurvedStationPrism(
  builder: Builder,
  color: number,
  point: Vector3,
  y0: number,
  height: number,
  segments: number,
): void {
  const vertices: number[] = [];
  const outline: number[] = [];
  const y1 = y0 + height;
  const left = -FRIEDRICHSTRASSE_HALF_WIDTH_M;
  const right = FRIEDRICHSTRASSE_HALF_WIDTH_M;
  for (let index = 0; index < segments; index += 1) {
    const along0 =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M +
      (index / segments) * FRIEDRICHSTRASSE_STATION_LENGTH_M;
    const along1 =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M +
      ((index + 1) / segments) * FRIEDRICHSTRASSE_STATION_LENGTH_M;
    const leftBottom0 = friedrichstrasseWorld(point, along0, left, y0);
    const leftBottom1 = friedrichstrasseWorld(point, along1, left, y0);
    const leftTop0 = friedrichstrasseWorld(point, along0, left, y1);
    const leftTop1 = friedrichstrasseWorld(point, along1, left, y1);
    const rightBottom0 = friedrichstrasseWorld(point, along0, right, y0);
    const rightBottom1 = friedrichstrasseWorld(point, along1, right, y0);
    const rightTop0 = friedrichstrasseWorld(point, along0, right, y1);
    const rightTop1 = friedrichstrasseWorld(point, along1, right, y1);
    pushStationQuad(
      vertices,
      leftBottom0,
      leftBottom1,
      leftTop1,
      leftTop0,
      true,
    );
    pushStationQuad(
      vertices,
      rightBottom1,
      rightBottom0,
      rightTop0,
      rightTop1,
      true,
    );
    pushStationQuad(
      vertices,
      leftTop0,
      leftTop1,
      rightTop1,
      rightTop0,
      true,
    );
    outline.push(
      ...leftBottom0,
      ...leftBottom1,
      ...leftTop0,
      ...leftTop1,
      ...rightBottom0,
      ...rightBottom1,
      ...rightTop0,
      ...rightTop1,
    );
  }
  for (const along of [
    -FRIEDRICHSTRASSE_HALF_LENGTH_M,
    FRIEDRICHSTRASSE_HALF_LENGTH_M,
  ]) {
    const leftBottom = friedrichstrasseWorld(point, along, left, y0);
    const rightBottom = friedrichstrasseWorld(point, along, right, y0);
    const leftTop = friedrichstrasseWorld(point, along, left, y1);
    const rightTop = friedrichstrasseWorld(point, along, right, y1);
    pushStationQuad(
      vertices,
      leftBottom,
      rightBottom,
      rightTop,
      leftTop,
      along > 0,
    );
    outline.push(
      ...leftBottom,
      ...rightBottom,
      ...leftTop,
      ...rightTop,
      ...leftBottom,
      ...leftTop,
      ...rightBottom,
      ...rightTop,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(
    Array.from({ length: vertices.length / 3 }, (_, index) => index),
  );
  geometry.computeVertexNormals();
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  const lines = new BufferGeometry();
  lines.setAttribute("position", new Float32BufferAttribute(outline, 3));
  builder.edges.push(lines);
}

function friedrichstrasseTudorHeight(across: number, width: number): number {
  const normalized = Math.min(1, Math.abs(across) / (width / 2));
  const roundArc = Math.sqrt(Math.max(0, 1 - normalized * normalized));
  const shallowPoint = 1 - normalized;
  return (
    FRIEDRICHSTRASSE_EAVES_Y_M +
    FRIEDRICHSTRASSE_ROOF_RISE_M *
      (roundArc * 0.38 + shallowPoint * 0.62)
  );
}

function addCurvedTudorRoof(
  builder: Builder,
  color: number,
  point: Vector3,
  hallCentre: number,
  hallWidth: number,
  pathSegments: number,
  profileSegments: number,
): void {
  const vertices: number[] = [];
  const gridLines: number[] = [];
  const profilePoint = (along: number, index: number) => {
    const across = -hallWidth / 2 + (index / profileSegments) * hallWidth;
    return friedrichstrasseWorld(
      point,
      along,
      hallCentre + across,
      friedrichstrasseTudorHeight(across, hallWidth),
    );
  };
  for (let pathIndex = 0; pathIndex < pathSegments; pathIndex += 1) {
    const along0 =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M +
      (pathIndex / pathSegments) * FRIEDRICHSTRASSE_STATION_LENGTH_M;
    const along1 =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M +
      ((pathIndex + 1) / pathSegments) *
        FRIEDRICHSTRASSE_STATION_LENGTH_M;
    for (
      let profileIndex = 0;
      profileIndex < profileSegments;
      profileIndex += 1
    ) {
      pushStationQuad(
        vertices,
        profilePoint(along0, profileIndex),
        profilePoint(along1, profileIndex),
        profilePoint(along1, profileIndex + 1),
        profilePoint(along0, profileIndex + 1),
        true,
      );
    }
  }
  for (let pathIndex = 0; pathIndex <= pathSegments; pathIndex += 2) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M +
      (pathIndex / pathSegments) * FRIEDRICHSTRASSE_STATION_LENGTH_M;
    for (
      let profileIndex = 0;
      profileIndex < profileSegments;
      profileIndex += 1
    ) {
      gridLines.push(
        ...profilePoint(along, profileIndex),
        ...profilePoint(along, profileIndex + 1),
      );
    }
  }
  for (
    let profileIndex = 0;
    profileIndex <= profileSegments;
    profileIndex += 2
  ) {
    for (let pathIndex = 0; pathIndex < pathSegments; pathIndex += 1) {
      const along0 =
        -FRIEDRICHSTRASSE_HALF_LENGTH_M +
        (pathIndex / pathSegments) * FRIEDRICHSTRASSE_STATION_LENGTH_M;
      const along1 =
        -FRIEDRICHSTRASSE_HALF_LENGTH_M +
        ((pathIndex + 1) / pathSegments) *
          FRIEDRICHSTRASSE_STATION_LENGTH_M;
      gridLines.push(
        ...profilePoint(along0, profileIndex),
        ...profilePoint(along1, profileIndex),
      );
    }
  }
  const roof = new BufferGeometry();
  roof.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  roof.setIndex(
    Array.from({ length: vertices.length / 3 }, (_, index) => index),
  );
  roof.computeVertexNormals();
  paintGeometry(roof, color);
  builder.parts.push(roof);
  const grid = new BufferGeometry();
  grid.setAttribute("position", new Float32BufferAttribute(gridLines, 3));
  builder.edges.push(grid);
}

function addCurvedTudorGable(
  builder: Builder,
  point: Vector3,
  along: number,
  hallCentre: number,
  hallWidth: number,
  profileSegments: number,
): void {
  const vertices: number[] = [];
  const gridLines: number[] = [];
  const profilePoint = (index: number) => {
    const across = -hallWidth / 2 + (index / profileSegments) * hallWidth;
    return {
      across,
      bottom: friedrichstrasseWorld(
        point,
        along,
        hallCentre + across,
        FRIEDRICHSTRASSE_PLATFORM_Y_M,
      ),
      top: friedrichstrasseWorld(
        point,
        along,
        hallCentre + across,
        friedrichstrasseTudorHeight(across, hallWidth),
      ),
      topY: friedrichstrasseTudorHeight(across, hallWidth),
    };
  };
  for (let index = 0; index < profileSegments; index += 1) {
    const left = profilePoint(index);
    const right = profilePoint(index + 1);
    pushStationQuad(
      vertices,
      left.bottom,
      right.bottom,
      right.top,
      left.top,
      along > 0,
    );
    for (const fraction of [0.28, 0.54, 0.78]) {
      const y =
        FRIEDRICHSTRASSE_PLATFORM_Y_M +
        (Math.min(left.topY, right.topY) -
          FRIEDRICHSTRASSE_PLATFORM_Y_M) *
          fraction;
      gridLines.push(
        ...friedrichstrasseWorld(point, along, hallCentre + left.across, y),
        ...friedrichstrasseWorld(point, along, hallCentre + right.across, y),
      );
    }
  }
  for (let index = 0; index <= profileSegments; index += 1) {
    const profile = profilePoint(index);
    gridLines.push(...profile.bottom, ...profile.top);
  }
  const glass = new BufferGeometry();
  glass.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  glass.setIndex(
    Array.from({ length: vertices.length / 3 }, (_, index) => index),
  );
  glass.computeVertexNormals();
  paintGeometry(glass, FRIEDRICHSTRASSE_STATION_GLASS);
  builder.parts.push(glass);
  const grid = new BufferGeometry();
  grid.setAttribute("position", new Float32BufferAttribute(gridLines, 3));
  builder.edges.push(grid);
}

function addFriedrichstrasseSegmentBox(
  builder: Builder,
  color: number,
  point: Vector3,
  along: number,
  across: number,
  y: number,
  sx: number,
  sy: number,
  sz: number,
  inked = true,
): void {
  const world = friedrichstrasseWorld(point, along, across, y);
  addBox(
    builder,
    color,
    world[0],
    world[1],
    world[2],
    sx,
    sy,
    sz,
    friedrichstrasseTangentRotation(along),
    inked,
  );
}

function addFriedrichstrasseLampBox(
  builder: Builder,
  color: number,
  point: Vector3,
  along: number,
  across: number,
  y: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const world = friedrichstrasseWorld(point, along, across, y);
  const geometry = new BoxGeometry(sx, sy, sz);
  geometry.rotateY(friedrichstrasseTangentRotation(along));
  geometry.translate(world[0], world[1], world[2]);
  paintGeometry(geometry, color);
  builder.lamps.push(geometry);
}

function addFriedrichstrasseVerticalDisc(
  builder: Builder,
  color: number,
  point: Vector3,
  along: number,
  across: number,
  y: number,
  radius: number,
  depth: number,
): void {
  const world = friedrichstrasseWorld(point, along, across, y);
  const geometry = new CylinderGeometry(radius, radius, depth, 28);
  geometry.rotateX(Math.PI / 2);
  geometry.rotateY(friedrichstrasseTangentRotation(along));
  geometry.translate(world[0], world[1], world[2]);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );
}

function addFriedrichstrasseStation(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(byName, "Bahnhof Berlin Friedrichstraße");
  if (!point) return;
  point.y = 2.85;
  const stationBrick = 0x9b5c4f;
  const stationBrickAccent = 0x613d38;
  const stationStone = 0xd8c9ad;
  const roofMetal = 0xbfc7c3;
  const segments = 20;
  const segmentAlong = FRIEDRICHSTRASSE_STATION_LENGTH_M / segments;

  // The official LoD2 outline bends through the broad Stadtbahn curve. The
  // brick viaduct follows that curve continuously instead of approximating it
  // with the former 143 x 72 m straight box.
  addCurvedStationPrism(
    builder,
    stationBrick,
    point,
    0,
    FRIEDRICHSTRASSE_PLATFORM_Y_M,
    segments,
  );

  for (let index = 0; index < segments; index += 1) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M + (index + 0.5) * segmentAlong;
    const curveStep =
      friedrichstrasseCurveZ(along + segmentAlong / 2) -
      friedrichstrasseCurveZ(along - segmentAlong / 2);
    const length = Math.hypot(segmentAlong, curveStep) + 0.08;
    for (const side of [-1, 1]) {
      const facade = side * (FRIEDRICHSTRASSE_HALF_WIDTH_M + 0.14);
      addFriedrichstrasseSegmentBox(
        builder,
        FRIEDRICHSTRASSE_STATION_GLASS,
        point,
        along,
        facade,
        6.1,
        length - 1.0,
        4.4,
        0.24,
        false,
      );
      if (index % 3 === 1) {
        addFriedrichstrasseLampBox(
          builder,
          FRIEDRICHSTRASSE_STATION_GLASS,
          point,
          along,
          facade,
          14.55,
          length - 0.55,
          6.9,
          0.24,
        );
      } else {
        addFriedrichstrasseSegmentBox(
          builder,
          FRIEDRICHSTRASSE_STATION_GLASS,
          point,
          along,
          facade,
          14.55,
          length - 0.55,
          6.9,
          0.24,
          false,
        );
      }
      for (const y of [1.15, 10.45, 14.0, 18.02]) {
        addFriedrichstrasseSegmentBox(
          builder,
          y < 11 ? stationStone : STEEL,
          point,
          along,
          facade + side * 0.08,
          y,
          length,
          y < 11 ? 0.32 : 0.18,
          0.34,
          false,
        );
      }
    }
  }
  for (let index = 0; index <= segments; index += 1) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M + index * segmentAlong;
    for (const side of [-1, 1]) {
      const facade = side * (FRIEDRICHSTRASSE_HALF_WIDTH_M + 0.28);
      addFriedrichstrasseSegmentBox(
        builder,
        stationBrickAccent,
        point,
        along,
        facade,
        8.65,
        0.42,
        FRIEDRICHSTRASSE_EAVES_Y_M,
        0.42,
        false,
      );
    }
  }

  // Three island platforms and six rails follow the same measured curve. The
  // rail bed is visible through both glazed end walls without becoming a
  // second competing city layer at overview scale.
  const platformOffsets = [-20.5, 0, 20.5];
  const trackOffsets = [-27, -14.2, -6.2, 6.2, 14.2, 27];
  for (let index = 0; index < segments; index += 1) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M + (index + 0.5) * segmentAlong;
    const curveStep =
      friedrichstrasseCurveZ(along + segmentAlong / 2) -
      friedrichstrasseCurveZ(along - segmentAlong / 2);
    const length = Math.hypot(segmentAlong, curveStep) + 0.12;
    for (const platform of platformOffsets) {
      addFriedrichstrasseSegmentBox(
        builder,
        0xc9c4b9,
        point,
        along,
        platform,
        FRIEDRICHSTRASSE_PLATFORM_Y_M + 0.22,
        length,
        0.44,
        5.2,
        false,
      );
    }
    for (const track of trackOffsets) {
      for (const rail of [-0.72, 0.72]) {
        addFriedrichstrasseSegmentBox(
          builder,
          STEEL,
          point,
          along,
          track + rail,
          FRIEDRICHSTRASSE_PLATFORM_Y_M + 0.12,
          length,
          0.14,
          0.12,
          false,
        );
      }
    }
  }
  for (let index = 1; index < segments; index += 2) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M + index * segmentAlong;
    for (const track of trackOffsets) {
      addFriedrichstrasseSegmentBox(
        builder,
        DARK_BRICK,
        point,
        along,
        track,
        FRIEDRICHSTRASSE_PLATFORM_Y_M + 0.02,
        0.24,
        0.12,
        2.45,
        false,
      );
    }
  }

  // Brodführer's 1919-25 roof is explicitly a light two-aisled structure
  // with shallow Tudor arches. A small ridge cusp and lower shoulders replace
  // the previous semicircular barrels.
  for (const hallCentre of [-15, 15]) {
    addCurvedTudorRoof(
      builder,
      roofMetal,
      point,
      hallCentre,
      30,
      segments,
      18,
    );
    for (const end of [-1, 1]) {
      addCurvedTudorGable(
        builder,
        point,
        end * FRIEDRICHSTRASSE_HALF_LENGTH_M,
        hallCentre,
        30,
        18,
      );
    }
  }
  for (let index = 0; index <= segments; index += 2) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M + index * segmentAlong;
    for (const across of [-30, 0, 30]) {
      const world = friedrichstrasseWorld(
        point,
        along,
        across,
        (FRIEDRICHSTRASSE_PLATFORM_Y_M + FRIEDRICHSTRASSE_EAVES_Y_M) /
          2,
      );
      addCylinder(
        builder,
        STEEL,
        world[0],
        world[1],
        world[2],
        0.18,
        FRIEDRICHSTRASSE_EAVES_Y_M - FRIEDRICHSTRASSE_PLATFORM_Y_M,
        10,
      );
    }
  }
  for (let index = 0; index < segments; index += 1) {
    const along =
      -FRIEDRICHSTRASSE_HALF_LENGTH_M + (index + 0.5) * segmentAlong;
    addFriedrichstrasseSegmentBox(
      builder,
      STEEL,
      point,
      along,
      0,
      FRIEDRICHSTRASSE_EAVES_Y_M + 0.22,
      segmentAlong + 0.08,
      0.42,
      0.62,
      false,
    );
  }

  // North-west entrance: stepped dark-clinker portal, black terracotta
  // pilasters and medallions, five-door vestibule, clock and cable-glass
  // canopy. These are the persistent recognition details in the preserved
  // 1925 entrance photographed from Dorothea-Schlegel-Platz.
  const entranceAcross = -31.7;
  addFriedrichstrasseSegmentBox(
    builder,
    stationBrick,
    point,
    0,
    entranceAcross,
    7.1,
    54,
    14.2,
    3.2,
  );
  addFriedrichstrasseSegmentBox(
    builder,
    stationBrick,
    point,
    0,
    entranceAcross - 0.1,
    8.4,
    27,
    16.8,
    3.35,
  );
  for (const x of [-21.5, 21.5]) {
    addFriedrichstrasseSegmentBox(
      builder,
      stationBrick,
      point,
      x,
      entranceAcross - 0.08,
      7.65,
      10.5,
      15.3,
      3.3,
    );
  }
  for (const x of [-25.5, -16.2, -12.4, 12.4, 16.2, 25.5]) {
    addFriedrichstrasseSegmentBox(
      builder,
      stationBrickAccent,
      point,
      x,
      entranceAcross - 1.72,
      8.25,
      0.42,
      15.5,
      0.32,
      false,
    );
  }
  for (const x of [-8, -4, 0, 4, 8]) {
    addFriedrichstrasseSegmentBox(
      builder,
      DARK_GLASS,
      point,
      x,
      entranceAcross - 1.72,
      3.05,
      2.7,
      5.6,
      0.24,
      false,
    );
    addFriedrichstrasseSegmentBox(
      builder,
      GLASS,
      point,
      x,
      entranceAcross - 1.74,
      10.55,
      2.8,
      4.25,
      0.22,
      false,
    );
  }
  for (const x of [-21.5, 21.5]) {
    addFriedrichstrasseSegmentBox(
      builder,
      GLASS,
      point,
      x,
      entranceAcross - 1.74,
      10.2,
      3.7,
      5.0,
      0.22,
      false,
    );
  }
  for (const y of [6.25, 14.15]) {
    addFriedrichstrasseSegmentBox(
      builder,
      stationStone,
      point,
      0,
      entranceAcross - 1.82,
      y,
      54.6,
      0.36,
      0.36,
      false,
    );
  }
  addFriedrichstrasseSegmentBox(
    builder,
    GLASS,
    point,
    0,
    entranceAcross - 4.55,
    6.45,
    55,
    0.28,
    5.5,
  );
  for (const x of [-22, -11, 0, 11, 22]) {
    addFriedrichstrasseSegmentBox(
      builder,
      STEEL,
      point,
      x,
      entranceAcross - 4.55,
      6.62,
      0.18,
      0.18,
      5.7,
      false,
    );
  }
  addFriedrichstrasseVerticalDisc(
    builder,
    stationBrickAccent,
    point,
    0,
    entranceAcross - 1.98,
    14.45,
    1.78,
    0.3,
  );
  addFriedrichstrasseVerticalDisc(
    builder,
    IVORY,
    point,
    0,
    entranceAcross - 2.18,
    14.45,
    1.48,
    0.12,
  );
  addFriedrichstrasseSegmentBox(
    builder,
    INK,
    point,
    0,
    entranceAcross - 2.27,
    14.85,
    0.12,
    0.8,
    0.1,
    false,
  );
  addFriedrichstrasseSegmentBox(
    builder,
    INK,
    point,
    0.38,
    entranceAcross - 2.27,
    14.45,
    0.76,
    0.12,
    0.1,
    false,
  );
  for (const x of [-21.5, 21.5]) {
    addFriedrichstrasseVerticalDisc(
      builder,
      stationBrickAccent,
      point,
      x,
      entranceAcross - 1.96,
      12.9,
      0.9,
      0.18,
    );
  }
}

function addTearPalace(builder: Builder): void {
  const baseY = 2.85;
  addExtrudedFootprint(
    builder,
    0x91bcc4,
    TEAR_PALACE_FOOTPRINT_WORLD,
    baseY,
    7.35,
  );
  addExtrudedFootprint(
    builder,
    0xd6dedc,
    scaledRing(TEAR_PALACE_FOOTPRINT_WORLD, 1.055),
    baseY + 7.28,
    0.34,
  );
  const ring = TEAR_PALACE_FOOTPRINT_WORLD;
  for (let edge = 0; edge < ring.length; edge += 1) {
    const [x0, z0] = ring[edge];
    const [x1, z1] = ring[(edge + 1) % ring.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const posts = Math.max(1, Math.round(length / 2.35));
    for (let index = 0; index <= posts; index += 1) {
      const t = index / posts;
      addBox(
        builder,
        0x7b9ba0,
        x0 + dx * t,
        baseY + 3.7,
        z0 + dz * t,
        0.16,
        7.2,
        0.16,
        -Math.atan2(dz, dx),
        false,
      );
    }
  }
}

function addFinanceMinistry(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(
    byName,
    "Bundesministerium der Finanzen / Detlev-Rohwedder-Haus",
  );
  if (!point) return;
  const facade = point.clone().add(new Vector3(-21, 0, 0));
  const rotation = Math.PI / 2 + 0.02;
  localBox(builder, LIMESTONE, facade, 0, 32.8, 0, 184, 1.1, 7, rotation);
  addFacadeGrid(builder, facade, {
    bays: 31,
    baySpacing: 5.75,
    floors: 6,
    floorSpacing: 4.2,
    frontZ: 3.7,
    rotationY: rotation,
    startY: 4.5,
    width: 2.5,
  });
  for (let bay = -15; bay <= 15; bay += 1) {
    localBox(
      builder,
      SANDSTONE,
      facade,
      bay * 5.75,
      16,
      3.9,
      0.45,
      29,
      0.4,
      rotation,
    );
  }
}

function addGropiusAndParliament(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const gropius = anchor(byName, "Gropius Bau");
  if (gropius) {
    localBox(builder, BRICK, gropius, 0, 14.8, -9, 74, 28.5, 76, 0.01);
    localBox(builder, SANDSTONE, gropius, 0, 29.4, -9, 77, 1, 79, 0.01);
    for (const side of [-1, 1]) {
      addFacadeGrid(builder, gropius, {
        bays: 11,
        baySpacing: 5.7,
        color: 0x4a5e61,
        floors: 3,
        floorSpacing: 6.2,
        frontZ: -9 + side * 38.25,
        rotationY: 0.01,
        startY: 6.2,
        width: 2.7,
      });
    }
    for (const x of [-30, -20, -10, 0, 10, 20, 30]) {
      localBox(builder, SANDSTONE, gropius, x, 14.5, 29.5, 0.65, 27, 0.5, 0.01);
    }
  }

  const parliament = anchor(byName, "Abgeordnetenhaus von Berlin");
  if (!parliament) return;
  localBox(builder, SANDSTONE, parliament, 0, 12.5, 0, 96, 24, 82, 0.01);
  localBox(builder, DARK_BRICK, parliament, 0, 25.2, 0, 99, 1.4, 85, 0.01);
  addFacadeGrid(builder, parliament, {
    bays: 15,
    baySpacing: 5.5,
    floors: 4,
    floorSpacing: 4.6,
    frontZ: 41.2,
    rotationY: 0.01,
    startY: 4.5,
    width: 2.65,
  });
  for (const x of [-22, -16.5, -11, -5.5, 0, 5.5, 11, 16.5, 22]) {
    localBox(builder, IVORY, parliament, x, 13.1, 41.6, 0.55, 23, 0.45, 0.01);
  }
}

function addTopographyOfTerror(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(byName, "Topographie des Terrors");
  if (!point) return;
  const pavilion = point.clone().add(new Vector3(-30, 0, -48));
  localBox(builder, DARK_GLASS, pavilion, 0, 4.9, 0, 59, 9.4, 58, 0.01);
  localBox(builder, STEEL, pavilion, 0, 9.8, 0, 62, 0.5, 61, 0.01);
  // Follow the official/OSM Wall trace between x=725.849 and 934.853 m:
  // its surveyed z coordinate falls from 1317.754 to 1302.225 m. The former
  // almost-horizontal approximation visibly drifted off Niederkirchnerstrasse.
  const rotation = TOPOGRAPHY_WALL_ROTATION_RAD;
  const wallZ = -117;
  const pitch = TOPOGRAPHY_WALL_LENGTH_M / TOPOGRAPHY_WALL_SECTION_COUNT;
  const heights = [3.28, 2.92, 3.46, 3.12, 2.58, 3.4, 3.02, 3.34] as const;
  const graffiti = [0x3c6692, 0x9f3f38, 0xc89b2b, 0x506d4c] as const;
  for (let index = 0; index < TOPOGRAPHY_WALL_SECTION_COUNT; index += 1) {
    // The monument is intentionally retained in its 1989/90 overcome state:
    // missing panels, broken top edges and chipped seams are historical
    // evidence, not damage to be repaired into a pristine wall.
    if (index === 4 || index === 12) continue;
    const x = -TOPOGRAPHY_WALL_LENGTH_M / 2 + pitch * (index + 0.5);
    const height = heights[index % heights.length];
    const sectionLength = index % 5 === 2 ? 8.45 : 9.05;
    localBox(
      builder,
      index % 3 === 0 ? WALL_CONCRETE_DARK : WALL_CONCRETE,
      point,
      x,
      height / 2,
      wallZ,
      sectionLength,
      height,
      0.72,
      rotation,
    );

    // The familiar rounded Berlin-Wall crown survives only on the less
    // damaged panels. It is a true low-poly concrete tube, not a square cap.
    if (index % 4 !== 1) {
      const local = localPoint(point, x, wallZ, rotation);
      const pipe = new CylinderGeometry(0.34, 0.34, sectionLength - 0.34, 10);
      pipe.rotateZ(Math.PI / 2);
      pipe.rotateY(rotation);
      pipe.translate(local.x, point.y + height + 0.13, local.z);
      paintGeometry(pipe, WALL_PIPE);
      builder.parts.push(pipe);
      builder.edges.push(
        new EdgesGeometry(pipe, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
      );
    }

    // Small, flat paint strokes recall the surviving graffiti without
    // distributing a copied photograph or pretending to transcribe it.
    if (index % 2 === 0) {
      for (let stroke = 0; stroke < 3; stroke += 1) {
        localBox(
          builder,
          graffiti[(index + stroke) % graffiti.length],
          point,
          x - 2.2 + stroke * 2.1,
          0.75 + ((index + stroke) % 3) * 0.46,
          wallZ - 0.375,
          1.3 + (stroke % 2) * 0.55,
          0.18,
          0.055,
          rotation,
          false,
        );
      }
    }
  }

  // Low security fence between the archaeological grounds and the ruin.
  // Posts and three taut rails keep the 200 m line legible without creating
  // a moire-prone wire mesh at the overview scale.
  const fenceZ = -112.9;
  for (let x = -100; x <= 100; x += 4) {
    localBox(
      builder,
      WALL_FENCE,
      point,
      x,
      1.15,
      fenceZ,
      0.1,
      2.3,
      0.1,
      rotation,
      false,
    );
  }
  for (const y of [0.42, 1.12, 1.82]) {
    localBox(
      builder,
      WALL_FENCE,
      point,
      0,
      y,
      fenceZ,
      TOPOGRAPHY_WALL_LENGTH_M,
      0.075,
      0.075,
      rotation,
      false,
    );
  }
  localBox(builder, LIMESTONE, point, 0, -0.15, -82, 198, 0.35, 31, 0.01);
}

function createSign(
  text: string,
  width: number,
  height: number,
  point: Vector3,
  offset: [number, number, number],
  rotationY: number,
  fieldColor: string,
  letterColor: string,
  transparentField = false,
): Mesh {
  const resolvedFieldColor = transparentField ? "rgba(0,0,0,0)" : fieldColor;
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.56,
    fieldColor: resolvedFieldColor,
    letterColor,
    text,
    texelsPerMetre: 180,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({
        alphaTest: transparentField ? 0.05 : 0,
        depthWrite: !transparentField,
        map: texture,
        side: DoubleSide,
        transparent: transparentField,
      })
    : new MeshBasicMaterial({
        color: transparentField ? letterColor : fieldColor,
        opacity: transparentField ? 0 : 1,
        side: DoubleSide,
        transparent: transparentField,
      });
  const nightMaterial = texture
    ? new MeshStandardMaterial({
        alphaTest: transparentField ? 0.05 : 0,
        depthWrite: !transparentField,
        emissive: transparentField ? 0xfff1cf : 0xffd8a0,
        emissiveIntensity: transparentField ? 1.05 : 0.7,
        map: texture,
        side: DoubleSide,
        transparent: transparentField,
      })
    : new MeshStandardMaterial({
        color: transparentField ? letterColor : fieldColor,
        opacity: transparentField ? 0 : 1,
        side: DoubleSide,
        transparent: transparentField,
      });
  const sign = new Mesh(new PlaneGeometry(width, height), dayMaterial);
  const position = localPoint(point, offset[0], offset[2], rotationY);
  sign.position.set(position.x, point.y + offset[1], position.z);
  sign.rotation.y = rotationY;
  sign.name = `${text} civic lettering`;
  sign.userData.dayMaterial = dayMaterial;
  sign.userData.nightMaterial = nightMaterial;
  return sign;
}

function createBerlinerEnsembleRoofSign(point: Vector3): Group {
  const group = new Group();
  group.name = "Berliner Ensemble circular rooftop sign";
  group.userData = {
    geometryStatus: "official-photo-referenced open neon ring and lettering",
    sourceUrl: "https://www.berliner-ensemble.de/magazin/berlin-leuchtet",
  };
  const rotationY = -0.12;
  const centre = localPoint(point, 0, 0, rotationY);
  const dayMaterial = new MeshBasicMaterial({
    color: 0xa72e2e,
    side: DoubleSide,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xa72e2e,
    emissive: 0xdb3e31,
    emissiveIntensity: 0.82,
    side: DoubleSide,
  });
  const ring = new Mesh(new TorusGeometry(6.95, 0.2, 8, 72), dayMaterial);
  ring.name = "Berliner Ensemble open red neon roof ring";
  ring.position.set(centre.x, point.y + 27.2, centre.z);
  ring.rotation.y = rotationY;
  ring.userData.dayMaterial = dayMaterial;
  ring.userData.nightMaterial = nightMaterial;
  group.add(ring);

  for (const x of [-4.4, 4.4]) {
    const supportPoint = localPoint(point, x, 0.2, rotationY);
    const support = new Mesh(
      new BoxGeometry(0.28, 8.5, 0.28),
      new MeshBasicMaterial({ color: 0x555b59 }),
    );
    support.name = "Berliner Ensemble roof-sign support";
    support.position.set(supportPoint.x, point.y + 21.5, supportPoint.z);
    group.add(support);
  }
  group.add(
    createSign(
      "BERLINER",
      11.4,
      2.1,
      point,
      [0, 29, 0.08],
      rotationY,
      "rgba(0,0,0,0)",
      "#fff5df",
      true,
    ),
    createSign(
      "ENSEMBLE",
      11.4,
      2.1,
      point,
      [0, 25.9, 0.08],
      rotationY,
      "rgba(0,0,0,0)",
      "#fff5df",
      true,
    ),
  );
  return group;
}

function addSigns(
  group: Group,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const oggi = anchor(byName, "Oggi's Gemüsekebab");
  if (oggi) {
    group.add(
      createSign(
        "OGGI",
        6.8,
        1.05,
        oggi,
        [0, 2.3, -2.23],
        -0.42,
        "#f1eee4",
        "#377553",
      ),
    );
  }
  const ensemble = anchor(byName, "Berliner Ensemble");
  if (ensemble) {
    const point = ensemble.clone().add(new Vector3(24, 0, 13));
    point.y = 4.05;
    group.add(
      createSign(
        "BERLINER ENSEMBLE",
        20,
        1.55,
        point,
        [0, 18.3, 22.35],
        -0.12,
        "#75463c",
        "#f6e9ca",
      ),
    );
    group.add(createBerlinerEnsembleRoofSign(point));
  }
  const s15 = anchor(byName, "S15-Station Berlin Hauptbahnhof");
  if (s15) {
    group.add(
      createSign(
        "S15",
        3.8,
        1.45,
        s15,
        [-8.5, 3.9, -13.35],
        -0.43,
        "#2878b9",
        "#ffffff",
      ),
    );
  }
  // The owner's Moltkebrücke view shows the small white tenant lettering on
  // the Spree-facing upper dark fold. It is a recognition accent, not a new
  // building owner: geometry, footprint and 43.6 m LoD2 height stay fixed.
  const cubeSouthEdge = CUBE_BERLIN_FOOTPRINT_WORLD[3];
  const cubeSouthRotation = -2.7627824432498915;
  const cubeSignPoint = new Vector3(cubeSouthEdge[0], 5.4, cubeSouthEdge[1]);
  group.add(
    createSign(
      CUBE_BERLIN_FACADE_PROFILE.roofTenantSign,
      7.4,
      0.86,
      cubeSignPoint,
      [20.1, CUBE_BERLIN_HEIGHT_M - 5.2, 0.28],
      cubeSouthRotation,
      "rgba(0,0,0,0)",
      "#f4f5ee",
      true,
    ),
  );
}

export function createCentralCivicDetails(
  landmarks: CentralCivicLandmark[],
): Group {
  const group = new Group();
  group.name = "Task-11 central transit and civic recognition details";
  group.userData.geometryStatus =
    "Official LoD2 and OSM anchors with primary-source recognition details; vehicles, facade rhythms and damaged Wall crown are bounded display approximations";
  group.userData.keepInMinecraft = true;
  group.userData.hauptbahnhofTransit = {
    taxiCount: 5,
    taxiType: "Berlin ivory saloons with roof signs, lamps and four wheels",
    tramCount: 1,
    tramType:
      "yellow five-section Flexity presentation model with articulated joints, doors, bogies and pantograph",
  };
  group.userData.topographyWall = {
    lengthM: TOPOGRAPHY_WALL_LENGTH_M,
    sectionCount: TOPOGRAPHY_WALL_SECTION_COUNT,
    source: "Topography of Terror / Niederkirchnerstrasse monument",
    state: "preserved 1989/90 ruin with security fence",
    traceRotationRad: TOPOGRAPHY_WALL_ROTATION_RAD,
  };
  group.userData.bundestagKita = {
    geometryAnchor: "OSM way 30349234 + Berlin LoD2",
    source: BUNDESTAG_KITA_SOURCE,
    world: BUNDESTAG_KITA_WORLD,
  };
  group.userData.futurium = {
    buildingId: FUTURIUM_BUILDING_ID,
    drehmomentWorld: FUTURIUM_DREHMOMENT_WORLD,
    footprintAreaM2: 4034,
    footprintWorld: FUTURIUM_FOOTPRINT_WORLD,
    heightM: FUTURIUM_HEIGHT_M,
    source: "Berlin LoD2 + OSM + Futurium architecture specification",
  };
  group.userData.pariserPlatz = {
    gardens: PARISER_PLATZ_GARDENS,
    subwayEntranceWorld: BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD,
    source:
      "Berlin official Pariser-Platz landscape plan + OSM entrances and footprints",
  };
  group.userData.cubeBerlin = {
    facadeProfile: CUBE_BERLIN_FACADE_PROFILE,
    footprintWorld: CUBE_BERLIN_FOOTPRINT_WORLD,
    heightM: CUBE_BERLIN_HEIGHT_M,
    prismIds: CUBE_BERLIN_PRISM_IDS,
    source:
      "Berlin LoD2 + OSM way 624737072 + 3XN published dimensions and facade system",
  };
  group.userData.tearPalace = {
    footprintWorld: TEAR_PALACE_FOOTPRINT_WORLD,
    prismIds: TEAR_PALACE_PRISM_IDS,
    source: "Berlin LoD2 + OSM way 43173495 + Haus der Geschichte",
  };
  group.userData.friedrichstrasseStation = {
    curveSagM: FRIEDRICHSTRASSE_CURVE_SAG_M,
    footprintM: [
      FRIEDRICHSTRASSE_STATION_LENGTH_M,
      FRIEDRICHSTRASSE_STATION_WIDTH_M,
    ],
    heightM: FRIEDRICHSTRASSE_STATION_HEIGHT_M,
    photoReferences: [
      "https://commons.wikimedia.org/wiki/File:Bahnhof_Berlin_Friedrichstra%C3%9Fe_-_Detailansicht.jpg",
      "https://commons.wikimedia.org/wiki/File:Berlin_Bahnhof_Friedrichstra%C3%9Fe_entry.jpg",
      "https://commons.wikimedia.org/wiki/File:Bahnhof_Friedrichstra%C3%9Fe_Berlin.jpg",
    ],
    platformCount: FRIEDRICHSTRASSE_STATION_PLATFORM_COUNT,
    roofCount: 2,
    roofProfile:
      "two shallow Tudor-arch sheds on the surveyed Stadtbahn curve",
    source:
      "Berlin LoD2 + OSM station footprint + Landesdenkmalamt Berlin object 09080415",
    sourceUrl: FRIEDRICHSTRASSE_STATION_SOURCE,
    trackCount: FRIEDRICHSTRASSE_STATION_TRACK_COUNT,
    entranceDetails:
      "stepped clinker portal, black terracotta, five-door vestibule, clock and glass canopy",
  };
  group.userData.economicsMinistry = {
    source:
      "Berlin LoD2 + OSM way 24911034 + BMWE official architecture history",
  };
  const byName = new Map(
    landmarks.map((landmark) => [landmark.name, landmark]),
  );
  const builder = createBuilder();
  addHauptbahnhofTransit(builder, byName);
  addOggiAndTaxis(builder, byName);
  addFuturium(builder, byName);
  addGreenFederalCampus(builder, byName);
  addParliamentOfTrees(builder, byName);
  addBundestagKita(builder);
  addPariserPlatzDetails(builder);
  addPariserPlatzEmbassies(builder);
  addCubeBerlin(builder);
  addEconomicsMinistry(builder);
  addBerlinerEnsemble(builder, byName);
  addFriedrichstrasseStation(builder, byName);
  addTearPalace(builder);
  addFinanceMinistry(builder, byName);
  addGropiusAndParliament(builder, byName);
  addTopographyOfTerror(builder, byName);
  const drawn = finishDrawnGroup(builder, {
    lampEmissive: 0xffd68a,
    lampEmissiveIntensity: 0.85,
    name: "Central transit and civic details",
  });
  if (drawn) group.add(drawn);
  addSigns(group, byName);
  return group;
}
