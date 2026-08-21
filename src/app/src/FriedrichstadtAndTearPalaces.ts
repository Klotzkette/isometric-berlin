import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  TorusGeometry,
  Vector3,
  type Object3DEventMap,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

export type PalaceDetailProfile = "full" | "mobile";

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

export const FRIEDRICHSTADT_PALAST_ROOT_NAME =
  "Friedrichstadt-Palast source-bound recognition model";
export const FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME =
  "Friedrichstadt-Palast arched concrete-glass fields";
export const FRIEDRICHSTADT_PALAST_SIGN_LAYER_NAME =
  "Friedrichstadt-Palast procedural facade lettering";
export const TEAR_PALACE_ROOT_NAME =
  "Tränenpalast source-bound steel-glass pavilion";
export const TEAR_PALACE_GLASS_LAYER_NAME =
  "Tränenpalast transparent perimeter glazing";
export const TEAR_PALACE_MULLION_LAYER_NAME =
  "Tränenpalast aluminium mullions";

/**
 * OSM way 24314976, projected to the committed EPSG:25833 viewer origin.
 * The closing OSM vertex is omitted. The shipped numeric prism with the same
 * id is only a 12 m context shell; this module supplies the documented upper
 * envelope, stage tower and public Friedrichstrasse facade without changing
 * the shared prism-suppression table.
 */
export const FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD = [
  [1133.545, -560.389],
  [1152.209, -562.175],
  [1151.621, -568.375],
  [1233.239, -574.198],
  [1236.941, -531.73],
  [1242.173, -532.014],
  [1245.097, -495.417],
  [1187.054, -490.358],
  [1186.71, -496.542],
  [1156.48, -494.457],
  [1155.626, -504.569],
  [1155.005, -511.983],
  [1137.258, -510.854],
  [1135.462, -532.26],
  [1133.608, -533.102],
  [1133.409, -535.165],
  [1133.202, -537.418],
  [1134.921, -539.037],
] as const;

export const TEAR_PALACE_FOOTPRINT_WORLD = [
  [1048.21, -183.39],
  [1050.44, -187.52],
  [1049.32, -188.34],
  [1063.04, -213.1],
  [1072.14, -210.04],
  [1073.54, -212.54],
  [1079.71, -208.2],
  [1077.7, -206.02],
  [1083.41, -198.58],
  [1064.82, -177.35],
  [1063.82, -178.14],
  [1060.67, -174.51],
] as const;

/** These three source prisms remain suppressed by IsometricCityWorld. */
export const TEAR_PALACE_PRISM_IDS = [
  "U4ubriIq",
  "3z4aOJds",
  "92ZtVVpI",
] as const;

const FRIEDRICHSTADT_BASE_Y = 5.2;
const FRIEDRICHSTADT_FRONT_CENTRE = [1134.72, -535.72] as const;
// Surveyed western edge of OSM way 24314976, northward along the facade.
const FRIEDRICHSTADT_FRONT_AXIS = [-0.068, -0.9977] as const;
const FRIEDRICHSTADT_INWARD_AXIS = [0.9977, -0.068] as const;
const FRIEDRICHSTADT_FRONT_ROTATION_Y = Math.atan2(
  -FRIEDRICHSTADT_FRONT_AXIS[1],
  FRIEDRICHSTADT_FRONT_AXIS[0],
);

/**
 * Primary-source hierarchy for the current Friedrichstadt-Palast.
 *
 * The LDA explanatory sheet controls the 110 x 80 x 20 m envelope, the
 * 32 m-high and 23 m-wide stage tower, six-metre structural grid, projecting
 * foyer, two-storey arched concrete-glass bays and stone-like exposed-concrete
 * panel language. OSM fixes the plan location. The theatre's own history page
 * supplies the published 22,500 glass-block count. Repeated blocks are shown
 * as an aggregated procedural grid, not as 22,500 WebGL objects.
 */
