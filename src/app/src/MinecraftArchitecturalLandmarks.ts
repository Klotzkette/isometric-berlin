import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  StaticDrawUsage,
  Vector3,
} from "three";
import {
  BUNDESTAG_SPREE_CONNECTION_PROFILE,
  MELH_SPREE_FRONT_PROFILE,
} from "./CentralCivicDetails";
import {
  BERLINER_ENSEMBLE_IDS,
  BERLINER_ENSEMBLE_PROFILE,
  BERLINER_ENSEMBLE_PUBLIC_FACADE_AZIMUTH_DEGREES,
  BERLINER_ENSEMBLE_ROOF_CAP_TOP_Y_M,
  BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
  BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M,
  BERLINER_ENSEMBLE_ROOF_SIGN_INSTANCES_MARKER,
  BERLINER_ENSEMBLE_ROOF_TOWER_ROTATION_DEGREES,
} from "./BerlinerEnsemble";
import { HOTEL_ADLON_PROFILE } from "./HotelAdlonProfile";
import { STARBUCKS_PARISER_PLATZ_PROFILE } from "./StarbucksPariserPlatz";
import {
  MINECRAFT_ARCHITECTURAL_BLOCKS as BLOCK,
  MINECRAFT_PALETTE,
} from "./visual-modes/minecraft/palette";
import { invalidenfriedhofVoxelReplacementAt } from "./InvalidenfriedhofDetails";

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

type LocalFrame = {
  anchorWorld: Point3;
  rotationDegrees: number;
};

type BlockSpec = {
  color: number;
  cue: string;
  position: Point3;
  rotationY: number;
  size: Point3;
};

type BlockPlan = {
  blocks: BlockSpec[];
  cueCounts: Map<string, number>;
  transforms: Set<string>;
};

type BlockRenderResources = {
  geometry: BoxGeometry;
  material: MeshStandardMaterial;
};

const COARSE_CIVIC_BLOCK_SPAN_M = 8;

export const MINECRAFT_ARCHITECTURAL_PROFILES = {
  hotelAdlon: HOTEL_ADLON_PROFILE,
  berlinerEnsemble: {
    blockLoD: {
      maxDrawCalls: 1,
      roofStageBaseY: 22.14,
      roofStageTopY: BERLINER_ENSEMBLE_ROOF_CAP_TOP_Y_M,
      signCentreY: BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
      signDiameterM: BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M,
      towerDepthM:
        BERLINER_ENSEMBLE_PROFILE.roofTower.capContainment.baseDepthM,
      towerWidthM:
        BERLINER_ENSEMBLE_PROFILE.roofTower.capContainment.baseWidthM,
    },
    parentGmlId: BERLINER_ENSEMBLE_PROFILE.lod2Parent,
    signFrame: {
      anchorWorld: [
        BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM[0],
        4.05,
        BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM[1],
      ] as const,
      rotationDegrees: BERLINER_ENSEMBLE_PUBLIC_FACADE_AZIMUTH_DEGREES,
    },
    sourceOsmBuildingWay: BERLINER_ENSEMBLE_PROFILE.osm.buildingWayId,
    sourceOsmSiteWay: BERLINER_ENSEMBLE_PROFILE.osm.siteWayId,
    sourcePrismIds: [...BERLINER_ENSEMBLE_IDS] as const,
    sourceUrl: BERLINER_ENSEMBLE_PROFILE.sourceUrls[0],
    towerFrame: {
      anchorWorld: [
        BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM[0],
        4.05,
        BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM[1],
      ] as const,
      rotationDegrees: BERLINER_ENSEMBLE_ROOF_TOWER_ROTATION_DEGREES,
    },
  },
  brandenburgGate: {
    anchorWorld: [417.898, 4.734, 300.453] as const,
    columnHeightM: 13.5,
    columnsPerRow: 6,
    depthM: 11,
    gateHeightM: 20.3,
    rotationDegrees: 5.083,
    sourceUrl: "https://www.visitberlin.de/de/brandenburger-tor",
    sourcePrismIds: ["K0001xqy", "QDYNK7dL", "VpZW4Luf"] as const,
    totalHeightM: 26,
    widthM: 62.5,
  },
  chancellery: {
    anchorWorld: [-220.236, 1.554, -145.806] as const,
    cube: {
      depthM: 55.103,
      heightM: 36,
      offsetLocal: [66.373, 0.042] as const,
      widthM: 55.211,
    },
    forecourtOffsetLocal: [158.413, -7.51] as const,
    officeHeightM: 18,
    officeSegments: [
      {
        depthM: 23.463,
        offsetLocal: [61.563, 39.306] as const,
        widthM: 219.532,
      },
      {
        depthM: 23.536,
        offsetLocal: [69.738, -39.269] as const,
        widthM: 203.2,
      },
      {
        depthM: 21.027,
        offsetLocal: [-103.762, 40.523] as const,
        widthM: 135.151,
      },
    ] as const,
    overallDepthM: 102.074,
    overallWidthM: 342.676,
    rotationDegrees: -1.337,
    centralSourcePrismIds: [
      "XCNI3jr6",
      "n02sJgK0",
      "3Gfqy8sI",
      "ttJFXdbg",
      "SDUXI5wB",
      "bP7AjElp",
      "kJtNoSnl",
      "MLwG4KW9",
      "X6sFDl1v",
      "xIEMuFtk",
      "JC1pzD9P",
      "DV754o6F",
      "wgTapoMe",
    ] as const,
    sourceUrl:
      "https://www.bundesregierung.de/breg-de/bundesregierung/" +
      "bundeskanzleramt/geschichte-bundeskanzleramt-975040",
  },
  hauptbahnhof: {
    anchorWorld: [-119.936, 4.575, -683.307] as const,
    entrances: {
      eastWest: {
        clearHeightM: 13.1,
        clearHalfWidthM: 14,
        endLocalX: 160.6,
      },
      northSouth: {
        clearHeightM: 9.1,
        clearHalfWidthM: 6,
        endLocalZ: 89.1,
      },
    },
    eastWestRoof: {
      baseY: 10.4,
      lengthM: 321,
      riseM: 12.5,
      widthM: 40,
    },
    northSouthHall: {
      baseY: 8.2,
      lengthM: 180,
      riseM: 19,
      widthM: 42,
    },
    officeBridgeHeightM: 46,
    officeEntrances: {
      bridgeCentresLocalX: [-35, 35],
      clearHeightM: 7.9,
      clearHalfWidthM: 4,
      endLocalZ: 90.4,
    },
    officeBridgeStoreys: 10,
    officeBridgeWidthM: 19,
    publicFloorTopLocalY: 1.32,
    portalCollisionSourcePrismIds: {
      north: "K0003Vlz",
      south: "K0003TlE",
      west: "HGmLi1Ck",
    },
    replacementMarginM: 15,
    rotationDegrees: 21.82,
    sourcePrismIds: [
      "K0002KiE",
      "m3AE8zAD",
      "vKTIAPg2",
      "M7I6Afam",
      "jacWOmHc",
      "6ZJfG5j0",
      "663NhxsM",
      "R2n4CS77",
      "XpzUHc7R",
      "wCru06vf",
      "OXDNOQlg",
      "zTSJJzrL",
      "8hUNWvQf",
      "X2oOtd6Z",
      "ldYGmtbR",
      "j8AwuDGD",
      "D6fKsTRY",
    ] as const,
    sourceUrl: "https://www.deutschebahn.com/de/architektur_bahnhof-6878040",
    trackDeckCentreLocalY: 9.8,
    trackDeckTopLocalY: 10.35,
    trackDeckWidthM: 37,
  },
  marieElisabethLuedersHaus: {
    facade: MELH_SPREE_FRONT_PROFILE,
    rotunda: {
      baseY: 4,
      centreWorld: [406, -139] as const,
      heightM: 34,
      radiusM: 16.5,
    },
    sourceUrl:
      "https://www.bundestag.de/besuche/architektur/luedershaus/architektur",
    sourcePrismIds: ["RdNEzXe9"] as const,
  },
  paulLoebeHaus: {
    canopy: {
      centreZ: -137.25,
      columnCount: 13,
      groundY: 5.1,
      reachM: 13.5,
      spanZ: 106,
      topY: 28.6,
      westFaceX: 129.8,
    },
    committeeRotundas: [
      {
        centreWorld: [179.4, -120.4],
        chordWorld: [
          [171.1, -120.6],
          [187.7, -120.2],
        ],
        outwardZ: 1,
        radiusM: 8.3,
        sourcePrismIds: ["noaunBhZ", "ZeK70Ye4"],
      },
      {
        centreWorld: [215.05, -119.6],
        chordWorld: [
          [206.8, -119.8],
          [223.3, -119.4],
        ],
        outwardZ: 1,
        radiusM: 8.25,
        sourcePrismIds: ["G7vQatpl", "Y7HNPFou"],
      },
      {
        centreWorld: [250.65, -118.7],
        chordWorld: [
          [242.4, -118.9],
          [258.9, -118.5],
        ],
        outwardZ: 1,
        radiusM: 8.25,
        sourcePrismIds: ["N5uI1839", "vWdP9XQr"],
      },
      {
        centreWorld: [286.25, -117.9],
        chordWorld: [
          [278, -118.1],
          [294.5, -117.7],
        ],
        outwardZ: 1,
        radiusM: 8.25,
        sourcePrismIds: ["sjklzRAu", "3HuFvoly"],
      },
      {
        centreWorld: [180.2, -152.4],
        chordWorld: [
          [172, -152.6],
          [188.4, -152.2],
        ],
        outwardZ: -1,
        radiusM: 8.2,
        sourcePrismIds: ["LaULmc2c", "PG5HESRX"],
      },
      {
        centreWorld: [215.8, -151.6],
        chordWorld: [
          [207.6, -151.8],
          [224, -151.4],
        ],
        outwardZ: -1,
        radiusM: 8.2,
        sourcePrismIds: ["y0TNx05x", "t9rBM1Wb"],
      },
      {
        centreWorld: [251.4, -150.75],
        chordWorld: [
          [243.2, -150.9],
          [259.6, -150.6],
        ],
        outwardZ: -1,
        radiusM: 8.2,
        sourcePrismIds: ["U6PEWNqX", "hmFaGqV3"],
      },
      {
        centreWorld: [286.95, -149.9],
        chordWorld: [
          [278.7, -150.1],
          [295.2, -149.7],
        ],
        outwardZ: -1,
        radiusM: 8.25,
        sourcePrismIds: ["7RljyDa9", "JISYhUSy"],
      },
    ] as const,
    rotundaBaseY: 5.1,
    rotundaHeightM: 24,
    sourceUrl:
      "https://www.bundestag.de/besuche/architektur/loebehaus/architektur",
    sourcePrismIds: ["0sVYAxtY", "HA7mKuzG"] as const,
  },
  starbucksPariserPlatz: STARBUCKS_PARISER_PLATZ_PROFILE,
  reichstag: {
    anchorWorld: [317.729, 3.595, 40.477] as const,
    bodyHeightM: 28.055,
    depthM: 138,
    dome: {
      anchorWorld: [317.729, 27.595, 40.477] as const,
      diameterM: 40,
      heightM: 23.5,
    },
    ornamentSourceUrls: [
      "https://www.bundestag.de/dokumente/textarchiv/2024/kw33-rtg-beschreibung-383518",
      "https://commons.wikimedia.org/wiki/File:Reichstag_(building)_architecture_from_west_-_Berlin,_Germany_-_DSC09654.JPG",
    ] as const,
    rotationDegrees: -1.676,
    sourceUrl:
      "https://www.bundestag.de/dokumente/textarchiv/2024/kw33-rtg-beschreibung-383518",
    sourcePrismIds: ["K0002MCN", "UbQkgNZe", "ycOYQRVL"] as const,
    // Exact local rings of DEBE3DY4UbQkgNZe and DEBE3DlRycOYQRVL. Their
    // union owns twelve current 4 m cell centres; the indents matter because
    // a rectangular shortcut would also erase Reichstag main-body cells.
    westPorticoSourceRingsLocal: [
      [
        [-54.287, 15.918],
        [-54.323, -16.095],
        [-48.32, -16.071],
        [-48.338, -13.269],
        [-47.838, -13.284],
        [-47.856, -10.482],
        [-48.356, -10.467],
        [-48.374, -7.665],
        [-46.672, -7.615],
        [-46.69, -4.813],
        [-48.392, -4.864],
        [-48.311, 4.738],
        [-46.712, 4.691],
        [-46.73, 7.493],
        [-48.329, 7.54],
        [-48.347, 10.341],
        [-47.847, 10.327],
        [-47.865, 13.129],
        [-48.365, 13.143],
        [-48.386, 15.845],
      ],
      [
        [-48.393, 1.939],
        [-48.31, -2.065],
        [-46.711, -2.112],
        [-46.694, 1.889],
      ],
    ] as const,
    towerInsetM: 0.9,
    towerSizeM: 16.5,
    wappenTreeZ: [-14, 14] as const,
    widthM: 100,
  },
} as const;

