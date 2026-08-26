import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
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
  BERLINER_ENSEMBLE_PROFILE,
  BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS,
} from "./BerlinerEnsemble";
import {
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";

const GROUND_Y_M = 4.08;
const BRECHT_YAW_RAD = -0.62;
const WEIGEL_YAW_RAD = 0.2;

const BRONZE = 0x5a4638;
const BRONZE_LIGHT = 0x806451;
const BRONZE_DARK = 0x352a24;
const DARK_STONE = 0x25292a;
const SETT_LIGHT = 0xaaa59a;
const SETT_DARK = 0x89877f;
const PALE_PLINTH = 0xd2cec4;
const WEIGEL_RED = 0xa8322f;
const WEIGEL_RED_DARK = 0x6f2828;
const WEIGEL_WHITE = 0xeeeae1;
const WEIGEL_BLACK = 0x242626;

/**
 * Photo-bounded proportions of the 2026 courtyard installation. Published
 * sources do not provide survey dimensions, so these values intentionally
 * describe a conservative human-scale approximation rather than a measurement.
 */
const WEIGEL_DIMENSIONS = {
  caseDepthM: 1.72,
  caseHeightM: 2.18,
  caseWidthM: 1.76,
  plinthDepthM: 2.04,
  plinthHeightM: 0.38,
  plinthWidthM: 2.24,
} as const;

const BRECHT_STELE_SPECS = [
  { angle: -2.2, courseCount: 3, height: 2.08, radius: 3.34, radiusM: 0.32 },
  { angle: 0.05, courseCount: 3, height: 2.34, radius: 3.3, radiusM: 0.34 },
  { angle: 2.15, courseCount: 3, height: 1.92, radius: 3.36, radiusM: 0.31 },
] as const;

/**
 * Official/current facts are separated from visual references. The current
 * BE press photography by Moritz Haase was inspected only as reference and
 * is neither bundled nor projected as a texture.
 */
export const BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE = {
  name: "Brecht-Denkmal und Eine Skulptur für Helene Weigel",
  ownedOsmKeys: [...BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS],
  genericDoublePolicy:
    "the two exact OSM nodes are owned here and suppressed in TiergartenMonuments",
  brecht: {
    artist: "Fritz Cremer",
    artists: {
      installationDesign: "Peter Flierl",
      sculpture: "Fritz Cremer",
      stoneworkAndSteles: "Carlo Wloch",
    },
    installed: 1988,
    material: "Bronze, Granit/Naturstein und Metall",
    name: "Bertolt Brecht",
    osmKey: BERLINER_ENSEMBLE_PROFILE.brechtOsmKey,
    site: "Bertolt-Brecht-Platz",
    turntableDiameterM: BERLINER_ENSEMBLE_PROFILE.brechtTurntableDiameterM,
    worldM: BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld,
    focus: {
      azimuthDegrees: 144,
      distanceM: 14,
      fovDegrees: 39,
      markerY: 7.7,
      polarDegrees: 72,
      targetHeightM: 1.25,
      targetWorldM: [
        BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld[0],
        GROUND_Y_M,
        BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld[1],
      ] as const,
    },
    geometryStatus:
      "six-metre circular sett stage, a slightly over-life-size upright seated Brecht with bald articulated head, angular face, overlapping hands, straight trouser legs and shoes on the asymmetric open metal bench, plus three surrounding cylindrical, horizontally jointed black-stone steles with non-legible incision bands; procedural, source-bounded and not a portrait texture",
    sources: [
      "https://www.deutsche-digitale-bibliothek.de/item/5ALSSIMTMT2PKBR7UXTZZASRRBP7K366",
      "https://www.defa-stiftung.de/en/films/film-search/bertolt-brecht-platz/",
      "https://commons.wikimedia.org/wiki/File:Bertolt_Brecht,_Skulptur_von_Fritz_Cremer_am_BE_in_Berlin.jpg",
      "https://commons.wikimedia.org/wiki/Category:Bertolt-Brecht-Denkmal_(Berlin)",
      "https://bildhauerei-in-berlin.de/bildwerk/bertolt-brecht-denkmal-5412/",
      "https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/bertolt-brecht/138",
    ],
    visualReference: {
      artist: "Manfred Brückels",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Bertolt_Brecht,_Skulptur_von_Fritz_Cremer_am_BE_in_Berlin.jpg",
      role: "seated bronze figure, open chair and free side of the seat",
    },
    inscriptionPolicy:
      "the copyrighted poem and quotations are identified as site facts but never reproduced; close geometry uses only non-legible incision cues",
  },
  heleneWeigel: {
    artists:
      "Studierende der Bildhauereiklasse von Monica Bonvicini, Universität der Künste Berlin",
    unveiled: "2026-05-10",
    osmKey: BERLINER_ENSEMBLE_PROFILE.heleneWeigelOsmKey,
    site: "Helene-Weigel-Hof",
    worldM: BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld,
    geometryStatus:
      "current non-classical courtyard installation: a nearly frameless glass cube on a low pale plinth, one central red folding director's chair above folded red chair/object layers, two floor light cues, cables and a large black halftone profile on the right glass plane; photo-bounded, procedural and texture-free",
    material: "Glas/Plexiglas, Gummi, Siebdruck und Audio",
    officialSources: [
      "https://www.berliner-ensemble.de/eine-skulptur-fuer-helene-weigel",
      "https://www.berliner-ensemble.de/magazin/helene-weigel-hat-einen-neuen-platz",
    ],
    visualReferences: [
      "https://www.berliner-ensemble.de/sites/default/files/2026-05/_H0A3435.jpg",
      "https://www.berliner-ensemble.de/sites/default/files/2026-05/_H0A3475.jpg",
    ],
    proceduralDimensions: {
      ...WEIGEL_DIMENSIONS,
      status:
        "inferred from official courtyard photography; not published survey dimensions",
    },
    corroboratingSource:
      "https://www.arte.tv/de/videos/133101-000-A/eine-skulptur-fuer-helene-weigel/",
    photoReferencePolicy:
      "BE photographs © Moritz Haase inspected as reference only; no photograph, portrait or archive audio is bundled or loaded",
  },
  renderPolicy: {
    fineLayer: "Helene Weigel halftone glass portrait",
    fineLayers: [
      "Bertolt Brecht seated figure and installation fine detail",
      "Helene Weigel halftone glass portrait",
    ],
    modes: ["day", "night", "snowstorm", "minecraft", "schwellenraum"],
    snowLayer: "Berliner Ensemble public-art snow accents",
    texturePolicy: "no photographic or portrait texture",
  },
} as const;

function rotatedPoint(
  anchorX: number,
  anchorZ: number,
  yaw: number,
  x: number,
  y: number,
  z: number,
): Vector3 {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return new Vector3(
    anchorX + cosine * x + sine * z,
    y,
    anchorZ - sine * x + cosine * z,
  );
}

function addPainted(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
  lamp = false,
): void {
  const edgeGeometry = inked ? new EdgesGeometry(geometry, 28) : null;
  const renderedGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
  if (renderedGeometry !== geometry) geometry.dispose();
  paintGeometry(renderedGeometry, color);
  (lamp ? builder.lamps : builder.parts).push(renderedGeometry);
  if (edgeGeometry) builder.edges.push(edgeGeometry);
}

function addLocalBox(
  builder: Builder,
  anchorX: number,
  anchorZ: number,
  yaw: number,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  localYaw = 0,
  inked = true,
  lamp = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(yaw + localYaw);
  const point = rotatedPoint(anchorX, anchorZ, yaw, x, y, z);
  geometry.translate(point.x, point.y, point.z);
  addPainted(builder, geometry, color, inked, lamp);
}

function addLocalOrientedBox(
  builder: Builder,
  anchorX: number,
  anchorZ: number,
  yaw: number,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  pitch = 0,
  roll = 0,
  localYaw = 0,
  inked = true,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateX(pitch);
  geometry.rotateZ(roll);
  geometry.rotateY(yaw + localYaw);
  const point = rotatedPoint(anchorX, anchorZ, yaw, x, y, z);
  geometry.translate(point.x, point.y, point.z);
  addPainted(builder, geometry, color, inked);
}

function addLocalCableLoop(
  builder: Builder,
  anchorX: number,
  anchorZ: number,
  yaw: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  scaleX: number,
  scaleZ: number,
  localYaw = 0,
): void {
  const geometry = new TorusGeometry(radius, 0.012, 4, 24);
  geometry.scale(scaleX, scaleZ, 1);
  geometry.rotateX(Math.PI / 2);
  geometry.rotateY(yaw + localYaw);
  const point = rotatedPoint(anchorX, anchorZ, yaw, x, y, z);
  geometry.translate(point.x, point.y, point.z);
  addPainted(builder, geometry, WEIGEL_BLACK, false);
}

function addLocalEllipsoid(
  builder: Builder,
  anchorX: number,
  anchorZ: number,
  yaw: number,
  color: number,
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  inked = true,
): void {
  const geometry = new SphereGeometry(1, 12, 8);
  geometry.scale(scaleX, scaleY, scaleZ);
  geometry.rotateY(yaw);
  const point = rotatedPoint(anchorX, anchorZ, yaw, x, y, z);
  geometry.translate(point.x, point.y, point.z);
  addPainted(builder, geometry, color, inked);
}

function addBeam(
  builder: Builder,
  color: number,
  start: Vector3,
  end: Vector3,
  radius: number,
  inked = true,
): void {
  const delta = end.clone().sub(start);
  const geometry = new CylinderGeometry(radius, radius, delta.length(), 8);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      delta.clone().normalize(),
    ),
  );
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  addPainted(builder, geometry, color, inked);
}