export const FRIEDRICHSTADT_PALAST_PROFILE = Object.freeze({
  baseY: FRIEDRICHSTADT_BASE_Y,
  facade: Object.freeze({
    fieldCounts: Object.freeze({ full: 9, mobile: 5 }),
    form:
      "projecting foyer risalit with two-storey arched coloured concrete-glass fields, pilaster rhythm, framed base and attic",
    officialGlassBlockCount: 22_500,
    structuralGridM: 6,
  }),
  footprintWorld: FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD,
  geometryStatus:
    "Exact projected OSM footprint; official LDA overall and stage-tower dimensions; facade bay subdivision, entry-door spacing, relief marks and roof fixtures are bounded procedural recognition geometry",
  name: "Friedrichstadt-Palast",
  officialEnvelopeM: Object.freeze({
    height: 20,
    length: 110,
    stageTowerHeight: 32,
    stageTowerWidth: 23,
    width: 80,
  }),
  osmWayId: "24314976",
  runtimeAssets: [] as const,
  shippedContextPrismId: "24314976",
  sourceUrls: [
    "https://www.openstreetmap.org/way/24314976",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065000",
    "https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2020/friedrichstadt-palast-steht-unter-denkmalschutz-983077.php",
    "https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/efriedrichstrasse-107.pdf",
    "https://www.palast.berlin/news/der-neue-palast-feiert-40-jahre/",
  ] as const,
  texturePolicy:
    "No canvas, photograph, portrait, plan or runtime texture; concrete-glass fields and full facade lettering are procedural/instanced geometry",
});

/**
 * HdG and LDA identify the Tränenpalast as a small, flat-roofed, transparent
 * steel-and-glass pavilion at Bahnhof Friedrichstrasse's northern entrance,
 * historically joined to the station by a connecting passage.
 * The plan remains the already committed OSM way 43173495 and the station's
 * separate footprint filter remains untouched. The 7.35 m presentation
 * envelope is retained from the previous authored layer because neither
 * official text publishes a facade height; it remains visibly subordinate to
 * the station rather than silently claiming a surveyed dimension.
 */
export const TEAR_PALACE_PROFILE = Object.freeze({
  baseY: 2.85,
  envelopeHeightM: 7.35,
  footprintWorld: TEAR_PALACE_FOOTPRINT_WORLD,
  geometryStatus:
    "Exact projected OSM outline and existing authored low envelope; official steel-glass, aluminium-profile and flat-roof character; pane and mullion subdivision is procedural and non-surveyed",
  name: "Tränenpalast",
  osmWayId: "43173495",
  prismIds: TEAR_PALACE_PRISM_IDS,
  runtimeAssets: [] as const,
  sourceUrls: [
    "https://www.openstreetmap.org/way/43173495",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065041",
    "https://www.hdg.de/traenenpalast/organisation",
    "https://www.hdg.de/traenenpalast/ausstellung/",
  ] as const,
  texturePolicy:
    "No canvas, photograph, plan or runtime texture; panes and aluminium members are transparent procedural/instanced geometry",
});

export const PALACE_DETAIL_RENDER_BUDGETS = Object.freeze({
  full: Object.freeze({
    maxInstances: 440,
    maxRenderables: 8,
    maxRenderedVertices: 17_000,
    maxStoredVertices: 5_400,
  }),
  mobile: Object.freeze({
    maxInstances: 400,
    maxRenderables: 8,
    maxRenderedVertices: 14_000,
    maxStoredVertices: 3_600,
  }),
});

const TRAVERTINE = 0xcdbb98;
const TRAVERTINE_LIGHT = 0xe1d3b6;
const TRAVERTINE_DARK = 0x9d8563;
const CHARCOAL = 0x303536;
const FOYER_GLASS_COLORS = [
  0x79afbd, 0xd99ca0, 0xd6b169, 0x76a59e, 0xb28bb1,
] as const;
const TEAR_GLASS = 0x9fcbd1;
const ALUMINIUM = 0x8d9a9c;
const CERAMIC = 0xd8d7cf;
const Y_AXIS = new Vector3(0, 1, 0);

function addGeometry(
  builder: Builder,
  color: number,
  geometry: BufferGeometry,
  inked = true,
): void {
  geometry.deleteAttribute("uv");
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addExtrudedFootprint(
  builder: Builder,
  color: number,
  ring: readonly Point2[],
  y0: number,
  height: number,
  inked = true,
): void {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  const raw = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: height,
  });
  raw.rotateX(-Math.PI / 2);
  raw.translate(0, y0, 0);
  raw.deleteAttribute("uv");
  const geometry = mergeVertices(raw);
  raw.dispose();
  addGeometry(builder, color, geometry, inked);
}

