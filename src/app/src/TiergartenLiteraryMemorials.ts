import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  InstancedMesh,
  Material,
  Mesh,
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

export const TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS = Object.freeze([
  "node/278738513",
  "node/884700390",
] as const);

export const GOETHE_INSCRIPTION_GOLD = 0xc49a45;

const GOETHE_WORLD_M = [321.583409, 4.69, 574.310594] as const;
const LESSING_WORLD_M = [220.8739978952799, 4.2, 766.8354332130402] as const;
const GOETHE_YAW_RAD = Math.PI / 2;
const LESSING_YAW_RAD = 0.25;
const LESSING_FENCE_HALF_EXTENT_M = 2.8;
const LESSING_FENCE_CHAMFER_M = 0.8;
const LESSING_FENCE_STRAIGHT_HALF_M = 2;
const LESSING_FENCE_VERTICES = Object.freeze([
  [-LESSING_FENCE_STRAIGHT_HALF_M, -LESSING_FENCE_HALF_EXTENT_M],
  [LESSING_FENCE_STRAIGHT_HALF_M, -LESSING_FENCE_HALF_EXTENT_M],
  [LESSING_FENCE_HALF_EXTENT_M, -LESSING_FENCE_STRAIGHT_HALF_M],
  [LESSING_FENCE_HALF_EXTENT_M, LESSING_FENCE_STRAIGHT_HALF_M],
  [LESSING_FENCE_STRAIGHT_HALF_M, LESSING_FENCE_HALF_EXTENT_M],
  [-LESSING_FENCE_STRAIGHT_HALF_M, LESSING_FENCE_HALF_EXTENT_M],
  [-LESSING_FENCE_HALF_EXTENT_M, LESSING_FENCE_STRAIGHT_HALF_M],
  [-LESSING_FENCE_HALF_EXTENT_M, -LESSING_FENCE_STRAIGHT_HALF_M],
] as const);

/**
 * Stable integration contract for the two source-owned monuments. All source
 * photographs are reference-only; the renderer is procedural and text-free.
 */
export const TIERGARTEN_LITERARY_MEMORIALS_PROFILE = Object.freeze({
  apiVersion: 1,
  name: "Tiergarten literary memorials",
  ownedOsmKeys: TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS,
  goethe: Object.freeze({
    id: "goethe",
    name: "Goethe-Denkmal",
    publicLabel: "Goethe-Denkmal",
    osmKey: "node/278738513",
    wgs84: [13.3763737, 52.5137982] as const,
    worldM: GOETHE_WORLD_M,
    rotationY: GOETHE_YAW_RAD,
    frontWorldXZ: [1, 0] as const,
    artist: "Fritz Schaper",
    created: "1876–1880",
    unveiled: "1880-06-02",
    figureHeightM: 2.72,
    pedestalHeightM: 3.36,
    totalHeightM: 6.08,
    roundPedestalDiameterM: 4,
    materials: "Carrara marble; light-grey Silesian granite substructure",
    fenceFieldCount: 42,
    fenceSizeM: 8.4,
    fenceHeightM: 1.1,
    allegories: Object.freeze([
      Object.freeze({
        angleDeg: -60,
        cue: "Lyrik",
        pair: "seated muse with lyre and winged Amor",
      }),
      Object.freeze({
        angleDeg: 60,
        cue: "Dramatik",
        pair: "veiled woman with scroll/stylus and death genius with lowered torch",
      }),
      Object.freeze({
        angleDeg: 180,
        cue: "Wissenschaft",
        pair: "reading woman with book and truth genius with raised torch",
      }),
    ]),
    officialSource:
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318",
    inventorySource:
      "https://bildhauerei-in-berlin.de/bildwerk/goethedenkmal-5168/",
    osmSource: "https://www.openstreetmap.org/node/278738513",
    visualReferences: Object.freeze([
      Object.freeze({
        pageUrl:
          "https://commons.wikimedia.org/wiki/File%3ABerlin%2C_Tiergarten%2C_Grosser_Tiergarten%2C_Goethe-Denkmal.jpg",
        author: "Jörg Zägel",
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      }),
      Object.freeze({
        pageUrl:
          "https://commons.wikimedia.org/wiki/File%3ATiergarten%2C_Goethe-Denkmal.jpg",
        author: "Senorita78",
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      }),
      Object.freeze({
        pageUrl:
          "https://commons.wikimedia.org/wiki/File%3AJohann_Wolfgang_von_Goethe_monument_in_the_Tiergarten%2C_Berlin_2014-1.jpg",
        author: "Mike Peel",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      }),
    ]),
    inscriptionCue: "GOETHE / ERRICHTET / IM JAHRE / MDCCCLXXX",
  }),
  lessing: Object.freeze({
    id: "lessing",
    name: "Lessing-Denkmal",
    publicLabel: "Lessing-Denkmal",
    osmKey: "node/884700390",
    wgs84: [13.3749541, 52.5120477] as const,
    worldM: LESSING_WORLD_M,
    rotationY: LESSING_YAW_RAD,
    frontWorldXZ: [Math.sin(LESSING_YAW_RAD), Math.cos(LESSING_YAW_RAD)] as const,
    artist: "Otto Lessing",
    pedestalDesign: "Wilhelm Rettig",
    placeDesign: "Hermann Geitner",
    marbleExecution: "Hermann Bauch",
    created: "1887–1890",
    unveiled: "1890-10-14",
    figureHeightM: 3,
    pedestalHeightM: 4,
    totalHeightM: 7,
    materials: "white Laaser marble; reddish Scottish granite; bronze; wrought iron",
    fenceChamferM: LESSING_FENCE_CHAMFER_M,
    fenceFieldCount: 28,
    fenceHalfExtentM: LESSING_FENCE_HALF_EXTENT_M,
    fenceOutline: "chamfered-octagon",
    fenceSegmentCount: 8,
    frontBearingStatus:
      "inferred from the mapped south-southeast approach, 14–16 degrees east of south",
    officialSource:
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318",
    inventorySource:
      "https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/",
    osmSource: "https://www.openstreetmap.org/node/884700390",
    visualReferences: Object.freeze([
      Object.freeze({
        pageUrl:
          "https://commons.wikimedia.org/wiki/File:Lessing_monument_in_Berlin_Tiergarten_9593.jpg",
        author: "Dosseman",
        license: "CC BY-SA 4.0",
      }),
      Object.freeze({
        pageUrl:
          "https://commons.wikimedia.org/wiki/File:Lessing_Tiergarten_3K.jpg",
        author: "Manfred Brueckels",
        license: "CC BY-SA 3.0",
      }),
      Object.freeze({
        pageUrl:
          "https://commons.wikimedia.org/wiki/File:Lessing_Tiergarten_4K.jpg",
        author: "Manfred Brueckels",
        license: "CC BY-SA 3.0",
      }),
    ]),
  }),
  renderPolicy: Object.freeze({
    modes: Object.freeze([
      "day",
      "night",
      "snowstorm",
      "minecraft",
      "schwellenraum",
    ]),
    texturePolicy: "procedural geometry only; no photograph or canvas texture",
    maxCombinedRenderables: 12,
    maxRenderedVertices: 25_000,
    maxMinecraftBlocks: 599,
  }),
});

