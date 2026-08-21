import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
  type Material,
  type Object3DEventMap,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type WeidendammerBridgeDetailProfile = "full" | "mobile";
export type WeidendammerBridgeMode =
  "day" | "minecraft" | "night" | "schwellenraum" | "snowstorm";

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

const SOURCE_AXIS_EPSG_25833 = [
  [390625.110604, 5820369.948078],
  [390631.125449, 5820299.486791],
] as const;
const SOURCE_DELTA_X =
  SOURCE_AXIS_EPSG_25833[1][0] - SOURCE_AXIS_EPSG_25833[0][0];
// World z grows southward, so the EPSG northing delta is inverted.
const SOURCE_DELTA_Z =
  SOURCE_AXIS_EPSG_25833[0][1] - SOURCE_AXIS_EPSG_25833[1][1];
const SOURCE_AXIS_LENGTH = Math.hypot(SOURCE_DELTA_X, SOURCE_DELTA_Z);
const AXIS = [
  SOURCE_DELTA_X / SOURCE_AXIS_LENGTH,
  SOURCE_DELTA_Z / SOURCE_AXIS_LENGTH,
] as const;
const NORMAL = [-AXIS[1], AXIS[0]] as const;

/**
 * Weidendammer Bruecke source hierarchy.
 *
 * Berlin's Masterplan Bruecken Appendix 1 (data status 06/2025) controls the
 * current 69.48 x 25.17 m envelope, construction class and bridge identity.
 * OSM way 6228081 controls the plan centre and bearing. Landesdenkmalamt
 * object 09030074 controls the three-opening system, two granite-clad river
 * piers, ten three-part arch girders and the forged neo-Baroque railing,
 * lamps and paired eagle reliefs. Its cited 22.4 m historic width is retained
 * as a conflict rather than silently replacing the current inventory width.
 *
 * The detailed relief anatomy, rail-field rhythm and current love-lock
 * distribution are procedural recognition geometry, not a fixture survey.
 * No photograph, plan, lyric, portrait, texture or canvas asset is bundled.
 */
export const WEIDENDAMMER_BRIDGE_PROFILE = Object.freeze({
  axis: AXIS,
  biermannReference: Object.freeze({
    relation:
      "Wolf Biermann's 1976 Ballade vom preußischen Ikarus is culturally associated with the bridge eagle; no lyric text or portrait asset is copied",
    title: "Ballade vom preußischen Ikarus",
    year: 1976,
  }),
  centreWorldM: [1128.1180265166913, -334.7174344994128] as const,
  geometryStatus:
    "Current official inventory envelope on the exact OSM centreline; monument-register bridge system and ornament inventory; local relief, rail-field and love-lock placement is procedural, texture-free and non-surveyed",
  historicDimensionConflict:
    "Landesdenkmalamt describes the historic 22.4 m-wide structure and 16.3 / 38.5 / 15.5 m support spans; Berlin's 06/2025 inventory records the current overall envelope as 69.48 x 25.17 m and controls the rendered deck",
  historicSupportSpansM: [16.3, 38.5, 15.5] as const,
  inventory: Object.freeze({
    areaM2: 1749,
    bridgeNumber: "3446013",
    built: 1896,
    conditionGrade: 3,
    construction: "Bogenbruecke mit aufgestaenderter Fahrbahn",
    dataStatus: "06/2025",
    lengthM: 69.48,
    material: "Stahl/Leichtmetall",
    widthM: 25.17,
  }),
  monumentObjectId: "09030074",
  name: "Weidendammer Brücke",
  ornamentArtisans: ["M. Fabian", "Eduard Puls"] as const,
  osmWayId: "6228081",
  runtimeAssets: [] as const,
  sourceEpsg25833Axis: SOURCE_AXIS_EPSG_25833,
  sourceUrls: [
    "https://www.openstreetmap.org/way/6228081",
    "https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030074",
    "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/brueckenbau/masterplan-bruecken/geplante-brueckenbaumassnahmen-nach-bezirken/",
    "https://www.dhm.de/pressemitteilung/wolf-biermann-ein-lyriker-und-liedermacher-in-deutschland/",
    "https://trolley-tourist.de/der-brauch-der-liebesschloesser/",
  ] as const,
  visualReferencePolicy:
    "Official and OSM facts plus owner-directed present-day love-lock reading; no third-party image or plan is traced, bundled or loaded",
});

export const WEIDENDAMMER_BRIDGE_EAGLE_COUNT = 2;
export const WEIDENDAMMER_BRIDGE_AUTHORED_FEATHER_CUES = Object.freeze({
  tailPerEagle: 7,
  totalPerEagle: 27,
  wingPerEagle: 20,
});
export const WEIDENDAMMER_BRIDGE_LAMP_STANDARD_COUNT = 8;
export const WEIDENDAMMER_BRIDGE_RAIL_BAY_COUNT_PER_SIDE = 28;
export const WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT = 1;
export const WEIDENDAMMER_BRIDGE_REPEATING_RAIL_FIELD_COUNT = Object.freeze({
  full: 52,
  mobile: 24,
});
export const WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT = Object.freeze({
  full: 192,
  mobile: 96,
});

export const WEIDENDAMMER_BRIDGE_STRUCTURAL_LAYER_NAME =
  "Weidendammer bridge neo-Baroque railing lamps and Prussian eagles";