function scaledRing(ring: readonly Point2[], scale: number): Point2[] {
  const centre = ring.reduce(
    (sum, [x, z]) => [sum[0] + x / ring.length, sum[1] + z / ring.length],
    [0, 0],
  );
  return ring.map(([x, z]) => [
    centre[0] + (x - centre[0]) * scale,
    centre[1] + (z - centre[1]) * scale,
  ]);
}

function friedrichstadtWorldAt(
  alongFacade: number,
  inward: number,
): Point2 {
  return [
    FRIEDRICHSTADT_FRONT_CENTRE[0] +
      FRIEDRICHSTADT_FRONT_AXIS[0] * alongFacade +
      FRIEDRICHSTADT_INWARD_AXIS[0] * inward,
    FRIEDRICHSTADT_FRONT_CENTRE[1] +
      FRIEDRICHSTADT_FRONT_AXIS[1] * alongFacade +
      FRIEDRICHSTADT_INWARD_AXIS[1] * inward,
  ];
}

function addFriedrichstadtBox(
  builder: Builder,
  color: number,
  alongFacade: number,
  y: number,
  inward: number,
  width: number,
  height: number,
  depth: number,
  inked = true,
): void {
  const [x, z] = friedrichstadtWorldAt(alongFacade, inward);
  addBox(
    builder,
    color,
    x,
    y,
    z,
    width,
    height,
    depth,
    FRIEDRICHSTADT_FRONT_ROTATION_Y,
    inked,
  );
}

type BoxInstance = Readonly<{
  color?: number;
  position: Point3;
  rotationY?: number;
  scale: Point3;
}>;

function createInstancedBoxes(
  instances: readonly BoxInstance[],
  name: string,
  color: number,
  options: Readonly<{
    emissive?: number;
    metalness?: number;
    opacity?: number;
    roughness?: number;
  }> = {},
): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const transparent = (options.opacity ?? 1) < 1;
  const transparencyOptions = transparent
    ? { depthWrite: false, side: DoubleSide, transparent: true }
    : {};
  const dayMaterial = new MeshBasicMaterial({
    color,
    opacity: options.opacity ?? 1,
    ...transparencyOptions,
  });
  const nightMaterial = new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0,
    opacity: options.opacity ?? 1,
    roughness: options.roughness ?? 0.72,
    ...transparencyOptions,
  });
  if (options.emissive !== undefined) {
    nightMaterial.userData.nightEmissive = options.emissive;
    nightMaterial.userData.nightEmissiveIntensity = 0.92;
  }
  const mesh = new InstancedMesh(geometry, dayMaterial, instances.length);
  mesh.name = name;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.userData.textureFree = true;
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const matrix = new Matrix4();
  const shade = new Color();
  let hasInstanceColor = false;
  instances.forEach((instance, index) => {
    position.set(...instance.position);
    rotation.setFromAxisAngle(Y_AXIS, instance.rotationY ?? 0);
    scale.set(...instance.scale);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    if (instance.color !== undefined) {
      shade.setHex(instance.color);
      mesh.setColorAt(index, shade);
      hasInstanceColor = true;
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (hasInstanceColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function createArchGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-0.5, -0.575);
  shape.lineTo(0.5, -0.575);
  shape.lineTo(0.5, 0.075);
  shape.absarc(0, 0.075, 0.5, 0, Math.PI, false);
  shape.lineTo(-0.5, -0.575);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: 0.16,
  });
  geometry.translate(0, 0, -0.08);
  geometry.deleteAttribute("uv");
  const merged = mergeVertices(geometry);
  geometry.dispose();
  return merged;
}