export const TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES = Object.freeze({
  goethe: Object.freeze({
    coreRadiusM: 2.2,
    coreHeightM: 6.08,
    allegoryRadiusM: 2.75,
    allegorySolidRadiusM: 0.72,
    allegoryHeightM: 3.05,
    fenceHalfExtentM: 4.2,
    fenceThicknessM: 0.08,
    fenceHeightM: 1.1,
  }),
  lessing: Object.freeze({
    coreRadiusM: 2.28,
    coreHeightM: 7,
    fenceChamferM: LESSING_FENCE_CHAMFER_M,
    fenceCollisionShape: "chamfered-octagon",
    fenceFieldCount: 28,
    fenceHalfExtentM: LESSING_FENCE_HALF_EXTENT_M,
    fenceSegmentCount: 8,
    fenceStraightHalfM: LESSING_FENCE_STRAIGHT_HALF_M,
    fenceThicknessM: 0.065,
    fenceHeightM: 0.96,
  }),
});

export const TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES = Object.freeze({
  goethe: Object.freeze({
    shape: "circle",
    radiusM: 4.3,
    rotationY: GOETHE_YAW_RAD,
  }),
  lessing: Object.freeze({
    shape: "circle",
    radiusM: 2.95,
    rotationY: LESSING_YAW_RAD,
  }),
});

const CARRARA = 0xe7e3d6;
const LIGHT_GRANITE = 0xaaa9a3;
const LESSING_RED_GRANITE = 0x987368;
const LESSING_GREY_GRANITE = 0xaaa79f;
const PATINATED_BRONZE = 0x486d63;
const BRONZE_HIGHLIGHT = 0x64867a;
const WROUGHT_IRON = 0x353b3a;
const SNOW = 0xeaf1ef;

type Cue = {
  colorHex?: number;
  name: string;
  position: readonly [number, number, number];
  role: string;
  fineDetail?: boolean;
};

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

function addEllipsoid(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  segments = 9,
  inked = false,
): void {
  const geometry = new SphereGeometry(1, segments, 6);
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

function addCone(
  builder: Builder,
  color: number,
  position: readonly [number, number, number],
  radius: number,
  height: number,
  segments = 8,
  rotation: readonly [number, number, number] = [0, 0, 0],
  inked = false,
): void {
  const geometry = new ConeGeometry(radius, height, segments, 1, false);
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
  const geometry = new TorusGeometry(radius, tube, 3, 7, arc);
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
  if (delta.lengthSq() === 0) return;
  const geometry = new CylinderGeometry(radius, radius, delta.length(), segments);
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

function addCue(parent: Group, cue: Cue): void {
  const marker = new Object3D();
  marker.name = cue.name;
  marker.position.set(...cue.position);
  marker.userData = {
    cueId: cue.name,
    colorHex: cue.colorHex,
    fineDetail: cue.fineDetail === true,
    role: cue.role,
    sourceBounded: true,
  };
  parent.add(marker);
}

function radialPoint(
  angleDeg: number,
  radius: number,
  tangent = 0,
  y = 0,
): [number, number, number] {
  const angle = (angleDeg * Math.PI) / 180;
  const outwardX = -Math.sin(angle);
  const outwardZ = Math.cos(angle);
  const tangentX = Math.cos(angle);
  const tangentZ = Math.sin(angle);
  return [
    outwardX * radius + tangentX * tangent,
    y,
    outwardZ * radius + tangentZ * tangent,
  ];
}

function radialBeam(
  builder: Builder,
  color: number,
  angleDeg: number,
  startRadius: number,
  startTangent: number,
  startY: number,
  endRadius: number,
  endTangent: number,
  endY: number,
  beamRadius: number,
): void {
  addBeam(
    builder,
    color,
    radialPoint(angleDeg, startRadius, startTangent, startY),
    radialPoint(angleDeg, endRadius, endTangent, endY),
    beamRadius,
  );
}

const LETTER_STROKES: Readonly<Record<string, ReadonlyArray<readonly [number, number, number, number]>>> = {
  E: [[0, 1, 1, 1], [0, 0.5, 0.8, 0.5], [0, 0, 1, 0], [0, 0, 0, 1]],
  G: [[1, 0.5, 1, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 1, 1, 1], [0.55, 0.5, 1, 0.5]],
  H: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5]],
  I: [[0, 1, 1, 1], [0.5, 1, 0.5, 0], [0, 0, 1, 0]],
  L: [[0, 1, 0, 0], [0, 0, 1, 0]],
  N: [[0, 0, 0, 1], [0, 1, 1, 0], [1, 0, 1, 1]],
  O: [[0, 0, 0, 1], [0, 1, 1, 1], [1, 1, 1, 0], [1, 0, 0, 0]],
  S: [[1, 1, 0, 1], [0, 1, 0, 0.5], [0, 0.5, 1, 0.5], [1, 0.5, 1, 0], [1, 0, 0, 0]],
  T: [[0, 1, 1, 1], [0.5, 1, 0.5, 0]],
};

