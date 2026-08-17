import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
import {
  type Builder,
  addBox,
  addPartialCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

type WorldPoint2 = readonly [number, number];
type WorldPoint3 = readonly [number, number, number];

export type LeipzigerFacadeRun = {
  endWorldM: WorldPoint2;
  groundYM: number;
  measuredHeightM: number;
  sourcePartId: string;
  startWorldM: WorldPoint2;
  storeys: number;
};

export type LeipzigerPortalVolume = {
  centerWorldM: WorldPoint3;
  collisionIds: ReadonlyArray<string>;
  geometryStatus: string;
  id: string;
  lod2PartIds: ReadonlyArray<string>;
  rotationY: number;
  sizeM: WorldPoint3;
};

const degrees = (value: number): number => (value * Math.PI) / 180;

const MALL_WEST_PART_IDS = [
  "DEBE3DiRt8dZEY64",
  "DEBE3DmmDDBd5asX",
  "DEBE3DauuthCFgAU",
  "DEBE3Dpzh1IwtXlI",
] as const;

const MALL_CENTRAL_PART_IDS = [
  "DEBE3DqnGwk8Y76s",
  "DEBE3DAuPHF6qQ7w",
] as const;

const MALL_EAST_PART_IDS = [
  "DEBE3DluFaewYSj7",
  "DEBE3DBpXDgoxJp9",
  "DEBE3DUHeL7plflj",
  "DEBE3DB7XY13FzVJ",
  "DEBE3DLPskQbBMxa",
  "DEBE3DJSpCd3Llzl",
  "DEBE3DL5qDQFlD2w",
  "DEBE3DQrKV4i42I4",
  "DEBE3DRaSf0Z9Z2R",
  "DEBE3Dk3lVBYQCxe",
  "DEBE3DlbiErwJmXa",
  "DEBE3DLeV9s5mI2Z",
  "DEBE3DRnObYKtWdQ",
  "DEBE3DVxT64dWa0R",
  "DEBE3DY85M7I55tu",
  "DEBE3DFUU3Q3xcgc",
  "DEBE3DVRNDN4HUEd",
  "DEBE3DobN6eAmgIW",
  "DEBE3DDufD8MVpgk",
  "DEBE3DkXsfcNIJd0",
] as const;

const CANADA_PART_IDS = [
  "DEBE3DMGmXsabWVw",
  "DEBE3Dw6nWcElaeb",
  "DEBE3DBN20jv6Sdu",
  "DEBE3DfDGqv9DABk",
  "DEBE3DYO57c7Jtdb",
  "DEBE3DLjGyKuiciJ",
  "DEBE3DQs7B1WSScs",
  "DEBE3DXLyhYfJwcC",
  "DEBE3DmwG1anVHbc",
  "DEBE3DJStKcSkGIz",
  "DEBE3DAtvmyymDX7",
  "DEBE3DSq6fN35UR5",
  "DEBE3DgLcR232Wzt",
] as const;

const TAYLOR_PART_IDS = [
  "DEBE3DX8xkSlkClV",
  "DEBE3DuYkLiMPpr6",
  "DEBE3Dt267g39Jz7",
  "DEBE3DR5yMfh61sW",
  "DEBE3DhJXRqgpiKw",
] as const;

const MAGENTA_PART_IDS = [
  "DEBE3DGCIXQGNVGI",
  "DEBE3DacDHOPRr9T",
] as const;

/**
 * Metric source registry for the four Leipziger-Platz recognition models.
 *
 * LoD2 remains the shell. The runs below are measured exterior edges of the
 * named parent footprints, and every rendered panel is a shallow surface
 * attached to one of those edges. Heights are the corresponding LoD2 part
 * heights; façade subdivisions are source-bounded recognition detail.
 */
export const LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE = {
  coordinateFrame:
    "EPSG:25833; world_x=easting-389500; world_z=5820000-northing",
  geometryStatus:
    "LoD2-parent-bound thin surface overlays; façade subdivisions are source-bounded recognition detail, never replacement massing",
  maxOverlayDepthM: 0.32,
  renderingStrategy: "component-bound-surface-overlays",
  mall: {
    blocks: [
      {
        centerWorldM: [563.374, 957.736] as const,
        footprintAreaM2: 13_738.6,
        footprintSizeM: [138.0, 117.58] as const,
        heightRangeM: [18.03, 35.66] as const,
        key: "west",
        lod2ParentId: "DEBE00YY1mc0002W",
        partIds: MALL_WEST_PART_IDS,
      },
      {
        centerWorldM: [662.773, 955.172] as const,
        footprintAreaM2: 4_462.4,
        footprintSizeM: [45.56, 119.26] as const,
        heightRangeM: [26.27, 28.6] as const,
        key: "central",
        lod2ParentId: "DEBE00YY1mc0003Y",
        partIds: MALL_CENTRAL_PART_IDS,
      },
      {
        centerWorldM: [753.046, 919.355] as const,
        footprintAreaM2: 9_458.3,
        footprintSizeM: [131.04, 123.53] as const,
        heightRangeM: [8.6, 29.23] as const,
        key: "east",
        lod2ParentId: "DEBE01YYK00000lH",
        partIds: MALL_EAST_PART_IDS,
      },
    ],
    coveredPassage: {
      axis: [0.07865, 0.9969] as const,
      centerWorldM: [633.506, 953.597] as const,
      eaveYM: 16.7,
      geometryStatus:
        "OSM roof footprint and round glass roof tag; arch rise and frame subdivision are source-bounded presentation detail",
      lengthM: 75.18,
      osmRoofWayId: "380104431",
      rotationY: degrees(4.51),
      spanM: 24.06,
    },
    facadeRuns: [
      {
        endWorldM: [483.775, 910.993],
        groundYM: 5.2,
        measuredHeightM: 27.55,
        sourcePartId: "DEBE3DauuthCFgAU",
        startWorldM: [487.498, 956.571],
        storeys: 5,
      },
      {
        endWorldM: [557.713, 905.175],
        groundYM: 5.1,
        measuredHeightM: 18.03,
        sourcePartId: "DEBE3Dpzh1IwtXlI",
        startWorldM: [483.775, 910.993],
        storeys: 5,
      },
      {
        endWorldM: [617.037, 898.329],
        groundYM: 5.1,
        measuredHeightM: 18.03,
        sourcePartId: "DEBE3Dpzh1IwtXlI",
        startWorldM: [575.274, 903.092],
        storeys: 5,
      },
      {
        endWorldM: [623.8, 983.541],
        groundYM: 5.1,
        measuredHeightM: 18.03,
        sourcePartId: "DEBE3Dpzh1IwtXlI",
        startWorldM: [619.931, 936.229],
        storeys: 5,
      },
      {
        endWorldM: [533.021, 1022.832],
        groundYM: 5.1,
        measuredHeightM: 18.03,
        sourcePartId: "DEBE3Dpzh1IwtXlI",
        startWorldM: [630.459, 1015.215],
        storeys: 5,
      },
      {
        endWorldM: [487.498, 956.571],
        groundYM: 5.1,
        measuredHeightM: 18.03,
        sourcePartId: "DEBE3Dpzh1IwtXlI",
        startWorldM: [530.479, 992.085],
        storeys: 5,
      },
      {
        endWorldM: [691.809, 1010.363],
        groundYM: 4.7,
        measuredHeightM: 28.6,
        sourcePartId: "DEBE3DqnGwk8Y76s",
        startWorldM: [689.223, 982.786],
        storeys: 5,
      },
      {
        endWorldM: [646.393, 1013.955],
        groundYM: 5.2,
        measuredHeightM: 26.27,
        sourcePartId: "DEBE3DAuPHF6qQ7w",
        startWorldM: [691.809, 1010.363],
        storeys: 5,
      },
      {
        endWorldM: [643.4, 923.942],
        groundYM: 5.2,
        measuredHeightM: 26.27,
        sourcePartId: "DEBE3DAuPHF6qQ7w",
        startWorldM: [647.999, 981.61],
        storeys: 5,
      },
      {
        endWorldM: [675.561, 892.023],
        groundYM: 5.2,
        measuredHeightM: 26.27,
        sourcePartId: "DEBE3DAuPHF6qQ7w",
        startWorldM: [641.195, 895.726],
        storeys: 5,
      },
      {
        endWorldM: [681.206, 983.204],
        groundYM: 5.2,
        measuredHeightM: 26.27,
        sourcePartId: "DEBE3DAuPHF6qQ7w",
        startWorldM: [675.561, 892.023],
        storeys: 5,
      },
      {
        endWorldM: [783.278, 860.64],
        groundYM: 5.2,
        measuredHeightM: 22.26,
        sourcePartId: "DEBE3DVxT64dWa0R",
        startWorldM: [691.126, 887.49],
        storeys: 5,
      },
      {
        endWorldM: [821.352, 978.14],
        groundYM: 5.2,
        measuredHeightM: 22.26,
        sourcePartId: "DEBE3DVxT64dWa0R",
        startWorldM: [786.921, 862.592],
        storeys: 5,
      },
      {
        endWorldM: [810.4, 981.401],
        groundYM: 4.7,
        measuredHeightM: 28.28,
        sourcePartId: "DEBE3DUHeL7plflj",
        startWorldM: [821.352, 978.14],
        storeys: 5,
      },
      {
        endWorldM: [798.643, 983.428],
        groundYM: 5.2,
        measuredHeightM: 25.3,
        sourcePartId: "DEBE3DLeV9s5mI2Z",
        startWorldM: [809.996, 980.044],
        storeys: 5,
      },
      {
        endWorldM: [778.385, 961.515],
        groundYM: 5.2,
        measuredHeightM: 19.04,
        sourcePartId: "DEBE3DY85M7I55tu",
        startWorldM: [793.13, 960.475],
        storeys: 5,
      },
      {
        endWorldM: [737.339, 948.676],
        groundYM: 5.2,
        measuredHeightM: 19.04,
        sourcePartId: "DEBE3DY85M7I55tu",
        startWorldM: [758.245, 945.602],
        storeys: 5,
      },
      {
        endWorldM: [678.354, 937.063],
        groundYM: 5.2,
        measuredHeightM: 19.04,
        sourcePartId: "DEBE3DY85M7I55tu",
        startWorldM: [679.826, 960.835],
        storeys: 5,
      },
      {
        endWorldM: [703.193, 935.466],
        groundYM: 5.2,
        measuredHeightM: 19.04,
        sourcePartId: "DEBE3DY85M7I55tu",
        startWorldM: [678.354, 937.063],
        storeys: 5,
      },
    ] as const satisfies ReadonlyArray<LeipzigerFacadeRun>,
    lod2ParentIds: [
      "DEBE00YY1mc0002W",
      "DEBE00YY1mc0003Y",
      "DEBE01YYK00000lH",
    ] as const,
    osmBuildingWayIds: ["194066303", "380104430"] as const,
    osmShoppingOutlineWayId: "494737961",
    sources: [
      "https://www.openstreetmap.org/way/194066303",
      "https://www.openstreetmap.org/way/380104430",
      "https://www.openstreetmap.org/way/380104431",
      "https://tchobanvoss.de/de/projects/mall-of-berlin",
    ] as const,
  },
  canada: {
    centerWorldM: [380.648, 945.665] as const,
    facadeRuns: [
      {
        endWorldM: [365.74, 967.645],
        groundYM: 5.0,
        measuredHeightM: 28.81,
        sourcePartId: "DEBE3DfDGqv9DABk",
        startWorldM: [367.071, 958.969],
        storeys: 10,
      },
      {
        endWorldM: [354.537, 958.141],
        groundYM: 5.0,
        measuredHeightM: 28.81,
        sourcePartId: "DEBE3DfDGqv9DABk",
        startWorldM: [365.74, 967.645],
        storeys: 10,
      },
      {
        endWorldM: [357.474, 932.798],
        groundYM: 5.0,
        measuredHeightM: 28.1,
        sourcePartId: "DEBE3DXLyhYfJwcC",
        startWorldM: [353.874, 955.829],
        storeys: 10,
      },
      {
        endWorldM: [359.291, 921.174],
        groundYM: 5.0,
        measuredHeightM: 28.13,
        sourcePartId: "DEBE3DQs7B1WSScs",
        startWorldM: [357.787, 930.795],
        storeys: 10,
      },
      {
        endWorldM: [401.003, 917.758],
        groundYM: 5.1,
        measuredHeightM: 28.26,
        sourcePartId: "DEBE3DLjGyKuiciJ",
        startWorldM: [359.291, 921.174],
        storeys: 10,
      },
      {
        endWorldM: [404.669, 962.634],
        groundYM: 5.1,
        measuredHeightM: 29.32,
        sourcePartId: "DEBE3Dw6nWcElaeb",
        startWorldM: [401.003, 917.758],
        storeys: 10,
      },
      {
        endWorldM: [385.909, 984.756],
        groundYM: 5.2,
        measuredHeightM: 28.68,
        sourcePartId: "DEBE3DYO57c7Jtdb",
        startWorldM: [404.669, 962.634],
        storeys: 10,
      },
    ] as const satisfies ReadonlyArray<LeipzigerFacadeRun>,
    footprintAreaM2: 2_186.5,
    footprintSizeM: [50.07, 65.55] as const,
    heightRangeM: [4.11, 29.81] as const,
    lod2ParentId: "DEBE01YYK000022A",
    osmBuildingWayId: "24045417",
    osmPoiNodeId: "539514923",
    partIds: CANADA_PART_IDS,
    sources: [
      "https://www.openstreetmap.org/node/539514923",
      "https://www.kpmb.com/project/canadian-embassy-berlin/",
      "https://www.international.gc.ca/country-pays/germany-allemagne/berlin.aspx?lang=eng",
    ] as const,
  },
  taylorWessing: {
    centerWorldM: [376.463, 885.086] as const,
    facadeRuns: [
      {
        endWorldM: [363.58, 894.378],
        groundYM: 5.1,
        measuredHeightM: 22.55,
        sourcePartId: "DEBE3DX8xkSlkClV",
        startWorldM: [388.708, 892.296],
        storeys: 4,
      },
      {
        endWorldM: [366.267, 877.201],
        groundYM: 5.0,
        measuredHeightM: 21.56,
        sourcePartId: "DEBE3DhJXRqgpiKw",
        startWorldM: [363.58, 894.378],
        storeys: 4,
      },
      {
        endWorldM: [387.328, 875.472],
        groundYM: 4.9,
        measuredHeightM: 21.69,
        sourcePartId: "DEBE3DR5yMfh61sW",
        startWorldM: [366.267, 877.201],
        storeys: 4,
      },
      {
        endWorldM: [388.708, 892.296],
        groundYM: 5.1,
        measuredHeightM: 21.95,
        sourcePartId: "DEBE3Dt267g39Jz7",
        startWorldM: [387.328, 875.472],
        storeys: 4,
      },
    ] as const satisfies ReadonlyArray<LeipzigerFacadeRun>,
    footprintAreaM2: 391.5,
    footprintSizeM: [25.23, 16.9] as const,
    heightRangeM: [21.56, 22.55] as const,
    lod2ParentId: "DEBE01YYK00009eV",
    osmBuildingWayId: "43375260",
    osmPoiNodeId: "7424868639",
    partIds: TAYLOR_PART_IDS,
    storeys: 4,
    sources: [
      "https://www.openstreetmap.org/way/43375260",
      "https://www.taylorwessing.com/en/contact-us/berlin",
    ] as const,
  },
  magentaMitte: {
    brandMagentaHex: "#e20074",
    centerWorldM: [379.507, 854.014] as const,
    facadeRuns: [
      {
        endWorldM: [370.752, 848.528],
        groundYM: 4.6,
        measuredHeightM: 21.47,
        sourcePartId: "DEBE3DacDHOPRr9T",
        startWorldM: [368.51, 862.835],
        storeys: 6,
      },
      {
        endWorldM: [387.072, 843.219],
        groundYM: 4.6,
        measuredHeightM: 21.47,
        sourcePartId: "DEBE3DacDHOPRr9T",
        startWorldM: [371.477, 847.732],
        storeys: 6,
      },
      {
        endWorldM: [390.883, 856.984],
        groundYM: 4.6,
        measuredHeightM: 21.47,
        sourcePartId: "DEBE3DacDHOPRr9T",
        startWorldM: [388.134, 849.379],
        storeys: 6,
      },
      {
        endWorldM: [369.307, 863.97],
        groundYM: 4.6,
        measuredHeightM: 21.47,
        sourcePartId: "DEBE3DacDHOPRr9T",
        startWorldM: [388.503, 859.945],
        storeys: 6,
      },
    ] as const satisfies ReadonlyArray<LeipzigerFacadeRun>,
    footprintAreaM2: 320.7,
    footprintSizeM: [23.4, 16.65] as const,
    heightRangeM: [21.47, 21.61] as const,
    lod2ParentId: "DEBE01YYK0000B8N",
    osmBuildingWayId: "47423543",
    osmPoiNodeId: "12253907488",
    partIds: MAGENTA_PART_IDS,
    rotationY: degrees(12.08),
    storeys: 6,
    sources: [
      "https://www.openstreetmap.org/way/47423543",
      "https://www.telekom.com/de/medien/medieninformationen/detail/telekom-berlin-hat-jetzt-eine-magenta-mitte-1077000",
      "https://www.telekom.com/de/konzern/marke",
      "https://www.gnaedinger-architekten.de/211-otto-bock-scmt/",
    ] as const,
  },
} as const;

export const LEIPZIGER_PLATZ_PORTALS = [
  {
    centerWorldM: [633.506, 10.9, 953.597],
    collisionIds: ["h1IwtXlI", "PHF6qQ7w"],
    geometryStatus:
      "open visual axis under the OSM round glass roof; collision ids are ready for a future interior-access hook",
    id: "mall-covered-piazza-axis",
    lod2PartIds: ["DEBE3Dpzh1IwtXlI", "DEBE3DAuPHF6qQ7w"],
    rotationY: degrees(4.51),
    sizeM: [13.5, 11.6, 69],
  },
  {
    centerWorldM: [380.147, 8.35, 919.466],
    collisionIds: ["GyKuiciJ"],
    geometryStatus:
      "source-edge entrance contract; no global LoD2 opening is enabled by this visual module",
    id: "canadian-embassy-square-entrance",
    lod2PartIds: ["DEBE3DLjGyKuiciJ"],
    rotationY: degrees(-178.9),
    sizeM: [5.2, 6.5, 8],
  },
  {
    centerWorldM: [382.0, 7.85, 892.85],
    collisionIds: ["xkSlkClV"],
    geometryStatus:
      "source-edge entrance contract; no global LoD2 opening is enabled by this visual module",
    id: "taylor-wessing-ebertstrasse-entrance",
    lod2PartIds: ["DEBE3DX8xkSlkClV"],
    rotationY: degrees(-2.2),
    sizeM: [4.2, 5.5, 6],
  },
  {
    centerWorldM: [379.0, 7.3, 862.2],
    collisionIds: ["DHOPRr9T"],
    geometryStatus:
      "source-edge entrance contract; no global LoD2 opening is enabled by this visual module",
    id: "magenta-mitte-ebertstrasse-entrance",
    lod2PartIds: ["DEBE3DacDHOPRr9T"],
    rotationY: degrees(-4.3),
    sizeM: [4.5, 5.4, 6],
  },
] as const satisfies ReadonlyArray<LeipzigerPortalVolume>;

const MALL_STONE = 0xd7d0c2;
const MALL_GLASS = 0x809da0;
const MALL_FRAME = 0x59696b;
const CANADA_ZINC = 0xb7b9b3;
const CANADA_STONE = 0xd2c5ad;
const CANADA_GLASS = 0x6f8d91;
const CANADA_WOOD = 0x9a7956;
const TAYLOR_STONE = 0xd8d3c7;
const TAYLOR_GLASS = 0x6f9298;
const TAYLOR_FRAME = 0x586a6d;
const MAGENTA_WHITE = 0xeeede4;
const MAGENTA_GLASS = 0x77999f;
const MAGENTA_FRAME = 0x55686d;
const MAGENTA_ACCENT = 0xe20074;
const TERRACE_GREEN = 0x71906d;

type RunFrame = {
  axis: WorldPoint2;
  lengthM: number;
  midpoint: WorldPoint2;
  outward: WorldPoint2;
  rotationY: number;
};

function runFrame(run: LeipzigerFacadeRun, buildingCenter: WorldPoint2): RunFrame {
  const deltaX = run.endWorldM[0] - run.startWorldM[0];
  const deltaZ = run.endWorldM[1] - run.startWorldM[1];
  const lengthM = Math.hypot(deltaX, deltaZ);
  const axis: WorldPoint2 = [deltaX / lengthM, deltaZ / lengthM];
  const midpoint: WorldPoint2 = [
    (run.startWorldM[0] + run.endWorldM[0]) / 2,
    (run.startWorldM[1] + run.endWorldM[1]) / 2,
  ];
  const left: WorldPoint2 = [-axis[1], axis[0]];
  const fromCenter: WorldPoint2 = [
    midpoint[0] - buildingCenter[0],
    midpoint[1] - buildingCenter[1],
  ];
  const outward: WorldPoint2 =
    left[0] * fromCenter[0] + left[1] * fromCenter[1] >= 0
      ? left
      : [-left[0], -left[1]];
  return {
    axis,
    lengthM,
    midpoint,
    outward,
    rotationY: Math.atan2(outward[0], outward[1]),
  };
}

function addRunBox(
  builder: Builder,
  run: LeipzigerFacadeRun,
  buildingCenter: WorldPoint2,
  color: number,
  alongM: number,
  centerY: number,
  outwardM: number,
  widthM: number,
  heightM: number,
  depthM: number,
  inked = false,
): void {
  const frame = runFrame(run, buildingCenter);
  addBox(
    builder,
    color,
    frame.midpoint[0] + frame.axis[0] * alongM + frame.outward[0] * outwardM,
    centerY,
    frame.midpoint[1] + frame.axis[1] * alongM + frame.outward[1] * outwardM,
    widthM,
    heightM,
    depthM,
    frame.rotationY,
    inked,
  );
}

function addRunLampBox(
  builder: Builder,
  run: LeipzigerFacadeRun,
  buildingCenter: WorldPoint2,
  color: number,
  alongM: number,
  centerY: number,
  outwardM: number,
  widthM: number,
  heightM: number,
  depthM: number,
): void {
  const frame = runFrame(run, buildingCenter);
  const geometry = new BoxGeometry(widthM, heightM, depthM);
  geometry.rotateY(frame.rotationY);
  geometry.translate(
    frame.midpoint[0] + frame.axis[0] * alongM + frame.outward[0] * outwardM,
    centerY,
    frame.midpoint[1] + frame.axis[1] * alongM + frame.outward[1] * outwardM,
  );
  paintGeometry(geometry, color);
  builder.lamps.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );
}