function createFriedrichstadtGlassFields(
  detailProfile: PalaceDetailProfile,
): InstancedMesh {
  const fieldIndices =
    detailProfile === "full" ? [-4, -3, -2, -1, 0, 1, 2, 3, 4] : [-4, -2, 0, 2, 4];
  const geometry = createArchGeometry();
  const dayMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.78,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0,
    opacity: 0.82,
    roughness: 0.32,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  nightMaterial.userData.nightEmissive = 0xffb585;
  nightMaterial.userData.nightEmissiveIntensity = 0.78;
  const fields = new InstancedMesh(geometry, dayMaterial, fieldIndices.length);
  fields.name = FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME;
  fields.userData.dayMaterial = dayMaterial;
  fields.userData.nightMaterial = nightMaterial;
  fields.userData.officialGlassBlockCount =
    FRIEDRICHSTADT_PALAST_PROFILE.facade.officialGlassBlockCount;
  fields.userData.proceduralAggregate = true;
  fields.userData.textureFree = true;
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion().setFromAxisAngle(
    Y_AXIS,
    FRIEDRICHSTADT_FRONT_ROTATION_Y,
  );
  const scale = new Vector3(4.55, 9.35 / 1.15, 1);
  const shade = new Color();
  fieldIndices.forEach((fieldIndex, instanceIndex) => {
    const [x, z] = friedrichstadtWorldAt(fieldIndex * 6, -0.34);
    position.set(x, FRIEDRICHSTADT_BASE_Y + 10.45, z);
    matrix.compose(position, rotation, scale);
    fields.setMatrixAt(instanceIndex, matrix);
    fields.setColorAt(
      instanceIndex,
      shade.setHex(
        FOYER_GLASS_COLORS[
          (fieldIndex + 20) % FOYER_GLASS_COLORS.length
        ],
      ),
    );
  });
  fields.instanceMatrix.needsUpdate = true;
  if (fields.instanceColor) fields.instanceColor.needsUpdate = true;
  return fields;
}

const PIXEL_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};

function createFriedrichstadtLettering(): InstancedMesh {
  const text = "FRIEDRICHSTADT-PALAST";
  const pixelM = 0.39;
  const totalColumns = text.length * 6 - 1;
  const instances: BoxInstance[] = [];
  for (let glyphIndex = 0; glyphIndex < text.length; glyphIndex += 1) {
    const glyph = PIXEL_GLYPHS[text[glyphIndex]];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        const along =
          (glyphIndex * 6 + column - (totalColumns - 1) / 2) * pixelM;
        const [x, z] = friedrichstadtWorldAt(along, -0.63);
        instances.push({
          position: [x, FRIEDRICHSTADT_BASE_Y + 18.36 + (6 - row) * pixelM, z],
          rotationY: FRIEDRICHSTADT_FRONT_ROTATION_Y,
          scale: [pixelM * 0.78, pixelM * 0.78, 0.16],
        });
      }
    }
  }
  const sign = createInstancedBoxes(
    instances,
    FRIEDRICHSTADT_PALAST_SIGN_LAYER_NAME,
    0xf4eee5,
    { emissive: 0xffc1d0, roughness: 0.55 },
  );
  sign.userData.text = text;
  sign.userData.proceduralGlyphGrid = [5, 7];
  return sign;
}

