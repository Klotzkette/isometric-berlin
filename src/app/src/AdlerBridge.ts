import {
  BoxGeometry,
  ConeGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  Quaternion,
  TorusGeometry,
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
import { createSnowAccents, type SnowRidge } from "./modeOnlyDetails";

/**
 * Adlerbruecke source hierarchy.
 *
 * The official "Masterplan Brücken Berlin", Appendix 1 (data status 06/2025),
 * is the metric/construction authority. Its 7.30 x 3.35 m structural envelope
 * supersedes the older 11.55 x 3.25 m dimensions repeated by Commons and
 * bridge lists. OSM way 28872983 remains the exact plan centre/bearing: its
 * 10.18 m line includes the short path approaches and therefore is
 * deliberately not used as the deck length.
 *
 * Railing curves, pier proportions and eagle anatomy are bounded by the three
 * freely licensed Lienhard Schulz photographs below. They are recognition
 * geometry, not a fixture survey.
 */
const ADLER_SOURCE_EPSG_25833_LINE = [
  [388298.368, 5819071.925],
  [388305.78, 5819064.945],
] as const;
const ADLER_SOURCE_DELTA_X_M =
  ADLER_SOURCE_EPSG_25833_LINE[1][0] -
  ADLER_SOURCE_EPSG_25833_LINE[0][0];
// World z increases southward, hence the inverted northing delta.
const ADLER_SOURCE_DELTA_Z_M =
  ADLER_SOURCE_EPSG_25833_LINE[0][1] -
  ADLER_SOURCE_EPSG_25833_LINE[1][1];
const ADLER_SOURCE_AXIS_LENGTH_M = Math.hypot(
  ADLER_SOURCE_DELTA_X_M,
  ADLER_SOURCE_DELTA_Z_M,
);

export const ADLER_BRIDGE_PROFILE = {
  axis: [
    ADLER_SOURCE_DELTA_X_M / ADLER_SOURCE_AXIS_LENGTH_M,
    ADLER_SOURCE_DELTA_Z_M / ADLER_SOURCE_AXIS_LENGTH_M,
  ] as const,
  centreWorldM: [-1197.926, 931.565] as const,
  geometryStatus:
    "Masterplan Bruecken Berlin Appendix 1 (data status 06/2025) length, width, type, material and construction year on the exact OSM centreline; railing, brick-pier and eagle detail is CC BY-SA photograph-bounded reconstruction, not a fixture survey",
  inventory: {
    areaM2: 25,
    bridgeNumber: "3446098",
    built: 1873,
    conditionGrade: 3.7,
    construction: "Plattenbalkenbruecke, Traegerrostbruecke",
    dataStatus: "06/2025",
    lengthM: 7.3,
    material: "Stahl/Leichtmetall",
    widthM: 3.35,
  },
  kind: "adler" as const,
  name: "Adlerbruecke",
  osmWayId: "28872983",
  secondaryDimensionConflict:
    "Older Commons/bridge-list descriptions report 11.55 x 3.25 m; the official Masterplan Bruecken Berlin Appendix 1 (data status 06/2025) reports 7.30 x 3.35 m and controls the rendered structure",
  sourceEpsg25833Line: ADLER_SOURCE_EPSG_25833_LINE,
  sourceUrls: [
    "https://www.openstreetmap.org/way/28872983",
    "https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318",
    "https://commons.wikimedia.org/wiki/File:Adlerbr%C3%BCcke_1_Gro%C3%9Fer_Tiergarten_Berlin.JPG",
    "https://commons.wikimedia.org/wiki/File:Adlerbr%C3%BCcke_2_Gro%C3%9Fer_Tiergarten_Berlin.JPG",
    "https://commons.wikimedia.org/wiki/File:Adlerbr%C3%BCcke_3_Gro%C3%9Fer_Tiergarten_Berlin.JPG",
  ] as const,
  visualReferences: [
    {
      artist: "Lienhard Schulz",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Adlerbr%C3%BCcke_1_Gro%C3%9Fer_Tiergarten_Berlin.JPG",
      title: "File:Adlerbrücke 1 Großer Tiergarten Berlin.JPG",
    },
    {
      artist: "Lienhard Schulz",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Adlerbr%C3%BCcke_2_Gro%C3%9Fer_Tiergarten_Berlin.JPG",
      title: "File:Adlerbrücke 2 Großer Tiergarten Berlin.JPG",
    },
    {
      artist: "Lienhard Schulz",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Adlerbr%C3%BCcke_3_Gro%C3%9Fer_Tiergarten_Berlin.JPG",
      title: "File:Adlerbrücke 3 Großer Tiergarten Berlin.JPG",
    },
  ] as const,
} as const;

export const ADLER_BRIDGE_EAGLE_COUNT = 2;
export const ADLER_BRIDGE_RAIL_BAYS = 14;
export const ADLER_BRIDGE_EAGLE_PRIMARY_FEATHERS = 18;

const LENGTH_M = ADLER_BRIDGE_PROFILE.inventory.lengthM;
const WIDTH_M = ADLER_BRIDGE_PROFILE.inventory.widthM;
const HALF_LENGTH_M = LENGTH_M / 2;
const HALF_WIDTH_M = WIDTH_M / 2;

const PALETTE = {
  asphalt: 0x777570,
  brick: 0xc7a870,
  brickHighlight: 0xe0c58b,
  brickMortar: 0xa68b61,
  concrete: 0xa8aaa5,
  concreteEdge: 0x7f8582,
  eagle: 0x4a4b49,
  eagleHighlight: 0x626361,
  eagleShade: 0x333534,
  eye: 0x171817,
  iron: 0x464a4a,
  ironHighlight: 0x626766,
  steelSoffit: 0x555b5b,
} as const;

type Point3 = readonly [number, number, number];

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = false,
): void {
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
  if (length < 1e-5) return;
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

function addRotatedPlate(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotationZ: number,
  inked = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateZ(rotationZ);
  geometry.translate(x, y, z);
  addPaintedGeometry(builder, geometry, color, inked);
}

function railingHeight(localX: number): number {
  const normalized = Math.min(1, Math.abs(localX) / HALF_LENGTH_M);
  return 0.96 + 0.31 * (1 - normalized ** 1.65);
}

function createAdlerBridgeSnowAccents(): Group {
  const ridges: SnowRidge[] = [];
  const segments = ADLER_BRIDGE_RAIL_BAYS * 2;
  for (const side of [-1, 1] as const) {
    const z = side * (HALF_WIDTH_M + 0.02);
    for (let index = 0; index < segments; index += 1) {
      const x0 = -HALF_LENGTH_M + (index / segments) * LENGTH_M;
      const x1 = -HALF_LENGTH_M + ((index + 1) / segments) * LENGTH_M;
      ridges.push({
        depthM: 0.055,
        end: [x1, railingHeight(x1) + 0.055, z],
        start: [x0, railingHeight(x0) + 0.055, z],
        widthM: 0.045,
      });
    }
  }
  return createSnowAccents({
    boxes: ([-1, 1] as const).flatMap((end) =>
      ([-1, 1] as const).map((side) => ({
        position: [
          end * (HALF_LENGTH_M - 0.2),
          1.105,
          side * (HALF_WIDTH_M + 0.13),
        ] as const,
        size: [0.72, 0.035, 0.76] as const,
      })),
    ),
    // The two shallow caps sit only on the upward-facing eagle heads; the
    // vertical relief bodies remain dark iron in winter as in reality.
    mounds: ([-1, 1] as const).map((side) => ({
      position: [0.11, 1.59, side * (HALF_WIDTH_M + 0.1)] as const,
      scale: [0.2, 0.045, 0.13] as const,
    })),
    name: "Adlerbruecke snow accents",
    ridges,
  });
}

function addDeckAndSoffit(builder: Builder): void {
  addBox(
    builder,
    PALETTE.concrete,
    0,
    -0.08,
    0,
    LENGTH_M,
    0.28,
    WIDTH_M,
  );
  addBox(
    builder,
    PALETTE.asphalt,
    0,
    0.085,
    0,
    LENGTH_M - 0.18,
    0.05,
    WIDTH_M - 0.18,
    0,
    false,
  );
  for (const side of [-1, 1] as const) {
    addBox(
      builder,
      PALETTE.steelSoffit,
      0,
      -0.31,
      side * (HALF_WIDTH_M - 0.34),
      LENGTH_M - 0.22,
      0.24,
      0.18,
    );
  }
  for (let index = 1; index < 6; index += 1) {
    const x = -HALF_LENGTH_M + (index / 6) * LENGTH_M;
    addBox(
      builder,
      PALETTE.concreteEdge,
      x,
      -0.28,
      0,
      0.13,
      0.14,
      WIDTH_M - 0.12,
      0,
      false,
    );
  }
}

function addBrickAbutments(builder: Builder): void {
  for (const end of [-1, 1] as const) {
    for (const side of [-1, 1] as const) {
      const x = end * (HALF_LENGTH_M - 0.2);
      const z = side * (HALF_WIDTH_M + 0.13);
      addBox(builder, PALETTE.concreteEdge, x, 0.2, z, 0.74, 0.48, 0.78);
      addBox(builder, PALETTE.brick, x, 0.66, z, 0.64, 0.72, 0.68);
      addBox(
        builder,
        PALETTE.brickHighlight,
        x,
        1.045,
        z,
        0.76,
        0.09,
        0.8,
      );
      for (let course = 1; course < 5; course += 1) {
        addBox(
          builder,
          PALETTE.brickMortar,
          x,
          0.34 + course * 0.125,
          z,
          0.655,
          0.016,
          0.695,
          0,
          false,
        );
      }
    }
  }
}

function addRailing(builder: Builder, side: -1 | 1): void {
  const z = side * (HALF_WIDTH_M + 0.02);
  const bayLength = LENGTH_M / ADLER_BRIDGE_RAIL_BAYS;
  const curveSegments = ADLER_BRIDGE_RAIL_BAYS * 2;
  for (let segment = 0; segment < curveSegments; segment += 1) {
    const x0 = -HALF_LENGTH_M + (segment / curveSegments) * LENGTH_M;
    const x1 =
      -HALF_LENGTH_M + ((segment + 1) / curveSegments) * LENGTH_M;
    addBeam(
      builder,
      PALETTE.ironHighlight,
      [x0, railingHeight(x0), z],
      [x1, railingHeight(x1), z],
      0.09,
      0.11,
    );
  }
  addBox(
    builder,
    PALETTE.iron,
    0,
    0.28,
    z,
    LENGTH_M - 0.16,
    0.085,
    0.09,
    0,
    false,
  );
  for (let bay = 0; bay <= ADLER_BRIDGE_RAIL_BAYS; bay += 1) {
    const x = -HALF_LENGTH_M + bay * bayLength;
    const top = railingHeight(x) - 0.035;
    addBeam(
      builder,
      bay % 2 === 0 ? PALETTE.ironHighlight : PALETTE.iron,
      [x, 0.29, z],
      [x, top, z],
      0.055,
      0.065,
    );
    if (bay === ADLER_BRIDGE_RAIL_BAYS) continue;
    const centreX = x + bayLength / 2;
    const ornamentTop =
      Math.min(railingHeight(x), railingHeight(x + bayLength)) - 0.14;
    const ornamentBottom = ornamentTop - 0.2;
    const halfOrnament = bayLength * 0.27;
    addBeam(
      builder,
      PALETTE.iron,
      [centreX - halfOrnament, ornamentBottom, z],
      [centreX - halfOrnament, ornamentTop, z],
      0.04,
      0.05,
    );
    addBeam(
      builder,
      PALETTE.iron,
      [centreX + halfOrnament, ornamentBottom, z],
      [centreX + halfOrnament, ornamentTop, z],
      0.04,
      0.05,
    );
    addBeam(
      builder,
      PALETTE.iron,
      [centreX - halfOrnament, ornamentTop, z],
      [centreX + halfOrnament, ornamentTop, z],
      0.04,
      0.05,
    );
    addBeam(
      builder,
      PALETTE.iron,
      [centreX - halfOrnament, ornamentBottom, z],
      [centreX + halfOrnament, ornamentBottom, z],
      0.04,
      0.05,
    );
  }
}

function addEagle(builder: Builder, side: -1 | 1): void {
  const z = side * (HALF_WIDTH_M + 0.145);
  const reliefDepth = 0.19;

  // Broad, almost heraldic wings: a stiff upper arm and layered primaries
  // dropping below it match the surviving iron reliefs rather than inventing
  // freestanding birds at the bridge ends.
  for (const wing of [-1, 1] as const) {
    addRotatedPlate(
      builder,
      PALETTE.eagle,
      wing * 0.67,
      1.02,
      z,
      1.12,
      0.27,
      reliefDepth,
      wing * -0.08,
      true,
    );
    addRotatedPlate(
      builder,
      PALETTE.eagleHighlight,
      wing * 1.09,
      1.04,
      z + side * 0.008,
      0.58,
      0.12,
      reliefDepth + 0.015,
      wing * -0.04,
    );
    for (let feather = 0; feather < 9; feather += 1) {
      const spread = feather / 8;
      const x = wing * (0.35 + spread * 0.91);
      const y = 0.91 - spread * 0.17;
      const featherHeight = 0.36 + spread * 0.31;
      addRotatedPlate(
        builder,
        feather % 3 === 0 ? PALETTE.eagleShade : PALETTE.eagle,
        x,
        y - featherHeight / 2,
        z + side * 0.018,
        0.13,
        featherHeight,
        reliefDepth,
        wing * (0.05 + spread * 0.06),
      );
    }
  }

  addEllipsoid(builder, PALETTE.eagle, 0, 0.72, z, 0.3, 0.55, 0.14, true);
  for (const tail of [-1, 0, 1] as const) {
    addRotatedPlate(
      builder,
      tail === 0 ? PALETTE.eagleHighlight : PALETTE.eagle,
      tail * 0.11,
      0.28,
      z,
      0.14,
      0.48,
      reliefDepth,
      tail * 0.08,
    );
  }
  addEllipsoid(
    builder,
    PALETTE.eagleHighlight,
    0.02,
    1.2,
    z,
    0.18,
    0.36,
    0.12,
    true,
  );
  addEllipsoid(builder, PALETTE.eagle, 0.12, 1.47, z, 0.2, 0.18, 0.13, true);
  const beak = new ConeGeometry(0.09, 0.28, 6);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(0.32, 1.45, z);
  addPaintedGeometry(builder, beak, PALETTE.eagleShade, true);
  addEllipsoid(
    builder,
    PALETTE.eye,
    0.17,
    1.51,
    z - side * 0.12,
    0.026,
    0.028,
    0.022,
  );
  const mouthRing = new TorusGeometry(0.105, 0.022, 6, 12);
  mouthRing.translate(0.39, 1.38, z);
  addPaintedGeometry(builder, mouthRing, PALETTE.eagleShade);

  // Riveted belt and shoulder scrolls visible in the side photographs.
  addRotatedPlate(
    builder,
    PALETTE.eagleShade,
    0,
    0.79,
    z - side * 0.01,
    1.02,
    0.1,
    reliefDepth + 0.025,
    0,
  );
  for (let rivet = -4; rivet <= 4; rivet += 1) {
    addEllipsoid(
      builder,
      PALETTE.eagleHighlight,
      rivet * 0.105,
      0.8,
      z - side * 0.13,
      0.025,
      0.025,
      0.018,
    );
  }
}

export function createAdlerBridge(ground: VoxelPayload): Group {
  const builder = createBuilder();
  addDeckAndSoffit(builder);
  addBrickAbutments(builder);
  for (const side of [-1, 1] as const) {
    addRailing(builder, side);
    addEagle(builder, side);
  }

  const group =
    finishDrawnGroup(builder, { name: "Adlerbruecke" }) ?? new Group();
  group.name = "Adlerbruecke recognition model";
  group.add(createAdlerBridgeSnowAccents());
  group.position.set(
    ADLER_BRIDGE_PROFILE.centreWorldM[0],
    (worldGroundSampler(ground)(...ADLER_BRIDGE_PROFILE.centreWorldM) ?? 5.2) +
      0.35,
    ADLER_BRIDGE_PROFILE.centreWorldM[1],
  );
  group.rotation.y = -Math.atan2(
    ADLER_BRIDGE_PROFILE.axis[1],
    ADLER_BRIDGE_PROFILE.axis[0],
  );
  group.userData = {
    eagleCount: ADLER_BRIDGE_EAGLE_COUNT,
    genericBridgeReplacement: true,
    geometryStatus: ADLER_BRIDGE_PROFILE.geometryStatus,
    inventory: ADLER_BRIDGE_PROFILE.inventory,
    keepInMinecraft: true,
    osmWayId: ADLER_BRIDGE_PROFILE.osmWayId,
    railBayCount: ADLER_BRIDGE_RAIL_BAYS,
    secondaryDimensionConflict:
      ADLER_BRIDGE_PROFILE.secondaryDimensionConflict,
    sourceUrls: ADLER_BRIDGE_PROFILE.sourceUrls,
    visualReferences: ADLER_BRIDGE_PROFILE.visualReferences,
  };
  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.adlerBridgeDetail = true;
  });
  return group;
}