function localBeam(
  builder: Builder,
  anchorX: number,
  anchorZ: number,
  yaw: number,
  color: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  radius: number,
  inked = true,
): void {
  addBeam(
    builder,
    color,
    rotatedPoint(anchorX, anchorZ, yaw, start[0], start[1], start[2]),
    rotatedPoint(anchorX, anchorZ, yaw, end[0], end[1], end[2]),
    radius,
    inked,
  );
}

function addLocalVerticalCylinder(
  builder: Builder,
  anchorX: number,
  anchorZ: number,
  yaw: number,
  color: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  segments = 16,
  inked = true,
): void {
  const geometry = new CylinderGeometry(radius, radius, height, segments);
  const point = rotatedPoint(anchorX, anchorZ, yaw, x, y, z);
  geometry.translate(point.x, point.y, point.z);
  addPainted(builder, geometry, color, inked);
}

function createBrechtMemorial(): Group {
  const builder = createBuilder();
  const fineBuilder = createBuilder();
  const [x, z] = BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld;

  const lowerTurntable = new CylinderGeometry(3, 3, 0.16, 48);
  lowerTurntable.translate(x, GROUND_Y_M + 0.08, z);
  addPainted(builder, lowerTurntable, SETT_DARK, false);
  const upperTurntable = new CylinderGeometry(2.72, 2.72, 0.075, 48);
  upperTurntable.translate(x, GROUND_Y_M + 0.1775, z);
  addPainted(builder, upperTurntable, SETT_LIGHT, false);
  const curb = new TorusGeometry(2.895, 0.105, 6, 48);
  curb.rotateX(Math.PI / 2);
  curb.translate(x, GROUND_Y_M + 0.205, z);
  addPainted(builder, curb, SETT_LIGHT, true);

  // The photographed platform uses small radial setts within the six-metre
  // stage.  Close-only joints stay deliberately unlettered: Brecht's poem is
  // identified in provenance but not copied into geometry.
  for (let index = 0; index < 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2;
    addLocalBox(
      fineBuilder,
      x,
      z,
      angle,
      index % 3 === 0 ? SETT_DARK : SETT_LIGHT,
      0,
      GROUND_Y_M + 0.218,
      2.34,
      0.12,
      0.018,
      0.78,
      0,
      false,
    );
  }
  for (const radius of [0.72, 1.38, 2.04]) {
    const joint = new TorusGeometry(radius, 0.012, 4, 48);
    joint.rotateX(Math.PI / 2);
    joint.translate(x, GROUND_Y_M + 0.219, z);
    addPainted(fineBuilder, joint, SETT_DARK, false);
  }

  // Cremer's bench is an asymmetric open square-tube frame: Brecht occupies
  // its left half while a complete empty place remains visibly available.
  for (const chairX of [-0.72, 0.92]) {
    for (const chairZ of [-0.34, 0.34]) {
      localBeam(
        builder,
        x,
        z,
        BRECHT_YAW_RAD,
        DARK_STONE,
        [chairX, GROUND_Y_M + 0.22, chairZ],
        [chairX, GROUND_Y_M + 0.84, chairZ],
        0.038,
      );
    }
  }
  for (const chairZ of [-0.34, 0.34]) {
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      DARK_STONE,
      [-0.72, GROUND_Y_M + 0.84, chairZ],
      [0.92, GROUND_Y_M + 0.84, chairZ],
      0.042,
    );
  }
  for (const chairX of [-0.72, 0.92]) {
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      DARK_STONE,
      [chairX, GROUND_Y_M + 0.84, -0.34],
      [chairX, GROUND_Y_M + 0.84, 0.34],
      0.042,
    );
  }
  addLocalBox(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    DARK_STONE,
    0.47,
    GROUND_Y_M + 0.835,
    0,
    0.82,
    0.07,
    0.62,
    0,
    true,
  );

  // Upright, broad-coated seated figure.  The larger intersecting volumes
  // retain Cremer's compact cast silhouette at distance; face, collar, folds
  // and fingers live in the bounded close-detail branch below.
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE,
    -0.28,
    GROUND_Y_M + 1.43,
    0.06,
    0.49,
    0.66,
    0.34,
  );
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE,
    -0.28,
    GROUND_Y_M + 1.07,
    -0.08,
    0.47,
    0.34,
    0.39,
  );
  addLocalVerticalCylinder(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE,
    -0.28,
    GROUND_Y_M + 1.95,
    0,
    0.12,
    0.22,
    10,
  );
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE,
    -0.28,
    GROUND_Y_M + 2.22,
    -0.03,
    0.25,
    0.32,
    0.23,
  );
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.28,
    GROUND_Y_M + 2.2,
    -0.235,
    0.08,
    0.085,
    0.12,
    false,
  );
  for (const side of [-1, 1]) {
    const hipX = -0.28 + side * 0.2;
    const kneeX = -0.28 + side * 0.22;
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [hipX, GROUND_Y_M + 1.08, -0.04],
      [kneeX, GROUND_Y_M + 0.82, -0.58],
      0.155,
    );
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [kneeX, GROUND_Y_M + 0.82, -0.58],
      [kneeX + side * 0.025, GROUND_Y_M + 0.28, -0.66],
      0.13,
    );
    addLocalEllipsoid(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      kneeX + side * 0.025,
      GROUND_Y_M + 0.2,
      -0.82,
      0.16,
      0.09,
      0.3,
    );
    addLocalBox(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_DARK,
      kneeX + side * 0.025,
      GROUND_Y_M + 0.145,
      -0.84,
      0.27,
      0.035,
      0.52,
      0,
      false,
    );
    addLocalBox(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      kneeX + side * 0.025,
      GROUND_Y_M + 0.36,
      -0.665,
      0.285,
      0.032,
      0.24,
      0,
      false,
    );
    localBeam(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_DARK,
      [kneeX, GROUND_Y_M + 0.78, -0.71],
      [kneeX + side * 0.025, GROUND_Y_M + 0.39, -0.75],
      0.01,
      false,
    );
  }
  for (const side of [-1, 1] as const) {
    const shoulderX = -0.28 + side * 0.36;
    const elbowX = -0.28 + side * 0.34;
    const handX = side < 0 ? -0.35 : -0.21;
    const handY = GROUND_Y_M + (side < 0 ? 1.09 : 1.13);
    const handZ = side < 0 ? -0.41 : -0.435;
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [shoulderX, GROUND_Y_M + 1.72, 0.02],
      [elbowX, GROUND_Y_M + 1.34, -0.16],
      0.095,
    );
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [elbowX, GROUND_Y_M + 1.34, -0.16],
      [handX, handY, handZ],
      0.085,
    );
    addLocalEllipsoid(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      handX,
      handY,
      handZ,
      0.15,
      0.068,
      0.125,
    );
    for (let finger = 0; finger < 5; finger += 1) {
      const fingerOffset = (finger - 2) * 0.024;
      localBeam(
        fineBuilder,
        x,
        z,
        BRECHT_YAW_RAD,
        BRONZE_LIGHT,
        [handX + fingerOffset, handY - 0.01, handZ - 0.025],
        [
          handX + fingerOffset + side * 0.012,
          handY - 0.042,
          handZ - 0.135 + Math.abs(fingerOffset) * 0.15,
        ],
        0.011,
        false,
      );
      if (finger > 0) {
        addLocalEllipsoid(
          fineBuilder,
          x,
          z,
          BRECHT_YAW_RAD,
          BRONZE_DARK,
          handX + fingerOffset,
          handY + 0.025,
          handZ - 0.06,
          0.013,
          0.009,
          0.012,
          false,
        );
      }
    }
    localBeam(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      [handX + side * 0.1, handY + 0.015, handZ - 0.015],
      [handX + side * 0.045, handY - 0.01, handZ - 0.105],
      0.018,
      false,
    );
  }

  // Non-portrait facial and garment cues, all procedural and deliberately
  // low-poly. They disappear before they can shimmer on mobile screens.
  for (const earSide of [-1, 1]) {
    addLocalEllipsoid(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      -0.28 + earSide * 0.245,
      GROUND_Y_M + 2.23,
      -0.01,
      0.045,
      0.085,
      0.035,
      false,
    );
    addLocalEllipsoid(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_DARK,
      -0.28 + earSide * 0.25,
      GROUND_Y_M + 2.23,
      -0.042,
      0.016,
      0.048,
      0.012,
      false,
    );
  }
  for (const eyeSide of [-1, 1]) {
    localBeam(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_DARK,
      [-0.28 + eyeSide * 0.14, GROUND_Y_M + 2.35, -0.247],
      [-0.28 + eyeSide * 0.035, GROUND_Y_M + 2.34, -0.265],
      0.015,
      false,
    );
    addLocalEllipsoid(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      DARK_STONE,
      -0.28 + eyeSide * 0.078,
      GROUND_Y_M + 2.29,
      -0.245,
      0.022,
      0.018,
      0.012,
      false,
    );
    addLocalEllipsoid(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      -0.28 + eyeSide * 0.105,
      GROUND_Y_M + 2.22,
      -0.235,
      0.07,
      0.075,
      0.045,
      false,
    );
  }
  // Long angular bridge and compact tip match Cremer's recognisable profile.
  addLocalEllipsoid(
    fineBuilder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.28,
    GROUND_Y_M + 2.285,
    -0.285,
    0.045,
    0.105,
    0.075,
    false,
  );
  addLocalEllipsoid(
    fineBuilder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.28,
    GROUND_Y_M + 2.205,
    -0.325,
    0.07,
    0.052,
    0.07,
    false,
  );
  localBeam(
    fineBuilder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_DARK,
    [-0.365, GROUND_Y_M + 2.145, -0.282],
    [-0.195, GROUND_Y_M + 2.145, -0.282],
    0.009,
    false,
  );
  addLocalEllipsoid(
    fineBuilder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.28,
    GROUND_Y_M + 2.105,
    -0.245,
    0.095,
    0.06,
    0.05,
    false,
  );
  addLocalEllipsoid(
    fineBuilder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.28,
    GROUND_Y_M + 2.45,
    0.005,
    0.23,
    0.085,
    0.205,
    false,
  );
  for (const side of [-1, 1]) {
    localBeam(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      [-0.28, GROUND_Y_M + 1.93, -0.25],
      [-0.28 + side * 0.2, GROUND_Y_M + 1.8, -0.27],
      0.025,
      false,
    );
  }
  localBeam(
    fineBuilder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_DARK,
    [-0.28, GROUND_Y_M + 1.82, -0.292],
    [-0.28, GROUND_Y_M + 1.43, -0.35],
    0.012,
    false,
  );
  for (const buttonY of [1.7, 1.57, 1.44]) {
    addLocalEllipsoid(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_DARK,
      -0.28,
      GROUND_Y_M + buttonY,
      -0.365,
      0.013,
      0.013,
      0.01,
      false,
    );
  }
  for (let fold = -2; fold <= 2; fold += 1) {
    localBeam(
      fineBuilder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE_LIGHT,
      [-0.28 + fold * 0.09, GROUND_Y_M + 1.64, -0.285],
      [-0.28 + fold * 0.065, GROUND_Y_M + 1.2, -0.38],
      0.014,
      false,
    );
  }

  for (const stele of BRECHT_STELE_SPECS) {
    const localX = Math.cos(stele.angle) * stele.radius;
    const localZ = Math.sin(stele.angle) * stele.radius;
    const courseHeight = stele.height / stele.courseCount;
    for (let course = 0; course < stele.courseCount; course += 1) {
      addLocalVerticalCylinder(
        builder,
        x,
        z,
        BRECHT_YAW_RAD,
        course === 1 ? 0x353a3a : DARK_STONE,
        localX,
        GROUND_Y_M + (course + 0.5) * courseHeight,
        localZ,
        stele.radiusM,
        courseHeight - 0.018,
        18,
        true,
      );
    }
    for (let seam = 1; seam < stele.courseCount; seam += 1) {
      const joint = new TorusGeometry(stele.radiusM + 0.003, 0.012, 4, 18);
      joint.rotateX(Math.PI / 2);
      const point = rotatedPoint(
        x,
        z,
        BRECHT_YAW_RAD,
        localX,
        GROUND_Y_M + seam * courseHeight,
        localZ,
      );
      joint.translate(point.x, point.y, point.z);
      addPainted(fineBuilder, joint, 0x1f2424, false);
    }
    // Short, unlettered rings register the engraved text zones without
    // reproducing Brecht's protected poem or quotations.
    for (const fraction of [0.24, 0.32, 0.41, 0.49]) {
      const incision = new TorusGeometry(
        stele.radiusM + 0.004,
        0.005,
        3,
        18,
      );
      incision.rotateX(Math.PI / 2);
      const point = rotatedPoint(
        x,
        z,
        BRECHT_YAW_RAD,
        localX,
        GROUND_Y_M + stele.height * fraction,
        localZ,
      );
      incision.translate(point.x, point.y, point.z);
      addPainted(fineBuilder, incision, 0x15191a, false);
    }
  }

  const memorial = finishDrawnGroup(builder, {
    name: "Bertolt Brecht memorial installation",
  });
  if (!memorial) throw new Error("Brecht memorial geometry is empty");
  const fine = finishDrawnGroup(fineBuilder, {
    name: "Bertolt Brecht seated figure and installation fine detail",
  });
  if (fine) {
    fine.userData.detailFadeM = [34, 105];
    fine.userData.inscriptionPolicy =
      BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.brecht.inscriptionPolicy;
    memorial.add(fine);
  }
  memorial.userData.profile = BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.brecht;
  memorial.userData.detailCounts = {
    chairLegs: 4,
    emptyBenchPlaces: 1,
    facialCues: 15,
    fingerCues: 10,
    garmentSeams: 15,
    knuckleCues: 8,
    platformDiameterM: BERLINER_ENSEMBLE_PROFILE.brechtTurntableDiameterM,
    seatedFullBodyFigure: 1,
    cylindricalSteles: BRECHT_STELE_SPECS.length,
    steleIncisionBands: BRECHT_STELE_SPECS.length * 4,
    steleCourses: BRECHT_STELE_SPECS.reduce(
      (total, stele) => total + stele.courseCount,
      0,
    ),
    thumbCues: 2,
  };
  memorial.userData.exactOwnOsmKey = BERLINER_ENSEMBLE_PROFILE.brechtOsmKey;
  return memorial;
}

