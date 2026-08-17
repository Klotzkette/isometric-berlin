import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Quaternion,
  Vector3,
  type Mesh,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalAccentInk,
} from "./architecturalInk";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import { createSnowAccents } from "./modeOnlyDetails";

/**
 * The rebuilt Löwenbrücke, tied to the committed OSM centreline.
 *
 * The official "Masterplan Brücken Berlin", Appendix 1 (data status 06/2025),
 * records the rebuilt 2025 structure as 18.30 x 1.88 m. The engineers publish
 * the complementary project dimensions: 26.80 m overall, 17.60 m main span,
 * 0.80 m deep timber superstructure and four 31.3 mm open spiral ropes. OSM
 * way 1411957328 fixes the plan position and bearing. Small sculptural and
 * joinery dimensions remain source-photo-bounded reconstruction, not a survey.
 */
export const LOEWEN_BRIDGE_PROFILE = {
  axis: [0.894279, 0.447511] as const,
  geometryStatus:
    "Masterplan Bruecken Berlin Appendix 1 (data status 06/2025) length, width, material and construction year plus engineer-published overall length, main span, superstructure depth and rope specification on the OSM centreline; 2025 steel-rope handrails and mesh safety fields follow the Landesdenkmalamt description and current CC0 photographs; sculptural, mesh-spacing and joinery detail is source-photo-bounded reconstruction, not a fixture survey",
  inventory: {
    areaM2: 34,
    bridgeNumber: "3446527",
    built: 2025,
    conditionGrade: 1,
    construction: "Haengebruecke",
    dataStatus: "06/2025",
    lengthM: 18.3,
    material: "Holz",
    widthM: 1.88,
  },
  engineering: {
    mainSpanM: 17.6,
    openSpiralRopeCount: 4,
    openSpiralRopeDiameterMm: 31.3,
    overallLengthM: 26.8,
    superstructureDepthM: 0.8,
    widthM: 2,
  },
  kind: "suspension" as const,
  name: "Löwenbrücke",
  osmWayId: "1411957328",
  sourceEpsg25833Line: [
    [387741.516, 5819315.145],
    [387724.668, 5819323.576],
  ] as const,
  sourceUrls: [
    "https://www.openstreetmap.org/way/1411957328",
    "https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf",
    "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-gartendenkmale/artikel.1668713.php",
    "https://www.berlin.de/sen/uvk/presse/pressemitteilungen/2025/pressemitteilung.1576809.php",
    "https://www.sbp.de/projekt/loewenbruecke/",
    "https://commons.wikimedia.org/wiki/File:L%C3%B6wenbr%C3%BCcke_Gro%C3%9Fer_Tiergarten_Berlin.jpg",
    "https://commons.wikimedia.org/wiki/File:L%C3%B6wenbr%C3%BCcke_Gro%C3%9Fer_Tiergarten_Berlin_10.jpg",
  ] as const,
  completed: 1838,
  designer:
    "Ludwig Ferdinand Hesse; lion sculptures by Christian Friedrich Tieck",
  surveyedDeck: { halfLengthM: 9.15, halfWidthM: 0.94 },
  visualReferences: [
    {
      artist: "Singlespeedfahrer",
      captured: "2025-07-04",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:L%C3%B6wenbr%C3%BCcke_Gro%C3%9Fer_Tiergarten_Berlin.jpg",
      title: "File:Löwenbrücke Großer Tiergarten Berlin.jpg",
    },
    {
      artist: "Singlespeedfahrer",
      captured: "2025-07-04",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:L%C3%B6wenbr%C3%BCcke_Gro%C3%9Fer_Tiergarten_Berlin_10.jpg",
      title: "File:Löwenbrücke Großer Tiergarten Berlin 10.jpg",
    },
  ] as const,
  world: [-1766.908, 680.6395] as const,
} as const;

export const LOEWEN_BRIDGE_TRUSS_BAYS = 9;
export const LOEWEN_BRIDGE_DECK_BOARD_COUNT = 10;
export const LOEWEN_BRIDGE_LION_COUNT = 4;
export const LOEWEN_BRIDGE_MAIN_CABLE_COUNT = 4;
export const LOEWEN_BRIDGE_HANGERS_PER_SIDE = 11;
export const LOEWEN_BRIDGE_SAFETY_HANDRAIL_COUNT = 2;
export const LOEWEN_BRIDGE_SAFETY_POST_COUNT =
  (LOEWEN_BRIDGE_TRUSS_BAYS + 1) * 2;