export const WEIDENDAMMER_BRIDGE_INK_LAYER_NAME =
  "Weidendammer bridge eagle and railing close-detail ink";
export const WEIDENDAMMER_BRIDGE_LAMP_LAYER_NAME =
  "Weidendammer bridge eight warm neo-Baroque lamps";
export const WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME =
  "Weidendammer bridge batched love locks";
export const WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME =
  "Weidendammer bridge reversible settled snow";
export const WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME =
  "Weidendammer bridge source-bound close details";
export const WEIDENDAMMER_BRIDGE_MINECRAFT_ROOT_NAME =
  "Voxel Weidendammer bridge close details";

const LENGTH_M = WEIDENDAMMER_BRIDGE_PROFILE.inventory.lengthM;
const WIDTH_M = WEIDENDAMMER_BRIDGE_PROFILE.inventory.widthM;
const HALF_LENGTH_M = LENGTH_M / 2;
const HALF_WIDTH_M = WIDTH_M / 2;
const DEFAULT_WATER_TOP_Y_M = 1.31;
const SHIPPING_CLEARANCE_M = 5.4;
const CAMBER_M = 0.34;
const ROOT_ROTATION_Y = -Math.atan2(AXIS[1], AXIS[0]);
const HISTORIC_SUPPORT_TOTAL_M =
  WEIDENDAMMER_BRIDGE_PROFILE.historicSupportSpansM.reduce(
    (sum, span) => sum + span,
    0,
  );
const SUPPORT_SCALE = LENGTH_M / HISTORIC_SUPPORT_TOTAL_M;
const SCALED_SUPPORT_SPANS =
  WEIDENDAMMER_BRIDGE_PROFILE.historicSupportSpansM.map(
    (span) => span * SUPPORT_SCALE,
  ) as [number, number, number];
const FIRST_PIER_LOCAL_X = -HALF_LENGTH_M + SCALED_SUPPORT_SPANS[0];
const SECOND_PIER_LOCAL_X = FIRST_PIER_LOCAL_X + SCALED_SUPPORT_SPANS[1];

/**
 * Preserve the LDA's asymmetric 16.3 / 38.5 / 15.5 support rhythm while
 * scaling its historic 70.3 m total into the current 69.48 m inventory hull.
 */
export const WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT = Object.freeze({
  envelopeScale: SUPPORT_SCALE,
  pierCentresLocalM: [FIRST_PIER_LOCAL_X, SECOND_PIER_LOCAL_X] as const,
  scaledSupportSpansM: SCALED_SUPPORT_SPANS,
});

const PALETTE = Object.freeze({
  brass: 0xc59028,
  copper: 0xa85734,
  eagle: 0x32383a,
  eagleHighlight: 0x596164,
  eagleShade: 0x1f2426,
  iron: 0x343b3d,
  ironHighlight: 0x596164,
  lockBlue: 0x406d9a,
  lockBrass: 0xd2a63a,
  lockCopper: 0xb86442,
  lockGreen: 0x4f846b,
  lockRed: 0xb33e3e,
  lockSilver: 0xaeb8b7,
  lampGlass: 0xf2c968,
  snow: 0xf1f5f4,
});

const LOCK_COLOURS = [
  PALETTE.lockBrass,
  PALETTE.lockRed,
  PALETTE.lockSilver,
  PALETTE.lockBlue,
  PALETTE.lockCopper,
  PALETTE.lockGreen,
] as const;

export const WEIDENDAMMER_BRIDGE_FOCUS_CAMERA = Object.freeze({
  azimuth_degrees: -116,
  distance_m: 82,
  polar_degrees: 66,
  target_height_m: 0,
  target_world: [1128.1180265166913, 8.15, -334.7174344994128] as const,
});

/** Above the 11.03 m lamp/finial crown, with room for the selection halo. */
export const WEIDENDAMMER_BRIDGE_MARKER_Y = 12.4;

/** Runtime marker anchor for the owner-added catalogue entry wired by root. */
export const WEIDENDAMMER_BRIDGE_MARKER_WORLD = Object.freeze([
  WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0],
  WEIDENDAMMER_BRIDGE_MARKER_Y,
  WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1],
] as const);

function camberAt(localX: number): number {
  return CAMBER_M * Math.cos((localX / HALF_LENGTH_M) * (Math.PI / 2)) ** 2;
}

function deckBaseY(waterTopY: number): number {
  return waterTopY + SHIPPING_CLEARANCE_M;
}

function preparePaintedGeometry(
  source: BufferGeometry,
  colour: number,
): BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  geometry.deleteAttribute("uv");
  geometry.computeVertexNormals();
  const vertexCount = geometry.getAttribute("position").count;
  const tone = new Color(colour);
  const colours = new Float32Array(vertexCount * 3);
  for (let index = 0; index < vertexCount; index += 1) {
    colours[index * 3] = tone.r;
    colours[index * 3 + 1] = tone.g;
    colours[index * 3 + 2] = tone.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return geometry;
}