type PunchedFacadeStyle = {
  bayPitchM: number;
  frameColor: number;
  glassColor: number;
  stoneColor: number;
  windowHeightM: number;
  windowWidthM: number;
};

function addPunchedFacade(
  builder: Builder,
  run: LeipzigerFacadeRun,
  buildingCenter: WorldPoint2,
  style: PunchedFacadeStyle,
): void {
  const frame = runFrame(run, buildingCenter);
  const bayCount = Math.max(1, Math.floor((frame.lengthM - 1.4) / style.bayPitchM));
  const pitch = (frame.lengthM - 1.2) / bayCount;
  const windowWidth = Math.min(style.windowWidthM, pitch - 0.7);
  const usableHeight = Math.max(5.2, run.measuredHeightM - 1.1);
  const floorHeight = Math.min(3.55, (usableHeight - 1.0) / run.storeys);
  const facadeHeight = floorHeight * run.storeys + 0.9;

  for (let floor = 0; floor < run.storeys; floor += 1) {
    const y = run.groundYM + 1.85 + floor * floorHeight;
    for (let bay = 0; bay < bayCount; bay += 1) {
      const along = -frame.lengthM / 2 + 0.6 + pitch * (bay + 0.5);
      addRunBox(
        builder,
        run,
        buildingCenter,
        style.glassColor,
        along,
        y,
        0.18,
        windowWidth,
        Math.min(style.windowHeightM, floorHeight - 0.6),
        0.12,
      );
    }
    addRunBox(
      builder,
      run,
      buildingCenter,
      style.stoneColor,
      0,
      run.groundYM + 0.55 + (floor + 1) * floorHeight,
      0.12,
      frame.lengthM,
      0.24,
      0.2,
    );
  }

  for (let bay = 0; bay <= bayCount; bay += 1) {
    const along = -frame.lengthM / 2 + 0.6 + pitch * bay;
    addRunBox(
      builder,
      run,
      buildingCenter,
      style.frameColor,
      along,
      run.groundYM + facadeHeight / 2,
      0.2,
      0.18,
      facadeHeight,
      0.16,
    );
  }
  addRunBox(
    builder,
    run,
    buildingCenter,
    style.stoneColor,
    0,
    run.groundYM + facadeHeight,
    0.14,
    frame.lengthM,
    0.42,
    0.24,
    true,
  );
}