export const MINECRAFT_SMOOTH_SIGNATURE_REPLACEMENTS = new Set([
  "Official-dimension Reichstag dome",
  "Metre-scale Reichstag recognition model",
  "Metre-scale Federal Chancellery recognition model",
  "Metre-scale Berlin Hauptbahnhof recognition model",
  "Metre-scale Brandenburg Gate recognition model",
]);

const MELH_CANOPY_CELL_MARGIN_BOUNDS = (() => {
  const ring =
    MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus.facade.canopy
      .footprintWorld;
  const xs = ring.map(([x]) => x);
  const zs = ring.map(([, z]) => z);
  return {
    maxX: Math.max(...xs) + 2.9,
    maxZ: Math.max(...zs) + 2.9,
    minX: Math.min(...xs) - 2.9,
    minZ: Math.min(...zs) - 2.9,
  };
})();

/** Survey-aligned local centreline of the Hauptbahnhof's bowed E-W hall. */
export function hauptbahnhofEastWestCurveAt(localX: number): number {
  return 0.000_787 * localX * localX + 0.223_3 * localX;
}

/** Local Y-rotation that makes an end frame normal follow the bowed hall. */
export function hauptbahnhofEastWestTangentRotationAt(localX: number): number {
  const derivative = 2 * 0.000_787 * localX + 0.223_3;
  return -Math.atan(derivative);
}

const MINECRAFT_CENTRAL_REPLACEMENTS = new Set([
  "Bundestag Spree connection recognition model",
]);

function newPlan(): BlockPlan {
  return {
    blocks: [],
    cueCounts: new Map<string, number>(),
    transforms: new Set<string>(),
  };
}

function pushBlock(
  plan: BlockPlan,
  cue: string,
  position: Point3,
  size: Point3,
  color: number,
  rotationY = 0,
): void {
  if (
    ![...position, ...size, rotationY].every(Number.isFinite) ||
    size.some((value) => value <= 0)
  ) {
    return;
  }
  // Hero architecture intentionally uses an eight-metre civic voxel: large
  // enough to read as a deliberately constructed block model rather than a
  // smooth LoD replica, yet still small enough to preserve portals and the
  // characteristic silhouettes at the viewer's isometric scale.
  const xSegments = Math.ceil(size[0] / (COARSE_CIVIC_BLOCK_SPAN_M + 0.001));
  const zSegments = Math.ceil(size[2] / (COARSE_CIVIC_BLOCK_SPAN_M + 0.001));
  const childSize: Point3 = [size[0] / xSegments, size[1], size[2] / zSegments];
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
    const localX = -size[0] / 2 + childSize[0] / 2 + xIndex * childSize[0];
    for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
      const localZ = -size[2] / 2 + childSize[2] / 2 + zIndex * childSize[2];
      const childPosition: Point3 = [
        position[0] + cosine * localX + sine * localZ,
        position[1],
        position[2] - sine * localX + cosine * localZ,
      ];
      // Coincident boxes are the one thing this layer may never emit: even
      // two opaque cubes at identical depth will shimmer during an orbit.
      const key = [...childPosition, ...childSize, rotationY]
        .map((value) => value.toFixed(4))
        .join(":");
      if (plan.transforms.has(key)) continue;
      plan.transforms.add(key);
      plan.blocks.push({
        color,
        cue,
        position: childPosition,
        rotationY,
        size: childSize,
      });
      plan.cueCounts.set(cue, (plan.cueCounts.get(cue) ?? 0) + 1);
    }
  }
}

function localToWorld(
  frame: LocalFrame,
  localX: number,
  localZ: number,
): Point2 {
  const radians = (frame.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    frame.anchorWorld[0] + cosine * localX + sine * localZ,
    frame.anchorWorld[2] - sine * localX + cosine * localZ,
  ];
}

function pushLocalBlock(
  plan: BlockPlan,
  frame: LocalFrame,
  cue: string,
  localPosition: Point3,
  size: Point3,
  color: number,
  additionalRotationY = 0,
): void {
  const [worldX, worldZ] = localToWorld(
    frame,
    localPosition[0],
    localPosition[2],
  );
  pushBlock(
    plan,
    cue,
    [worldX, frame.anchorWorld[1] + localPosition[1], worldZ],
    size,
    color,
    (frame.rotationDegrees * Math.PI) / 180 + additionalRotationY,
  );
}

function pushWorldBlock(
  plan: BlockPlan,
  cue: string,
  position: Point3,
  size: Point3,
  color: number,
  rotationY = 0,
): void {
  pushBlock(plan, cue, position, size, color, rotationY);
}

function pushFlagPole(
  plan: BlockPlan,
  frame: LocalFrame,
  cue: string,
  localX: number,
  localZ: number,
  baseY: number,
): void {
  pushLocalBlock(
    plan,
    frame,
    `${cue} pole`,
    [localX, baseY + 5.5, localZ],
    [0.8, 11, 0.8],
    BLOCK.iron,
  );
}

function finishPlan(
  name: string,
  landmarkId: string,
  plan: BlockPlan,
  profile: unknown,
  resources: BlockRenderResources,
): InstancedMesh {
  const mesh = new InstancedMesh(
    resources.geometry,
    resources.material,
    Math.max(1, plan.blocks.length),
  );
  mesh.name = name;
  mesh.count = plan.blocks.length;
  const matrix = new Matrix4();
  const scale = new Vector3();
  const color = new Color();
  plan.blocks.forEach((block, index) => {
    matrix.makeRotationY(block.rotationY);
    scale.fromArray(block.size);
    matrix.scale(scale);
    matrix.setPosition(...block.position);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.setHex(block.color));
  });
  mesh.instanceMatrix.setUsage(StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.setUsage(StaticDrawUsage);
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const preciousCount = plan.blocks.filter(
    ({ color: hex }) => hex === BLOCK.gold || hex === BLOCK.lapis,
  ).length;
  const nonStructuralBlocks = plan.blocks.filter(
    ({ cue }) =>
      !cue.endsWith(" flag pole") && cue !== "upper bridge open frame posts",
  );
  const maxNonStructuralVerticalSpanM = Math.max(
    0,
    ...nonStructuralBlocks.map(({ size }) => size[1]),
  );
  const maxNonStructuralVerticalCue = nonStructuralBlocks.find(
    ({ size }) => size[1] === maxNonStructuralVerticalSpanM,
  )?.cue;
  const maxHorizontalSpanM = Math.max(
    0,
    ...plan.blocks.flatMap(({ size }) => [size[0], size[2]]),
  );
  const rotationYByCue = Object.fromEntries(
    [...plan.cueCounts.keys()].map((cue) => [
      cue,
      [
        ...new Set(
          plan.blocks
            .filter((block) => block.cue === cue)
            .map(({ rotationY }) => Number(rotationY.toFixed(6))),
        ),
      ],
    ]),
  );
  mesh.userData = {
    blockCount: plan.blocks.length,
    blockNative: true,
    blockGrammar: "coarse eight-metre civic voxel",
    coarseBlockSpanM: COARSE_CIVIC_BLOCK_SPAN_M,
    cueCounts: Object.fromEntries(plan.cueCounts),
    landmarkId,
    maxHorizontalSpanM,
    maxNonStructuralVerticalCue,
    maxNonStructuralVerticalSpanM,
    palette: "shared fixed 32-colour Minecraft palette",
    preciousAccentRatio:
      plan.blocks.length === 0 ? 0 : preciousCount / plan.blocks.length,
    profile,
    rotationYByCue,
    staticAntiFlicker: true,
    transparentGeometry: false,
  };
  return mesh;
}

function createReichstagBlocks(resources: BlockRenderResources): InstancedMesh {
  const profile = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
  const frame: LocalFrame = profile;
  const plan = newPlan();
  const westX = -profile.widthM / 2 - 3.6;

  // Six chunky columns, one dark portal and three pediment steps carry the
  // whole west elevation. Carved details are reduced to two block crests.
  for (let column = 0; column < 6; column += 1) {
    const z = -17.5 + column * 7;
    for (let layer = 0; layer < 4; layer += 1) {
      pushLocalBlock(
        plan,
        frame,
        "six coarse west-portico columns",
        [westX, 5.4 + layer * 4, z],
        [3.2, 3.7, 3.2],
        layer % 2 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
      );
    }
    pushLocalBlock(
      plan,
      frame,
      "six coarse west-portico capitals",
      [westX, 19.1, z],
      [4.6, 1.4, 4.6],
      BLOCK.marbleLight,
    );
  }
  for (let course = 0; course < 3; course += 1) {
    pushLocalBlock(
      plan,
      frame,
      "deep block entrance",
      [westX + 1.3, 6 + course * 4, 0],
      [1.6, 3.8, 29],
      BLOCK.deepRecess,
    );
  }
  for (const z of [-8, 0, 8]) {
    for (const y of [7.5, 11.5]) {
      pushLocalBlock(
        plan,
        frame,
        "three-bay entrance glass",
        [westX + 0.4, y, z],
        [1.2, 3.6, 5.8],
        BLOCK.tealGlass,
      );
    }
  }
  pushLocalBlock(
    plan,
    frame,
    "block portico entablature",
    [westX, 19.2, 0],
    [7.2, 2.4, 41],
    BLOCK.quartzIvory,
  );
  for (let layer = 0; layer < 3; layer += 1) {
    pushLocalBlock(
      plan,
      frame,
      "three-step west pediment",
      [westX, 21.2 + layer * 1.8, 0],
      [6.4, 1.6, 38 - layer * 11],
      layer % 2 === 0 ? BLOCK.marbleLight : BLOCK.limestone,
    );
  }
  for (const z of [-19.15, 19.15]) {
    for (const [y, width] of [
      [22, 3.2],
      [25, 2.4],
      [27.5, 3.4],
    ] as const) {
      pushLocalBlock(
        plan,
        frame,
        "paired block crown finials",
        [westX - 3.82, y, z],
        [width, 2.2, width],
        y === 25 ? BLOCK.limestone : BLOCK.marbleLight,
      );
    }
  }
  const crestPixels = [
    [6.85, -0.78],
    [6.85, 0.78],
    [8.15, -1.12],
    [8.15, 1.12],
    [9.48, -1.42],
    [9.48, 1.42],
    [10.82, -1.08],
    [10.82, 1.08],
    [12.15, -0.7],
    [12.15, 0.7],
  ] as const;
  for (const treeZ of profile.wappenTreeZ) {
    for (const y of [8, 11.2]) {
      pushLocalBlock(
        plan,
        frame,
        "paired crowned Wappenbaum reliefs",
        [westX + 0.9, y, treeZ],
        [1.2, 2.8, 2.8],
        BLOCK.marbleShadow,
      );
    }
    pushLocalBlock(
      plan,
      frame,
      "paired crowned Wappenbaum reliefs",
      [westX + 0.9, 5.4, treeZ],
      [1.2, 2.2, 2.2],
      BLOCK.marbleShadow,
    );
    for (const [y, offsetZ] of crestPixels) {
      pushLocalBlock(
        plan,
        frame,
        "paired crowned Wappenbaum reliefs",
        [westX + 0.9, y, treeZ + offsetZ],
        [1.2, 1.1, 1.1],
        BLOCK.marbleLight,
      );
    }
    pushLocalBlock(
      plan,
      frame,
      "paired crowned Wappenbaum reliefs",
      [westX + 0.9, 13.5, treeZ],
      [1.2, 1.6, 3.8],
      BLOCK.gold,
    );
  }
  pushLocalBlock(
    plan,
    frame,
    "single gold dedication band",
    [westX - 3.75, 18.6, 0],
    [0.9, 1.4, 16],
    BLOCK.gold,
  );
  for (let step = 0; step < 3; step += 1) {
    pushLocalBlock(
      plan,
      frame,
      "three-course west stair",
      [westX - 5 - step * 1.7, 3.6 - step * 0.8, 0],
      [1.8, 0.8, 37 - step * 3],
      step % 2 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
    );
  }

  // The coarse two-part LoD2 portico is removed from the voxel payload below.
  // Rebuild its rear plane as a real block wall so opening the six-column
  // order never turns the entrance into a hole through the Reichstag body.
  for (let z = -16; z <= 16; z += 8) {
    for (const y of [7, 11, 15, 19]) {
      const entrance = Math.abs(z) <= 8 && y <= 11;
      pushLocalBlock(
        plan,
        frame,
        entrance ? "coarse rear glazing" : "coarse rear masonry",
        [-48.2, y, z],
        [2.1, 3.8, 7.6],
        entrance ? BLOCK.tealGlass : BLOCK.limestone,
      );
    }
  }

  // Two oversized window rows are enough to suggest the historic facades.
  for (const side of [-1, 1]) {
    const faceX = side * (profile.widthM / 2 + 2.35);
    for (let z = -48; z <= 48; z += 16) {
      if (side < 0 && Math.abs(z) < 24) continue;
      for (const y of [9, 17]) {
        pushLocalBlock(
          plan,
          frame,
          "oversized facade window blocks",
          [faceX, y, z],
          [1.25, 3.8, 7.2],
          (Math.abs(z) + Math.round(y)) % 32 === 0
            ? BLOCK.iceGlass
            : BLOCK.deepRecess,
        );
      }
    }
    const faceZ = side * (profile.depthM / 2 + 2.35);
    for (let x = -32; x <= 32; x += 16) {
      for (const y of [9, 17]) {
        pushLocalBlock(
          plan,
          frame,
          "oversized facade window blocks",
          [x, y, faceZ],
          [7.2, 3.8, 1.25],
          (Math.abs(x) + Math.round(y)) % 32 === 0
            ? BLOCK.iceGlass
            : BLOCK.deepRecess,
        );
      }
    }
  }

  const towerCentre = (side: number, extent: number): number =>
    side * (extent / 2 - profile.towerSizeM / 2 - profile.towerInsetM);
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const towerX = towerCentre(xSide, profile.widthM);
      const towerZ = towerCentre(zSide, profile.depthM);
      for (let tier = 0; tier < 3; tier += 1) {
        pushLocalBlock(
          plan,
          frame,
          "four three-tier corner crowns",
          [towerX, profile.bodyHeightM + 1 + tier * 1.8, towerZ],
          [12 - tier * 3, 1.6, 12 - tier * 3],
          tier === 1 ? BLOCK.limestone : BLOCK.marbleLight,
        );
      }
      pushFlagPole(
        plan,
        frame,
        "Reichstag roof flag",
        towerX,
        towerZ,
        profile.bodyHeightM + 1.8,
      );
    }
  }

  // A seven-ring octagonal dome replaces the former near-smooth 792-block
  // hemisphere. The broad steps are the intended Minecraft silhouette.
  const dome = profile.dome;
  const podiumLocalY = dome.anchorWorld[1] - profile.anchorWorld[1] - 0.9;
  for (let x = -16; x <= 16; x += 8) {
    for (let z = -16; z <= 16; z += 8) {
      pushLocalBlock(
        plan,
        frame,
        "coarse dome podium",
        [x, podiumLocalY, z],
        [7.6, 1.8, 7.6],
        (x + z) % 16 === 0 ? BLOCK.marbleLight : BLOCK.marbleShadow,
      );
    }
  }
  const domeTiers = [
    [20, 4, 8],
    [17.5, 4, 7],
    [15, 4, 6],
    [12.5, 3.5, 5],
    [10, 3.5, 4],
    [7, 3, 3],
  ] as const;
  for (const [row, [halfExtent, edgeThickness, bevel]] of domeTiers.entries()) {
    const y = dome.anchorWorld[1] - profile.anchorWorld[1] + 1.7 + row * 3.35;
    const edgeOffset = halfExtent - edgeThickness / 2;
    const straightLength = 2 * (halfExtent - bevel);
    for (const side of [-1, 1]) {
      pushLocalBlock(
        plan,
        frame,
        "seven-step octagonal glass dome",
        [0, y, side * edgeOffset],
        [straightLength, 3, edgeThickness],
        (side + row) % 3 === 0 ? BLOCK.iron : BLOCK.iceGlass,
      );
      pushLocalBlock(
        plan,
        frame,
        "seven-step octagonal glass dome",
        [side * edgeOffset, y, 0],
        [edgeThickness, 3, straightLength],
        (side + row + 1) % 3 === 0 ? BLOCK.iron : BLOCK.iceGlass,
      );
    }
    for (const xSide of [-1, 1]) {
      for (const zSide of [-1, 1]) {
        pushLocalBlock(
          plan,
          frame,
          "seven-step octagonal glass dome",
          [
            xSide * (halfExtent - bevel / 2),
            y,
            zSide * (halfExtent - bevel / 2),
          ],
          [bevel, 3, bevel],
          (xSide + zSide + row) % 3 === 0 ? BLOCK.iron : BLOCK.iceGlass,
        );
      }
    }
  }
  pushLocalBlock(
    plan,
    frame,
    "seven-step octagonal glass dome",
    [0, dome.anchorWorld[1] - profile.anchorWorld[1] + 1.7 + 6 * 3.35, 0],
    [8, 3, 8],
    BLOCK.iron,
  );
  for (let level = 0; level < 4; level += 1) {
    const width = 7 - level * 1.2;
    pushWorldBlock(
      plan,
      "four-block silver daylight cone",
      [
        dome.anchorWorld[0],
        dome.anchorWorld[1] + 3 + level * 4,
        dome.anchorWorld[2],
      ],
      [width, 3.6, width],
      level === 0 ? BLOCK.marbleLight : BLOCK.iron,
    );
  }

  return finishPlan(
    "Minecraft Reichstag block signature",
    "reichstag",
    plan,
    profile,
    resources,
  );
}