function triangularPrismGeometry(
  a: Point2,
  b: Point2,
  c: Point2,
  centreZ: number,
  depth: number,
): BufferGeometry {
  const front = centreZ + depth / 2;
  const back = centreZ - depth / 2;
  const vertices: Point3[] = [
    [a[0], a[1], front],
    [b[0], b[1], front],
    [c[0], c[1], front],
    [a[0], a[1], back],
    [b[0], b[1], back],
    [c[0], c[1], back],
  ];
  const indices = [
    0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0,
  ];
  const positions = new Float32Array(indices.length * 3);
  indices.forEach((vertexIndex, index) => {
    const point = vertices[vertexIndex];
    positions[index * 3] = point[0];
    positions[index * 3 + 1] = point[1];
    positions[index * 3 + 2] = point[2];
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

type GeometryBuckets = {
  ink: BufferGeometry[];
  lamps: BufferGeometry[];
  painted: BufferGeometry[];
};

function addGeometry(
  buckets: GeometryBuckets,
  source: BufferGeometry,
  colour: number,
  inked = false,
): void {
  const geometry = preparePaintedGeometry(source, colour);
  buckets.painted.push(geometry);
  if (inked) {
    buckets.ink.push(new EdgesGeometry(geometry, 28));
  }
}

function addLampGeometry(
  buckets: GeometryBuckets,
  source: BufferGeometry,
  colour: number,
  inked = false,
): void {
  const geometry = preparePaintedGeometry(source, colour);
  buckets.lamps.push(geometry);
  if (inked) buckets.ink.push(new EdgesGeometry(geometry, 28));
}

function addBox(
  buckets: GeometryBuckets,
  colour: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotationZ = 0,
  inked = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  if (rotationZ !== 0) geometry.rotateZ(rotationZ);
  geometry.translate(x, y, z);
  addGeometry(buckets, geometry, colour, inked);
}

function addBeamXY(
  buckets: GeometryBuckets,
  colour: number,
  start: Point2,
  end: Point2,
  z: number,
  thickness: number,
  depth: number,
  inked = false,
): void {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  addBox(
    buckets,
    colour,
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    z,
    length,
    thickness,
    depth,
    Math.atan2(dy, dx),
    inked,
  );
}

function addEagle(buckets: GeometryBuckets, side: -1 | 1): void {
  const z = side * (HALF_WIDTH_M + 0.09);
  const baseY = CAMBER_M + 0.24;
  const depth = 0.2;

  // Large forged wing plates carry the silhouette even on a phone. Their
  // layered bars below remain visibly individual feather cues up close. The
  // count is an authored legibility choice, never presented as a survey.
  addGeometry(
    buckets,
    triangularPrismGeometry(
      [-0.2, baseY + 1.45],
      [-2.02, baseY + 2.43],
      [-1.14, baseY + 1.04],
      z,
      depth,
    ),
    PALETTE.eagle,
    true,
  );
  addGeometry(
    buckets,
    triangularPrismGeometry(
      [0.2, baseY + 1.45],
      [2.02, baseY + 2.43],
      [1.14, baseY + 1.04],
      z,
      depth,
    ),
    PALETTE.eagle,
    true,
  );
  for (const wingSide of [-1, 1] as const) {
    for (let feather = 0; feather < 10; feather += 1) {
      const spread = (feather + 1) / 10;
      const root: Point2 = [wingSide * (0.17 + spread * 0.22), baseY + 1.5];
      const tip: Point2 = [
        wingSide * (0.62 + spread * 1.44),
        baseY + 2.48 - spread * 1.23,
      ];
      addBeamXY(
        buckets,
        feather % 2 === 0 ? PALETTE.eagleHighlight : PALETTE.eagleShade,
        root,
        tip,
        z + side * 0.075,
        Math.max(0.055, 0.105 - feather * 0.004),
        0.07,
      );
    }
  }

  const body = new IcosahedronGeometry(1, 1);
  body.scale(0.48, 0.74, 0.17);
  body.translate(0, baseY + 1.34, z);
  addGeometry(buckets, body, PALETTE.eagle, true);

  // Seven separate tail feathers complete the documented forged plumage.
  for (let feather = -3; feather <= 3; feather += 1) {
    addBeamXY(
      buckets,
      feather % 2 === 0 ? PALETTE.eagleShade : PALETTE.eagleHighlight,
      [feather * 0.065, baseY + 0.84],
      [feather * 0.17, baseY + 0.12 + Math.abs(feather) * 0.035],
      z,
      0.11,
      0.12,
    );
  }

  addBeamXY(
    buckets,
    PALETTE.eagle,
    [0.04, baseY + 1.82],
    [0.18, baseY + 2.2],
    z,
    0.24,
    0.18,
  );
  const head = new IcosahedronGeometry(0.26, 1);
  head.scale(1, 0.86, 0.68);
  head.translate(0.2, baseY + 2.23, z);
  addGeometry(buckets, head, PALETTE.eagle, true);
  const beak = new ConeGeometry(0.1, 0.3, 5);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(0.44, baseY + 2.21, z);
  addGeometry(buckets, beak, PALETTE.eagleHighlight);

  // The central breast shield keeps the Prussian state-emblem reading clear
  // without copying a heraldic texture or protected artwork.
  const shield = new IcosahedronGeometry(1, 1);
  shield.scale(0.36, 0.5, 0.11);
  shield.translate(0, baseY + 1.36, z + side * 0.13);
  addGeometry(buckets, shield, PALETTE.eagleHighlight, true);
  addBox(
    buckets,
    PALETTE.eagleShade,
    0,
    baseY + 1.39,
    z + side * 0.25,
    0.08,
    0.56,
    0.04,
  );
  addBeamXY(
    buckets,
    PALETTE.eagleShade,
    [-0.22, baseY + 1.27],
    [0.22, baseY + 1.52],
    z + side * 0.25,
    0.055,
    0.04,
  );

  // Sceptre and orb are legible heraldic cues of the crowned state eagle;
  // Biermann's cultural "Prussian Icarus" association is metadata,
  // never copied lettering or lyric geometry.
  addBeamXY(
    buckets,
    PALETTE.eagleHighlight,
    [0.42, baseY + 0.92],
    [0.9, baseY + 1.72],
    z,
    0.07,
    0.1,
  );
  addBox(
    buckets,
    PALETTE.eagleHighlight,
    0.9,
    baseY + 1.76,
    z,
    0.28,
    0.06,
    0.11,
    Math.PI / 4,
  );
  const orb = new TorusGeometry(0.17, 0.045, 5, 12);
  orb.translate(-0.72, baseY + 1.08, z);
  addGeometry(buckets, orb, PALETTE.eagleHighlight, true);
  addBox(
    buckets,
    PALETTE.eagleHighlight,
    -0.72,
    baseY + 1.29,
    z,
    0.06,
    0.26,
    0.1,
  );

  const crownBand = new TorusGeometry(0.25, 0.045, 5, 14, Math.PI * 1.25);
  crownBand.rotateZ(-Math.PI * 0.13);
  crownBand.translate(0.11, baseY + 2.58, z);
  addGeometry(buckets, crownBand, PALETTE.eagleHighlight, true);
  for (let spike = -3; spike <= 3; spike += 1) {
    const crownSpike = new ConeGeometry(0.045, 0.28, 4);
    crownSpike.translate(
      0.11 + spike * 0.075,
      baseY + 2.73 - Math.abs(spike) * 0.015,
      z,
    );
    addGeometry(buckets, crownSpike, PALETTE.eagleHighlight);
  }

  for (const foot of [-1, 1]) {
    addBeamXY(
      buckets,
      PALETTE.eagleShade,
      [foot * 0.17, baseY + 0.83],
      [foot * 0.32, baseY + 0.58],
      z,
      0.075,
      0.1,
    );
    for (const talon of [-1, 0, 1]) {
      addBeamXY(
        buckets,
        PALETTE.eagleShade,
        [foot * 0.32, baseY + 0.59],
        [foot * (0.42 + talon * 0.05), baseY + 0.49 - Math.abs(talon) * 0.02],
        z,
        0.045,
        0.08,
      );
    }
  }
}

function addRailingOrnament(
  buckets: GeometryBuckets,
  detailProfile: WeidendammerBridgeDetailProfile,
): void {
  const fieldCount =
    detailProfile === "mobile"
      ? WEIDENDAMMER_BRIDGE_RAIL_BAY_COUNT_PER_SIDE / 2
      : WEIDENDAMMER_BRIDGE_RAIL_BAY_COUNT_PER_SIDE;
  const fieldLength = LENGTH_M / fieldCount;
  for (const side of [-1, 1] as const) {
    const z = side * (HALF_WIDTH_M + 0.075);
    for (let field = 0; field < fieldCount; field += 1) {
      const x = -HALF_LENGTH_M + fieldLength * (field + 0.5);
      if (Math.abs(x) < 2.55) continue;
      const y = camberAt(x);
      const rosette = new TorusGeometry(0.15, 0.032, 4, 9);
      rosette.translate(x, y + 0.72, z);
      addGeometry(
        buckets,
        rosette,
        field % 3 === 0 ? PALETTE.ironHighlight : PALETTE.iron,
        detailProfile === "full" && field % 2 === 0,
      );
      const halfField = Math.min(0.67, fieldLength * 0.34);
      addBeamXY(
        buckets,
        PALETTE.iron,
        [x - halfField, y + 0.36],
        [x - 0.18, y + 0.7],
        z,
        0.055,
        0.075,
      );
      addBeamXY(
        buckets,
        PALETTE.iron,
        [x + halfField, y + 0.36],
        [x + 0.18, y + 0.7],
        z,
        0.055,
        0.075,
      );
      addBeamXY(
        buckets,
        PALETTE.iron,
        [x - 0.18, y + 0.74],
        [x - halfField, y + 1.02],
        z,
        0.05,
        0.075,
      );
      addBeamXY(
        buckets,
        PALETTE.iron,
        [x + 0.18, y + 0.74],
        [x + halfField, y + 1.02],
        z,
        0.05,
        0.075,
      );
    }

    // A broad forged arch isolates the eagle field from the repeating rail
    // rhythm and preserves the Biermann-recognisable centre silhouette.
    const eagleFrame = new TorusGeometry(1.72, 0.075, 5, 24, Math.PI);
    eagleFrame.translate(0, CAMBER_M + 1.12, z - side * 0.025);
    addGeometry(buckets, eagleFrame, PALETTE.iron, true);

    for (const fraction of [-0.76, -0.25, 0.25, 0.76]) {
      const x = HALF_LENGTH_M * fraction;
      const y = camberAt(x);
      const standardZ = side * (HALF_WIDTH_M - 0.08);
      addBox(
        buckets,
        PALETTE.iron,
        x,
        y + 1.72,
        standardZ,
        0.13,
        2.98,
        0.13,
        0,
        true,
      );
      for (const level of [0.46, 1.25, 2.45]) {
        const collar = new TorusGeometry(
          level === 0.46 ? 0.2 : 0.17,
          0.045,
          5,
          10,
        );
        collar.rotateX(Math.PI / 2);
        collar.translate(x, y + level, standardZ);
        addGeometry(buckets, collar, PALETTE.ironHighlight);
      }
      const foot = new ConeGeometry(0.21, 0.34, 8);
      foot.translate(x, y + 0.23, standardZ);
      addGeometry(buckets, foot, PALETTE.iron, true);
      for (const armSide of [-1, 1]) {
        addBeamXY(
          buckets,
          PALETTE.ironHighlight,
          [x, y + 2.58],
          [x + armSide * 0.29, y + 2.83],
          standardZ,
          0.055,
          0.09,
        );
      }
      const lamp = new IcosahedronGeometry(0.32, 1);
      lamp.scale(0.72, 1, 0.72);
      lamp.translate(x, y + 3.28, standardZ);
      addLampGeometry(buckets, lamp, PALETTE.lampGlass, true);
      const lampCanopy = new ConeGeometry(0.31, 0.24, 8);
      lampCanopy.translate(x, y + 3.58, standardZ);
      addGeometry(buckets, lampCanopy, PALETTE.iron, true);
      const finial = new ConeGeometry(0.085, 0.34, 6);
      finial.translate(x, y + 3.86, standardZ);
      addGeometry(buckets, finial, PALETTE.ironHighlight);
    }
  }
}

function createDayNightMaterials(): {
  day: MeshBasicMaterial;
  night: MeshStandardMaterial;
} {
  const day = new MeshBasicMaterial({ side: DoubleSide, vertexColors: true });
  const night = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0.58,
    roughness: 0.52,
    side: DoubleSide,
    vertexColors: true,
  });
  night.emissive.setHex(0x101719);
  night.emissiveIntensity = 0.42;
  return { day, night };
}

function createOrnamentMesh(detailProfile: WeidendammerBridgeDetailProfile): {
  ink: LineSegments;
  lamps: Mesh;
  mesh: Mesh;
} {
  const buckets: GeometryBuckets = { ink: [], lamps: [], painted: [] };
  addRailingOrnament(buckets, detailProfile);
  for (const side of [-1, 1] as const) addEagle(buckets, side);
  const merged = mergeGeometries(buckets.painted, false);
  if (!merged) throw new Error("Weidendammer bridge ornament is empty");
  const { day, night } = createDayNightMaterials();
  const mesh = new Mesh(merged, day);
  mesh.name = WEIDENDAMMER_BRIDGE_STRUCTURAL_LAYER_NAME;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const mergedLamps = mergeGeometries(buckets.lamps, false);
  if (!mergedLamps) throw new Error("Weidendammer bridge lamps are empty");
  const lampDay = new MeshBasicMaterial({ vertexColors: true });
  const lampNight = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0.08,
    roughness: 0.3,
    vertexColors: true,
  });
  lampNight.userData.nightEmissive = 0xffc75c;
  lampNight.userData.nightEmissiveIntensity = 1.45;
  const lamps = new Mesh(mergedLamps, lampDay);
  lamps.name = WEIDENDAMMER_BRIDGE_LAMP_LAYER_NAME;
  lamps.userData.dayMaterial = lampDay;
  lamps.userData.nightMaterial = lampNight;
  lamps.castShadow = true;
  const mergedInk = mergeGeometries(buckets.ink, false);
  if (!mergedInk) throw new Error("Weidendammer bridge detail ink is empty");
  const ink = new LineSegments(
    mergedInk,
    new LineBasicMaterial({ color: 0x1f2527, transparent: true, opacity: 0.8 }),
  );
  ink.name = WEIDENDAMMER_BRIDGE_INK_LAYER_NAME;
  ink.userData.detailFadeM = [420, 560];
  ink.renderOrder = 3;
  for (const geometry of [
    ...buckets.painted,
    ...buckets.lamps,
    ...buckets.ink,
  ]) {
    geometry.dispose();
  }
  return { ink, lamps, mesh };
}