type BrechtVoxelPalette = "bronze" | "darkStone" | "settDark" | "settLight";

type BrechtVoxelBlock = {
  position: Vector3;
  size: number;
};

const BRECHT_VOXEL_COLORS: Readonly<Record<BrechtVoxelPalette, number>> = {
  bronze: 0x6a4f3d,
  darkStone: 0x242829,
  settDark: 0x87857e,
  settLight: 0xb1aca1,
};

/**
 * One deterministic, block-native reading of the Brecht installation.  It is
 * shared by full and mobile voxel worlds; reduced devices therefore never
 * fall back to the smooth portrait-like figure.
 */
export function createMinecraftBrechtMemorial(): Group {
  const root = new Group();
  root.name = "Minecraft Bertolt Brecht monument block-native detail";
  const [anchorX, anchorZ] = BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld;
  const batches: Record<BrechtVoxelPalette, BrechtVoxelBlock[]> = {
    bronze: [],
    darkStone: [],
    settDark: [],
    settLight: [],
  };
  const push = (
    palette: BrechtVoxelPalette,
    localX: number,
    localY: number,
    localZ: number,
    size: number,
  ): void => {
    batches[palette].push({
      position: rotatedPoint(
        anchorX,
        anchorZ,
        BRECHT_YAW_RAD,
        localX,
        GROUND_Y_M + localY,
        localZ,
      ),
      size,
    });
  };

  const stageBlock = 0.46;
  for (let xIndex = -6; xIndex <= 6; xIndex += 1) {
    for (let zIndex = -6; zIndex <= 6; zIndex += 1) {
      const localX = xIndex * 0.46;
      const localZ = zIndex * 0.46;
      if (Math.hypot(localX, localZ) > 2.78) continue;
      push(
        (xIndex + zIndex) % 3 === 0 ? "settDark" : "settLight",
        localX,
        0.23,
        localZ,
        stageBlock,
      );
    }
  }

  // Square-tube chair frame plus the visibly empty half of the seat.
  const chairBlock = 0.22;
  for (const chairX of [-0.72, 0.92]) {
    for (const chairZ of [-0.34, 0.34]) {
      for (const localY of [0.29, 0.51, 0.73]) {
        push("darkStone", chairX, localY, chairZ, chairBlock);
      }
    }
  }
  for (let index = 0; index <= 7; index += 1) {
    const chairX = -0.72 + (index / 7) * 1.64;
    for (const chairZ of [-0.34, 0.34]) {
      push("darkStone", chairX, 0.84, chairZ, chairBlock);
    }
  }
  for (const chairX of [0.26, 0.48, 0.7, 0.92]) {
    for (const chairZ of [-0.22, 0, 0.22]) {
      push("darkStone", chairX, 0.84, chairZ, chairBlock);
    }
  }

  // Compact seated silhouette: two vertical trouser legs, broad coat, lap,
  // arms/hands and the characteristic upright head.
  const figureBlock = 0.32;
  for (const side of [-1, 1]) {
    const legX = -0.28 + side * 0.22;
    for (const localY of [0.31, 0.63]) {
      push("bronze", legX, localY, -0.67, figureBlock);
    }
    push("bronze", legX, 0.95, -0.42, figureBlock);
    push("bronze", legX, 1.14, -0.18, figureBlock);
    push("bronze", legX, 0.18, -0.87, figureBlock);
    push("bronze", -0.28 + side * 0.38, 1.58, 0.01, figureBlock);
    push("bronze", -0.28 + side * 0.34, 1.34, -0.18, figureBlock);
    push("bronze", -0.28 + side * 0.16, 1.11, -0.4, figureBlock);
  }
  for (const localY of [1.18, 1.5, 1.82]) {
    for (const localX of [-0.6, -0.28, 0.04]) {
      push("bronze", localX, localY, 0.02, figureBlock);
    }
  }
  push("bronze", -0.28, 2.07, -0.02, 0.28);
  push("bronze", -0.28, 2.33, -0.03, 0.34);
  push("bronze", -0.28, 2.34, -0.2, 0.2);

  for (const stele of BRECHT_STELE_SPECS) {
    const localX = Math.cos(stele.angle) * stele.radius;
    const localZ = Math.sin(stele.angle) * stele.radius;
    const block = 0.44;
    const levelCount = Math.ceil(stele.height / block);
    for (let level = 0; level < levelCount; level += 1) {
      push(
        "darkStone",
        localX,
        Math.min(stele.height - block / 2, block / 2 + level * block),
        localZ,
        block,
      );
    }
  }

  const sharedCube = new BoxGeometry(1, 1, 1);
  sharedCube.deleteAttribute("uv");
  const dummy = new Object3D();
  for (const palette of Object.keys(batches) as BrechtVoxelPalette[]) {
    const blocks = batches[palette];
    const mesh = new InstancedMesh(
      sharedCube,
      new MeshStandardMaterial({
        color: BRECHT_VOXEL_COLORS[palette],
        flatShading: true,
        roughness: palette === "bronze" ? 0.66 : 0.9,
        metalness: palette === "bronze" ? 0.2 : 0,
      }),
      blocks.length,
    );
    mesh.name = `Minecraft Bertolt Brecht ${palette} blocks`;
    blocks.forEach((block, index) => {
      dummy.position.copy(block.position);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(block.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.userData.blockNative = true;
    mesh.userData.blockPalette = palette;
    root.add(mesh);
  }
  root.userData = {
    blockNative: true,
    drawCallCount: root.children.length,
    exactOwnOsmKey: BERLINER_ENSEMBLE_PROFILE.brechtOsmKey,
    instanceCount: Object.values(batches).reduce(
      (total, blocks) => total + blocks.length,
      0,
    ),
    mobileParity: "byte-identical full/mobile transforms",
    sourceBound: true,
    texturePolicy: "one shared UV-free cube and four opaque palette batches",
  };
  return root;
}

function createWeigelHalftone(anchorX: number, anchorZ: number): InstancedMesh {
  const dots: Array<{ x: number; y: number; radius: number }> = [];
  const portraitTilt = -0.2;
  const tiltCosine = Math.cos(portraitTilt);
  const tiltSine = Math.sin(portraitTilt);
  for (let row = 0; row < 25; row += 1) {
    for (let column = 0; column < 19; column += 1) {
      const u = -1 + (column / 18) * 2;
      const v = -1 + (row / 24) * 2;
      const cranium = ((u - 0.12) / 0.54) ** 2 + ((v - 0.35) / 0.66) ** 2 <= 1;
      const nose =
        u >= -0.69 &&
        u <= -0.28 &&
        v >= 0.2 &&
        v <= 0.58 &&
        u >= -0.69 + Math.abs(v - 0.39) * 1.05;
      const chin = ((u + 0.17) / 0.32) ** 2 + ((v + 0.03) / 0.3) ** 2 <= 1;
      const neck = u >= 0.02 && u <= 0.5 && v >= -0.46 && v <= -0.02;
      const shoulders =
        v < -0.3 && ((u - 0.02) / 0.98) ** 2 + ((v + 0.94) / 0.67) ** 2 <= 1;
      const hair = ((u - 0.48) / 0.27) ** 2 + ((v - 0.5) / 0.3) ** 2 <= 1;
      if (!cranium && !nose && !chin && !neck && !shoulders && !hair) {
        continue;
      }
      const pattern =
        Math.sin((column + 3) * 5.173 + (row + 2) * 8.349) * 0.5 + 0.5;
      if (pattern < (cranium || nose ? 0.16 : 0.3)) continue;
      const rawX = u * 0.62;
      const rawY = v * 0.82;
      dots.push({
        radius: 0.017 + pattern * 0.024,
        x: rawX * tiltCosine - rawY * tiltSine,
        y: rawX * tiltSine + rawY * tiltCosine,
      });
    }
  }
  const dayMaterial = new MeshBasicMaterial({
    color: WEIGEL_BLACK,
    depthWrite: false,
    opacity: 0.82,
    side: DoubleSide,
    transparent: true,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: 0x151818,
    depthWrite: false,
    emissive: 0x090b0b,
    emissiveIntensity: 0.18,
    opacity: 0.84,
    roughness: 0.82,
    side: DoubleSide,
    transparent: true,
  });
  const portrait = new InstancedMesh(
    new CircleGeometry(1, 8),
    dayMaterial,
    dots.length,
  );
  portrait.name = "Helene Weigel halftone glass portrait";
  portrait.userData.dayMaterial = dayMaterial;
  portrait.userData.nightMaterial = nightMaterial;
  portrait.userData.textureFree = true;
  portrait.userData.dotCount = dots.length;
  portrait.userData.form = "abstracted side-profile halftone";
  portrait.userData.glassPlane = "right";
  portrait.renderOrder = 3;
  const dummy = new Object3D();
  dots.forEach((dot, index) => {
    const point = rotatedPoint(
      anchorX,
      anchorZ,
      WEIGEL_YAW_RAD,
      WEIGEL_DIMENSIONS.caseWidthM / 2 + 0.006,
      GROUND_Y_M + WEIGEL_DIMENSIONS.plinthHeightM + 1.03 + dot.y,
      dot.x,
    );
    dummy.position.copy(point);
    dummy.rotation.set(0, WEIGEL_YAW_RAD + Math.PI / 2, 0);
    dummy.scale.setScalar(dot.radius);
    dummy.updateMatrix();
    portrait.setMatrixAt(index, dummy.matrix);
  });
  portrait.instanceMatrix.needsUpdate = true;
  portrait.computeBoundingBox();
  portrait.computeBoundingSphere();
  return portrait;
}

function createWeigelMemorial(): Group {
  const group = new Group();
  group.name = "Für Helene Weigel current memorial";
  const [x, z] = BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld;
  const builder = createBuilder();
  const plinthTopY = GROUND_Y_M + WEIGEL_DIMENSIONS.plinthHeightM;

  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    PALE_PLINTH,
    0,
    GROUND_Y_M + WEIGEL_DIMENSIONS.plinthHeightM / 2,
    0,
    WEIGEL_DIMENSIONS.plinthWidthM,
    WEIGEL_DIMENSIONS.plinthHeightM,
    WEIGEL_DIMENSIONS.plinthDepthM,
  );
  // One restrained panel joint replaces the unsupported row of black
  // "vent" slots formerly drawn across the otherwise plain stone front.
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    0xaaa9a5,
    0,
    GROUND_Y_M + WEIGEL_DIMENSIONS.plinthHeightM / 2,
    -WEIGEL_DIMENSIONS.plinthDepthM / 2 - 0.003,
    0.012,
    WEIGEL_DIMENSIONS.plinthHeightM - 0.035,
    0.012,
    0,
    false,
  );

  // A shallow red tray and three folded chair signatures establish the
  // collective field around the main chair without claiming a survey count.
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED,
    0,
    plinthTopY + 0.08,
    -0.28,
    1.46,
    0.11,
    0.74,
    0.02,
  );
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED_DARK,
    0,
    plinthTopY + 0.15,
    -0.66,
    1.42,
    0.07,
    0.055,
    0.02,
  );
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      side * 0.7,
      plinthTopY + 0.15,
      -0.3,
      0.055,
      0.07,
      0.66,
      0.02,
    );
  }
  for (const [chairX, chairZ, chairYaw] of [
    [-0.4, 0.12, -0.18],
    [0.34, 0.2, 0.16],
    [-0.03, 0.42, -0.04],
  ] as const) {
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [chairX - 0.3, plinthTopY + 0.1, chairZ - 0.04],
      [chairX + 0.27, plinthTopY + 0.48, chairZ + 0.04],
      0.027,
    );
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [chairX + 0.3, plinthTopY + 0.1, chairZ - 0.04],
      [chairX - 0.27, plinthTopY + 0.48, chairZ + 0.04],
      0.027,
    );
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED,
      chairX,
      plinthTopY + 0.43,
      chairZ,
      0.58,
      0.055,
      0.28,
      chairYaw,
    );
  }

  // Thin pitched solids read as the folded red rubber/textile and object
  // layers seen in the gallery, instead of generic tetrahedron boulders.
  for (const [
    foldX,
    foldY,
    foldZ,
    width,
    depth,
    pitch,
    roll,
    foldYaw,
    color,
  ] of [
    [-0.2, 0.39, 0.04, 1.08, 0.72, -0.12, 0.12, -0.05, WEIGEL_RED],
    [0.25, 0.46, 0.11, 0.76, 0.64, 0.18, -0.3, 0.08, WEIGEL_RED],
    [-0.46, 0.42, 0.11, 0.52, 0.7, -0.18, 0.46, -0.05, WEIGEL_RED_DARK],
    [0.47, 0.36, -0.02, 0.42, 0.78, 0.08, -0.62, 0.12, WEIGEL_RED],
    [-0.04, 0.58, 0.15, 0.82, 0.48, -0.2, 0.06, 0.05, 0xc64a42],
    [-0.1, 0.31, -0.34, 0.72, 0.52, 0.72, -0.05, 0.02, WEIGEL_RED],
  ] as const) {
    addLocalOrientedBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      color,
      foldX,
      plinthTopY + foldY,
      foldZ,
      width,
      0.065,
      depth,
      pitch,
      roll,
      foldYaw,
    );
  }
  addLocalVerticalCylinder(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED_DARK,
    -0.18,
    plinthTopY + 0.65,
    -0.02,
    0.23,
    0.07,
    20,
  );
  addLocalVerticalCylinder(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    0xc64a42,
    -0.18,
    plinthTopY + 0.69,
    -0.02,
    0.16,
    0.025,
    20,
    false,
  );
  for (const [paperX, paperY, paperZ, paperWidth, paperYaw] of [
    [0.27, 0.6, -0.06, 0.4, -0.16],
    [0.31, 0.65, -0.03, 0.34, 0.08],
    [0.22, 0.7, -0.01, 0.3, -0.06],
  ] as const) {
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      paperY === 0.65 ? WEIGEL_RED_DARK : WEIGEL_RED,
      paperX,
      plinthTopY + paperY,
      paperZ,
      paperWidth,
      0.045,
      0.28,
      paperYaw,
    );
  }
  localBeam(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED,
    [-0.62, plinthTopY + 0.18, -0.08],
    [-0.86, plinthTopY + 0.2, -0.1],
    0.1,
  );

  // Central director's chair after Weigel's design: two complete scissor
  // frames, cloth seat/back, arm rails, posts and visible pivot caps.
  for (const chairZ of [-0.22, 0.22]) {
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [-0.38, plinthTopY + 0.46, chairZ],
      [0.35, plinthTopY + 1, chairZ],
      0.032,
    );
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [0.38, plinthTopY + 0.46, chairZ],
      [-0.35, plinthTopY + 1, chairZ],
      0.032,
    );
    addLocalEllipsoid(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      0,
      plinthTopY + 0.73,
      chairZ,
      0.052,
      0.052,
      0.03,
      false,
    );
  }
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED,
    0,
    plinthTopY + 0.91,
    0,
    0.84,
    0.075,
    0.5,
  );
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED,
    0,
    plinthTopY + 1.3,
    0.23,
    0.84,
    0.32,
    0.055,
  );
  for (const side of [-1, 1]) {
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [side * 0.4, plinthTopY + 0.86, 0.22],
      [side * 0.4, plinthTopY + 1.47, 0.23],
      0.028,
    );
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      side * 0.48,
      plinthTopY + 1.07,
      -0.01,
      0.055,
      0.055,
      0.55,
    );
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      side * 0.4,
      plinthTopY + 1.46,
      0.2,
      0.06,
      0.07,
      0.06,
      0,
      false,
    );
  }

  // Two dominant floor tubes and restrained equipment/cable cues visible in
  // the official gallery. Historical audio itself remains unbundled.
  for (const [tubeX, tubeZ, tubeWidth, tubeYaw] of [
    [-0.35, -0.57, 0.48, 0.08],
    [0.29, -0.48, 0.42, -0.12],
  ] as const) {
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_WHITE,
      tubeX,
      plinthTopY + 0.17,
      tubeZ,
      tubeWidth,
      0.045,
      0.045,
      tubeYaw,
      false,
      true,
    );
  }
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_BLACK,
    0.67,
    plinthTopY + 0.15,
    0.45,
    0.15,
    0.13,
    0.18,
    -0.08,
  );
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    0x55595a,
    -0.7,
    plinthTopY + 0.11,
    0.45,
    0.16,
    0.055,
    0.2,
    0.1,
    false,
  );
  addLocalCableLoop(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    -0.55,
    plinthTopY + 0.035,
    -0.55,
    0.19,
    1.45,
    0.72,
    0.14,
  );
  addLocalCableLoop(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    0.64,
    plinthTopY + 0.035,
    -0.6,
    0.13,
    1.25,
    0.72,
    -0.12,
  );
  localBeam(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_BLACK,
    [-0.36, plinthTopY + 0.035, -0.54],
    [0.12, plinthTopY + 0.04, -0.48],
    0.011,
    false,
  );
  localBeam(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_BLACK,
    [0.12, plinthTopY + 0.04, -0.48],
    [0.59, plinthTopY + 0.055, 0.38],
    0.011,
    false,
  );

  const solids = finishDrawnGroup(builder, {
    lampEmissive: 0xfff4d4,
    lampEmissiveIntensity: 0.72,
    name: "Helene Weigel vitrine contents and plinth",
  });
  if (solids) {
    solids.userData.formContract = {
      centralDirectorChair: true,
      foldedSurroundingChairs: true,
      historicalAudioBundled: false,
      photoTextureBundled: false,
    };
    group.add(solids);
  }

  const caseGeometry = new BoxGeometry(
    WEIGEL_DIMENSIONS.caseWidthM,
    WEIGEL_DIMENSIONS.caseHeightM,
    WEIGEL_DIMENSIONS.caseDepthM,
  );
  caseGeometry.rotateY(WEIGEL_YAW_RAD);
  const caseCentre = rotatedPoint(
    x,
    z,
    WEIGEL_YAW_RAD,
    0,
    plinthTopY + WEIGEL_DIMENSIONS.caseHeightM / 2,
    0,
  );
  caseGeometry.translate(caseCentre.x, caseCentre.y, caseCentre.z);
  const glassDay = new MeshBasicMaterial({
    color: 0xbad6d5,
    depthWrite: false,
    opacity: 0.095,
    side: DoubleSide,
    transparent: true,
  });
  const glassNight = new MeshStandardMaterial({
    color: 0x688d91,
    depthWrite: false,
    emissive: 0x17373b,
    emissiveIntensity: 0.16,
    opacity: 0.135,
    roughness: 0.28,
    side: DoubleSide,
    transparent: true,
  });
  const glass = new Mesh(caseGeometry, glassDay);
  glass.name = "Helene Weigel clear glass vitrine";
  glass.renderOrder = 1;
  glass.userData.dayMaterial = glassDay;
  glass.userData.nightMaterial = glassNight;
  glass.userData.textureFree = true;
  group.add(glass);

  const caseSeams = new LineSegments(
    new EdgesGeometry(caseGeometry, 25),
    new LineBasicMaterial({
      color: 0x587978,
      depthWrite: false,
      opacity: 0.58,
      transparent: true,
    }),
  );
  caseSeams.name = "Helene Weigel bonded glass edge seams";
  caseSeams.renderOrder = 2;
  caseSeams.userData.loadBearingFrame = false;
  group.add(caseSeams);
  const portrait = createWeigelHalftone(x, z);
  group.add(portrait);
  group.userData.profile = BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.heleneWeigel;
  group.userData.exactOwnOsmKey = BERLINER_ENSEMBLE_PROFILE.heleneWeigelOsmKey;
  group.userData.dimensions = WEIGEL_DIMENSIONS;
  group.userData.sourceBound = true;
  group.userData.detailCounts = {
    audioObjectCues: 2,
    cableLoops: 2,
    cableRuns: 2,
    directorChairs: 1,
    foldedObjectForms: 11,
    foldingFrameCrosses: 2,
    glassVitrines: 1,
    lightTubes: 2,
    plinthPanelJoints: 1,
    portraitDots: portrait.count,
    secondaryChairCues: 3,
  };
  return group;
}

