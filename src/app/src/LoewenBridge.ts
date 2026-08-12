import {
  BoxGeometry,
  ConeGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

/**
 * The rebuilt Löwenbrücke, tied to the committed OSM centreline.
 *
 * Berlin publishes a 17 m by 2 m wooden suspension bridge; the more precise
 * 17.3 m length below follows the monument inventory cited by the owner. OSM
 * way 1411957328 fixes the plan position and bearing. The small sculptural
 * and joinery dimensions remain photo-bounded reconstruction, not a survey.
 */
export const LOEWEN_BRIDGE_PROFILE = {
  axis: [0.894279, 0.447511] as const,
  geometryStatus:
    "published 17.3 m bridge length and 2.0 m timber-deck width on the OSM centreline; sculptural, cable, railing and abutment dimensions reconstructed from owner-supplied August 2026 photographs",
  kind: "suspension" as const,
  name: "Löwenbrücke",
  osmWayId: "1411957328",
  sourceEpsg25833Line: [
    [387741.516, 5819315.145],
    [387724.668, 5819323.576],
  ] as const,
  sourceUrls: [
    "https://www.openstreetmap.org/way/1411957328",
    "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-gartendenkmale/artikel.1668713.php",
    "https://www.berlin.de/sen/uvk/presse/pressemitteilungen/2025/pressemitteilung.1576809.php",
    "https://de.wikipedia.org/wiki/L%C3%B6wenbr%C3%BCcke_(Berlin)",
  ] as const,
  completed: 1838,
  designer:
    "Ludwig Ferdinand Hesse; lion sculptures by Christian Friedrich Tieck",
  clearSpanM: 13,
  surveyedDeck: { halfLengthM: 8.65, halfWidthM: 1.0 },
  visualReference: "owner-supplied photographs, August 2026",
  world: [-1766.908, 680.6395] as const,
} as const;

export const LOEWEN_BRIDGE_TRUSS_BAYS = 9;
export const LOEWEN_BRIDGE_DECK_BOARD_COUNT = 10;
export const LOEWEN_BRIDGE_LION_COUNT = 4;
export const LOEWEN_BRIDGE_MAIN_CABLE_COUNT = 4;
export const LOEWEN_BRIDGE_HANGERS_PER_SIDE = 11;

const DECK_LENGTH_M = LOEWEN_BRIDGE_PROFILE.clearSpanM;
const DECK_WIDTH_M = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM * 2;
const HALF_LENGTH_M = LOEWEN_BRIDGE_PROFILE.clearSpanM / 2;
const HALF_WIDTH_M = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM;
const HALF_OVERALL_LENGTH_M = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfLengthM;

const PALETTE = {
  bronze: 0xb39756,
  bronzeDark: 0x806a3f,
  cable: 0xd8c894,
  cableDark: 0xa99561,
  deckDark: 0x9e896c,
  deckLight: 0xc5b99f,
  deckMid: 0xb4a68d,
  eye: 0x302b22,
  sandstone: 0xe5dbc0,
  sandstoneShade: 0xcbbd9e,
  structure: 0xe8d79f,
} as const;

type Point3 = readonly [number, number, number];

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = false,
): void {
  // drawnKit's boxes are indexed. IcosahedronGeometry is not, so give the
  // sculptural primitives a trivial index before the shared merge; otherwise
  // Three rejects the whole bridge and only its ink survives.
  if (!geometry.index) {
    const count = geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addBeam(
  builder: Builder,
  color: number,
  start: Point3,
  end: Point3,
  width: number,
  depth = width,
  inked = false,
): void {
  const startVector = new Vector3(...start);
  const endVector = new Vector3(...end);
  const delta = endVector.clone().sub(startVector);
  const length = delta.length();
  if (length < 1e-5) {
    return;
  }
  const geometry = new BoxGeometry(width, length, depth);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      delta.normalize(),
    ),
  );
  geometry.translate(
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  );
  addPaintedGeometry(builder, geometry, color, inked);
}