function addFrontWord(
  builder: Builder,
  word: string,
  centerY: number,
  frontZ: number,
  width: number,
  color: number,
): void {
  const cellWidth = width / word.length;
  const glyphWidth = cellWidth * 0.56;
  const glyphHeight = glyphWidth * 1.25;
  const startX = -width / 2 + cellWidth * 0.22;
  for (let letterIndex = 0; letterIndex < word.length; letterIndex += 1) {
    const strokes = LETTER_STROKES[word[letterIndex]] ?? [];
    const xOffset = startX + letterIndex * cellWidth;
    for (const stroke of strokes) {
      addBeam(
        builder,
        color,
        [xOffset + stroke[0] * glyphWidth, centerY + (stroke[1] - 0.5) * glyphHeight, frontZ],
        [xOffset + stroke[2] * glyphWidth, centerY + (stroke[3] - 0.5) * glyphHeight, frontZ],
        0.014,
        5,
      );
    }
  }
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

function createGoetheFence(core: Builder, fine: Builder): void {
  const half = 4.2;
  const height = 1.1;
  const iron = WROUGHT_IRON;
  for (const side of [-1, 1]) {
    addBeam(core, iron, [-half, 0.24, side * half], [half, 0.24, side * half], 0.035, 6, true);
    addBeam(core, iron, [-half, 0.94, side * half], [half, 0.94, side * half], 0.04, 6, true);
    addBeam(core, iron, [side * half, 0.24, -half], [side * half, 0.24, half], 0.035, 6, true);
    addBeam(core, iron, [side * half, 0.94, -half], [side * half, 0.94, half], 0.04, 6, true);
  }
  for (const [x, z] of [[-half, -half], [-half, half], [half, -half], [half, half]] as const) {
    addCylinder(core, iron, [x, height / 2, z], 0.055, 0.055, height, 7, [0, 0, 0], true);
    addEllipsoid(fine, iron, [x, height + 0.055, z], [0.085, 0.085, 0.085], [0, 0, 0], 6);
  }

  const sideSpecs = [
    { axis: "x" as const, fixed: half, fields: 11, normalRotationY: 0 },
    { axis: "x" as const, fixed: -half, fields: 11, normalRotationY: 0 },
    { axis: "z" as const, fixed: half, fields: 10, normalRotationY: Math.PI / 2 },
    { axis: "z" as const, fixed: -half, fields: 10, normalRotationY: Math.PI / 2 },
  ];
  for (const side of sideSpecs) {
    const fieldWidth = (half * 2) / side.fields;
    for (let field = 0; field < side.fields; field += 1) {
      const along = -half + field * fieldWidth;
      const mid = along + fieldWidth / 2;
      const postPosition: [number, number, number] = side.axis === "x"
        ? [along, height / 2, side.fixed]
        : [side.fixed, height / 2, along];
      addCylinder(fine, iron, postPosition, 0.022, 0.022, height, 5);
      const centre: [number, number, number] = side.axis === "x"
        ? [mid, 0.62, side.fixed]
        : [side.fixed, 0.62, mid];
      addTorus(fine, iron, centre, Math.min(0.12, fieldWidth * 0.2), 0.014, [0, side.normalRotationY, 0]);
      const p1: [number, number, number] = side.axis === "x"
        ? [along + fieldWidth * 0.18, 0.3, side.fixed]
        : [side.fixed, 0.3, along + fieldWidth * 0.18];
      const p2: [number, number, number] = side.axis === "x"
        ? [along + fieldWidth * 0.82, 0.88, side.fixed]
        : [side.fixed, 0.88, along + fieldWidth * 0.82];
      const p3: [number, number, number] = side.axis === "x"
        ? [along + fieldWidth * 0.18, 0.88, side.fixed]
        : [side.fixed, 0.88, along + fieldWidth * 0.18];
      const p4: [number, number, number] = side.axis === "x"
        ? [along + fieldWidth * 0.82, 0.3, side.fixed]
        : [side.fixed, 0.3, along + fieldWidth * 0.82];
      addBeam(fine, iron, p1, p2, 0.013, 5);
      addBeam(fine, iron, p3, p4, 0.013, 5);
    }
  }
}

function createGoetheAllegory(
  core: Builder,
  fine: Builder,
  angleDeg: number,
  cue: "Lyrik" | "Dramatik" | "Wissenschaft",
): void {
  const localYaw = (-angleDeg * Math.PI) / 180;
  addBox(core, CARRARA, radialPoint(angleDeg, 2.55, 0, 0.55), [1.65, 0.72, 1.35], [0, localYaw, 0], true);
  addCone(core, CARRARA, radialPoint(angleDeg, 2.55, -0.25, 1.3), 0.48, 1.35, 8, [0, localYaw, 0], true);
  addEllipsoid(core, CARRARA, radialPoint(angleDeg, 2.55, -0.24, 2.05), [0.3, 0.34, 0.29], [0, localYaw, 0], 8, true);
  radialBeam(core, CARRARA, angleDeg, 2.48, -0.55, 1.55, 2.75, -0.74, 0.92, 0.12);
  radialBeam(core, CARRARA, angleDeg, 2.48, 0.02, 1.55, 2.76, 0.35, 0.98, 0.12);

  addCapsule(core, CARRARA, radialPoint(angleDeg, 2.72, 0.54, 1.32), 0.2, 0.62, [0.86, 1, 0.8], [0, localYaw, 0.12], true);
  addEllipsoid(core, CARRARA, radialPoint(angleDeg, 2.72, 0.54, 1.87), [0.22, 0.25, 0.21], [0, localYaw, 0], 7, true);
  radialBeam(core, CARRARA, angleDeg, 2.72, 0.45, 1.35, 2.98, 0.82, 0.95, 0.09);
  radialBeam(core, CARRARA, angleDeg, 2.72, 0.62, 1.35, 2.45, 0.95, 1.02, 0.09);
  addEllipsoid(fine, CARRARA, radialPoint(angleDeg, 2.54, 0.38, 1.55), [0.13, 0.52, 0.33], [0, localYaw, -0.38], 7);
  addEllipsoid(fine, CARRARA, radialPoint(angleDeg, 2.72, 0.78, 1.48), [0.11, 0.42, 0.28], [0, localYaw, 0.44], 7);

  if (cue === "Lyrik") {
    const lyre = radialPoint(angleDeg, 2.9, -0.66, 1.45);
    addTorus(fine, CARRARA, lyre, 0.24, 0.035, [0, localYaw, 0], Math.PI * 1.3);
    for (const offset of [-0.09, 0, 0.09]) {
      radialBeam(fine, CARRARA, angleDeg, 2.9, -0.66 + offset, 1.28, 2.9, -0.66 + offset, 1.65, 0.012);
    }
  } else if (cue === "Dramatik") {
    addEllipsoid(fine, CARRARA, radialPoint(angleDeg, 2.55, -0.24, 2.18), [0.34, 0.18, 0.35], [0, localYaw, 0], 7);
    addBox(fine, CARRARA, radialPoint(angleDeg, 2.93, -0.52, 1.28), [0.42, 0.06, 0.55], [0.35, localYaw, 0]);
    radialBeam(fine, CARRARA, angleDeg, 2.78, 0.82, 1.42, 3.02, 0.92, 0.82, 0.055);
    addCone(fine, CARRARA, radialPoint(angleDeg, 3.04, 0.94, 0.72), 0.13, 0.3, 6, [0, localYaw, Math.PI]);
  } else {
    addBox(fine, CARRARA, radialPoint(angleDeg, 2.91, -0.52, 1.32), [0.52, 0.08, 0.62], [-0.3, localYaw, 0]);
    radialBeam(fine, CARRARA, angleDeg, 2.65, 0.7, 1.45, 2.5, 0.88, 2.25, 0.055);
    addCone(fine, CARRARA, radialPoint(angleDeg, 2.48, 0.9, 2.38), 0.13, 0.32, 6, [0, localYaw, 0]);
  }
}

function createGoetheSnow(): Group {
  const builder = createBuilder();
  addCylinder(builder, SNOW, [0, 0.235, 0], 2.16, 2.16, 0.05, 16);
  addCylinder(builder, SNOW, [0, 3.385, 0], 1.25, 1.25, 0.05, 16);
  addEllipsoid(builder, SNOW, [0, 6.095, 0.02], [0.28, 0.045, 0.25], [0, 0, 0], 8);
  addEllipsoid(builder, SNOW, [0.25, 5.34, -0.03], [0.58, 0.055, 0.35], [0, 0, -0.16], 8);
  for (const angle of [-60, 60, 180]) {
    addEllipsoid(builder, SNOW, radialPoint(angle, 2.55, -0.2, 2.37), [0.34, 0.045, 0.28], [0, (-angle * Math.PI) / 180, 0], 7);
  }
  const snow = finishLayer(builder, "Goethe memorial reversible snow caps", {
    snowOnly: true,
    snowActive: false,
  });
  snow.visible = false;
  return snow;
}

function createGoetheMemorial(): Group {
  const memorial = new Group();
  memorial.name = "Goethe-Denkmal exact literary memorial";
  memorial.position.set(...GOETHE_WORLD_M);
  memorial.rotation.y = GOETHE_YAW_RAD;
  memorial.userData = {
    exactOwnOsmKey: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.osmKey,
    frontWorldXZ: [1, 0],
    profile: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe,
    sourceOwned: true,
  };
  const core = createBuilder();
  const fine = createBuilder();

  addCylinder(core, LIGHT_GRANITE, [0, 0.09, 0], 2.2, 2.2, 0.18, 16, [0, 0, 0], true);
  addCylinder(core, CARRARA, [0, 0.27, 0], 2.06, 2.12, 0.18, 16, [0, 0, 0], true);
  addCylinder(core, CARRARA, [0, 0.52, 0], 1.9, 2.02, 0.32, 16, [0, 0, 0], true);
  addCylinder(core, CARRARA, [0, 1.78, 0], 1.55, 1.72, 2.2, 16, [0, 0, 0], true);
  addCylinder(core, CARRARA, [0, 2.98, 0], 1.82, 1.55, 0.2, 16, [0, 0, 0], true);
  addCylinder(core, CARRARA, [0, 3.19, 0], 1.25, 1.78, 0.22, 16, [0, 0, 0], true);
  addCylinder(core, CARRARA, [0, 3.315, 0], 1.13, 1.22, 0.09, 16, [0, 0, 0], true);

  addCapsule(core, CARRARA, [-0.22, 3.95, 0.11], 0.19, 0.82, [0.78, 1, 0.78], [0, 0, -0.035], true);
  addCapsule(core, CARRARA, [0.22, 3.98, -0.08], 0.19, 0.88, [0.78, 1, 0.78], [0, 0, 0.035], true);
  addEllipsoid(core, CARRARA, [0, 4.75, 0], [0.58, 0.76, 0.38], [0, 0, 0], 10, true);
  addCone(core, CARRARA, [0.2, 4.62, -0.18], 0.65, 1.8, 10, [0, 0, -0.08], true);
  addEllipsoid(core, CARRARA, [0, 5.79, 0.02], [0.29, 0.29, 0.27], [0, -0.12, 0], 10, true);
  addBeam(core, CARRARA, [-0.45, 5.18, 0.02], [-0.5, 4.68, 0.34], 0.12, 7, true);
  addBeam(core, CARRARA, [0.45, 5.18, 0], [0.52, 4.72, 0.05], 0.12, 7, true);
  addCylinder(core, CARRARA, [-0.51, 4.63, 0.42], 0.055, 0.055, 0.5, 7, [Math.PI / 2, 0, 0.08], true);

  addBox(fine, CARRARA, [0, 4.93, 0.37], [0.38, 0.74, 0.05], [0, 0, 0]);
  for (const y of [4.7, 4.86, 5.02, 5.18]) addEllipsoid(fine, LIGHT_GRANITE, [0, y, 0.405], [0.035, 0.035, 0.025], [0, 0, 0], 6);
  addBox(fine, CARRARA, [0, 5.45, 0.25], [0.28, 0.12, 0.08], [0, 0, 0.12]);
  for (const x of [-0.21, 0.21]) addEllipsoid(fine, CARRARA, [x, 5.82, -0.17], [0.13, 0.18, 0.11], [0, 0, 0], 7);
  addBeam(fine, LIGHT_GRANITE, [0.14, 5.32, -0.31], [0.33, 3.5, -0.28], 0.025, 5);
  addBeam(fine, LIGHT_GRANITE, [0.3, 5.28, -0.26], [0.4, 3.52, -0.22], 0.025, 5);
  addBox(fine, CARRARA, [-0.24, 3.49, 0.14], [0.38, 0.13, 0.7], [0, 0, 0]);
  addBox(fine, CARRARA, [0.24, 3.49, -0.08], [0.38, 0.13, 0.7], [0, 0, 0]);

  for (const allegory of TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.allegories) {
    createGoetheAllegory(core, fine, allegory.angleDeg, allegory.cue);
  }
  addFrontWord(fine, "GOETHE", 1.84, 1.705, 1.7, GOETHE_INSCRIPTION_GOLD);
  for (const y of [1.53, 1.4, 1.27]) addBeam(fine, GOETHE_INSCRIPTION_GOLD, [-0.58, y, 1.708], [0.58, y, 1.708], 0.012, 5);
  createGoetheFence(core, fine);

  const coreLayer = finishLayer(core, "Goethe memorial structural silhouette", {
    layerRole: "structural",
    maxHeightM: 6.08,
  });
  const fineLayer = finishLayer(fine, "Goethe memorial fine allegory and fence cues", {
    fadeAsFineDetail: true,
    fenceFieldCount: 42,
    gildedInscriptionColorHex: GOETHE_INSCRIPTION_GOLD,
    layerRole: "fine-detail",
  });
  memorial.add(coreLayer, fineLayer, createGoetheSnow());

  for (const cue of [
    { name: "Goethe cue standing figure", position: [0, 4.72, 0], role: "2.72 m standing Goethe with scroll, hip hand, court dress and mantle" },
    { name: "Goethe cue Lyrik pair", position: radialPoint(-60, 2.65, 0, 1.2), role: "muse, lyre and winged Amor" },
    { name: "Goethe cue Dramatik pair", position: radialPoint(60, 2.65, 0, 1.2), role: "veiled Drama, writing implements and death genius with lowered torch" },
    { name: "Goethe cue Wissenschaft pair", position: radialPoint(180, 2.65, 0, 1.2), role: "reading Science and truth genius with raised torch" },
    { colorHex: GOETHE_INSCRIPTION_GOLD, name: "Goethe cue gilded front inscription", position: [0, 1.55, 1.72], role: "source-bounded geometric GOETHE inscription cue", fineDetail: true },
    { name: "Goethe cue reconstructed 42-field fence", position: [0, 0.55, 4.2], role: "closed reconstructed iron fence with posts, balls, volutes and fourpass cues", fineDetail: true },
  ] as Cue[]) addCue(memorial, cue);
  memorial.userData.cueCount = 6;
  memorial.userData.fenceFieldCount = 42;
  return memorial;
}

function addWing(
  builder: Builder,
  position: readonly [number, number, number],
  rotationY: number,
  mirror = 1,
): void {
  addEllipsoid(builder, PATINATED_BRONZE, position, [0.16, 0.62, 0.38], [0.15 * mirror, rotationY, 0.38 * mirror], 8);
  addEllipsoid(builder, BRONZE_HIGHLIGHT, [position[0], position[1] + 0.12, position[2]], [0.09, 0.42, 0.26], [0.12 * mirror, rotationY, 0.46 * mirror], 7);
}

function createLessingFence(core: Builder, fine: Builder): void {
  const height = 0.96;
  for (let segment = 0; segment < LESSING_FENCE_VERTICES.length; segment += 1) {
    const start = LESSING_FENCE_VERTICES[segment];
    const end = LESSING_FENCE_VERTICES[(segment + 1) % LESSING_FENCE_VERTICES.length];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const diagonal = Math.abs(dx) > 0.01 && Math.abs(dz) > 0.01;
    const fieldCount = diagonal ? 2 : 5;
    const fencePlaneYaw = Math.atan2(-dz, dx);
    addBeam(core, WROUGHT_IRON, [start[0], 0.2, start[1]], [end[0], 0.2, end[1]], 0.032, 6);
    addBeam(core, WROUGHT_IRON, [start[0], 0.84, start[1]], [end[0], 0.84, end[1]], 0.036, 6);
    addCylinder(core, WROUGHT_IRON, [start[0], height / 2, start[1]], 0.05, 0.05, height, 6);
    addEllipsoid(fine, WROUGHT_IRON, [start[0], height + 0.05, start[1]], [0.075, 0.075, 0.075], [0, 0, 0], 4);
    for (let field = 0; field < fieldCount; field += 1) {
      const fieldStart = field / fieldCount;
      const fieldEnd = (field + 1) / fieldCount;
      const centreT = (fieldStart + fieldEnd) / 2;
      const centre: [number, number, number] = [
        start[0] + dx * centreT,
        0.55,
        start[1] + dz * centreT,
      ];
      addTorus(
        fine,
        WROUGHT_IRON,
        centre,
        diagonal ? 0.115 : 0.14,
        0.018,
        [0, fencePlaneYaw, 0],
      );
      const lowT = fieldStart + (fieldEnd - fieldStart) * 0.18;
      const highT = fieldStart + (fieldEnd - fieldStart) * 0.82;
      addBeam(
        fine,
        WROUGHT_IRON,
        [start[0] + dx * lowT, 0.22, start[1] + dz * lowT],
        [start[0] + dx * highT, 0.8, start[1] + dz * highT],
        0.014,
        5,
      );
      addBeam(
        fine,
        WROUGHT_IRON,
        [start[0] + dx * lowT, 0.8, start[1] + dz * lowT],
        [start[0] + dx * highT, 0.22, start[1] + dz * highT],
        0.014,
        5,
      );
    }
  }
}

function createLessingFrontGroup(core: Builder, fine: Builder): void {
  addBox(core, PATINATED_BRONZE, [0.18, 1.58, 1.48], [0.78, 1.5, 0.12], [-0.08, 0, -0.12], true);
  for (const y of [1.25, 1.45, 1.65, 1.85]) addBeam(fine, BRONZE_HIGHLIGHT, [-0.1, y, 1.56], [0.46, y + 0.05, 1.56], 0.012, 5);
  addCapsule(core, PATINATED_BRONZE, [-0.32, 1.63, 1.75], 0.19, 0.64, [0.9, 1, 0.8], [0.75, 0, -0.42], true);
  addEllipsoid(core, PATINATED_BRONZE, [-0.47, 2.16, 1.73], [0.22, 0.25, 0.2], [0, 0, 0], 8, true);
  addBeam(core, PATINATED_BRONZE, [-0.36, 1.55, 1.74], [-0.98, 1.12, 1.92], 0.1, 7, true);
  addBeam(core, PATINATED_BRONZE, [-0.25, 1.52, 1.74], [0.4, 1.17, 1.92], 0.1, 7, true);
  addBeam(core, PATINATED_BRONZE, [-0.54, 1.95, 1.74], [-0.72, 2.72, 1.82], 0.085, 7, true);
  addEllipsoid(fine, PATINATED_BRONZE, [-0.73, 2.93, 1.82], [0.2, 0.09, 0.2], [0, 0, 0], 7);
  addCone(fine, BRONZE_HIGHLIGHT, [-0.73, 3.1, 1.82], 0.13, 0.35, 7);
  addWing(fine, [-0.17, 2.05, 1.52], 0.08, -1);
  addWing(fine, [-0.55, 2.05, 1.52], -0.08, 1);
  addTorus(fine, PATINATED_BRONZE, [0.48, 1.44, 1.82], 0.24, 0.035, [0, 0, 0], Math.PI * 1.35);
  for (const x of [0.36, 0.46, 0.56]) addBeam(fine, PATINATED_BRONZE, [x, 1.23, 1.82], [x, 1.62, 1.82], 0.012, 5);
  addTorus(fine, PATINATED_BRONZE, [-0.82, 0.94, 1.83], 0.2, 0.028, [Math.PI / 2, 0, 0]);
}

function createLessingRearGroup(core: Builder, fine: Builder): void {
  addEllipsoid(core, PATINATED_BRONZE, [0.05, 1.55, -1.5], [0.42, 0.62, 0.25], [-0.35, 0, 0.05], 9, true);
  addEllipsoid(core, PATINATED_BRONZE, [0.02, 2.18, -1.52], [0.23, 0.25, 0.21], [0, 0, 0], 8, true);
  addBeam(core, PATINATED_BRONZE, [-0.12, 1.58, -1.56], [-0.72, 1.08, -1.7], 0.1, 7, true);
  addBeam(core, PATINATED_BRONZE, [0.18, 1.6, -1.56], [0.64, 1.08, -1.72], 0.1, 7, true);
  addBeam(core, PATINATED_BRONZE, [0.18, 1.92, -1.58], [0.82, 2.47, -1.7], 0.085, 7, true);
  addBeam(fine, PATINATED_BRONZE, [0.78, 2.42, -1.7], [1.04, 2.7, -1.72], 0.025, 5);
  addBeam(fine, PATINATED_BRONZE, [0.84, 2.4, -1.7], [1.12, 2.58, -1.74], 0.02, 5);
  addWing(fine, [-0.2, 2.02, -1.48], Math.PI, -1);
  addWing(fine, [0.2, 2.02, -1.48], Math.PI, 1);
  addEllipsoid(fine, PATINATED_BRONZE, [0.02, 1.12, -1.62], [0.6, 0.18, 0.32], [0, 0, 0], 8);
  addEllipsoid(fine, BRONZE_HIGHLIGHT, [0.02, 1.15, -1.88], [0.23, 0.2, 0.15], [0, 0, 0], 7);
  addEllipsoid(fine, PATINATED_BRONZE, [-0.72, 1.07, -1.7], [0.14, 0.18, 0.13], [0, 0, 0], 7);
  addCone(fine, PATINATED_BRONZE, [-0.72, 1.27, -1.7], 0.11, 0.2, 6);
  addBox(fine, PATINATED_BRONZE, [0.72, 0.88, -1.64], [0.52, 0.08, 0.36], [0.08, 0.18, 0]);
}

function createLessingSideDetails(core: Builder, fine: Builder): void {
  for (const side of [-1, 1]) {
    addEllipsoid(core, LESSING_RED_GRANITE, [side * 1.5, 1.18, 0], [0.58, 0.22, 0.72], [0, 0, 0], 9, true);
    addTorus(fine, LESSING_RED_GRANITE, [side * 1.5, 1.27, 0], 0.5, 0.06, [Math.PI / 2, 0, 0]);
    addEllipsoid(fine, PATINATED_BRONZE, [side * 1.28, 1.72, 0], [0.26, 0.2, 0.18], [0, 0, side * 0.35], 8);
    addCone(fine, PATINATED_BRONZE, [side * 1.48, 1.69, 0], 0.09, 0.28, 6, [0, 0, side * Math.PI / 2]);
    addTorus(fine, PATINATED_BRONZE, [side * 1.17, 2.5, 0], 0.36, 0.055, [0, Math.PI / 2, 0]);
    addEllipsoid(fine, BRONZE_HIGHLIGHT, [side * 1.19, 2.5, 0], [0.23, 0.3, 0.08], [0, 0, 0], 8);
  }
  addTorus(fine, PATINATED_BRONZE, [0, 2.52, -1.16], 0.36, 0.055, [0, 0, 0]);
  addEllipsoid(fine, BRONZE_HIGHLIGHT, [0, 2.52, -1.18], [0.23, 0.3, 0.08], [0, 0, 0], 8);
  addTorus(fine, PATINATED_BRONZE, [0, 2.52, 1.17], 0.42, 0.065, [0, 0, 0]);
}

function createLessingSnow(): Group {
  const builder = createBuilder();
  addCylinder(builder, SNOW, [0, 0.725, 0], 1.62, 1.62, 0.05, 8);
  addCylinder(builder, SNOW, [0, 3.825, 0], 1.5, 1.5, 0.05, 8);
  addEllipsoid(builder, SNOW, [0.02, 7.015, 0], [0.27, 0.045, 0.24], [0, 0, 0], 6);
  addEllipsoid(builder, SNOW, [-0.24, 6.05, -0.03], [0.54, 0.05, 0.34], [0, 0, 0.12], 6);
  addEllipsoid(builder, SNOW, [-0.4, 3.23, 1.58], [0.65, 0.045, 0.28], [0, 0, 0], 6);
  addEllipsoid(builder, SNOW, [0, 2.65, -1.54], [0.5, 0.045, 0.24], [0, 0, 0], 6);
  for (const side of [-1, 1]) addEllipsoid(builder, SNOW, [side * 1.5, 1.43, 0], [0.48, 0.045, 0.6], [0, 0, 0], 6);
  const snow = finishLayer(builder, "Lessing memorial reversible snow caps", {
    snowOnly: true,
    snowActive: false,
  });
  snow.visible = false;
  return snow;
}

function createLessingMemorial(): Group {
  const memorial = new Group();
  memorial.name = "Lessing-Denkmal exact literary memorial";
  memorial.position.set(...LESSING_WORLD_M);
  memorial.rotation.y = LESSING_YAW_RAD;
  memorial.userData = {
    exactOwnOsmKey: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.osmKey,
    frontWorldXZ: [...TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.frontWorldXZ],
    profile: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing,
    sourceOwned: true,
  };
  const core = createBuilder();
  const fine = createBuilder();

  const steps = [
    [2.28, 0.14, LESSING_GREY_GRANITE],
    [2.12, 0.14, LESSING_GREY_GRANITE],
    [1.96, 0.14, LESSING_GREY_GRANITE],
    [1.8, 0.14, LESSING_RED_GRANITE],
    [1.64, 0.14, LESSING_RED_GRANITE],
  ] as const;
  let stepBottom = 0;
  for (const [radius, height, color] of steps) {
    addCylinder(core, color, [0, stepBottom + height / 2, 0], radius, radius, height, 8, [0, 0, 0], true);
    stepBottom += height;
  }
  addCylinder(core, LESSING_RED_GRANITE, [0, 0.86, 0], 1.48, 1.55, 0.32, 8, [0, 0, 0], true);
  addCylinder(core, LESSING_RED_GRANITE, [0, 1.12, 0], 1.32, 1.45, 0.2, 8, [0, 0, 0], true);
  addCylinder(core, LESSING_RED_GRANITE, [0, 2.18, 0], 1.07, 1.3, 1.92, 8, [0, 0, 0], true);
  for (const [x, z] of [[-0.93, -0.93], [-0.93, 0.93], [0.93, -0.93], [0.93, 0.93]] as const) {
    addTorus(fine, LESSING_RED_GRANITE, [x, 3.15, z], 0.22, 0.09, [Math.PI / 2, 0, 0]);
  }
  addCylinder(core, LESSING_RED_GRANITE, [0, 3.25, 0], 1.48, 1.08, 0.22, 8, [0, 0, 0], true);
  addCylinder(core, LESSING_RED_GRANITE, [0, 3.5, 0], 1.62, 1.46, 0.28, 8, [0, 0, 0], true);
  addCylinder(core, LESSING_RED_GRANITE, [0, 3.74, 0], 1.47, 1.62, 0.2, 8, [0, 0, 0], true);
  addCylinder(core, LESSING_RED_GRANITE, [0, 3.92, 0], 0.93, 1.22, 0.16, 8, [0, 0, 0], true);

  addCapsule(core, CARRARA, [-0.2, 4.62, 0.12], 0.19, 0.88, [0.82, 1, 0.82], [0, 0, -0.04], true);
  addCapsule(core, CARRARA, [0.22, 4.58, -0.07], 0.19, 0.8, [0.82, 1, 0.82], [0, 0, 0.04], true);
  addEllipsoid(core, CARRARA, [0, 5.55, 0], [0.59, 0.83, 0.4], [0, 0, 0], 10, true);
  addCone(core, CARRARA, [0.16, 5.25, -0.17], 0.7, 2.2, 10, [0, 0, -0.08], true);
  addEllipsoid(core, CARRARA, [0, 6.7, 0.02], [0.28, 0.3, 0.26], [0, -0.12, 0], 10, true);
  addBeam(core, CARRARA, [-0.48, 5.95, 0.02], [-0.57, 5.45, 0.12], 0.12, 7, true);
  addBeam(core, CARRARA, [0.48, 5.94, 0.03], [0.52, 5.27, 0.42], 0.12, 7, true);
  addBox(core, CARRARA, [0.55, 5.17, 0.5], [0.44, 0.12, 0.58], [-0.15, 0.08, 0], true);
  addEllipsoid(fine, CARRARA, [-0.25, 6.74, -0.17], [0.12, 0.18, 0.1], [0, 0, 0], 7);
  addEllipsoid(fine, CARRARA, [0.25, 6.74, -0.17], [0.12, 0.18, 0.1], [0, 0, 0], 7);
  addBox(fine, CARRARA, [0, 5.7, 0.39], [0.38, 0.8, 0.05], [0, 0, 0]);
  for (const y of [5.48, 5.65, 5.82, 5.99]) addEllipsoid(fine, LESSING_GREY_GRANITE, [0, y, 0.425], [0.034, 0.034, 0.024], [0, 0, 0], 6);
  addBox(fine, CARRARA, [-0.23, 4.1, 0.16], [0.38, 0.12, 0.64], [0, 0, 0]);
  addBox(fine, CARRARA, [0.23, 4.1, -0.08], [0.38, 0.12, 0.64], [0, 0, 0]);

  createLessingFrontGroup(core, fine);
  createLessingRearGroup(core, fine);
  createLessingSideDetails(core, fine);
  addFrontWord(fine, "LESSING", 2.55, 1.11, 1.65, PATINATED_BRONZE);
  createLessingFence(core, fine);

  const coreLayer = finishLayer(core, "Lessing memorial structural silhouette", {
    layerRole: "structural",
    maxHeightM: 7,
  });
  const fineLayer = finishLayer(fine, "Lessing memorial relief allegory and fence cues", {
    fadeAsFineDetail: true,
    fenceFieldCount: 28,
    fenceOutline: "chamfered-octagon",
    fenceSegmentCount: 8,
    layerRole: "fine-detail",
    portraitCount: 3,
  });
  memorial.add(coreLayer, fineLayer, createLessingSnow());
  for (const cue of [
    { name: "Lessing cue standing book figure", position: [0, 5.5, 0], role: "3 m Lessing with book, hip hand, side hair rolls and mantle support" },
    { name: "Lessing cue Genius der Humanität", position: [0, 1.8, 1.7], role: "front winged reclining genius with flame bowl, lyre, laurel and Ringparabel tablet" },
    { name: "Lessing cue Allegorie der Kritik", position: [0, 1.8, -1.7], role: "rear winged criticism with scourge, lion skin, owl, books and scrolls" },
    { name: "Lessing cue Mendelssohn portrait", position: [-1.2, 2.5, 0], role: "right-side bronze portrait cartouche" },
    { name: "Lessing cue Ewald von Kleist portrait", position: [1.2, 2.5, 0], role: "left-side bronze portrait cartouche" },
    { name: "Lessing cue Nicolai portrait", position: [0, 2.5, -1.2], role: "rear bronze portrait cartouche" },
    { name: "Lessing cue twin basins and dolphin spouts", position: [0, 1.45, 0], role: "two rounded side basins with grotesque dolphin masks" },
    { name: "Lessing cue current simplified fence", position: [0, 0.5, 2.8], role: "current 28-field chamfered-octagon ring-and-diamond fence, not the lost ornate original", fineDetail: true },
  ] as Cue[]) addCue(memorial, cue);
  memorial.userData.cueCount = 8;
  memorial.userData.fenceFieldCount = 28;
  memorial.userData.fenceOutline = "chamfered-octagon";
  memorial.userData.fenceSegmentCount = 8;
  return memorial;
}

/** Source-owned smooth monuments shared by Day, Night, Snowstorm and Schwellenraum. */
export function createTiergartenLiteraryMemorials(): Group {
  const root = new Group();
  root.name = "Tiergarten exact literary memorials";
  root.userData = {
    apiVersion: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.apiVersion,
    modes: ["day", "night", "snowstorm", "schwellenraum"],
    ownedOsmKeys: [...TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS],
    profile: TIERGARTEN_LITERARY_MEMORIALS_PROFILE,
    schwellenraumGeschuetzt: true,
    suppressesGenericModels: true,
    texturePolicy: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.renderPolicy.texturePolicy,
  };
  root.add(createGoetheMemorial(), createLessingMemorial());
  return root;
}

/** Snow is a static, reversible detail layer; monument body transforms never change. */
export function setTiergartenLiteraryMemorialsSnow(
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

function worldToMemorialLocal(
  x: number,
  z: number,
  world: readonly [number, number, number],
  yaw: number,
): readonly [number, number] {
  const dx = x - world[0];
  const dz = z - world[2];
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

function squareFenceBandAt(
  x: number,
  z: number,
  halfExtent: number,
  thickness: number,
  padding: number,
): boolean {
  const limit = halfExtent + padding;
  const band = thickness + padding;
  return (
    (Math.abs(Math.abs(x) - halfExtent) <= band && Math.abs(z) <= limit) ||
    (Math.abs(Math.abs(z) - halfExtent) <= band && Math.abs(x) <= limit)
  );
}

function squaredDistanceToFenceSegment(
  x: number,
  z: number,
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared))
    : 0;
  const nearestX = start[0] + dx * t;
  const nearestZ = start[1] + dz * t;
  return (x - nearestX) ** 2 + (z - nearestZ) ** 2;
}

function lessingChamferedFenceBandAt(
  x: number,
  z: number,
  thickness: number,
): boolean {
  const thicknessSquared = thickness * thickness;
  return LESSING_FENCE_VERTICES.some((start, index) =>
    squaredDistanceToFenceSegment(
      x,
      z,
      start,
      LESSING_FENCE_VERTICES[(index + 1) % LESSING_FENCE_VERTICES.length],
    ) <= thicknessSquared,
  );
}

/** Actual pedestal, figure-group and fence solids; fenced interiors stay unfilled. */
export function tiergartenLiteraryMemorialSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  if (![x, y, z, radiusM].every(Number.isFinite)) return false;
  const padding = Math.max(0, radiusM);
  const goethe = TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.goethe;
  const [goetheX, goetheZ] = worldToMemorialLocal(x, z, GOETHE_WORLD_M, GOETHE_YAW_RAD);
  const goetheY = y - GOETHE_WORLD_M[1];
  if (
    goetheY >= -padding &&
    goetheY <= goethe.coreHeightM + padding &&
    goetheX * goetheX + goetheZ * goetheZ <= (goethe.coreRadiusM + padding) ** 2
  ) return true;
  if (goetheY >= -padding && goetheY <= goethe.allegoryHeightM + padding) {
    for (const allegory of TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.allegories) {
      const centre = radialPoint(allegory.angleDeg, goethe.allegoryRadiusM);
      if ((goetheX - centre[0]) ** 2 + (goetheZ - centre[2]) ** 2 <= (goethe.allegorySolidRadiusM + padding) ** 2) return true;
    }
  }
  if (
    goetheY >= -padding &&
    goetheY <= goethe.fenceHeightM + padding &&
    // pedestrianPointIsBlocked already probes the four horizontal body-edge
    // samples. Expanding these thin fence rails by the same radius again
    // turns their square corners into false diagonal walls across the mapped
    // ring path, so fence bands alone intentionally receive no second pad.
    squareFenceBandAt(goetheX, goetheZ, goethe.fenceHalfExtentM, goethe.fenceThicknessM, 0)
  ) return true;

  const lessing = TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.lessing;
  const [lessingX, lessingZ] = worldToMemorialLocal(x, z, LESSING_WORLD_M, LESSING_YAW_RAD);
  const lessingY = y - LESSING_WORLD_M[1];
  if (
    lessingY >= -padding &&
    lessingY <= lessing.coreHeightM + padding &&
    lessingX * lessingX + lessingZ * lessingZ <= (lessing.coreRadiusM + padding) ** 2
  ) return true;
  return (
    lessingY >= -padding &&
    lessingY <= lessing.fenceHeightM + padding &&
    // Eight exact rail segments match the photographed chamfered fence and
    // keep its diagonal corners inside the mapped circular path.
    lessingChamferedFenceBandAt(
      lessingX,
      lessingZ,
      lessing.fenceThicknessM,
    )
  );
}