function createLoveLockGeometry(): BufferGeometry {
  const body = new BoxGeometry(0.17, 0.2, 0.075).toNonIndexed();
  body.translate(0, -0.045, 0);
  body.deleteAttribute("uv");
  const shackle = new TorusGeometry(0.06, 0.014, 4, 8, Math.PI).toNonIndexed();
  shackle.rotateZ(Math.PI);
  shackle.translate(0, 0.065, 0);
  shackle.deleteAttribute("uv");
  const geometry = mergeGeometries([body, shackle], false);
  body.dispose();
  shackle.dispose();
  if (!geometry)
    throw new Error("Weidendammer bridge love-lock geometry is empty");
  geometry.computeVertexNormals();
  return geometry;
}

function createLoveLocks(
  detailProfile: WeidendammerBridgeDetailProfile,
): InstancedMesh {
  const count = WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT[detailProfile];
  const geometry = createLoveLockGeometry();
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0.72,
    roughness: 0.4,
    vertexColors: true,
  });
  night.emissive.setHex(0x19120a);
  night.emissiveIntensity = 0.28;
  const mesh = new InstancedMesh(geometry, day, count);
  mesh.name = WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.userData.loveLockCount = count;
  mesh.userData.detailFadeM = [180, 260];
  mesh.userData.placementStatus =
    "deterministic display distribution along both present-day railings; not a lock-by-lock survey";
  const dummy = new Object3D();
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const sequence = ((index * 89 + 37) % count) / Math.max(1, count - 1);
    let x = -HALF_LENGTH_M + 1.1 + sequence * (LENGTH_M - 2.2);
    if (Math.abs(x) < 2.45) x += x < 0 ? -2.5 : 2.5;
    x = Math.max(-HALF_LENGTH_M + 0.8, Math.min(HALF_LENGTH_M - 0.8, x));
    const row = (index * 7) % 4;
    const scale = 0.82 + ((index * 13) % 9) * 0.035;
    dummy.position.set(
      x,
      camberAt(x) + 0.34 + row * 0.19,
      side * (HALF_WIDTH_M + 0.12 + (index % 3) * 0.012),
    );
    dummy.rotation.set(
      0,
      side < 0 ? Math.PI : 0,
      (((index * 17) % 9) - 4) * 0.035,
    );
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(
      index,
      new Color(LOCK_COLOURS[(index * 5 + row) % LOCK_COLOURS.length]),
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  return mesh;
}

