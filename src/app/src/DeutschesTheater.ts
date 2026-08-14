import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
import {
  type Builder,
  addCylinder,
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

/** All measured LoD2 parts belonging to the Deutsches Theater complex. */
export const DEUTSCHES_THEATER_IDS: ReadonlySet<string> = new Set([
  "LEaiCoHv",
  "5900rDXT",
  "TVjCvFcI",
  "w0A6rPvQ",
  "4vIq6DK9",
  "QLSg6nV9",
  "WwxTDJwU",
  "zm7N7YGT",
  "wZRgel5C",
  "oddSxe3z",
  "V4fdozio",
  "KeeAYa8r",
  "MPYEt4l1",
  "KrRtuMPb",
  "ixchshjg",
]);

/** The pale-sage Kammerspiele volumes, distinct from the ivory main theatre. */
export const DEUTSCHES_THEATER_KAMMERSPIELE_IDS: ReadonlySet<string> = new Set([
  "TVjCvFcI",
  "w0A6rPvQ",
  "KeeAYa8r",
  "ixchshjg",
]);

export const DEUTSCHES_THEATER_MAIN_IDS: ReadonlySet<string> = new Set(
  [...DEUTSCHES_THEATER_IDS].filter(
    (id) => !DEUTSCHES_THEATER_KAMMERSPIELE_IDS.has(id),
  ),
);

/** These fronts receive their complete documented window rhythm here. */
export const DEUTSCHES_THEATER_CUSTOM_FACADE_IDS: ReadonlySet<string> =
  new Set(["TVjCvFcI", "wZRgel5C", "KeeAYa8r"]);

export const DEUTSCHES_THEATER_PROFILE = {
  address: "Schumannstrasse 13a, 10117 Berlin",
  built: 1850,
  geometryStatus:
    "exact Berlin LoD2 footprints and measured heights retained; facade articulation, garden furniture and rooftop sign are deterministic photo-bounded reconstructions within the measured ensemble envelope",
  lod2Parent: "DEBE01YYK00002VR",
  name: "Deutsches Theater und Kammerspiele",
  osmNodeId: "345806623",
  sourceUrls: [
    "https://www.deutschestheater.de/das-deutsche-theater/profil",
    "https://www.deutschestheater.de/kontakt/",
    "https://commons.wikimedia.org/wiki/Category:Deutsches_Theater_und_Kammerspiele_Building",
    "https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_01.jpg",
  ],
} as const;

export const DEUTSCHES_THEATER_TONES = {
  corten: 0x9b563f,
  facadeIvory: 0xeeece5,
  facadeShade: 0xdeddd7,
  frame: 0xf6f3eb,
  gardenDark: 0x355c3d,
  gardenLight: 0x527c4f,
  glass: 0x607a82,
  gold: 0xc7a64d,
  kammerspiele: 0xcbd8ca,
  kammerspieleShade: 0xb8c9b9,
  nightGlass: 0xffc86f,
  slate: 0x566267,
  steel: 0x343d3e,
  stone: 0xd4d0c6,
} as const;

const MAIN_FRONT_ID = "wZRgel5C";
const MAIN_FRONT_WALL = 4;
const KAMMERSPIELE_FRONT_ID = "TVjCvFcI";
const KAMMERSPIELE_FRONT_WALL = 1;

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
      `Missing wall ${index} on Deutsches Theater part ${building.id}`,
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

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  lamp = false,
  inked = false,
): void {
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
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
  geometry.rotateY(-Math.atan2(wall.dirZ, wall.dirX));
  const [x, resolvedY, z] = wallPoint(wall, along, y, outward);
  geometry.translate(x, resolvedY, z);
  addPaintedGeometry(builder, geometry, color, lamp, inked);
}

function addWallShape(
  builder: Builder,
  wall: FacadeWall,
  shape: Shape,
  color: number,
  along: number,
  bottomY: number,
  outward: number,
  lamp = false,
  inked = false,
): void {
  const geometry = new ShapeGeometry(shape, 12);
  const matrix = new Matrix4();
  matrix.set(
    wall.dirX,
    0,
    wall.nx,
    wall.x1 + wall.dirX * along + wall.nx * outward,
    0,
    1,
    0,
    bottomY,
    wall.dirZ,
    0,
    wall.nz,
    wall.z1 + wall.dirZ * along + wall.nz * outward,
    0,
    0,
    0,
    1,
  );
  geometry.applyMatrix4(matrix);
  addPaintedGeometry(builder, geometry, color, lamp, inked);
}