/** Two-dimensional conservation envelopes used for placement/protection checks. */
export function tiergartenLiteraryMemorialProtectedAt(
  x: number,
  z: number,
  radiusM = 0,
): boolean {
  if (![x, z, radiusM].every(Number.isFinite)) return false;
  const padding = Math.max(0, radiusM);
  const [goetheX, goetheZ] = worldToMemorialLocal(x, z, GOETHE_WORLD_M, GOETHE_YAW_RAD);
  const goetheRadius = TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES.goethe.radiusM + padding;
  if (goetheX * goetheX + goetheZ * goetheZ <= goetheRadius * goetheRadius) return true;
  const [lessingX, lessingZ] = worldToMemorialLocal(x, z, LESSING_WORLD_M, LESSING_YAW_RAD);
  const lessingRadius = TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES.lessing.radiusM + padding;
  return lessingX * lessingX + lessingZ * lessingZ <= lessingRadius * lessingRadius;
}

function pushBlock(
  blocks: Block[],
  world: readonly [number, number, number],
  yaw: number,
  local: readonly [number, number, number],
  color: number,
  size: number,
  scale: readonly [number, number, number] = [1, 1, 1],
): void {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  blocks.push({
    color,
    position: [
      world[0] + cosine * local[0] + sine * local[2],
      world[1] + local[1],
      world[2] - sine * local[0] + cosine * local[2],
    ],
    rotationY: yaw,
    scale: [size * scale[0], size * scale[1], size * scale[2]],
  });
}