function createChancelleryBlocks(
  resources: BlockRenderResources,
): InstancedMesh {
  const profile = MINECRAFT_ARCHITECTURAL_PROFILES.chancellery;
  const frame: LocalFrame = profile;
  const plan = newPlan();
  const cube = profile.cube;
  const [cubeX, cubeZ] = cube.offsetLocal;

  // Six overscale courses per pylon establish the Kanzleramt as a white
  // Minecraft monument before any window cue is visible.
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const x = cubeX + xSide * (cube.widthM / 2 - 2.3);
      const z = cubeZ + zSide * (cube.depthM / 2 - 2.3);
      for (let layer = 0; layer < 6; layer += 1) {
        pushLocalBlock(
          plan,
          frame,
          "four six-course leadership pylons",
          [x, 3 + layer * 5.8, z],
          [5.8, 5.5, 5.8],
          layer % 2 === 1 ? BLOCK.marbleShadow : BLOCK.marbleLight,
        );
      }
    }
  }
  for (const side of [-1, 1]) {
    pushLocalBlock(
      plan,
      frame,
      "open upper frame",
      [cubeX + side * (cube.widthM / 2 - 1.1), cube.heightM - 1, cubeZ],
      [2.2, 2, cube.depthM],
      BLOCK.marbleLight,
    );
    pushLocalBlock(
      plan,
      frame,
      "open upper frame",
      [cubeX, cube.heightM - 1, cubeZ + side * (cube.depthM / 2 - 1.1)],
      [cube.widthM - 4.4, 2, 2.2],
      BLOCK.marbleLight,
    );
  }

  // The central openings are intentionally stair-stepped rather than sampled
  // semicircles. Five broad courses make the iconic twin arches unmistakable
  // while keeping the source cube hollow and visibly voxel-built.
  const shellInnerHalfDepth = cube.depthM / 2 - 2.2;
  const shellDepthBay = (shellInnerHalfDepth * 2) / 7;
  for (const xSide of [-1, 1]) {
    const masonryX = cubeX + xSide * (cube.widthM / 2 - 1);
    const glazingX = cubeX + xSide * (cube.widthM / 2 + 0.45);
    for (let bay = 0; bay < 7; bay += 1) {
      const z = -shellInnerHalfDepth + shellDepthBay * (bay + 0.5);
      const absoluteZ = cubeZ + z;
      for (const y of [4, 10, 16, 22, 28]) {
        const archHalfWidth = y <= 10 ? 16 : y <= 16 ? 16 : y <= 22 ? 8 : 0;
        const insideArch = archHalfWidth > 0 && Math.abs(z) <= archHalfWidth;
        if (insideArch) {
          pushLocalBlock(
            plan,
            frame,
            "stair-stepped leadership aperture",
            [glazingX, y, absoluteZ],
            [1.2, 5.6, shellDepthBay],
            xSide > 0 && Math.abs(z) < 1e-6 && y === 16
              ? BLOCK.lapis
              : (z / 8 + y / 6) % 3 === 0
                ? BLOCK.iron
                : BLOCK.tealGlass,
          );
          continue;
        }
        pushLocalBlock(
          plan,
          frame,
          "coarse leadership masonry shell",
          [masonryX, y, absoluteZ],
          [2.4, 5.6, shellDepthBay],
          (Math.round(z / 8) + Math.round(y / 6) + xSide) % 3 === 0
            ? BLOCK.marbleShadow
            : BLOCK.marbleLight,
        );
      }
    }
    for (const [z, y] of [
      [-16, 17],
      [-8, 23],
      [0, 28],
      [8, 23],
      [16, 17],
    ] as const) {
      pushLocalBlock(
        plan,
        frame,
        "twin five-block leadership arch frames",
        [cubeX + xSide * (cube.widthM / 2 + 0.8), y, cubeZ + z],
        [2.2, 2.2, 6],
        BLOCK.iron,
      );
    }
  }
  const shellInnerHalfWidth = cube.widthM / 2 - 2.2;
  const shellWidthBay = (shellInnerHalfWidth * 2) / 7;
  for (const zSide of [-1, 1]) {
    const faceZ = cubeZ + zSide * (cube.depthM / 2 - 1);
    for (let bay = 0; bay < 7; bay += 1) {
      const x = -shellInnerHalfWidth + shellWidthBay * (bay + 0.5);
      for (const y of [4, 10, 16, 22, 28]) {
        const windowBay = y >= 10 && y <= 22 && Math.abs(x) <= 16;
        pushLocalBlock(
          plan,
          frame,
          windowBay
            ? "leadership transverse facade glazing"
            : "leadership transverse masonry shell",
          [cubeX + x, y, faceZ],
          [shellWidthBay, 5.6, 2.4],
          windowBay
            ? (Math.round(x / 8) + Math.round(y / 6) + zSide) % 3 === 0
              ? BLOCK.iron
              : BLOCK.iceGlass
            : BLOCK.quartzIvory,
        );
      }
    }
  }

  // The measured office-wing mass stays in the generic voxel layer. Only two
  // rows of oversized panes are added here, avoiding a realistic curtain wall.
  for (const [segmentIndex, segment] of profile.officeSegments.entries()) {
    const [segmentX, segmentZ] = segment.offsetLocal;
    for (const zSide of [-1, 1]) {
      for (
        let x = -segment.widthM / 2 + 8;
        x <= segment.widthM / 2 - 8;
        x += 16
      ) {
        for (const y of [6.5, 13]) {
          pushLocalBlock(
            plan,
            frame,
            "two-row oversized office glazing",
            [segmentX + x, y, segmentZ + zSide * (segment.depthM / 2 + 2.35)],
            [7.2, 4.2, 1.4],
            segmentIndex === 0 && zSide > 0 && y === 13 && Math.abs(x) < 9
              ? BLOCK.lapis
              : BLOCK.iceGlass,
          );
        }
      }
    }
  }

  // Five-by-seven stepped saddle: visibly angular, never a sampled surface.
  for (let forward = -16; forward <= 16; forward += 8) {
    for (let lateral = -24; lateral <= 24; lateral += 8) {
      const y = 31.8 + 3.8 * ((lateral / 25.5) ** 2 - (forward / 18) ** 2);
      pushLocalBlock(
        plan,
        frame,
        "coarse stepped saddle roof",
        [cubeX + 2.4 + forward, y, cubeZ + lateral],
        [7.6, 1.3, 7.6],
        (forward + lateral) % 16 === 0 ? BLOCK.marbleLight : BLOCK.marbleShadow,
      );
    }
  }

  const [courtX, courtZ] = profile.forecourtOffsetLocal;
  pushFlagPole(
    plan,
    frame,
    "Kanzleramt German protocol flag",
    courtX,
    courtZ - 7.2,
    0,
  );
  pushFlagPole(
    plan,
    frame,
    "Kanzleramt EU protocol flag",
    courtX,
    courtZ + 7.2,
    0,
  );

  return finishPlan(
    "Minecraft Federal Chancellery block signature",
    "bundeskanzleramt",
    plan,
    profile,
    resources,
  );
}