function createSnowAccents(): Mesh {
  const parts: BufferGeometry[] = [];
  const addSnowBox = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    rotationZ = 0,
  ): void => {
    const geometry = new BoxGeometry(width, height, depth).toNonIndexed();
    geometry.deleteAttribute("uv");
    if (rotationZ !== 0) geometry.rotateZ(rotationZ);
    geometry.translate(x, y, z);
    parts.push(geometry);
  };
  const fieldLength = LENGTH_M / WEIDENDAMMER_BRIDGE_RAIL_BAY_COUNT_PER_SIDE;
  for (const side of [-1, 1] as const) {
    for (
      let field = 0;
      field < WEIDENDAMMER_BRIDGE_RAIL_BAY_COUNT_PER_SIDE;
      field += 1
    ) {
      const x = -HALF_LENGTH_M + fieldLength * (field + 0.5);
      addSnowBox(
        x,
        camberAt(x) + 1.185,
        side * HALF_WIDTH_M,
        fieldLength - 0.06,
        0.07,
        0.2,
      );
    }
    for (const wing of [-1, 1]) {
      addSnowBox(
        wing * 1.03,
        CAMBER_M + 2.62,
        side * (HALF_WIDTH_M + 0.1),
        1.55,
        0.08,
        0.2,
        wing * -0.49,
      );
    }
    addSnowBox(
      0.1,
      CAMBER_M + 3.29,
      side * (HALF_WIDTH_M + 0.1),
      0.62,
      0.08,
      0.22,
    );
    for (const fraction of [-0.76, -0.25, 0.25, 0.76]) {
      const x = HALF_LENGTH_M * fraction;
      const y = camberAt(x);
      addSnowBox(x, y + 3.72, side * (HALF_WIDTH_M - 0.08), 0.48, 0.075, 0.48);
      addSnowBox(x, y + 4.05, side * (HALF_WIDTH_M - 0.08), 0.16, 0.06, 0.16);
    }
  }
  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error("Weidendammer bridge snow accents are empty");
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: PALETTE.snow, roughness: 0.98 }),
  );
  mesh.name = WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME;
  mesh.visible = false;
  mesh.userData.reversibleSnow = true;
  mesh.userData.lampCapCount = WEIDENDAMMER_BRIDGE_LAMP_STANDARD_COUNT * 2;
  mesh.userData.loveLocksRemainExposed = true;
  mesh.userData.visualModeOnly = "snowstorm";
  mesh.castShadow = true;
  for (const part of parts) part.dispose();
  return mesh;
}