function pushDiscLayer(
  blocks: Block[],
  world: readonly [number, number, number],
  yaw: number,
  radiusCells: number,
  centreY: number,
  color: number,
  size: number,
): void {
  for (let x = -radiusCells; x <= radiusCells; x += 1) {
    for (let z = -radiusCells; z <= radiusCells; z += 1) {
      if (x * x + z * z > (radiusCells + 0.25) ** 2) continue;
      pushBlock(blocks, world, yaw, [x * size, centreY, z * size], color, size);
    }
  }
}

function pushSquarePerimeter(
  blocks: Block[],
  world: readonly [number, number, number],
  yaw: number,
  halfCells: number,
  centreY: number,
  color: number,
  size: number,
): void {
  for (let along = -halfCells; along <= halfCells; along += 1) {
    for (const side of [-1, 1]) {
      pushBlock(blocks, world, yaw, [along * size, centreY, side * halfCells * size], color, size);
      if (Math.abs(along) !== halfCells) pushBlock(blocks, world, yaw, [side * halfCells * size, centreY, along * size], color, size);
    }
  }
}

function pushLessingChamferedPerimeter(
  blocks: Block[],
  world: readonly [number, number, number],
  yaw: number,
  centreY: number,
  color: number,
  size: number,
  spacingM: number,
): void {
  for (let segment = 0; segment < LESSING_FENCE_VERTICES.length; segment += 1) {
    const start = LESSING_FENCE_VERTICES[segment];
    const end = LESSING_FENCE_VERTICES[(segment + 1) % LESSING_FENCE_VERTICES.length];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const sampleCount = Math.max(1, Math.round(Math.hypot(dx, dz) / spacingM));
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const t = sample / sampleCount;
      pushBlock(
        blocks,
        world,
        yaw,
        [start[0] + dx * t, centreY, start[1] + dz * t],
        color,
        size,
      );
    }
  }
}

