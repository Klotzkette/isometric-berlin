import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import {
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";

const WAGNER_WORLD_M = [-672.0697082573897, 5.2, 967.217096994631] as const;
const WAGNER_YAW_RAD = -0.055;
// pedestrianPointIsBlocked checks the capsule centre plus four horizontal
// samples offset by its 0.42 m radius. Its closed-prism override therefore
// needs one complete 0.84 m capsule width beyond the source ring, otherwise
// the outer sample recreates an impassable collar at each open edge.
const WAGNER_WALKABLE_CAPSULE_WIDTH_M = 0.84;
const WAGNER_LOD2_RING_WORLD_M = Object.freeze([
  [-668.2, 971.4],
  [-677.3, 970.9],
  [-676.7, 960.8],
  [-667.5, 961.4],
] as const);

/** The one LoD2 envelope replaced by the complete open memorial model. */
export const WAGNER_MEMORIAL_PRISM_IDS: ReadonlySet<string> = new Set([
  "SR00009n",
]);

/**
 * Stable, source-bound contract for Eberlein's memorial and its later canopy.
 * The photographs are reference-only: every runtime surface is procedural.
 */
export const WAGNER_MEMORIAL_PROFILE = Object.freeze({
  apiVersion: 1,
  name: "Richard Wagner",
  publicLabel: "Richard-Wagner-Denkmal",
  osmKey: "node/243487615",
  osmId: 243487615,
  wgs84: [13.3618687, 52.5100656] as const,
  epsg25833M: [388827.9302917426, 5819032.782903005] as const,
  worldM: WAGNER_WORLD_M,
  groundY: WAGNER_WORLD_M[1],
  rotationY: WAGNER_YAW_RAD,
  frontWorldXZ: [Math.sin(WAGNER_YAW_RAD), Math.cos(WAGNER_YAW_RAD)] as const,
  artist: "Gustav Eberlein",
  created: "1901–1903",
  unveiled: "1903-10-01",
  materials: "light-grey/white Pentelic marble over a masonry core",
  totalHeightM: 6,
  seatedFigureHeightM: 2.7,
  schwellenraumProtected: false,
  inscription: "RICHARD / WAGNER",
  operaFigures: Object.freeze([
    "Wolfram von Eschenbach with harp at the front",
    "Bruennhilde supporting the dead Siegfried at the left",
    "Tannhaeuser stretched over the steps at the right",
    "Alberich, Rhine maidens and Rheingold at the rear",
  ]),
  canopy: Object.freeze({
    architect: "Marianne Wagner",
    built: "1987–1988",
    form: "open steel frame with a plexiglass-covered barrel vault",
    footprintM: [9.6, 10.4] as const,
    eaveHeightM: 6.75,
    ridgeHeightM: 8.55,
    postLocalXZ: Object.freeze([
      [-4.35, -4.85],
      [4.35, -4.85],
      [-4.35, 4.85],
      [4.35, 4.85],
    ] as const),
  }),
  lod2: Object.freeze({
    fullId: "DEBE00YYSR00009n",
    payloadId: "SR00009n",
    footprintWorldM: WAGNER_LOD2_RING_WORLD_M,
    bottomY: 5.2,
    heightM: 9.3,
    topY: 14.5,
    interpretation:
      "protective-canopy envelope; never a closed occupied building",
  }),
  voxelSource: Object.freeze({
    bottomY: 5.2,
    columnHeightM: 12,
    columnTopY: 17.2,
    expectedColumnCount: 6,
    columnCentersWorldM: Object.freeze([
      [-674, 962],
      [-670, 962],
      [-674, 966],
      [-670, 966],
      [-674, 970],
      [-670, 970],
    ] as const),
  }),
  focus: Object.freeze({
    // The closer eastern gap between the documented Tiergarten tree crowns
    // keeps both the marble ensemble and the open canopy legible on focus.
    azimuthDegrees: 80,
    distanceM: 21.25,
    polarDegrees: 36,
    targetHeightM: 4,
  }),
  minecraftFocus: Object.freeze({
    // This low northern aisle clears both surveyed voxel trunks and crowns
    // while looking straight into the open end of the protective canopy.
    azimuthDegrees: -6,
    distanceM: 21.25,
    polarDegrees: 82,
    targetHeightM: 4,
  }),
  sources: Object.freeze({
    berlinInventory:
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318",
    sculptureInventory:
      "https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/",
    berlinInformation:
      "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/index.php/detail/2518",
    osm: "https://www.openstreetmap.org/node/243487615",
    visualReference:
      "https://commons.wikimedia.org/wiki/Richard-Wagner-Denkmal_(Berlin)",
  }),
  renderPolicy: Object.freeze({
    modes: Object.freeze([
      "day",
      "night",
      "snowstorm",
      "minecraft",
      "schwellenraum",
    ]),
    texturePolicy: "procedural geometry only; no image or canvas texture",
    maxSmoothRenderables: 8,
    maxSmoothRenderedVertices: 35_000,
    maxMinecraftBlocks: 520,
  }),
});

export function wagnerMemorialFocusForMode(
  mode: "day" | "minecraft" | "night" | "schwellenraum" | "snowstorm",
):
  | typeof WAGNER_MEMORIAL_PROFILE.focus
  | typeof WAGNER_MEMORIAL_PROFILE.minecraftFocus {
  return mode === "minecraft"
    ? WAGNER_MEMORIAL_PROFILE.minecraftFocus
    : WAGNER_MEMORIAL_PROFILE.focus;
}

const MARBLE = 0xe7e4dc;
const MARBLE_SHADE = 0xc9c7c0;
const MARBLE_SHADOW = 0xa9a8a2;
const INSCRIPTION = 0x777772;
const STEEL = 0x555f61;
const STEEL_DARK = 0x3e484b;
const PLEXIGLASS = 0xb9d7dc;
const RHINEGOLD = 0xb6963f;
const SNOW = 0xeaf1ef;
const MINECRAFT_GLASS = 0xa8d7dc;

type Block = {
  color: number;
  position: readonly [number, number, number];
  rotationY: number;
  scale: readonly [number, number, number];
};

function addGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = false,
): void {
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) builder.edges.push(new EdgesGeometry(geometry, 29));
}

