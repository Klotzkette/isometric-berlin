import { addGedaechtniskircheRuin } from "./GedaechtniskircheRuin";
import { GEDAECHTNISKIRCHE_RUIN_PROFILE } from "./gedaechtniskircheRuinProfile";
import { GEDAECHTNISKIRCHE_RETAINED_WINGS } from "./gedaechtniskircheSourceParts";
import { staticModelDetailProfile } from "./staticModelDetail";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  StaticDrawUsage,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  EdgesGeometry,
  Group,
  SphereGeometry,
  ShapeUtils,
  Vector2,
  TorusGeometry,
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

export type CityWestDetailProfile = "full" | "mobile";

const GROUND_Y = 5.2;
const GLASS_BLUE = 0x29475b;
const GLASS_DARK = 0x213744;
const EUROPA_GLASS = 0x34474a;
const EUROPA_SPANDREL = 0x666d6b;
const EUROPA_MULLION = 0xb8c0bd;
const EUROPA_PODIUM_GLASS = 0x477b80;
const EUROPA_PODIUM_PANEL = 0xb9c1bd;
const EUROPA_SIGN_RED = 0xc83d39;
const ALUMINIUM = 0xcbd0cb;
const TRAVERTINE = 0xd8c6a5;
const SANDSTONE = 0xb99a72;
const RUIN_STONE = 0x999387;
const RUIN_LIGHT = 0x92877a;
const STONE_SHADOW = 0x3d3832;
const CONCRETE = 0x777b7d;
const KWG_BLUE = 0x24425a;
const KWG_GRID = 0x8a8d89;
const BRONZE = 0x66503b;
const GRANITE_RED = 0x9d4c3f;
const WATER = 0x5cacc1;
const URANIA_RED = 0xb73332;

/**
 * Survey and source profile for the City-West recognition layer.
 *
 * Coordinates are OSM rings transformed to the viewer's EPSG:25833 frame:
 * world_x=easting-389500, world_z=5820000-northing.  The shipped central-city LoD2/prism payload
 * does not contain these individual tower parts, so committed OSM outlines
 * provide the horizontal anchors and the cited official descriptions provide
 * the architectural hierarchy.  Only the Allianz presentation height and the
 * Urania rear volume are proportion-based inferences; both are called out.
 */
export const CITY_WEST_PROFILE = {
  coordinateFrame:
    "EPSG:25833; world_x=easting-389500; world_z=5820000-northing",
  groundY: GROUND_Y,
  geometryStatus:
    "current OSM building/part anchors with source-described recognition geometry; additive detail layer, not a replacement cadastral survey",
  europaCenter: {
    centerWorldM: [-2308.337, 1585.347] as const,
    facadeBayCount: 22,
    officeFloorCount: 21,
    overallHeightM: 103,
    rotationY: (80.417 * Math.PI) / 180,
    sourceBuildingId: "OSM-way-1054276972",
    sourceTowerPartId: "OSM-way-26408382",
    starDiameterM: 10,
    towerFootprintM: [45.25, 16.81] as const,
    towerHeightM: 86,
    curtainWall: {
      baseHeightM: 8,
      longFaceMullionBays: 22,
      mobileLongFaceStoreyRows: 17,
      mobileShortFaceStoreyRows: 9,
      shortFaceMullionBays: 8,
      storeyRows: 21,
      spandrelHeightM: 1.5,
      geometryStatus:
        "four code-built dark-glass faces with equal grey spandrel rows, aluminium mullions and a recessed concrete entrance base; no facade photograph or texture",
    },
    breitscheidplatzFrontage: {
      baseStoreys: 2,
      centerOffsetM: [66.25, -10.16] as const,
      footprintM: [18.3, 69.41] as const,
      heightM: 18,
      officeStoreys: 3,
      sourcePartId: "OSM-way-26408381",
      footprintStatus:
        "rotated recognition envelope bounded from the current OSM part ring; local facade subdivisions are not a component survey",
      roofSigns: {
        geometryStatus:
          "procedural red RBB and 94.3 stroke signs; no font, logo image or texture asset",
        texts: ["RBB", "94.3"] as const,
      },
    },
    roofStar: {
      antennaOffsetM: [-9.5, -1.8] as const,
      centerOffsetM: [7.5, 0] as const,
      rotationsPerMinute: 2,
      geometryStatus:
        "ten-metre outer diameter with three radial spokes tapered to the rim, dark roof cradle and adjacent mast; continuous vertical-axis rotation in every mode",
    },
    sources: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096462",
      "https://europa-center-berlin.de/timeline/der-punkt-auf-dem-i/",
      "https://europa-center-berlin.de/timeline/eroeffnung/",
      "https://europa-center-berlin.de/information/historie/",
      "https://www.openstreetmap.org/way/1054276972",
      "https://www.openstreetmap.org/way/26408382",
      "https://www.openstreetmap.org/way/26408381",
      "https://commons.wikimedia.org/wiki/File:Berlin_Europa_Center_1.jpg",
      "https://commons.wikimedia.org/wiki/File:190829_Europa-Center_vom_Breitscheidplatz_aus_gesehen.jpg",
    ] as const,
  },
  allianzHaus: {
    centerWorldM: [-2809.432, 1748.781] as const,
    floorCount: 14,
    inferredTowerHeightM: 47.5,
    lowWingFloorCount: 6,
    roofWordmark: {
      geometryStatus:
        "procedural ALLIANZ stroke letters merged into the rooftop lamp batch; no font, image, or texture asset",
      heightM: 3.8,
      text: "ALLIANZ",
    },
    rotationY: (-9.588 * Math.PI) / 180,
    sourceAxisWorldM: [
      [-2801.223, 1741.386],
      [-2793.667, 1742.662],
    ] as const,
    sourceBuildingId: "OSM-way-48757012",
    sourceLowWingPartId: "OSM-way-363431190",
    sourceTowerPartId: "OSM-way-363431228",
    towerFootprintM: [45.457, 17.317] as const,
    heightStatus:
      "presentation height inferred from the official 14-storey count; not a surveyed LoD2 height",
    sources: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096212",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/gebaeude-und-anlagen/buero-und-geschaeftshaeuser/artikel.158778.php",
      "https://www.openstreetmap.org/way/48757012",
      "https://www.openstreetmap.org/way/363431228",
      "https://www.openstreetmap.org/way/363431190",
    ] as const,
  },
  kranzlerEck: {
    glassTowerCenterWorldM: [-2846.376, 1547.214] as const,
    glassTowerFootprintM: [130.89, 23.41] as const,
    glassTowerHeightM: 60,
    glassTowerRotationY: (-71.72 * Math.PI) / 180,
    rotundaCenterWorldM: [-2787.303, 1580.48] as const,
    rotundaDiameterM: 16.9,
    sourceBuildingId: "OSM-way-22986477",
    sourceRotundaPartId: "OSM-way-474593825",
    sources: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040517",
      "https://www.berlin.de/sehenswuerdigkeiten/3559953-3558930-neues-kranzler-eck.html",
      "https://kranzler-eck.berlin/en/change-and-sustainability/",
      "https://www.openstreetmap.org/way/22986477",
      "https://www.openstreetmap.org/way/474593825",
    ] as const,
  },
  bahnhofZoo: {
    longDistanceHall: {
      centerWorldM: [-2660.478, 1186.912] as const,
      footprintStatus:
        "minimum-area oriented bounds derived from the projected OSM outer ring; not a freehand hall rectangle",
      heightAboveViaductM: 14,
      lengthM: 257.65,
      rotationY: (61.26 * Math.PI) / 180,
      sourceBuildingId: "OSM-way-96955257",
      widthM: 71.61,
    },
    sBahnHall: {
      centerWorldM: [-2742.039, 1293.831] as const,
      footprintStatus:
        "minimum-area oriented bounds derived from committed OSM way 20145539",
      heightAboveViaductM: 9.6,
      lengthM: 171.428,
      rotationY: (61.016 * Math.PI) / 180,
      sourceBuildingId: "OSM-way-20145539",
      widthM: 21.87,
    },
    terraceCenterWorldM: [-2661.336, 1250.659] as const,
    terraceRotationY: (61.26 * Math.PI) / 180,
    terraceSourcePartId: "OSM-way-421829986",
    viaductHeightM: 8,
    sources: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040500",
      "https://www.bahnhof.de/berlin-zoologischer-garten",
      "https://www.openstreetmap.org/way/96955257",
      "https://www.openstreetmap.org/way/20145539",
      "https://www.openstreetmap.org/way/421829986",
    ] as const,
  },
  gedaechtniskirche: {
    bellTower: {
      bellChamberBandCenterHeightM: 30.5,
      bellChamberBandHeightM: 2.2,
      centerWorldM: [-2472.803, 1523.451] as const,
      diameterM: 12,
      facadeSides: 6,
      lattice: { columnsPerFace: 9, rows: 80, jointM: 0.14 },
      finial: {
        crossHeightM: 1.8,
        poleLengthM: 5.3,
      },
      heightM: 53.3,
      honeycombWindowCount: 5152,
      recognitionGeometry:
        "six blue glazed faces with dense concrete mullions, horizontal honeycomb courses, the broad bell-chamber steel band, and gold finial",
      sourceBuildingId: "OSM-way-15218372",
    },
    chapelCenterWorldM: [-2457.214, 1504.452] as const,
    chapelSourceBuildingId: "OSM-way-15218375",
    church: {
      centerWorldM: [-2534.667, 1498.637] as const,
      diameterM: 35,
      heightM: 20.5,
      facadeSides: 8,
      lattice: { columnsPerFace: 20, rows: 29, jointM: 0.16 },
      recognitionGeometry:
        "eight correctly aligned faces of near-square concrete cells with blue and sparse red/green/gold glazing, corner steel posts, flat roof and bronze entrance doors; local subdivisions are not a pane survey",
      sourceBuildingId: "OSM-way-15218371",
    },
    foyerCenterWorldM: [-2565.322, 1490.536] as const,
    foyerSourceBuildingId: "OSM-way-15218374",
    oldTower: GEDAECHTNISKIRCHE_RUIN_PROFILE,
    podiumAreaM2: 4120,
    podiumHeightM: 0.8,
    sources: [
      "https://www.gedaechtniskirche-berlin.de/bauensemble/ensemble-aus-alt-und-neu",
      "https://www.gedaechtniskirche-berlin.de/gebaeude/architektur",
      "https://www.gedaechtniskirche-berlin.de/geschichte/das-kirchen-ensemble/gebaeude-1895-1963/der-glockenturm",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040472",
      "https://www.gedaechtniskirche-berlin.de/geschichte/spenden/das-blaue-glas",
      "https://commons.wikimedia.org/wiki/File:Kaiser-Wilhelm-Ged%C3%A4chtniskirche_Sommer_2024_2.jpg",
      "https://www.openstreetmap.org/way/15218371",
      "https://www.openstreetmap.org/way/15218372",
      "https://www.openstreetmap.org/way/15218373",
      "https://www.openstreetmap.org/way/15218374",
      "https://www.openstreetmap.org/way/15218375",
    ] as const,
  },
  breitscheidplatz: {
    fountainBasinM: 16,
    fountainCenterWorldM: [-2406.297, 1531.147] as const,
    globeDiameterM: 8.5,
    sourceFountainId: "OSM-way-120866116",
    sources: [
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.156559.php",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/brunnen/artikel.118259.php",
      "https://www.openstreetmap.org/way/120866116",
    ] as const,
  },
  urania: {
    centerWorldM: [-1625.993, 1913.419] as const,
    footprintM: [67.44, 26.43] as const,
    heightM: 9,
    rearVolumeStatus:
      "rear historic volume is a restrained proportional cue; no component survey is claimed",
    rotationY: (69.05 * Math.PI) / 180,
    sourceBuildingId: "OSM-way-11687794",
    sources: [
      "https://www.urania.de/urania-berlin/",
      "https://www.urania.de/event/berlin-waechst-gibt-es-tabuflaechen-der-stadtentwicklung/",
      "https://www.openstreetmap.org/way/11687794",
    ] as const,
  },
} as const;

