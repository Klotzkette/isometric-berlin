import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  Matrix4,
  Mesh,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from "three";

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

type OrientedBox = {
  along: number;
  centreY: number;
  depth: number;
  height: number;
  outward: number;
  width: number;
};

/** The complete two-parent official LoD2 ensemble; no source prism is replaced. */
export const REICHSTAGSPRAESIDENTENPALAIS_IDS: ReadonlySet<string> = new Set([
  "1gEfIRTG",
  "JRUA1rbq",
  "C2lCpqK5",
  "mUPhydAs",
  "cojdzbig",
  "zMovgLdU",
  "NkNHQuNp",
  "y2n0A1dj",
  "rTIZwx4H",
  "4ccKsLeW",
]);

export const REICHSTAGSPRAESIDENTENPALAIS_PARENTS: ReadonlySet<string> =
  new Set(["DEBE01YYK00008oJ", "DEBE01YYK000057I"]);

/** Nearby Jakob-Kaiser-Haus prisms are intentionally outside this ensemble. */
export const REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_PARENT =
  "DEBE01YYK00001Li";

export const REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_IDS: ReadonlySet<string> =
  new Set([
    "8Xin7PqI",
    "5ITeMfv2",
    "8bMtIR4M",
    "ZnvQ4nLq",
    "BJBxg2ub",
    "9RhopAvB",
    "kslsuKgM",
    "1IAjmM1x",
  ]);

/** Pitched LoD2 carriers whose visible roofs are documented gray slate. */
export const REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS: ReadonlySet<string> =
  new Set([
    "1gEfIRTG",
    "mUPhydAs",
    "zMovgLdU",
    "NkNHQuNp",
    "y2n0A1dj",
    "rTIZwx4H",
    "4ccKsLeW",
  ]);

/** Generic gable chimneys are not evidenced on these two high roof carriers. */
export const REICHSTAGSPRAESIDENTENPALAIS_GENERIC_CHIMNEY_SUPPRESSED_IDS: ReadonlySet<string> =
  new Set(["1gEfIRTG", "zMovgLdU"]);

/** Exact LoD2 walls receiving a complete, individually authored facade. */
export const REICHSTAGSPRAESIDENTENPALAIS_FULLY_DETAILED_WALL_INDICES = {
  "1gEfIRTG": [1],
  rTIZwx4H: [0],
  y2n0A1dj: [2, 3],
  zMovgLdU: [0],
} as const;

export function isReichstagspraesidentenpalaisFullyDetailedWall(
  id: string,
  index: number,
): boolean {
  const indices = (
    REICHSTAGSPRAESIDENTENPALAIS_FULLY_DETAILED_WALL_INDICES as Readonly<
      Record<string, readonly number[]>
    >
  )[id];
  return indices?.includes(index) ?? false;
}

/** Authored fronts plus source-prism seams that must never get generic rhythm. */
export const REICHSTAGSPRAESIDENTENPALAIS_SECONDARY_RHYTHM_EXCLUDED_WALL_INDICES =
  {
    "1gEfIRTG": [1],
    rTIZwx4H: [0],
    y2n0A1dj: [2, 3],
    zMovgLdU: [0, 2],
  } as const;

export function isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall(
  id: string,
  index: number,
): boolean {
  const indices = (
    REICHSTAGSPRAESIDENTENPALAIS_SECONDARY_RHYTHM_EXCLUDED_WALL_INDICES as Readonly<
      Record<string, readonly number[]>
    >
  )[id];
  return indices?.includes(index) ?? false;
}

export const REICHSTAGSPRAESIDENTENPALAIS_TONES = {
  balustrade: 0xd2bc86,
  darkGlass: 0x435158,
  gardenHedge: 0x40583e,
  gardenHedgeLight: 0x526a4a,
  glass: 0x67747a,
  metal: 0x3f4544,
  nightGlass: 0xf0b86b,
  sandstone: 0xcfb778,
  sandstoneHighlight: 0xdbc88f,
  sandstoneShade: 0xbba368,
  slate: 0x4d555b,
  slateHighlight: 0x646b70,
  wood: 0x4f3327,
} as const;

export const REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME =
  "Reichstagspräsidentenpalais persistent architectural details";
export const REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME =
  "Reichstagspräsidentenpalais micro facade details";
export const REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME =
  "Reichstagspräsidentenpalais garden enclosure";

export const REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_OBJECT_NAMES = [
  REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME,
  `${REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME} bodies`,
  `${REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME} ink lines`,
  REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME,
  `${REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME} bodies`,
  `${REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME} ink lines`,
] as const;

export const REICHSTAGSPRAESIDENTENPALAIS_MICRO_OBJECT_NAMES = [
  REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME,
  `${REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME} bodies`,
  `${REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME} lamps`,
  `${REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME} ink lines`,
] as const;

export const REICHSTAGSPRAESIDENTENPALAIS_AXIS_LAYOUT = {
  kaisersaal: {
    archedWindowAxes: 3,
    sourcePrismId: "rTIZwx4H",
    wallIndex: 0,
  },
  north: {
    axisCount: 7,
    balconyCarrierId: "JRUA1rbq",
    colossalColumnCount: 6,
    outerFacadeId: "y2n0A1dj",
    porticoBayCount: 5,
    porticoCarrierId: "zMovgLdU",
    porticoFrontWallIndex: 0,
  },
  west: {
    axisCount: 6,
    axisNumbering: "north-to-south",
    erkerAxis: 5,
    ornateAxes: [4, 6],
    pedimentedBalconyAxes: [1, 2, 3],
    portalAndOculusAxis: 4,
  },
} as const;

const GARDEN_WALL_WAY_437493373 = [
  [417.279, -20.385],
  [427.538, -14.457],
  [441.048, -7.888],
  [456.74, -1.449],
  [468.211, 2.804],
  [478.655, 5.987],
] as const;

const GARDEN_WALL_WAY_1379191721 = [
  [417.279, -20.385],
  [410.057, -15.595],
  [409.132, 14.996],
] as const;