function addBox(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  inked = false,
): void {
  const geometry = new BoxGeometry(...size);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, inked);
}

function addCylinder(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments = 10,
  rotation: readonly [number, number, number] = [0, 0, 0],
  inked = false,
): void {
  const geometry = new CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    segments,
    1,
    false,
  );
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, inked);
}

function addCone(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  radius: number,
  height: number,
  segments = 8,
  rotation: readonly [number, number, number] = [0, 0, 0],
): void {
  const geometry = new ConeGeometry(radius, height, segments, 1, false);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, false);
}

function addEllipsoid(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  inked = false,
): void {
  const geometry = new SphereGeometry(1, 9, 6);
  geometry.scale(...scale);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, inked);
}

function addCapsule(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  radius: number,
  length: number,
  scale: readonly [number, number, number] = [1, 1, 1],
  rotation: readonly [number, number, number] = [0, 0, 0],
  inked = false,
): void {
  const geometry = new CapsuleGeometry(radius, length, 3, 7);
  geometry.scale(...scale);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, inked);
}

function addTorus(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  radius: number,
  tube: number,
  rotation: readonly [number, number, number] = [0, 0, 0],
  arc = Math.PI * 2,
): void {
  const geometry = new TorusGeometry(radius, tube, 4, 10, arc);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, false);
}

function addBeam(
  builder: Builder,
  color: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  radius: number,
  segments = 6,
  inked = false,
): void {
  const from = new Vector3(...start);
  const to = new Vector3(...end);
  const delta = to.clone().sub(from);
  if (delta.lengthSq() < 1e-8) return;
  const geometry = new CylinderGeometry(
    radius,
    radius,
    delta.length(),
    segments,
  );
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      delta.clone().normalize(),
    ),
  );
  geometry.translate(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    (from.z + to.z) / 2,
  );
  addGeometry(builder, geometry, color, inked);
}

function barrelPoint(
  progress: number,
  z: number,
  yOffset = 0,
): [number, number, number] {
  const theta = progress * Math.PI;
  const halfWidth = WAGNER_MEMORIAL_PROFILE.canopy.footprintM[0] / 2;
  const rise =
    WAGNER_MEMORIAL_PROFILE.canopy.ridgeHeightM -
    WAGNER_MEMORIAL_PROFILE.canopy.eaveHeightM;
  return [
    -Math.cos(theta) * halfWidth,
    WAGNER_MEMORIAL_PROFILE.canopy.eaveHeightM +
      Math.sin(theta) * rise +
      yOffset,
    z,
  ];
}