export const CITY_WEST_SOURCE_URLS = [
  ...CITY_WEST_PROFILE.europaCenter.sources,
  ...CITY_WEST_PROFILE.allianzHaus.sources,
  ...CITY_WEST_PROFILE.kranzlerEck.sources,
  ...CITY_WEST_PROFILE.bahnhofZoo.sources,
  ...CITY_WEST_PROFILE.gedaechtniskirche.sources,
  ...CITY_WEST_PROFILE.breitscheidplatz.sources,
  ...CITY_WEST_PROFILE.urania.sources,
] as const;

export const CITY_WEST_RENDER_BUDGET = {
  full: {
    maxRenderables: 13,
    maxVertices: 120_000,
    maxGeometryBytes: 2_600_000,
  },
  mobile: {
    maxRenderables: 13,
    maxVertices: 120_000,
    maxGeometryBytes: 2_600_000,
  },
} as const;

function pushGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
  lamp = false,
): void {
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked && !lamp) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addRotatedBox(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  inked = true,
  lamp = false,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  if (rotationZ !== 0) geometry.rotateZ(rotationZ);
  if (rotationX !== 0) geometry.rotateX(rotationX);
  if (rotationY !== 0) geometry.rotateY(rotationY);
  geometry.translate(cx, cy, cz);
  pushGeometry(builder, geometry, color, inked, lamp);
}

function localPoint(
  center: readonly [number, number],
  rotationY: number,
  localX: number,
  localZ: number,
): readonly [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    center[0] + cosine * localX + sine * localZ,
    center[1] - sine * localX + cosine * localZ,
  ];
}

function addLocalBox(
  builder: Builder,
  color: number,
  center: readonly [number, number],
  rotationY: number,
  localX: number,
  centerY: number,
  localZ: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  rotationZ = 0,
  inked = true,
  lamp = false,
): void {
  const [x, z] = localPoint(center, rotationY, localX, localZ);
  addRotatedBox(
    builder,
    color,
    x,
    centerY,
    z,
    sizeX,
    sizeY,
    sizeZ,
    0,
    rotationY,
    rotationZ,
    inked,
    lamp,
  );
}

function addAllianzRoofWordmark(builder: Builder): void {
  const profile = CITY_WEST_PROFILE.allianzHaus;
  const [, depthM] = profile.towerFootprintM;
  const letterWidthM = 2.05;
  const letterHeightM = profile.roofWordmark.heightM;
  const letterGapM = 0.5;
  const facadeOffsetM = depthM / 2 + 0.45;
  const baselineY = GROUND_Y + profile.inferredTowerHeightM + 0.45;
  const strokeDepthM = 0.3;
  const strokeWidthM = 0.28;
  const letterAdvanceM = letterWidthM + letterGapM;
  const textWidthM =
    profile.roofWordmark.text.length * letterWidthM +
    (profile.roofWordmark.text.length - 1) * letterGapM;
  const emblemDiameterM = 3.8;
  const completeWidthM = emblemDiameterM + 1.2 + textWidthM;
  const emblemCenterX = -completeWidthM / 2 + emblemDiameterM / 2;
  const firstLetterCenterX =
    -completeWidthM / 2 + emblemDiameterM + 1.2 + letterWidthM / 2;

  const addStroke = (
    localCenterX: number,
    localCenterY: number,
    lengthM: number,
    rotationZ: number,
  ): void => {
    const [x, z] = localPoint(
      profile.centerWorldM,
      profile.rotationY,
      localCenterX,
      facadeOffsetM,
    );
    addRotatedBox(
      builder,
      0xf2eee0,
      x,
      baselineY + localCenterY,
      z,
      lengthM,
      strokeWidthM,
      strokeDepthM,
      0,
      profile.rotationY,
      rotationZ,
      false,
      true,
    );
  };

  const addLetter = (letter: string, centerX: number): void => {
    const halfWidth = letterWidthM / 2;
    const halfHeight = letterHeightM / 2;
    const fullDiagonal = Math.hypot(letterWidthM, letterHeightM);
    const legDiagonal = Math.hypot(halfWidth, letterHeightM);
    const legAngle = Math.atan2(letterHeightM, halfWidth);
    const diagonalAngle = Math.atan2(letterHeightM, letterWidthM);
    const horizontal = (localY: number, widthM = letterWidthM): void =>
      addStroke(centerX, localY, widthM, 0);
    const vertical = (localX: number): void =>
      addStroke(
        centerX + localX,
        halfHeight,
        letterHeightM,
        Math.PI / 2,
      );

    if (letter === "A") {
      addStroke(centerX - halfWidth / 2, halfHeight, legDiagonal, legAngle);
      addStroke(centerX + halfWidth / 2, halfHeight, legDiagonal, -legAngle);
      horizontal(letterHeightM * 0.45, letterWidthM * 0.72);
    } else if (letter === "L") {
      vertical(-halfWidth);
      horizontal(0);
    } else if (letter === "I") {
      horizontal(0);
      vertical(0);
      horizontal(letterHeightM);
    } else if (letter === "N") {
      vertical(-halfWidth);
      vertical(halfWidth);
      addStroke(centerX, halfHeight, fullDiagonal, diagonalAngle);
    } else if (letter === "Z") {
      horizontal(0);
      horizontal(letterHeightM);
      addStroke(centerX, halfHeight, fullDiagonal, -diagonalAngle);
    }
  };

  // The current roof sign is deliberately rebuilt from low-poly strokes and
  // an emblem ring.  It stays legible without loading a font, image or texture.
  const [emblemX, emblemZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    emblemCenterX,
    facadeOffsetM,
  );
  const emblem = new TorusGeometry(emblemDiameterM / 2, 0.24, 4, 16);
  emblem.rotateY(profile.rotationY);
  emblem.translate(emblemX, baselineY + letterHeightM / 2, emblemZ);
  pushGeometry(builder, emblem, 0xf2eee0, false, true);
  for (const localX of [-0.62, 0, 0.62]) {
    addStroke(
      emblemCenterX + localX,
      letterHeightM / 2,
      localX === 0 ? 2.35 : 1.75,
      Math.PI / 2,
    );
  }

  [...profile.roofWordmark.text].forEach((letter, index) => {
    addLetter(letter, firstLetterCenterX + index * letterAdvanceM);
  });
}

