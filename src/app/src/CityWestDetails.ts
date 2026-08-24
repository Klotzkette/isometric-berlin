import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  SphereGeometry,
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
const RUIN_STONE = 0x716a62;
const RUIN_LIGHT = 0x92877a;
const RUIN_ACCENT = 0x5b5751;
const STONE_SHADOW = 0x3d3832;
const CONCRETE = 0x777b7d;
const KWG_BLUE = 0x24425a;
const KWG_GRID = 0x8a8d89;
const CLOCK_GOLD = 0xd1ad4a;
const PATINA_GREEN = 0x63847e;
const BRONZE = 0x66503b;
const GRANITE_RED = 0x9d4c3f;
const WATER = 0x5cacc1;
const URANIA_RED = 0xb73332;

/**
 * Survey and source profile for the City-West recognition layer.
 *
 * Coordinates are OSM rings transformed to the viewer's EPSG:25833 frame:
 * world_x=easting-389500, world_z=5820000-northing.  Berlin's LoD2 extract
 * does not cover these individual building parts, so current OSM outlines
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
      longFaceMullionBays: 18,
      mobileLongFaceStoreyRows: 17,
      mobileShortFaceStoreyRows: 9,
      shortFaceMullionBays: 6,
      storeyRows: 21,
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
        "ten-metre outer diameter with one central hub, three radial spokes, dark roof cradle and adjacent mast; static recognition pose in the viewer",
    },
    sources: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096462",
      "https://europa-center-berlin.de/timeline/der-punkt-auf-dem-i/",
      "https://europa-center-berlin.de/timeline/eroeffnung/",
      "https://europa-center-berlin.de/information/historie/",
      "https://www.openstreetmap.org/way/1054276972",
      "https://www.openstreetmap.org/way/26408382",
      "https://www.openstreetmap.org/way/26408381",
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
      sourceBuildingId: "OSM-way-15218371",
    },
    foyerCenterWorldM: [-2565.322, 1490.536] as const,
    foyerSourceBuildingId: "OSM-way-15218374",
    oldTower: {
      belfryArchesPerLongFace: 3,
      brokenCrown: {
        maxHeightM: 71,
        patinaColor: "green-grey",
        status:
          "asymmetric procedural silhouette cross-checked against the supplied street photograph; no photograph or texture is bundled",
      },
      centerWorldM: [-2495.572, 1507.709] as const,
      clock: {
        centerHeightM: 36.4,
        diameterM: 7.2,
        hourMarkers: 12,
      },
      footprintM: [31, 18] as const,
      heightM: 71,
      originalHeightM: 113,
      portal: {
        archRadiusM: 5.25,
        clearWidthM: 10.5,
        openThrough: true,
        springHeightM: 11,
      },
      recognitionGeometry:
        "open lower arch, gold clock, triple belfry arches, corner buttresses and turrets, and a green-grey jagged crown",
      rotationY: (79.93 * Math.PI) / 180,
      sourceBuildingId: "OSM-way-15218373",
    },
    podiumAreaM2: 4120,
    podiumHeightM: 0.8,
    sources: [
      "https://www.gedaechtniskirche-berlin.de/bauensemble/ensemble-aus-alt-und-neu",
      "https://www.gedaechtniskirche-berlin.de/gebaeude/architektur",
      "https://www.gedaechtniskirche-berlin.de/geschichte/das-kirchen-ensemble/gebaeude-1895-1963/der-glockenturm",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040472",
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
  full: { maxRenderables: 12, maxVertices: 26_100 },
  mobile: { maxRenderables: 12, maxVertices: 16_900 },
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

function addLocalFacadeDisc(
  builder: Builder,
  color: number,
  center: readonly [number, number],
  rotationY: number,
  localX: number,
  centerY: number,
  localZ: number,
  radius: number,
  depth: number,
  segments: number,
  inked = true,
): void {
  const [x, z] = localPoint(center, rotationY, localX, localZ);
  const geometry = new CylinderGeometry(radius, radius, depth, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.rotateY(rotationY);
  geometry.translate(x, centerY, z);
  pushGeometry(builder, geometry, color, inked);
}

function addLocalFacadeArch(
  builder: Builder,
  color: number,
  center: readonly [number, number],
  rotationY: number,
  localX: number,
  centerY: number,
  localZ: number,
  radius: number,
  tube: number,
  segments: number,
  inked = true,
): void {
  const [x, z] = localPoint(center, rotationY, localX, localZ);
  const geometry = new TorusGeometry(radius, tube, 4, segments, Math.PI);
  geometry.rotateY(rotationY);
  geometry.translate(x, centerY, z);
  pushGeometry(builder, geometry, color, inked);
}

function addLocalBrokenBox(
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
  topSlopeM: number,
  rotationZ: number,
): void {
  const [x, z] = localPoint(center, rotationY, localX, localZ);
  const geometry = new BoxGeometry(sizeX, sizeY, sizeZ);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) <= 0) continue;
    const normalizedX = positions.getX(index) / (sizeX / 2);
    positions.setY(
      index,
      positions.getY(index) + normalizedX * topSlopeM,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  if (rotationZ !== 0) geometry.rotateZ(rotationZ);
  geometry.rotateY(rotationY);
  geometry.translate(x, centerY, z);
  pushGeometry(builder, geometry, color);
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
  const spandrelHeightM = detailProfile === "mobile" ? 0.72 : 0.58;

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
    for (let storey = 1; storey < longStoreyRows; storey += 1) {
      addLocalBox(
        builder,
        EUROPA_SPANDREL,
        profile.centerWorldM,
        profile.rotationY,
        0,
        GROUND_Y +
          wall.baseHeightM +
          (storey * wallHeightM) / longStoreyRows,
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
    for (let storey = 1; storey < shortStoreyRows; storey += 1) {
      addLocalBox(
        builder,
        EUROPA_SPANDREL,
        profile.centerWorldM,
        profile.rotationY,
        localX,
        GROUND_Y +
          wall.baseHeightM +
          (storey * wallHeightM) / shortStoreyRows,
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

function addEuropaRoofStar(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
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
  const tubeRadiusM = 0.34;
  const ringRadiusM = profile.starDiameterM / 2 - tubeRadiusM;
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

  const ring = new TorusGeometry(
    ringRadiusM,
    tubeRadiusM,
    4,
    detailProfile === "mobile" ? 20 : 32,
  );
  ring.rotateY(profile.rotationY);
  ring.translate(starX, starCenterY, starZ);
  pushGeometry(builder, ring, 0xf2eee0, false, true);

  const spokeLengthM = ringRadiusM - tubeRadiusM;
  for (let spoke = 0; spoke < 3; spoke += 1) {
    const angle = Math.PI / 2 + (spoke * Math.PI * 2) / 3;
    const [x, z] = localPoint(
      profile.centerWorldM,
      profile.rotationY,
      starLocalX + (Math.cos(angle) * spokeLengthM) / 2,
      starLocalZ,
    );
    addRotatedBox(
      builder,
      0xf2eee0,
      x,
      starCenterY + (Math.sin(angle) * spokeLengthM) / 2,
      z,
      spokeLengthM,
      0.38,
      0.4,
      0,
      profile.rotationY,
      angle,
      false,
      true,
    );
  }
  const hub = new SphereGeometry(0.58, detailProfile === "mobile" ? 6 : 8, 5);
  hub.translate(starX, starCenterY, starZ);
  pushGeometry(builder, hub, 0xf2eee0, false, true);

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
}

function addEuropaCenter(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  addEuropaCurtainWall(builder, detailProfile);
  addEuropaFrontage(builder, detailProfile);
  addEuropaRoofStar(builder, detailProfile);
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

function addKranzlerEck(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.kranzlerEck;
  const [lengthM, depthM] = profile.glassTowerFootprintM;
  // A shallow overlay corrects the generic sixty-metre prism into the narrow,
  // Helmut-Jahn glass wedge without introducing a second free-standing tower.
  addBox(
    builder,
    0x516e78,
    profile.glassTowerCenterWorldM[0],
    GROUND_Y + profile.glassTowerHeightM / 2,
    profile.glassTowerCenterWorldM[1],
    lengthM,
    profile.glassTowerHeightM,
    depthM,
    profile.glassTowerRotationY,
  );
  addLongFacadeFrames(builder, {
    center: profile.glassTowerCenterWorldM,
    color: 0xb8c6c7,
    depthM,
    groundY: GROUND_Y,
    heightM: profile.glassTowerHeightM,
    horizontalCount: detailProfile === "mobile" ? 6 : 16,
    lengthM,
    rotationY: profile.glassTowerRotationY,
    verticalCount: detailProfile === "mobile" ? 7 : 13,
  });

  const rotunda = profile.rotundaCenterWorldM;
  addBox(
    builder,
    0xe2ded2,
    rotunda[0] - 3,
    GROUND_Y + 4,
    rotunda[1] + 2,
    30,
    8,
    24,
    -0.08,
  );
  addCylinder(
    builder,
    0xf0eadc,
    rotunda[0],
    GROUND_Y + 10.2,
    rotunda[1],
    profile.rotundaDiameterM / 2,
    4.4,
    detailProfile === "mobile" ? 16 : 24,
  );
  const awningPanels = detailProfile === "mobile" ? 12 : 20;
  for (let index = 0; index < awningPanels; index += 1) {
    const angle = (index * Math.PI * 2) / awningPanels;
    const radius = profile.rotundaDiameterM / 2 + 0.08;
    addBox(
      builder,
      index % 2 === 0 ? 0xc93632 : 0xf3eee1,
      rotunda[0] + Math.cos(angle) * radius,
      GROUND_Y + 10.25,
      rotunda[1] + Math.sin(angle) * radius,
      (Math.PI * profile.rotundaDiameterM) / awningPanels + 0.08,
      2.2,
      0.26,
      -angle,
      false,
    );
  }
  addCylinder(
    builder,
    0xc93632,
    rotunda[0],
    GROUND_Y + 12.7,
    rotunda[1],
    profile.rotundaDiameterM / 2 + 0.45,
    0.55,
    detailProfile === "mobile" ? 16 : 24,
  );
}

function addStationHall(
  builder: Builder,
  options: {
    center: readonly [number, number];
    detailProfile: CityWestDetailProfile;
    hallHeightM: number;
    lengthM: number;
    rotationY: number;
    widthM: number;
  },
): void {
  const profile = CITY_WEST_PROFILE.bahnhofZoo;
  const {
    center,
    detailProfile,
    hallHeightM,
    lengthM,
    rotationY,
    widthM,
  } = options;
  addBox(
    builder,
    TRAVERTINE,
    center[0],
    GROUND_Y + profile.viaductHeightM / 2,
    center[1],
    lengthM,
    profile.viaductHeightM,
    widthM - 3,
    rotationY,
  );
  addBox(
    builder,
    GLASS_BLUE,
    center[0],
    GROUND_Y + profile.viaductHeightM + hallHeightM / 2,
    center[1],
    lengthM,
    hallHeightM,
    widthM,
    rotationY,
  );
  addLongFacadeFrames(builder, {
    center,
    color: ALUMINIUM,
    depthM: widthM,
    groundY: GROUND_Y + profile.viaductHeightM,
    heightM: hallHeightM,
    horizontalCount: detailProfile === "mobile" ? 2 : 4,
    lengthM,
    rotationY,
    verticalCount: detailProfile === "mobile" ? 8 : 16,
  });
  const viaductBays = detailProfile === "mobile" ? 7 : 13;
  for (const side of [-1, 1]) {
    for (let bay = 0; bay < viaductBays; bay += 1) {
      const [x, z] = localPoint(
        center,
        rotationY,
        -lengthM / 2 + ((bay + 0.5) * lengthM) / viaductBays,
        side * ((widthM - 3) / 2 + 0.13),
      );
      addBox(
        builder,
        STONE_SHADOW,
        x,
        GROUND_Y + profile.viaductHeightM * 0.48,
        z,
        (lengthM / viaductBays) * 0.62,
        profile.viaductHeightM * 0.58,
        0.28,
        rotationY,
        false,
      );
    }
  }
}

function addBahnhofZoo(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.bahnhofZoo;
  addStationHall(builder, {
    center: profile.longDistanceHall.centerWorldM,
    detailProfile,
    hallHeightM: profile.longDistanceHall.heightAboveViaductM,
    lengthM: profile.longDistanceHall.lengthM,
    rotationY: profile.longDistanceHall.rotationY,
    widthM: profile.longDistanceHall.widthM,
  });
  addStationHall(builder, {
    center: profile.sBahnHall.centerWorldM,
    detailProfile,
    hallHeightM: profile.sBahnHall.heightAboveViaductM,
    lengthM: profile.sBahnHall.lengthM,
    rotationY: profile.sBahnHall.rotationY,
    widthM: profile.sBahnHall.widthM,
  });

  const terrace = profile.terraceCenterWorldM;
  addBox(
    builder,
    GLASS_BLUE,
    terrace[0],
    GROUND_Y + 11.5,
    terrace[1],
    68,
    6,
    16,
    profile.terraceRotationY,
  );
  const columnCount = detailProfile === "mobile" ? 5 : 9;
  for (let index = 0; index < columnCount; index += 1) {
    const [x, z] = localPoint(
      terrace,
      profile.terraceRotationY,
      -30 + (index * 60) / (columnCount - 1),
      0,
    );
    addCylinder(builder, ALUMINIUM, x, GROUND_Y + 4.3, z, 0.32, 8.6, 6);
  }
  addBox(
    builder,
    0xd8d7cf,
    terrace[0],
    GROUND_Y + 15,
    terrace[1],
    72,
    0.45,
    18,
    profile.terraceRotationY,
  );
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

function addOldChurchTower(
  builder: Builder,
  detailProfile: CityWestDetailProfile,
): void {
  const profile = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
  const center = profile.centerWorldM;
  const [widthM, depthM] = profile.footprintM;
  const portal = profile.portal;
  const portalSideMassM = (widthM - portal.clearWidthM) / 2;
  const portalSideCenterM = portal.clearWidthM / 2 + portalSideMassM / 2;
  const facadeZ = depthM / 2 + 0.2;

  // The lower ruin is assembled around the opening, leaving a continuous
  // empty volume through the tower instead of painting an arch on a solid box.
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      RUIN_STONE,
      center,
      profile.rotationY,
      side * portalSideCenterM,
      GROUND_Y + 10,
      0,
      portalSideMassM,
      20,
      depthM,
    );
  }
  addLocalBox(
    builder,
    RUIN_STONE,
    center,
    profile.rotationY,
    0,
    GROUND_Y + 18.1,
    0,
    widthM,
    3.8,
    depthM,
  );
  for (const face of [-1, 1]) {
    addLocalFacadeArch(
      builder,
      RUIN_LIGHT,
      center,
      profile.rotationY,
      0,
      GROUND_Y + portal.springHeightM,
      face * facadeZ,
      portal.archRadiusM,
      0.68,
      detailProfile === "mobile" ? 10 : 16,
    );
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        RUIN_LIGHT,
        center,
        profile.rotationY,
        side * (portal.clearWidthM / 2 + 0.32),
        GROUND_Y + portal.springHeightM / 2,
        face * (facadeZ + 0.02),
        0.64,
        portal.springHeightM,
        0.34,
        0,
        false,
      );
    }
  }

  // Layered cornices, the clock shaft and corner buttresses restore the
  // heavy Romanesque mass visible below the shattered belfry.
  for (const [heightM, sizeX, sizeZ] of [
    [20.4, 32.6, 19.5],
    [23.1, 23.2, 17.7],
    [42.9, 24.4, 18.2],
    [58.2, 24.8, 18.4],
  ] as const) {
    addLocalBox(
      builder,
      heightM === 58.2 ? RUIN_ACCENT : RUIN_LIGHT,
      center,
      profile.rotationY,
      0,
      GROUND_Y + heightM,
      0,
      sizeX,
      0.9,
      sizeZ,
    );
  }
  addLocalBox(
    builder,
    RUIN_STONE,
    center,
    profile.rotationY,
    0,
    GROUND_Y + 31.5,
    0,
    21,
    22,
    16.4,
  );
  for (const [localX, localZ] of [
    [-11.2, -7.3],
    [11.2, -7.3],
    [-11.2, 7.3],
    [11.2, 7.3],
  ] as const) {
    addLocalBox(
      builder,
      RUIN_ACCENT,
      center,
      profile.rotationY,
      localX,
      GROUND_Y + 32.2,
      localZ,
      2.3,
      23.5,
      2.4,
    );
  }

  const clock = profile.clock;
  const clockRadiusM = clock.diameterM / 2;
  const clockFaceZ = depthM / 2 - 0.52;
  for (const face of [-1, 1]) {
    addLocalFacadeDisc(
      builder,
      STONE_SHADOW,
      center,
      profile.rotationY,
      0,
      GROUND_Y + clock.centerHeightM,
      face * (clockFaceZ + 0.22),
      clockRadiusM - 0.28,
      0.34,
      detailProfile === "mobile" ? 16 : 24,
      false,
    );
    addLocalFacadeArch(
      builder,
      CLOCK_GOLD,
      center,
      profile.rotationY,
      0,
      GROUND_Y + clock.centerHeightM,
      face * (clockFaceZ + 0.5),
      clockRadiusM - 0.32,
      0.32,
      detailProfile === "mobile" ? 16 : 24,
      false,
    );
    const lowerClockRing = new TorusGeometry(
      clockRadiusM - 0.32,
      0.32,
      4,
      detailProfile === "mobile" ? 16 : 24,
      Math.PI,
    );
    lowerClockRing.rotateZ(Math.PI);
    lowerClockRing.rotateY(profile.rotationY);
    const [ringX, ringZ] = localPoint(
      center,
      profile.rotationY,
      0,
      face * (clockFaceZ + 0.5),
    );
    lowerClockRing.translate(
      ringX,
      GROUND_Y + clock.centerHeightM,
      ringZ,
    );
    pushGeometry(builder, lowerClockRing, CLOCK_GOLD, false);

    const markerRadiusM = clockRadiusM - 0.85;
    for (let marker = 0; marker < clock.hourMarkers; marker += 1) {
      const angle = (marker * Math.PI * 2) / clock.hourMarkers;
      const markerLengthM = marker % 3 === 0 ? 0.76 : 0.52;
      addLocalBox(
        builder,
        CLOCK_GOLD,
        center,
        profile.rotationY,
        Math.sin(angle) * markerRadiusM,
        GROUND_Y +
          clock.centerHeightM +
          Math.cos(angle) * markerRadiusM,
        face * (clockFaceZ + 0.66),
        0.2,
        markerLengthM,
        0.18,
        -angle,
        false,
      );
    }
    for (const [angle, lengthM, widthM] of [
      [-0.92, 2.15, 0.26],
      [0.3, 2.72, 0.18],
    ] as const) {
      addLocalBox(
        builder,
        CLOCK_GOLD,
        center,
        profile.rotationY,
        (Math.sin(angle) * lengthM) / 2,
        GROUND_Y +
          clock.centerHeightM +
          (Math.cos(angle) * lengthM) / 2,
        face * (clockFaceZ + 0.69),
        widthM,
        lengthM,
        0.2,
        -angle,
        false,
      );
    }
    addLocalFacadeDisc(
      builder,
      CLOCK_GOLD,
      center,
      profile.rotationY,
      0,
      GROUND_Y + clock.centerHeightM,
      face * (clockFaceZ + 0.72),
      0.34,
      0.2,
      10,
      false,
    );
  }

  addLocalBox(
    builder,
    RUIN_STONE,
    center,
    profile.rotationY,
    0,
    GROUND_Y + 50.7,
    0,
    22.8,
    15.2,
    16.6,
  );
  for (const face of [-1, 1]) {
    for (const localX of [-5.4, 0, 5.4]) {
      addLocalBox(
        builder,
        STONE_SHADOW,
        center,
        profile.rotationY,
        localX,
        GROUND_Y + 49.7,
        face * 8.42,
        2.75,
        6.2,
        0.28,
        0,
        false,
      );
      addLocalFacadeDisc(
        builder,
        STONE_SHADOW,
        center,
        profile.rotationY,
        localX,
        GROUND_Y + 52.75,
        face * 8.43,
        1.38,
        0.3,
        12,
        false,
      );
      addLocalFacadeArch(
        builder,
        RUIN_LIGHT,
        center,
        profile.rotationY,
        localX,
        GROUND_Y + 52.75,
        face * 8.63,
        1.58,
        0.24,
        10,
        false,
      );
    }
  }

  for (const [localX, localZ] of [
    [-11.4, -7.5],
    [11.4, -7.5],
    [-11.4, 7.5],
    [11.4, 7.5],
  ] as const) {
    const [x, z] = localPoint(center, profile.rotationY, localX, localZ);
    addCylinder(
      builder,
      RUIN_STONE,
      x,
      GROUND_Y + 50.5,
      z,
      1.45,
      11,
      detailProfile === "mobile" ? 6 : 8,
    );
    addCone(
      builder,
      PATINA_GREEN,
      x,
      GROUND_Y + 57.1,
      z,
      1.75,
      2.3,
      detailProfile === "mobile" ? 6 : 8,
      false,
    );
  }

  const crownShards = [
    [-5.3, -2.6, 4.6, 12.48, 4.7, -0.015],
    [-0.2, -3.5, 4.5, 9.8, 4.1, 0.08],
    [5.1, -1.7, 4.2, 7.8, 4.3, -0.11],
    [-3.2, 3.1, 4.1, 8.2, 3.8, 0.09],
    [3.6, 3.2, 4.4, 5.2, 3.7, -0.08],
  ] as const;
  const shardCount = detailProfile === "mobile" ? 4 : crownShards.length;
  for (const [
    shardIndex,
    [localX, localZ, sizeX, heightM, sizeZ, rotationZ],
  ] of crownShards.slice(0, shardCount).entries()) {
    const stoneHeightM = heightM * 0.56;
    const patinaHeightM = heightM - stoneHeightM;
    addLocalBox(
      builder,
      RUIN_STONE,
      center,
      profile.rotationY,
      localX,
      GROUND_Y + 58.55 + stoneHeightM / 2,
      localZ,
      sizeX,
      stoneHeightM,
      sizeZ,
      rotationZ,
    );
    const topSlopeM =
      (shardIndex % 2 === 0 ? 1 : -1) * (0.42 + shardIndex * 0.08);
    addLocalBrokenBox(
      builder,
      PATINA_GREEN,
      center,
      profile.rotationY,
      localX,
      GROUND_Y +
        58.55 +
        stoneHeightM +
        patinaHeightM / 2 -
        Math.abs(topSlopeM),
      localZ,
      sizeX * 0.88,
      patinaHeightM,
      sizeZ * 0.9,
      topSlopeM,
      rotationZ,
    );
  }
}

function addGedaechtniskirche(
  builder: Builder,
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
  addOldChurchTower(builder, detailProfile);

  const church = profile.church;
  const churchGround = GROUND_Y + profile.podiumHeightM;
  addCylinder(
    builder,
    KWG_BLUE,
    church.centerWorldM[0],
    churchGround + church.heightM / 2,
    church.centerWorldM[1],
    church.diameterM / 2,
    church.heightM,
    8,
  );
  const churchBands = detailProfile === "mobile" ? 4 : 7;
  for (let level = 1; level < churchBands; level += 1) {
    addCylinder(
      builder,
      CONCRETE,
      church.centerWorldM[0],
      churchGround + (level * church.heightM) / churchBands,
      church.centerWorldM[1],
      church.diameterM / 2 + 0.18,
      0.28,
      8,
    );
  }
  const churchRibs = detailProfile === "mobile" ? 4 : 8;
  for (let index = 0; index < churchRibs; index += 1) {
    const angle = (index * Math.PI * 2) / churchRibs + Math.PI / 8;
    addCylinder(
      builder,
      CONCRETE,
      church.centerWorldM[0] + Math.cos(angle) * (church.diameterM / 2),
      churchGround + church.heightM / 2,
      church.centerWorldM[1] + Math.sin(angle) * (church.diameterM / 2),
      0.32,
      church.heightM,
      6,
    );
  }

  const bell = profile.bellTower;
  const bellRadiusM = bell.diameterM / 2;
  addCylinder(
    builder,
    KWG_BLUE,
    bell.centerWorldM[0],
    churchGround + bell.heightM / 2,
    bell.centerWorldM[1],
    bellRadiusM,
    bell.heightM,
    bell.facadeSides,
  );
  const bellBands = detailProfile === "mobile" ? 18 : 38;
  for (let level = 1; level < bellBands; level += 1) {
    addCylinder(
      builder,
      KWG_GRID,
      bell.centerWorldM[0],
      churchGround + (level * bell.heightM) / bellBands,
      bell.centerWorldM[1],
      bellRadiusM + 0.12,
      0.22,
      bell.facadeSides,
    );
  }
  const bellApothemM = bellRadiusM * Math.cos(Math.PI / bell.facadeSides);
  const bellColumnsPerFace = detailProfile === "mobile" ? 4 : 7;
  for (let face = 0; face < bell.facadeSides; face += 1) {
    const normalAngle =
      Math.PI / bell.facadeSides +
      (face * Math.PI * 2) / bell.facadeSides;
    const normalX = Math.cos(normalAngle);
    const normalZ = Math.sin(normalAngle);
    const tangentX = -normalZ;
    const tangentZ = normalX;
    for (let column = 0; column < bellColumnsPerFace; column += 1) {
      const acrossM =
        -bellRadiusM * 0.44 +
        (column * bellRadiusM * 0.88) /
          Math.max(1, bellColumnsPerFace - 1);
      addRotatedBox(
        builder,
        KWG_GRID,
        bell.centerWorldM[0] +
          normalX * (bellApothemM + 0.11) +
          tangentX * acrossM,
        churchGround + bell.heightM / 2,
        bell.centerWorldM[1] +
          normalZ * (bellApothemM + 0.11) +
          tangentZ * acrossM,
        0.2,
        bell.heightM - 1.1,
        0.24,
        0,
        -normalAngle - Math.PI / 2,
        0,
        false,
      );
    }
  }
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
    churchGround + bell.heightM - 0.24,
    bell.centerWorldM[1],
    bellRadiusM + 0.16,
    0.48,
    bell.facadeSides,
  );
  if (detailProfile === "full") {
    const glassFlecks = [
      [0, 11, 0x90454d],
      [1, 18, 0x56795c],
      [2, 25, 0xc0a64e],
      [3, 39, 0x8f3f4c],
      [4, 45, 0x4f745c],
      [5, 49, 0xbca44c],
    ] as const;
    for (const [face, heightM, color] of glassFlecks) {
      const normalAngle =
        Math.PI / bell.facadeSides +
        (face * Math.PI * 2) / bell.facadeSides;
      addRotatedBox(
        builder,
        color,
        bell.centerWorldM[0] +
          Math.cos(normalAngle) * (bellApothemM + 0.24),
        churchGround + heightM,
        bell.centerWorldM[1] +
          Math.sin(normalAngle) * (bellApothemM + 0.24),
        0.65,
        0.9,
        0.18,
        0,
        -normalAngle - Math.PI / 2,
        0,
        false,
      );
    }
  }
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
  const group = new Group();
  group.name = "City West and Urania recognition details";
  group.userData.detailProfile = detailProfile;
  group.userData.geometryStatus = CITY_WEST_PROFILE.geometryStatus;
  group.userData.profile = CITY_WEST_PROFILE;
  group.userData.sourceUrls = CITY_WEST_SOURCE_URLS;
  group.userData.batchPolicy =
    "all facade grids, signs, and ornaments are merged into four local drawn batches";

  const towers = createBuilder();
  addEuropaCenter(towers, detailProfile);
  addAllianzHaus(towers, detailProfile);
  addKranzlerEck(towers, detailProfile);
  const towerBatch = finishBatch(
    towers,
    "City West towers and Kranzler Eck",
    {
      allianzHaus: CITY_WEST_PROFILE.allianzHaus,
      europaCenter: CITY_WEST_PROFILE.europaCenter,
      kranzlerEck: CITY_WEST_PROFILE.kranzlerEck,
    },
  );
  if (towerBatch) group.add(towerBatch);

  const station = createBuilder();
  addBahnhofZoo(station, detailProfile);
  const stationBatch = finishBatch(station, "Bahnhof Zoo steel-glass halls", {
    bahnhofZoo: CITY_WEST_PROFILE.bahnhofZoo,
  });
  if (stationBatch) group.add(stationBatch);

  const breitscheid = createBuilder();
  addGedaechtniskirche(breitscheid, detailProfile);
  addBreitscheidplatz(breitscheid, detailProfile);
  const breitscheidBatch = finishBatch(
    breitscheid,
    "Gedächtniskirche and Breitscheidplatz ensemble",
    {
      breitscheidplatz: CITY_WEST_PROFILE.breitscheidplatz,
      gedaechtniskirche: CITY_WEST_PROFILE.gedaechtniskirche,
    },
  );
  if (breitscheidBatch) group.add(breitscheidBatch);

  const urania = createBuilder();
  addUrania(urania, detailProfile);
  const uraniaBatch = finishBatch(urania, "Urania mirrored entrance ensemble", {
    urania: CITY_WEST_PROFILE.urania,
  });
  if (uraniaBatch) group.add(uraniaBatch);

  return group;
}