function barrelShellGeometry(yOffset = 0): BufferGeometry {
  const segments = 16;
  const halfLength = WAGNER_MEMORIAL_PROFILE.canopy.footprintM[1] / 2;
  const positions: number[] = [];
  for (let segment = 0; segment < segments; segment += 1) {
    const a0 = barrelPoint(segment / segments, -halfLength, yOffset);
    const a1 = barrelPoint(segment / segments, halfLength, yOffset);
    const b0 = barrelPoint((segment + 1) / segments, -halfLength, yOffset);
    const b1 = barrelPoint((segment + 1) / segments, halfLength, yOffset);
    positions.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(
    Array.from({ length: positions.length / 3 }, (_entry, index) => index),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function addCanopySteel(builder: Builder): void {
  const canopy = WAGNER_MEMORIAL_PROFILE.canopy;
  const halfLength = canopy.footprintM[1] / 2 - 0.12;
  for (const [x, z] of canopy.postLocalXZ) {
    addCylinder(
      builder,
      STEEL_DARK,
      [x, canopy.eaveHeightM / 2, z],
      0.095,
      0.095,
      canopy.eaveHeightM,
      8,
      [0, 0, 0],
      true,
    );
    addBox(builder, STEEL_DARK, [x, 0.08, z], [0.42, 0.16, 0.42]);
  }

  for (const z of [
    -halfLength,
    -halfLength / 2,
    0,
    halfLength / 2,
    halfLength,
  ]) {
    for (let segment = 0; segment < 12; segment += 1) {
      addBeam(
        builder,
        STEEL,
        barrelPoint(segment / 12, z),
        barrelPoint((segment + 1) / 12, z),
        0.052,
        6,
      );
    }
  }
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    addBeam(
      builder,
      STEEL_DARK,
      barrelPoint(progress, -halfLength),
      barrelPoint(progress, halfLength),
      0.06,
      6,
      progress === 0 || progress === 1,
    );
  }
  // Open end bracing: the diagonals stop at the eave/ridge frame and never
  // become a wall across either public approach.
  for (const z of [-halfLength, halfLength]) {
    addBeam(
      builder,
      STEEL,
      [-4.35, 3.1, z],
      [-4.35, canopy.eaveHeightM, z],
      0.045,
    );
    addBeam(
      builder,
      STEEL,
      [4.35, 3.1, z],
      [4.35, canopy.eaveHeightM, z],
      0.045,
    );
  }
}

const PIXEL_FONT: Readonly<Record<string, readonly string[]>> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10101", "10101", "10011", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
};

function addPixelWord(
  builder: Builder,
  word: string,
  centerY: number,
  z: number,
  width: number,
): void {
  const glyphWidth = width / (word.length * 6 - 1);
  const pixelHeight = glyphWidth * 1.22;
  const totalWidth = glyphWidth * (word.length * 6 - 1);
  const startX = -totalWidth / 2;
  for (let letter = 0; letter < word.length; letter += 1) {
    const rows = PIXEL_FONT[word[letter]] ?? [];
    rows.forEach((row, rowIndex) => {
      [...row].forEach((filled, columnIndex) => {
        if (filled !== "1") return;
        addBox(
          builder,
          INSCRIPTION,
          [
            startX + (letter * 6 + columnIndex) * glyphWidth,
            centerY + (3 - rowIndex) * pixelHeight,
            z,
          ],
          [glyphWidth * 0.72, pixelHeight * 0.72, 0.035],
        );
      });
    });
  }
}

function addMonumentBody(builder: Builder): void {
  // Three steps and the nearly square, rear-apsed Romanesque pedestal.
  addBox(
    builder,
    MARBLE_SHADE,
    [0, 0.17, 0],
    [6.65, 0.34, 6.15],
    [0, 0, 0],
    true,
  );
  addBox(builder, MARBLE, [0, 0.43, 0.05], [6.05, 0.2, 5.55], [0, 0, 0], true);
  addBox(builder, MARBLE, [0, 0.67, 0.1], [5.45, 0.28, 4.95], [0, 0, 0], true);
  addBox(
    builder,
    MARBLE_SHADE,
    [0, 1.72, -0.05],
    [3.25, 1.82, 2.75],
    [0, 0, 0],
    true,
  );
  addCylinder(builder, MARBLE_SHADE, [0, 1.72, -1.34], 1.56, 1.56, 1.82, 14);
  addBox(
    builder,
    MARBLE,
    [0, 2.72, -0.05],
    [3.55, 0.22, 3.05],
    [0, 0, 0],
    true,
  );
  addBox(builder, MARBLE, [0, 3.08, -0.05], [2.72, 0.5, 2.35], [0, 0, 0], true);
  addPixelWord(builder, "RICHARD", 2.29, 1.337, 2.1);
  addPixelWord(builder, "WAGNER", 1.93, 1.337, 1.88);

  // Wagner sits on the throne: 2.70 m from chair-step to the hair crown.
  addBox(
    builder,
    MARBLE_SHADOW,
    [0, 4.3, -0.52],
    [1.62, 2.08, 0.42],
    [0, 0, 0],
    true,
  );
  addBox(builder, MARBLE_SHADE, [0, 3.55, -0.03], [1.55, 0.32, 1.32]);
  addBox(builder, MARBLE_SHADOW, [-0.83, 3.78, 0.03], [0.18, 0.46, 1.28]);
  addBox(builder, MARBLE_SHADOW, [0.83, 3.78, 0.03], [0.18, 0.46, 1.28]);
  addCapsule(
    builder,
    MARBLE,
    [0, 4.63, -0.08],
    0.46,
    0.72,
    [1.05, 1, 0.82],
    [0.02, 0, 0],
    true,
  );
  addEllipsoid(
    builder,
    MARBLE,
    [-0.08, 5.55, 0.02],
    [0.34, 0.43, 0.32],
    [0, -0.16, 0],
    true,
  );
  addEllipsoid(
    builder,
    MARBLE_SHADOW,
    [-0.12, 5.85, -0.08],
    [0.38, 0.15, 0.34],
  );
  addCone(
    builder,
    MARBLE_SHADOW,
    [-0.28, 5.76, -0.2],
    0.15,
    0.28,
    6,
    [0.25, 0, -0.3],
  );
  addBeam(builder, MARBLE, [-0.4, 4.75, 0], [-0.82, 4.18, 0.18], 0.13, 7);
  addBeam(builder, MARBLE, [0.4, 4.75, 0], [0.78, 4.12, 0.22], 0.13, 7);
  addBeam(builder, MARBLE, [-0.32, 4.12, 0.08], [-0.45, 3.38, 0.48], 0.2, 7);
  addBeam(builder, MARBLE, [0.32, 4.12, 0.08], [0.46, 3.38, 0.48], 0.2, 7);
  addBox(
    builder,
    MARBLE_SHADE,
    [0.55, 4.02, 0.31],
    [0.65, 0.05, 0.5],
    [0, 0.08, 0.04],
  );
  // Sphinx heads on the throne arms.
  for (const x of [-0.83, 0.83]) {
    addEllipsoid(builder, MARBLE, [x, 4.08, 0.58], [0.2, 0.25, 0.28]);
    addCone(builder, MARBLE, [x, 3.95, 0.79], 0.21, 0.4, 6, [
      Math.PI / 2,
      0,
      0,
    ]);
  }

  // Front: Wolfram von Eschenbach kneels with the unmistakable harp.
  addCapsule(
    builder,
    MARBLE,
    [-0.1, 1.65, 2.03],
    0.3,
    0.65,
    [1, 1.15, 0.8],
    [0, 0, 0.17],
  );
  addEllipsoid(builder, MARBLE, [-0.2, 2.37, 1.99], [0.24, 0.28, 0.23]);
  addBeam(builder, MARBLE, [-0.3, 1.44, 2.02], [-0.8, 0.82, 2.16], 0.14, 7);
  addBeam(builder, MARBLE, [0.08, 1.42, 2.02], [0.5, 0.85, 2.12], 0.14, 7);
  addBeam(
    builder,
    MARBLE_SHADE,
    [0.25, 1.43, 2.31],
    [0.82, 2.43, 2.31],
    0.045,
    6,
  );
  addBeam(
    builder,
    MARBLE_SHADE,
    [0.82, 2.43, 2.31],
    [0.82, 1.2, 2.31],
    0.045,
    6,
  );
  addBeam(
    builder,
    MARBLE_SHADE,
    [0.82, 1.2, 2.31],
    [0.25, 1.43, 2.31],
    0.045,
    6,
  );
  for (let string = 1; string <= 4; string += 1) {
    const t = string / 5;
    addBeam(
      builder,
      MARBLE_SHADOW,
      [0.37 + t * 0.38, 1.42 + t * 0.06, 2.31],
      [0.75, 2.23, 2.31],
      0.012,
      5,
    );
  }

  // Left: Bruennhilde bends over the dead Siegfried.
  addCapsule(
    builder,
    MARBLE,
    [-2.06, 1.54, -0.05],
    0.3,
    0.7,
    [1, 1.1, 0.82],
    [0, 0, -0.42],
  );
  addEllipsoid(builder, MARBLE, [-2.32, 2.17, -0.02], [0.23, 0.28, 0.23]);
  addBeam(builder, MARBLE, [-2.0, 1.38, 0.04], [-1.45, 0.98, 0.5], 0.13, 7);
  addCapsule(
    builder,
    MARBLE_SHADE,
    [-1.82, 0.97, 0.7],
    0.23,
    0.88,
    [1, 1.2, 0.8],
    [0, 0, Math.PI / 2],
  );
  addEllipsoid(builder, MARBLE_SHADE, [-1.2, 0.98, 0.74], [0.23, 0.24, 0.22]);
  addBeam(
    builder,
    MARBLE_SHADE,
    [-2.25, 0.92, 0.72],
    [-2.74, 0.73, 1.13],
    0.11,
    7,
  );

  // Right: Tannhaeuser in his penitential robe stretches down the steps.
  addCapsule(
    builder,
    MARBLE,
    [2.08, 1.15, 0.22],
    0.3,
    1.05,
    [1, 1.15, 0.88],
    [0, 0, -Math.PI / 2.25],
  );
  addEllipsoid(builder, MARBLE, [1.58, 1.63, 0.16], [0.24, 0.28, 0.24]);
  addBeam(builder, MARBLE, [2.3, 0.93, 0.25], [2.92, 0.5, 0.63], 0.14, 7);
  addBeam(builder, MARBLE, [2.05, 1.03, 0.18], [2.58, 0.57, -0.38], 0.14, 7);

  // Rear: Alberich crouches over the Rheingold while three Rhine maidens
  // form the apsidal silhouette.
  addCapsule(
    builder,
    MARBLE_SHADE,
    [0, 1.45, -2.08],
    0.3,
    0.62,
    [1, 1.05, 0.82],
    [0.1, 0, 0.3],
  );
  addEllipsoid(builder, MARBLE_SHADE, [0.16, 2.08, -2.04], [0.23, 0.27, 0.22]);
  for (const [x, z, tilt] of [
    [-1.05, -1.92, 0.2],
    [0.93, -2.02, -0.18],
    [0.1, -2.62, 0.06],
  ] as const) {
    addCapsule(
      builder,
      MARBLE,
      [x, 1.42, z],
      0.24,
      0.58,
      [1, 1.12, 0.8],
      [0, 0, tilt],
    );
    addEllipsoid(builder, MARBLE, [x - tilt * 0.28, 2.04, z], [0.2, 0.24, 0.2]);
  }
  for (const [x, z, scale] of [
    [-0.46, -2.03, 0.24],
    [0.48, -2.16, 0.2],
    [0.02, -2.42, 0.18],
  ] as const) {
    addEllipsoid(builder, RHINEGOLD, [x, 0.92, z], [scale, scale * 0.7, scale]);
  }
}

function createCanopyGlazing(): Mesh {
  const geometry = barrelShellGeometry();
  const dayMaterial = new MeshBasicMaterial({
    color: PLEXIGLASS,
    depthWrite: false,
    opacity: 0.29,
    side: DoubleSide,
    transparent: true,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: 0x92b6c2,
    depthWrite: false,
    metalness: 0,
    opacity: 0.34,
    roughness: 0.28,
    side: DoubleSide,
    transparent: true,
  });
  dayMaterial.name = "Wagner canopy day plexiglass";
  nightMaterial.name = "Wagner canopy night plexiglass";
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = "Richard Wagner open plexiglass barrel vault";
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData = {
    dayMaterial,
    nightMaterial,
    openCanopy: true,
    textureFree: true,
  };
  return mesh;
}

function finishLayer(
  builder: Builder,
  name: string,
  userData: Record<string, unknown>,
): Group {
  const layer = finishDrawnGroup(builder, { name });
  if (!layer) throw new Error(`${name} geometry is empty`);
  Object.assign(layer.userData, userData);
  return layer;
}

/** Source-owned smooth model used by Day, Night, Snowstorm and Schwellenraum. */
export function createWagnerMemorial(): Group {
  const root = new Group();
  root.name = "Richard Wagner source-bound memorial";
  root.position.set(...WAGNER_WORLD_M);
  root.rotation.y = WAGNER_YAW_RAD;
  root.userData = {
    apiVersion: WAGNER_MEMORIAL_PROFILE.apiVersion,
    modes: ["day", "night", "snowstorm", "schwellenraum"],
    ownedOsmKey: WAGNER_MEMORIAL_PROFILE.osmKey,
    profile: WAGNER_MEMORIAL_PROFILE,
    schwellenraumGeschuetzt: false,
    sourceBounded: true,
    suppressesGenericModels: true,
    texturePolicy: WAGNER_MEMORIAL_PROFILE.renderPolicy.texturePolicy,
    wagnerMemorialSmooth: true,
  };

  const body = createBuilder();
  addMonumentBody(body);
  root.add(
    finishLayer(body, "Richard Wagner six-metre marble ensemble", {
      inscription: WAGNER_MEMORIAL_PROFILE.inscription,
      material: WAGNER_MEMORIAL_PROFILE.materials,
      measuredHeightM: 6,
      operaFigures: WAGNER_MEMORIAL_PROFILE.operaFigures,
      seatedFigureHeightM: 2.7,
      sourceBounded: true,
    }),
  );

  const steel = createBuilder();
  addCanopySteel(steel);
  root.add(
    finishLayer(steel, "Richard Wagner open steel canopy", {
      canopyForm: WAGNER_MEMORIAL_PROFILE.canopy.form,
      sourceBounded: true,
    }),
  );
  root.add(createCanopyGlazing());

  const snow = createBuilder();
  addGeometry(snow, barrelShellGeometry(0.055), SNOW, false);
  addBox(snow, SNOW, [0, 3.36, -0.05], [2.82, 0.08, 2.45]);
  addEllipsoid(snow, SNOW, [-0.1, 6.025, -0.07], [0.38, 0.05, 0.34]);
  const snowLayer = finishLayer(snow, "Richard Wagner reversible snow caps", {
    reversible: true,
    snowOnly: true,
  });
  snowLayer.visible = false;
  snowLayer.traverse((object) => {
    object.visible = false;
    object.userData.snowOnly = true;
    object.userData.snowActive = false;
  });
  root.add(snowLayer);
  return root;
}

/** Snow visibility changes only the snow batch; authored transforms stay fixed. */
export function setWagnerMemorialSnow(
  root: Object3D | null,
  enabled: boolean,
): void {
  if (!root) return;
  root.traverse((object) => {
    if (object.userData.snowOnly !== true) return;
    object.visible = enabled;
    object.userData.snowActive = enabled;
  });
}

/** Hide the smooth representation only after its block-native replacement exists. */
export function setWagnerMemorialSmoothVisibility(
  root: Object3D | null,
  visible: boolean,
): void {
  if (!root) return;
  root.traverse((object) => {
    if (object.userData.wagnerMemorialSmooth === true) object.visible = visible;
  });
}

function worldToLocal(x: number, z: number): readonly [number, number] {
  const dx = x - WAGNER_WORLD_M[0];
  const dz = z - WAGNER_WORLD_M[2];
  const cosine = Math.cos(WAGNER_YAW_RAD);
  const sine = Math.sin(WAGNER_YAW_RAD);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

function withinRectangle(
  x: number,
  z: number,
  halfWidth: number,
  halfDepth: number,
  padding: number,
): boolean {
  return (
    Math.abs(x) <= halfWidth + padding && Math.abs(z) <= halfDepth + padding
  );
}

/**
 * Actual low platform, sculptural mass and four canopy posts. The high vault
 * is deliberately not a pedestrian wall; both long approaches stay open.
 */
export function wagnerMemorialSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  if (![x, y, z, radiusM].every(Number.isFinite)) return false;
  const padding = Math.max(0, radiusM);
  const [localX, localZ] = worldToLocal(x, z);
  const localY = y - WAGNER_WORLD_M[1];
  if (localY < -padding) return false;

  if (
    localY <= 0.86 + padding &&
    withinRectangle(localX, localZ, 3.33, 3.08, padding)
  ) {
    return true;
  }
  if (
    localY <= 3.36 + padding &&
    withinRectangle(localX, localZ, 1.82, 1.7, padding)
  ) {
    return true;
  }
  if (
    localY <= WAGNER_MEMORIAL_PROFILE.totalHeightM + padding &&
    withinRectangle(localX, localZ, 1.05, 1.25, padding)
  ) {
    return true;
  }
  // The opera groups are real marble masses outside the central pedestal.
  for (const [figureX, figureZ, radius, height] of [
    [0, 2.05, 0.92, 2.75],
    [-1.95, 0.25, 1.02, 2.5],
    [2.12, 0.18, 1.08, 2.2],
    [0, -2.12, 1.42, 2.45],
  ] as const) {
    if (
      localY <= height + padding &&
      (localX - figureX) ** 2 + (localZ - figureZ) ** 2 <=
        (radius + padding) ** 2
    ) {
      return true;
    }
  }
  for (const [postX, postZ] of WAGNER_MEMORIAL_PROFILE.canopy.postLocalXZ) {
    if (
      localY <= WAGNER_MEMORIAL_PROFILE.canopy.eaveHeightM + padding &&
      (localX - postX) ** 2 + (localZ - postZ) ** 2 <= (0.12 + padding) ** 2
    ) {
      return true;
    }
  }
  return false;
}

function pointInRing(
  x: number,
  z: number,
  ring: readonly (readonly [number, number])[],
): boolean {
  let odd = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [xi, zi] = ring[index];
    const [xj, zj] = ring[previous];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      odd = !odd;
    }
  }
  return odd;
}