function addEllipsoid(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  inked = false,
): void {
  const geometry = new IcosahedronGeometry(1, 1);
  geometry.scale(scaleX, scaleY, scaleZ);
  geometry.translate(x, y, z);
  addPaintedGeometry(builder, geometry, color, inked);
}

function addEar(builder: Builder, x: number, y: number, z: number): void {
  const geometry = new ConeGeometry(0.09, 0.2, 5);
  geometry.translate(x, y, z);
  addPaintedGeometry(builder, geometry, PALETTE.bronzeDark);
}

function addLion(builder: Builder, end: -1 | 1, side: -1 | 1): void {
  const facing = -end;
  const pedestalX = end * (HALF_LENGTH_M + 0.55);
  const pedestalZ = side * (HALF_WIDTH_M + 0.42);
  const bodyZ = side * (HALF_WIDTH_M + 0.41);
  const headZ = side * (HALF_WIDTH_M + 0.22);

  addBox(
    builder,
    PALETTE.sandstoneShade,
    pedestalX,
    0.18,
    pedestalZ,
    1.62,
    0.58,
    1.14,
  );
  addBox(
    builder,
    PALETTE.sandstone,
    pedestalX,
    0.52,
    pedestalZ,
    1.78,
    0.12,
    1.28,
  );

  const rearX = pedestalX - facing * 0.25;
  const chestX = pedestalX + facing * 0.17;
  addEllipsoid(
    builder,
    PALETTE.bronze,
    pedestalX,
    0.95,
    bodyZ,
    0.5,
    0.46,
    0.32,
    true,
  );
  addEllipsoid(builder, PALETTE.bronzeDark, rearX, 0.8, bodyZ, 0.4, 0.34, 0.35);
  addBeam(
    builder,
    PALETTE.bronze,
    [chestX, 1.03, bodyZ],
    [pedestalX + facing * 0.32, 1.36, headZ],
    0.3,
    0.34,
  );

  const maneX = pedestalX + facing * 0.35;
  const headX = pedestalX + facing * 0.45;
  const muzzleX = pedestalX + facing * 0.61;
  addEllipsoid(
    builder,
    PALETTE.bronzeDark,
    maneX,
    1.44,
    headZ,
    0.34,
    0.38,
    0.31,
    true,
  );
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    addEllipsoid(
      builder,
      index % 2 === 0 ? PALETTE.bronze : PALETTE.bronzeDark,
      maneX - facing * 0.03 + Math.cos(angle) * 0.21,
      1.43 + Math.sin(angle) * 0.27,
      headZ + Math.cos(angle + Math.PI / 2) * 0.21,
      0.12,
      0.14,
      0.11,
    );
  }
  addEllipsoid(
    builder,
    PALETTE.bronze,
    headX,
    1.48,
    headZ,
    0.24,
    0.25,
    0.22,
    true,
  );
  addEllipsoid(
    builder,
    PALETTE.bronzeDark,
    muzzleX,
    1.42,
    side * (HALF_WIDTH_M + 0.12),
    0.17,
    0.13,
    0.15,
  );
  addEllipsoid(
    builder,
    PALETTE.eye,
    headX + facing * 0.1,
    1.53,
    headZ - side * 0.19,
    0.035,
    0.045,
    0.03,
  );
  for (const earSide of [-1, 1] as const) {
    addEar(builder, headX - facing * 0.05, 1.74, headZ + earSide * 0.13);
  }

  for (const legSide of [-1, 1] as const) {
    const legZ = bodyZ + legSide * 0.13;
    addBeam(
      builder,
      PALETTE.bronze,
      [chestX + facing * 0.09, 1.04, legZ],
      [chestX + facing * 0.22, 0.62, legZ],
      0.12,
      0.14,
    );
    addBox(
      builder,
      PALETTE.bronzeDark,
      chestX + facing * 0.3,
      0.61,
      legZ,
      0.34,
      0.12,
      0.17,
      0,
      false,
    );
  }
  addEllipsoid(
    builder,
    PALETTE.bronze,
    rearX - facing * 0.08,
    0.65,
    bodyZ,
    0.4,
    0.15,
    0.31,
  );
  addBeam(
    builder,
    PALETTE.bronzeDark,
    [rearX - facing * 0.25, 0.85, bodyZ + side * 0.2],
    [rearX - facing * 0.5, 1.08, bodyZ + side * 0.31],
    0.08,
  );
  addBeam(
    builder,
    PALETTE.bronzeDark,
    [rearX - facing * 0.5, 1.08, bodyZ + side * 0.31],
    [rearX - facing * 0.36, 1.26, bodyZ + side * 0.27],
    0.07,
  );
}