function addLongFacadeFrames(
  builder: Builder,
  options: {
    center: readonly [number, number];
    color: number;
    depthM: number;
    groundY: number;
    heightM: number;
    lengthM: number;
    rotationY: number;
    verticalCount: number;
    horizontalCount: number;
  },
): void {
  const {
    center,
    color,
    depthM,
    groundY,
    heightM,
    horizontalCount,
    lengthM,
    rotationY,
    verticalCount,
  } = options;
  for (const side of [-1, 1]) {
    const localZ = side * (depthM / 2 + 0.12);
    for (let index = 1; index < verticalCount; index += 1) {
      const localX = -lengthM / 2 + (index * lengthM) / verticalCount;
      const [x, z] = localPoint(center, rotationY, localX, localZ);
      addBox(
        builder,
        color,
        x,
        groundY + heightM / 2,
        z,
        0.34,
        heightM,
        0.28,
        rotationY,
        false,
      );
    }
    for (let index = 1; index < horizontalCount; index += 1) {
      const [x, z] = localPoint(center, rotationY, 0, localZ);
      addBox(
        builder,
        color,
        x,
        groundY + (index * heightM) / horizontalCount,
        z,
        lengthM,
        0.28,
        0.3,
        rotationY,
        false,
      );
    }
  }
}

function addEuropaCurtainWall(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.europaCenter;
  const wall = profile.curtainWall;
  const [lengthM, depthM] = profile.towerFootprintM;
  const wallHeightM = profile.towerHeightM - wall.baseHeightM;
  const wallCenterY = GROUND_Y + wall.baseHeightM + wallHeightM / 2;

  // The recessed core and perimeter pilotis keep the curtain-wall slab from
  // reading as an 86 m glass box planted directly on the pavement.
  addLocalBox(
    builder,
    STONE_SHADOW,
    profile.centerWorldM,
    profile.rotationY,
    0,
    GROUND_Y + wall.baseHeightM / 2,
    0,
    lengthM - 10,
    wall.baseHeightM,
    depthM - 6,
  );
  for (const side of [-1, 1]) {
    const pilotisCount = detailProfile === "mobile" ? 6 : 8;
    for (let index = 0; index < pilotisCount; index += 1) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        -lengthM / 2 + 2.2 + (index * (lengthM - 4.4)) / (pilotisCount - 1),
        GROUND_Y + wall.baseHeightM / 2,
        side * (depthM / 2 - 0.65),
        0.62,
        wall.baseHeightM,
        0.62,
        0,
        false,
      );
    }
  }

  addLocalBox(
    builder,
    EUROPA_GLASS,
    profile.centerWorldM,
    profile.rotationY,
    0,
    wallCenterY,
    0,
    lengthM,
    wallHeightM,
    depthM,
  );

  const longStoreyRows =
    detailProfile === "mobile"
      ? wall.mobileLongFaceStoreyRows
      : wall.storeyRows;
  const shortStoreyRows =
    detailProfile === "mobile"
      ? wall.mobileShortFaceStoreyRows
      : wall.storeyRows;
  const longBays =
    detailProfile === "mobile" ? 9 : wall.longFaceMullionBays;
  const shortBays =
    detailProfile === "mobile" ? 3 : wall.shortFaceMullionBays;
  const spandrelHeightM = wall.spandrelHeightM;

  for (const side of [-1, 1]) {
    const localZ = side * (depthM / 2 + 0.14);
    for (let bay = 1; bay < longBays; bay += 1) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        -lengthM / 2 + (bay * lengthM) / longBays,
        wallCenterY,
        localZ,
        0.2,
        wallHeightM,
        0.3,
        0,
        false,
      );
    }
    for (let storey = 0; storey < longStoreyRows; storey += 1) {
      addLocalBox(
        builder,
        EUROPA_SPANDREL,
        profile.centerWorldM,
        profile.rotationY,
        0,
        GROUND_Y +
          wall.baseHeightM +
          (storey * wallHeightM) / longStoreyRows + spandrelHeightM / 2,
        localZ,
        lengthM + 0.18,
        spandrelHeightM,
        0.32,
        0,
        false,
      );
    }
  }

  for (const side of [-1, 1]) {
    const localX = side * (lengthM / 2 + 0.14);
    for (let bay = 1; bay < shortBays; bay += 1) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        localX,
        wallCenterY,
        -depthM / 2 + (bay * depthM) / shortBays,
        0.3,
        wallHeightM,
        0.2,
        0,
        false,
      );
    }
    for (let storey = 0; storey < shortStoreyRows; storey += 1) {
      addLocalBox(
        builder,
        EUROPA_SPANDREL,
        profile.centerWorldM,
        profile.rotationY,
        localX,
        GROUND_Y +
          wall.baseHeightM +
          (storey * wallHeightM) / shortStoreyRows + spandrelHeightM / 2,
        0,
        0.32,
        spandrelHeightM,
        depthM + 0.18,
        0,
        false,
      );
    }
  }

  for (const localX of [-lengthM / 2, lengthM / 2]) {
    for (const localZ of [-depthM / 2, depthM / 2]) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        localX,
        wallCenterY,
        localZ,
        0.38,
        wallHeightM,
        0.38,
        0,
        false,
      );
    }
  }
  addLocalBox(
    builder,
    EUROPA_SPANDREL,
    profile.centerWorldM,
    profile.rotationY,
    0,
    GROUND_Y + profile.towerHeightM - 0.28,
    0,
    lengthM + 0.7,
    0.56,
    depthM + 0.7,
  );
}