export const LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT =
  LOEWEN_BRIDGE_TRUSS_BAYS * 2;
export const LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD = 12;

const DECK_LENGTH_M = LOEWEN_BRIDGE_PROFILE.inventory.lengthM;
const DECK_WIDTH_M = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM * 2;
const HALF_LENGTH_M = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfLengthM;
const HALF_WIDTH_M = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM;
const HALF_OVERALL_LENGTH_M =
  LOEWEN_BRIDGE_PROFILE.engineering.overallLengthM / 2;

const PALETTE = {
  bronze: 0xd4a95a,
  bronzeDark: 0xa77b3f,
  cable: 0xdcca9b,
  cableDark: 0xb39b69,
  deckDark: 0x9e896c,
  deckLight: 0xc5b99f,
  deckMid: 0xb4a68d,
  eye: 0x302b22,
  sandstone: 0xeee3ca,
  sandstoneShade: 0xd1c3a4,
  safetyMesh: 0x8e8878,
  safetySteel: 0xaaa087,
  structure: 0xead99f,
} as const;

const SAFETY_HANDRAIL_HEIGHT_M = 1.12;
const SAFETY_MESH_BOTTOM_M = 0.82;
const SAFETY_MESH_TOP_M = 1.08;
const SAFETY_MESH_SUBDIVISIONS =
  LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD / 2;

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

/**
 * The 2025 DIN-compliant fall protection is deliberately legible as a modern
 * intervention above Hesse's low timber truss. The Landesdenkmalamt names a
 * steel-rope handrail with mesh fields; current CC0 photographs bound the
 * straight rail, slender post rhythm and diamond-like wire infill. Wire pitch
 * and the 1.12 m model height are recognition-scale estimates, not a fixture
 * survey. Everything sits just outside the 1.88 m walking envelope.
 */
function createModernSafetySystem(): Group {
  const safety = new Group();
  safety.name = "Löwenbrücke modern safety system";
  const handrails = createBuilder();
  const posts = createBuilder();
  const bayLength = DECK_LENGTH_M / LOEWEN_BRIDGE_TRUSS_BAYS;
  const meshPositions: number[] = [];

  for (const side of [-1, 1] as const) {
    const z = side * (HALF_WIDTH_M + 0.045);
    addBeam(
      handrails,
      PALETTE.safetySteel,
      [-HALF_LENGTH_M, SAFETY_HANDRAIL_HEIGHT_M, z],
      [HALF_LENGTH_M, SAFETY_HANDRAIL_HEIGHT_M, z],
      0.045,
      0.045,
      true,
    );

    for (let bay = 0; bay <= LOEWEN_BRIDGE_TRUSS_BAYS; bay += 1) {
      const x = -HALF_LENGTH_M + bay * bayLength;
      addBeam(
        posts,
        PALETTE.safetySteel,
        [x, 0.79, z],
        [x, SAFETY_HANDRAIL_HEIGHT_M, z],
        0.035,
        0.035,
        true,
      );
    }

    for (let bay = 0; bay < LOEWEN_BRIDGE_TRUSS_BAYS; bay += 1) {
      const fieldStart = -HALF_LENGTH_M + bay * bayLength + 0.075;
      const fieldEnd = -HALF_LENGTH_M + (bay + 1) * bayLength - 0.075;
      const fieldStep =
        (fieldEnd - fieldStart) / SAFETY_MESH_SUBDIVISIONS;
      // Six crossed sub-fields read as the fine diamond mesh visible between
      // the timber top chord and the separate straight safety handrail.
      for (let cell = 0; cell < SAFETY_MESH_SUBDIVISIONS; cell += 1) {
        const x0 = fieldStart + cell * fieldStep;
        const x1 = x0 + fieldStep;
        meshPositions.push(
          x0,
          SAFETY_MESH_BOTTOM_M,
          z,
          x1,
          SAFETY_MESH_TOP_M,
          z,
          x0,
          SAFETY_MESH_TOP_M,
          z,
          x1,
          SAFETY_MESH_BOTTOM_M,
          z,
        );
      }
    }
  }

  const handrailGroup = finishDrawnGroup(handrails, {
    name: "Löwenbrücke modern safety handrails",
  });
  if (handrailGroup) safety.add(handrailGroup);
  const postGroup = finishDrawnGroup(posts, {
    name: "Löwenbrücke modern safety posts",
  });
  if (postGroup) safety.add(postGroup);

  const meshGeometry = new BufferGeometry();
  meshGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(meshPositions, 3),
  );
  meshGeometry.computeBoundingSphere();
  const meshMaterial = markArchitecturalAccentInk(
    new LineBasicMaterial({
      depthWrite: false,
      opacity: 0.72,
      transparent: true,
    }),
    PALETTE.safetyMesh,
    "micro",
  );
  const meshFields = new LineSegments(meshGeometry, meshMaterial);
  meshFields.name = "Löwenbrücke modern safety mesh fields";
  meshFields.renderOrder = 3;
  meshFields.userData.fieldCount = LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT;
  meshFields.userData.diagonalsPerField =
    LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD;
  meshFields.userData.photoBounded = true;
  safety.add(meshFields);

  safety.userData = {
    handrailCount: LOEWEN_BRIDGE_SAFETY_HANDRAIL_COUNT,
    meshDiagonalsPerField:
      LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD,
    meshFieldCount: LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT,
    modelHandrailHeightM: SAFETY_HANDRAIL_HEIGHT_M,
    photoBounded: true,
    postCount: LOEWEN_BRIDGE_SAFETY_POST_COUNT,
    sourceUrl:
      "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-gartendenkmale/artikel.1668713.php",
  };
  return safety;
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