function cableHeight(localX: number): number {
  const normalized = Math.min(1, Math.abs(localX) / (HALF_LENGTH_M + 0.12));
  return 0.98 + 0.44 * normalized ** 2;
}

function addSuspensionSystem(builder: Builder): void {
  const cableHalfLength = HALF_LENGTH_M + 0.12;
  const cableSegments = 18;
  for (const side of [-1, 1] as const) {
    for (const strandOffset of [-0.035, 0.035] as const) {
      const cableZ = side * (HALF_WIDTH_M + 0.1 + strandOffset);
      for (let index = 0; index < cableSegments; index += 1) {
        const x0 =
          -cableHalfLength + (index / cableSegments) * cableHalfLength * 2;
        const x1 =
          -cableHalfLength +
          ((index + 1) / cableSegments) * cableHalfLength * 2;
        addBeam(
          builder,
          strandOffset < 0 ? PALETTE.cableDark : PALETTE.cable,
          [x0, cableHeight(x0), cableZ],
          [x1, cableHeight(x1), cableZ],
          0.045,
          0.045,
        );
      }
    }
    for (let index = 1; index <= LOEWEN_BRIDGE_HANGERS_PER_SIDE; index += 1) {
      const x =
        -HALF_LENGTH_M +
        (index / (LOEWEN_BRIDGE_HANGERS_PER_SIDE + 1)) * DECK_LENGTH_M;
      addBeam(
        builder,
        PALETTE.cableDark,
        [x, 0.28, side * (HALF_WIDTH_M + 0.08)],
        [x, cableHeight(x) - 0.02, side * (HALF_WIDTH_M + 0.08)],
        0.035,
        0.035,
      );
    }
  }
}

function addWoodenSuperstructure(builder: Builder): void {
  addBox(
    builder,
    PALETTE.deckDark,
    0,
    -0.14,
    0,
    DECK_LENGTH_M,
    0.28,
    DECK_WIDTH_M,
  );
  const boardWidth = (DECK_WIDTH_M - 0.12) / LOEWEN_BRIDGE_DECK_BOARD_COUNT;
  for (let board = 0; board < LOEWEN_BRIDGE_DECK_BOARD_COUNT; board += 1) {
    const z = -DECK_WIDTH_M / 2 + 0.06 + boardWidth * (board + 0.5);
    addBox(
      builder,
      board % 3 === 0 ? PALETTE.deckLight : PALETTE.deckMid,
      0,
      0.025,
      z,
      DECK_LENGTH_M - 0.12,
      0.05,
      boardWidth - 0.025,
      0,
      false,
    );
  }
  for (let bay = 0; bay <= LOEWEN_BRIDGE_TRUSS_BAYS; bay += 1) {
    const x = -HALF_LENGTH_M + (bay / LOEWEN_BRIDGE_TRUSS_BAYS) * DECK_LENGTH_M;
    addBox(
      builder,
      PALETTE.deckDark,
      x,
      -0.25,
      0,
      0.16,
      0.18,
      DECK_WIDTH_M + 0.24,
      0,
      false,
    );
  }

  const bayLength = DECK_LENGTH_M / LOEWEN_BRIDGE_TRUSS_BAYS;
  for (const side of [-1, 1] as const) {
    const z = side * (HALF_WIDTH_M + 0.02);
    addBox(
      builder,
      PALETTE.structure,
      0,
      0.15,
      z,
      DECK_LENGTH_M,
      0.13,
      0.13,
      0,
      false,
    );
    addBox(
      builder,
      PALETTE.structure,
      0,
      0.79,
      z,
      DECK_LENGTH_M,
      0.13,
      0.14,
      0,
      false,
    );
    for (let bay = 0; bay <= LOEWEN_BRIDGE_TRUSS_BAYS; bay += 1) {
      const x = -HALF_LENGTH_M + bay * bayLength;
      addBeam(
        builder,
        PALETTE.structure,
        [x, 0.16, z],
        [x, 0.79, z],
        0.08,
        0.08,
      );
      if (bay === LOEWEN_BRIDGE_TRUSS_BAYS) {
        continue;
      }
      const nextX = x + bayLength;
      addBeam(
        builder,
        bay % 2 === 0 ? PALETTE.structure : PALETTE.cable,
        [x + 0.08, 0.19, z],
        [nextX - 0.08, 0.76, z],
        0.07,
        0.07,
      );
      addBeam(
        builder,
        bay % 2 === 0 ? PALETTE.cable : PALETTE.structure,
        [x + 0.08, 0.76, z],
        [nextX - 0.08, 0.19, z],
        0.07,
        0.07,
      );
    }
  }
}