function addEuropaRoofSigns(builder: Builder): void {
  const profile = CITY_WEST_PROFILE.europaCenter;
  const frontage = profile.breitscheidplatzFrontage;
  const [frontageWidthM] = frontage.footprintM;
  const facadeLocalX =
    frontage.centerOffsetM[0] + frontageWidthM / 2 + 1.28;
  const baselineY = GROUND_Y + frontage.heightM + 0.48;
  const strokeDepthM = 0.32;
  const strokeWidthM = 0.26;

  const addLine = (
    signCenterZ: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void => {
    // Seen from Breitscheidplatz, screen-right is negative local Z.
    const startZ = signCenterZ - startX;
    const endZ = signCenterZ - endX;
    const deltaZ = endZ - startZ;
    const deltaY = endY - startY;
    const [x, z] = localPoint(
      profile.centerWorldM,
      profile.rotationY,
      facadeLocalX,
      (startZ + endZ) / 2,
    );
    addRotatedBox(
      builder,
      EUROPA_SIGN_RED,
      x,
      baselineY + (startY + endY) / 2,
      z,
      strokeDepthM,
      strokeWidthM,
      Math.hypot(deltaZ, deltaY),
      -Math.atan2(deltaY, deltaZ),
      profile.rotationY,
      0,
      false,
    );
  };

  const addRbbLetter = (
    letter: string,
    signCenterZ: number,
    centerX: number,
  ): void => {
    const widthM = 1.75;
    const heightM = 2.8;
    const left = centerX - widthM / 2;
    const right = centerX + widthM / 2;
    const horizontal = (height: number): void =>
      addLine(signCenterZ, left, height, right, height);
    const vertical = (
      x: number,
      startHeight: number,
      endHeight: number,
    ): void => addLine(signCenterZ, x, startHeight, x, endHeight);

    vertical(left, 0, heightM);
    horizontal(heightM);
    horizontal(heightM / 2);
    vertical(right, heightM / 2, heightM);
    if (letter === "B") {
      horizontal(0);
      vertical(right, 0, heightM / 2);
    } else {
      addLine(signCenterZ, centerX, heightM / 2, right, 0);
    }
  };

  const rbbCenterZ = frontage.centerOffsetM[1] - 16;
  const rbbWidthM = 1.75;
  const rbbAdvanceM = 2.3;
  const rbbTextWidthM = rbbWidthM + 2 * rbbAdvanceM;
  [...frontage.roofSigns.texts[0]].forEach((letter, index) => {
    addRbbLetter(
      letter,
      rbbCenterZ,
      -rbbTextWidthM / 2 + rbbWidthM / 2 + index * rbbAdvanceM,
    );
  });

  const segmentLines = {
    a: [-0.7, 2.6, 0.7, 2.6],
    b: [0.7, 1.3, 0.7, 2.6],
    c: [0.7, 0, 0.7, 1.3],
    d: [-0.7, 0, 0.7, 0],
    e: [-0.7, 0, -0.7, 1.3],
    f: [-0.7, 1.3, -0.7, 2.6],
    g: [-0.7, 1.3, 0.7, 1.3],
  } as const;
  type SegmentName = keyof typeof segmentLines;
  const digitSegments: Record<string, readonly SegmentName[]> = {
    "3": ["a", "b", "c", "d", "g"],
    "4": ["b", "c", "f", "g"],
    "9": ["a", "b", "c", "d", "f", "g"],
  };
  const numberText = frontage.roofSigns.texts[1];
  const numberCenterZ = frontage.centerOffsetM[1] + 17;
  const glyphWidths = [...numberText].map((glyph) =>
    glyph === "." ? 0.45 : 1.4,
  );
  const glyphGapM = 0.38;
  const numberWidthM =
    glyphWidths.reduce((sum, width) => sum + width, 0) +
    glyphGapM * (glyphWidths.length - 1);
  let cursorX = -numberWidthM / 2;
  [...numberText].forEach((glyph, glyphIndex) => {
    const glyphWidthM = glyphWidths[glyphIndex];
    const glyphCenterX = cursorX + glyphWidthM / 2;
    if (glyph === ".") {
      addLocalBox(
        builder,
        EUROPA_SIGN_RED,
        profile.centerWorldM,
        profile.rotationY,
        facadeLocalX,
        baselineY + 0.3,
        numberCenterZ - glyphCenterX,
        strokeDepthM,
        0.5,
        0.5,
        0,
        false,
      );
    } else {
      for (const segment of digitSegments[glyph] ?? []) {
        const [startX, startY, endX, endY] = segmentLines[segment];
        addLine(
          numberCenterZ,
          glyphCenterX + startX,
          startY,
          glyphCenterX + endX,
          endY,
        );
      }
    }
    cursorX += glyphWidthM + glyphGapM;
  });

  for (const localZ of [rbbCenterZ - 2.1, rbbCenterZ + 2.1, numberCenterZ]) {
    addLocalBox(
      builder,
      EUROPA_SPANDREL,
      profile.centerWorldM,
      profile.rotationY,
      facadeLocalX - 0.16,
      GROUND_Y + frontage.heightM + 1.7,
      localZ,
      0.2,
      3.4,
      0.2,
      0,
      false,
    );
  }
}

function addEuropaFrontage(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.europaCenter;
  const frontage = profile.breitscheidplatzFrontage;
  const [baseWidthM, lengthM] = frontage.footprintM;
  const [centerX, centerZ] = frontage.centerOffsetM;
  const baseHeightM = 7.2;
  const officeHeightM = frontage.heightM - baseHeightM;
  const officeWidthM = baseWidthM + 2.1;

  addLocalBox(
    builder,
    EUROPA_PODIUM_PANEL,
    profile.centerWorldM,
    profile.rotationY,
    centerX,
    GROUND_Y + baseHeightM / 2,
    centerZ,
    baseWidthM,
    baseHeightM,
    lengthM,
  );
  for (const side of [-1, 1]) {
    const facadeX = centerX + side * (baseWidthM / 2 + 0.14);
    addLocalBox(
      builder,
      GLASS_DARK,
      profile.centerWorldM,
      profile.rotationY,
      facadeX,
      GROUND_Y + 2.05,
      centerZ,
      0.3,
      4.1,
      lengthM - 1.2,
      0,
      false,
    );
    addLocalBox(
      builder,
      EUROPA_SPANDREL,
      profile.centerWorldM,
      profile.rotationY,
      facadeX,
      GROUND_Y + 4.15,
      centerZ,
      0.32,
      0.45,
      lengthM - 0.8,
      0,
      false,
    );
    const panelBays = detailProfile === "mobile" ? 7 : 13;
    for (let bay = 1; bay < panelBays; bay += 1) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        facadeX,
        GROUND_Y + 5.65,
        centerZ - lengthM / 2 + (bay * lengthM) / panelBays,
        0.32,
        2.35,
        0.14,
        0,
        false,
      );
    }
  }

  addLocalBox(
    builder,
    EUROPA_PODIUM_GLASS,
    profile.centerWorldM,
    profile.rotationY,
    centerX,
    GROUND_Y + baseHeightM + officeHeightM / 2,
    centerZ,
    officeWidthM,
    officeHeightM,
    lengthM,
  );
  const officeBays = detailProfile === "mobile" ? 10 : 20;
  for (const side of [-1, 1]) {
    const facadeX = centerX + side * (officeWidthM / 2 + 0.14);
    for (let floor = 1; floor < frontage.officeStoreys; floor += 1) {
      addLocalBox(
        builder,
        EUROPA_SPANDREL,
        profile.centerWorldM,
        profile.rotationY,
        facadeX,
        GROUND_Y +
          baseHeightM +
          (floor * officeHeightM) / frontage.officeStoreys,
        centerZ,
        0.32,
        0.5,
        lengthM + 0.15,
        0,
        false,
      );
    }
    for (let bay = 1; bay < officeBays; bay += 1) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        facadeX,
        GROUND_Y + baseHeightM + officeHeightM / 2,
        centerZ - lengthM / 2 + (bay * lengthM) / officeBays,
        0.32,
        officeHeightM,
        0.18,
        0,
        false,
      );
    }
  }
  for (const side of [-1, 1]) {
    const facadeZ = centerZ + side * (lengthM / 2 + 0.14);
    for (let floor = 1; floor < frontage.officeStoreys; floor += 1) {
      addLocalBox(
        builder,
        EUROPA_SPANDREL,
        profile.centerWorldM,
        profile.rotationY,
        centerX,
        GROUND_Y +
          baseHeightM +
          (floor * officeHeightM) / frontage.officeStoreys,
        facadeZ,
        officeWidthM + 0.15,
        0.5,
        0.32,
        0,
        false,
      );
    }
    for (const localX of [-officeWidthM / 4, 0, officeWidthM / 4]) {
      addLocalBox(
        builder,
        EUROPA_MULLION,
        profile.centerWorldM,
        profile.rotationY,
        centerX + localX,
        GROUND_Y + baseHeightM + officeHeightM / 2,
        facadeZ,
        0.18,
        officeHeightM,
        0.32,
        0,
        false,
      );
    }
  }
  addLocalBox(
    builder,
    EUROPA_SPANDREL,
    profile.centerWorldM,
    profile.rotationY,
    centerX,
    GROUND_Y + frontage.heightM + 0.28,
    centerZ,
    officeWidthM + 0.5,
    0.56,
    lengthM + 0.5,
  );
  addEuropaRoofSigns(builder);
}