function addFriedrichstadtFacade(
  builder: Builder,
  detailProfile: PalaceDetailProfile,
): void {
  const fieldIndices =
    detailProfile === "full" ? [-4, -3, -2, -1, 0, 1, 2, 3, 4] : [-4, -2, 0, 2, 4];

  // The generic 12 m context prism remains below. This exact footprint cap
  // brings the principal mass to the official 20 m height without z-fighting
  // against the lower source shell.
  addExtrudedFootprint(
    builder,
    TRAVERTINE,
    FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD,
    FRIEDRICHSTADT_BASE_Y + 11.95,
    8.05,
  );
  addExtrudedFootprint(
    builder,
    TRAVERTINE_LIGHT,
    FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD,
    FRIEDRICHSTADT_BASE_Y + 19.92,
    0.28,
  );

  // A visible separation of the classical theatre functions: projecting
  // public foyer at the street, auditorium behind it and the published
  // 32 m / 23 m stage tower over the rear working tract.
  addFriedrichstadtBox(
    builder,
    TRAVERTINE,
    0,
    FRIEDRICHSTADT_BASE_Y + 10.1,
    2.15,
    57.5,
    19.8,
    4.7,
  );
  addFriedrichstadtBox(
    builder,
    TRAVERTINE_DARK,
    1.5,
    FRIEDRICHSTADT_BASE_Y + 22,
    62,
    23,
    20,
    31,
  );
  addFriedrichstadtBox(
    builder,
    TRAVERTINE_LIGHT,
    1.5,
    FRIEDRICHSTADT_BASE_Y + 32.12,
    62,
    23.7,
    0.24,
    31.7,
  );

  addFriedrichstadtBox(
    builder,
    TRAVERTINE_DARK,
    0,
    FRIEDRICHSTADT_BASE_Y + 0.45,
    -0.18,
    58.4,
    0.9,
    0.42,
  );
  addFriedrichstadtBox(
    builder,
    TRAVERTINE_DARK,
    0,
    FRIEDRICHSTADT_BASE_Y + 19.24,
    -0.18,
    58.4,
    1.1,
    0.42,
  );

  // Six-metre pilaster rhythm and upper bows. Mobile retains every other
  // field, preserving the gross rhythm with substantially fewer vertices.
  for (const fieldIndex of fieldIndices) {
    const along = fieldIndex * 6;
    for (const side of [-1, 1]) {
      addFriedrichstadtBox(
        builder,
        TRAVERTINE_LIGHT,
        along + side * 2.48,
        FRIEDRICHSTADT_BASE_Y + 10.1,
        -0.48,
        0.42,
        18.2,
        0.44,
        false,
      );
    }
    const [archX, archZ] = friedrichstadtWorldAt(along, -0.5);
    const arch = new TorusGeometry(2.48, 0.23, 4, 10, Math.PI);
    arch.rotateY(FRIEDRICHSTADT_FRONT_ROTATION_Y);
    arch.translate(archX, FRIEDRICHSTADT_BASE_Y + 14.84, archZ);
    addGeometry(builder, TRAVERTINE_LIGHT, arch, false);

    const verticalGridCount = detailProfile === "full" ? 3 : 1;
    const horizontalGridCount = detailProfile === "full" ? 4 : 2;
    for (let line = 1; line <= verticalGridCount; line += 1) {
      addFriedrichstadtBox(
        builder,
        TRAVERTINE_LIGHT,
        along - 2.12 + (4.24 * line) / (verticalGridCount + 1),
        FRIEDRICHSTADT_BASE_Y + 9.8,
        -0.57,
        0.1,
        8.7,
        0.12,
        false,
      );
    }
    for (let line = 1; line <= horizontalGridCount; line += 1) {
      addFriedrichstadtBox(
        builder,
        TRAVERTINE_LIGHT,
        along,
        FRIEDRICHSTADT_BASE_Y +
          5.45 +
          (8.5 * line) / (horizontalGridCount + 1),
        -0.58,
        4.32,
        0.1,
        0.12,
        false,
      );
    }
  }

  // Five-door vestibule, projecting portal and ceremonial stair. These are
  // recognition cues rather than an opening survey.
  addFriedrichstadtBox(
    builder,
    CHARCOAL,
    0,
    FRIEDRICHSTADT_BASE_Y + 2.55,
    -0.72,
    17.7,
    4.9,
    0.24,
  );
  for (let door = -2; door <= 2; door += 1) {
    addFriedrichstadtBox(
      builder,
      0x46626a,
      door * 3.15,
      FRIEDRICHSTADT_BASE_Y + 2.55,
      -0.88,
      2.55,
      4.25,
      0.16,
      false,
    );
  }
  for (let step = 0; step < 4; step += 1) {
    addFriedrichstadtBox(
      builder,
      TRAVERTINE_LIGHT,
      0,
      FRIEDRICHSTADT_BASE_Y + 0.08 + step * 0.11,
      -1.6 - step * 0.62,
      23.5 - step * 1.1,
      0.16 + step * 0.06,
      1.15,
    );
  }

  // Side foyer relief fields and a restrained roof service rhythm make the
  // long mass read as the Palast without tracing any photograph.
  for (const side of [-1, 1]) {
    addFriedrichstadtBox(
      builder,
      0xa99069,
      side * 24.8,
      FRIEDRICHSTADT_BASE_Y + 7.2,
      -0.65,
      3.7,
      5.4,
      0.18,
    );
    for (let slash = -1; slash <= 1; slash += 1) {
      addFriedrichstadtBox(
        builder,
        TRAVERTINE_LIGHT,
        side * 24.8 + slash * 0.85,
        FRIEDRICHSTADT_BASE_Y + 7.2 + slash * 0.65,
        -0.77,
        0.22,
        4.1,
        0.14,
        false,
      );
    }
  }
  for (const along of [-19, -7, 7, 19]) {
    addFriedrichstadtBox(
      builder,
      TRAVERTINE_DARK,
      along,
      FRIEDRICHSTADT_BASE_Y + 20.65,
      32,
      4.6,
      1.1,
      3.1,
    );
  }
}

