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
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { markArchitecturalInk } from "./architecturalInk";
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

const BRONZE = 0x526c65;
const BRONZE_LIGHT = 0x68877e;
const DARK_STONE = 0x313636;
const SETT_LIGHT = 0xaaa59a;
const SETT_DARK = 0x89877f;
const PALE_PLINTH = 0xd2cec4;
const WEIGEL_RED = 0xa8322f;
const WEIGEL_RED_DARK = 0x6f2828;
const WEIGEL_WHITE = 0xeeeae1;
const WEIGEL_BLACK = 0x242626;

const BRECHT_STELE_SPECS = [
  { angle: -2.2, height: 1.78, radius: 2.35, width: 0.42 },
  { angle: 0.05, height: 1.62, radius: 2.28, width: 0.46 },
  { angle: 2.15, height: 1.72, radius: 2.32, width: 0.4 },
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
    installed: 1988,
    material: "Bronze, Granit/Naturstein und Metall",
    osmKey: BERLINER_ENSEMBLE_PROFILE.brechtOsmKey,
    site: "Bertolt-Brecht-Platz",
    turntableDiameterM:
      BERLINER_ENSEMBLE_PROFILE.brechtTurntableDiameterM,
    worldM: BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld,
    geometryStatus:
      "six-metre circular sett platform, seated full-body Brecht on an open metal chair and three surrounding segmented dark steles; procedural, source-bounded and not a portrait texture",
    sources: [
      "https://www.deutsche-digitale-bibliothek.de/item/5ALSSIMTMT2PKBR7UXTZZASRRBP7K366",
      "https://www.defa-stiftung.de/en/films/film-search/bertolt-brecht-platz/",
      "https://commons.wikimedia.org/wiki/File:Bertolt_Brecht,_Skulptur_von_Fritz_Cremer_am_BE_in_Berlin.jpg",
      "https://commons.wikimedia.org/wiki/Category:Bertolt-Brecht-Denkmal_(Berlin)",
      "https://bildhauerei-in-berlin.de/bildwerk/bertolt-brecht-denkmal-5412/",
    ],
    visualReference: {
      artist: "Manfred Brückels",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Bertolt_Brecht,_Skulptur_von_Fritz_Cremer_am_BE_in_Berlin.jpg",
      role: "seated bronze figure, open chair and free side of the seat",
    },
  },
  heleneWeigel: {
    artists:
      "Studierende der Bildhauereiklasse von Monica Bonvicini, Universität der Künste Berlin",
    unveiled: "2026-05-10",
    osmKey: BERLINER_ENSEMBLE_PROFILE.heleneWeigelOsmKey,
    site: "Helene-Weigel-Hof",
    worldM: BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld,
    geometryStatus:
      "current accessible non-classical glass-vitrine work: red director's chair and object landscape, white light/audio bars, black halftone glass portrait and plinth grilles; procedural and texture-free",
    officialSources: [
      "https://www.berliner-ensemble.de/eine-skulptur-fuer-helene-weigel",
      "https://www.berliner-ensemble.de/magazin/helene-weigel-hat-einen-neuen-platz",
    ],
    corroboratingSource:
      "https://www.arte.tv/de/videos/133101-000-A/eine-skulptur-fuer-helene-weigel/",
    photoReferencePolicy:
      "BE photographs © Moritz Haase inspected as reference only; no photograph is bundled or used as a texture",
  },
  renderPolicy: {
    fineLayer: "Helene Weigel halftone glass portrait",
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
  const renderedGeometry = geometry.index
    ? geometry.toNonIndexed()
    : geometry;
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

function createBrechtMemorial(): Group {
  const builder = createBuilder();
  const [x, z] = BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld;

  const lowerTurntable = new CylinderGeometry(2.92, 2.92, 0.14, 48);
  lowerTurntable.translate(x, GROUND_Y_M + 0.07, z);
  addPainted(builder, lowerTurntable, SETT_DARK, false);
  const upperTurntable = new CylinderGeometry(2.7, 2.7, 0.08, 48);
  upperTurntable.translate(x, GROUND_Y_M + 0.15, z);
  addPainted(builder, upperTurntable, SETT_LIGHT, false);
  const curb = new TorusGeometry(2.8, 0.105, 6, 48);
  curb.rotateX(Math.PI / 2);
  curb.translate(x, GROUND_Y_M + 0.21, z);
  addPainted(builder, curb, SETT_LIGHT, true);

  // Radial joints retain the documented six-metre turntable at close range.
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2;
    addLocalBox(
      builder,
      x,
      z,
      angle,
      index % 3 === 0 ? SETT_DARK : SETT_LIGHT,
      0,
      GROUND_Y_M + 0.205,
      2.42,
      0.2,
      0.025,
      0.7,
      0,
      false,
    );
  }

  // Cremer's open metal chair: four legs and a spare right-hand seat remain
  // visible around the compact, upright seated figure.
  for (const chairX of [-0.7, 0.7]) {
    for (const chairZ of [-0.36, 0.36]) {
      localBeam(
        builder,
        x,
        z,
        BRECHT_YAW_RAD,
        DARK_STONE,
        [chairX, GROUND_Y_M + 0.2, chairZ],
        [chairX, GROUND_Y_M + 0.86, chairZ],
        0.045,
      );
    }
  }
  for (const chairZ of [-0.36, 0.36]) {
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      DARK_STONE,
      [-0.72, GROUND_Y_M + 0.86, chairZ],
      [0.72, GROUND_Y_M + 0.86, chairZ],
      0.05,
    );
  }
  for (const chairX of [-0.7, 0.7]) {
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      DARK_STONE,
      [chairX, GROUND_Y_M + 0.86, -0.36],
      [chairX, GROUND_Y_M + 0.86, 0.36],
      0.05,
    );
  }

  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE,
    -0.23,
    GROUND_Y_M + 1.38,
    0.02,
    0.36,
    0.6,
    0.29,
  );
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.23,
    GROUND_Y_M + 2.14,
    -0.02,
    0.25,
    0.31,
    0.24,
  );
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.23,
    GROUND_Y_M + 2.12,
    -0.235,
    0.09,
    0.08,
    0.12,
    false,
  );
  for (const side of [-1, 1]) {
    const hipX = -0.23 + side * 0.15;
    const kneeX = -0.23 + side * 0.22;
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [hipX, GROUND_Y_M + 1.04, -0.05],
      [kneeX, GROUND_Y_M + 0.78, -0.62],
      0.14,
    );
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [kneeX, GROUND_Y_M + 0.78, -0.62],
      [kneeX + side * 0.03, GROUND_Y_M + 0.24, -0.72],
      0.115,
    );
    addLocalEllipsoid(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      kneeX + side * 0.03,
      GROUND_Y_M + 0.19,
      -0.83,
      0.15,
      0.09,
      0.29,
    );
  }
  for (const side of [-1, 1]) {
    localBeam(
      builder,
      x,
      z,
      BRECHT_YAW_RAD,
      BRONZE,
      [-0.23 + side * 0.29, GROUND_Y_M + 1.72, -0.01],
      [-0.18 + side * 0.22, GROUND_Y_M + 1.18, -0.34],
      0.09,
    );
  }
  addLocalEllipsoid(
    builder,
    x,
    z,
    BRECHT_YAW_RAD,
    BRONZE_LIGHT,
    -0.18,
    GROUND_Y_M + 1.15,
    -0.38,
    0.24,
    0.11,
    0.12,
  );

  for (const [index, stele] of BRECHT_STELE_SPECS.entries()) {
    const localX = Math.cos(stele.angle) * stele.radius;
    const localZ = Math.sin(stele.angle) * stele.radius;
    for (let segment = 0; segment < 4; segment += 1) {
      const segmentHeight = stele.height / 4 - 0.025;
      addLocalBox(
        builder,
        x,
        z,
        BRECHT_YAW_RAD,
        segment % 2 === 0 ? DARK_STONE : 0x3d4141,
        localX,
        GROUND_Y_M + 0.3 + segment * (stele.height / 4),
        localZ,
        stele.width * (segment === 3 ? 0.78 : 1),
        segmentHeight,
        0.27,
        -stele.angle + (index === 1 ? 0.1 : 0),
      );
    }
  }

  const memorial = finishDrawnGroup(builder, {
    name: "Bertolt Brecht memorial installation",
  });
  if (!memorial) throw new Error("Brecht memorial geometry is empty");
  memorial.userData.profile = BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.brecht;
  memorial.userData.detailCounts = {
    chairLegs: 4,
    platformDiameterM:
      BERLINER_ENSEMBLE_PROFILE.brechtTurntableDiameterM,
    seatedFullBodyFigure: 1,
    segmentedSteles: BRECHT_STELE_SPECS.length,
  };
  memorial.userData.exactOwnOsmKey =
    BERLINER_ENSEMBLE_PROFILE.brechtOsmKey;
  return memorial;
}