function createSnowAccents(): Group {
  const snow = new Group();
  snow.name = "Berliner Ensemble public-art snow accents";
  snow.userData.snowOnly = true;
  snow.visible = false;
  const material = new MeshStandardMaterial({
    color: 0xeaf1ee,
    flatShading: true,
    roughness: 0.94,
  });
  const [brechtX, brechtZ] = BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld;
  const turntable = new Mesh(
    new CylinderGeometry(2.68, 2.68, 0.035, 48),
    material,
  );
  turntable.name = "Brecht turntable thin snow cover";
  turntable.position.set(brechtX, GROUND_Y_M + 0.225, brechtZ);
  snow.add(turntable);
  const figureHead = new Mesh(new SphereGeometry(1, 12, 6), material);
  figureHead.name = "Brecht seated figure head snow cap";
  figureHead.scale.set(0.22, 0.035, 0.2);
  figureHead.position.copy(
    rotatedPoint(
      brechtX,
      brechtZ,
      BRECHT_YAW_RAD,
      -0.28,
      GROUND_Y_M + 2.515,
      -0.015,
    ),
  );
  snow.add(figureHead);
  const shoulderSnow = new Mesh(new BoxGeometry(0.78, 0.035, 0.25), material);
  shoulderSnow.name = "Brecht seated figure shoulder snow ridge";
  shoulderSnow.rotation.y = BRECHT_YAW_RAD;
  shoulderSnow.position.copy(
    rotatedPoint(
      brechtX,
      brechtZ,
      BRECHT_YAW_RAD,
      -0.28,
      GROUND_Y_M + 2.015,
      0.02,
    ),
  );
  snow.add(shoulderSnow);
  const emptyBenchSnow = new Mesh(new BoxGeometry(0.84, 0.035, 0.62), material);
  emptyBenchSnow.name = "Brecht open bench empty-place snow cap";
  emptyBenchSnow.rotation.y = BRECHT_YAW_RAD;
  emptyBenchSnow.position.copy(
    rotatedPoint(brechtX, brechtZ, BRECHT_YAW_RAD, 0.47, GROUND_Y_M + 0.89, 0),
  );
  snow.add(emptyBenchSnow);
  for (const [index, stele] of BRECHT_STELE_SPECS.entries()) {
    const localX = Math.cos(stele.angle) * stele.radius;
    const localZ = Math.sin(stele.angle) * stele.radius;
    const steleCap = new Mesh(
      new CylinderGeometry(
        stele.radiusM + 0.018,
        stele.radiusM + 0.018,
        0.035,
        18,
      ),
      material,
    );
    steleCap.name = `Brecht cylindrical stele ${index + 1} snow cap`;
    steleCap.position.copy(
      rotatedPoint(
        brechtX,
        brechtZ,
        BRECHT_YAW_RAD,
        localX,
        GROUND_Y_M + stele.height + 0.0175,
        localZ,
      ),
    );
    snow.add(steleCap);
  }
  const [weigelX, weigelZ] =
    BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld;
  const vitrineCap = new Mesh(
    new BoxGeometry(
      WEIGEL_DIMENSIONS.caseWidthM + 0.06,
      0.045,
      WEIGEL_DIMENSIONS.caseDepthM + 0.06,
    ),
    material,
  );
  vitrineCap.name = "Helene Weigel vitrine snow cap";
  vitrineCap.rotation.y = WEIGEL_YAW_RAD;
  vitrineCap.position.set(
    weigelX,
    GROUND_Y_M +
      WEIGEL_DIMENSIONS.plinthHeightM +
      WEIGEL_DIMENSIONS.caseHeightM +
      0.0225,
    weigelZ,
  );
  snow.add(vitrineCap);
  return snow;
}