export function createFriedrichstadtPalast(
  detailProfile: PalaceDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = FRIEDRICHSTADT_PALAST_ROOT_NAME;
  root.userData = {
    detailProfile,
    geometryStatus: FRIEDRICHSTADT_PALAST_PROFILE.geometryStatus,
    keepInMinecraft: true,
    objectProfile: FRIEDRICHSTADT_PALAST_PROFILE,
    osmWayId: FRIEDRICHSTADT_PALAST_PROFILE.osmWayId,
    runtimeAssets: FRIEDRICHSTADT_PALAST_PROFILE.runtimeAssets,
    sourceUrls: FRIEDRICHSTADT_PALAST_PROFILE.sourceUrls,
    sourceBound: true,
    textureFree: true,
  };
  const builder = createBuilder();
  addFriedrichstadtFacade(builder, detailProfile);
  const structure = finishDrawnGroup(builder, {
    name: "Friedrichstadt-Palast structure and facade frames",
  });
  if (structure) root.add(structure);
  root.add(createFriedrichstadtGlassFields(detailProfile));
  root.add(createFriedrichstadtLettering());
  return root;
}

function tearEdgeBoxes(
  ring: readonly Point2[],
  spacing: number,
  glassCentreY: number,
  glassHeight: number,
): { mullions: BoxInstance[]; panes: BoxInstance[] } {
  const mullions: BoxInstance[] = [];
  const panes: BoxInstance[] = [];
  const seenPosts = new Set<string>();
  ring.forEach(([x0, z0], edgeIndex) => {
    const [x1, z1] = ring[(edgeIndex + 1) % ring.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const segments = Math.max(1, Math.ceil(length / spacing));
    const rotationY = -Math.atan2(dz, dx);
    for (let segment = 0; segment < segments; segment += 1) {
      const t = (segment + 0.5) / segments;
      panes.push({
        position: [x0 + dx * t, glassCentreY, z0 + dz * t],
        rotationY,
        scale: [Math.max(0.42, length / segments - 0.16), glassHeight, 0.075],
      });
    }
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const x = x0 + dx * t;
      const z = z0 + dz * t;
      const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
      if (seenPosts.has(key)) continue;
      seenPosts.add(key);
      mullions.push({
        position: [x, glassCentreY, z],
        scale: [0.13, glassHeight + 0.12, 0.13],
      });
    }
  });
  return { mullions, panes };
}

function addTearPalaceStructure(
  builder: Builder,
  detailProfile: PalaceDetailProfile,
): void {
  const baseY = TEAR_PALACE_PROFILE.baseY;
  const roofY = baseY + TEAR_PALACE_PROFILE.envelopeHeightM;
  addExtrudedFootprint(
    builder,
    CERAMIC,
    TEAR_PALACE_FOOTPRINT_WORLD,
    baseY,
    0.34,
  );
  addExtrudedFootprint(
    builder,
    CERAMIC,
    scaledRing(TEAR_PALACE_FOOTPRINT_WORLD, 1.025),
    roofY - 0.24,
    0.32,
  );
  const transomFractions = detailProfile === "full" ? [0.34, 0.68] : [0.5];
  TEAR_PALACE_FOOTPRINT_WORLD.forEach(([x0, z0], edgeIndex) => {
    const [x1, z1] =
      TEAR_PALACE_FOOTPRINT_WORLD[
        (edgeIndex + 1) % TEAR_PALACE_FOOTPRINT_WORLD.length
      ];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const rotationY = -Math.atan2(dz, dx);
    for (const fraction of transomFractions) {
      addBox(
        builder,
        ALUMINIUM,
        (x0 + x1) / 2,
        baseY + 0.36 + (TEAR_PALACE_PROFILE.envelopeHeightM - 0.74) * fraction,
        (z0 + z1) / 2,
        length,
        0.11,
        0.13,
        rotationY,
        false,
      );
    }
    addBox(
      builder,
      ALUMINIUM,
      (x0 + x1) / 2,
      roofY - 0.35,
      (z0 + z1) / 2,
      length,
      0.42,
      0.16,
      rotationY,
      false,
    );
  });

  // The short solid strip marks the historically documented connection side
  // toward the station while leaving the hall itself transparently legible.
  const [connectorX, connectorZ] = [1054.8, -180.9];
  addBox(
    builder,
    CERAMIC,
    connectorX,
    baseY + 2.1,
    connectorZ,
    7.4,
    3.9,
    0.28,
    -0.62,
  );
}