function addWallBeam(
  builder: Builder,
  wall: FacadeWall,
  color: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  width: number,
  lamp = false,
): void {
  const startWorld = new Vector3(...wallPoint(wall, start[0], start[1], start[2]));
  const endWorld = new Vector3(...wallPoint(wall, end[0], end[1], end[2]));
  const delta = endWorld.clone().sub(startWorld);
  const length = delta.length();
  if (length < 1e-5) return;
  const geometry = new BoxGeometry(width, length, width);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()),
  );
  geometry.translate(
    (startWorld.x + endWorld.x) / 2,
    (startWorld.y + endWorld.y) / 2,
    (startWorld.z + endWorld.z) / 2,
  );
  addPaintedGeometry(builder, geometry, color, lamp);
}

function archedShape(width: number, height: number): Shape {
  const radius = width / 2;
  const shoulder = height - radius;
  const shape = new Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, shoulder);
  shape.absarc(0, shoulder, radius, 0, Math.PI, false);
  shape.closePath();
  return shape;
}

function triangleShape(width: number, height: number): Shape {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return shape;
}

function addArchedWindow(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  bottomY: number,
  width: number,
  height: number,
  outward: number,
): void {
  addWallShape(
    builder,
    wall,
    archedShape(width + 0.38, height + 0.34),
    DEUTSCHES_THEATER_TONES.frame,
    along,
    bottomY - 0.17,
    outward,
    false,
    true,
  );
  addWallShape(
    builder,
    wall,
    archedShape(width, height),
    DEUTSCHES_THEATER_TONES.glass,
    along,
    bottomY,
    outward + 0.018,
    true,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    along,
    bottomY + height * 0.43,
    outward + 0.035,
    0.1,
    height * 0.78,
    0.045,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    along,
    bottomY + height * 0.37,
    outward + 0.038,
    width * 0.96,
    0.09,
    0.045,
  );
}

function addRectangularWindow(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  y: number,
  width: number,
  height: number,
  outward: number,
  shutters = false,
): void {
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    along,
    y,
    outward,
    width + 0.34,
    height + 0.34,
    0.1,
    false,
    true,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.glass,
    along,
    y,
    outward + 0.065,
    width,
    height,
    0.055,
    true,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    along,
    y,
    outward + 0.105,
    0.075,
    height,
    0.035,
  );
  if (shutters) {
    for (const side of [-1, 1]) {
      addWallBox(
        builder,
        wall,
        DEUTSCHES_THEATER_TONES.frame,
        along + side * (width * 0.63),
        y,
        outward + 0.035,
        width * 0.2,
        height + 0.18,
        0.08,
      );
    }
  }
}