function squaredDistanceToSegment(
  x: number,
  z: number,
  from: readonly [number, number],
  to: readonly [number, number],
): number {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= Number.EPSILON) {
    return (x - from[0]) ** 2 + (z - from[1]) ** 2;
  }
  const amount = Math.max(
    0,
    Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared),
  );
  const nearestX = from[0] + amount * dx;
  const nearestZ = from[1] + amount * dz;
  return (x - nearestX) ** 2 + (z - nearestZ) ** 2;
}

function pointInExpandedRing(
  x: number,
  z: number,
  ring: readonly (readonly [number, number])[],
  marginM: number,
): boolean {
  if (pointInRing(x, z, ring)) return true;
  const marginSquared = marginM * marginM;
  return ring.some(
    (to, index) =>
      squaredDistanceToSegment(
        x,
        z,
        ring[(index + ring.length - 1) % ring.length],
        to,
      ) <= marginSquared,
  );
}

/** Only the committed false solid canopy columns yield to the block model. */
export function wagnerMemorialVoxelReplacementAt(
  x: number,
  z: number,
  heightM?: number,
  bottomY?: number,
): boolean {
  if (![x, z].every(Number.isFinite)) return false;
  if (
    heightM !== undefined &&
    (!Number.isFinite(heightM) ||
      Math.abs(heightM - WAGNER_MEMORIAL_PROFILE.voxelSource.columnHeightM) >
        0.05)
  ) {
    return false;
  }
  if (
    bottomY !== undefined &&
    (!Number.isFinite(bottomY) ||
      Math.abs(bottomY - WAGNER_MEMORIAL_PROFILE.voxelSource.bottomY) > 0.05)
  ) {
    return false;
  }
  return WAGNER_MEMORIAL_PROFILE.voxelSource.columnCentersWorldM.some(
    ([columnX, columnZ]) =>
      Math.abs(x - columnX) <= 0.05 && Math.abs(z - columnZ) <= 0.05,
  );
}

