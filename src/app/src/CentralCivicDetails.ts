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
    azimuth_degrees: 36,
    distance_m: 178,
    polar_degrees: 61,
    target_height_m: 16,
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
  builder.edges.push(new EdgesGeometry(geometry, 28));

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
  if (inked) builder.edges.push(new EdgesGeometry(geometry, 24));
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

function addBarrelRoofGeometry(
  builder: Builder,
  color: number,
  point: Vector3,
  length: number,
  width: number,
  eavesY: number,
  rise: number,
  rotationY: number,
  segments = 20,
): void {
  const vertices: number[] = [];
  const gridLines: number[] = [];
  const world = (along: number, across: number, y: number) => {
    const position = localPoint(point, along, across, rotationY);
    return [position.x, point.y + y, position.z] as const;
  };
  const profile = (index: number) => {
    const angle = (index / segments) * Math.PI;
    return {
      across: -width / 2 + (index / segments) * width,
      y: eavesY + Math.sin(angle) * rise,
    };
  };
  for (let index = 0; index < segments; index += 1) {
    const left = profile(index);
    const right = profile(index + 1);
    const a = world(-length / 2, left.across, left.y);
    const b = world(length / 2, left.across, left.y);
    const c = world(length / 2, right.across, right.y);
    const d = world(-length / 2, right.across, right.y);
    // Keep the thin glass shell visible from both the exterior and the train
    // shed. The merged city kit deliberately uses FrontSide materials, so a
    // single winding disappeared from half of the orbital camera positions.
    vertices.push(
      ...a,
      ...b,
      ...c,
      ...a,
      ...c,
      ...d,
      ...a,
      ...c,
      ...b,
      ...a,
      ...d,
      ...c,
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

  for (let alongIndex = 0; alongIndex <= 16; alongIndex += 1) {
    const along = -length / 2 + (alongIndex / 16) * length;
    for (let profileIndex = 0; profileIndex < segments; profileIndex += 1) {
      const a = profile(profileIndex);
      const b = profile(profileIndex + 1);
      gridLines.push(
        ...world(along, a.across, a.y),
        ...world(along, b.across, b.y),
      );
    }
  }
  for (let profileIndex = 0; profileIndex <= segments; profileIndex += 2) {
    const profilePoint = profile(profileIndex);
    gridLines.push(
      ...world(-length / 2, profilePoint.across, profilePoint.y),
      ...world(length / 2, profilePoint.across, profilePoint.y),
    );
  }
  const grid = new BufferGeometry();
  grid.setAttribute("position", new Float32BufferAttribute(gridLines, 3));
  builder.edges.push(grid);
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
  builder.edges.push(new EdgesGeometry(disc, 24));
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
    0xa9c9cf,
    CUBE_BERLIN_FOOTPRINT_WORLD,
    baseY,
    CUBE_BERLIN_HEIGHT_M,
  );
  addExtrudedFootprint(
    builder,
    0xdbe4e2,
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
    const bays = Math.max(5, Math.round(length / 7.2));
    const floors = 9;
    for (let bay = 0; bay < bays; bay += 1) {
      const ta = bay / bays;
      const tb = (bay + 1) / bays;
      for (let floor = 0; floor < floors; floor += 1) {
        const ya = baseY + 1.05 + (floor / floors) * 41.2;
        const yb = baseY + 1.05 + ((floor + 1) / floors) * 41.2;
        const a = [
          x0 + dx * ta + nx * 0.07,
          ya,
          z0 + dz * ta + nz * 0.07,
        ] as const;
        const b = [
          x0 + dx * tb + nx * 0.07,
          ya,
          z0 + dz * tb + nz * 0.07,
        ] as const;
        const c = [
          x0 + dx * tb + nx * 0.07,
          yb,
          z0 + dz * tb + nz * 0.07,
        ] as const;
        const d = [
          x0 + dx * ta + nx * 0.07,
          yb,
          z0 + dz * ta + nz * 0.07,
        ] as const;
        const firstTone = (bay + floor + edge) % 2 === 0 ? 0x7faab4 : 0xc4d9dc;
        const secondTone = firstTone === 0x7faab4 ? 0x9bbbc2 : 0xe1e8e5;
        if ((bay + floor) % 2 === 0) {
          addTriangle(builder, firstTone, a, b, c);
          addTriangle(builder, secondTone, a, c, d);
        } else {
          addTriangle(builder, firstTone, a, b, d);
          addTriangle(builder, secondTone, b, c, d);
        }
      }
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

function addFriedrichstrasseStation(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(byName, "Bahnhof Berlin Friedrichstraße");
  if (!point) return;
  point.y = 2.85;
  const rotation = -0.03;
  const stationBrick = 0xbc8068;
  const stationBrickAccent = 0x8d594b;
  const stationStone = 0xd6c5a7;
  localBox(
    builder,
    stationBrick,
    point,
    0,
    8.7,
    0,
    143,
    17.4,
    72,
    rotation,
  );
  for (const facade of [-36.1, 36.1]) {
    localBox(
      builder,
      stationStone,
      point,
      0,
      1.25,
      facade,
      143,
      2.5,
      0.8,
      rotation,
    );
  }
  // The 1919-25 rebuild is a twin train shed, not one oversized barrel.
  // Each steel-and-glass vault spans half the LoD2 station footprint and
  // meets its neighbour at the central valley gutter.
  for (const across of [-18, 18]) {
    const roofCentre = localPoint(point, 0, across, rotation);
    addBarrelRoofGeometry(
      builder,
      0x98aaab,
      new Vector3(roofCentre.x, point.y, roofCentre.z),
      146,
      35.8,
      17.4,
      10.6,
      rotation,
      20,
    );
  }
  localBox(builder, STEEL, point, 0, 17.7, 0, 145.2, 0.46, 0.72, rotation);
  for (const facade of [-36.15, 36.15]) {
    addFacadeGrid(builder, point, {
      bays: 18,
      baySpacing: 7.4,
      floors: 3,
      floorSpacing: 4.5,
      frontZ: facade,
      rotationY: rotation,
      startY: 5.1,
      width: 3.8,
    });
    for (let bay = 0; bay <= 18; bay += 1) {
      localBox(
        builder,
        stationBrickAccent,
        point,
        -66.6 + bay * 7.4,
        9.15,
        facade + Math.sign(facade) * 0.18,
        0.36,
        15.3,
        0.28,
        rotation,
      );
    }
    for (const y of [3.45, 16.15]) {
      localBox(
        builder,
        stationStone,
        point,
        0,
        y,
        facade + Math.sign(facade) * 0.2,
        142.2,
        0.34,
        0.32,
        rotation,
      );
    }
  }
  // The two end gables expose the arched train shed rather than closing it
  // with a featureless brick wall.
  for (const end of [-1, 1]) {
    const endPoint = localPoint(point, end * 71.55, 0, rotation);
    for (const shedCentre of [-18, 18]) {
      for (let bay = -3; bay <= 3; bay += 1) {
        const across = shedCentre + bay * 5.05;
        const pane = localPoint(
          new Vector3(endPoint.x, point.y, endPoint.z),
          0,
          across,
          rotation,
        );
        const archFactor = Math.sqrt(1 - (bay / 3.5) ** 2);
        const paneBottom = point.y + 17.65;
        const paneTop = point.y + 17.85 + archFactor * 10.2;
        addBox(
          builder,
          DARK_GLASS,
          pane.x,
          (paneBottom + paneTop) / 2,
          pane.z,
          0.28,
          paneTop - paneBottom,
          4.25,
          rotation,
          false,
        );
      }
    }
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
      builder.edges.push(new EdgesGeometry(pipe, 24));
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
    footprintWorld: CUBE_BERLIN_FOOTPRINT_WORLD,
    heightM: CUBE_BERLIN_HEIGHT_M,
    prismIds: CUBE_BERLIN_PRISM_IDS,
    source: "Berlin LoD2 + OSM way 624737072 + 3XN published dimensions",
  };
  group.userData.tearPalace = {
    footprintWorld: TEAR_PALACE_FOOTPRINT_WORLD,
    prismIds: TEAR_PALACE_PRISM_IDS,
    source: "Berlin LoD2 + OSM way 43173495 + Haus der Geschichte",
  };
  group.userData.friedrichstrasseStation = {
    footprintM: [146, 72],
    photoReference:
      "https://commons.wikimedia.org/wiki/File:Bahnhof_Berlin_Friedrichstra%C3%9Fe_-_Detailansicht.jpg",
    roofCount: 2,
    roofProfile:
      "separate barrel vaults, central valley gutter and twin arched end walls",
    source:
      "Berlin LoD2 + OSM station footprint + the listed 1919-25 twin train-shed profile",
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