function createFacadeText(
  text: string,
  wall: FacadeWall,
  along: number,
  y: number,
  outward: number,
  width: number,
  height: number,
): Mesh {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.58,
    fieldColor: "rgba(0,0,0,0)",
    letterColor: "#b3913e",
    text,
    texelsPerMetre: 220,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({
        alphaTest: 0.08,
        depthWrite: false,
        map: texture,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshBasicMaterial({ opacity: 0, transparent: true });
  const nightMaterial = texture
    ? new MeshStandardMaterial({
        alphaTest: 0.08,
        depthWrite: false,
        emissive: DEUTSCHES_THEATER_TONES.gold,
        emissiveIntensity: 0.72,
        map: texture,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshStandardMaterial({ opacity: 0, transparent: true });
  const sign = new Mesh(new PlaneGeometry(width, height), dayMaterial);
  const [x, resolvedY, z] = wallPoint(wall, along, y, outward);
  sign.position.set(x, resolvedY, z);
  sign.rotation.y = -Math.atan2(wall.dirZ, wall.dirX);
  sign.name = `${text} Deutsches Theater lettering`;
  sign.renderOrder = 4;
  sign.userData.dayMaterial = dayMaterial;
  sign.userData.nightMaterial = nightMaterial;
  sign.userData.sourceBounded = true;
  return sign;
}

function addMainFacade(
  builder: Builder,
  labels: Group,
  building: PrismBuilding,
): number {
  const wall = wallOf(building, MAIN_FRONT_WALL);
  const y0 = building.y0_dm / 10;
  const outward = 0.15;

  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.facadeIvory,
    wall.length / 2,
    y0 + 7.15,
    outward,
    wall.length + 0.12,
    14.3,
    0.14,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.stone,
    wall.length / 2,
    y0 + 0.55,
    outward + 0.02,
    wall.length + 0.35,
    1.1,
    0.18,
    false,
    true,
  );

  const centres = [wall.length * 0.38, wall.length * 0.62];
  for (const along of centres) {
    addArchedWindow(builder, wall, along, y0 + 4.55, 2.05, 6.4, outward + 0.09);
    addRectangularWindow(
      builder,
      wall,
      along,
      y0 + 1.7,
      1.45,
      2.9,
      outward + 0.1,
    );
  }
  for (const along of [wall.length * 0.12, wall.length * 0.88]) {
    addRectangularWindow(
      builder,
      wall,
      along,
      y0 + 4.05,
      1.15,
      3.35,
      outward + 0.09,
    );
    addRectangularWindow(
      builder,
      wall,
      along,
      y0 + 9.85,
      1.05,
      1.55,
      outward + 0.09,
    );
  }

  for (const along of [
    0.45,
    wall.length * 0.29,
    wall.length * 0.71,
    wall.length - 0.45,
  ]) {
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.frame,
      along,
      y0 + 6.8,
      outward + 0.24,
      0.48,
      12.5,
      0.42,
      false,
      true,
    );
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.stone,
      along,
      y0 + 0.62,
      outward + 0.33,
      0.76,
      0.48,
      0.58,
    );
  }

  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    wall.length / 2,
    y0 + 13.05,
    outward + 0.22,
    wall.length + 0.7,
    0.45,
    0.42,
    false,
    true,
  );
  addWallShape(
    builder,
    wall,
    triangleShape(wall.length + 0.38, 2.35),
    DEUTSCHES_THEATER_TONES.facadeIvory,
    wall.length / 2,
    y0 + 13.2,
    outward + 0.16,
    false,
    true,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    wall.length / 2,
    y0 + 15.62,
    outward + 0.15,
    0.62,
    0.36,
    0.25,
  );

  // The shallow glazed entrance canopy and the first-floor iron balcony are
  // the two horizontal registers that keep the main house from reading as a
  // flat temple front.
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.glass,
    wall.length / 2,
    y0 + 3.38,
    outward + 0.82,
    6.7,
    0.16,
    1.35,
    false,
    true,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    wall.length / 2,
    y0 + 3.33,
    outward + 1.5,
    6.85,
    0.22,
    0.12,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.steel,
    wall.length / 2,
    y0 + 4.58,
    outward + 0.47,
    wall.length - 1.45,
    0.09,
    0.09,
  );
  for (let index = 0; index <= 14; index += 1) {
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.steel,
      0.78 + index * ((wall.length - 1.56) / 14),
      y0 + 4.23,
      outward + 0.47,
      0.07,
      0.68,
      0.07,
    );
  }

  labels.add(
    createFacadeText(
      "DEUTSCHES THEATER",
      wall,
      wall.length / 2,
      y0 + 12.38,
      outward + 0.47,
      8.9,
      0.62,
    ),
  );
  labels.add(
    createFacadeText(
      "DT",
      wall,
      wall.length / 2,
      y0 + 14.36,
      outward + 0.39,
      1.05,
      0.92,
    ),
  );

  for (let step = 0; step < 3; step += 1) {
    const depth = 1.55 - step * 0.36;
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.stone,
      wall.length / 2,
      y0 + 0.1 + step * 0.18,
      outward + 0.75 - step * 0.21,
      9.2 - step * 0.38,
      0.2,
      depth,
      false,
      step === 0,
    );
  }
  for (let index = 0; index <= 10; index += 1) {
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.frame,
      1.15 + index * ((wall.length - 2.3) / 10),
      y0 + 1.45,
      outward + 1.32,
      0.09,
      1.45,
      0.09,
    );
  }
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    wall.length / 2,
    y0 + 2.14,
    outward + 1.32,
    wall.length - 2.1,
    0.1,
    0.1,
  );
  return 8;
}