/**
 * The compiled LoD2 obstacle is closed. Permit only the empty parts of that
 * one source envelope; the authored solid helper keeps every real mass solid.
 */
export function wagnerMemorialWalkableInteriorAt(
  x: number,
  y: number,
  z: number,
  sourceId?: string,
  radiusM = 0,
): boolean {
  if (
    !WAGNER_MEMORIAL_PRISM_IDS.has(sourceId ?? "") ||
    ![x, y, z, radiusM].every(Number.isFinite)
  ) {
    return false;
  }
  const padding = Math.max(0, radiusM);
  if (
    y < WAGNER_WORLD_M[1] - padding ||
    y > WAGNER_MEMORIAL_PROFILE.lod2.topY + padding ||
    !pointInExpandedRing(
      x,
      z,
      WAGNER_LOD2_RING_WORLD_M,
      WAGNER_WALKABLE_CAPSULE_WIDTH_M + padding,
    )
  ) {
    return false;
  }
  return !wagnerMemorialSolidAt(x, y, z, padding);
}

function localToWorld(
  local: readonly [number, number, number],
): readonly [number, number, number] {
  const cosine = Math.cos(WAGNER_YAW_RAD);
  const sine = Math.sin(WAGNER_YAW_RAD);
  return [
    WAGNER_WORLD_M[0] + cosine * local[0] + sine * local[2],
    WAGNER_WORLD_M[1] + local[1],
    WAGNER_WORLD_M[2] - sine * local[0] + cosine * local[2],
  ];
}