const GARDEN_HEDGE_WAY_437493370 = [
  [493.537, 10.405],
  [478.655, 5.987],
] as const;

const GARDEN_WALL_BASE_Y = 4.6;
const GARDEN_WALL_HEIGHT = 2.05;
const GARDEN_WALL_THICKNESS = 0.32;

export const REICHSTAGSPRAESIDENTENPALAIS_PROFILE = {
  address: "Friedrich-Ebert-Platz 2, 10117 Berlin",
  architect: "Paul Wallot",
  built: "1899-1904; handed over January 1904",
  dimensionsM: {
    lod2UnionBoundsXZ: [407.8, 468.8, 12.8, 49.1],
    storeyHeightsHistorical: [5, 5.5, 4.5],
  },
  facade: {
    material:
      "yellow Wünschelburger sandstone; joints and colour are a deterministic display reconstruction",
    north:
      "seven axes; five-bay colossal Corinthian temple portico with six columns and triangular pediment",
    west: "six axes; three pedimented balcony windows, ornate fourth and sixth axes, two-storey three-sided erker, carriage door and smaller portal with oculus",
    kaisersaal:
      "east, slightly receding hall with three tall arched north windows and a broad longitudinal garden stair",
    secondaryExteriorRhythm:
      "photo-bounded dark-wood cross-window rhythm on exposed outer walls only; counts and spacing are display approximations",
  },
  geometryStatus:
    "all ten official Berlin LoD2 envelopes remain untouched; this is an additive thin recognition layer with separately named persistent architecture, fadeable micro-facade detail, and source-bounded garden enclosure; no opaque replacement envelope and no photo texture",
  gardenEnclosure: {
    hedgeWayId: "437493370",
    hedgeWorldLineM: GARDEN_HEDGE_WAY_437493370,
    omittedRetainingWallWayId: "437493369",
    wallBaseElevationStatus:
      "display approximation tied to the nearby 5.2 m LoD2 facade base",
    wallHeightM: GARDEN_WALL_HEIGHT,
    wallHeightStatus: "photo-derived display approximation",
    wallWayIds: ["437493373", "1379191721"],
    wallWorldLinesM: [GARDEN_WALL_WAY_437493373, GARDEN_WALL_WAY_1379191721],
  },
  lod2Function: "31001_3011",
  lod2Parents: ["DEBE01YYK00008oJ", "DEBE01YYK000057I"],
  name: "Reichstagspräsidentenpalais / Deutsche Parlamentarische Gesellschaft",
  omissions: {
    courtyardGlassRoof:
      "omitted: restoration source confirms it, but current LoD2 courtyard bounds are not defensible enough for exact placement",
    retainingWall437493369:
      "omitted to avoid duplicating the existing retaining-wall representation",
  },
  osm: {
    dpgNodeId: "5443120622",
    palaceWayId: "37408952",
  },
  roofToneDecision:
    "gray slate applies only to the seven pitched roof carriers; flat/low parts C2lCpqK5, JRUA1rbq and cojdzbig are excluded",
  sourceAttributions: [
    {
      artist: "Jörg Zägel (Wikimedia Commons user Beek100)",
      author: "Jörg Zägel (Wikimedia Commons user Beek100)",
      credit: "Photograph: Jörg Zägel, Wikimedia Commons (public domain)",
      file: "Reichstagspräsidentenpalais, Westfassade.jpg",
      license: "Public domain",
      licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Reichstagspr%C3%A4sidentenpalais,_Westfassade.jpg",
      role: "reference-only; not bundled and not used as a texture",
      title: "Reichstagspräsidentenpalais, Westfassade",
      url: "https://commons.wikimedia.org/wiki/File:Reichstagspr%C3%A4sidentenpalais,_Westfassade.jpg",
    },
    {
      artist: "Jörg Zägel (Wikimedia Commons user Beek100)",
      author: "Jörg Zägel (Wikimedia Commons user Beek100)",
      credit:
        "Photograph: Jörg Zägel, Wikimedia Commons, licensed CC BY-SA 4.0",
      file: "Reichstagspräsidentenpalais, Nordseite.jpg",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Reichstagspr%C3%A4sidentenpalais,_Nordseite.jpg",
      role: "reference-only; not bundled and not used as a texture",
      title: "Reichstagspräsidentenpalais, Nordseite",
      url: "https://commons.wikimedia.org/wiki/File:Reichstagspr%C3%A4sidentenpalais,_Nordseite.jpg",
    },
  ],
  sourceUrls: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065047",
    "https://www.btg-bestellservice.de/pdf/40311000.pdf",
    "https://upload.wikimedia.org/wikipedia/commons/2/2b/Bl%C3%A4tter_f%C3%BCr_Architektur_und_Kunsthandwerk_%28IA_blatterfurarchit17unse%29.pdf",
    "https://www.brenne-architekten.de/reichstagspraesidentenpalais/",
    "https://www.kusus-architekten.de/berlin/projekte/kaisersaal.php",
    "https://www.bundestag.de/besuche/architektur/kaiserhaus/architektur",
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
    if (length < 0.15) continue;
    walls.push({
      dirX: dx / length,
      dirZ: dz / length,
      index,
      length,
      nx: (dz / length) * flip,
      nz: (-dx / length) * flip,
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
      `Missing wall ${index} on Reichstagspräsidentenpalais part ${building.id}`,
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

function triangleShape(width: number, height: number): Shape {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return shape;
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

function cartoucheShape(width: number, height: number): Shape {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    width * 0.22,
    0,
    width * 0.5,
    height * 0.14,
    width * 0.4,
    height * 0.38,
  );
  shape.bezierCurveTo(
    width * 0.56,
    height * 0.56,
    width * 0.34,
    height * 0.91,
    0,
    height,
  );
  shape.bezierCurveTo(
    -width * 0.34,
    height * 0.91,
    -width * 0.56,
    height * 0.56,
    -width * 0.4,
    height * 0.38,
  );
  shape.bezierCurveTo(-width * 0.5, height * 0.14, -width * 0.22, 0, 0, 0);
  shape.closePath();
  return shape;
}

function voluteShape(width: number, height: number, handedness: -1 | 1): Shape {
  const x = (value: number) => value * handedness;
  const shape = new Shape();
  shape.moveTo(x(-width * 0.5), 0);
  shape.bezierCurveTo(
    x(width * 0.22),
    height * 0.02,
    x(width * 0.5),
    height * 0.2,
    x(width * 0.12),
    height * 0.38,
  );
  shape.bezierCurveTo(
    x(-width * 0.18),
    height * 0.52,
    x(-width * 0.02),
    height * 0.77,
    x(width * 0.42),
    height,
  );
  shape.lineTo(x(width * 0.1), height * 0.96);
  shape.bezierCurveTo(
    x(-width * 0.42),
    height * 0.75,
    x(-width * 0.42),
    height * 0.42,
    x(-width * 0.04),
    height * 0.25,
  );
  shape.bezierCurveTo(
    x(width * 0.12),
    height * 0.16,
    x(-width * 0.12),
    height * 0.1,
    x(-width * 0.5),
    0,
  );
  shape.closePath();
  return shape;
}

function addCrossWindow(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  centreY: number,
  outward: number,
  width = 2.05,
  height = 2.5,
): void {
  addWallBox(
    builder,
    wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
    along,
    centreY,
    outward,
    width + 0.32,
    height + 0.32,
    0.1,
  );
  addWallBox(
    builder,
    wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.glass,
    along,
    centreY,
    outward + 0.065,
    width,
    height,
    0.055,
    true,
  );
  addWallBox(
    builder,
    wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
    along,
    centreY,
    outward + 0.105,
    0.105,
    height,
    0.065,
  );
  addWallBox(
    builder,
    wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
    along,
    centreY + height * 0.12,
    outward + 0.108,
    width,
    0.1,
    0.065,
  );
}

function addStoneJoints(
  builder: Builder,
  wall: FacadeWall,
  bottomY: number,
  topY: number,
  outward = 0.105,
): number {
  let joints = 0;
  for (let y = bottomY + 1.05; y < topY; y += 1.1) {
    addWallBox(
      builder,
      wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneShade,
      wall.length / 2,
      y,
      outward,
      wall.length - 0.15,
      0.035,
      0.025,
    );
    joints += 1;
  }
  return joints;
}

function addMetalWindowRail(
  builder: Builder,
  wall: FacadeWall,
  along: number,
  y: number,
  outward: number,
  width: number,
): void {
  addWallBox(
    builder,
    wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.metal,
    along,
    y + 0.55,
    outward,
    width,
    0.07,
    0.07,
  );
  for (let index = -2; index <= 2; index += 1) {
    addWallBox(
      builder,
      wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.metal,
      along + (index * width) / 5.4,
      y + 0.27,
      outward,
      0.055,
      0.56,
      0.055,
    );
  }
}

function addNorthFacade(
  persistent: Builder,
  micro: Builder,
  building: PrismBuilding,
  porticoCarrier: PrismBuilding,
  balconyCarrier: PrismBuilding,
): { ashlarJoints: number; windows: number } {
  const wall = wallOf(building, 3);
  const porticoWall = wallOf(porticoCarrier, 0);
  const balconyWall = wallOf(balconyCarrier, 0);
  const y0 = building.y0_dm / 10;
  let windows = 0;
  let ashlarJoints = addStoneJoints(micro, wall, y0 + 0.25, y0 + 20.25);
  ashlarJoints += addStoneJoints(
    micro,
    porticoWall,
    y0 + 0.25,
    y0 + 20.25,
    0.16,
  );

  // Two outer axes stay on the palace wall. The five central axes sit on
  // zMovgLdU's measured north front, so they are not hidden behind that
  // opaque LoD2 carrier.
  for (const along of [wall.length * 0.155, wall.length * 0.845]) {
    for (const centreY of [y0 + 4.9, y0 + 10.55, y0 + 16.15]) {
      addCrossWindow(micro, wall, along, centreY, 0.14);
      windows += 1;
    }
    addMetalWindowRail(micro, wall, along, y0 + 14.55, 0.31, 2.28);
  }

  const centralPitch = porticoWall.length / 5;
  for (let axis = 0; axis < 5; axis += 1) {
    const along = centralPitch * (axis + 0.5);
    for (const centreY of [y0 + 4.9, y0 + 10.55, y0 + 16.15]) {
      addCrossWindow(micro, porticoWall, along, centreY, 0.14, 1.62, 2.5);
      windows += 1;
    }
    addMetalWindowRail(micro, porticoWall, along, y0 + 14.55, 0.36, 1.86);
  }

  const porticoWidth = porticoWall.length;
  addWallBox(
    persistent,
    balconyWall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.balustrade,
    balconyWall.length / 2,
    y0 + 8.15,
    0.34,
    balconyWall.length + 0.4,
    0.42,
    0.78,
    false,
    true,
  );
  for (let index = 0; index < 6; index += 1) {
    const along = (porticoWidth * index) / 5;
    const [x, , z] = wallPoint(porticoWall, along, 0, 0.42);
    addCylinder(
      persistent,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      x,
      y0 + 14.28,
      z,
      0.34,
      10.8,
      14,
    );
    addCylinder(
      persistent,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
      x,
      y0 + 8.78,
      z,
      0.52,
      0.24,
      14,
    );
    addCylinder(
      persistent,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      x,
      y0 + 19.83,
      z,
      0.56,
      0.34,
      14,
    );
    addWallBox(
      persistent,
      porticoWall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
      along,
      y0 + 20.15,
      0.42,
      1.06,
      0.28,
      0.86,
    );
  }
  addWallBox(
    persistent,
    porticoWall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
    porticoWidth / 2,
    y0 + 20.68,
    0.4,
    porticoWidth + 1.05,
    0.78,
    1.55,
    false,
    true,
  );
  addWallShape(
    persistent,
    porticoWall,
    triangleShape(porticoWidth + 1.1, 3.05),
    REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
    porticoWidth / 2,
    y0 + 21.06,
    0.44,
    false,
    true,
  );

  // Low relief is intentionally abstract: it conveys the sculpted tympanum
  // without claiming a surveyed figure count.
  for (let index = -4; index <= 4; index += 1) {
    const relief = new SphereGeometry(
      0.2 + (4 - Math.abs(index)) * 0.025,
      7,
      5,
    );
    const [x, y, z] = wallPoint(
      porticoWall,
      porticoWidth / 2 + index * 0.72,
      y0 + 22.05 + (4 - Math.abs(index)) * 0.21,
      0.49,
    );
    relief.scale(1.45, 0.72, 0.24);
    relief.translate(x, y, z);
    addPaintedGeometry(
      micro,
      relief,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneShade,
    );
  }

  // Stone balcony balusters across the five central portico bays.
  for (let index = 0; index <= 30; index += 1) {
    addWallBox(
      persistent,
      balconyWall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.balustrade,
      (balconyWall.length * index) / 30,
      y0 + 8.83,
      0.78,
      0.11,
      0.96,
      0.13,
    );
  }
  addWallBox(
    persistent,
    balconyWall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.balustrade,
    balconyWall.length / 2,
    y0 + 9.33,
    0.78,
    balconyWall.length + 0.18,
    0.13,
    0.18,
  );

  // Reconstructed roof crest, finials and four display-approximation putti.
  addWallBox(
    micro,
    wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.metal,
    wall.length / 2,
    y0 + 25.12,
    0.08,
    6.2,
    0.1,
    0.1,
  );
  for (let index = -3; index <= 3; index += 1) {
    addWallBox(
      micro,
      wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.metal,
      wall.length / 2 + index * 0.9,
      y0 + 25.52 + (3 - Math.abs(index)) * 0.12,
      0.08,
      0.07,
      0.9,
      0.07,
    );
  }
  for (const along of [
    1.15,
    wall.length * 0.37,
    wall.length * 0.63,
    wall.length - 1.15,
  ]) {
    const [x, , z] = wallPoint(wall, along, 0, 0.12);
    const body = new SphereGeometry(0.23, 7, 5);
    body.scale(0.72, 1.2, 0.62);
    body.translate(x, y0 + 25.3, z);
    addPaintedGeometry(
      micro,
      body,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
    );
    addCylinder(
      micro,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      x,
      y0 + 24.88,
      z,
      0.09,
      0.62,
      7,
    );
  }
  return { ashlarJoints, windows };
}

function westWallAt(
  southWall: FacadeWall,
  northWall: FacadeWall,
  distanceFromSouth: number,
): { along: number; wall: FacadeWall } {
  if (distanceFromSouth <= southWall.length) {
    return { along: distanceFromSouth, wall: southWall };
  }
  return { along: distanceFromSouth - southWall.length, wall: northWall };
}

function addWestFacade(
  persistent: Builder,
  micro: Builder,
  southBuilding: PrismBuilding,
  northBuilding: PrismBuilding,
): {
  anchors: {
    cartouches: {
      axis: number;
      volutes: {
        handedness: -1 | 1;
        worldXZ: readonly [number, number];
      }[];
      worldXZ: readonly [number, number];
    }[];
    erkerAxis: number;
    erkerSideWindows: {
      centreWorldXYZ: readonly [number, number, number];
      side: "north" | "south";
      storey: 1 | 2;
    }[];
    erkerWorldXZ: readonly [number, number];
    portalAxis: number;
    portalWorldXZ: readonly [number, number];
  };
  ashlarJoints: number;
  windows: number;
} {
  const southWall = wallOf(southBuilding, 1);
  const northWall = wallOf(northBuilding, 2);
  const totalLength = southWall.length + northWall.length;
  const pitch = totalLength / 6;
  const y0 = 5.2;
  let ashlarJoints = addStoneJoints(micro, southWall, y0 + 0.25, y0 + 20.15);
  ashlarJoints += addStoneJoints(micro, northWall, y0 + 0.25, y0 + 20.15);
  let windows = 0;
  const cartouches: {
    axis: number;
    volutes: {
      handedness: -1 | 1;
      worldXZ: readonly [number, number];
    }[];
    worldXZ: readonly [number, number];
  }[] = [];

  for (let axis = 0; axis < 6; axis += 1) {
    const location = westWallAt(southWall, northWall, pitch * (axis + 0.5));
    // The physical polyline is traversed south-to-north, while Tafel 72 and
    // the historical facade description number the axes north-to-south.
    const axisNumber = 6 - axis;
    if (![4, 5].includes(axisNumber)) {
      addCrossWindow(micro, location.wall, location.along, y0 + 4.7, 0.14);
      windows += 1;
    }
    for (const centreY of [y0 + 10.35, y0 + 15.85]) {
      addCrossWindow(
        micro,
        location.wall,
        location.along,
        centreY,
        axisNumber === 5 ? 1.32 : 0.14,
      );
      windows += 1;
    }
    if (axisNumber <= 3) {
      addMetalWindowRail(
        micro,
        location.wall,
        location.along,
        y0 + 8.75,
        0.36,
        2.35,
      );
      addWallShape(
        micro,
        location.wall,
        triangleShape(2.65, 0.72),
        REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
        location.along,
        y0 + 12.0,
        0.23,
        false,
        true,
      );
    }
    if (axisNumber === 4 || axisNumber === 6) {
      for (const offset of [-1.3, 1.3]) {
        addWallBox(
          micro,
          location.wall,
          REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
          location.along + offset,
          y0 + 13.0,
          0.24,
          0.24,
          10.2,
          0.22,
        );
      }
      addWallShape(
        micro,
        location.wall,
        cartoucheShape(0.92, 1.08),
        REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneShade,
        location.along,
        y0 + 11.62,
        0.31,
        false,
        true,
      );
      const volutes: {
        handedness: -1 | 1;
        worldXZ: readonly [number, number];
      }[] = [];
      for (const { handedness, offset } of [
        { handedness: -1 as const, offset: -0.92 },
        { handedness: 1 as const, offset: 0.92 },
      ]) {
        addWallShape(
          micro,
          location.wall,
          voluteShape(0.62, 0.92, handedness),
          REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
          location.along + offset,
          y0 + 11.55,
          0.3,
          false,
          true,
        );
        const [voluteX, , voluteZ] = wallPoint(
          location.wall,
          location.along + offset,
          0,
          0.3,
        );
        volutes.push({
          handedness,
          worldXZ: [voluteX, voluteZ],
        });
      }
      const [cartoucheX, , cartoucheZ] = wallPoint(
        location.wall,
        location.along,
        0,
        0.31,
      );
      cartouches.push({
        axis: axisNumber,
        volutes,
        worldXZ: [cartoucheX, cartoucheZ],
      });
    }
  }

  const fourth = westWallAt(southWall, northWall, pitch * 2.5);
  addWallBox(
    micro,
    fourth.wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
    fourth.along,
    y0 + 1.75,
    0.22,
    1.65,
    3.35,
    0.18,
    false,
    true,
  );
  const [oculusX, , oculusZ] = wallPoint(fourth.wall, fourth.along, 0, 0.27);
  const oculus = new CylinderGeometry(0.55, 0.55, 0.08, 18);
  oculus.rotateX(Math.PI / 2);
  oculus.rotateY(-Math.atan2(fourth.wall.dirZ, fourth.wall.dirX));
  oculus.translate(oculusX, y0 + 4.25, oculusZ);
  addPaintedGeometry(
    micro,
    oculus,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.darkGlass,
    true,
    true,
  );

  const fifth = westWallAt(southWall, northWall, pitch * 1.5);
  addWallBox(
    micro,
    fifth.wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
    fifth.along,
    y0 + 2.2,
    0.24,
    3.45,
    4.25,
    0.2,
    false,
    true,
  );
  for (const offset of [-1.05, 0, 1.05]) {
    addWallBox(
      micro,
      fifth.wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.metal,
      fifth.along + offset,
      y0 + 2.2,
      0.37,
      0.08,
      4.0,
      0.07,
    );
  }

  // Three shallow faces of the two-storey erker; dimensions are bounded by
  // the 1904 west-elevation plate but remain display approximations.
  addWallBox(
    persistent,
    fifth.wall,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
    fifth.along,
    y0 + 12.9,
    1.18,
    3.1,
    10.5,
    0.28,
    false,
    true,
  );
  const [leftX, , leftZ] = wallPoint(fifth.wall, fifth.along - 1.85, 0, 0.3);
  const [leftOuterX, , leftOuterZ] = wallPoint(
    fifth.wall,
    fifth.along - 1.5,
    0,
    1.2,
  );
  const [rightX, , rightZ] = wallPoint(fifth.wall, fifth.along + 1.85, 0, 0.3);
  const [rightOuterX, , rightOuterZ] = wallPoint(
    fifth.wall,
    fifth.along + 1.5,
    0,
    1.2,
  );
  addSegmentBox(
    persistent,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
    leftX,
    leftZ,
    leftOuterX,
    leftOuterZ,
    y0 + 12.9,
    10.5,
    0.28,
    true,
  );
  addSegmentBox(
    persistent,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
    rightX,
    rightZ,
    rightOuterX,
    rightOuterZ,
    y0 + 12.9,
    10.5,
    0.28,
    true,
  );
  const erkerSideWindows: {
    centreWorldXYZ: readonly [number, number, number];
    side: "north" | "south";
    storey: 1 | 2;
  }[] = [];
  const sides = [
    {
      end: [leftOuterX, leftOuterZ] as const,
      side: "south" as const,
      start: [leftX, leftZ] as const,
    },
    {
      end: [rightOuterX, rightOuterZ] as const,
      side: "north" as const,
      start: [rightX, rightZ] as const,
    },
  ];
  for (const side of sides) {
    const segmentDx = side.end[0] - side.start[0];
    const segmentDz = side.end[1] - side.start[1];
    const segmentLength = Math.hypot(segmentDx, segmentDz);
    let panelNx = segmentDz / segmentLength;
    let panelNz = -segmentDx / segmentLength;
    if (panelNx * fifth.wall.nx + panelNz * fifth.wall.nz < 0) {
      panelNx *= -1;
      panelNz *= -1;
    }
    const trim = 0.16;
    const panelStartX = side.start[0] + segmentDx * trim + panelNx * 0.18;
    const panelStartZ = side.start[1] + segmentDz * trim + panelNz * 0.18;
    const panelEndX = side.end[0] - segmentDx * trim + panelNx * 0.18;
    const panelEndZ = side.end[1] - segmentDz * trim + panelNz * 0.18;
    for (const [storey, centreY] of [
      [1, y0 + 10.35],
      [2, y0 + 15.85],
    ] as const) {
      addSegmentBox(
        micro,
        REICHSTAGSPRAESIDENTENPALAIS_TONES.glass,
        panelStartX,
        panelStartZ,
        panelEndX,
        panelEndZ,
        centreY,
        2.42,
        0.07,
        false,
        true,
      );
      for (const frameY of [centreY - 1.23, centreY + 1.23, centreY + 0.18]) {
        addSegmentBox(
          micro,
          REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
          panelStartX,
          panelStartZ,
          panelEndX,
          panelEndZ,
          frameY,
          0.09,
          0.09,
        );
      }
      for (const [frameX, frameZ] of [
        [panelStartX, panelStartZ],
        [(panelStartX + panelEndX) / 2, (panelStartZ + panelEndZ) / 2],
        [panelEndX, panelEndZ],
      ]) {
        addBox(
          micro,
          REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
          frameX,
          centreY,
          frameZ,
          0.075,
          2.5,
          0.075,
          0,
          false,
        );
      }
      erkerSideWindows.push({
        centreWorldXYZ: [
          (panelStartX + panelEndX) / 2,
          centreY,
          (panelStartZ + panelEndZ) / 2,
        ],
        side: side.side,
        storey,
      });
    }
  }
  const [roofX, , roofZ] = wallPoint(fifth.wall, fifth.along, 0, 1.12);
  addCone(
    persistent,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.slate,
    roofX,
    y0 + 20.25,
    roofZ,
    2.35,
    4.2,
    6,
    true,
  );
  const [portalX, , portalZ] = wallPoint(fourth.wall, fourth.along, 0, 0.22);
  const [erkerX, , erkerZ] = wallPoint(fifth.wall, fifth.along, 0, 1.18);
  return {
    anchors: {
      cartouches,
      erkerAxis: 5,
      erkerSideWindows,
      erkerWorldXZ: [erkerX, erkerZ],
      portalAxis: 4,
      portalWorldXZ: [portalX, portalZ],
    },
    ashlarJoints,
    windows,
  };
}

function makeKaisersaalStairSpecs(): OrientedBox[] {
  const boxes: OrientedBox[] = [];
  const baseY = 4.72;
  for (let index = 0; index < 12; index += 1) {
    const height = 0.26 + index * 0.255;
    boxes.push({
      along: 18.08 - index * 0.68,
      centreY: baseY + height / 2,
      depth: 2.9,
      height,
      outward: 1.52,
      width: 0.72,
    });
  }
  boxes.push({
    along: 8.95,
    centreY: baseY + 3.07 / 2,
    depth: 2.9,
    height: 3.07,
    outward: 1.52,
    width: 2.15,
  });
  return boxes;
}

const KAISERSAAL_STAIR_SPECS = makeKaisersaalStairSpecs();
const KAISERSAAL_WALL = {
  dirX: 0.999369,
  dirZ: -0.035511,
  nx: -0.035511,
  nz: -0.999369,
  x1: 447.6,
  z1: 31.7,
} as const;

function addKaisersaalFacade(
  persistent: Builder,
  micro: Builder,
  building: PrismBuilding,
): { arches: number; ashlarJoints: number } {
  const wall = wallOf(building, 0);
  const pitch = wall.length / 3;
  const bottomY = 7.1;
  const archHeight = 10.6;
  let ashlarJoints = addStoneJoints(micro, wall, 4.55, 22.9);
  for (let axis = 0; axis < 3; axis += 1) {
    const along = pitch * (axis + 0.5);
    addWallShape(
      micro,
      wall,
      archedShape(3.55, archHeight),
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      along,
      bottomY - 0.2,
      0.18,
      false,
      true,
    );
    addWallShape(
      micro,
      wall,
      archedShape(3.08, archHeight - 0.45),
      REICHSTAGSPRAESIDENTENPALAIS_TONES.glass,
      along,
      bottomY,
      0.24,
      true,
    );
    for (const offset of [-0.77, 0, 0.77]) {
      addWallBox(
        micro,
        wall,
        REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
        along + offset,
        bottomY + 4.0,
        0.29,
        0.09,
        7.7,
        0.06,
      );
    }
    for (const y of [bottomY + 2.0, bottomY + 4.2, bottomY + 6.45]) {
      addWallBox(
        micro,
        wall,
        REICHSTAGSPRAESIDENTENPALAIS_TONES.wood,
        along,
        y,
        0.29,
        3.0,
        0.08,
        0.06,
      );
    }
  }
  for (let index = 0; index < 4; index += 1) {
    const along = (wall.length * index) / 3;
    addWallBox(
      micro,
      wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      along,
      13.25,
      0.28,
      0.62,
      13.4,
      0.34,
      false,
      true,
    );
    addWallBox(
      micro,
      wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
      along,
      20.05,
      0.3,
      1.02,
      0.38,
      0.5,
    );
  }

  for (const step of KAISERSAAL_STAIR_SPECS) {
    addWallBox(
      persistent,
      wall,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      step.along,
      step.centreY,
      step.outward,
      step.width,
      step.height,
      step.depth,
      false,
      true,
    );
  }
  // Balustrades follow the stair longitudinally along wall 0.
  for (const outward of [0.06, 3.0]) {
    for (let index = 0; index <= 12; index += 1) {
      const along = 18.35 - index * 0.75;
      const y = 5.35 + index * 0.255;
      addWallBox(
        persistent,
        wall,
        REICHSTAGSPRAESIDENTENPALAIS_TONES.balustrade,
        along,
        y,
        outward,
        0.18,
        1.1,
        0.22,
      );
    }
  }
  return { arches: 3, ashlarJoints };
}

function pointInRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [xiDm, ziDm] = ring[index];
    const [xjDm, zjDm] = ring[previous];
    const xi = xiDm / 10;
    const zi = ziDm / 10;
    const xj = xjDm / 10;
    const zj = zjDm / 10;
    const crosses =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function isExteriorAt(
  sourceId: string,
  targets: PrismBuilding[],
  x: number,
  y: number,
  z: number,
): boolean {
  return !targets.some((candidate) => {
    if (candidate.id === sourceId) return false;
    const bottom = candidate.y0_dm / 10;
    const top = bottom + candidate.h_dm / 10;
    return (
      y > bottom + 0.08 && y < top - 0.08 && pointInRing(x, z, candidate.ring)
    );
  });
}

function addSecondaryExteriorRhythm(
  micro: Builder,
  buildings: PrismBuilding[],
): {
  exposedWallIndices: { sourcePrismId: string; wallIndex: number }[];
  exposedWalls: number;
  windows: number;
} {
  let exposedWalls = 0;
  let windows = 0;
  const exposedWallIndices: {
    sourcePrismId: string;
    wallIndex: number;
  }[] = [];
  for (const building of buildings) {
    const height = building.h_dm / 10;
    if (height < 11.5) continue;
    const bottom = Math.max(5.2, building.y0_dm / 10 + 1.6);
    const top = building.y0_dm / 10 + height - 3.0;
    const rowCount = Math.max(1, Math.min(3, Math.floor((top - bottom) / 4.4)));
    for (const wall of ringWalls(building.ring)) {
      if (
        wall.length < 3.4 ||
        isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall(
          building.id,
          wall.index,
        )
      ) {
        continue;
      }
      const sampleY = bottom + Math.max(1.2, (top - bottom) / 2);
      const [sampleX, , sampleZ] = wallPoint(
        wall,
        wall.length / 2,
        sampleY,
        0.45,
      );
      if (!isExteriorAt(building.id, buildings, sampleX, sampleY, sampleZ)) {
        continue;
      }
      exposedWalls += 1;
      exposedWallIndices.push({
        sourcePrismId: building.id,
        wallIndex: wall.index,
      });
      const bays = Math.max(
        1,
        Math.min(7, Math.floor((wall.length - 0.8) / 3.8)),
      );
      const pitch = (wall.length - 0.8) / bays;
      for (let row = 0; row < rowCount; row += 1) {
        const centreY = bottom + 1.25 + row * 4.65;
        if (centreY + 1.15 > top) continue;
        for (let bay = 0; bay < bays; bay += 1) {
          const along = 0.4 + pitch * (bay + 0.5);
          const [x, , z] = wallPoint(wall, along, centreY, 0.42);
          if (!isExteriorAt(building.id, buildings, x, centreY, z)) continue;
          addCrossWindow(
            micro,
            wall,
            along,
            centreY,
            0.14,
            Math.min(1.85, pitch * 0.56),
            2.2,
          );
          windows += 1;
        }
      }
    }
  }
  return { exposedWallIndices, exposedWalls, windows };
}

function addSegmentBox(
  builder: Builder,
  color: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  centreY: number,
  height: number,
  thickness: number,
  inked = false,
  lamp = false,
): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const geometry = new BoxGeometry(length, height, thickness);
  geometry.rotateY(-Math.atan2(dz, dx));
  geometry.translate((x1 + x2) / 2, centreY, (z1 + z2) / 2);
  addPaintedGeometry(builder, geometry, color, lamp, inked);
}

function addGardenEnclosure(builder: Builder): {
  hedgeSegments: number;
  wallFields: number;
  wallPiers: number;
  wallSegments: number;
} {
  const lines = [GARDEN_WALL_WAY_437493373, GARDEN_WALL_WAY_1379191721];
  let wallSegments = 0;
  let wallFields = 0;
  const pierKeys = new Set<string>();
  for (const line of lines) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const [x1, z1] = line[index];
      const [x2, z2] = line[index + 1];
      const length = Math.hypot(x2 - x1, z2 - z1);
      addSegmentBox(
        builder,
        REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
        x1,
        z1,
        x2,
        z2,
        GARDEN_WALL_BASE_Y + GARDEN_WALL_HEIGHT / 2,
        GARDEN_WALL_HEIGHT,
        GARDEN_WALL_THICKNESS,
        true,
      );
      addSegmentBox(
        builder,
        REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
        x1,
        z1,
        x2,
        z2,
        GARDEN_WALL_BASE_Y + GARDEN_WALL_HEIGHT + 0.1,
        0.18,
        GARDEN_WALL_THICKNESS + 0.12,
      );
      wallSegments += 1;
      const fields = Math.max(1, Math.ceil(length / 4.4));
      wallFields += fields;
      for (let field = 1; field < fields; field += 1) {
        const fraction = field / fields;
        const x = x1 + (x2 - x1) * fraction;
        const z = z1 + (z2 - z1) * fraction;
        addBox(
          builder,
          REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
          x,
          GARDEN_WALL_BASE_Y + GARDEN_WALL_HEIGHT / 2 + 0.08,
          z,
          0.44,
          GARDEN_WALL_HEIGHT + 0.34,
          0.44,
          0,
          true,
        );
        pierKeys.add(`${x.toFixed(3)},${z.toFixed(3)}`);
      }
      pierKeys.add(`${x1.toFixed(3)},${z1.toFixed(3)}`);
      pierKeys.add(`${x2.toFixed(3)},${z2.toFixed(3)}`);
    }
  }
  for (const key of pierKeys) {
    const [x, z] = key.split(",").map(Number);
    addBox(
      builder,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstoneHighlight,
      x,
      GARDEN_WALL_BASE_Y + GARDEN_WALL_HEIGHT / 2 + 0.08,
      z,
      0.48,
      GARDEN_WALL_HEIGHT + 0.34,
      0.48,
      0,
      true,
    );
  }

  const [[hx1, hz1], [hx2, hz2]] = GARDEN_HEDGE_WAY_437493370;
  addSegmentBox(
    builder,
    REICHSTAGSPRAESIDENTENPALAIS_TONES.gardenHedge,
    hx1,
    hz1,
    hx2,
    hz2,
    5.25,
    1.55,
    0.86,
    true,
  );
  return {
    hedgeSegments: 1,
    wallFields,
    wallPiers: pierKeys.size,
    wallSegments,
  };
}