function createHauptbahnhofBlocks(
  resources: BlockRenderResources,
): InstancedMesh {
  const profile = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
  const frame: LocalFrame = profile;
  const plan = newPlan();
  const curveAt = hauptbahnhofEastWestCurveAt;
  const coarseBowAt = (localX: number): number =>
    Math.round(curveAt(localX) / 4) * 4;

  const eastWest = profile.eastWestRoof;
  const northSouth = profile.northSouthHall;
  const eastWestWallTopY =
    eastWest.baseY +
    eastWest.riseM * Math.sqrt(1 - (18 / (eastWest.widthM / 2)) ** 2) -
    0.85;
  const eastWestWallCourseHeight =
    (eastWestWallTopY - profile.publicFloorTopLocalY) / 2;
  for (let x = -160; x <= 160; x += 8) {
    const bow = coarseBowAt(x);
    for (let z = -16; z <= 16; z += 8) {
      const cross = z / (eastWest.widthM / 2);
      const y = Math.round(
        eastWest.baseY +
          eastWest.riseM * Math.sqrt(Math.max(0, 1 - cross * cross)),
      );
      const index = Math.round((x + 160) / 8) + Math.round((z + 16) / 8) * 41;
      pushLocalBlock(
        plan,
        frame,
        "coarse 321 m east-west glass hall",
        [x, y, z + bow],
        [7.6, 2.4, 7.6],
        index % 149 === 0
          ? BLOCK.lapis
          : index % 4 === 0
            ? BLOCK.iron
            : BLOCK.iceGlass,
      );
      // The north-south floor owns the crossing itself, so the two slabs do
      // not overlap or expose coplanar top faces there.
      if (Math.abs(x) > northSouth.widthM / 2) {
        pushLocalBlock(
          plan,
          frame,
          "coarse east-west station floor",
          [x, profile.publicFloorTopLocalY - 0.55, z + bow],
          [8, 1.1, 8],
          index % 5 === 0 ? BLOCK.marbleShadow : BLOCK.limestone,
        );
      }
    }
    // Five broad deck blocks and four paired rails preserve the railway cue.
    const deckBayCount = 5;
    const deckBayWidth = profile.trackDeckWidthM / deckBayCount;
    for (let bay = 0; bay < deckBayCount; bay += 1) {
      const z = -profile.trackDeckWidthM / 2 + deckBayWidth * (bay + 0.5);
      pushLocalBlock(
        plan,
        frame,
        "five-block-wide raised railway deck",
        [x, profile.trackDeckCentreLocalY, z + bow],
        [7.6, 1.1, deckBayWidth],
        (Math.round(x / 8) + bay) % 5 === 0
          ? BLOCK.marbleShadow
          : BLOCK.limestone,
      );
    }
    for (const trackCentre of [-12, -4, 4, 12]) {
      for (const railOffset of [-0.72, 0.72]) {
        pushLocalBlock(
          plan,
          frame,
          "four paired block tracks",
          [
            x,
            profile.trackDeckTopLocalY + 0.18,
            trackCentre + railOffset + bow,
          ],
          [7.6, 0.5, 0.7],
          BLOCK.iron,
        );
      }
    }
    for (const side of [-1, 1]) {
      for (let course = 0; course < 2; course += 1) {
        const y =
          profile.publicFloorTopLocalY +
          eastWestWallCourseHeight * (course + 0.5);
        pushLocalBlock(
          plan,
          frame,
          "two-course east-west side glazing",
          [x, y, bow + side * 19.2],
          [7.6, eastWestWallCourseHeight, 1.4],
          (Math.round(x / 8) + course + side) % 4 === 0
            ? BLOCK.iron
            : BLOCK.iceGlass,
        );
      }
    }
  }

  const northSouthWallTopY =
    northSouth.baseY +
    northSouth.riseM * Math.sqrt(1 - (18 / (northSouth.widthM / 2)) ** 2) -
    0.85;
  const northSouthWallCourseHeight =
    (northSouthWallTopY - profile.publicFloorTopLocalY) / 2;
  for (let z = -88; z <= 88; z += 8) {
    for (let x = -16; x <= 16; x += 8) {
      const cross = x / (northSouth.widthM / 2);
      const y = Math.round(
        northSouth.baseY +
          northSouth.riseM * Math.sqrt(Math.max(0, 1 - cross * cross)),
      );
      const index = Math.round((z + 88) / 8) + Math.round((x + 16) / 8) * 23;
      pushLocalBlock(
        plan,
        frame,
        "coarse 180 m north-south crossing hall",
        [x, y, z],
        [7.6, 2.4, 7.6],
        index % 113 === 0
          ? BLOCK.lapis
          : index % 4 === 0
            ? BLOCK.iron
            : BLOCK.tealGlass,
      );
      pushLocalBlock(
        plan,
        frame,
        "coarse north-south station floor",
        [x, profile.publicFloorTopLocalY - 0.6, z],
        [8, 1.2, 8],
        index % 5 === 0 ? BLOCK.marbleShadow : BLOCK.limestone,
      );
    }
    // Longitudinal glass walls make the north-south crossing a real hall
    // rather than a floating roof between the two office bridges.
    for (const side of [-1, 1]) {
      for (let course = 0; course < 2; course += 1) {
        const y =
          profile.publicFloorTopLocalY +
          northSouthWallCourseHeight * (course + 0.5);
        pushLocalBlock(
          plan,
          frame,
          "two-course north-south side glazing",
          [side * 19.2, y, z],
          [1.4, northSouthWallCourseHeight, 7.6],
          (Math.round(z / 8) + course + side) % 4 === 0
            ? BLOCK.iron
            : BLOCK.tealGlass,
        );
      }
    }
  }
  // Exact eight-metre floor cells meet at the crossing boundary. No narrow
  // coplanar seam boxes are needed, so no second colour can fight that top.
  for (const zSide of [-1, 1]) {
    for (let x = -16; x <= 16; x += 8) {
      const cross = x / (northSouth.widthM / 2);
      const roofY =
        northSouth.baseY +
        northSouth.riseM * Math.sqrt(Math.max(0, 1 - cross * cross));
      for (let y = 4; y <= roofY - 2; y += 6) {
        // Both Washingtonplatz and Europaplatz retain a broad, genuinely
        // open central entry below the glass gable.
        if (Math.abs(x) <= 6 && y <= 7) continue;
        pushLocalBlock(
          plan,
          frame,
          "stepped north-south block portals",
          [x, y, zSide * 89.1],
          [7.4, 5.6, 1.4],
          (Math.round(x / 8) + Math.round(y / 6) + zSide) % 4 === 0
            ? BLOCK.iron
            : BLOCK.tealGlass,
        );
      }
    }
  }
  // The 321 m hall also terminates in two stepped glass gables. Their lower
  // central bays remain open instead of becoming decorative opaque screens.
  for (const xSide of [-1, 1]) {
    for (let z = -16; z <= 16; z += 8) {
      const roofY =
        eastWest.baseY +
        eastWest.riseM *
          Math.sqrt(Math.max(0, 1 - (z / (eastWest.widthM / 2)) ** 2));
      for (let y = 4; y <= roofY - 2; y += 6) {
        if (Math.abs(z) <= 14 && y <= 11) continue;
        pushLocalBlock(
          plan,
          frame,
          "stepped east-west block gables",
          [xSide * 160.6, y, z + coarseBowAt(xSide * 160.6)],
          [1.4, 5.6, 7.4],
          (Math.round(z / 8) + Math.round(y / 6) + xSide) % 4 === 0
            ? BLOCK.iron
            : BLOCK.iceGlass,
          hauptbahnhofEastWestTangentRotationAt(xSide * 160.6),
        );
      }
    }
  }

  // Two 46 m office bridges use twelve-metre bays and six broad vertical
  // courses. They remain recognisable towers, not detailed glass facsimiles.
  for (const bridgeX of [-35, 35]) {
    for (const xSide of [-1, 1]) {
      const facadeBayCount = 15;
      const facadeBayLength = 180 / facadeBayCount;
      for (let bay = 0; bay < facadeBayCount; bay += 1) {
        const z = -90 + facadeBayLength * (bay + 0.5);
        const slopeDirection = bridgeX < 0 ? -1 : 1;
        const roofTopY = 43.2 + slopeDirection * xSide * 8 * 0.35;
        const wallBottomY = 1.425;
        const wallTopY = roofTopY - 0.9;
        const courses = Math.ceil((wallTopY - wallBottomY) / 8.001);
        const courseHeight = (wallTopY - wallBottomY) / courses;
        for (let course = 0; course < courses; course += 1) {
          const y = wallBottomY + courseHeight * (course + 0.5);
          const index = bay + course;
          pushLocalBlock(
            plan,
            frame,
            "coarse twin 46 m office bridges",
            [bridgeX + xSide * 9.7, y, z],
            [1.2, courseHeight, facadeBayLength],
            index % 149 === 0
              ? BLOCK.lapis
              : index % 3 === 0
                ? BLOCK.iron
                : BLOCK.tealGlass,
          );
        }
      }
    }
    for (let x = -8; x <= 8; x += 8) {
      for (const zSide of [-1, 1]) {
        const slopeDirection = bridgeX < 0 ? -1 : 1;
        const roofTopY = 43.2 + slopeDirection * x * 0.35;
        const wallBottomY = 1.425;
        const wallTopY = roofTopY - 0.9;
        const courses = Math.ceil((wallTopY - wallBottomY) / 8.001);
        const courseHeight = (wallTopY - wallBottomY) / courses;
        for (let course = 0; course < courses; course += 1) {
          const y = wallBottomY + courseHeight * (course + 0.5);
          const courseBottom = y - courseHeight / 2;
          const courseTop = y + courseHeight / 2;
          const isEntranceBay =
            Math.abs(x) <= profile.officeEntrances.clearHalfWidthM;
          if (
            isEntranceBay &&
            courseBottom < profile.officeEntrances.clearHeightM
          ) {
            if (courseTop <= profile.officeEntrances.clearHeightM) continue;
          }
          const blockBottom = isEntranceBay
            ? Math.max(courseBottom, profile.officeEntrances.clearHeightM)
            : courseBottom;
          const blockHeight = courseTop - blockBottom;
          pushLocalBlock(
            plan,
            frame,
            "coarse office-bridge portal frames",
            [bridgeX + x, blockBottom + blockHeight / 2, zSide * 90.4],
            [7.4, blockHeight, 0.8],
            (Math.round(x) * 3 + course * 5) % 97 === 0
              ? BLOCK.lapis
              : BLOCK.iron,
          );
        }
      }
    }
    for (let z = -88; z <= 88; z += 8) {
      pushLocalBlock(
        plan,
        frame,
        "coarse office-bridge ground deck",
        [bridgeX, 0.75, z],
        [19.5, 1.35, 7.6],
        Math.round(z / 8) % 2 === 0 ? BLOCK.limestone : BLOCK.marbleShadow,
      );
      for (const xOffset of [-8, 0, 8]) {
        const slopeDirection = bridgeX < 0 ? -1 : 1;
        const roofTopY = 43.2 + slopeDirection * xOffset * 0.35;
        pushLocalBlock(
          plan,
          frame,
          "three-wide office-bridge crowns",
          [bridgeX + xOffset, roofTopY - 0.45, z],
          [7.4, 1.2, 7.6],
          Math.abs(xOffset) === 8 ? BLOCK.silver : BLOCK.iron,
        );
      }
    }
    for (let z = -88; z <= 88; z += 16) {
      for (const y of [8, 16, 24, 32, 40]) {
        for (const side of [-1, 1]) {
          pushLocalBlock(
            plan,
            frame,
            "five coarse office floor bands",
            [bridgeX + side * 9.45, y, z],
            [0.85, 0.8, 7.6],
            BLOCK.iron,
          );
        }
      }
    }
  }
  // A restrained block DB badge on the Europaplatz end.
  for (const y of [10.5, 13.5]) {
    pushLocalBlock(
      plan,
      frame,
      "DB red entrance badge",
      [0, y, -91.2],
      [6, 3, 1.2],
      BLOCK.red,
    );
  }
  pushLocalBlock(
    plan,
    frame,
    "DB pale badge centre",
    [0, 12, -91.9],
    [3.8, 2, 0.8],
    BLOCK.marbleLight,
  );

  return finishPlan(
    "Minecraft Berlin Hauptbahnhof block signature",
    "berlin-hauptbahnhof",
    plan,
    profile,
    resources,
  );
}