function addKammerspieleFacade(
  builder: Builder,
  labels: Group,
  building: PrismBuilding,
): number {
  const wall = wallOf(building, KAMMERSPIELE_FRONT_WALL);
  const y0 = building.y0_dm / 10;
  const outward = 0.15;
  const facadeHeight = 16.45;
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.kammerspiele,
    wall.length / 2,
    y0 + facadeHeight / 2,
    outward,
    wall.length + 0.14,
    facadeHeight,
    0.14,
  );
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.kammerspieleShade,
    wall.length / 2,
    y0 + 0.52,
    outward + 0.02,
    wall.length + 0.22,
    1.04,
    0.18,
  );

  const bays = 7;
  const pitch = wall.length / bays;
  for (let bay = 0; bay < bays; bay += 1) {
    const along = pitch * (bay + 0.5);
    addRectangularWindow(
      builder,
      wall,
      along,
      y0 + 3.25,
      Math.min(2.15, pitch * 0.58),
      4.15,
      outward + 0.08,
      true,
    );
    addArchedWindow(
      builder,
      wall,
      along,
      y0 + 8.45,
      Math.min(2.15, pitch * 0.58),
      5.45,
      outward + 0.08,
    );
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.steel,
      along,
      y0 + 8.82,
      outward + 0.18,
      Math.min(2.35, pitch * 0.64),
      0.11,
      0.11,
    );
  }
  addWallBox(
    builder,
    wall,
    DEUTSCHES_THEATER_TONES.frame,
    wall.length / 2,
    y0 + 15.82,
    outward + 0.06,
    wall.length + 0.35,
    0.34,
    0.24,
    false,
    true,
  );
  addWallShape(
    builder,
    wall,
    triangleShape(15.2, 1.25),
    DEUTSCHES_THEATER_TONES.kammerspiele,
    wall.length / 2,
    y0 + 16.05,
    outward + 0.06,
    false,
    true,
  );
  labels.add(
    createFacadeText(
      "KAMMERSPIELE",
      wall,
      wall.length / 2,
      y0 + 15.15,
      outward + 0.31,
      9.4,
      0.5,
    ),
  );
  labels.add(
    createFacadeText(
      "DES DEUTSCHEN THEATERS",
      wall,
      wall.length / 2,
      y0 + 14.48,
      outward + 0.31,
      10.3,
      0.42,
    ),
  );
  return bays * 2;
}

function addSideWindowRhythm(
  builder: Builder,
  building: PrismBuilding,
  skippedWallIndex: number,
  sage: boolean,
): number {
  const y0 = building.y0_dm / 10;
  const height = building.h_dm / 10;
  const facadeTop = y0 + Math.max(8, height - 4.8);
  let windows = 0;
  for (const wall of ringWalls(building.ring)) {
    if (wall.index === skippedWallIndex || wall.length < 4.5) continue;
    const bays = Math.max(1, Math.floor((wall.length - 1.2) / 3.5));
    const pitch = (wall.length - 1.2) / bays;
    const floors = Math.max(1, Math.floor((facadeTop - y0 - 1.8) / 3.7));
    for (let floor = 0; floor < floors; floor += 1) {
      for (let bay = 0; bay < bays; bay += 1) {
        addRectangularWindow(
          builder,
          wall,
          0.6 + pitch * (bay + 0.5),
          y0 + 2.15 + floor * 3.7,
          Math.min(1.45, pitch * 0.52),
          2.25,
          0.15,
          sage && floor === 0,
        );
        windows += 1;
      }
    }
  }
  return windows;
}

function addRooftopDtSign(builder: Builder, wall: FacadeWall): void {
  const centre = -1.75;
  const face = 0.28;
  const frameColor = DEUTSCHES_THEATER_TONES.steel;
  const gold = DEUTSCHES_THEATER_TONES.gold;
  addWallBeam(
    builder,
    wall,
    frameColor,
    [centre - 3.2, 25.2, face],
    [centre, 29.7, face],
    0.1,
  );
  addWallBeam(
    builder,
    wall,
    frameColor,
    [centre + 3.2, 25.2, face],
    [centre, 29.7, face],
    0.1,
  );
  addWallBeam(
    builder,
    wall,
    frameColor,
    [centre - 3.2, 25.2, face],
    [centre + 3.2, 25.2, face],
    0.1,
  );
  addWallBeam(
    builder,
    wall,
    gold,
    [centre - 1.55, 27.25, face + 0.05],
    [centre - 1.55, 29.55, face + 0.05],
    0.16,
    true,
  );
  const outline: readonly [number, number][] = [
    [-1.55, 29.55],
    [0.65, 29.55],
    [1.35, 29.34],
    [1.75, 28.82],
    [1.75, 28.0],
    [1.35, 27.48],
    [0.65, 27.25],
    [-1.55, 27.25],
  ];
  for (let index = 0; index < outline.length - 1; index += 1) {
    const start = outline[index];
    const end = outline[index + 1];
    addWallBeam(
      builder,
      wall,
      gold,
      [centre + start[0], start[1], face + 0.05],
      [centre + end[0], end[1], face + 0.05],
      0.16,
      true,
    );
  }
  addWallBeam(
    builder,
    wall,
    gold,
    [centre - 1.2, 29.08, face + 0.08],
    [centre + 0.2, 29.08, face + 0.08],
    0.13,
    true,
  );
  addWallBeam(
    builder,
    wall,
    gold,
    [centre - 0.5, 27.75, face + 0.08],
    [centre - 0.5, 29.08, face + 0.08],
    0.13,
    true,
  );
}