export function createTearPalace(
  detailProfile: PalaceDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = TEAR_PALACE_ROOT_NAME;
  root.userData = {
    detailProfile,
    geometryStatus: TEAR_PALACE_PROFILE.geometryStatus,
    keepInMinecraft: true,
    objectProfile: TEAR_PALACE_PROFILE,
    osmWayId: TEAR_PALACE_PROFILE.osmWayId,
    prismIds: TEAR_PALACE_PROFILE.prismIds,
    runtimeAssets: TEAR_PALACE_PROFILE.runtimeAssets,
    sourceUrls: TEAR_PALACE_PROFILE.sourceUrls,
    sourceBound: true,
    textureFree: true,
  };
  const builder = createBuilder();
  addTearPalaceStructure(builder, detailProfile);
  const structure = finishDrawnGroup(builder, {
    name: "Tränenpalast flat roof and steel frame",
  });
  if (structure) root.add(structure);

  const baseY = TEAR_PALACE_PROFILE.baseY;
  const glassHeight = TEAR_PALACE_PROFILE.envelopeHeightM - 0.8;
  const glassCentreY = baseY + 0.38 + glassHeight / 2;
  const { mullions, panes } = tearEdgeBoxes(
    TEAR_PALACE_FOOTPRINT_WORLD,
    detailProfile === "full" ? 2.25 : 3.65,
    glassCentreY,
    glassHeight,
  );
  root.add(
    createInstancedBoxes(
      panes,
      TEAR_PALACE_GLASS_LAYER_NAME,
      TEAR_GLASS,
      { emissive: 0xaedee0, opacity: 0.36, roughness: 0.2 },
    ),
  );
  root.add(
    createInstancedBoxes(
      mullions,
      TEAR_PALACE_MULLION_LAYER_NAME,
      ALUMINIUM,
      { metalness: 0.68, roughness: 0.3 },
    ),
  );
  root.userData.paneCount = panes.length;
  root.userData.mullionCount = mullions.length;
  return root;
}

export function createFriedrichstadtAndTearPalaces(
  detailProfile: PalaceDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = "Friedrichstadt-Palast and Tränenpalast recognition details";
  root.userData = {
    detailProfile,
    keepInMinecraft: true,
    performanceBudget: PALACE_DETAIL_RENDER_BUDGETS[detailProfile],
    runtimeAssets: [] as const,
    textureFree: true,
  };
  root.add(
    createFriedrichstadtPalast(detailProfile),
    createTearPalace(detailProfile),
  );
  return root;
}

export type PalaceRenderStats = {
  instanceCount: number;
  renderedVertices: number;
  renderables: number;
  storedVertices: number;
};

export function palaceRenderStats(
  root: Object3D<Object3DEventMap>,
): PalaceRenderStats {
  let instanceCount = 0;
  let renderedVertices = 0;
  let renderables = 0;
  let storedVertices = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    const geometry = object.geometry as BufferGeometry;
    const vertices = geometry.getAttribute("position")?.count ?? 0;
    const instances = object instanceof InstancedMesh ? object.count : 1;
    renderables += 1;
    storedVertices += vertices;
    renderedVertices += vertices * instances;
    if (object instanceof InstancedMesh) instanceCount += object.count;
  });
  return { instanceCount, renderedVertices, renderables, storedVertices };
}