function addEuropaRoofStar(builder: Builder): Group {
  const profile = CITY_WEST_PROFILE.europaCenter;
  const [starLocalX, starLocalZ] = profile.roofStar.centerOffsetM;
  const [starX, starZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    starLocalX,
    starLocalZ,
  );
  const roofY = GROUND_Y + profile.towerHeightM;
  const starCenterY =
    GROUND_Y + profile.overallHeightM - profile.starDiameterM / 2;
  const supportTopY = starCenterY - profile.starDiameterM / 2 + 1.1;

  addLocalBox(
    builder,
    STONE_SHADOW,
    profile.centerWorldM,
    profile.rotationY,
    starLocalX,
    roofY + 0.34,
    starLocalZ,
    4.2,
    0.68,
    2.5,
  );
  for (const supportOffsetX of [-1.35, 1.35]) {
    const [x, z] = localPoint(
      profile.centerWorldM,
      profile.rotationY,
      starLocalX + supportOffsetX,
      starLocalZ,
    );
    addCylinder(
      builder,
      EUROPA_SPANDREL,
      x,
      (roofY + supportTopY) / 2,
      z,
      0.29,
      supportTopY - roofY,
      8,
      false,
    );
  }
  addLocalBox(
    builder,
    EUROPA_SPANDREL,
    profile.centerWorldM,
    profile.rotationY,
    starLocalX,
    supportTopY,
    starLocalZ,
    3.3,
    0.4,
    0.42,
    0,
    false,
  );

  const [antennaX, antennaZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    ...profile.roofStar.antennaOffsetM,
  );
  const antennaTopY = GROUND_Y + profile.overallHeightM - 4.2;
  addCylinder(
    builder,
    EUROPA_SPANDREL,
    antennaX,
    (roofY + antennaTopY) / 2,
    antennaZ,
    0.15,
    antennaTopY - roofY,
    6,
    false,
  );
  return createEuropaCenterStar(false, [starX, starCenterY, starZ]);
}

function addEuropaCenter(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): Group {
  addEuropaCurtainWall(builder, detailProfile);
  addEuropaFrontage(builder, detailProfile);
  return addEuropaRoofStar(builder);
}

type EuropaBlock = {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  color: number;
};

function europaBlockBatch(blocks: EuropaBlock[], name: string): InstancedMesh {
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true }),
    blocks.length,
  );
  const transform = new Object3D();
  const color = new Color();
  blocks.forEach((block, index) => {
    transform.position.set(block.x, block.y, block.z);
    transform.scale.set(block.w, block.h, block.d);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, color.setHex(block.color));
  });
  mesh.instanceMatrix.setUsage(StaticDrawUsage);
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = name;
  mesh.userData.blockNative = true;
  mesh.userData.textureFree = true;
  mesh.userData.instanceCount = blocks.length;
  return mesh;
}

/** Local geometry; only its single parent transform changes during rotation. */
function createEuropaCenterStar(
  blockNative: boolean,
  centre: readonly [number, number, number],
): Group {
  const pivot = new Group();
  pivot.name = blockNative
    ? "Minecraft Europa-Center rotating Mercedes star"
    : "Europa-Center rotating Mercedes star";
  pivot.position.set(...centre);
  pivot.rotation.y = CITY_WEST_PROFILE.europaCenter.rotationY;
  pivot.userData = {
    europaCenterStarPivot: true,
    centreWorld: [...centre],
    blockNative,
    textureFree: true,
    periodSeconds: 30,
  };
  if (blockNative) {
    // An independent voxel silhouette; no torus, triangle or curved mesh is
    // shared with the drawn representation. Adjacent cells are de-duplicated.
    const cells = new Map<string, EuropaBlock>();
    const cellM = 0.4;
    const add = (x: number, y: number): void => {
      const ix = Math.round(x / cellM), iy = Math.round(y / cellM);
      cells.set(`${ix}:${iy}`, {
        x: ix * cellM, y: iy * cellM, z: 0,
        w: cellM, h: cellM, d: cellM, color: 0xf2eee0,
      });
    };
    for (let step = 0; step < 120; step += 1) {
      const angle = step * Math.PI * 2 / 120;
      add(Math.cos(angle) * 4.8, Math.sin(angle) * 4.8);
    }
    for (let spoke = 0; spoke < 3; spoke += 1) {
      const angle = Math.PI / 2 + spoke * Math.PI * 2 / 3;
      for (let step = 0; step <= 12; step += 1) {
        const distance = step * cellM;
        const halfWidth = 0.55 * (1 - distance / 4.8);
        for (const width of [-halfWidth, 0, halfWidth]) {
          add(Math.cos(angle) * distance - Math.sin(angle) * width,
            Math.sin(angle) * distance + Math.cos(angle) * width);
        }
      }
    }
    pivot.add(europaBlockBatch([...cells.values()], "Voxel Mercedes ring and three tapered arms"));
  } else {
    const builder = createBuilder();
    // The real sign uses broad tapered arms, rather than three round sticks.
    const ring = new TorusGeometry(4.76, 0.24, 4, 64);
    pushGeometry(builder, ring, 0xf2eee0, false, true);
    for (let spoke = 0; spoke < 3; spoke += 1) {
      const angle = Math.PI / 2 + spoke * Math.PI * 2 / 3;
      const c = Math.cos(angle), s = Math.sin(angle);
      const outline = [[0, -0.58], [4.72, 0], [0, 0.58]];
      const positions: number[] = [];
      const point = (index: number, z: number): number[] => {
        const [x, y] = outline[index];
        return [x * c - y * s, x * s + y * c, z];
      };
      for (const z of [-0.2, 0.2]) {
        const order = z < 0 ? [0, 2, 1] : [0, 1, 2];
        for (const index of order) positions.push(...point(index, z));
      }
      for (let side = 0; side < 3; side += 1) {
        const next = (side + 1) % 3;
        for (const [index, z] of [[side, -0.2], [next, -0.2], [next, 0.2],
          [side, -0.2], [next, 0.2], [side, 0.2]]) positions.push(...point(index, z));
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      // Match the indexed ring for the shared drawn geometry merge.
      geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, index) => index));
      pushGeometry(builder, geometry, 0xf2eee0, false, true);
    }
    const star = finishDrawnGroup(builder, {
      name: "Europa-Center silver Mercedes ring and tapered arms",
      lampEmissive: 0xf5f3e6,
      lampEmissiveIntensity: 1.1,
    });
    if (star) pivot.add(star);
  }
  return pivot;
}

export function isEuropaCenterStarTarget(object: Object3D): boolean {
  return object.userData.europaCenterStarPivot === true;
}

/** Caller owns visibility/frame gating; no timer, allocation or scene traversal. */
export function updateEuropaCenterStars(
  targets: readonly Object3D[],
  elapsedSeconds: number,
): void {
  if (!Number.isFinite(elapsedSeconds)) return;
  const turn = ((elapsedSeconds % 30) + 30) % 30;
  const yaw = CITY_WEST_PROFILE.europaCenter.rotationY + turn * Math.PI * 2 / 30;
  for (const pivot of targets) {
    pivot.rotation.y = yaw;
    pivot.updateMatrix();
  }
}

/**
 * Block-native tower, raised western office band and rotating roof sign.
 * The full mapped complex/podium (source prism 54276972) remains untouched:
 * this adds the two higher building parts absent from the central payload.
 */