function pushBlock(
  blocks: Block[],
  local: readonly [number, number, number],
  color: number,
  size: number,
  scale: readonly [number, number, number] = [1, 1, 1],
): void {
  blocks.push({
    color,
    position: localToWorld(local),
    rotationY: WAGNER_YAW_RAD,
    scale: [size * scale[0], size * scale[1], size * scale[2]],
  });
}

function pushFilledRectangle(
  blocks: Block[],
  halfX: number,
  halfZ: number,
  y: number,
  color: number,
  size: number,
): void {
  for (let x = -halfX; x <= halfX; x += 1) {
    for (let z = -halfZ; z <= halfZ; z += 1) {
      pushBlock(blocks, [x * size, y, z * size], color, size);
    }
  }
}

function createMinecraftBlocks(): Block[] {
  const size = 0.68;
  const blocks: Block[] = [];
  pushFilledRectangle(blocks, 4, 4, size / 2, MARBLE_SHADE, size);
  pushFilledRectangle(blocks, 4, 3, size * 1.5, MARBLE, size);
  for (let level = 2; level <= 4; level += 1) {
    pushFilledRectangle(blocks, 2, 2, size * (level + 0.5), MARBLE, size);
  }
  // Seated composer and throne, kept sparse enough to read as figure rather
  // than another solid pedestal tier.
  for (const local of [
    [-0.62, 3.72, -0.35],
    [0, 3.72, -0.35],
    [0.62, 3.72, -0.35],
    [-0.62, 4.34, -0.35],
    [0, 4.34, -0.1],
    [0.62, 4.34, -0.35],
    [0, 4.96, -0.08],
    [0, 5.58, -0.02],
    [0, 5.92, -0.05],
    [-0.62, 4.34, 0.27],
    [0.62, 4.34, 0.27],
  ] as const) {
    pushBlock(blocks, local, MARBLE, size);
  }
  for (const [x, z] of [
    [0, 2.05],
    [-1.86, 0.25],
    [1.86, 0.25],
    [-0.62, -2.05],
    [0, -2.05],
    [0.62, -2.05],
  ] as const) {
    pushBlock(blocks, [x, 1.24, z], MARBLE, size);
    pushBlock(blocks, [x, 1.86, z], MARBLE, size);
  }
  for (const [x, z] of [
    [-0.45, -2.5],
    [0, -2.5],
    [0.45, -2.5],
  ] as const) {
    pushBlock(blocks, [x, 0.93, z], RHINEGOLD, size);
  }

  const halfLengthCells = 7;
  const halfWidthCells = 7;
  for (const xCell of [-halfWidthCells, halfWidthCells]) {
    for (const zCell of [-halfLengthCells, halfLengthCells]) {
      for (let level = 0; level <= 10; level += 1) {
        pushBlock(
          blocks,
          [xCell * size, size * (level + 0.5), zCell * size],
          STEEL_DARK,
          size,
          [0.38, 1, 0.38],
        );
      }
    }
  }
  // One block-thick, curved glass roof. Its underside remains wholly open.
  for (let xCell = -halfWidthCells; xCell <= halfWidthCells; xCell += 1) {
    const normalised = xCell / halfWidthCells;
    const roofY =
      WAGNER_MEMORIAL_PROFILE.canopy.eaveHeightM +
      Math.sqrt(Math.max(0, 1 - normalised * normalised)) *
        (WAGNER_MEMORIAL_PROFILE.canopy.ridgeHeightM -
          WAGNER_MEMORIAL_PROFILE.canopy.eaveHeightM);
    for (let zCell = -halfLengthCells; zCell <= halfLengthCells; zCell += 1) {
      pushBlock(
        blocks,
        [xCell * size, roofY, zCell * size],
        MINECRAFT_GLASS,
        size,
      );
    }
  }
  return blocks;
}