export function createWeidendammerBridgeDetails(
  detailProfile: WeidendammerBridgeDetailProfile = "full",
  waterTopY = DEFAULT_WATER_TOP_Y_M,
): Group {
  const root = new Group();
  root.name = WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME;
  const { ink, lamps, mesh } = createOrnamentMesh(detailProfile);
  root.add(
    mesh,
    lamps,
    ink,
    createLoveLocks(detailProfile),
    createSnowAccents(),
  );
  root.position.set(
    WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0],
    deckBaseY(waterTopY),
    WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1],
  );
  root.rotation.y = ROOT_ROTATION_Y;
  root.userData = {
    detailProfile,
    eagleCount: WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
    geometryStatus: WEIDENDAMMER_BRIDGE_PROFILE.geometryStatus,
    keepInMinecraft: false,
    loveLockCount: WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT[detailProfile],
    lampStandardCount: WEIDENDAMMER_BRIDGE_LAMP_STANDARD_COUNT,
    osmWayId: WEIDENDAMMER_BRIDGE_PROFILE.osmWayId,
    authoredFeatherCueCount:
      WEIDENDAMMER_BRIDGE_EAGLE_COUNT *
      WEIDENDAMMER_BRIDGE_AUTHORED_FEATHER_CUES.totalPerEagle,
    authoredFeatherCuesPerEagle: WEIDENDAMMER_BRIDGE_AUTHORED_FEATHER_CUES,
    profile: WEIDENDAMMER_BRIDGE_PROFILE,
    railingSystemCount: WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
    repeatingRailFieldCount:
      WEIDENDAMMER_BRIDGE_REPEATING_RAIL_FIELD_COUNT[detailProfile],
    textureFree: true,
  };
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  root.userData.worldBounds = {
    max: bounds.max.toArray(),
    min: bounds.min.toArray(),
  };
  return root;
}

