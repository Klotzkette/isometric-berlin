import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";

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
    distance_m: 138,
    polar_degrees: 58,
    target_height_m: 11,
  },
  "Bundesministerium der Finanzen / Detlev-Rohwedder-Haus": {
    azimuth_degrees: -68,
    distance_m: 224,
    polar_degrees: 58,
    target_height_m: 17,
  },
  Futurium: {
    azimuth_degrees: 30,
    distance_m: 218,
    polar_degrees: 57,
    target_height_m: 10,
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
  return preset ? { ...preset, target_world: landmark.world } : null;
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
    localLampBox(
      builder,
      DARK_GLASS,
      point,
      offset * direction,
      2.25,
      lateral - 1.21,
      7.5,
      1.05,
      0.16,
      rotationY,
    );
    localBox(
      builder,
      STEEL,
      point,
      offset * direction,
      3.03,
      lateral,
      8.2,
      0.24,
      2.2,
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
    addTram(builder, tram, -4.65, rotation, false);
    addTram(builder, tram, 4.65, rotation, true);
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
    localBox(builder, TAXI_IVORY, taxis, x, 0.75, 0, 4.8, 1.18, 1.82, rotation);
    localBox(
      builder,
      DARK_GLASS,
      taxis,
      x - 0.15,
      1.58,
      0,
      2.65,
      0.78,
      1.65,
      rotation,
    );
    localLampBox(
      builder,
      0xf8edc4,
      taxis,
      x - 2.42,
      0.72,
      0,
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
      0,
      0.12,
      0.3,
      1.15,
      rotation,
    );
  }
}

function addFuturium(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(byName, "Futurium");
  if (!point) return;
  const rotation = -0.07;
  localBox(builder, IVORY, point, 0, 10.1, 0, 70, 19.6, 84, rotation);
  localBox(builder, STEEL, point, 0, 20.25, 0, 73, 0.7, 87, rotation);
  localLampBox(
    builder,
    DARK_GLASS,
    point,
    0,
    10.3,
    -42.25,
    28,
    8,
    0.36,
    rotation,
  );
  localLampBox(
    builder,
    DARK_GLASS,
    point,
    0,
    11.8,
    42.25,
    28,
    11,
    0.36,
    rotation,
  );
  localBox(builder, IVORY, point, 0, 18.2, -49, 40, 1.2, 18, rotation);
  localBox(builder, IVORY, point, 0, 18.2, 49, 40, 1.2, 18, rotation);
  for (let row = 0; row < 8; row += 1) {
    for (let bay = 0; bay < 14; bay += 1) {
      localBox(
        builder,
        (row + bay) % 2 === 0 ? LIMESTONE : IVORY,
        point,
        -32.5 + bay * 5,
        2.5 + row * 2.1,
        -42.48,
        4.55,
        1.72,
        0.16,
        rotation,
        false,
      );
    }
  }
  for (let row = 0; row < 6; row += 1) {
    for (let bay = 0; bay < 12; bay += 1) {
      localBox(
        builder,
        DARK_GLASS,
        point,
        -29.7 + bay * 5.4,
        20.75,
        -27 + row * 10.8,
        4.6,
        0.2,
        9.7,
        rotation,
        false,
      );
    }
  }
  addCylinder(
    builder,
    STEEL,
    point.x + 30,
    point.y + 8,
    point.z - 52,
    2.2,
    15,
    18,
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

function addBerlinerEnsemble(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const source = anchor(byName, "Berliner Ensemble");
  if (!source) return;
  const point = source.clone().add(new Vector3(24, 0, 13));
  const rotation = -0.12;
  localBox(builder, IVORY, point, 0, 10, 0, 44, 19, 43, rotation);
  localBox(builder, SANDSTONE, point, 0, 20, 0, 48, 1.2, 47, rotation);
  for (const x of [-17, -11.3, -5.6, 0, 5.6, 11.3, 17]) {
    localBox(
      builder,
      SANDSTONE,
      point,
      x,
      10.5,
      21.75,
      0.72,
      18,
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
    startY: 5,
    width: 2.5,
  });
  localBox(builder, DARK_BRICK, point, 0, 18.4, 22.2, 22, 2.1, 0.2, rotation);
}

function addFriedrichstrasseStation(
  builder: Builder,
  byName: Map<string, CentralCivicLandmark>,
): void {
  const point = anchor(byName, "Bahnhof Berlin Friedrichstraße");
  if (!point) return;
  const rotation = -0.03;
  localBox(builder, BRICK, point, 0, 9.5, 0, 143, 17.8, 72, rotation);
  localBox(builder, DARK_GLASS, point, 0, 19.4, 0, 146, 1.2, 74, rotation);
  for (let x = -68; x <= 68; x += 8.5) {
    localBox(builder, STEEL, point, x, 23, 0, 0.42, 8, 72, rotation);
  }
  for (let z = -31; z <= 31; z += 6.2) {
    localBox(
      builder,
      GLASS,
      point,
      0,
      24.2 - Math.abs(z) * 0.08,
      z,
      144,
      0.42,
      5.4,
      rotation,
    );
  }
  addFacadeGrid(builder, point, {
    bays: 18,
    baySpacing: 7.4,
    floors: 3,
    floorSpacing: 4.5,
    frontZ: 36.15,
    rotationY: rotation,
    startY: 5.1,
    width: 3.8,
  });
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
): Mesh {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.56,
    fieldColor,
    letterColor,
    text,
    texelsPerMetre: 180,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
    : new MeshBasicMaterial({ color: fieldColor, side: DoubleSide });
  const nightMaterial = texture
    ? new MeshStandardMaterial({
        emissive: 0xffd8a0,
        emissiveIntensity: 0.7,
        map: texture,
        side: DoubleSide,
      })
    : new MeshStandardMaterial({ color: fieldColor, side: DoubleSide });
  const sign = new Mesh(new PlaneGeometry(width, height), dayMaterial);
  const position = localPoint(point, offset[0], offset[2], rotationY);
  sign.position.set(position.x, point.y + offset[1], position.z);
  sign.rotation.y = rotationY;
  sign.name = `${text} civic lettering`;
  sign.userData.dayMaterial = dayMaterial;
  sign.userData.nightMaterial = nightMaterial;
  return sign;
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
  group.userData.topographyWall = {
    lengthM: TOPOGRAPHY_WALL_LENGTH_M,
    sectionCount: TOPOGRAPHY_WALL_SECTION_COUNT,
    source: "Topography of Terror / Niederkirchnerstrasse monument",
    state: "preserved 1989/90 ruin with security fence",
    traceRotationRad: TOPOGRAPHY_WALL_ROTATION_RAD,
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
  addBerlinerEnsemble(builder, byName);
  addFriedrichstrasseStation(builder, byName);
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