/** Source-owned public art, shared by all five modes without generic doubles. */
export function createBerlinerEnsemblePublicArt(): Group {
  const root = new Group();
  root.name = "Berliner Ensemble public-art details";
  root.userData = {
    ...BERLINER_ENSEMBLE_PROFILE,
    brechtSite: "Bertolt-Brecht-Platz",
    heleneWeigelSite: "Helene-Weigel-Hof",
    ownedOsmKeys: [...BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS],
    profile: BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE,
    schwellenraumGeschuetzt: true,
    suppressesGenericModels: true,
    texturePolicy: "procedural geometry only; no photo or portrait texture",
  };
  root.add(createBrechtMemorial());
  root.add(createWeigelMemorial());
  root.add(createSnowAccents());
  return root;
}

export function setBerlinerEnsemblePublicArtSnow(
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

function worldToLocal(
  x: number,
  z: number,
  anchorX: number,
  anchorZ: number,
  yaw: number,
): readonly [number, number] {
  const dx = x - anchorX;
  const dz = z - anchorZ;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

/** Exact figure/chair/steles and vitrine solids; open plaza remains walkable. */
export function berlinerEnsemblePublicArtSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  if (![x, y, z, radiusM].every(Number.isFinite)) return false;
  const padding = Math.max(0, radiusM);
  const [brechtX, brechtZ] = BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld;
  const [localX, localZ] = worldToLocal(x, z, brechtX, brechtZ, BRECHT_YAW_RAD);
  if (
    y >= GROUND_Y_M - padding &&
    y <= GROUND_Y_M + 2.55 + padding &&
    Math.abs(localX + 0.05) <= 0.98 + padding &&
    Math.abs(localZ + 0.18) <= 0.96 + padding
  ) {
    return true;
  }
  for (const stele of BRECHT_STELE_SPECS) {
    if (y < GROUND_Y_M - padding || y > GROUND_Y_M + stele.height + padding) {
      continue;
    }
    const steleX = Math.cos(stele.angle) * stele.radius;
    const steleZ = Math.sin(stele.angle) * stele.radius;
    if (
      Math.hypot(localX - steleX, localZ - steleZ) <=
      stele.radiusM + padding
    ) {
      return true;
    }
  }

  const [weigelX, weigelZ] =
    BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld;
  const [weigelLocalX, weigelLocalZ] = worldToLocal(
    x,
    z,
    weigelX,
    weigelZ,
    WEIGEL_YAW_RAD,
  );
  return (
    y >= GROUND_Y_M - padding &&
    y <=
      GROUND_Y_M +
        WEIGEL_DIMENSIONS.plinthHeightM +
        WEIGEL_DIMENSIONS.caseHeightM +
        padding &&
    Math.abs(weigelLocalX) <= WEIGEL_DIMENSIONS.plinthWidthM / 2 + padding &&
    Math.abs(weigelLocalZ) <= WEIGEL_DIMENSIONS.plinthDepthM / 2 + padding
  );
}