function addOpenEntranceFrame(
  builder: Builder,
  run: LeipzigerFacadeRun,
  buildingCenter: WorldPoint2,
  alongM: number,
  widthM: number,
  heightM: number,
  color: number,
): void {
  for (const side of [-1, 1]) {
    addRunBox(
      builder,
      run,
      buildingCenter,
      color,
      alongM + side * widthM / 2,
      run.groundYM + heightM / 2,
      0.32,
      0.38,
      heightM,
      0.3,
      true,
    );
  }
  addRunBox(
    builder,
    run,
    buildingCenter,
    color,
    alongM,
    run.groundYM + heightM,
    0.32,
    widthM + 0.38,
    0.42,
    0.3,
    true,
  );
}

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
): void {
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addBarrelRoof(builder: Builder): void {
  const passage = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.mall.coveredPassage;
  const archSegments = 16;
  const lengthSegments = 10;
  const riseM = 6.15;
  const crossAxis: WorldPoint2 = [passage.axis[1], -passage.axis[0]];
  const positions: number[] = [];
  const indices: number[] = [];

  for (let alongIndex = 0; alongIndex <= lengthSegments; alongIndex += 1) {
    const along =
      -passage.lengthM / 2 +
      (passage.lengthM * alongIndex) / lengthSegments;
    for (let archIndex = 0; archIndex <= archSegments; archIndex += 1) {
      const angle = -Math.PI / 2 + (Math.PI * archIndex) / archSegments;
      const across = Math.sin(angle) * passage.spanM / 2;
      const y = passage.eaveYM + Math.cos(angle) * riseM;
      positions.push(
        passage.centerWorldM[0] +
          passage.axis[0] * along +
          crossAxis[0] * across,
        y,
        passage.centerWorldM[1] +
          passage.axis[1] * along +
          crossAxis[1] * across,
      );
    }
  }
  for (let alongIndex = 0; alongIndex < lengthSegments; alongIndex += 1) {
    for (let archIndex = 0; archIndex < archSegments; archIndex += 1) {
      const first = alongIndex * (archSegments + 1) + archIndex;
      const second = first + archSegments + 1;
      indices.push(first, second, first + 1, first + 1, second, second + 1);
    }
  }
  const roof = new BufferGeometry();
  roof.setAttribute("position", new Float32BufferAttribute(positions, 3));
  roof.setIndex(indices);
  roof.computeVertexNormals();
  addPaintedGeometry(builder, roof, 0x91b3b5);

  for (let rib = 0; rib <= 8; rib += 1) {
    const along = -passage.lengthM / 2 + (passage.lengthM * rib) / 8;
    const points: Vector3[] = [];
    for (let archIndex = 0; archIndex <= archSegments; archIndex += 1) {
      const angle = -Math.PI / 2 + (Math.PI * archIndex) / archSegments;
      const across = Math.sin(angle) * passage.spanM / 2;
      points.push(
        new Vector3(
          passage.centerWorldM[0] +
            passage.axis[0] * along +
            crossAxis[0] * across,
          passage.eaveYM + Math.cos(angle) * riseM + 0.05,
          passage.centerWorldM[1] +
            passage.axis[1] * along +
            crossAxis[1] * across,
        ),
      );
    }
    addPaintedGeometry(
      builder,
      new TubeGeometry(new CatmullRomCurve3(points), 24, 0.075, 4, false),
      MALL_FRAME,
      false,
    );
  }

  const columnHeight = passage.eaveYM - 5.1;
  for (let support = 0; support <= 6; support += 1) {
    const along = -passage.lengthM / 2 + (passage.lengthM * support) / 6;
    for (const side of [-1, 1]) {
      const across = side * (passage.spanM / 2 - 0.22);
      addBox(
        builder,
        MALL_FRAME,
        passage.centerWorldM[0] +
          passage.axis[0] * along +
          crossAxis[0] * across,
        5.1 + columnHeight / 2,
        passage.centerWorldM[1] +
          passage.axis[1] * along +
          crossAxis[1] * across,
        0.24,
        columnHeight,
        0.24,
        passage.rotationY,
        false,
      );
    }
  }
}

function buildMall(): Group {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.mall;
  const builder = createBuilder();
  for (const run of profile.facadeRuns) {
    const block = profile.blocks.find((candidate) =>
      (candidate.partIds as ReadonlyArray<string>).includes(run.sourcePartId),
    );
    const center = block?.centerWorldM ?? profile.blocks[1].centerWorldM;
    addPunchedFacade(builder, run, center, {
      bayPitchM: 4.0,
      frameColor: MALL_FRAME,
      glassColor: MALL_GLASS,
      stoneColor: MALL_STONE,
      windowHeightM: 2.05,
      windowWidthM: 2.85,
    });
  }
  addBarrelRoof(builder);
  const group = finishDrawnGroup(builder, {
    name: "Mall of Berlin LoD2-bound facade overlays",
  })!;
  group.userData.profile = profile;
  group.userData.collisionRole = "visual-overlay-with-open-covered-axis";
  return group;
}

function buildCanada(): Group {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.canada;
  const builder = createBuilder();
  for (const run of profile.facadeRuns) {
    addPunchedFacade(builder, run, profile.centerWorldM, {
      bayPitchM: 4.15,
      frameColor: CANADA_ZINC,
      glassColor: CANADA_GLASS,
      stoneColor: CANADA_STONE,
      windowHeightM: 1.65,
      windowWidthM: 2.35,
    });
  }
  const squareRun = profile.facadeRuns[4];
  addOpenEntranceFrame(
    builder,
    squareRun,
    profile.centerWorldM,
    1.2,
    5.2,
    5.7,
    CANADA_WOOD,
  );
  const group = finishDrawnGroup(builder, {
    name: "Canadian Embassy complete-parent facade overlays",
  })!;
  group.userData.profile = profile;
  group.userData.collisionRole = "visual-overlay-with-source-edge-portal";
  return group;
}

function createTaylorLettering(run: LeipzigerFacadeRun): Mesh {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.taylorWessing;
  const frame = runFrame(run, profile.centerWorldM);
  const texture = createLetteringTexture({
    bandHeightM: 1.35,
    bandWidthM: 12.6,
    capHeightM: 0.78,
    fieldColor: "#ded9ce",
    letterColor: "#29596b",
    text: "TAYLOR WESSING",
    texelsPerMetre: 180,
  });
  const material = texture
    ? new MeshStandardMaterial({
        map: texture,
        roughness: 0.68,
        side: DoubleSide,
      })
    : new MeshBasicMaterial({ color: TAYLOR_STONE, side: DoubleSide });
  const sign = new Mesh(new PlaneGeometry(12.6, 1.35), material);
  sign.name = "Taylor Wessing facade lettering";
  sign.userData.lettering = "TAYLOR WESSING";
  sign.userData.fallbackWithoutCanvas = texture === null;
  sign.position.set(
    frame.midpoint[0] + frame.outward[0] * 0.31,
    run.groundYM + 19.25,
    frame.midpoint[1] + frame.outward[1] * 0.31,
  );
  sign.rotation.y = frame.rotationY;
  return sign;
}

function buildTaylorWessing(): Group {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.taylorWessing;
  const builder = createBuilder();
  for (const run of profile.facadeRuns) {
    addPunchedFacade(builder, run, profile.centerWorldM, {
      bayPitchM: 3.35,
      frameColor: TAYLOR_FRAME,
      glassColor: TAYLOR_GLASS,
      stoneColor: TAYLOR_STONE,
      windowHeightM: 2.35,
      windowWidthM: 2.3,
    });
  }
  addOpenEntranceFrame(
    builder,
    profile.facadeRuns[0],
    profile.centerWorldM,
    -5.8,
    4.2,
    4.9,
    TAYLOR_FRAME,
  );
  const group = finishDrawnGroup(builder, {
    name: "Taylor Wessing exact-parent facade overlays",
  })!;
  group.add(createTaylorLettering(profile.facadeRuns[0]));
  group.userData.profile = profile;
  group.userData.collisionRole = "visual-overlay-with-source-edge-portal";
  return group;
}

function addContinuousGlassFacade(
  builder: Builder,
  run: LeipzigerFacadeRun,
  center: WorldPoint2,
): void {
  const frame = runFrame(run, center);
  const floorHeight = 3.48;
  for (let floor = 0; floor < 6; floor += 1) {
    addRunBox(
      builder,
      run,
      center,
      MAGENTA_GLASS,
      0,
      run.groundYM + 1.65 + floor * floorHeight,
      0.16,
      frame.lengthM - 0.35,
      2.35,
      0.12,
    );
    addRunBox(
      builder,
      run,
      center,
      MAGENTA_WHITE,
      0,
      run.groundYM + 3.18 + floor * floorHeight,
      0.22,
      frame.lengthM,
      0.5,
      0.24,
      true,
    );
    const mullionCount = Math.max(2, Math.floor(frame.lengthM / 2.7));
    for (let mullion = 1; mullion < mullionCount; mullion += 1) {
      const along = -frame.lengthM / 2 + (frame.lengthM * mullion) / mullionCount;
      addRunBox(
        builder,
        run,
        center,
        MAGENTA_FRAME,
        along,
        run.groundYM + 1.65 + floor * floorHeight,
        0.24,
        0.1,
        2.35,
        0.12,
      );
    }
  }
}

function addMagentaCurvedBands(builder: Builder): void {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.magentaMitte;
  const width = profile.footprintSizeM[0];
  const depth = profile.footprintSizeM[1];
  const radius = 2.55;
  const halfX = width / 2 - radius;
  const halfZ = depth / 2 - radius;
  const cosine = Math.cos(profile.rotationY);
  const sine = Math.sin(profile.rotationY);
  const corners = [
    { local: [halfX, halfZ] as const, theta: 0 },
    { local: [-halfX, halfZ] as const, theta: Math.PI / 2 },
    { local: [-halfX, -halfZ] as const, theta: Math.PI },
    { local: [halfX, -halfZ] as const, theta: (3 * Math.PI) / 2 },
  ];
  for (let floor = 0; floor < 6; floor += 1) {
    for (const corner of corners) {
      const x =
        profile.centerWorldM[0] +
        corner.local[0] * cosine +
        corner.local[1] * sine;
      const z =
        profile.centerWorldM[1] -
        corner.local[0] * sine +
        corner.local[1] * cosine;
      addPartialCylinder(
        builder,
        MAGENTA_GLASS,
        x,
        4.6 + 1.65 + floor * 3.48,
        z,
        radius,
        2.35,
        10,
        corner.theta,
        Math.PI / 2,
        profile.rotationY,
        false,
      );
      addPartialCylinder(
        builder,
        MAGENTA_WHITE,
        x,
        4.6 + 3.18 + floor * 3.48,
        z,
        radius + 0.08,
        0.5,
        10,
        corner.theta,
        Math.PI / 2,
        profile.rotationY,
        true,
      );
    }
  }
}

function addMagentaRoofTerrace(builder: Builder): void {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.magentaMitte;
  for (const run of profile.facadeRuns) {
    const frame = runFrame(run, profile.centerWorldM);
    const terraceY = 4.6 + profile.heightRangeM[1];
    addRunBox(
      builder,
      run,
      profile.centerWorldM,
      TERRACE_GREEN,
      0,
      terraceY + 0.18,
      -0.34,
      frame.lengthM - 0.6,
      0.36,
      0.32,
    );
    addRunBox(
      builder,
      run,
      profile.centerWorldM,
      MAGENTA_FRAME,
      0,
      terraceY + 1.2,
      0.12,
      frame.lengthM,
      0.1,
      0.1,
    );
    const postCount = Math.max(2, Math.floor(frame.lengthM / 2.8));
    for (let post = 0; post <= postCount; post += 1) {
      addRunBox(
        builder,
        run,
        profile.centerWorldM,
        MAGENTA_FRAME,
        -frame.lengthM / 2 + (frame.lengthM * post) / postCount,
        terraceY + 0.7,
        0.12,
        0.08,
        1.4,
        0.08,
      );
    }
  }
}

function buildMagentaMitte(): Group {
  const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.magentaMitte;
  const builder = createBuilder();
  for (const run of profile.facadeRuns) {
    addContinuousGlassFacade(builder, run, profile.centerWorldM);
  }
  addMagentaCurvedBands(builder);
  addMagentaRoofTerrace(builder);
  addOpenEntranceFrame(
    builder,
    profile.facadeRuns[3],
    profile.centerWorldM,
    0,
    4.5,
    4.8,
    MAGENTA_WHITE,
  );
  addRunLampBox(
    builder,
    profile.facadeRuns[3],
    profile.centerWorldM,
    MAGENTA_ACCENT,
    0,
    4.6 + 10.4,
    0.38,
    10.5,
    0.18,
    0.16,
  );
  const group = finishDrawnGroup(builder, {
    lampEmissive: MAGENTA_ACCENT,
    lampEmissiveIntensity: 0.8,
    name: "Magenta Mitte curved-band facade overlays",
  })!;
  group.userData.profile = profile;
  group.userData.collisionRole = "visual-overlay-with-source-edge-portal";
  return group;
}

/**
 * Return a portal contract without mutating the global collision field.
 * Consumers may opt in later by combining it with their protected-volume
 * policy; this visual module never opens an unrelated LoD2 obstacle itself.
 */
export function leipzigerPlatzPortalAt(
  x: number,
  y: number,
  z: number,
  obstacleId?: string,
): LeipzigerPortalVolume | null {
  for (const portal of LEIPZIGER_PLATZ_PORTALS) {
    const deltaX = x - portal.centerWorldM[0];
    const deltaZ = z - portal.centerWorldM[2];
    const cosine = Math.cos(portal.rotationY);
    const sine = Math.sin(portal.rotationY);
    const localX = deltaX * cosine - deltaZ * sine;
    const localZ = deltaX * sine + deltaZ * cosine;
    if (
      Math.abs(localX) > portal.sizeM[0] / 2 ||
      Math.abs(y - portal.centerWorldM[1]) > portal.sizeM[1] / 2 ||
      Math.abs(localZ) > portal.sizeM[2] / 2
    ) {
      continue;
    }
    if (
      obstacleId !== undefined &&
      !(portal.collisionIds as ReadonlyArray<string>).includes(obstacleId) &&
      !(portal.lod2PartIds as ReadonlyArray<string>).includes(obstacleId)
    ) {
      continue;
    }
    return portal;
  }
  return null;
}

/** Build the four exact-source recognition layers without replacing LoD2. */
export function createLeipzigerPlatzDetails(): Group {
  const root = new Group();
  root.name = "Leipziger Platz source-bound architecture details";
  root.userData.profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE;
  root.userData.portals = LEIPZIGER_PLATZ_PORTALS;
  root.userData.collisionPolicy =
    "visual overlays do not enter the pedestrian obstacle index; portal contracts are exported but opt-in";
  root.add(buildMall(), buildCanada(), buildTaylorWessing(), buildMagentaMitte());

  const bounds = new Box3().setFromObject(root);
  root.userData.metricBounds = {
    max: bounds.max.toArray(),
    min: bounds.min.toArray(),
  };
  return root;
}