function createBrandenburgGateBlocks(
  resources: BlockRenderResources,
): InstancedMesh {
  const profile = MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate;
  const frame: LocalFrame = profile;
  const plan = newPlan();
  const mainBodyWidth = 33.2;
  const passageWidths = [3.8, 3.8, 5.65, 3.8, 3.8] as const;
  const columnDiameter = 1.73;
  const spacings = passageWidths.map((width) => width + columnDiameter);
  const span = spacings.reduce((sum, value) => sum + value, 0);
  const axes = [-span / 2];
  for (const spacing of spacings) axes.push((axes.at(-1) ?? 0) + spacing);

  for (const localX of [-4.25, 4.25]) {
    for (const localZ of axes) {
      for (let layer = 0; layer < 3; layer += 1) {
        pushLocalBlock(
          plan,
          frame,
          "twelve three-course Doric columns",
          [localX, 2.4 + layer * 4.7, localZ],
          [2.8, 4.4, 2.8],
          layer % 2 === 0 ? BLOCK.quartzIvory : BLOCK.limestone,
        );
      }
      pushLocalBlock(
        plan,
        frame,
        "Doric block capitals",
        [localX, profile.columnHeightM + 0.1, localZ],
        [2.8, 0.9, 2.8],
        BLOCK.marbleLight,
      );
    }
  }
  for (const [cue, y, height, width, color] of [
    ["entablature", 14.5, 1.5, mainBodyWidth, BLOCK.quartzIvory],
    ["upper lintel", 16, 1.4, mainBodyWidth + 0.5, BLOCK.limestone],
    ["attic", 18.2, 2.4, mainBodyWidth - 0.2, BLOCK.quartzIvory],
    ["Quadriga plinth", 20, 1.3, 14.8, BLOCK.marbleLight],
  ] as const) {
    pushLocalBlock(
      plan,
      frame,
      cue,
      [0, y, 0],
      [profile.depthM, height, width],
      color,
    );
  }

  const pavilionWidth = (profile.widthM - mainBodyWidth) / 2;
  for (const side of [-1, 1]) {
    const centreZ = side * (profile.widthM / 2 - pavilionWidth / 2);
    for (const y of [2.8, 7.2]) {
      for (const x of [-3.5, 3.5]) {
        pushLocalBlock(
          plan,
          frame,
          "two coarse sandstone side pavilions",
          [x, y, centreZ],
          [6.4, 4.1, pavilionWidth - 0.6],
          (Math.round(y + x) + side) % 2 === 0
            ? BLOCK.quartzIvory
            : BLOCK.limestone,
        );
      }
    }
    for (let roof = 0; roof < 2; roof += 1) {
      pushLocalBlock(
        plan,
        frame,
        "two-step pavilion roofs",
        [0, 9 + roof * 1.1, centreZ],
        [profile.depthM - roof * 2.4, 1, pavilionWidth - roof * 3.2],
        BLOCK.oxidisedCopper,
      );
    }
  }

  // Restrained Quadriga: a block chariot, four horses and Victoria read as a
  // silhouette; no smooth animals or fantasy jewel decoration survive here.
  pushLocalBlock(
    plan,
    frame,
    "block Quadriga chariot",
    [0, 21.7, 0],
    [4.8, 2, 6.5],
    BLOCK.oxidisedCopper,
  );
  for (const z of [-4.5, -1.5, 1.5, 4.5]) {
    pushLocalBlock(
      plan,
      frame,
      "four Quadriga horse bodies",
      [-1.8, 23.2, z],
      [4, 2, 2],
      BLOCK.oxidisedCopper,
    );
    pushLocalBlock(
      plan,
      frame,
      "four Quadriga horse heads",
      [-3.5, 24.3, z],
      [1.6, 1.6, 1.6],
      BLOCK.oxidisedCopper,
    );
    for (const legX of [-1.2, 0.6]) {
      pushLocalBlock(
        plan,
        frame,
        "Quadriga horse legs",
        [legX, 21.8, z],
        [0.8, 2.4, 0.8],
        BLOCK.oxidisedCopper,
      );
    }
  }
  pushLocalBlock(
    plan,
    frame,
    "Quadriga Victoria",
    [1.5, 24, 0],
    [1.8, 4, 1.8],
    BLOCK.oxidisedCopper,
  );
  for (const side of [-1, 1]) {
    pushLocalBlock(
      plan,
      frame,
      "Quadriga wings",
      [1.4, 24.8, side * 1.8],
      [1.1, 3, 2.4],
      BLOCK.oxidisedCopper,
    );
  }

  return finishPlan(
    "Minecraft Brandenburg Gate block signature",
    "brandenburger-tor",
    plan,
    profile,
    resources,
  );
}

function pushRing(
  plan: BlockPlan,
  cue: string,
  centre: Point2,
  y: number,
  radius: number,
  segments: number,
  size: Point3,
  row: number,
): void {
  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    pushWorldBlock(
      plan,
      cue,
      [
        centre[0] + Math.cos(angle) * radius,
        y,
        centre[1] + Math.sin(angle) * radius,
      ],
      size,
      (segment + row) % 7 === 0 ? BLOCK.iron : BLOCK.iceGlass,
    );
  }
}

function pushHalfRing(
  plan: BlockPlan,
  cue: string,
  centre: Point2,
  y: number,
  radius: number,
  outwardZ: number,
  segments: number,
  size: Point3,
  row: number,
): void {
  const startAngle = outwardZ > 0 ? 0 : Math.PI;
  for (let segment = 0; segment < segments; segment += 1) {
    const angle = startAngle + (segment / (segments - 1)) * Math.PI;
    pushWorldBlock(
      plan,
      cue,
      [
        centre[0] + Math.cos(angle) * radius,
        y,
        centre[1] + Math.sin(angle) * radius,
      ],
      size,
      (segment + row) % 7 === 0 ? BLOCK.iron : BLOCK.iceGlass,
    );
  }
}