function createWeigelHalftone(
  anchorX: number,
  anchorZ: number,
): InstancedMesh {
  const dots: Array<{ x: number; y: number; radius: number }> = [];
  for (let row = 0; row < 19; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      const u = -1 + (column / 14) * 2;
      const v = -1 + (row / 18) * 2;
      const head = ((u - 0.12) / 0.58) ** 2 + ((v - 0.33) / 0.73) ** 2 <= 1;
      const shoulders =
        v < -0.18 &&
        ((u + 0.02) / 0.98) ** 2 + ((v + 0.92) / 0.75) ** 2 <= 1;
      const bun = ((u + 0.48) / 0.28) ** 2 + ((v - 0.39) / 0.3) ** 2 <= 1;
      if (!head && !shoulders && !bun) continue;
      const pattern =
        Math.sin((column + 2) * 5.173 + (row + 1) * 8.349) * 0.5 + 0.5;
      if (pattern < (head ? 0.2 : 0.34)) continue;
      dots.push({
        radius: 0.022 + pattern * 0.025,
        x: u * 0.74,
        y: v * 0.89,
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
  const dummy = new Object3D();
  dots.forEach((dot, index) => {
    const point = rotatedPoint(
      anchorX,
      anchorZ,
      WEIGEL_YAW_RAD,
      dot.x,
      GROUND_Y_M + 1.82 + dot.y,
      -1.285,
    );
    dummy.position.copy(point);
    dummy.rotation.set(0, WEIGEL_YAW_RAD, 0);
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

  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    PALE_PLINTH,
    0,
    GROUND_Y_M + 0.25,
    0,
    3.25,
    0.5,
    2.6,
  );
  for (let index = 0; index < 8; index += 1) {
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_BLACK,
      -0.48 + index * 0.135,
      GROUND_Y_M + 0.23,
      -1.315,
      0.065,
      0.14,
      0.025,
      0,
      false,
    );
  }
  for (const [localX, localY, localZ, scale, localYaw, color] of [
    [-0.48, 0.74, 0.16, 0.72, 0.18, WEIGEL_RED],
    [0.22, 0.67, -0.08, 0.64, -0.32, WEIGEL_RED_DARK],
    [0.61, 0.84, 0.25, 0.58, 0.44, WEIGEL_RED],
    [-0.02, 0.93, 0.37, 0.5, 0.02, WEIGEL_RED],
  ] as const) {
    const geometry = new TetrahedronGeometry(scale, 0);
    geometry.rotateY(WEIGEL_YAW_RAD + localYaw);
    const point = rotatedPoint(
      x,
      z,
      WEIGEL_YAW_RAD,
      localX,
      GROUND_Y_M + localY,
      localZ,
    );
    geometry.translate(point.x, point.y, point.z);
    addPainted(builder, geometry, color, true);
  }
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    0xc64a42,
    -0.25,
    GROUND_Y_M + 0.84,
    -0.22,
    1.65,
    0.12,
    1.05,
    0.12,
  );

  // Red director's chair raised above the object landscape.
  for (const side of [-1, 1]) {
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [0.32 + side * 0.42, GROUND_Y_M + 0.95, -0.1],
      [0.32 - side * 0.35, GROUND_Y_M + 2.02, -0.1],
      0.045,
    );
    localBeam(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      [0.32 + side * 0.42, GROUND_Y_M + 0.95, 0.42],
      [0.32 - side * 0.35, GROUND_Y_M + 2.02, 0.42],
      0.045,
    );
  }
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED,
    0.32,
    GROUND_Y_M + 1.58,
    0.16,
    0.9,
    0.11,
    0.55,
  );
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    WEIGEL_RED,
    0.32,
    GROUND_Y_M + 2.08,
    0.42,
    0.92,
    0.55,
    0.08,
  );
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_RED_DARK,
      0.32 + side * 0.51,
      GROUND_Y_M + 1.83,
      0.16,
      0.07,
      0.07,
      0.63,
    );
  }

  for (const [tubeX, tubeY, tubeZ, tubeWidth] of [
    [-0.37, 0.7, -0.72, 1.55],
    [0.28, 1.12, 0.68, 1.2],
    [-0.62, 1.42, 0.28, 0.82],
  ] as const) {
    addLocalBox(
      builder,
      x,
      z,
      WEIGEL_YAW_RAD,
      WEIGEL_WHITE,
      tubeX,
      GROUND_Y_M + tubeY,
      tubeZ,
      tubeWidth,
      0.055,
      0.055,
      0.08,
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
    -0.92,
    GROUND_Y_M + 0.9,
    0.42,
    0.34,
    0.25,
    0.38,
  );
  addLocalBox(
    builder,
    x,
    z,
    WEIGEL_YAW_RAD,
    0xd6c3a1,
    -0.86,
    GROUND_Y_M + 1.09,
    0.35,
    0.43,
    0.1,
    0.32,
    -0.12,
  );

  const solids = finishDrawnGroup(builder, {
    lampEmissive: 0xfff4d4,
    lampEmissiveIntensity: 0.72,
    name: "Helene Weigel vitrine contents and plinth",
  });
  if (solids) group.add(solids);

  const caseGeometry = new BoxGeometry(2.92, 2.72, 2.36);
  caseGeometry.rotateY(WEIGEL_YAW_RAD);
  const caseCentre = rotatedPoint(
    x,
    z,
    WEIGEL_YAW_RAD,
    0,
    GROUND_Y_M + 1.86,
    0,
  );
  caseGeometry.translate(caseCentre.x, caseCentre.y, caseCentre.z);
  const glassDay = new MeshBasicMaterial({
    color: 0xbad6d5,
    depthWrite: false,
    opacity: 0.14,
    side: DoubleSide,
    transparent: true,
  });
  const glassNight = new MeshStandardMaterial({
    color: 0x688d91,
    depthWrite: false,
    emissive: 0x17373b,
    emissiveIntensity: 0.16,
    opacity: 0.17,
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

  const caseInk = new LineSegments(
    new EdgesGeometry(caseGeometry, 25),
    markArchitecturalInk(new LineBasicMaterial(), "detail"),
  );
  caseInk.name = "Helene Weigel glass vitrine edge frame";
  caseInk.renderOrder = 2;
  group.add(caseInk);
  const portrait = createWeigelHalftone(x, z);
  group.add(portrait);
  group.userData.profile =
    BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.heleneWeigel;
  group.userData.exactOwnOsmKey =
    BERLINER_ENSEMBLE_PROFILE.heleneWeigelOsmKey;
  group.userData.detailCounts = {
    directorChairs: 1,
    glassVitrines: 1,
    lightAndAudioBars: 3,
    plinthVentSlots: 8,
    portraitDots: portrait.count,
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
  const [weigelX, weigelZ] =
    BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld;
  const vitrineCap = new Mesh(new BoxGeometry(3, 0.06, 2.44), material);
  vitrineCap.name = "Helene Weigel vitrine snow cap";
  vitrineCap.rotation.y = WEIGEL_YAW_RAD;
  vitrineCap.position.set(weigelX, GROUND_Y_M + 3.25, weigelZ);
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
  const [localX, localZ] = worldToLocal(
    x,
    z,
    brechtX,
    brechtZ,
    BRECHT_YAW_RAD,
  );
  if (
    y >= GROUND_Y_M - padding &&
    y <= GROUND_Y_M + 2.55 + padding &&
    Math.abs(localX + 0.05) <= 0.98 + padding &&
    Math.abs(localZ + 0.18) <= 0.96 + padding
  ) {
    return true;
  }
  if (y >= GROUND_Y_M - padding && y <= GROUND_Y_M + 1.9 + padding) {
    for (const stele of BRECHT_STELE_SPECS) {
      const steleX = Math.cos(stele.angle) * stele.radius;
      const steleZ = Math.sin(stele.angle) * stele.radius;
      if (
        Math.abs(localX - steleX) <= stele.width / 2 + padding &&
        Math.abs(localZ - steleZ) <= 0.18 + padding
      ) {
        return true;
      }
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
    y <= GROUND_Y_M + 3.28 + padding &&
    Math.abs(weigelLocalX) <= 1.63 + padding &&
    Math.abs(weigelLocalZ) <= 1.31 + padding
  );
}