function addFrontGarden(builder: Builder, wall: FacadeWall, y0: number): void {
  const segments = [
    [3.2, 6.6],
    [10.4, 7.2],
    [18.2, 7.2],
    [25.6, 5.2],
  ] as const;
  for (const [along, width] of segments) {
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.corten,
      along,
      y0 + 0.3,
      6.3,
      width,
      0.6,
      2.3,
      false,
      true,
    );
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.gardenDark,
      along,
      y0 + 1.28,
      6.3,
      width - 0.28,
      1.45,
      2.05,
      false,
      false,
    );
    addWallBox(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.gardenLight,
      along,
      y0 + 2.02,
      6.25,
      width - 0.7,
      0.36,
      1.72,
      false,
      false,
    );
  }

  for (const along of [6.8, 23.4]) {
    const [x, , z] = wallPoint(wall, along, y0, 3.35);
    addCylinder(
      builder,
      DEUTSCHES_THEATER_TONES.steel,
      x,
      y0 + 2.05,
      z,
      0.09,
      4.1,
      8,
    );
    addWallBeam(
      builder,
      wall,
      DEUTSCHES_THEATER_TONES.steel,
      [along - 0.72, y0 + 3.75, 3.35],
      [along + 0.72, y0 + 3.75, 3.35],
      0.08,
    );
    for (const side of [-1, 1]) {
      addWallBox(
        builder,
        wall,
        0xf2d79a,
        along + side * 0.72,
        y0 + 3.52,
        3.35,
        0.38,
        0.48,
        0.38,
        true,
        true,
      );
    }
  }
}

/**
 * Fine, source-bounded recognition layer over the untouched official shells.
 */
export function createDeutschesTheater(prisms: PrismPayload): Group {
  const group = new Group();
  group.name = "Deutsches Theater details";
  const builder = createBuilder();
  const labels = new Group();
  labels.name = "Deutsches Theater facade lettering";
  const byId = new Map(
    prisms.buildings.map((building) => [building.id, building]),
  );
  const main = byId.get(MAIN_FRONT_ID);
  const kammerspiele = byId.get(KAMMERSPIELE_FRONT_ID);
  if (!main || !kammerspiele) {
    group.userData.geometryStatus = "required LoD2 parts missing";
    return group;
  }

  let windows = addMainFacade(builder, labels, main);
  windows += addKammerspieleFacade(builder, labels, kammerspiele);
  windows += addSideWindowRhythm(builder, main, MAIN_FRONT_WALL, false);
  windows += addSideWindowRhythm(
    builder,
    kammerspiele,
    KAMMERSPIELE_FRONT_WALL,
    true,
  );
  const kammerspieleWall = wallOf(kammerspiele, KAMMERSPIELE_FRONT_WALL);
  addRooftopDtSign(builder, kammerspieleWall);
  addFrontGarden(builder, kammerspieleWall, kammerspiele.y0_dm / 10);

  const details = finishDrawnGroup(builder, {
    lampEmissive: DEUTSCHES_THEATER_TONES.nightGlass,
    lampEmissiveIntensity: 0.68,
    name: "Deutsches Theater architectural details",
  });
  if (details) group.add(details);
  group.add(labels);
  group.userData.architecturalProfile = DEUTSCHES_THEATER_PROFILE;
  group.userData.detailCounts = {
    facadeLabels: labels.children.length,
    sourcePrisms: DEUTSCHES_THEATER_IDS.size,
    windows,
  };
  group.userData.geometryStatus = DEUTSCHES_THEATER_PROFILE.geometryStatus;
  group.userData.rooftopMark = "DT";
  return group;
}