function createGoetheBlocks(blocks: Block[], size: number): void {
  const world = GOETHE_WORLD_M;
  const yaw = GOETHE_YAW_RAD;
  pushDiscLayer(blocks, world, yaw, 3, size * 0.5, LIGHT_GRANITE, size);
  pushDiscLayer(blocks, world, yaw, 3, size * 1.5, CARRARA, size);
  for (let level = 2; level <= 5; level += 1) pushDiscLayer(blocks, world, yaw, 2, size * (level + 0.5), CARRARA, size);
  pushDiscLayer(blocks, world, yaw, 2, size * 6.5, CARRARA, size);
  for (const x of [-0.28, 0.28]) {
    for (const y of [3.65, 4.2]) pushBlock(blocks, world, yaw, [x, y, 0], CARRARA, size);
  }
  for (const local of [[0, 4.75, 0], [0, 5.25, 0], [0, 5.78, 0], [0.48, 4.95, 0], [-0.48, 4.95, 0], [-0.55, 4.6, 0.32]] as const) pushBlock(blocks, world, yaw, local, CARRARA, size);
  for (const allegory of TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.allegories) {
    for (const [radius, tangent, y, color] of [
      [2.55, -0.28, 0.56, CARRARA],
      [2.55, 0.28, 0.56, CARRARA],
      [2.55, -0.28, 1.12, CARRARA],
      [2.55, -0.28, 1.68, CARRARA],
      [2.7, 0.48, 1.12, CARRARA],
      [2.7, 0.48, 1.68, CARRARA],
      [2.85, 0, 1.12, LIGHT_GRANITE],
    ] as const) pushBlock(blocks, world, yaw, radialPoint(allegory.angleDeg, radius, tangent, y), color, size);
  }
  pushSquarePerimeter(blocks, world, yaw, 7, 0.56, WROUGHT_IRON, size);
  for (let along = -7; along <= 7; along += 2) {
    for (const side of [-1, 1]) {
      pushBlock(blocks, world, yaw, [along * size, 1.12, side * 7 * size], WROUGHT_IRON, size);
      if (Math.abs(along) !== 7) pushBlock(blocks, world, yaw, [side * 7 * size, 1.12, along * size], WROUGHT_IRON, size);
    }
  }
}