/** Complete block-native counterpart in one texture-free instanced draw call. */
export function createWagnerMemorialMinecraft(): InstancedMesh {
  const blocks = createMinecraftBlocks();
  if (blocks.length > WAGNER_MEMORIAL_PROFILE.renderPolicy.maxMinecraftBlocks) {
    throw new Error(`Wagner Minecraft budget exceeded: ${blocks.length}`);
  }
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x2b3132,
    emissiveIntensity: 0.14,
    flatShading: true,
    metalness: 0,
    opacity: 1,
    roughness: 0.93,
    transparent: false,
  });
  material.name = "Richard Wagner Minecraft material";
  const mesh = new InstancedMesh(geometry, material, blocks.length);
  mesh.name = "Richard Wagner Minecraft block batch";
  const dummy = new Object3D();
  blocks.forEach((block, index) => {
    dummy.position.set(...block.position);
    dummy.rotation.set(0, block.rotationY, 0);
    dummy.scale.set(...block.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, new Color(block.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.frustumCulled = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    blockCount: blocks.length,
    blockNative: true,
    exactOneBatch: true,
    mode: "minecraft",
    ownedOsmKey: WAGNER_MEMORIAL_PROFILE.osmKey,
    profile: WAGNER_MEMORIAL_PROFILE,
    smoothGeometryExcluded: true,
    textureFree: true,
  };
  return mesh;
}

/** Test/QA helper: count only real GPU renderables, not semantic cue groups. */
export function wagnerMemorialRenderStats(root: Object3D): {
  renderables: number;
  renderedVertices: number;
} {
  let renderables = 0;
  let renderedVertices = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    renderables += 1;
    renderedVertices += object.geometry.getAttribute("position")?.count ?? 0;
  });
  return { renderables, renderedVertices };
}