type Block = {
  colour: number;
  position: Point3;
  scale: Point3;
};

function addMinecraftEagle(blocks: Block[], side: -1 | 1): void {
  const z = side * (HALF_WIDTH_M + 0.05);
  const baseY = CAMBER_M + 0.45;
  const put = (x: number, y: number, sx = 0.48, sy = 0.48): void => {
    blocks.push({
      colour: PALETTE.eagle,
      position: [x, y, z],
      scale: [sx, sy, 0.34],
    });
  };
  for (let row = 0; row < 4; row += 1) {
    const spread = 0.45 + row * 0.46;
    put(-spread, baseY + 1.65 + row * 0.22);
    put(spread, baseY + 1.65 + row * 0.22);
    put(-spread - 0.32, baseY + 1.46 + row * 0.13);
    put(spread + 0.32, baseY + 1.46 + row * 0.13);
  }
  for (const [x, y, sx, sy] of [
    [0, baseY + 1.25, 0.72, 1.05],
    [0.18, baseY + 2.08, 0.48, 0.48],
    [0.45, baseY + 2.05, 0.3, 0.24],
    [0, baseY + 0.55, 0.38, 0.7],
    [-0.28, baseY + 0.54, 0.26, 0.62],
    [0.28, baseY + 0.54, 0.26, 0.62],
    [0.18, baseY + 2.52, 0.7, 0.22],
  ] as const) {
    put(x, y, sx, sy);
  }
}

function createMinecraftBlocks(
  detailProfile: WeidendammerBridgeDetailProfile,
): Block[] {
  const blocks: Block[] = [];
  const railStep = detailProfile === "mobile" ? 2.3 : 1.15;
  for (const side of [-1, 1] as const) {
    for (
      let x = -HALF_LENGTH_M + railStep / 2;
      x < HALF_LENGTH_M;
      x += railStep
    ) {
      blocks.push({
        colour: PALETTE.iron,
        position: [x, camberAt(x) + 1.1, side * HALF_WIDTH_M],
        scale: [railStep + 0.04, 0.18, 0.22],
      });
      if (Math.round((x + HALF_LENGTH_M) / railStep) % 2 === 0) {
        blocks.push({
          colour: PALETTE.iron,
          position: [x, camberAt(x) + 0.58, side * HALF_WIDTH_M],
          scale: [0.2, 1.08, 0.22],
        });
      }
    }
    for (const fraction of [-0.76, -0.25, 0.25, 0.76]) {
      const x = HALF_LENGTH_M * fraction;
      const y = camberAt(x);
      for (let level = 0; level < 6; level += 1) {
        blocks.push({
          colour: PALETTE.iron,
          position: [x, y + 0.38 + level * 0.52, side * (HALF_WIDTH_M - 0.08)],
          scale: [0.28, 0.54, 0.28],
        });
      }
      blocks.push({
        colour: PALETTE.brass,
        position: [x, y + 3.65, side * (HALF_WIDTH_M - 0.08)],
        scale: [0.62, 0.58, 0.62],
      });
    }
    addMinecraftEagle(blocks, side);
  }
  const lockCount = detailProfile === "mobile" ? 32 : 64;
  for (let index = 0; index < lockCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    let x =
      -HALF_LENGTH_M +
      1.1 +
      (((index * 29 + 11) % lockCount) / Math.max(1, lockCount - 1)) *
        (LENGTH_M - 2.2);
    if (Math.abs(x) < 2.3) x += x < 0 ? -2.4 : 2.4;
    blocks.push({
      colour: LOCK_COLOURS[(index * 5) % LOCK_COLOURS.length],
      position: [
        x,
        camberAt(x) + 0.55 + (index % 3) * 0.2,
        side * (HALF_WIDTH_M + 0.16),
      ],
      scale: [0.28, 0.34, 0.24],
    });
  }
  return blocks;
}

export function createWeidendammerBridgeMinecraft(
  detailProfile: WeidendammerBridgeDetailProfile = "full",
  waterTopY = DEFAULT_WATER_TOP_Y_M,
): Group {
  const root = new Group();
  root.name = WEIDENDAMMER_BRIDGE_MINECRAFT_ROOT_NAME;
  const blocks = createMinecraftBlocks(detailProfile);
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0.15,
    roughness: 0.82,
    vertexColors: true,
  });
  const mesh = new InstancedMesh(geometry, material, blocks.length);
  mesh.name = "Voxel Weidendammer bridge eagles railings lamps and love locks";
  const dummy = new Object3D();
  blocks.forEach((block, index) => {
    dummy.position.set(...block.position);
    dummy.scale.set(...block.scale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, new Color(block.colour));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    blockCount: blocks.length,
    detailProfile,
    eagleCount: WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
    loveLockBlockCount: detailProfile === "mobile" ? 32 : 64,
    osmWayId: WEIDENDAMMER_BRIDGE_PROFILE.osmWayId,
  };
  root.add(mesh);
  root.position.set(
    WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0],
    deckBaseY(waterTopY),
    WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1],
  );
  root.rotation.y = ROOT_ROTATION_Y;
  root.userData = {
    blockCount: blocks.length,
    detailProfile,
    keepInMinecraft: true,
    osmWayId: WEIDENDAMMER_BRIDGE_PROFILE.osmWayId,
    railingSystemCount: WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
    sourceBound: true,
  };
  return root;
}