export function createMinecraftEuropaCenter(): Group {
  const p = CITY_WEST_PROFILE.europaCenter;
  const group = new Group();
  group.name = "Minecraft Europa-Center tower and Breitscheidplatz frontage";
  group.position.set(p.centerWorldM[0], GROUND_Y, p.centerWorldM[1]);
  group.rotation.y = p.rotationY;
  const blocks: EuropaBlock[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number): void => {
    blocks.push({ x, y, z, w, h, d, color });
  };
  const [width, depth] = p.towerFootprintM;
  const wall = p.curtainWall;
  // Only exterior surface strips, no thousands of concealed fill voxels.
  // Every one of the 21 window rows remains present on mobile as on desktop.
  const floorHeight = (p.towerHeightM - wall.baseHeightM) / wall.storeyRows;
  for (let floor = 0; floor < wall.storeyRows; floor += 1) {
    const bottom = wall.baseHeightM + floor * floorHeight;
    for (const side of [-1, 1]) {
      box(0, bottom + wall.spandrelHeightM / 2, side * depth / 2,
        width, wall.spandrelHeightM, 0.45, EUROPA_SPANDREL);
      box(side * width / 2, bottom + wall.spandrelHeightM / 2, 0,
        0.45, wall.spandrelHeightM, depth, EUROPA_SPANDREL);
      for (let bay = 0; bay < wall.longFaceMullionBays; bay += 1) {
        box(-width / 2 + (bay + 0.5) * width / wall.longFaceMullionBays,
          bottom + (floorHeight + wall.spandrelHeightM) / 2, side * depth / 2,
          width / wall.longFaceMullionBays - 0.18, floorHeight - wall.spandrelHeightM,
          0.4, EUROPA_GLASS);
      }
      for (let bay = 0; bay < wall.shortFaceMullionBays; bay += 1) {
        box(side * width / 2, bottom + (floorHeight + wall.spandrelHeightM) / 2,
          -depth / 2 + (bay + 0.5) * depth / wall.shortFaceMullionBays,
          0.4, floorHeight - wall.spandrelHeightM,
          depth / wall.shortFaceMullionBays - 0.18, EUROPA_GLASS);
      }
    }
  }
  for (const side of [-1, 1]) {
    for (let bay = 0; bay <= wall.longFaceMullionBays; bay += 1)
      box(-width / 2 + bay * width / wall.longFaceMullionBays, 47,
        side * (depth / 2 + 0.1), 0.18, 78, 0.45, EUROPA_MULLION);
    for (let bay = 0; bay <= wall.shortFaceMullionBays; bay += 1)
      box(side * (width / 2 + 0.1), 47,
        -depth / 2 + bay * depth / wall.shortFaceMullionBays,
        0.45, 78, 0.18, EUROPA_MULLION);
  }
  box(0, 85.72, 0, width + 0.7, 0.56, depth + 0.7, EUROPA_SPANDREL);
  const frontage = p.breitscheidplatzFrontage;
  const [fx, fz] = frontage.centerOffsetM;
  const [fw, fd] = frontage.footprintM;
  box(fx, 13.5, fz, fw + 2.1, 9, fd, EUROPA_PODIUM_GLASS);
  for (const side of [-1, 1]) {
    for (let floor = 1; floor < 3; floor += 1)
      box(fx + side * ((fw + 2.1) / 2 + 0.12), 7.2 + floor * 3.6, fz,
        0.45, 0.5, fd, EUROPA_SPANDREL);
    for (let bay = 0; bay <= 20; bay += 1)
      box(fx + side * ((fw + 2.1) / 2 + 0.12), 13.5, fz - fd / 2 + bay * fd / 20,
        0.45, 9, 0.22, EUROPA_MULLION);
  }
  box(fx, 18.28, fz, fw + 2.6, 0.56, fd + 0.5, EUROPA_SPANDREL);
  const [sx, sz] = p.roofStar.centerOffsetM;
  box(sx, 86.34, sz, 4.2, 0.68, 2.5, STONE_SHADOW);
  for (const dx of [-1.35, 1.35]) box(sx + dx, 90.05, sz, 0.58, 8.1, 0.58, EUROPA_SPANDREL);
  box(sx, 94.1, sz, 3.3, 0.4, 0.45, EUROPA_SPANDREL);
  const [ax, az] = p.roofStar.antennaOffsetM;
  box(ax, 92.4, az, 0.3, 12.8, 0.3, EUROPA_SPANDREL);
  const facade = europaBlockBatch(blocks, "Voxel Europa-Center facade and roof supports");
  group.add(facade);
  const [starX, starZ] = localPoint(p.centerWorldM, p.rotationY, sx, sz);
  const star = createEuropaCenterStar(true, [starX, GROUND_Y + 98, starZ]);
  // Keep the native pivot in world coordinates like the drawn pivot: the
  // returned wrapper has no transform, and its static child owns the OSM yaw.
  const root = new Group();
  root.name = "Minecraft Europa-Center recognition details";
  root.add(group, star);
  root.userData = {
    sourceProfile: p,
    preservedSourcePrismIds: ["54276972"],
    drawCallBudget: 2,
    instanceBudget: 1_800,
    instanceCount: blocks.length + (star.children[0] as InstancedMesh).count,
    blockNative: true,
    textureFree: true,
  };
  return root;
}

function addAllianzHaus(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.allianzHaus;
  const [lengthM, depthM] = profile.towerFootprintM;
  const heightM = profile.inferredTowerHeightM;
  addBox(
    builder,
    TRAVERTINE,
    profile.centerWorldM[0],
    GROUND_Y + heightM / 2,
    profile.centerWorldM[1],
    lengthM,
    heightM,
    depthM,
    profile.rotationY,
  );
  const bayCount = detailProfile === "mobile" ? 7 : 14;
  for (const side of [-1, 1]) {
    for (let bay = 0; bay < bayCount; bay += 1) {
      const localX =
        -lengthM / 2 + ((bay + 0.5) * lengthM) / bayCount;
      const [x, z] = localPoint(
        profile.centerWorldM,
        profile.rotationY,
        localX,
        side * (depthM / 2 + 0.13),
      );
      addBox(
        builder,
        GLASS_DARK,
        x,
        GROUND_Y + 3.5 + (heightM - 7) / 2,
        z,
        (lengthM / bayCount) * 0.67,
        heightM - 7,
        0.3,
        profile.rotationY,
        false,
      );
    }
  }
  addAllianzRoofWordmark(builder);

  // The six-storey street wing is rendered as a three-segment, lightly
  // concave chain.  Its envelope follows OSM part 363431190; the segmentation
  // is a visual approximation of the official description, not a new survey.
  const wingSegments = [
    { center: [-2810.5, 1727.5] as const, rotation: 0.13 },
    { center: [-2814.2, 1707.7] as const, rotation: 0.04 },
    { center: [-2812.2, 1688.2] as const, rotation: -0.11 },
  ];
  for (const [index, wing] of wingSegments.entries()) {
    const wingHeight = index === wingSegments.length - 1 ? 22 : 20;
    addBox(
      builder,
      TRAVERTINE,
      wing.center[0],
      GROUND_Y + wingHeight / 2,
      wing.center[1],
      16,
      wingHeight,
      22,
      wing.rotation,
    );
    const ribs = detailProfile === "mobile" ? 3 : 6;
    for (let rib = 1; rib < ribs; rib += 1) {
      const [x, z] = localPoint(
        wing.center,
        wing.rotation,
        -8 + (rib * 16) / ribs,
        11.12,
      );
      addBox(
        builder,
        GLASS_DARK,
        x,
        GROUND_Y + 4 + (wingHeight - 8) / 2,
        z,
        1.25,
        wingHeight - 8,
        0.28,
        wing.rotation,
        false,
      );
    }
  }
  for (const [index, wing] of wingSegments.entries()) {
    const [x, z] = localPoint(
      wing.center,
      wing.rotation,
      index === 1 ? 1.5 : 0,
      13.3,
    );
    addBox(
      builder,
      TRAVERTINE,
      x,
      GROUND_Y + 4.15,
      z,
      index === 1 ? 20 : 17,
      0.45,
      5.2,
      wing.rotation,
    );
  }
}

function addFacadeGridBox(
  builder: Builder,
  options: {
    center: readonly [number, number];
    depthM: number;
    detailProfile: CityWestDetailProfile;
    heightM: number;
    lengthM: number;
    rotationY: number;
  },
): void {
  addBox(
    builder,
    KWG_BLUE,
    options.center[0],
    GROUND_Y + 0.8 + options.heightM / 2,
    options.center[1],
    options.lengthM,
    options.heightM,
    options.depthM,
    options.rotationY,
  );
  addLongFacadeFrames(builder, {
    center: options.center,
    color: CONCRETE,
    depthM: options.depthM,
    groundY: GROUND_Y + 0.8,
    heightM: options.heightM,
    horizontalCount: options.detailProfile === "mobile" ? 2 : 4,
    lengthM: options.lengthM,
    rotationY: options.rotationY,
    verticalCount: options.detailProfile === "mobile" ? 4 : 8,
  });
}

/** One indexed quad per glass cell; the continuous concrete skin supplies
 * the joints without thousands of boxes or per-window scene objects. */