function createLoewenBridgeSnowAccents(): Group {
  return createSnowAccents({
    boxes: ([-1, 1] as const).flatMap((end) =>
      ([-1, 1] as const).map((side) => ({
        position: [
          end * (HALF_LENGTH_M + 0.55),
          0.595,
          side * (HALF_WIDTH_M + 0.42),
        ] as const,
        size: [1.72, 0.035, 1.22] as const,
      })),
    ),
    mounds: ([-1, 1] as const).flatMap((end) =>
      ([-1, 1] as const).map((side) => ({
        position: [
          end * (HALF_LENGTH_M + 0.19),
          1.78,
          side * (HALF_WIDTH_M + 0.22),
        ] as const,
        scale: [0.3, 0.065, 0.24] as const,
      })),
    ),
    name: "Löwenbrücke snow accents",
    // Snow is limited to the horizontal modern handrail and the upward-facing
    // sandstone/lion surfaces. The slender load-bearing cables do not acquire
    // implausible white sleeves.
    ridges: ([-1, 1] as const).map((side) => ({
      depthM: 0.05,
      end: [
        HALF_LENGTH_M,
        SAFETY_HANDRAIL_HEIGHT_M + 0.04,
        side * (HALF_WIDTH_M + 0.045),
      ] as const,
      start: [
        -HALF_LENGTH_M,
        SAFETY_HANDRAIL_HEIGHT_M + 0.04,
        side * (HALF_WIDTH_M + 0.045),
      ] as const,
      widthM: 0.04,
    })),
  });
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
  group.add(createModernSafetySystem());
  group.add(createLoewenBridgeSnowAccents());
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
    engineering: LOEWEN_BRIDGE_PROFILE.engineering,
    geometryStatus: LOEWEN_BRIDGE_PROFILE.geometryStatus,
    hangerCount: LOEWEN_BRIDGE_HANGERS_PER_SIDE * 2,
    inventory: LOEWEN_BRIDGE_PROFILE.inventory,
    keepInMinecraft: true,
    lionCount: LOEWEN_BRIDGE_LION_COUNT,
    mainCableCount: LOEWEN_BRIDGE_MAIN_CABLE_COUNT,
    modernSafetyHandrailCount: LOEWEN_BRIDGE_SAFETY_HANDRAIL_COUNT,
    modernSafetyMeshDiagonalsPerField:
      LOEWEN_BRIDGE_SAFETY_MESH_DIAGONALS_PER_FIELD,
    modernSafetyMeshFieldCount: LOEWEN_BRIDGE_SAFETY_MESH_FIELD_COUNT,
    modernSafetyPostCount: LOEWEN_BRIDGE_SAFETY_POST_COUNT,
    osmWayId: LOEWEN_BRIDGE_PROFILE.osmWayId,
    sourceUrls: LOEWEN_BRIDGE_PROFILE.sourceUrls,
    trussBayCount: LOEWEN_BRIDGE_TRUSS_BAYS,
    visualReferences: LOEWEN_BRIDGE_PROFILE.visualReferences,
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
