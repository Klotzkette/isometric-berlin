import {
  BoxGeometry,
  Color,
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
  BERLINER_ENSEMBLE_ROOF_TOWER_ROTATION_DEGREES,
} from "./BerlinerEnsemble";
import {
  MINECRAFT_ARCHITECTURAL_BLOCKS as BLOCK,
  MINECRAFT_PALETTE,
} from "./visual-modes/minecraft/palette";
import { domeRadius } from "./ReichstagDome";
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

export const MINECRAFT_ARCHITECTURAL_PROFILES = {
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
  // Even structural courses are emitted as at most 4 m horizontal blocks.
  // This avoids 64/180 m scaled boxes that technically use BoxGeometry but
  // read as smooth slabs rather than a Minecraft construction language.
  const xSegments = Math.ceil(size[0] / 4.001);
  const zSegments = Math.ceil(size[2] / 4.001);
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

function pushFlag(
  plan: BlockPlan,
  frame: LocalFrame,
  cue: string,
  localX: number,
  localZ: number,
  baseY: number,
  european = false,
): void {
  pushLocalBlock(
    plan,
    frame,
    `${cue} pole`,
    [localX, baseY + 5.5, localZ],
    [0.8, 11, 0.8],
    BLOCK.iron,
  );
  if (european) {
    pushLocalBlock(
      plan,
      frame,
      `${cue} blue field`,
      [localX, baseY + 8.5, localZ + 2.4],
      [0.9, 3.6, 4],
      BLOCK.lapis,
    );
    pushLocalBlock(
      plan,
      frame,
      `${cue} gold mark`,
      [localX - 0.5, baseY + 8.5, localZ + 2.5],
      [1, 1, 1],
      BLOCK.gold,
    );
    return;
  }
  for (const [index, color] of [0x111815, BLOCK.red, BLOCK.gold].entries()) {
    pushLocalBlock(
      plan,
      frame,
      `${cue} stripe`,
      [localX, baseY + 9.7 - index * 1.15, localZ + 2.4],
      [0.9, 1.1, 4],
      color,
    );
  }
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
  mesh.userData = {
    blockCount: plan.blocks.length,
    blockNative: true,
    cueCounts: Object.fromEntries(plan.cueCounts),
    landmarkId,
    maxNonStructuralVerticalCue,
    maxNonStructuralVerticalSpanM,
    palette: "shared fixed 32-colour Minecraft palette",
    preciousAccentRatio:
      plan.blocks.length === 0 ? 0 : preciousCount / plan.blocks.length,
    profile,
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

  // West entrance: six block columns, a deep lapis-grey portal, stepped
  // pediment and the one historically bronze/gold cue on the whole facade.
  for (let column = 0; column < 6; column += 1) {
    const z = -17.5 + column * 7;
    for (let layer = 0; layer < 7; layer += 1) {
      pushLocalBlock(
        plan,
        frame,
        "six-column west portico",
        [westX, 5.2 + layer * 2.05, z],
        [2.1, 1.95, 2.1],
        layer % 3 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
      );
    }
    pushLocalBlock(
      plan,
      frame,
      "portico capitals",
      [westX, 18.3, z],
      [3.2, 1.1, 3.2],
      BLOCK.marbleLight,
    );
  }
  // The deep portal and its panes are built in storey-height courses as well
  // as horizontal cubes. Keeping the full 12.8/9.5 m height in one cuboid
  // would read as a smooth extruded panel at the most prominent entrance.
  for (let course = 0; course < 4; course += 1) {
    pushLocalBlock(
      plan,
      frame,
      "west entrance recess",
      [westX + 1.3, 5.5 + course * 3.2, 0],
      [1.2, 3.2, 31],
      BLOCK.deepRecess,
    );
  }
  for (const z of [-8, -4, 0, 4, 8]) {
    for (let course = 0; course < 3; course += 1) {
      pushLocalBlock(
        plan,
        frame,
        "west entrance glass",
        [westX + 0.55, 6.833333 + course * (9.5 / 3), z],
        [1.1, 9.5 / 3, 3.2],
        BLOCK.tealGlass,
      );
    }
  }
  pushLocalBlock(
    plan,
    frame,
    "west portico entablature",
    [westX, 19.2, 0],
    [7.2, 2.2, 41],
    BLOCK.quartzIvory,
  );
  for (let layer = 0; layer < 5; layer += 1) {
    pushLocalBlock(
      plan,
      frame,
      "stepped west pediment",
      [westX, 21.1 + layer * 1.1, 0],
      [6.4, 1, 38 - layer * 7.2],
      layer % 2 === 0 ? BLOCK.marbleLight : BLOCK.limestone,
    );
  }
  // The two tall, crowned stone finials stand at the pediment springing
  // points.  Their stepped block silhouette remains legible in Minecraft;
  // the tiny carved petals are deliberately resolved as one crown course.
  const finialCourses = [
    [20.48, 2.4, 0.72, BLOCK.marbleLight],
    [21.12, 2.0, 0.62, BLOCK.quartzIvory],
    [22.18, 1.38, 1.38, BLOCK.limestone],
    [23.64, 1.28, 1.38, BLOCK.marbleLight],
    [25.1, 1.18, 1.38, BLOCK.limestone],
    [26.18, 1.92, 0.7, BLOCK.quartzIvory],
    [27.15, 1.54, 1.16, BLOCK.marbleLight],
    [28.18, 1.92, 0.72, BLOCK.quartzIvory],
    [29.12, 0.94, 1.16, BLOCK.marbleLight],
  ] as const;
  for (const z of [-19.15, 19.15]) {
    for (const [y, width, height, color] of finialCourses) {
      pushLocalBlock(
        plan,
        frame,
        "paired crowned west-pediment finials",
        [westX - 3.82, y, z],
        [width, height, width],
        color,
      );
    }
  }

  // The historic reliefs remain a block-native heraldic tree: three trunk
  // courses, ten shield pixels and one restrained gold crown in each outer
  // portico bay.  Nothing is a texture or a transparent coplanar decal.
  const shieldOffsets = [
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
    for (const y of [7.15, 9.25, 11.35]) {
      pushLocalBlock(
        plan,
        frame,
        "paired crowned Wappenbaum reliefs",
        [westX + 1.25, y, treeZ],
        [0.72, 1.82, 0.72],
        BLOCK.marbleShadow,
      );
    }
    for (const [y, offsetZ] of shieldOffsets) {
      pushLocalBlock(
        plan,
        frame,
        "paired crowned Wappenbaum reliefs",
        [westX + 0.82, y, treeZ + offsetZ],
        [0.72, 0.86, 0.86],
        BLOCK.marbleLight,
      );
    }
    pushLocalBlock(
      plan,
      frame,
      "paired crowned Wappenbaum reliefs",
      [westX + 0.82, 13.48, treeZ],
      [0.78, 0.82, 1.18],
      BLOCK.gold,
    );
  }
  pushLocalBlock(
    plan,
    frame,
    "bronze dedication band",
    [westX - 3.75, 18.6, 0],
    [0.8, 1.25, 16],
    BLOCK.gold,
  );
  for (let step = 0; step < 5; step += 1) {
    pushLocalBlock(
      plan,
      frame,
      "five-course west stair",
      [westX - 4.8 - step * 1.15, 3.7 - step * 0.62, 0],
      [1.2, 0.65, 37 - step * 1.6],
      step % 2 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
    );
  }

  // The coarse two-part LoD2 portico is removed from the voxel payload below.
  // Rebuild its rear plane as a real block wall so opening the six-column
  // order never turns the entrance into a hole through the Reichstag body.
  for (let z = -18; z <= 18; z += 4) {
    for (let y = 5.8; y <= 21.8; y += 4) {
      const entrance = Math.abs(z) <= 10 && y <= 13.8;
      pushLocalBlock(
        plan,
        frame,
        entrance ? "west portico rear glazing" : "west portico rear masonry",
        [-48.2, y, z],
        [2.1, 3.8, 3.8],
        entrance
          ? Math.round(z + y) % 8 === 0
            ? BLOCK.iceGlass
            : BLOCK.deepRecess
          : Math.round(z + y) % 8 === 0
            ? BLOCK.marbleLight
            : BLOCK.limestone,
      );
    }
  }

  // Strong, sparse window cadence. These are recessed opaque glass blocks,
  // not coplanar planes, so the facade stays stable while orbiting.
  for (const side of [-1, 1]) {
    // A 4 m axis-aligned source cell can protrude about 2 m beyond the rotated
    // metric facade. The 2.35 m relief keeps every authored pane wholly in
    // front of that coarse block skin instead of intersecting it.
    const faceX = side * (profile.widthM / 2 + 2.35);
    for (let z = -50; z <= 50; z += 8) {
      if (side < 0 && Math.abs(z) < 24) continue;
      for (const y of [8.5, 14.5, 20.5]) {
        pushLocalBlock(
          plan,
          frame,
          "tall facade windows",
          [faceX, y, z],
          [1.25, 3.2, 4.2],
          (Math.abs(z) + Math.round(y)) % 5 === 0
            ? BLOCK.iceGlass
            : BLOCK.deepRecess,
        );
      }
    }
    const faceZ = side * (profile.depthM / 2 + 2.35);
    for (let x = -32; x <= 32; x += 8) {
      for (const y of [8.5, 14.5, 20.5]) {
        pushLocalBlock(
          plan,
          frame,
          "long facade windows",
          [x, y, faceZ],
          [4.2, 3.2, 1.25],
          (Math.abs(x) + Math.round(y)) % 5 === 0
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
      for (const gx of [-6, -2, 2, 6]) {
        for (const gz of [-6, -2, 2, 6]) {
          if (Math.abs(gx) < 5 && Math.abs(gz) < 5) continue;
          pushLocalBlock(
            plan,
            frame,
            "four corner-tower crowns",
            [towerX + gx, profile.bodyHeightM + 2, towerZ + gz],
            [3.8, 2, 3.8],
            (gx + gz) % 4 === 0 ? BLOCK.marbleLight : BLOCK.limestone,
          );
        }
      }
      pushFlag(
        plan,
        frame,
        "Reichstag roof flag",
        towerX,
        towerZ,
        profile.bodyHeightM + 1.8,
        xSide === 1 && zSide === 1,
      );
    }
  }

  // Square block podium under a genuinely stepped, hollow glass dome. Its
  // top meets the surveyed dome base; it must not float on the higher coarse
  // 4 m LoD2 roof tier used by the generic voxeliser.
  const dome = profile.dome;
  const podiumLocalY = dome.anchorWorld[1] - profile.anchorWorld[1] - 0.9;
  for (let x = -20; x <= 20; x += 4) {
    for (let z = -20; z <= 20; z += 4) {
      pushLocalBlock(
        plan,
        frame,
        "dome podium tiles",
        [x, podiumLocalY, z],
        [3.8, 1.8, 3.8],
        (x + z) % 8 === 0 ? BLOCK.marbleLight : BLOCK.marbleShadow,
      );
    }
  }
  const domeRows = 17;
  const domeRowHeight = dome.heightM / (domeRows - 1);
  for (let row = 0; row < domeRows; row += 1) {
    const t = row / (domeRows - 1);
    const radius = domeRadius(t, dome.diameterM);
    // Forty-eight lower blocks expose the documented 24 structural sectors
    // as alternating silver ribs and glass; the tight upper rings use 24 so
    // the real 2.4 m oculus remains open instead of collapsing into a plug.
    const segments = radius > 7 ? 48 : 24;
    const tangentM = Math.max(0.55, (Math.PI * 2 * radius * 0.9) / segments);
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const structuralRib = segments === 48 ? segment % 2 === 0 : true;
      const rareLapisGlint = !structuralRib && (segment + row * 7) % 191 === 0;
      const renderRadius = radius + 0.3;
      pushWorldBlock(
        plan,
        "40 m stepped glass dome",
        [
          dome.anchorWorld[0] + Math.cos(angle) * renderRadius,
          dome.anchorWorld[1] + t * dome.heightM,
          dome.anchorWorld[2] + Math.sin(angle) * renderRadius,
        ],
        [tangentM, Math.max(0.8, domeRowHeight * 0.82), 0.5],
        rareLapisGlint
          ? BLOCK.lapis
          : structuralRib
            ? BLOCK.iron
            : BLOCK.iceGlass,
        Math.PI / 2 - angle,
      );
    }
  }
  for (let level = 0; level < 8; level += 1) {
    const width = Math.max(2, 8 - level * 0.7);
    pushWorldBlock(
      plan,
      "silver daylight cone",
      [
        dome.anchorWorld[0],
        dome.anchorWorld[1] + 2.2 + level * 2,
        dome.anchorWorld[2],
      ],
      [width, 1.8, width],
      level % 3 === 0 ? BLOCK.marbleLight : BLOCK.iron,
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

  // Nine clearly separated courses turn each leadership pylon into stacked
  // quartz blocks instead of one smooth white post.
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const x = cubeX + xSide * (cube.widthM / 2 - 2.3);
      const z = cubeZ + zSide * (cube.depthM / 2 - 2.3);
      for (let layer = 0; layer < 9; layer += 1) {
        pushLocalBlock(
          plan,
          frame,
          "four leadership pylons",
          [x, 2 + layer * 4, z],
          [4.5, 3.8, 4.5],
          layer % 3 === 1 ? BLOCK.marbleShadow : BLOCK.marbleLight,
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

  // The 13 closed LoD2 parts of the leadership cube are removed from the
  // voxel payload. Rebuild the complete perimeter as a hollow, stacked shell:
  // cool stone around the two huge semicircular glass halls, and a restrained
  // rear/front window rhythm. Nothing fills the cube's interior volume.
  for (const xSide of [-1, 1]) {
    const masonryX = cubeX + xSide * (cube.widthM / 2 - 1);
    const glazingX = cubeX + xSide * (cube.widthM / 2 + 0.45);
    for (let z = -24; z <= 24; z += 4) {
      const absoluteZ = cubeZ + z;
      const archTop =
        Math.abs(z) < 17.2
          ? 10.5 + Math.sqrt(Math.max(0, 17.2 ** 2 - z ** 2))
          : Number.NEGATIVE_INFINITY;
      for (let y = 2; y <= 30; y += 4) {
        const insideArch = Math.abs(z) < 17.2 && y <= archTop;
        if (insideArch) {
          pushLocalBlock(
            plan,
            frame,
            "leadership aperture glazing",
            [glazingX, y, absoluteZ],
            [0.9, 3.7, 3.7],
            xSide > 0 && Math.abs(z) < 2 && y === 18
              ? BLOCK.lapis
              : Math.round(z + y) % 8 === 0
                ? BLOCK.iron
                : BLOCK.tealGlass,
          );
          continue;
        }
        pushLocalBlock(
          plan,
          frame,
          "leadership cube masonry shell",
          [masonryX, y, absoluteZ],
          [2, 3.8, 3.8],
          (Math.round(z + y) + xSide) % 12 === 0
            ? BLOCK.marbleShadow
            : BLOCK.marbleLight,
        );
      }
    }

    const faceX = cubeX + xSide * (cube.widthM / 2 + 0.7);
    for (let step = 0; step <= 24; step += 1) {
      const angle = (step / 24) * Math.PI;
      pushLocalBlock(
        plan,
        frame,
        "twin semicircular leadership frames",
        [faceX, 10.5 + Math.sin(angle) * 17.2, cubeZ + Math.cos(angle) * 17.2],
        [2, 2, 2],
        BLOCK.iron,
      );
    }
  }
  for (const zSide of [-1, 1]) {
    const faceZ = cubeZ + zSide * (cube.depthM / 2 - 1);
    for (let x = -24; x <= 24; x += 4) {
      for (let y = 2; y <= 30; y += 4) {
        const windowBay = y >= 6 && y <= 22 && Math.abs(x) <= 18;
        pushLocalBlock(
          plan,
          frame,
          windowBay
            ? "leadership transverse facade glazing"
            : "leadership transverse masonry shell",
          [cubeX + x, y, faceZ],
          [3.8, 3.8, 2],
          windowBay
            ? (Math.round(x + y) + zSide) % 8 === 0
              ? BLOCK.iron
              : BLOCK.iceGlass
            : BLOCK.quartzIvory,
        );
      }
    }
  }

  // Office wings retain their source voxel mass and receive only a regular,
  // deeply inset three-row glass cadence on their public long fronts.
  for (const [segmentIndex, segment] of profile.officeSegments.entries()) {
    const [segmentX, segmentZ] = segment.offsetLocal;
    for (const zSide of [-1, 1]) {
      for (
        let x = -segment.widthM / 2 + 4;
        x <= segment.widthM / 2 - 4;
        x += 8
      ) {
        for (const y of [5, 9.5, 14]) {
          pushLocalBlock(
            plan,
            frame,
            "three-row office wing glazing",
            [segmentX + x, y, segmentZ + zSide * (segment.depthM / 2 + 2.35)],
            [5.2, 2.8, 1.25],
            segmentIndex === 0 && zSide > 0 && y === 9.5 && Math.abs(x) < 5
              ? BLOCK.lapis
              : BLOCK.iceGlass,
          );
        }
      }
    }
  }

  // Block-sampled saddle canopy: no continuous curve, no transparent skin.
  for (let forward = -16; forward <= 16; forward += 4) {
    for (let lateral = -24; lateral <= 24; lateral += 4) {
      const y = 31.8 + 3.8 * ((lateral / 25.5) ** 2 - (forward / 18) ** 2);
      pushLocalBlock(
        plan,
        frame,
        "stepped monumental saddle roof",
        [cubeX + 2.4 + forward, y, cubeZ + lateral],
        [3.8, 0.9, 3.8],
        (forward + lateral) % 8 === 0 ? BLOCK.marbleLight : BLOCK.marbleShadow,
      );
    }
  }

  const [courtX, courtZ] = profile.forecourtOffsetLocal;
  pushFlag(
    plan,
    frame,
    "Kanzleramt German protocol flag",
    courtX,
    courtZ - 7.2,
    0,
  );
  pushFlag(
    plan,
    frame,
    "Kanzleramt EU protocol flag",
    courtX,
    courtZ + 7.2,
    0,
    true,
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

  const eastWest = profile.eastWestRoof;
  const northSouth = profile.northSouthHall;
  const eastWestWallTopY =
    eastWest.baseY +
    eastWest.riseM * Math.sqrt(1 - (18 / (eastWest.widthM / 2)) ** 2) -
    0.85;
  const eastWestWallCourseHeight =
    (eastWestWallTopY - profile.publicFloorTopLocalY) / 4;
  for (let x = -160; x <= 160; x += 4) {
    const bow = curveAt(x);
    for (let z = -18; z <= 18; z += 4) {
      const cross = z / (eastWest.widthM / 2);
      const y =
        eastWest.baseY +
        eastWest.riseM * Math.sqrt(Math.max(0, 1 - cross * cross));
      const index = Math.round((x + 160) / 4) + Math.round((z + 18) / 4) * 81;
      pushLocalBlock(
        plan,
        frame,
        "321 m bowed east-west glass hall",
        [x, y, z + bow],
        [3.8, 1.7, 3.8],
        index % 97 === 0
          ? BLOCK.lapis
          : index % 5 === 0
            ? BLOCK.iron
            : BLOCK.iceGlass,
      );
      // The north-south floor owns the crossing itself, so the two slabs do
      // not overlap or expose coplanar top faces there.
      if (Math.abs(x) > northSouth.widthM / 2) {
        pushLocalBlock(
          plan,
          frame,
          "east-west station floor blocks",
          [x, profile.publicFloorTopLocalY - 0.55, z + bow],
          [3.8, 1.1, 3.8],
          index % 6 === 0 ? BLOCK.marbleShadow : BLOCK.limestone,
        );
      }
    }
    // The published elevated E-W railway level spans 37 m and carries four
    // tracks. Ten deck bays plus two rails per track preserve that width
    // without stretching one smooth slab across the station.
    const deckBayCount = 10;
    const deckBayWidth = profile.trackDeckWidthM / deckBayCount;
    for (let bay = 0; bay < deckBayCount; bay += 1) {
      const z = -profile.trackDeckWidthM / 2 + deckBayWidth * (bay + 0.5);
      pushLocalBlock(
        plan,
        frame,
        "east-west raised railway deck",
        [x, profile.trackDeckCentreLocalY, z + bow],
        [3.8, 1.1, deckBayWidth],
        (Math.round(x / 4) + bay) % 6 === 0
          ? BLOCK.marbleShadow
          : BLOCK.limestone,
      );
    }
    for (const trackCentre of [-12, -4, 4, 12]) {
      for (const railOffset of [-0.72, 0.72]) {
        pushLocalBlock(
          plan,
          frame,
          "four east-west block tracks",
          [
            x,
            profile.trackDeckTopLocalY + 0.18,
            trackCentre + railOffset + bow,
          ],
          [3.8, 0.32, 0.5],
          BLOCK.iron,
        );
      }
    }
    for (const side of [-1, 1]) {
      // Four courses close the side wall up to the lowest roof springing;
      // two courses left a six-metre horizontal slit through the hall.
      for (let course = 0; course < 4; course += 1) {
        const y =
          profile.publicFloorTopLocalY +
          eastWestWallCourseHeight * (course + 0.5);
        pushLocalBlock(
          plan,
          frame,
          "east-west hall side glazing",
          [x, y, bow + side * 19.2],
          [3.8, eastWestWallCourseHeight, 1.2],
          (Math.round(x / 4) + Math.round(y) + side) % 5 === 0
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
    (northSouthWallTopY - profile.publicFloorTopLocalY) / 4;
  for (let z = -88; z <= 88; z += 4) {
    for (let x = -18; x <= 18; x += 4) {
      const cross = x / (northSouth.widthM / 2);
      const y =
        northSouth.baseY +
        northSouth.riseM * Math.sqrt(Math.max(0, 1 - cross * cross));
      const index = Math.round((z + 88) / 4) + Math.round((x + 18) / 4) * 45;
      pushLocalBlock(
        plan,
        frame,
        "180 m north-south crossing hall",
        [x, y, z],
        [3.8, 1.7, 3.8],
        index % 101 === 0
          ? BLOCK.lapis
          : index % 4 === 0
            ? BLOCK.iron
            : BLOCK.tealGlass,
      );
      pushLocalBlock(
        plan,
        frame,
        "north-south station floor blocks",
        [x, profile.publicFloorTopLocalY - 0.6, z],
        [3.8, 1.2, 3.8],
        index % 7 === 0 ? BLOCK.marbleShadow : BLOCK.limestone,
      );
    }
    // Longitudinal glass walls make the north-south crossing a real hall
    // rather than a floating roof between the two office bridges.
    for (const side of [-1, 1]) {
      for (let course = 0; course < 4; course += 1) {
        const y =
          profile.publicFloorTopLocalY +
          northSouthWallCourseHeight * (course + 0.5);
        pushLocalBlock(
          plan,
          frame,
          "north-south hall side glazing",
          [side * 19.2, y, z],
          [1.2, northSouthWallCourseHeight, 3.8],
          (Math.round(z / 4) + Math.round(y) + side) % 5 === 0
            ? BLOCK.iron
            : BLOCK.tealGlass,
        );
      }
    }
  }
  // Exact bridge between the two differently sampled floor grids. These
  // narrow strips touch both plates without overlaps or walkable cracks.
  for (const x of [-21, 21]) {
    for (let z = -18; z <= 18; z += 4) {
      pushLocalBlock(
        plan,
        frame,
        "station crossing floor seams",
        [x, profile.publicFloorTopLocalY - 0.55, z],
        [2.2, 1.1, 3.8],
        BLOCK.limestone,
      );
    }
  }
  for (const zSide of [-1, 1]) {
    for (let x = -18; x <= 18; x += 4) {
      const cross = x / (northSouth.widthM / 2);
      const roofY =
        northSouth.baseY +
        northSouth.riseM * Math.sqrt(Math.max(0, 1 - cross * cross));
      for (let y = 3; y <= roofY - 2; y += 4) {
        // Both Washingtonplatz and Europaplatz retain a broad, genuinely
        // open central entry below the glass gable.
        if (Math.abs(x) <= 6 && y <= 7) continue;
        pushLocalBlock(
          plan,
          frame,
          "north-south hall portal glazing",
          [x, y, zSide * 89.1],
          [3.7, 3.7, 1.15],
          (Math.round(x / 4) + Math.round(y) + zSide) % 4 === 0
            ? BLOCK.iron
            : BLOCK.tealGlass,
        );
      }
    }
  }
  // The 321 m hall also terminates in two stepped glass gables. Their lower
  // central bays remain open instead of becoming decorative opaque screens.
  for (const xSide of [-1, 1]) {
    for (let z = -18; z <= 18; z += 4) {
      const roofY =
        eastWest.baseY +
        eastWest.riseM *
          Math.sqrt(Math.max(0, 1 - (z / (eastWest.widthM / 2)) ** 2));
      for (let y = 3; y <= roofY - 2; y += 4) {
        if (Math.abs(z) <= 14 && y <= 11) continue;
        pushLocalBlock(
          plan,
          frame,
          "east-west hall block gables",
          [xSide * 160.6, y, z + curveAt(xSide * 160.6)],
          [1.15, 3.7, 3.7],
          (Math.round(z / 4) + Math.round(y) + xSide) % 4 === 0
            ? BLOCK.iron
            : BLOCK.iceGlass,
          hauptbahnhofEastWestTangentRotationAt(xSide * 160.6),
        );
      }
    }
  }

  // Two 46 m glass office bridges. Long facade runs reduce instance count
  // while their 4 m vertical rhythm stays visibly block-based.
  for (const bridgeX of [-35, 35]) {
    for (const xSide of [-1, 1]) {
      const facadeBayCount = 23;
      const facadeBayLength = 180 / facadeBayCount;
      for (let bay = 0; bay < facadeBayCount; bay += 1) {
        const z = -90 + facadeBayLength * (bay + 0.5);
        const slopeDirection = bridgeX < 0 ? -1 : 1;
        const roofTopY = 43.2 + slopeDirection * xSide * 8 * 0.35;
        const wallBottomY = 1.425;
        const wallTopY = roofTopY - 0.9;
        const courses = Math.ceil((wallTopY - wallBottomY) / 4.001);
        const courseHeight = (wallTopY - wallBottomY) / courses;
        for (let course = 0; course < courses; course += 1) {
          const y = wallBottomY + courseHeight * (course + 0.5);
          const index = bay + course;
          pushLocalBlock(
            plan,
            frame,
            "twin 46 m office bridges",
            [bridgeX + xSide * 9.7, y, z],
            [1.2, courseHeight, facadeBayLength + 0.08],
            index % 113 === 0
              ? BLOCK.lapis
              : index % 3 === 0
                ? BLOCK.iron
                : BLOCK.tealGlass,
          );
        }
      }
    }
    for (let x = -8; x <= 8; x += 4) {
      for (const zSide of [-1, 1]) {
        const slopeDirection = bridgeX < 0 ? -1 : 1;
        const roofTopY = 43.2 + slopeDirection * x * 0.35;
        const wallBottomY = 1.425;
        const wallTopY = roofTopY - 0.9;
        const courses = Math.ceil((wallTopY - wallBottomY) / 4.001);
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
            "office-bridge end frames",
            [bridgeX + x, blockBottom + blockHeight / 2, zSide * 90.4],
            [3.8, blockHeight, 1.2],
            (Math.round(x) * 3 + course * 5) % 97 === 0
              ? BLOCK.lapis
              : BLOCK.iron,
          );
        }
      }
    }
    for (let z = -88; z <= 88; z += 4) {
      pushLocalBlock(
        plan,
        frame,
        "office-bridge ground deck",
        [bridgeX, 0.75, z],
        [19.5, 1.35, 3.8],
        Math.round(z / 4) % 2 === 0 ? BLOCK.limestone : BLOCK.marbleShadow,
      );
      for (const y of [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]) {
        for (const side of [-1, 1]) {
          pushLocalBlock(
            plan,
            frame,
            "office-bridge floor bands",
            [bridgeX + side * 9.45, y, z],
            [0.75, 0.6, 3.8],
            BLOCK.iron,
          );
        }
      }
      for (const xOffset of [-8, -4, 0, 4, 8]) {
        const slopeDirection = bridgeX < 0 ? -1 : 1;
        const roofTopY = 43.2 + slopeDirection * xOffset * 0.35;
        pushLocalBlock(
          plan,
          frame,
          "office-bridge stepped crowns",
          [bridgeX + xOffset, roofTopY - 0.45, z],
          [3.8, 0.9, 3.8],
          Math.abs(xOffset) === 8 ? BLOCK.silver : BLOCK.iron,
        );
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
      for (let layer = 0; layer < 4; layer += 1) {
        pushLocalBlock(
          plan,
          frame,
          "twelve block Doric columns",
          [localX, 1.7 + layer * 3.35, localZ],
          [2.1, 3.2, 2.1],
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
    for (let y = 2; y <= 8; y += 3) {
      for (const x of [-3.5, 0, 3.5]) {
        pushLocalBlock(
          plan,
          frame,
          "two sandstone side pavilions",
          [x, y, centreZ],
          [3.2, 2.8, pavilionWidth - 0.6],
          (Math.round(y + x) + side) % 2 === 0
            ? BLOCK.quartzIvory
            : BLOCK.limestone,
        );
      }
    }
    for (let roof = 0; roof < 3; roof += 1) {
      pushLocalBlock(
        plan,
        frame,
        "stepped pavilion roofs",
        [0, 8.8 + roof * 0.8, centreZ],
        [profile.depthM - roof * 1.6, 0.75, pavilionWidth - roof * 2.4],
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
  const tangentM = Math.max(size[0], (Math.PI * 2 * radius * 0.99) / segments);
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
      [tangentM, size[1], size[2]],
      (segment + row) % 7 === 0 ? BLOCK.iron : BLOCK.iceGlass,
      Math.PI / 2 - angle,
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
  const tangentM = Math.max(
    size[0],
    (Math.PI * radius * 0.99) / (segments - 1),
  );
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
      [tangentM, size[1], size[2]],
      (segment + row) % 7 === 0 ? BLOCK.iron : BLOCK.iceGlass,
      Math.PI / 2 - angle,
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
        [segmentLength + 0.08, 0.8, width],
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
    26,
    lower.curveSagittaM,
  );
  // The public lower bridge has two open block handrails, never a solid
  // parapet. Their 26 courses follow the same restrained OSM/photo bow.
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
    for (let index = 0; index < 26; index += 1) {
      const a = at(index / 26);
      const b = at((index + 1) / 26);
      pushWorldBlock(
        plan,
        "lower public bridge block handrails",
        [(a[0] + b[0]) / 2, lower.deckY + 1.05, (a[1] + b[1]) / 2],
        [Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.08, 0.55, 0.45],
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
  // Stepped diagonal ties retain the documented open Vierendeel-like rhythm
  // without introducing rotated non-block beams.
  for (let bay = 0; bay < upper.frameBayCount; bay += 1) {
    for (const side of [-1, 1]) {
      for (let step = 0; step < 3; step += 1) {
        const t = (bay + (step + 0.5) / 3) / upper.frameBayCount;
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
          "upper bridge stepped diagonal ties",
          [
            x + nx * side * 1.25,
            upper.deckY + 1.65 + step * 2.55,
            z + nz * side * 1.25,
          ],
          [0.7, 0.7, 0.7],
          BLOCK.iron,
        );
      }
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
  for (let z = -50; z <= 50; z += 4) {
    pushWorldBlock(
      plan,
      "Paul-Löbe cantilevered west canopy",
      [canopy.westFaceX - canopy.reachM / 2, canopy.topY, canopy.centreZ + z],
      [canopy.reachM, 0.9, 3.8],
      z % 8 === 0 ? BLOCK.marbleLight : BLOCK.quartzIvory,
    );
  }
  for (let column = 0; column < canopy.columnCount; column += 1) {
    const z =
      canopy.centreZ -
      canopy.spanZ / 2 +
      3.2 +
      ((canopy.spanZ - 6.4) * column) / (canopy.columnCount - 1);
    for (let y = 7; y <= 25; y += 4) {
      pushWorldBlock(
        plan,
        "Paul-Löbe thirteen canopy columns",
        [outerX + 1.1, y, z],
        [1.5, 3.8, 1.5],
        BLOCK.iron,
      );
    }
  }
  for (let z = -48; z <= 48; z += 4) {
    for (const y of [7.5, 12, 16.5, 21, 25.5]) {
      pushWorldBlock(
        plan,
        "Paul-Löbe west glass grid",
        [canopy.westFaceX - 2.8, y, canopy.centreZ + z],
        [1.2, 3.1, 3.2],
        (Math.round(z / 4) + Math.round(y)) % 13 === 0
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
    for (let row = 0; row < 6; row += 1) {
      const rowY = paul.rotundaBaseY + 2 + row * 4;
      pushHalfRing(
        plan,
        "eight Paul-Löbe committee rotundas",
        centre,
        rowY,
        rotunda.radiusM,
        rotunda.outwardZ,
        9,
        [3.2, 3.7, 2.1],
        row,
      );
      pushWorldBlock(
        plan,
        "eight Paul-Löbe rotunda chord walls",
        [
          (chordStart[0] + chordEnd[0]) / 2 - normalX * 0.35,
          rowY,
          (chordStart[1] + chordEnd[1]) / 2 - normalZ * 0.35,
        ],
        [chordLength, 3.7, 1.4],
        row % 4 === 0 ? BLOCK.iron : BLOCK.tealGlass,
        chordRotation,
      );
    }
    for (let xOffset = -8; xOffset <= 8; xOffset += 4) {
      for (let zOffset = -8; zOffset <= 8; zOffset += 4) {
        const outwardDistance = xOffset * normalX + zOffset * normalZ;
        if (
          outwardDistance < -0.1 ||
          Math.hypot(xOffset, zOffset) > rotunda.radiusM - 1.2
        ) {
          continue;
        }
        pushWorldBlock(
          plan,
          "eight Paul-Löbe rotunda roof caps",
          [
            centre[0] + xOffset,
            paul.rotundaBaseY + paul.rotundaHeightM - 0.45,
            centre[1] + zOffset,
          ],
          [3.8, 0.9, 3.8],
          (xOffset + zOffset) % 8 === 0 ? BLOCK.marbleLight : BLOCK.silver,
        );
      }
    }
  }

  const melh = MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus;
  const melhRowHeight = melh.rotunda.heightM / 9;
  for (let row = 0; row < 9; row += 1) {
    pushRing(
      plan,
      "Lüders-Haus library rotunda",
      melh.rotunda.centreWorld,
      melh.rotunda.baseY + (row + 0.5) * melhRowHeight,
      melh.rotunda.radiusM,
      24,
      [3.8, melhRowHeight - 0.18, 2.2],
      row,
    );
  }
  for (let xOffset = -16; xOffset <= 16; xOffset += 4) {
    for (let zOffset = -16; zOffset <= 16; zOffset += 4) {
      if (Math.hypot(xOffset, zOffset) > melh.rotunda.radiusM - 1.1) {
        continue;
      }
      pushWorldBlock(
        plan,
        "Lüders-Haus rotunda roof cap",
        [
          melh.rotunda.centreWorld[0] + xOffset,
          melh.rotunda.baseY + melh.rotunda.heightM - 0.45,
          melh.rotunda.centreWorld[1] + zOffset,
        ],
        [3.8, 0.9, 3.8],
        (xOffset + zOffset) % 8 === 0 ? BLOCK.marbleLight : BLOCK.silver,
      );
    }
  }
  const circular = melh.facade.circularFacade;
  const circularCentreY = circular.bottomY + circular.heightM / 2;
  for (let step = 0; step < 32; step += 1) {
    const angle = (step / 32) * Math.PI * 2;
    pushWorldBlock(
      plan,
      "Lüders-Haus circular Spree opening",
      [
        circular.centreWorld[0] - 0.9,
        circularCentreY + Math.sin(angle) * circular.openingRadiusM,
        circular.centreWorld[1] + Math.cos(angle) * circular.openingRadiusM,
      ],
      [1.8, 2.1, 2.1],
      step % 5 === 0 ? BLOCK.marbleLight : BLOCK.iron,
    );
  }
  // The circular cut-out keeps its turquoise inner curtain wall and silver
  // mullion rhythm after the smooth facade is hidden in Minecraft.
  for (let yOffset = -10; yOffset <= 10; yOffset += 4) {
    const halfChord = Math.sqrt(
      Math.max(0, circular.openingRadiusM ** 2 - yOffset ** 2),
    );
    for (
      let zOffset = -halfChord + 1.8;
      zOffset <= halfChord - 1.8;
      zOffset += 3.6
    ) {
      const mullion = Math.round((zOffset + halfChord) / 3.6) % 4 === 0;
      pushWorldBlock(
        plan,
        mullion
          ? "Lüders-Haus circular silver mullions"
          : "Lüders-Haus circular inner glazing",
        [
          circular.centreWorld[0] - 2.05,
          circularCentreY + yOffset,
          circular.centreWorld[1] + zOffset,
        ],
        [0.9, 3.3, 3.15],
        mullion ? BLOCK.silver : BLOCK.tealGlass,
      );
    }
  }
  for (let x = 360; x <= 408; x += 4) {
    for (let z = -176; z <= -116; z += 4) {
      pushWorldBlock(
        plan,
        "Lüders-Haus block canopy",
        [x, melh.facade.canopy.topY, z],
        [3.8, 0.9, 3.8],
        (x + z) % 8 === 0 ? BLOCK.marbleLight : BLOCK.marbleShadow,
      );
    }
  }
  for (const [x, z] of melh.facade.canopy.supportsWorld) {
    for (let y = 6; y <= 30; y += 4) {
      pushWorldBlock(
        plan,
        "Lüders-Haus canopy supports",
        [x, y, z],
        [1.4, 3.8, 1.4],
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
  const stairSteps = 12;
  for (let step = 0; step < stairSteps; step += 1) {
    const t = (step + 0.5) / stairSteps;
    const surfaceY =
      stair.bottomY + (stair.topY - stair.bottomY) * ((step + 1) / stairSteps);
    const width =
      stair.widthBottomM + (stair.widthTopM - stair.widthBottomM) * t;
    const stackHeight = surfaceY - stair.bottomY;
    const verticalCourses = Math.ceil(stackHeight / 4.001);
    const courseHeight = stackHeight / verticalCourses;
    for (let course = 0; course < verticalCourses; course += 1) {
      pushWorldBlock(
        plan,
        "Lüders-Haus widening stair",
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
  const baseY =
    profile.blockLoD.roofStageBaseY - towerFrame.anchorWorld[1];

  // The measured LoD2 voxel body ends at this source-bound roof stage. Only
  // the characteristic truncated tower cap and sign rise above it here, so
  // no smooth theatre shell, TorusGeometry or textured lettering survives in
  // Minecraft mode.
  for (let course = 0; course < 3; course += 1) {
    pushLocalBlock(
      plan,
      towerFrame,
      "Berliner Ensemble taupe roof tower",
      [0, baseY + 0.7 + course * 1.4, 0],
      [profile.blockLoD.towerWidthM, 1.34, profile.blockLoD.towerDepthM],
      course % 2 === 0 ? BLOCK.limestone : BLOCK.quartzIvory,
    );
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
    [profile.blockLoD.towerWidthM * 0.8, profile.blockLoD.towerDepthM * 0.8, 0.76],
    [profile.blockLoD.towerWidthM * 0.6, profile.blockLoD.towerDepthM * 0.6, 0.76],
    [profile.blockLoD.towerWidthM * 0.4, profile.blockLoD.towerDepthM * 0.4, 0.76],
  ] as const;
  for (const [index, [width, depth, height]] of roofCourses.entries()) {
    pushLocalBlock(
      plan,
      towerFrame,
      "Berliner Ensemble stepped hipped roof",
      [0, baseY + 4.2 + height / 2 + index * height, 0],
      [width, height, depth],
      index % 2 === 0 ? BLOCK.oxidisedCopper : BLOCK.iron,
    );
  }

  const centreY =
    profile.blockLoD.signCentreY - signFrame.anchorWorld[1];
  const radius = profile.blockLoD.signDiameterM / 2;
  const roofTop = profile.blockLoD.roofStageTopY - signFrame.anchorWorld[1];
  const supportHeight = Math.max(1, centreY - radius - roofTop + 0.55);
  for (const localX of [-2.55, 2.55]) {
    pushLocalBlock(
      plan,
      signFrame,
      "Berliner Ensemble roof-sign support",
      [localX, roofTop + supportHeight / 2, 0],
      [0.7, supportHeight, 0.7],
      BLOCK.iron,
    );
  }
  for (let segment = 0; segment < 24; segment += 1) {
    const angle = (segment / 24) * Math.PI * 2;
    pushLocalBlock(
      plan,
      signFrame,
      "Berliner Ensemble open circular sign",
      [Math.cos(angle) * radius, centreY + Math.sin(angle) * radius, 0],
      [0.68, 0.68, 0.68],
      BLOCK.red,
    );
  }
  for (const [line, localY] of [
    ["upper", centreY + 0.72],
    ["lower", centreY - 0.72],
  ] as const) {
    for (const localX of [-2.35, -1.55, -0.75, 0.05, 0.85, 1.65, 2.45]) {
      pushLocalBlock(
        plan,
        signFrame,
        `Berliner Ensemble ${line} lettering cue`,
        [localX, localY, 0.18],
        [0.52, 0.58, 0.5],
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
 * Six lazy, opaque, block-native signature batches. They replace hundreds of
 * smooth hero meshes. The official 4 m LoD2 mass remains the measured body
 * except where a deliberately open signature owns the source cells itself:
 * Reichstag portico, Chancellery leadership cube, Hauptbahnhof and Gate.
 */
export function createMinecraftArchitecturalLandmarks(): Group {
  const group = new Group();
  group.name = "Minecraft block-native architectural landmarks";
  group.userData = {
    blockNative: true,
    drawCallBudget: 6,
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
    Math.abs(localZ) <=
      depthHalf + cellHalf * (absoluteCosine + absoluteSine)
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