function createLessingBlocks(blocks: Block[], size: number): void {
  const world = LESSING_WORLD_M;
  const yaw = LESSING_YAW_RAD;
  pushDiscLayer(blocks, world, yaw, 3, size * 0.5, LESSING_GREY_GRANITE, size);
  pushDiscLayer(blocks, world, yaw, 3, size * 1.5, LESSING_RED_GRANITE, size);
  for (let level = 2; level <= 6; level += 1) pushDiscLayer(blocks, world, yaw, 2, size * (level + 0.5), LESSING_RED_GRANITE, size);
  for (const x of [-0.28, 0.28]) {
    for (const y of [4.2, 4.76, 5.32]) pushBlock(blocks, world, yaw, [x, y, 0], CARRARA, size);
  }
  for (const local of [[0, 5.72, 0], [0, 6.26, 0], [0, 6.72, 0], [0.5, 5.82, 0.25], [-0.5, 5.82, 0], [0.55, 5.28, 0.48]] as const) pushBlock(blocks, world, yaw, local, CARRARA, size);
  for (const side of [-1, 1]) {
    for (const local of [[side * 1.55, 1.12, 0], [side * 1.55, 1.68, 0], [side * 1.2, 2.24, 0]] as const) pushBlock(blocks, world, yaw, local, PATINATED_BRONZE, size);
  }
  for (const z of [-1.55, 1.55]) {
    for (const local of [[-0.45, 1.12, z], [0.1, 1.12, z], [0.1, 1.68, z], [-0.45, 2.24, z], [0.55, 2.24, z]] as const) pushBlock(blocks, world, yaw, local, PATINATED_BRONZE, size);
  }
  pushLessingChamferedPerimeter(blocks, world, yaw, 0.56, WROUGHT_IRON, size, size);
  pushLessingChamferedPerimeter(blocks, world, yaw, 1.12, WROUGHT_IRON, size, size * 2);
}