function addEiermannGlassLattice(
  builder: Builder,
  glass: Builder,
  profile: {
    centerWorldM: readonly [number, number];
    diameterM: number;
    heightM: number;
    facadeSides: number;
    lattice: { columnsPerFace: number; rows: number; jointM: number };
  },
  groundY: number,
  isBellTower: boolean,
): void {
  const radius = profile.diameterM / 2;
  const apothem = radius * Math.cos(Math.PI / profile.facadeSides);
  const faceWidth = 2 * radius * Math.sin(Math.PI / profile.facadeSides);
  const { columnsPerFace, rows, jointM } = profile.lattice;
  const pitchX = faceWidth / columnsPerFace;
  const pitchY = (profile.heightM - 0.8) / rows;
  const palette = [
    KWG_BLUE,
    0x46565b,
    0x334448,
    0x5a676b,
    0x685456,
    0x566561,
    0x8b8266,
  ];
  const positions = palette.map(() => [] as number[]);
  const indices = palette.map(() => [] as number[]);
  addCylinder(
    builder,
    KWG_GRID,
    profile.centerWorldM[0],
    groundY + (profile.heightM - 0.34) / 2,
    profile.centerWorldM[1],
    radius,
    profile.heightM - 0.34,
    profile.facadeSides,
  );
  for (let face = 0; face < profile.facadeSides; face += 1) {
    const theta = ((face + 0.5) * Math.PI * 2) / profile.facadeSides;
    const normalX = Math.sin(theta),
      normalZ = Math.cos(theta);
    const tangentX = Math.cos(theta),
      tangentZ = -Math.sin(theta);
    for (let row = 0; row < rows; row += 1) {
      const y = groundY + 0.4 + (row + 0.5) * pitchY;
      if (
        isBellTower &&
        Math.abs(
          y -
            groundY -
            CITY_WEST_PROFILE.gedaechtniskirche.bellTower
              .bellChamberBandCenterHeightM,
        ) < 1.1
      )
        continue;
      for (let column = 0; column < columnsPerFace; column += 1) {
        // Concrete lower register around the entrance remains visibly distinct.
        if (!isBellTower && row < 2) continue;
        const seed = face * 127 + row * 23 + column * 41;
        const tone = seed % 67 === 0 ? 4 + (seed % 3) : seed % 4;
        const vertex = positions[tone].length / 3;
        const u = -faceWidth / 2 + (column + 0.5) * pitchX;
        for (const [du, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          const across = u + (du * (pitchX - jointM)) / 2;
          positions[tone].push(
            profile.centerWorldM[0] +
              normalX * (apothem + 0.025) +
              tangentX * across,
            y + (dy * (pitchY - jointM)) / 2,
            profile.centerWorldM[1] +
              normalZ * (apothem + 0.025) +
              tangentZ * across,
          );
        }
        indices[tone].push(
          vertex,
          vertex + 1,
          vertex + 2,
          vertex,
          vertex + 2,
          vertex + 3,
        );
      }
    }
    // The projecting round steel supports belong at polygon vertices.
    const corner = (face * Math.PI * 2) / profile.facadeSides;
    addCylinder(
      builder,
      0x5e6568,
      profile.centerWorldM[0] + Math.sin(corner) * radius,
      groundY + profile.heightM / 2,
      profile.centerWorldM[1] + Math.cos(corner) * radius,
      isBellTower ? 0.16 : 0.22,
      profile.heightM,
      6,
    );
  }
  for (let tone = 0; tone < palette.length; tone += 1) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions[tone], 3),
    );
    geometry.setIndex(indices[tone]);
    pushGeometry(glass, geometry, palette[tone], false, true);
  }
  addCylinder(
    builder,
    0x555e62,
    profile.centerWorldM[0],
    groundY + profile.heightM - 0.16,
    profile.centerWorldM[1],
    radius + 0.08,
    0.32,
    profile.facadeSides,
  );
}

function addRetainedChurchWings(builder: Builder): void {
  for (const part of GEDAECHTNISKIRCHE_RETAINED_WINGS) {
    const ring = part.ring.map(([x, z]) => new Vector2(x, z));
    if (!ShapeUtils.isClockWise(ring)) ring.reverse();
    const positions: number[] = [], indices: number[] = [];
    for (const vertex of ring) positions.push(vertex.x, part.topY, vertex.y);
    for (const [a,b,c] of ShapeUtils.triangulateShape(ring, [])) indices.push(a,c,b);
    for (let i=0;i<ring.length;i+=1) {
      const a=ring[i], b=ring[(i+1)%ring.length], n=positions.length/3;
      positions.push(a.x,part.baseY,a.y,b.x,part.baseY,b.y,b.x,part.topY,b.y,a.x,part.topY,a.y);
      indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);
    pushGeometry(builder,geometry,RUIN_STONE,true);
  }
}

function addGedaechtniskirche(
  builder: Builder,
  glass: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.gedaechtniskirche;
  addBox(
    builder,
    0xb8afa0,
    -2507,
    GROUND_Y + profile.podiumHeightM / 2,
    1507,
    88,
    profile.podiumHeightM,
    72,
    0.05,
    false,
  );
  addGedaechtniskircheRuin(builder);
  addRetainedChurchWings(builder);

  const church = profile.church;
  const churchGround = GROUND_Y + profile.podiumHeightM;
  addEiermannGlassLattice(builder, glass, church, churchGround, false);
  // Main bronze door group faces the old tower: three separate leaves below
  // the concrete glass field and a thin cantilevered shelter.
  const entranceTheta = Math.PI / 2 - Math.PI / 8;
  const doorCenter: readonly [number, number] = [
    church.centerWorldM[0] +
      Math.sin(entranceTheta) *
        ((church.diameterM / 2) * Math.cos(Math.PI / 8) + 0.1),
    church.centerWorldM[1] +
      Math.cos(entranceTheta) *
        ((church.diameterM / 2) * Math.cos(Math.PI / 8) + 0.1),
  ];
  for (const offset of [-1.65, 0, 1.65]) {
    addLocalBox(
      builder,
      BRONZE,
      doorCenter,
      entranceTheta,
      offset,
      churchGround + 1.9,
      0.08,
      1.52,
      3.5,
      0.24,
      0,
      false,
    );
    addLocalBox(
      builder,
      0xbaaa82,
      doorCenter,
      entranceTheta,
      offset + 0.52,
      churchGround + 1.6,
      0.22,
      0.09,
      0.55,
      0.12,
      0,
      false,
    );
  }
  addLocalBox(
    builder,
    0x666963,
    doorCenter,
    entranceTheta,
    0,
    churchGround + 3.95,
    0.8,
    6.1,
    0.22,
    2.25,
    0,
    false,
  );
  const bell = profile.bellTower;
  const bellRadiusM = bell.diameterM / 2;
  addEiermannGlassLattice(builder, glass, bell, churchGround, true);
  addCylinder(
    builder,
    0x5f6262,
    bell.centerWorldM[0],
    churchGround + bell.bellChamberBandCenterHeightM,
    bell.centerWorldM[1],
    bellRadiusM + 0.2,
    bell.bellChamberBandHeightM,
    bell.facadeSides,
  );
  addCylinder(
    builder,
    KWG_GRID,
    bell.centerWorldM[0],
    churchGround + bell.heightM - 0.32,
    bell.centerWorldM[1],
    bellRadiusM + 0.16,
    0.3,
    bell.facadeSides,
  );
  const crossBaseY = churchGround + bell.heightM;
  addCylinder(
    builder,
    0xc8a24b,
    bell.centerWorldM[0],
    crossBaseY + bell.finial.poleLengthM / 2,
    bell.centerWorldM[1],
    0.18,
    bell.finial.poleLengthM,
    6,
  );
  addCylinder(
    builder,
    0xc8a24b,
    bell.centerWorldM[0],
    crossBaseY + bell.finial.poleLengthM,
    bell.centerWorldM[1],
    0.55,
    0.8,
    8,
  );
  addRotatedBox(
    builder,
    0xc8a24b,
    bell.centerWorldM[0],
    crossBaseY + bell.finial.poleLengthM + bell.finial.crossHeightM / 2,
    bell.centerWorldM[1],
    2.1,
    0.22,
    0.22,
    0,
    0,
    0,
  );
  addBox(
    builder,
    0xc8a24b,
    bell.centerWorldM[0],
    crossBaseY + bell.finial.poleLengthM + bell.finial.crossHeightM / 2,
    bell.centerWorldM[1],
    0.22,
    bell.finial.crossHeightM,
    0.22,
  );

  addFacadeGridBox(builder, {
    center: profile.foyerCenterWorldM,
    depthM: 14,
    detailProfile,
    heightM: 5,
    lengthM: 24,
    rotationY: 0.24,
  });
  addFacadeGridBox(builder, {
    center: profile.chapelCenterWorldM,
    depthM: 14,
    detailProfile,
    heightM: 6.1,
    lengthM: 24,
    rotationY: 0.2,
  });
}