function pushParliamentBridges(plan: BlockPlan): void {
  const lower = BUNDESTAG_SPREE_CONNECTION_PROFILE.lowerBridge;
  const upper = BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge;
  const addCourse = (
    cue: string,
    start: Point2,
    end: Point2,
    y: number,
    width: number,
    color: number,
    segments: number,
    sagitta = 0,
  ): void => {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const normalX = -dz / length;
    const normalZ = dx / length;
    const at = (t: number): Point2 => {
      const bow = sagitta * 4 * t * (1 - t);
      return [
        start[0] + dx * t + normalX * bow,
        start[1] + dz * t + normalZ * bow,
      ];
    };
    for (let index = 0; index < segments; index += 1) {
      const a = at(index / segments);
      const b = at((index + 1) / segments);
      const segmentLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
      pushWorldBlock(
        plan,
        cue,
        [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
        [Math.max(0.1, segmentLength - (sagitta === 0 ? 0 : 0.04)), 0.8, width],
        color,
        Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      );
    }
  };
  addCourse(
    "lower public bridge deck",
    lower.centrelineWorld[0],
    lower.centrelineWorld[1],
    lower.deckY - 0.35,
    lower.widthM,
    BLOCK.quartzIvory,
    13,
    lower.curveSagittaM,
  );
  // Thirteen deck-sized handrail blocks preserve the open public crossing.
  for (const side of [-1, 1]) {
    const [start, end] = lower.centrelineWorld;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const chord = Math.hypot(dx, dz);
    const nx = -dz / chord;
    const nz = dx / chord;
    const at = (t: number): Point2 => {
      const bow = lower.curveSagittaM * 4 * t * (1 - t);
      return [
        start[0] + dx * t + nx * (bow + side * (lower.widthM / 2 - 0.25)),
        start[1] + dz * t + nz * (bow + side * (lower.widthM / 2 - 0.25)),
      ];
    };
    for (let index = 0; index < 13; index += 1) {
      const a = at(index / 13);
      const b = at((index + 1) / 13);
      pushWorldBlock(
        plan,
        "lower public bridge block handrails",
        [(a[0] + b[0]) / 2, lower.deckY + 1.05, (a[1] + b[1]) / 2],
        [
          Math.max(0.1, Math.hypot(b[0] - a[0], b[1] - a[1]) - 0.04),
          0.55,
          0.45,
        ],
        BLOCK.iron,
        Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      );
    }
  }
  addCourse(
    "upper parliamentary bridge deck",
    upper.centrelineWorld[0],
    upper.centrelineWorld[1],
    upper.deckY - 0.35,
    upper.widthM,
    BLOCK.marbleLight,
    upper.frameBayCount,
  );
  addCourse(
    "upper parliamentary bridge roof",
    upper.centrelineWorld[0],
    upper.centrelineWorld[1],
    upper.roofY,
    upper.widthM,
    BLOCK.iron,
    upper.frameBayCount,
  );

  const [upperStart, upperEnd] = upper.centrelineWorld;
  for (let index = 0; index <= upper.frameBayCount; index += 1) {
    const t = index / upper.frameBayCount;
    const x = upperStart[0] + (upperEnd[0] - upperStart[0]) * t;
    const z = upperStart[1] + (upperEnd[1] - upperStart[1]) * t;
    for (const side of [-1, 1]) {
      const length = Math.hypot(
        upperEnd[0] - upperStart[0],
        upperEnd[1] - upperStart[1],
      );
      const nx = -(upperEnd[1] - upperStart[1]) / length;
      const nz = (upperEnd[0] - upperStart[0]) / length;
      pushWorldBlock(
        plan,
        "upper bridge open frame posts",
        [
          x + nx * side * 1.25,
          (upper.deckY + upper.roofY) / 2,
          z + nz * side * 1.25,
        ],
        [0.65, upper.roofY - upper.deckY - 0.4, 0.65],
        BLOCK.iron,
      );
    }
  }
  // One central tie per bay hints at the upper bridge frame without drawing
  // a near-engineering replica.
  for (let bay = 0; bay < upper.frameBayCount; bay += 1) {
    for (const side of [-1, 1]) {
      const t = (bay + 0.5) / upper.frameBayCount;
      const x = upperStart[0] + (upperEnd[0] - upperStart[0]) * t;
      const z = upperStart[1] + (upperEnd[1] - upperStart[1]) * t;
      const length = Math.hypot(
        upperEnd[0] - upperStart[0],
        upperEnd[1] - upperStart[1],
      );
      const nx = -(upperEnd[1] - upperStart[1]) / length;
      const nz = (upperEnd[0] - upperStart[0]) / length;
      pushWorldBlock(
        plan,
        "upper bridge single block ties",
        [
          x + nx * side * 1.25,
          (upper.deckY + upper.roofY) / 2,
          z + nz * side * 1.25,
        ],
        [0.9, 0.9, 0.9],
        BLOCK.iron,
      );
    }
  }
}

function createParliamentaryBandBlocks(
  resources: BlockRenderResources,
): InstancedMesh {
  const plan = newPlan();
  const paul = MINECRAFT_ARCHITECTURAL_PROFILES.paulLoebeHaus;
  const canopy = paul.canopy;
  const outerX = canopy.westFaceX - canopy.reachM;
  for (let z = -48; z <= 48; z += 8) {
    pushWorldBlock(
      plan,
      "Paul-Löbe cantilevered west canopy",
      [canopy.westFaceX - canopy.reachM / 2, canopy.topY, canopy.centreZ + z],
      [canopy.reachM, 1.2, 7.6],
      z % 16 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
    );
  }
  for (let column = 0; column < canopy.columnCount; column += 1) {
    const z =
      canopy.centreZ -
      canopy.spanZ / 2 +
      3.2 +
      ((canopy.spanZ - 6.4) * column) / (canopy.columnCount - 1);
    for (const y of [8, 14, 20, 26]) {
      pushWorldBlock(
        plan,
        "Paul-Löbe thirteen canopy columns",
        [outerX + 1.1, y, z],
        [2.2, 5.5, 2.2],
        BLOCK.iron,
      );
    }
  }
  for (let z = -48; z <= 48; z += 8) {
    for (const y of [8, 14, 20, 26]) {
      pushWorldBlock(
        plan,
        "coarse Paul-Löbe west glass grid",
        [canopy.westFaceX - 2.8, y, canopy.centreZ + z],
        [1.4, 5.2, 7.2],
        (Math.round(z / 8) + Math.round(y / 6)) % 17 === 0
          ? BLOCK.lapis
          : BLOCK.tealGlass,
      );
    }
  }
  for (const rotunda of paul.committeeRotundas) {
    const centre = rotunda.centreWorld;
    const [chordStart, chordEnd] = rotunda.chordWorld;
    const chordDx = chordEnd[0] - chordStart[0];
    const chordDz = chordEnd[1] - chordStart[1];
    const chordLength = Math.hypot(chordDx, chordDz);
    const chordRotation = Math.atan2(-chordDz, chordDx);
    const normalX = (rotunda.outwardZ * -chordDz) / chordLength;
    const normalZ = (rotunda.outwardZ * chordDx) / chordLength;
    // The flat rear chord is inset by one coarse mortar joint so its top
    // meets the axis-aligned half-ring visually without sharing any area.
    const chordInsetM = 2.65;
    for (let row = 0; row < 4; row += 1) {
      const rowY = paul.rotundaBaseY + 3 + row * 6;
      pushHalfRing(
        plan,
        "eight coarse Paul-Löbe committee rotundas",
        centre,
        rowY,
        rotunda.radiusM,
        rotunda.outwardZ,
        6,
        [5, 5.6, 2.8],
        row,
      );
      pushWorldBlock(
        plan,
        "eight coarse Paul-Löbe chord walls",
        [
          (chordStart[0] + chordEnd[0]) / 2 - normalX * chordInsetM,
          rowY,
          (chordStart[1] + chordEnd[1]) / 2 - normalZ * chordInsetM,
        ],
        [chordLength, 5.6, 1.8],
        row % 4 === 0 ? BLOCK.iron : BLOCK.tealGlass,
        chordRotation,
      );
    }
    for (let xOffset = -8; xOffset <= 8; xOffset += 8) {
      for (let zOffset = -8; zOffset <= 8; zOffset += 8) {
        const outwardDistance = xOffset * normalX + zOffset * normalZ;
        if (
          outwardDistance < -0.1 ||
          Math.hypot(xOffset, zOffset) > rotunda.radiusM - 1.2
        ) {
          continue;
        }
        pushWorldBlock(
          plan,
          "eight coarse Paul-Löbe roof caps",
          [
            centre[0] + xOffset,
            paul.rotundaBaseY + paul.rotundaHeightM - 0.45,
            centre[1] + zOffset,
          ],
          [7.6, 1.2, 7.6],
          (xOffset + zOffset) % 16 === 0 ? BLOCK.marbleLight : BLOCK.silver,
        );
      }
    }
  }

  const melh = MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus;
  const melhRowHeight = melh.rotunda.heightM / 6;
  for (let row = 0; row < 6; row += 1) {
    pushRing(
      plan,
      "six-course Lüders-Haus library rotunda",
      melh.rotunda.centreWorld,
      melh.rotunda.baseY + (row + 0.5) * melhRowHeight,
      melh.rotunda.radiusM,
      12,
      [5.6, melhRowHeight - 0.18, 3],
      row,
    );
  }
  for (let xOffset = -16; xOffset <= 16; xOffset += 8) {
    for (let zOffset = -16; zOffset <= 16; zOffset += 8) {
      if (Math.hypot(xOffset, zOffset) > melh.rotunda.radiusM - 1.1) {
        continue;
      }
      pushWorldBlock(
        plan,
        "coarse Lüders-Haus rotunda roof cap",
        [
          melh.rotunda.centreWorld[0] + xOffset,
          melh.rotunda.baseY + melh.rotunda.heightM - 0.45,
          melh.rotunda.centreWorld[1] + zOffset,
        ],
        [7.6, 1.2, 7.6],
        (xOffset + zOffset) % 16 === 0 ? BLOCK.marbleLight : BLOCK.silver,
      );
    }
  }
  const circular = melh.facade.circularFacade;
  const circularCentreY = circular.bottomY + circular.heightM / 2;
  for (let step = 0; step < 16; step += 1) {
    const angle = (step / 16) * Math.PI * 2;
    pushWorldBlock(
      plan,
      "sixteen-block Lüders-Haus Spree opening",
      [
        circular.centreWorld[0] - 0.9,
        circularCentreY + Math.sin(angle) * circular.openingRadiusM,
        circular.centreWorld[1] + Math.cos(angle) * circular.openingRadiusM,
      ],
      [2.2, 3.2, 3.2],
      step % 4 === 0 ? BLOCK.marbleLight : BLOCK.iron,
    );
  }
  // The circular cut-out keeps its turquoise inner curtain wall and silver
  // mullion rhythm after the smooth facade is hidden in Minecraft.
  for (let yOffset = -8; yOffset <= 8; yOffset += 8) {
    const halfChord = Math.sqrt(
      Math.max(0, circular.openingRadiusM ** 2 - yOffset ** 2),
    );
    for (
      let zOffset = -halfChord + 3.4;
      zOffset <= halfChord - 3.4;
      zOffset += 6.8
    ) {
      const mullion = Math.round((zOffset + halfChord) / 6.8) % 4 === 0;
      pushWorldBlock(
        plan,
        mullion
          ? "coarse Lüders-Haus silver mullions"
          : "coarse Lüders-Haus inner glazing",
        [
          circular.centreWorld[0] - 2.05,
          circularCentreY + yOffset,
          circular.centreWorld[1] + zOffset,
        ],
        [1.2, 6.4, 6.2],
        mullion ? BLOCK.silver : BLOCK.tealGlass,
      );
    }
  }
  for (let x = 360; x <= 408; x += 8) {
    for (let z = -176; z <= -120; z += 8) {
      pushWorldBlock(
        plan,
        "coarse Lüders-Haus block canopy",
        [x, melh.facade.canopy.topY, z],
        [7.6, 1.2, 7.6],
        (x + z) % 16 === 0 ? BLOCK.marbleLight : BLOCK.marbleShadow,
      );
    }
  }
  for (const [x, z] of melh.facade.canopy.supportsWorld) {
    for (const y of [7, 13, 19, 25]) {
      pushWorldBlock(
        plan,
        "Lüders-Haus canopy supports",
        [x, y, z],
        [2, 5.5, 2],
        BLOCK.iron,
      );
    }
  }
  const stair = melh.facade.stair;
  const [stairStart, stairEnd] = stair.centrelineWorld;
  const stairDx = stairEnd[0] - stairStart[0];
  const stairDz = stairEnd[1] - stairStart[1];
  const stairLength = Math.hypot(stairDx, stairDz);
  const stairRotation = Math.atan2(-stairDz, stairDx);
  const stairSteps = 8;
  for (let step = 0; step < stairSteps; step += 1) {
    const t = (step + 0.5) / stairSteps;
    const surfaceY =
      stair.bottomY + (stair.topY - stair.bottomY) * ((step + 1) / stairSteps);
    const width =
      stair.widthBottomM + (stair.widthTopM - stair.widthBottomM) * t;
    const stackHeight = surfaceY - stair.bottomY;
    const verticalCourses = Math.ceil(stackHeight / 8.001);
    const courseHeight = stackHeight / verticalCourses;
    for (let course = 0; course < verticalCourses; course += 1) {
      pushWorldBlock(
        plan,
        "eight-step Lüders-Haus widening stair",
        [
          stairStart[0] + stairDx * t,
          stair.bottomY + courseHeight * (course + 0.5),
          stairStart[1] + stairDz * t,
        ],
        [stairLength / stairSteps + 0.15, courseHeight, width],
        step % 2 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
        stairRotation,
      );
    }
  }

  pushParliamentBridges(plan);
  return finishPlan(
    "Minecraft parliamentary band block signature",
    "parliamentary-band",
    plan,
    {
      bridges: BUNDESTAG_SPREE_CONNECTION_PROFILE,
      marieElisabethLuedersHaus: melh,
      paulLoebeHaus: paul,
    },
    resources,
  );
}

function createBerlinerEnsembleBlocks(
  resources: BlockRenderResources,
): InstancedMesh {
  const profile = MINECRAFT_ARCHITECTURAL_PROFILES.berlinerEnsemble;
  const towerFrame: LocalFrame = profile.towerFrame;
  const signFrame: LocalFrame = profile.signFrame;
  const plan = newPlan();
  const baseY = profile.blockLoD.roofStageBaseY - towerFrame.anchorWorld[1];

  // The measured LoD2 voxel body ends at this source-bound roof stage. Only
  // the characteristic truncated tower cap and sign rise above it here, so
  // no smooth theatre shell, TorusGeometry or textured lettering survives in
  // Minecraft mode.
  for (let course = 0; course < 3; course += 1) {
    const width = profile.blockLoD.towerWidthM / 3;
    for (let segment = 0; segment < 3; segment += 1) {
      pushLocalBlock(
        plan,
        towerFrame,
        "Berliner Ensemble taupe roof tower",
        [
          -profile.blockLoD.towerWidthM / 2 + width * (segment + 0.5),
          baseY + 0.7 + course * 1.4,
          0,
        ],
        [width, 1.34, profile.blockLoD.towerDepthM],
        course % 2 === 0 ? BLOCK.limestone : BLOCK.quartzIvory,
      );
    }
  }
  for (const localX of [-2.7, 0, 2.7]) {
    pushLocalBlock(
      plan,
      towerFrame,
      "Berliner Ensemble tower opening",
      [localX, baseY + 2.25, profile.blockLoD.towerDepthM / 2 - 0.25],
      [1.05, 2.25, 0.46],
      BLOCK.deepRecess,
    );
  }

  const roofCourses = [
    [profile.blockLoD.towerWidthM, profile.blockLoD.towerDepthM, 0.76],
    [
      profile.blockLoD.towerWidthM * 0.8,
      profile.blockLoD.towerDepthM * 0.8,
      0.76,
    ],
    [
      profile.blockLoD.towerWidthM * 0.6,
      profile.blockLoD.towerDepthM * 0.6,
      0.76,
    ],
    [
      profile.blockLoD.towerWidthM * 0.4,
      profile.blockLoD.towerDepthM * 0.4,
      0.76,
    ],
  ] as const;
  for (const [index, [width, depth, height]] of roofCourses.entries()) {
    const segments = [3, 2, 2, 1][index];
    const segmentWidth = width / segments;
    for (let segment = 0; segment < segments; segment += 1) {
      pushLocalBlock(
        plan,
        towerFrame,
        "Berliner Ensemble stepped hipped roof",
        [
          -width / 2 + segmentWidth * (segment + 0.5),
          baseY + 4.2 + height / 2 + index * height,
          0,
        ],
        [segmentWidth, height, depth],
        index % 2 === 0 ? BLOCK.oxidisedCopper : BLOCK.iron,
      );
    }
  }

  const centreY = profile.blockLoD.signCentreY - signFrame.anchorWorld[1];
  const radius = profile.blockLoD.signDiameterM / 2;
  const roofTop = profile.blockLoD.roofStageTopY - signFrame.anchorWorld[1];
  const supportHeight = Math.max(1, centreY - radius - roofTop + 0.55);
  for (const localX of [-radius * 0.48, radius * 0.48]) {
    pushLocalBlock(
      plan,
      signFrame,
      "Berliner Ensemble roof-sign support",
      [localX, roofTop + supportHeight / 2, 0],
      [0.7, supportHeight, 0.7],
      BLOCK.iron,
    );
  }
  for (let segment = 0; segment < 20; segment += 1) {
    const angle = (segment / 20) * Math.PI * 2;
    pushLocalBlock(
      plan,
      signFrame,
      "Berliner Ensemble open circular sign",
      [Math.cos(angle) * radius, centreY + Math.sin(angle) * radius, 0],
      [0.54, 0.54, 0.54],
      BLOCK.red,
    );
  }
  for (const [line, localY] of [
    ["upper", centreY + 0.54],
    ["lower", centreY - 0.48],
  ] as const) {
    for (const localX of [-1.65, -1.1, -0.55, 0, 0.55, 1.1, 1.65]) {
      pushLocalBlock(
        plan,
        signFrame,
        `Berliner Ensemble ${line} lettering cue`,
        [localX, localY, 0.18],
        [0.42, 0.46, 0.36],
        BLOCK.quartzIvory,
      );
    }
  }

  const mesh = finishPlan(
    "Minecraft Berliner Ensemble block signature",
    "berliner-ensemble",
    plan,
    profile,
    resources,
  );
  const rotatingCues = new Set([
    "Berliner Ensemble open circular sign",
    "Berliner Ensemble upper lettering cue",
    "Berliner Ensemble lower lettering cue",
  ]);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.userData[BERLINER_ENSEMBLE_ROOF_SIGN_INSTANCES_MARKER] = true;
  mesh.userData.centreWorld = [
    signFrame.anchorWorld[0],
    profile.blockLoD.signCentreY,
    signFrame.anchorWorld[2],
  ];
  mesh.userData.rotationCentreWorld = [
    signFrame.anchorWorld[0],
    signFrame.anchorWorld[2],
  ];
  mesh.userData.rotatingInstances = plan.blocks.flatMap(
    ({ cue, position, rotationY, size }, index) =>
      rotatingCues.has(cue)
        ? [{ index, position: [...position], rotationY, size: [...size] }]
        : [],
  );
  mesh.userData.boundedAnimatedInstances =
    mesh.userData.rotatingInstances.length;
  mesh.userData.staticAntiFlicker = false;
  mesh.userData.sourceBoundBlocks = plan.blocks.map(
    ({ cue, position, rotationY, size }) => ({
      cue,
      position,
      rotationY,
      size,
    }),
  );
  mesh.userData.sourceBoundTowerRoofBlocks = plan.blocks
    .filter(
      ({ cue }) =>
        cue === "Berliner Ensemble taupe roof tower" ||
        cue === "Berliner Ensemble tower opening" ||
        cue === "Berliner Ensemble stepped hipped roof",
    )
    .map(({ cue, position, rotationY, size }) => ({
      cue,
      position,
      rotationY,
      size,
    }));
  return mesh;
}

/**
 * One deliberately coarse Pariser-Platz batch: Hotel Adlon's source-bound
 * north frontage plus the Starbucks tenant fronts and office registers around the
 * south-west corner of LoD2 body K00005Hq. The measured voxel masses stay in
 * place behind these shallow overlays; this batch only supplies recognition
 * cues which those unusually plain source columns cannot carry.
 */
function createPariserPlatzBlocks(
  resources: BlockRenderResources,
): InstancedMesh {
  const adlon = MINECRAFT_ARCHITECTURAL_PROFILES.hotelAdlon;
  const starbucks = MINECRAFT_ARCHITECTURAL_PROFILES.starbucksPariserPlatz;
  const plan = newPlan();
  const adlonFrame: LocalFrame = {
    anchorWorld: [
      adlon.front.centerWorldM[0],
      adlon.heights.groundWorldY,
      adlon.front.centerWorldM[1],
    ],
    // The mathematical x/z bearing is -5.07 degrees. Three.js local +x uses
    // the opposite yaw sign, which the shared source profile records here.
    rotationDegrees: (adlon.front.rotationY * 180) / Math.PI,
  };
  const facadeLength = adlon.front.lengthM;
  const eavesLocalY = adlon.heights.eavesWorldY - adlon.heights.groundWorldY;
  const ridgeLocalY = adlon.heights.ridgeWorldY - adlon.heights.groundWorldY;

  // Five broad stone courses retain a visible brick grammar even before a
  // window row resolves. Every box is at most eight metres high and every
  // long course is automatically split into the shared eight-metre span.
  for (const [index, [centreY, height]] of [
    [3.6, 7.2],
    [9.05, 3.6],
    [12.7, 3.6],
    [16.35, 3.6],
    [20.275, 4.25],
  ].entries()) {
    pushLocalBlock(
      plan,
      adlonFrame,
      "Hotel Adlon pale stone facade courses",
      [0, centreY, 0.2],
      [facadeLength, height, 0.9],
      index % 2 === 0 ? BLOCK.quartzIvory : BLOCK.limestone,
    );
  }

  // K00006ot's measured source shell is only 11.5 m high. Above that exact
  // top, two coarse courses carry the full OSM-bounded front-head depth to
  // the eaves. This keeps the mansard supported in oblique/side views without
  // replacing a single measured source column or filling the first courtyard.
  const upperHeadStartY = adlon.heights.lod2MeasuredHeightM;
  const upperHeadDepth = adlon.publicFacade.frontHeadDepthM - 0.7;
  const upperHeadCentreZ = 0.7 + upperHeadDepth / 2;
  const upperHeadMiddleY = 17;
  for (const [index, [bottomY, topY]] of [
    [upperHeadStartY, upperHeadMiddleY],
    [upperHeadMiddleY, eavesLocalY],
  ].entries()) {
    pushLocalBlock(
      plan,
      adlonFrame,
      "Hotel Adlon supported upper-head block mass",
      [0, (bottomY + topY) / 2, upperHeadCentreZ],
      [facadeLength, topY - bottomY, upperHeadDepth],
      index % 2 === 0 ? BLOCK.limestone : BLOCK.quartzIvory,
    );
  }

  // Five high, stepped ground-floor arches. Their dark fields sit just in
  // front of the retained source mass; pale shoulders and caps keep them from
  // reading as smooth rectangular glazing.
  const archCount = adlon.publicFacade.archBayCount;
  const archSpacing = facadeLength / archCount;
  for (let bay = 0; bay < archCount; bay += 1) {
    const x = -facadeLength / 2 + archSpacing * (bay + 0.5);
    pushLocalBlock(
      plan,
      adlonFrame,
      bay === Math.floor(archCount / 2)
        ? "central Hotel Adlon entrance"
        : "five high ground-floor dark recesses",
      [x, 2.8, -0.58],
      [7.2, 5.2, 0.42],
      bay === Math.floor(archCount / 2) ? BLOCK.tealGlass : BLOCK.deepRecess,
    );
    for (const side of [-1, 1]) {
      pushLocalBlock(
        plan,
        adlonFrame,
        "five high ground-floor block arches",
        [x + side * 3.65, 4.15, -0.56],
        [1.05, 3.0, 0.46],
        BLOCK.marbleLight,
      );
    }
    pushLocalBlock(
      plan,
      adlonFrame,
      "five high ground-floor block arches",
      [x, 5.95, -0.56],
      [5.55, 0.8, 0.5],
      BLOCK.marbleLight,
    );
  }

  // Nine strict axes repeated over five storeys are enough to identify the
  // Adlon rhythm without recreating every smooth window and moulding.
  for (const localY of [8.75, 11.7, 14.65, 17.6, 20.55]) {
    for (const localX of adlon.publicFacade.frontWindowAxesM) {
      pushLocalBlock(
        plan,
        adlonFrame,
        "Hotel Adlon five facade window registers",
        [localX, localY, -0.57],
        [3.15, 1.9, 0.4],
        localY === 8.75 ? BLOCK.tealGlass : BLOCK.iceGlass,
      );
    }
  }
  pushLocalBlock(
    plan,
    adlonFrame,
    "Hotel Adlon block cornice",
    [0, eavesLocalY + 0.4, 0.05],
    [facadeLength + 0.8, 0.8, 1.5],
    BLOCK.marbleLight,
  );

  // The central entrance projects just enough to read from the square: a
  // wine-red block canopy, two square posts and the dark central arch above.
  pushLocalBlock(
    plan,
    adlonFrame,
    "Hotel Adlon wine-red entrance canopy",
    [0, 5.45, -2.05],
    [11.6, 0.65, 3.0],
    BLOCK.red,
  );
  for (const x of [-4.9, 4.9]) {
    pushLocalBlock(
      plan,
      adlonFrame,
      "Hotel Adlon entrance canopy posts",
      [x, 2.55, -3.15],
      [0.65, 5.1, 0.65],
      BLOCK.deepRecess,
    );
  }

  // Four shallow, patina-green courses climb to the source-profile ridge.
  // Alternating two palette tones make the mansard visibly block-built.
  const roofCourses = [
    [eavesLocalY + 1.0, 2.0, facadeLength - 1.8, 8.0, 3.35],
    [eavesLocalY + 2.9, 1.8, facadeLength - 5.0, 6.2, 4.3],
    [eavesLocalY + 4.7, 1.8, facadeLength - 8.0, 4.4, 5.2],
    [ridgeLocalY - 0.6, 1.2, facadeLength - 12.0, 2.8, 6.0],
  ] as const;
  for (const [
    index,
    [centreY, height, width, depth, localZ],
  ] of roofCourses.entries()) {
    pushLocalBlock(
      plan,
      adlonFrame,
      "Hotel Adlon stepped patina-green mansard",
      [0, centreY, localZ],
      [width, height, depth],
      index % 2 === 0 ? BLOCK.oxidisedCopper : MINECRAFT_PALETTE[3],
    );
  }
  for (
    let dormer = 0;
    dormer < adlon.publicFacade.frontDormerCount;
    dormer += 1
  ) {
    const x =
      -facadeLength * 0.39 +
      (dormer / (adlon.publicFacade.frontDormerCount - 1)) *
        facadeLength *
        0.78;
    pushLocalBlock(
      plan,
      adlonFrame,
      "Hotel Adlon eight block dormers",
      [x, eavesLocalY + 3.0, -1.25],
      [3.3, 2.5, 1.6],
      BLOCK.limestone,
    );
    pushLocalBlock(
      plan,
      adlonFrame,
      "Hotel Adlon dormer dark fields",
      [x, eavesLocalY + 2.9, -2.18],
      [1.55, 1.25, 0.24],
      BLOCK.deepRecess,
    );
  }

  // Two restrained five-block rows are the Minecraft equivalent of the
  // HOTEL / ADLON roof wordmark: actual geometry, never a texture.
  for (const [word, localY] of [
    ["HOTEL", ridgeLocalY - 0.9],
    ["ADLON", ridgeLocalY - 1.8],
  ] as const) {
    for (let letter = 0; letter < word.length; letter += 1) {
      pushLocalBlock(
        plan,
        adlonFrame,
        `Hotel Adlon ${word} roof lettering cue`,
        [-2.8 + letter * 1.4, localY, -1.95],
        [0.55, 0.65, 0.34],
        BLOCK.marbleLight,
      );
    }
  }

  const addStarbucksFacade = (
    facade: (typeof starbucks.facades)["west" | "south"],
  ): void => {
    const frame: LocalFrame = {
      anchorWorld: [
        facade.sourceStartWorldM[0],
        starbucks.groundY,
        facade.sourceStartWorldM[1],
      ],
      rotationDegrees: (facade.rotationYRadians * 180) / Math.PI,
    };
    const along = facade.localAlongSign;
    const startDistance = 1.05;
    const span = facade.storefrontLengthM - startDistance;
    const centreDistance = startDistance + span / 2;
    const localCentreX = along * centreDistance;
    pushLocalBlock(
      plan,
      frame,
      `Starbucks ${facade.key} quartz-limestone frontage`,
      [localCentreX, 3.1, 0.35],
      [span, 6.2, 0.8],
      facade.key === "south" ? BLOCK.quartzIvory : BLOCK.limestone,
    );
    pushLocalBlock(
      plan,
      frame,
      `Starbucks ${facade.key} pale block cornice`,
      [localCentreX, 6.45, 0.35],
      [span + 0.35, 0.4, 1.0],
      BLOCK.marbleLight,
    );

    const glassMargin = 1.05;
    const mullionGap = 0.7;
    const paneWidth =
      (facade.storefrontLengthM - glassMargin * 2 - mullionGap) / 2;
    const paneDistances = [
      glassMargin + paneWidth / 2,
      glassMargin + paneWidth + mullionGap + paneWidth / 2,
    ];
    for (const distance of paneDistances) {
      pushLocalBlock(
        plan,
        frame,
        `Starbucks ${facade.key} glass-block fields`,
        [along * distance, 2.12, 1.02],
        [paneWidth, 3.35, 0.34],
        BLOCK.tealGlass,
      );
    }
    for (const distance of [
      glassMargin,
      facade.storefrontLengthM / 2,
      facade.storefrontLengthM - glassMargin,
    ]) {
      pushLocalBlock(
        plan,
        frame,
        `Starbucks ${facade.key} dark block frames`,
        [along * distance, 2.15, 1.18],
        [0.38, 3.9, 0.38],
        BLOCK.deepRecess,
      );
    }
    for (const [localY, height] of [
      [0.35, 0.4],
      [4.08, 0.34],
    ] as const) {
      pushLocalBlock(
        plan,
        frame,
        `Starbucks ${facade.key} dark block frames`,
        [along * (facade.storefrontLengthM / 2), localY, 1.18],
        [facade.storefrontLengthM - glassMargin * 2, height, 0.38],
        BLOCK.deepRecess,
      );
    }

    // Nine grey letter-cubes per facade deliberately echo a word rather than
    // introducing a smooth canvas or a trademark image into Minecraft mode.
    for (let letter = 0; letter < 9; letter += 1) {
      const distance = 2.0 + (letter / 8) * (facade.storefrontLengthM - 4.0);
      pushLocalBlock(
        plan,
        frame,
        "Starbucks two grey block word signs",
        [along * distance, 4.95, 1.05],
        [0.5, 0.68, 0.32],
        BLOCK.iron,
      );
    }

    const upperPitch = facade.buildingFacadeLengthM / facade.upperBayCount;
    for (const y of [6.72, 10.07, 13.42, 16.77, 20.12]) {
      for (let bay = 0; bay < facade.upperBayCount; bay += 1) {
        pushLocalBlock(
          plan,
          frame,
          `Pariser Platz 4a ${facade.key} upper window registers`,
          [along * (bay + 0.5) * upperPitch, y, 0.8],
          [upperPitch * 0.56, 2.65, 0.4],
          BLOCK.deepRecess,
        );
      }
    }
    for (const y of [5.1, 8.45, 11.8, 15.15, 18.5, 21.85, 22.4]) {
      pushLocalBlock(
        plan,
        frame,
        `Pariser Platz 4a ${facade.key} limestone courses`,
        [(along * facade.buildingFacadeLengthM) / 2, y, 0.65],
        [facade.buildingFacadeLengthM, 0.4, 0.6],
        BLOCK.limestone,
      );
    }
    for (let course = 0; course < 3; course += 1) {
      const roofStart = facade.key === "west" ? 0.6 + course * 0.55 : 0.15;
      const roofSpan = facade.buildingFacadeLengthM - 0.15 - roofStart;
      pushLocalBlock(
        plan,
        frame,
        `Pariser Platz 4a ${facade.key} stepped green mansard`,
        [
          along * (roofStart + roofSpan / 2),
          23.4 + course * 1.8,
          1.05 - course * 0.16,
        ],
        [roofSpan, 1.8, 0.65],
        BLOCK.oxidisedCopper,
      );
    }
    for (let dormer = 0; dormer < facade.dormerCount; dormer += 1) {
      const x =
        (along * (dormer + 0.5) * facade.buildingFacadeLengthM) /
        facade.dormerCount;
      pushLocalBlock(
        plan,
        frame,
        `Pariser Platz 4a ${facade.key} block dormers`,
        [x, 25.2, 1.35],
        [1.75, 2.4, 0.8],
        BLOCK.limestone,
      );
      pushLocalBlock(
        plan,
        frame,
        `Pariser Platz 4a ${facade.key} dormer glazing`,
        [x, 25.15, 1.92],
        [1.08, 1.75, 0.35],
        BLOCK.deepRecess,
      );
    }

    // Two freestanding, square black umbrellas on each side of the L. They
    // remain compact visual staffage and do not change pedestrian collision.
    for (const distance of [3.6, facade.storefrontLengthM - 3.2]) {
      pushLocalBlock(
        plan,
        frame,
        "Starbucks black block umbrella poles",
        [along * distance, 1.25, 4.0],
        [0.34, 2.5, 0.34],
        MINECRAFT_PALETTE[0],
      );
      pushLocalBlock(
        plan,
        frame,
        "Starbucks black block umbrella canopies",
        [along * distance, 2.42, 4.0],
        [2.35, 0.34, 2.35],
        MINECRAFT_PALETTE[0],
      );
      pushLocalBlock(
        plan,
        frame,
        "Starbucks black block umbrella canopies",
        [along * distance, 2.75, 4.0],
        [3.15, 0.3, 3.15],
        MINECRAFT_PALETTE[0],
      );
    }
  };
  addStarbucksFacade(starbucks.facades.west);
  addStarbucksFacade(starbucks.facades.south);

  const mesh = finishPlan(
    "Minecraft Hotel Adlon and Starbucks block signature",
    "pariser-platz-adlon-starbucks",
    plan,
    { hotelAdlon: adlon, starbucksPariserPlatz: starbucks },
    resources,
  );
  mesh.userData.sourcePrismIds = [
    adlon.lod2BuildingId,
    starbucks.lod2BuildingId,
  ];
  mesh.userData.retainsGenericSourceMass = true;
  mesh.userData.completeReplacementMask = false;
  mesh.userData.sourceBoundBlocks = plan.blocks.map(
    ({ cue, position, rotationY, size }) => ({
      cue,
      position,
      rotationY,
      size,
    }),
  );
  return mesh;
}

/**
 * Seven lazy, opaque, block-native signature batches. They replace hundreds of
 * smooth hero meshes. The official 4 m LoD2 mass remains the measured body
 * except where a deliberately open signature owns the source cells itself:
 * Reichstag portico, Chancellery leadership cube, Hauptbahnhof and Gate.
 */
export function createMinecraftArchitecturalLandmarks(): Group {
  const group = new Group();
  group.name = "Minecraft block-native architectural landmarks";
  group.userData = {
    blockNative: true,
    coarseBlockSpanM: COARSE_CIVIC_BLOCK_SPAN_M,
    drawCallBudget: 7,
    instanceBudget: 5_000,
    noAdditionalPayload: true,
    sourceStack: "versioned architectural signatures + LoD2 voxel mass + OSM",
    staticAntiFlicker: true,
  };
  const resources: BlockRenderResources = {
    geometry: new BoxGeometry(1, 1, 1),
    material: new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x2b3132,
      emissiveIntensity: 0.14,
      flatShading: true,
      metalness: 0,
      roughness: 0.93,
    }),
  };
  group.add(
    createReichstagBlocks(resources),
    createChancelleryBlocks(resources),
    createHauptbahnhofBlocks(resources),
    createBrandenburgGateBlocks(resources),
    createParliamentaryBandBlocks(resources),
    createBerlinerEnsembleBlocks(resources),
    createPariserPlatzBlocks(resources),
  );
  return group;
}