/** Both monuments as one texture-free, block-native Minecraft draw call. */
export function createTiergartenLiteraryMemorialsMinecraft(): InstancedMesh {
  const blockSizeM = 0.56;
  const blocks: Block[] = [];
  createGoetheBlocks(blocks, blockSizeM);
  createLessingBlocks(blocks, blockSizeM);
  if (blocks.length >= 600) throw new Error(`Literary memorial Minecraft budget exceeded: ${blocks.length}`);
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    // Match the established Minecraft batches: a restrained neutral lift
    // keeps every instance colour legible on mobile shadow faces.
    emissive: 0x2b3132,
    emissiveIntensity: 0.14,
    flatShading: true,
    metalness: 0,
    opacity: 1,
    roughness: 0.93,
    transparent: false,
    // Deliberately no vertexColors: BoxGeometry has no `color` attribute.
    // InstancedMesh supplies USE_INSTANCING_COLOR independently.
  });
  material.name = "Tiergarten literary memorials Minecraft material";
  const mesh = new InstancedMesh(geometry, material, blocks.length);
  mesh.name = "Tiergarten literary memorials Minecraft block batch";
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
  // This single batch spans two distant park anchors. Keep it on the same
  // viewer-safe path as the other voxel batches so a stale aggregate bound
  // cannot cull the coloured blocks while their shadow pass remains visible.
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    blockCount: blocks.length,
    blockNative: true,
    blockSizeM,
    exactOneBatch: true,
    lessingFenceFieldCount: 28,
    lessingFenceOutline: "chamfered-octagon",
    lessingFenceSegmentCount: 8,
    mode: "minecraft",
    ownedOsmKeys: [...TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS],
    smoothGeometryExcluded: true,
    textureFree: true,
  };
  return mesh;
}