function addBreitscheidplatz(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.breitscheidplatz;
  const center = profile.fountainCenterWorldM;
  addBox(
    builder,
    0xbab7ae,
    center[0],
    GROUND_Y + 0.18,
    center[1],
    profile.fountainBasinM + 4,
    0.36,
    profile.fountainBasinM + 4,
    0,
    false,
  );
  addBox(
    builder,
    WATER,
    center[0],
    GROUND_Y + 0.4,
    center[1],
    profile.fountainBasinM,
    0.25,
    profile.fountainBasinM,
    0,
    false,
  );
  const globe = new SphereGeometry(
    profile.globeDiameterM / 2,
    detailProfile === "mobile" ? 12 : 20,
    detailProfile === "mobile" ? 6 : 10,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  globe.translate(center[0], GROUND_Y + 0.52, center[1]);
  pushGeometry(builder, globe, GRANITE_RED, true);
  for (const offset of [-5.2, 0, 5.2]) {
    addCylinder(
      builder,
      WATER,
      center[0] + offset,
      GROUND_Y + 2,
      center[1] - 1.5,
      0.14,
      3.2,
      5,
    );
  }
  const figureCount = detailProfile === "mobile" ? 2 : 5;
  for (let index = 0; index < figureCount; index += 1) {
    const angle = (index * Math.PI * 2) / figureCount;
    addCylinder(
      builder,
      BRONZE,
      center[0] + Math.cos(angle) * 5.6,
      GROUND_Y + 1.35,
      center[1] + Math.sin(angle) * 5.6,
      0.35,
      1.8,
      6,
    );
    addCone(
      builder,
      BRONZE,
      center[0] + Math.cos(angle) * 5.6,
      GROUND_Y + 2.65,
      center[1] + Math.sin(angle) * 5.6,
      0.55,
      0.8,
      6,
      false,
    );
  }

  // Ground-light bands and benches cue the unified pedestrian square without
  // replacing its authoritative surface/road meshes.
  for (const offset of [-26, -4, 18]) {
    addRotatedBox(
      builder,
      0xdad5b6,
      -2460 + offset,
      GROUND_Y + 0.08,
      1540 + offset * 0.18,
      32,
      0.12,
      0.28,
      0,
      -0.08,
      0,
      false,
      true,
    );
  }
  const benches = detailProfile === "mobile" ? 2 : 4;
  for (let index = 0; index < benches; index += 1) {
    addBox(
      builder,
      0x72533c,
      -2445 + index * 11,
      GROUND_Y + 0.72,
      1558 + (index % 2) * 5,
      5.5,
      0.35,
      1.2,
      0.08,
    );
  }
}

function addUrania(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.urania;
  const [lengthM, depthM] = profile.footprintM;
  addBox(
    builder,
    0x3e5d65,
    profile.centerWorldM[0],
    GROUND_Y + profile.heightM / 2,
    profile.centerWorldM[1],
    lengthM,
    profile.heightM,
    depthM,
    profile.rotationY,
  );
  const [rearX, rearZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    12,
    11,
  );
  addBox(
    builder,
    0xc5ad8f,
    rearX,
    GROUND_Y + 7,
    rearZ,
    30,
    14,
    19,
    profile.rotationY,
  );

  const frontOffset = -depthM / 2 - 0.2;
  const [frontX, frontZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    -2,
    frontOffset,
  );
  addBox(
    builder,
    0x76949a,
    frontX,
    GROUND_Y + 5,
    frontZ,
    54,
    8.2,
    0.35,
    profile.rotationY,
    false,
  );
  const [canopyX, canopyZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    -1,
    frontOffset - 3.2,
  );
  addBox(
    builder,
    0xe7e6df,
    canopyX,
    GROUND_Y + 7.9,
    canopyZ,
    56,
    0.5,
    7,
    profile.rotationY,
  );
  const columns = detailProfile === "mobile" ? 4 : 8;
  const accentPalette = [URANIA_RED, 0xd45f54, 0xc99939, 0x7d6296];
  for (let index = 0; index < columns; index += 1) {
    const [x, z] = localPoint(
      profile.centerWorldM,
      profile.rotationY,
      -25 + (index * 50) / (columns - 1),
      frontOffset - 3.1,
    );
    addCylinder(
      builder,
      accentPalette[index % accentPalette.length],
      x,
      GROUND_Y + 4,
      z,
      0.42,
      7.8,
      8,
    );
  }
  const [signX, signZ] = localPoint(
    profile.centerWorldM,
    profile.rotationY,
    -9,
    frontOffset - 3.6,
  );
  addRotatedBox(
    builder,
    URANIA_RED,
    signX,
    GROUND_Y + 9.1,
    signZ,
    17,
    1.6,
    0.35,
    0,
    profile.rotationY,
    0,
    false,
    true,
  );
  const rearWindowCount = detailProfile === "mobile" ? 3 : 6;
  for (let index = 0; index < rearWindowCount; index += 1) {
    const [x, z] = localPoint(
      [rearX, rearZ],
      profile.rotationY,
      -12 + (index * 24) / (rearWindowCount - 1),
      9.62,
    );
    addBox(
      builder,
      GLASS_DARK,
      x,
      GROUND_Y + 7,
      z,
      2.2,
      8.5,
      0.28,
      profile.rotationY,
      false,
    );
  }
}

function finishBatch(
  builder: Builder,
  name: string,
  userData: Record<string, unknown>,
): Group | null {
  const group = finishDrawnGroup(builder, {
    lampEmissive: 0xffd66e,
    lampEmissiveIntensity: 0.65,
    name,
  });
  if (group) group.userData = userData;
  return group;
}

export function createCityWestDetails(
  detailProfile: CityWestDetailProfile = "full",
): Group {
  detailProfile = staticModelDetailProfile(detailProfile);
  const group = new Group();
  group.name = "City West and Urania recognition details";
  group.userData.detailProfile = detailProfile;
  group.userData.geometryStatus = CITY_WEST_PROFILE.geometryStatus;
  group.userData.profile = CITY_WEST_PROFILE;
  group.userData.sourceUrls = CITY_WEST_SOURCE_URLS;
  group.userData.batchPolicy =
    "all facade grids, signs, and ornaments are merged into three local drawn batches; measured Zoo halls and Kranzler are separate source owners; one independent star pivot rotates without rebuilding geometry";

  const towers = createBuilder();
  const europaStar = addEuropaCenter(towers, detailProfile);
  addAllianzHaus(towers, detailProfile);
  const towerBatch = finishBatch(towers, "City West Europa Center and Allianz towers", {
    allianzHaus: CITY_WEST_PROFILE.allianzHaus,
    europaCenter: CITY_WEST_PROFILE.europaCenter,
  });
  if (towerBatch) {
    towerBatch.add(europaStar);
    group.add(towerBatch);
  }

  const breitscheid = createBuilder();
  const churchGlass = createBuilder();
  addGedaechtniskirche(breitscheid, churchGlass, detailProfile);
  addBreitscheidplatz(breitscheid, detailProfile);
  const breitscheidBatch = finishBatch(
    breitscheid,
    "Gedächtniskirche and Breitscheidplatz ensemble",
    {
      breitscheidplatz: CITY_WEST_PROFILE.breitscheidplatz,
      gedaechtniskirche: CITY_WEST_PROFILE.gedaechtniskirche,
    },
  );
  if (breitscheidBatch) {
    const glazing = finishDrawnGroup(churchGlass, {
      name: "Gedächtniskirche blue concrete-glass cells",
      lampEmissive: 0x234bad,
      lampEmissiveIntensity: 0.6,
    });
    if (glazing) breitscheidBatch.add(glazing);
    group.add(breitscheidBatch);
  }

  const urania = createBuilder();
  addUrania(urania, detailProfile);
  const uraniaBatch = finishBatch(urania, "Urania mirrored entrance ensemble", {
    urania: CITY_WEST_PROFILE.urania,
  });
  if (uraniaBatch) group.add(uraniaBatch);

  return group;
}