function addApproaches(builder: Builder): void {
  const approachLength = HALF_OVERALL_LENGTH_M - HALF_LENGTH_M;
  const approachCentre = HALF_LENGTH_M + approachLength / 2;
  for (const end of [-1, 1] as const) {
    addBox(
      builder,
      PALETTE.deckMid,
      end * approachCentre,
      -0.015,
      0,
      approachLength,
      0.09,
      DECK_WIDTH_M + 0.1,
      0,
      false,
    );
    for (const side of [-1, 1] as const) {
      addBox(
        builder,
        PALETTE.sandstoneShade,
        end * approachCentre,
        0.12,
        side * (HALF_WIDTH_M + 0.42),
        approachLength,
        0.48,
        0.54,
      );
      addBox(
        builder,
        PALETTE.sandstone,
        end * approachCentre,
        0.39,
        side * (HALF_WIDTH_M + 0.42),
        approachLength,
        0.09,
        0.64,
      );
    }
  }
}

export function createLoewenBridge(ground: VoxelPayload): Group {
  const builder = createBuilder();
  addWoodenSuperstructure(builder);
  addApproaches(builder);
  addSuspensionSystem(builder);
  for (const end of [-1, 1] as const) {
    for (const side of [-1, 1] as const) {
      addLion(builder, end, side);
    }
  }

  const group =
    finishDrawnGroup(builder, { name: "Löwenbrücke" }) ?? new Group();
  group.name = "Löwenbrücke recognition model";
  group.position.set(
    LOEWEN_BRIDGE_PROFILE.world[0],
    (worldGroundSampler(ground)(...LOEWEN_BRIDGE_PROFILE.world) ?? 5.2) + 0.12,
    LOEWEN_BRIDGE_PROFILE.world[1],
  );
  group.rotation.y = -Math.atan2(
    LOEWEN_BRIDGE_PROFILE.axis[1],
    LOEWEN_BRIDGE_PROFILE.axis[0],
  );
  group.userData = {
    deckBoardCount: LOEWEN_BRIDGE_DECK_BOARD_COUNT,
    geometryStatus: LOEWEN_BRIDGE_PROFILE.geometryStatus,
    hangerCount: LOEWEN_BRIDGE_HANGERS_PER_SIDE * 2,
    keepInMinecraft: true,
    lionCount: LOEWEN_BRIDGE_LION_COUNT,
    mainCableCount: LOEWEN_BRIDGE_MAIN_CABLE_COUNT,
    osmWayId: LOEWEN_BRIDGE_PROFILE.osmWayId,
    sourceUrls: LOEWEN_BRIDGE_PROFILE.sourceUrls,
    trussBayCount: LOEWEN_BRIDGE_TRUSS_BAYS,
    visualReference: LOEWEN_BRIDGE_PROFILE.visualReference,
  };
  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return group;
}