function setObjectMaterial(object: Mesh | InstancedMesh, night: boolean): void {
  const dayMaterial = object.userData.dayMaterial as Material | undefined;
  const nightMaterial = object.userData.nightMaterial as Material | undefined;
  if (!dayMaterial || !nightMaterial) return;
  object.material = night ? nightMaterial : dayMaterial;
}

export function setWeidendammerBridgeSnow(
  root: Object3D,
  enabled: boolean,
): void {
  const snow = root.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME);
  if (snow) snow.visible = enabled;
}

export function setWeidendammerBridgePresentation(
  root: Object3D,
  mode: WeidendammerBridgeMode,
): void {
  const smooth = root.getObjectByName(WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME);
  const minecraft = root.getObjectByName(
    WEIDENDAMMER_BRIDGE_MINECRAFT_ROOT_NAME,
  );
  if (smooth) {
    smooth.visible = mode !== "minecraft";
    smooth.traverse((object) => {
      if (object instanceof Mesh || object instanceof InstancedMesh) {
        setObjectMaterial(object, mode === "night");
      }
    });
    setWeidendammerBridgeSnow(smooth, mode === "snowstorm");
    const ink = smooth.getObjectByName(WEIDENDAMMER_BRIDGE_INK_LAYER_NAME);
    if (ink instanceof LineSegments) {
      const material = ink.material as LineBasicMaterial;
      material.color.setHex(mode === "night" ? 0x66767c : 0x1f2527);
      material.opacity =
        mode === "schwellenraum" ? 0.54 : mode === "night" ? 0.48 : 0.8;
    }
  }
  if (minecraft) minecraft.visible = mode === "minecraft";
}

function worldToBridgeLocal(x: number, z: number): Point2 {
  const dx = x - WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0];
  const dz = z - WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1];
  return [dx * AXIS[0] + dz * AXIS[1], dx * NORMAL[0] + dz * NORMAL[1]];
}

/** Exact current inventory envelope in plan, useful for targeted dedupe. */
export function weidendammerBridgePlanContains(
  x: number,
  z: number,
  marginM = 0,
): boolean {
  const [localX, localZ] = worldToBridgeLocal(x, z);
  return (
    Math.abs(localX) <= HALF_LENGTH_M + marginM &&
    Math.abs(localZ) <= HALF_WIDTH_M + marginM
  );
}

/**
 * Granular pedestrian collision for represented bridge furniture only.
 * The complete road and both pavements remain walkable; outer railings,
 * standards and central eagle reliefs are solid in all presentation modes.
 */
export function weidendammerBridgeSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
  waterTopY = DEFAULT_WATER_TOP_Y_M,
): boolean {
  const [localX, localZ] = worldToBridgeLocal(x, z);
  if (Math.abs(localX) > HALF_LENGTH_M + radius + 0.8) return false;
  const deckY = deckBaseY(waterTopY) + camberAt(localX);
  const relativeY = y - deckY;
  const rail =
    relativeY >= -radius &&
    relativeY <= 1.3 + radius &&
    Math.abs(Math.abs(localZ) - HALF_WIDTH_M) <= 0.14 + radius;
  if (rail) return true;
  for (const fraction of [-0.76, -0.25, 0.25, 0.76]) {
    if (
      Math.abs(localX - HALF_LENGTH_M * fraction) <= 0.2 + radius &&
      Math.abs(Math.abs(localZ) - (HALF_WIDTH_M - 0.08)) <= 0.2 + radius &&
      relativeY >= -radius &&
      relativeY <= 4.15 + radius
    ) {
      return true;
    }
  }
  return (
    Math.abs(localX) <= 2.2 + radius &&
    Math.abs(Math.abs(localZ) - (HALF_WIDTH_M + 0.09)) <= 0.3 + radius &&
    relativeY >= 0.35 - radius &&
    relativeY <= 3.45 + radius
  );
}

export type WeidendammerBridgeRenderStats = {
  instanceCount: number;
  renderedVertices: number;
  renderables: number;
  storedVertices: number;
};

export function weidendammerBridgeRenderStats(
  root: Object3D<Object3DEventMap>,
): WeidendammerBridgeRenderStats {
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

export function weidendammerBridgeWorldEnvelope(): Box3 {
  const local = new Box3(
    new Vector3(-HALF_LENGTH_M - 0.4, 0, -HALF_WIDTH_M - 0.45),
    new Vector3(HALF_LENGTH_M + 0.4, 4.75, HALF_WIDTH_M + 0.45),
  );
  const transform = new Matrix4()
    .makeRotationY(ROOT_ROTATION_Y)
    .setPosition(
      WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0],
      deckBaseY(DEFAULT_WATER_TOP_Y_M),
      WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1],
    );
  return local.applyMatrix4(transform);
}