function markDetailMeshes(group: Group): void {
  group.traverse((object) => {
    if (object instanceof Mesh) {
      object.userData.reichstagspraesidentenpalaisDetail = true;
    }
  });
}

function pointToSegmentDistanceSquared(
  x: number,
  z: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const denominator = dx * dx + dz * dz;
  const t =
    denominator > 0
      ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / denominator))
      : 0;
  const px = x1 + dx * t;
  const pz = z1 + dz * t;
  return (x - px) ** 2 + (z - pz) ** 2;
}

/**
 * Pure navigation contract for the newly drawn major stair and sandstone
 * garden walls. Window frames, relief, rails, hedge and roof ornament are
 * deliberately excluded; the official LoD2 shells remain the main collider.
 */
export function reichstagspraesidentenpalaisDetailSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  if (![x, y, z].every(Number.isFinite)) return false;
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const relativeX = x - KAISERSAAL_WALL.x1;
  const relativeZ = z - KAISERSAAL_WALL.z1;
  const localAlong =
    relativeX * KAISERSAAL_WALL.dirX + relativeZ * KAISERSAAL_WALL.dirZ;
  const localOutward =
    relativeX * KAISERSAAL_WALL.nx + relativeZ * KAISERSAAL_WALL.nz;
  for (const box of KAISERSAAL_STAIR_SPECS) {
    if (
      Math.abs(localAlong - box.along) <= box.width / 2 + safeRadius &&
      Math.abs(localOutward - box.outward) <= box.depth / 2 + safeRadius &&
      y >= box.centreY - box.height / 2 - safeRadius &&
      y <= box.centreY + box.height / 2 + safeRadius
    ) {
      return true;
    }
  }

  if (
    y >= GARDEN_WALL_BASE_Y - safeRadius &&
    y <= GARDEN_WALL_BASE_Y + GARDEN_WALL_HEIGHT + safeRadius
  ) {
    for (const line of [
      GARDEN_WALL_WAY_437493373,
      GARDEN_WALL_WAY_1379191721,
    ]) {
      for (let index = 0; index < line.length - 1; index += 1) {
        const [x1, z1] = line[index];
        const [x2, z2] = line[index + 1];
        if (
          pointToSegmentDistanceSquared(x, z, x1, z1, x2, z2) <=
          (GARDEN_WALL_THICKNESS / 2 + safeRadius) ** 2
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Thin, source-bounded recognition layer over the untouched ten-part shell. */
export function createReichstagspraesidentenpalais(
  prisms: PrismPayload,
): Group {
  const group = new Group();
  group.name = "Reichstagspräsidentenpalais details";
  const byId = new Map(
    prisms.buildings.map((building) => [building.id, building]),
  );
  const missingIds = [...REICHSTAGSPRAESIDENTENPALAIS_IDS].filter(
    (id) => !byId.has(id),
  );
  if (missingIds.length > 0) {
    group.userData.geometryStatus = "required LoD2 parts missing";
    group.userData.missingSourcePrismIds = missingIds;
    return group;
  }

  const palaceBuildings = [...REICHSTAGSPRAESIDENTENPALAIS_IDS].map(
    (id) => byId.get(id)!,
  );
  const persistent = createBuilder();
  const micro = createBuilder();
  const enclosure = createBuilder();
  const north = addNorthFacade(
    persistent,
    micro,
    byId.get("y2n0A1dj")!,
    byId.get("zMovgLdU")!,
    byId.get("JRUA1rbq")!,
  );
  const west = addWestFacade(
    persistent,
    micro,
    byId.get("1gEfIRTG")!,
    byId.get("y2n0A1dj")!,
  );
  const kaisersaal = addKaisersaalFacade(
    persistent,
    micro,
    byId.get("rTIZwx4H")!,
  );
  const secondary = addSecondaryExteriorRhythm(micro, palaceBuildings);
  const garden = addGardenEnclosure(enclosure);

  const persistentGroup = finishDrawnGroup(persistent, {
    name: REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME,
  });
  const microGroup = finishDrawnGroup(micro, {
    lampEmissive: REICHSTAGSPRAESIDENTENPALAIS_TONES.nightGlass,
    lampEmissiveIntensity: 0.62,
    name: REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME,
  });
  const enclosureGroup = finishDrawnGroup(enclosure, {
    name: REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME,
  });
  if (persistentGroup) group.add(persistentGroup);
  if (microGroup) group.add(microGroup);
  if (enclosureGroup) group.add(enclosureGroup);
  markDetailMeshes(group);

  group.userData.architecturalProfile = REICHSTAGSPRAESIDENTENPALAIS_PROFILE;
  const porticoFrontWall = wallOf(byId.get("zMovgLdU")!, 0);
  const [porticoCentreX, , porticoCentreZ] = wallPoint(
    porticoFrontWall,
    porticoFrontWall.length / 2,
    0,
    0.42,
  );
  group.userData.axisLayout = REICHSTAGSPRAESIDENTENPALAIS_AXIS_LAYOUT;
  group.userData.detailAnchors = {
    northPortico: {
      centreWorldXZ: [porticoCentreX, porticoCentreZ],
      frontProjectionFromCarrierM: 0.42,
      sourcePrismId: "zMovgLdU",
      wallIndex: 0,
    },
    west: west.anchors,
  };
  group.userData.detailCounts = {
    ashlarJoints:
      north.ashlarJoints + west.ashlarJoints + kaisersaal.ashlarJoints,
    carriageDoors: 1,
    centralPorticoBays: 5,
    gardenHedgeSegments: garden.hedgeSegments,
    gardenWallFields: garden.wallFields,
    gardenWallPiers: garden.wallPiers,
    gardenWallSegments: garden.wallSegments,
    kaisersaalArches: kaisersaal.arches,
    kaisersaalPilasters: 4,
    kaisersaalStairBoxes: KAISERSAAL_STAIR_SPECS.length,
    northAxes: 7,
    northBalconyRails: 7,
    northWindows: north.windows,
    oculi: 1,
    ornateWestAxes: 2,
    pedimentedWestWindows: 3,
    porticoColumns: 6,
    puttiDisplayApproximations: 4,
    secondaryExteriorWalls: secondary.exposedWalls,
    secondaryExteriorWindows: secondary.windows,
    smallPortals: 1,
    sourcePrisms: REICHSTAGSPRAESIDENTENPALAIS_IDS.size,
    westAxes: 6,
    westCartouches: west.anchors.cartouches.length,
    westErkers: 1,
    westErkerSideWindows: west.anchors.erkerSideWindows.length,
    westVolutes: west.anchors.cartouches.length * 2,
    westWindows: west.windows,
  };
  group.userData.fullyDetailedWallIndices =
    REICHSTAGSPRAESIDENTENPALAIS_FULLY_DETAILED_WALL_INDICES;
  group.userData.secondaryExteriorWallIndices = secondary.exposedWallIndices;
  group.userData.geometryStatus =
    REICHSTAGSPRAESIDENTENPALAIS_PROFILE.geometryStatus;
  group.userData.hasOpaqueEnvelope = false;
  group.userData.maxFacadeProjectionM = 3.0;
  group.userData.microDetailObjectNames =
    REICHSTAGSPRAESIDENTENPALAIS_MICRO_OBJECT_NAMES;
  group.userData.persistentObjectNames =
    REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_OBJECT_NAMES;
  group.userData.roofToneSourcePrismIds = [
    ...REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS,
  ];
  group.userData.sourcePrismIds = [...REICHSTAGSPRAESIDENTENPALAIS_IDS];
  return group;
}