function worldToLocal(frame: LocalFrame, x: number, z: number): Point2 {
  const radians = (frame.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = x - frame.anchorWorld[0];
  const dz = z - frame.anchorWorld[2];
  return [dx * cosine - dz * sine, dx * sine + dz * cosine];
}

function pointInRing(point: Point2, ring: readonly Point2[]): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [x, z] = ring[index];
    const [previousX, previousZ] = ring[previous];
    if (
      z > point[1] !== previousZ > point[1] &&
      point[0] < ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Exact SAT overlap between one axis-aligned voxel cell and a source frame. */
function voxelCellIntersectsLocalRectangle(
  frame: LocalFrame,
  x: number,
  z: number,
  cellSizeM: number,
  widthM: number,
  depthM: number,
): boolean {
  const [localX, localZ] = worldToLocal(frame, x, z);
  const radians = (frame.rotationDegrees * Math.PI) / 180;
  const absoluteCosine = Math.abs(Math.cos(radians));
  const absoluteSine = Math.abs(Math.sin(radians));
  const cellHalf = cellSizeM / 2;
  const widthHalf = widthM / 2;
  const depthHalf = depthM / 2;
  const worldDx = Math.abs(x - frame.anchorWorld[0]);
  const worldDz = Math.abs(z - frame.anchorWorld[2]);
  return (
    worldDx <=
      cellHalf + widthHalf * absoluteCosine + depthHalf * absoluteSine &&
    worldDz <=
      cellHalf + widthHalf * absoluteSine + depthHalf * absoluteCosine &&
    Math.abs(localX) <=
      widthHalf + cellHalf * (absoluteCosine + absoluteSine) &&
    Math.abs(localZ) <= depthHalf + cellHalf * (absoluteCosine + absoluteSine)
  );
}

export type MinecraftArchitecturalReplacement =
  | "auguste-viktoria-bell"
  | "berlin-hauptbahnhof"
  | "brandenburg-gate"
  | "chancellery-leadership-cube"
  | "litfin-watchtower"
  | "melh-library-rotunda"
  | "melh-widening-stair"
  | "paul-loebe-rotunda"
  | "reichstag-west-portico";

function insideWideningStairReplacement(x: number, z: number): boolean {
  const stair =
    MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus.facade.stair;
  const [start, end] = stair.centrelineWorld;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared;
  if (t < -0.04 || t > 1.15) return false;
  const boundedT = Math.max(0, Math.min(1, t));
  const projectedX = start[0] + dx * boundedT;
  const projectedZ = start[1] + dz * boundedT;
  const width =
    stair.widthBottomM + (stair.widthTopM - stair.widthBottomM) * boundedT;
  return Math.hypot(x - projectedX, z - projectedZ) <= width / 2 + 4.8;
}

function insideHauptbahnhofReplacement(
  localX: number,
  localZ: number,
): boolean {
  const profile = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
  const margin = profile.replacementMarginM;
  const curve = hauptbahnhofEastWestCurveAt(localX);
  if (
    Math.abs(localX) <= profile.eastWestRoof.lengthM / 2 + margin &&
    Math.abs(localZ - curve) <= profile.eastWestRoof.widthM / 2 + margin
  ) {
    return true;
  }
  if (Math.abs(localZ) > profile.northSouthHall.lengthM / 2 + margin) {
    return false;
  }
  if (Math.abs(localX) <= profile.northSouthHall.widthM / 2 + margin) {
    return true;
  }
  return [-35, 35].some(
    (centreX) =>
      Math.abs(localX - centreX) <= profile.officeBridgeWidthM / 2 + margin,
  );
}

/**
 * Exact ownership classifier for the source voxel masses that a complete
 * block-native reconstruction replaces. It deliberately uses component
 * unions, never the landmarks' broad overall bboxes: the Reichstag courts,
 * Kanzleramt office courtyards and station neighbours therefore survive.
 */
export function minecraftArchitecturalReplacementAt(
  x: number,
  z: number,
): MinecraftArchitecturalReplacement | null {
  const invalidenfriedhof = invalidenfriedhofVoxelReplacementAt(x, z);
  if (invalidenfriedhof) return invalidenfriedhof;

  const reichstag = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
  const [reichstagX, reichstagZ] = worldToLocal(reichstag, x, z);
  if (
    reichstag.westPorticoSourceRingsLocal.some((ring) =>
      pointInRing([reichstagX, reichstagZ], ring),
    )
  ) {
    return "reichstag-west-portico";
  }

  const chancellery = MINECRAFT_ARCHITECTURAL_PROFILES.chancellery;
  const [chancelleryX, chancelleryZ] = worldToLocal(chancellery, x, z);
  if (
    Math.abs(chancelleryX - chancellery.cube.offsetLocal[0]) <=
      chancellery.cube.widthM / 2 &&
    Math.abs(chancelleryZ - chancellery.cube.offsetLocal[1]) <=
      chancellery.cube.depthM / 2
  ) {
    return "chancellery-leadership-cube";
  }

  const paul = MINECRAFT_ARCHITECTURAL_PROFILES.paulLoebeHaus;
  if (
    paul.committeeRotundas.some((rotunda) => {
      const [chordStart, chordEnd] = rotunda.chordWorld;
      const chordDx = chordEnd[0] - chordStart[0];
      const chordDz = chordEnd[1] - chordStart[1];
      const chordLength = Math.hypot(chordDx, chordDz);
      const normalX = (rotunda.outwardZ * -chordDz) / chordLength;
      const normalZ = (rotunda.outwardZ * chordDx) / chordLength;
      const dx = x - rotunda.centreWorld[0];
      const dz = z - rotunda.centreWorld[1];
      return (
        dx * normalX + dz * normalZ >= -4.2 &&
        Math.hypot(dx, dz) <= rotunda.radiusM + 5.1
      );
    })
  ) {
    return "paul-loebe-rotunda";
  }

  const melh = MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus;
  if (
    Math.hypot(
      x - melh.rotunda.centreWorld[0],
      z - melh.rotunda.centreWorld[1],
    ) <=
    melh.rotunda.radiusM + 5
  ) {
    return "melh-library-rotunda";
  }
  if (insideWideningStairReplacement(x, z)) {
    return "melh-widening-stair";
  }

  const hauptbahnhof = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
  const [stationX, stationZ] = worldToLocal(hauptbahnhof, x, z);
  if (insideHauptbahnhofReplacement(stationX, stationZ)) {
    return "berlin-hauptbahnhof";
  }

  const gate = MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate;
  const [gateX, gateZ] = worldToLocal(gate, x, z);
  if (
    Math.abs(gateX) <= gate.depthM / 2 + 3 &&
    Math.abs(gateZ) <= gate.widthM / 2 + 3
  ) {
    return "brandenburg-gate";
  }
  return null;
}

/**
 * Preserve the measured voxel body while lowering only coarse roof cells
 * that would otherwise swallow authored block architecture. This is a top
 * clip, never a broad footprint deletion: the Reichstag remains solid below
 * its dome and four tower crowns, the MELH body remains below its canopy, and
 * only voxel cells intersecting the Berliner Ensemble cap frame yield to its
 * source-bound roof tower.
 */
export function minecraftArchitecturalVoxelTopAt(
  x: number,
  z: number,
  sourceTopY: number,
  voxelCellSizeM = 4,
): number {
  let topY = sourceTopY;
  const reichstag = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
  const [localX, localZ] = worldToLocal(reichstag, x, z);
  if (Math.hypot(localX, localZ) <= reichstag.dome.diameterM / 2 + 1.2) {
    topY = Math.min(topY, reichstag.dome.anchorWorld[1] - 1.8);
  }
  const towerCentre = (side: number, extent: number): number =>
    side * (extent / 2 - reichstag.towerSizeM / 2 - reichstag.towerInsetM);
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      if (
        Math.abs(localX - towerCentre(xSide, reichstag.widthM)) <=
          reichstag.towerSizeM / 2 + 0.8 &&
        Math.abs(localZ - towerCentre(zSide, reichstag.depthM)) <=
          reichstag.towerSizeM / 2 + 0.8
      ) {
        topY = Math.min(topY, reichstag.anchorWorld[1] + reichstag.bodyHeightM);
      }
    }
  }

  const melh = MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus;
  const canopyRing = melh.facade.canopy.footprintWorld;
  const withinCanopyCellMargin =
    x >= MELH_CANOPY_CELL_MARGIN_BOUNDS.minX &&
    x <= MELH_CANOPY_CELL_MARGIN_BOUNDS.maxX &&
    z >= MELH_CANOPY_CELL_MARGIN_BOUNDS.minZ &&
    z <= MELH_CANOPY_CELL_MARGIN_BOUNDS.maxZ;
  if (pointInRing([x, z], canopyRing) || withinCanopyCellMargin) {
    topY = Math.min(topY, melh.facade.canopy.topY - 0.5);
  }

  const paul = MINECRAFT_ARCHITECTURAL_PROFILES.paulLoebeHaus;
  const paulOuterX = paul.canopy.westFaceX - paul.canopy.reachM;
  if (
    x >= paulOuterX - 2.9 &&
    x <= paul.canopy.westFaceX + 2.9 &&
    z >= paul.canopy.centreZ - paul.canopy.spanZ / 2 - 2.9 &&
    z <= paul.canopy.centreZ + paul.canopy.spanZ / 2 + 2.9
  ) {
    topY = Math.min(topY, paul.canopy.topY - 0.5);
  }

  const ensemble = MINECRAFT_ARCHITECTURAL_PROFILES.berlinerEnsemble;
  if (
    voxelCellIntersectsLocalRectangle(
      ensemble.towerFrame,
      x,
      z,
      voxelCellSizeM,
      ensemble.blockLoD.towerWidthM,
      ensemble.blockLoD.towerDepthM,
    )
  ) {
    topY = Math.min(topY, ensemble.blockLoD.roofStageBaseY);
  }
  return topY;
}

/** Complete block models own these source voxel columns and their windows. */
export function isMinecraftArchitecturalReplacementColumn(
  x: number,
  z: number,
): boolean {
  return minecraftArchitecturalReplacementAt(x, z) !== null;
}

/**
 * Hide only the smooth architecture that has an explicit block replacement.
 * Flags, monuments and unrelated recognition details remain untouched.
 */
export function setMinecraftArchitecturePresentation(
  signatures: Object3D,
  centralDetails: Object3D,
  minecraft: boolean,
): void {
  for (const child of signatures.children) {
    if (MINECRAFT_SMOOTH_SIGNATURE_REPLACEMENTS.has(child.name)) {
      child.visible = !minecraft;
    }
  }
  centralDetails.traverse((object) => {
    if (MINECRAFT_CENTRAL_REPLACEMENTS.has(object.name)) {
      object.visible = !minecraft;
    }
  });
}

export function minecraftArchitecturalPaletteIsClosed(): boolean {
  const palette = new Set<number>(MINECRAFT_PALETTE);
  return Object.values(BLOCK).every((color) => palette.has(color));
}
