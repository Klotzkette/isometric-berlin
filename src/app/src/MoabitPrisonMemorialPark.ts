import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
} from "three";

import {
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";

type Point2 = readonly [number, number];
type Mode = "day" | "minecraft" | "night" | "schwellenraum" | "snowstorm";
export type MoabitPrisonMemorialDetailProfile = "full" | "mobile";

const PARK_TRACE_GREEN = 0x729961;
const RED_BRICK = 0xa34e38;
const RED_BRICK_LIGHT = 0xb35c42;
const RED_BRICK_DARK = 0x743326;
const BRICK_MORTAR = 0xd0a990;
const CONCRETE = 0xb7b4ad;
const CONCRETE_DARK = 0x85837e;
const BLOOD_BEECH = 0x654f48;
const JUNIPER = 0x425d47;
const SNOW = 0xeef3f1;

export const MOABIT_PRISON_MEMORIAL_STRUCTURAL_LAYER_NAME =
  "Geschichtspark Moabit structural red-brick walls";
export const MOABIT_PRISON_MEMORIAL_MICRO_LAYER_NAME =
  "Geschichtspark Moabit brick mortar courses";
export const MOABIT_PRISON_MEMORIAL_FINE_LAYER_NAME =
  "Geschichtspark Moabit interpretive memorial details";
export const MOABIT_PRISON_MEMORIAL_SNOW_LAYER_NAME =
  "Geschichtspark Moabit reversible snow caps";

/**
 * Raw, present-day source geometry owned by this dedicated model.
 *
 * Keeping this contract local makes replacement of the older expanded-city
 * profile atomic: the old model and profile can be removed without breaking
 * the source-bound memorial representation.
 */
export const MOABIT_PRISON_PARK_SOURCE_PROFILE = Object.freeze({
  b96CenterlineWorldM: Object.freeze([
    [-225.706, -1013.291],
    [-225.869, -1003.947],
    [-227.779, -997.848],
    [-232.704, -980.811],
    [-237.138, -951.022],
    [-239.14, -925.818],
    [-243.487, -863.267],
    [-244.767, -845.369],
    [-245.973, -829.55],
    [-246.454, -818.2],
    [-246.31, -790.077],
  ] as const),
  centerWorldM: [-329.097233, -906.302474] as const,
  circularYardCount: 3,
  entranceCount: 3,
  groundY: 5.9,
  minimumB96CenterlineClearanceM: 17.29,
  parkRingWorldM: Object.freeze([
    [-422.988, -933.418],
    [-365.535, -813.884],
    [-360.813, -815.936],
    [-346.507, -786.491],
    [-347.566, -783.165],
    [-318.209, -797.412],
    [-314.456, -799.185],
    [-312.816, -799.961],
    [-310.539, -801.033],
    [-279.353, -815.684],
    [-269.063, -820.525],
    [-263.375, -828.375],
    [-258.947, -899.893],
    [-259.972, -907.094],
    [-255.039, -964.625],
    [-313.275, -1032.798],
    [-341.453, -995.635],
    [-342.043, -988.148],
    [-351.047, -988.853],
    [-400.444, -963.888],
    [-430.476, -950.079],
    [-428.091, -945.118],
  ] as const),
  preservedWallHeightM: 5,
  preservedWallPathsWorldM: Object.freeze([
    Object.freeze([
      [-346.607, -783.555],
      [-318.209, -797.412],
      [-314.456, -799.185],
      [-312.816, -799.961],
      [-310.539, -801.033],
      [-279.353, -815.684],
      [-269.063, -820.525],
      [-263.375, -828.375],
      [-259.293, -899.912],
      [-270.422, -922.475],
      [-271.402, -924.456],
      [-272.057, -925.784],
      [-283.87, -949.342],
      [-342.043, -988.148],
    ] as const),
    Object.freeze([
      [-351.047, -988.853],
      [-400.444, -963.888],
      [-430.476, -950.079],
      [-428.091, -945.118],
      [-422.988, -933.418],
    ] as const),
    Object.freeze([
      [-341.653, -993.102],
      [-333.679, -1005.975],
    ] as const),
    Object.freeze([
      [-330.996, -1009.352],
      [-314.424, -1030.91],
    ] as const),
  ] as const),
  preservedWallWayIds: Object.freeze([
    "53178124",
    "105495351",
    "498279237",
    "498279239",
  ] as const),
  rotationY: 2.019,
  sourceB96WayIds: Object.freeze([
    "4389552",
    "168934832",
    "4411242",
  ] as const),
  sourceParkWayId: "498278335",
  sources: Object.freeze([
    "https://www.openstreetmap.org/way/498278335",
    "https://www.openstreetmap.org/way/53178124",
    "https://www.openstreetmap.org/way/105495351",
    "https://www.openstreetmap.org/way/498279237",
    "https://www.openstreetmap.org/way/498279239",
    "https://www.openstreetmap.org/way/4389552",
    "https://www.openstreetmap.org/way/168934832",
    "https://www.openstreetmap.org/way/4411242",
    "https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html",
    "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2459_zellengefaengnis-erlaeuterung.pdf",
  ] as const),
});

const SOURCE_PROFILE = MOABIT_PRISON_PARK_SOURCE_PROFILE;

const ROOT_WORLD_M = [
  SOURCE_PROFILE.centerWorldM[0],
  SOURCE_PROFILE.groundY,
  SOURCE_PROFILE.centerWorldM[1],
] as const;

const WALL_THICKNESS_M = 0.82;

const PANOPTICON_RING_WORLD_M = Object.freeze([
  [-354.9489354522, -886.064263956],
  [-352.6483113688, -881.56105179],
  [-356.5893659326, -879.55825108],
  [-358.8829522198, -884.072433643],
] as const);

const PANOPTICON_CENTER_WORLD_M = Object.freeze([
  PANOPTICON_RING_WORLD_M.reduce((sum, point) => sum + point[0], 0) /
    PANOPTICON_RING_WORLD_M.length,
  PANOPTICON_RING_WORLD_M.reduce((sum, point) => sum + point[1], 0) /
    PANOPTICON_RING_WORLD_M.length,
] as const);

const WALK_IN_CELL_FOOTPRINT_WORLD_M = Object.freeze([
  [-379.107, -937.117],
  [-374.607, -939.295],
  [-373.517, -937.045],
  [-378.018, -934.867],
] as const);

// In the interpretive-plan frame the retained LoD2 cell starts at x=56.554 m.
// Stop the blood-beech marker before that source-owned footprint instead of
// letting the former continuous 63 m strip pass through the real cell shell.
const WING_A_HEDGE_END_LOCAL_X_M = 55.4;

function worldPointToPlanLocal(point: Point2): [number, number] {
  const deltaX = point[0] - PANOPTICON_CENTER_WORLD_M[0];
  const deltaZ = point[1] - PANOPTICON_CENTER_WORLD_M[1];
  const cosine = Math.cos(SOURCE_PROFILE.rotationY);
  const sine = Math.sin(SOURCE_PROFILE.rotationY);
  return [
    deltaX * cosine - deltaZ * sine,
    deltaX * sine + deltaZ * cosine,
  ];
}

const WALK_IN_CELL_PLAN_LOCAL_M = Object.freeze(
  WALK_IN_CELL_FOOTPRINT_WORLD_M.map(worldPointToPlanLocal),
);

const WALK_IN_CELL_PLAN_BOUNDS = Object.freeze({
  maxX: Math.max(...WALK_IN_CELL_PLAN_LOCAL_M.map(([x]) => x)),
  maxZ: Math.max(...WALK_IN_CELL_PLAN_LOCAL_M.map(([, z]) => z)),
  minX: Math.min(...WALK_IN_CELL_PLAN_LOCAL_M.map(([x]) => x)),
  minZ: Math.min(...WALK_IN_CELL_PLAN_LOCAL_M.map(([, z]) => z)),
});

const WING_TRACES = Object.freeze([
  { angle: -0.78, depthM: 10.5, lengthM: 64 },
  { angle: 0.2, depthM: 10.5, lengthM: 64 },
  { angle: 1.18, depthM: 10.5, lengthM: 64 },
] as const);

const EXERCISE_YARDS = Object.freeze([
  [-42, 33, 12],
  [-11, 48, 10],
  [24, 50, 8],
] as const);

const ADMINISTRATION_HEDGE = Object.freeze([
  [-42, -36, 42, 1.4],
  [-42, -56, 42, 1.4],
  [-63, -46, 1.4, 20],
  [-21, -46, 1.4, 20],
] as const);

/**
 * Dedicated present-day memorial-park contract.
 *
 * OSM owns the current park and surviving wall plan. Berlin's published park
 * explanation owns the interpretive inventory. The demolished prison is not
 * rebuilt: its historical five-wing plan remains metadata, while the current
 * park deliberately marks only the four wings named A-D in the design key.
 */
export const MOABIT_PRISON_MEMORIAL_PROFILE = Object.freeze({
  ...SOURCE_PROFILE,
  apiVersion: 1,
  name: "Geschichtspark Ehemaliges Zellengefängnis Moabit",
  publicLabel: "Geschichtspark Zellengefängnis Moabit",
  osmKey: `way/${SOURCE_PROFILE.sourceParkWayId}`,
  presentDayIdentity: Object.freeze({
    name: "Geschichtspark Ehemaliges Zellengefängnis Moabit",
    osmKey: `way/${SOURCE_PROFILE.sourceParkWayId}`,
    wikidata: "Q15111585",
  }),
  commemoratedHistoricIdentity: Object.freeze({
    name: "Zellengefängnis Lehrter Straße",
    wikidata: "Q187723",
    relationship: "replaced and commemorated by the present-day park",
  }),
  officialMonumentObject: "09050274",
  officialMonumentType: "Gesamtanlage",
  worldM: ROOT_WORLD_M,
  currentParkOpened: 2006,
  currentInterpretiveWingCount: 4,
  historicalPrisonWingCount: 5,
  reconstructedCellCount: 0,
  reconstructedBuildingCount: 0,
  markerHeightM: 5,
  panopticon: Object.freeze({
    osmKey: "way/195086492",
    ringWorldM: PANOPTICON_RING_WORLD_M,
    centerWorldM: PANOPTICON_CENTER_WORLD_M,
    form: "open concrete cube sculpture at the exact current OSM artwork plan",
  }),
  walkInCell: Object.freeze({
    osmKey: "node/2310445137",
    name: "Klanginstallation Klopfzeichen",
    lod2BuildingId: "DEBE01AL2yz00000",
    measuredHeightM: 2.946,
    footprintWorldM: WALK_IN_CELL_FOOTPRINT_WORLD_M,
    planLocalBoundsM: WALK_IN_CELL_PLAN_BOUNDS,
    wingAHedgeEndLocalXM: WING_A_HEDGE_END_LOCAL_X_M,
    ownership:
      "retained LoD2/OSM model; deliberately not duplicated in this detail module or its Minecraft batch",
  }),
  informationArtwork: Object.freeze({
    osmKey: "node/5772396362",
    worldM: [-275.6503485881, 5.9, -936.759390027] as const,
    ownership:
      "dedicated exact OSM anchor with a texture-free display-estimate board",
  }),
  memorialPlaque: Object.freeze({
    osmKey: "node/3841135547",
    name: "Ehemaliges Zellengefängnis Moabit",
    ownership:
      "retained street-details memorial plaque; deliberately not duplicated here",
  }),
  retainedPublicRealm: Object.freeze({
    lights: 9,
    source:
      "surface-polygons lawn plus park-details paths, 175 trees inside the exact park polygon, nine lights and playground features remain separately source-owned",
    treesInsideExactPark: 175,
  }),
  modelOwnership: Object.freeze({
    dedicatedOsmKeys: Object.freeze([
      `way/${SOURCE_PROFILE.sourceParkWayId}`,
      "way/195086492",
      "node/2310445137",
      "node/5772396362",
    ]),
    genericArtworkSuppressionKeys: Object.freeze([
      "way/195086492",
      "node/2310445137",
    ]),
    retainedGenericOsmKeys: Object.freeze(["node/3841135547"]),
    retainedLod2BuildingIds: Object.freeze(["DEBE01AL2yz00000"]),
    retainedLod2PrismIds: Object.freeze(["2yz00000"]),
    cellPolicy:
      "retain the exact closed LoD2 cell prism in Smooth and its existing source voxel in Minecraft; add no second cell shell or voxel replacement",
  }),
  informationProgramme:
    "three entrance panels, a walk-in cell with Moabiter Sonette audio, and the Haushofer wall quotation are part of the official memorial-park design",
  nsMemorialContext:
    "one former section was used by the Gestapo from 1944; the park remembers imprisoned opponents of National Socialism including Albrecht Haushofer",
  wallReading:
    "four exact OSM-mapped red-brick barrier polylines with every mapped entrance break open; Berlin's monument record specifically documents surviving north and south ring-wall remains, while way 105495351 keeps its explicit four-metre OSM height and the other paths use Berlin's published general five-metre reading as display height",
  wallHeightConflict: Object.freeze({
    berlinPublishedGeneralHeightM: 5,
    explicitOsmWayHeightM: Object.freeze({ "105495351": 4 }),
    resolution:
      "retain the explicit OSM value for way 105495351; use the Berlin-published general height for wall ways without a source height and label those values as presentation rather than per-segment survey",
  }),
  interpretiveReading:
    "four current wing traces, the exact OSM open concrete panopticon cube, three exercise-yard traces and blood-beech planting; the exact LoD2/OSM walk-in cell remains source-owned outside this module",
  geometryStatus:
    "exact OSM park/wall plan with the official present-day interpretive programme; brick coursing and all uncited local display dimensions are non-surveyed recognition geometry",
  focus: Object.freeze({
    azimuthDegrees: 118,
    distanceM: 128,
    polarDegrees: 53,
    targetHeightM: 3.2,
  }),
  minecraftFocus: Object.freeze({
    azimuthDegrees: 126,
    distanceM: 142,
    polarDegrees: 54,
    targetHeightM: 3.2,
  }),
  siteFocus: Object.freeze({
    azimuthDegrees: 118,
    distanceM: 278,
    polarDegrees: 49,
    targetHeightM: 3.2,
  }),
  minecraftSiteFocus: Object.freeze({
    azimuthDegrees: 126,
    distanceM: 294,
    polarDegrees: 50,
    targetHeightM: 3.2,
  }),
  referencePolicy:
    "official Berlin park-plan PDF supports factual labels only; no plan, photograph, typography or texture is traced, copied or bundled",
  sources: Object.freeze([
    ...SOURCE_PROFILE.sources,
    "https://www.openstreetmap.org/way/195086492",
    "https://www.openstreetmap.org/node/2310445137",
    "https://www.openstreetmap.org/node/5772396362",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050274",
    "https://www.berlin.de/justizvollzug/anstalten/jva-moabit/die-anstalt/historie/",
    "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1649119.php",
  ]),
  sourceRoles: Object.freeze({
    berlinTourism:
      "present-day memorial inventory and the published general five-metre wall reading",
    monumentDatabase:
      "protected ensemble identity and surviving north/south ring-wall remains",
    jvaHistory:
      "historic royal cellular prison only: 1849 opening, remnants, war damage and 1955 demolition; later sections describe the different current JVA",
    mittePress2026:
      "the park opened in 2006 and its present memorial/green-space role; not detailed geometry",
    osmAndLod2:
      "present-day plan anchors, exact mapped wall paths, artworks and retained cell prism",
  }),
  replacementContract: Object.freeze({
    legacyFunction: "addMoabitPrisonPark",
    legacyProfile: "MOABIT_PRISON_PARK_PROFILE",
    legacyRootName: "Geschichtspark Moabit mapped walls and plan",
    action:
      "remove the legacy addMoabitPrisonPark call/root, re-export this profile from the dedicated module and mount exactly one smooth or Minecraft representation",
  }),
  renderPolicy: Object.freeze({
    maxMinecraftBlocks: 4_200,
    maxSmoothRenderables: 6,
    maxSmoothRenderedVertices: 45_000,
    modes: Object.freeze([
      "day",
      "night",
      "snowstorm",
      "schwellenraum",
      "minecraft",
    ]),
    texturePolicy: "procedural geometry only; no image, canvas or text texture",
  }),
});

export function moabitPrisonMemorialFocusForMode(
  mode: Mode,
):
  | typeof MOABIT_PRISON_MEMORIAL_PROFILE.focus
  | typeof MOABIT_PRISON_MEMORIAL_PROFILE.minecraftFocus {
  return mode === "minecraft"
    ? MOABIT_PRISON_MEMORIAL_PROFILE.minecraftFocus
    : MOABIT_PRISON_MEMORIAL_PROFILE.focus;
}

/** Authored close selector target; the integrator adds targetHeightM once. */
export function moabitPrisonMemorialFocusTarget(): readonly [
  number,
  number,
  number,
] {
  return [
    PANOPTICON_CENTER_WORLD_M[0],
    MOABIT_PRISON_MEMORIAL_PROFILE.groundY,
    PANOPTICON_CENTER_WORLD_M[1],
  ];
}

/** Explicit alias for callers that distinguish close and overview actions. */
export function moabitPrisonMemorialDetailFocusForMode(
  mode: Mode,
): ReturnType<typeof moabitPrisonMemorialFocusForMode> {
  return moabitPrisonMemorialFocusForMode(mode);
}

/** Ground target for the optional close detail focus. */
export function moabitPrisonMemorialDetailFocusTarget(): readonly [
  number,
  number,
  number,
] {
  return moabitPrisonMemorialFocusTarget();
}

/** Optional whole-site overview for the complete 175-by-250-metre park. */
export function moabitPrisonMemorialSiteFocusForMode(
  mode: Mode,
):
  | typeof MOABIT_PRISON_MEMORIAL_PROFILE.siteFocus
  | typeof MOABIT_PRISON_MEMORIAL_PROFILE.minecraftSiteFocus {
  return mode === "minecraft"
    ? MOABIT_PRISON_MEMORIAL_PROFILE.minecraftSiteFocus
    : MOABIT_PRISON_MEMORIAL_PROFILE.siteFocus;
}

/** Ground target for the optional whole-site overview. */
export function moabitPrisonMemorialSiteFocusTarget(): readonly [
  number,
  number,
  number,
] {
  return [
    MOABIT_PRISON_MEMORIAL_PROFILE.centerWorldM[0],
    MOABIT_PRISON_MEMORIAL_PROFILE.groundY,
    MOABIT_PRISON_MEMORIAL_PROFILE.centerWorldM[1],
  ];
}

export const MOABIT_PRISON_MEMORIAL_MARKER_HEIGHT_M =
  MOABIT_PRISON_MEMORIAL_PROFILE.markerHeightM;

/** Absolute scene Y for marker.setY; not a relative height. */
export const MOABIT_PRISON_MEMORIAL_MARKER_Y =
  MOABIT_PRISON_MEMORIAL_PROFILE.groundY +
  MOABIT_PRISON_MEMORIAL_PROFILE.markerHeightM;

function localPoint(point: Point2): [number, number] {
  return [
    point[0] - MOABIT_PRISON_MEMORIAL_PROFILE.centerWorldM[0],
    point[1] - MOABIT_PRISON_MEMORIAL_PROFILE.centerWorldM[1],
  ];
}

function rotatedLocalOffset(
  localX: number,
  localZ: number,
  rotationY = MOABIT_PRISON_MEMORIAL_PROFILE.rotationY,
): [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [localX * cosine + localZ * sine, -localX * sine + localZ * cosine];
}

function planOffset(localX: number, localZ: number): [number, number] {
  const [rotatedX, rotatedZ] = rotatedLocalOffset(localX, localZ);
  return [
    PANOPTICON_CENTER_WORLD_M[0] -
      MOABIT_PRISON_MEMORIAL_PROFILE.centerWorldM[0] +
      rotatedX,
    PANOPTICON_CENTER_WORLD_M[1] -
      MOABIT_PRISON_MEMORIAL_PROFILE.centerWorldM[1] +
      rotatedZ,
  ];
}

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
  rotationY = 0,
  inked = false,
): void {
  const geometry = new BoxGeometry(...size);
  if (rotationY !== 0) geometry.rotateY(rotationY);
  geometry.translate(...position);
  addGeometry(builder, geometry, color, inked);
}

function addPlanBox(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  additionalRotationY = 0,
  inked = false,
): void {
  const rotationY =
    MOABIT_PRISON_MEMORIAL_PROFILE.rotationY + additionalRotationY;
  const [x, z] = planOffset(localX, localZ);
  addBox(
    builder,
    color,
    [x, centerY, z],
    [width, height, depth],
    rotationY,
    inked,
  );
}

function addSegment(
  builder: Builder,
  color: number,
  startWorld: Point2,
  endWorld: Point2,
  centerY: number,
  height: number,
  depth: number,
  inked = false,
): void {
  const start = localPoint(startWorld);
  const end = localPoint(endWorld);
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaZ);
  if (length < 0.05 || height <= 0) return;
  addBox(
    builder,
    color,
    [(start[0] + end[0]) / 2, centerY, (start[1] + end[1]) / 2],
    [length + 0.06, height, depth],
    -Math.atan2(deltaZ, deltaX),
    inked,
  );
}

function wallHeightForPath(pathIndex: number): number {
  return MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallWayIds[pathIndex] ===
    "105495351"
    ? 4
    : MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallHeightM;
}

function addPreservedRedBrickWalls(
  structure: Builder,
  mortar: Builder,
  snow: Builder,
  detailProfile: MoabitPrisonMemorialDetailProfile,
): void {
  for (
    let pathIndex = 0;
    pathIndex <
    MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM.length;
    pathIndex += 1
  ) {
    const path =
      MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM[pathIndex];
    const wallHeightM = wallHeightForPath(pathIndex);
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index];
      const end = path[index + 1];
      addSegment(
        structure,
        RED_BRICK,
        start,
        end,
        wallHeightM / 2,
        wallHeightM,
        WALL_THICKNESS_M,
        true,
      );
      addSegment(
        structure,
        RED_BRICK_DARK,
        start,
        end,
        0.16,
        0.32,
        WALL_THICKNESS_M + 0.08,
      );
      addSegment(
        structure,
        RED_BRICK_DARK,
        start,
        end,
        wallHeightM + 0.035,
        0.12,
        WALL_THICKNESS_M + 0.12,
      );
      const courseStride = detailProfile === "mobile" ? 2 : 1;
      for (
        let course = courseStride;
        course * 0.5 < wallHeightM;
        course += courseStride
      ) {
        addSegment(
          mortar,
          BRICK_MORTAR,
          start,
          end,
          course * 0.5,
          0.027,
          WALL_THICKNESS_M + 0.025,
        );
      }
      addSegment(
        snow,
        SNOW,
        start,
        end,
        wallHeightM + 0.115,
        0.09,
        WALL_THICKNESS_M + 0.17,
      );
    }
  }
}

function addPanopticonCube(builder: Builder, snow: Builder): void {
  for (const cornerWorld of PANOPTICON_RING_WORLD_M) {
    const [x, z] = localPoint(cornerWorld);
    addBox(builder, CONCRETE, [x, 1.8, z], [0.58, 3.6, 0.58], 0, true);
  }

  // OSM way 195086492 owns the four exact plan edges. A narrow top beam on
  // each edge expresses the official open concrete cube without a fake roof.
  for (let index = 0; index < PANOPTICON_RING_WORLD_M.length; index += 1) {
    const start = PANOPTICON_RING_WORLD_M[index];
    const end =
      PANOPTICON_RING_WORLD_M[
        (index + 1) % PANOPTICON_RING_WORLD_M.length
      ];
    addSegment(builder, CONCRETE_DARK, start, end, 3.43, 0.62, 0.58, true);
    addSegment(snow, SNOW, start, end, 3.785, 0.09, 0.7);
  }
}

function addInformationArtwork(builder: Builder): void {
  const profile = MOABIT_PRISON_MEMORIAL_PROFILE.informationArtwork;
  const [x, z] = localPoint([profile.worldM[0], profile.worldM[2]]);
  const rotationY = MOABIT_PRISON_MEMORIAL_PROFILE.rotationY;
  const [postOffsetX, postOffsetZ] = [
    Math.cos(rotationY) * 0.68,
    -Math.sin(rotationY) * 0.68,
  ];
  for (const side of [-1, 1]) {
    addBox(
      builder,
      CONCRETE_DARK,
      [x + side * postOffsetX, 0.75, z + side * postOffsetZ],
      [0.09, 1.5, 0.09],
      rotationY,
    );
  }
  addBox(
    builder,
    RED_BRICK_DARK,
    [x, 1.38, z],
    [1.62, 1.12, 0.095],
    rotationY,
    true,
  );
}

function addWingTrace(
  builder: Builder,
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  rotationY: number,
): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const corners = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, z]) => [
    centerX + x * Math.cos(rotationY) + z * Math.sin(rotationY),
    centerZ - x * Math.sin(rotationY) + z * Math.cos(rotationY),
  ]) as [number, number][];
  for (let index = 0; index < corners.length; index += 1) {
    for (const [start, end] of planSegmentsOutsideRetainedCell(
      corners[index],
      corners[(index + 1) % corners.length],
      0.46,
    )) {
      const deltaX = end[0] - start[0];
      const deltaZ = end[1] - start[1];
      addPlanBox(
        builder,
        PARK_TRACE_GREEN,
        (start[0] + end[0]) / 2,
        0.14,
        (start[1] + end[1]) / 2,
        Math.hypot(deltaX, deltaZ),
        0.24,
        0.72,
        -Math.atan2(deltaZ, deltaX),
      );
    }
  }
}

function planSegmentsOutsideRetainedCell(
  start: Point2,
  end: Point2,
  paddingM: number,
): Array<readonly [Point2, Point2]> {
  const bounds = WALK_IN_CELL_PLAN_BOUNDS;
  const minX = bounds.minX - paddingM;
  const maxX = bounds.maxX + paddingM;
  const minZ = bounds.minZ - paddingM;
  const maxZ = bounds.maxZ + paddingM;
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  let enter = 0;
  let exit = 1;
  for (const [direction, distance] of [
    [-deltaX, start[0] - minX],
    [deltaX, maxX - start[0]],
    [-deltaZ, start[1] - minZ],
    [deltaZ, maxZ - start[1]],
  ] as const) {
    if (Math.abs(direction) < 1e-9) {
      if (distance < 0) return [[start, end]];
      continue;
    }
    const amount = distance / direction;
    if (direction < 0) enter = Math.max(enter, amount);
    else exit = Math.min(exit, amount);
    if (enter > exit) return [[start, end]];
  }
  const pointAt = (amount: number): Point2 => [
    start[0] + deltaX * amount,
    start[1] + deltaZ * amount,
  ];
  const kept: Array<readonly [Point2, Point2]> = [];
  if (enter > 1e-4) kept.push([start, pointAt(enter)]);
  if (exit < 1 - 1e-4) kept.push([pointAt(exit), end]);
  return kept;
}

function addInterpretivePlan(
  builder: Builder,
  detailProfile: MoabitPrisonMemorialDetailProfile,
): void {
  for (const wing of WING_TRACES) {
    const localX = Math.cos(wing.angle) * (wing.lengthM * 0.5);
    const localZ = Math.sin(wing.angle) * (wing.lengthM * 0.5);
    addWingTrace(
      builder,
      localX,
      localZ,
      wing.lengthM,
      wing.depthM,
      wing.angle,
    );
  }

  // Wing A: blood-beech hedges mark the cell rhythm. The single concrete cell
  // remains open at the path end, as required by the official park key.
  for (const side of [-1, 1]) {
    addPlanBox(
      builder,
      BLOOD_BEECH,
      WING_A_HEDGE_END_LOCAL_X_M / 2,
      1.15,
      side * 3.4,
      WING_A_HEDGE_END_LOCAL_X_M,
      2.3,
      1.25,
    );
  }
  for (const [localX, localZ, radius] of EXERCISE_YARDS) {
    const ring = new RingGeometry(radius - 0.34, radius + 0.34, 36);
    ring.rotateX(-Math.PI / 2);
    const [x, z] = planOffset(localX, localZ);
    ring.translate(x, 0.125, z);
    addGeometry(builder, ring, CONCRETE, false);

    // The official explanation uses columnar junipers as the restrained
    // figures in the yards. Their exact spacing is display-only.
    const shrubCount = detailProfile === "mobile" ? 2 : 4;
    for (let index = 0; index < shrubCount; index += 1) {
      const angle = (index / shrubCount) * Math.PI * 2 + radius * 0.07;
      const [shrubX, shrubZ] = planOffset(
        localX + Math.cos(angle) * radius * 0.58,
        localZ + Math.sin(angle) * radius * 0.58,
      );
      const shrub = new ConeGeometry(0.52, 2.35, 7, 1, false);
      shrub.translate(shrubX, 1.175, shrubZ);
      addGeometry(builder, shrub, JUNIPER, false);
    }
  }

  for (const [x, z, width, depth] of ADMINISTRATION_HEDGE) {
    addPlanBox(builder, BLOOD_BEECH, x, 1, z, width, 2, depth);
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

/** Smooth, source-bound model for Day, Night, Snowstorm and Schwellenraum. */
export function createMoabitPrisonMemorialPark(
  detailProfile: MoabitPrisonMemorialDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = "Geschichtspark Moabit dedicated source-bound memorial park";
  root.position.set(...ROOT_WORLD_M);
  root.userData = {
    apiVersion: MOABIT_PRISON_MEMORIAL_PROFILE.apiVersion,
    detailProfile,
    exactOsmParkRing: true,
    exactOsmPanopticon: true,
    modes: ["day", "night", "snowstorm", "schwellenraum"],
    moabitPrisonMemorialSmooth: true,
    ownedOsmKey: MOABIT_PRISON_MEMORIAL_PROFILE.osmKey,
    ownedOsmKeys: [
      MOABIT_PRISON_MEMORIAL_PROFILE.osmKey,
      MOABIT_PRISON_MEMORIAL_PROFILE.panopticon.osmKey,
      MOABIT_PRISON_MEMORIAL_PROFILE.walkInCell.osmKey,
      MOABIT_PRISON_MEMORIAL_PROFILE.informationArtwork.osmKey,
    ],
    ownedWallWayIds: MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallWayIds,
    preservedLod2BuildingIds: [
      MOABIT_PRISON_MEMORIAL_PROFILE.walkInCell.lod2BuildingId,
    ],
    preservedLod2PrismIds:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.retainedLod2PrismIds,
    retainedCellPolicy:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.cellPolicy,
    genericArtworkSuppressionKeys:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership
        .genericArtworkSuppressionKeys,
    retainedGenericOsmKeys:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.retainedGenericOsmKeys,
    profile: MOABIT_PRISON_MEMORIAL_PROFILE,
    schwellenraumGeschuetzt: true,
    sourceBounded: true,
    staticInSchwellenraum: true,
    suppressesGenericModels: true,
    texturePolicy: MOABIT_PRISON_MEMORIAL_PROFILE.renderPolicy.texturePolicy,
  };

  const structure = createBuilder();
  const mortar = createBuilder();
  const interpretive = createBuilder();
  const snow = createBuilder();
  addPreservedRedBrickWalls(structure, mortar, snow, detailProfile);
  addPanopticonCube(structure, snow);
  addInformationArtwork(structure);
  addInterpretivePlan(interpretive, detailProfile);
  root.add(
    finishLayer(structure, MOABIT_PRISON_MEMORIAL_STRUCTURAL_LAYER_NAME, {
      alwaysOnStructuralDetail: true,
      historicBuildingReconstructed: false,
      nsMemorialContext: MOABIT_PRISON_MEMORIAL_PROFILE.nsMemorialContext,
      sourceBounded: true,
      survivingWallColor: "red brick",
    }),
  );
  root.add(
    finishLayer(mortar, MOABIT_PRISON_MEMORIAL_MICRO_LAYER_NAME, {
      detailFadeM: [230, 310],
      moabitPrisonMemorialMicro: true,
      nonSurveyedCoursing: true,
    }),
  );
  root.add(
    finishLayer(
      interpretive,
      MOABIT_PRISON_MEMORIAL_FINE_LAYER_NAME,
      {
        detailFadeM: [900, 1_200],
        moabitPrisonMemorialFine: true,
        presentDayInterpretation: true,
      },
    ),
  );

  const snowLayer = finishLayer(
    snow,
    MOABIT_PRISON_MEMORIAL_SNOW_LAYER_NAME,
    { reversible: true, snowOnly: true },
  );
  snowLayer.visible = false;
  snowLayer.traverse((object) => {
    object.visible = false;
    object.userData.snowActive = false;
    object.userData.snowOnly = true;
  });
  root.add(snowLayer);
  return root;
}

/** Toggle only the additive snow layer; every source-bound transform stays fixed. */
export function setMoabitPrisonMemorialSnow(
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

/** Hide the smooth root only after its Minecraft replacement has mounted. */
export function setMoabitPrisonMemorialSmoothVisibility(
  root: Object3D | null,
  visible: boolean,
): void {
  if (!root) return;
  root.traverse((object) => {
    if (object.userData.moabitPrisonMemorialSmooth === true) {
      object.visible = visible;
    }
  });
}

/** Fade recognition details without hiding the source-bound walls. */
export function setMoabitPrisonMemorialFineVisibility(
  root: Object3D | null,
  visible: boolean,
): void {
  if (!root) return;
  root.traverse((object) => {
    if (object.userData.moabitPrisonMemorialFine === true) {
      object.visible = visible;
    }
  });
}

/** Fade brick coursing independently for mobile or distant views. */
export function setMoabitPrisonMemorialMicroVisibility(
  root: Object3D | null,
  visible: boolean,
): void {
  if (!root) return;
  root.traverse((object) => {
    if (object.userData.moabitPrisonMemorialMicro === true) {
      object.visible = visible;
    }
  });
}

function squaredDistanceToSegment(
  x: number,
  z: number,
  start: Point2,
  end: Point2,
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= Number.EPSILON) {
    return (x - start[0]) ** 2 + (z - start[1]) ** 2;
  }
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared,
    ),
  );
  const closestX = start[0] + amount * dx;
  const closestZ = start[1] + amount * dz;
  return (x - closestX) ** 2 + (z - closestZ) ** 2;
}

function pointInRing(
  x: number,
  z: number,
  ring: readonly Point2[],
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

function pointInExpandedRing(
  x: number,
  z: number,
  ring: readonly Point2[],
  padding: number,
): boolean {
  if (pointInRing(x, z, ring)) return true;
  const paddingSquared = padding * padding;
  return ring.some(
    (point, index) =>
      squaredDistanceToSegment(
        x,
        z,
        ring[(index + ring.length - 1) % ring.length],
        point,
      ) <= paddingSquared,
  );
}

/**
 * Analytical collision follows represented solids only. The low lawn/yard
 * traces and the open interiors remain walkable, including all mapped gates.
 */
export function moabitPrisonMemorialSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  if (![x, y, z, radiusM].every(Number.isFinite)) return false;
  const padding = Math.max(0, radiusM);
  const localY = y - MOABIT_PRISON_MEMORIAL_PROFILE.groundY;
  if (localY < -padding) return false;

  const wallRadiusSquared = (WALL_THICKNESS_M / 2 + padding) ** 2;
  for (
    let pathIndex = 0;
    pathIndex <
    MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM.length;
    pathIndex += 1
  ) {
    if (localY <= wallHeightForPath(pathIndex) + padding) {
      const path =
        MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM[pathIndex];
      for (let index = 0; index < path.length - 1; index += 1) {
        if (
          squaredDistanceToSegment(x, z, path[index], path[index + 1]) <=
          wallRadiusSquared
        ) {
          return true;
        }
      }
    }
  }

  // Visual ownership stays with the exact retained LoD2 prism, while this
  // shared analytical hook exposes the same source footprint to navigation.
  if (
    localY <=
      MOABIT_PRISON_MEMORIAL_PROFILE.walkInCell.measuredHeightM + padding &&
    pointInExpandedRing(x, z, WALK_IN_CELL_FOOTPRINT_WORLD_M, padding)
  ) {
    return true;
  }

  if (localY <= 3.6 + padding) {
    for (const [postX, postZ] of PANOPTICON_RING_WORLD_M) {
      if (Math.hypot(x - postX, z - postZ) <= 0.3 + padding) return true;
    }
  }
  if (localY >= 3.12 - padding && localY <= 3.74 + padding) {
    const beamRadiusSquared = (0.3 + padding) ** 2;
    for (let index = 0; index < PANOPTICON_RING_WORLD_M.length; index += 1) {
      if (
        squaredDistanceToSegment(
          x,
          z,
          PANOPTICON_RING_WORLD_M[index],
          PANOPTICON_RING_WORLD_M[
            (index + 1) % PANOPTICON_RING_WORLD_M.length
          ],
        ) <= beamRadiusSquared
      ) {
        return true;
      }
    }
  }
  return false;
}

type Block = {
  color: number;
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
};

function pushBlock(
  blocks: Block[],
  position: [number, number, number],
  scale: [number, number, number],
  color: number,
  rotationY = 0,
): void {
  blocks.push({ color, position, rotationY, scale });
}

function pushWorldSegmentBlocks(
  blocks: Block[],
  startWorld: Point2,
  endWorld: Point2,
  heightM: number,
  thicknessM: number,
  colors: readonly number[],
  blockSize = 0.92,
): void {
  const start = localPoint(startWorld);
  const end = localPoint(endWorld);
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaZ);
  if (length < 0.05) return;
  const columns = Math.max(1, Math.ceil(length / blockSize));
  const rows = Math.max(1, Math.ceil(heightM / blockSize));
  const columnLength = length / columns;
  const rotationY = -Math.atan2(deltaZ, deltaX);
  for (let row = 0; row < rows; row += 1) {
    const rowBottom = row * blockSize;
    const rowHeight = Math.min(blockSize, heightM - rowBottom);
    for (let column = 0; column < columns; column += 1) {
      const amount = (column + 0.5) / columns;
      pushBlock(
        blocks,
        [
          start[0] + deltaX * amount,
          rowBottom + rowHeight / 2,
          start[1] + deltaZ * amount,
        ],
        [columnLength + 0.035, rowHeight, thicknessM],
        colors[(row * 3 + column) % colors.length],
        rotationY,
      );
    }
  }
}

function pushPlanSegmentBlocks(
  blocks: Block[],
  startLocal: Point2,
  endLocal: Point2,
  y: number,
  color: number,
  blockSize = 0.92,
): void {
  const start = planOffset(startLocal[0], startLocal[1]);
  const end = planOffset(endLocal[0], endLocal[1]);
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaZ);
  const count = Math.max(1, Math.ceil(length / blockSize));
  const stepLength = length / count;
  const rotationY = -Math.atan2(deltaZ, deltaX);
  for (let index = 0; index < count; index += 1) {
    const amount = (index + 0.5) / count;
    pushBlock(
      blocks,
      [start[0] + deltaX * amount, y, start[1] + deltaZ * amount],
      [stepLength + 0.035, blockSize, blockSize],
      color,
      rotationY,
    );
  }
}

function pushPlanRectangleOutline(
  blocks: Block[],
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  rotationY: number,
  y: number,
  color: number,
  blockSize = 0.92,
): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const corners = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, z]) => [
    centerX + x * Math.cos(rotationY) + z * Math.sin(rotationY),
    centerZ - x * Math.sin(rotationY) + z * Math.cos(rotationY),
  ]) as [number, number][];
  for (let index = 0; index < corners.length; index += 1) {
    pushPlanSegmentBlocks(
      blocks,
      corners[index],
      corners[(index + 1) % corners.length],
      y,
      color,
      blockSize,
    );
  }
}

function pushLocalExactSegmentBlocks(
  blocks: Block[],
  start: Point2,
  end: Point2,
  y: number,
  color: number,
  blockSize: number,
): void {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaZ);
  const count = Math.max(1, Math.ceil(length / blockSize));
  for (let index = 0; index < count; index += 1) {
    const amount = (index + 0.5) / count;
    pushBlock(
      blocks,
      [start[0] + deltaX * amount, y, start[1] + deltaZ * amount],
      [length / count + 0.035, blockSize, blockSize * 0.78],
      color,
      -Math.atan2(deltaZ, deltaX),
    );
  }
}

function createMinecraftBlocks(
  detailProfile: MoabitPrisonMemorialDetailProfile,
): Block[] {
  const blocks: Block[] = [];
  const blockSize = detailProfile === "mobile" ? 1.28 : 0.92;
  for (
    let pathIndex = 0;
    pathIndex <
    MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM.length;
    pathIndex += 1
  ) {
    const path =
      MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM[pathIndex];
    for (let index = 0; index < path.length - 1; index += 1) {
      pushWorldSegmentBlocks(
        blocks,
        path[index],
        path[index + 1],
        wallHeightForPath(pathIndex),
        0.92,
        [RED_BRICK, RED_BRICK_LIGHT, RED_BRICK_DARK],
        blockSize,
      );
    }
  }

  for (const wing of WING_TRACES) {
    const centerX = Math.cos(wing.angle) * (wing.lengthM * 0.5);
    const centerZ = Math.sin(wing.angle) * (wing.lengthM * 0.5);
    pushPlanRectangleOutline(
      blocks,
      centerX,
      centerZ,
      wing.lengthM,
      wing.depthM,
      wing.angle,
      0.46,
      PARK_TRACE_GREEN,
      blockSize,
    );
  }

  for (const side of [-1, 1]) {
    pushPlanSegmentBlocks(
      blocks,
      [0, side * 3.4],
      [WING_A_HEDGE_END_LOCAL_X_M, side * 3.4],
      blockSize / 2,
      BLOOD_BEECH,
      blockSize,
    );
    if (detailProfile === "full") {
      pushPlanSegmentBlocks(
        blocks,
        [0, side * 3.4],
        [WING_A_HEDGE_END_LOCAL_X_M, side * 3.4],
        blockSize * 1.5,
        BLOOD_BEECH,
        blockSize,
      );
    }
  }

  for (const cornerWorld of PANOPTICON_RING_WORLD_M) {
    const [worldX, worldZ] = localPoint(cornerWorld);
    const levels = Math.ceil(3.6 / blockSize);
    for (let level = 0; level < levels; level += 1) {
      const bottom = level * blockSize;
      const height = Math.min(blockSize, 3.6 - bottom);
      pushBlock(
        blocks,
        [worldX, bottom + height / 2, worldZ],
        [blockSize * 0.78, height, blockSize * 0.78],
        CONCRETE,
      );
    }
  }
  for (let index = 0; index < PANOPTICON_RING_WORLD_M.length; index += 1) {
    pushLocalExactSegmentBlocks(
      blocks,
      localPoint(PANOPTICON_RING_WORLD_M[index]),
      localPoint(
        PANOPTICON_RING_WORLD_M[(index + 1) % PANOPTICON_RING_WORLD_M.length],
      ),
      3.6 - blockSize / 2,
      CONCRETE_DARK,
      blockSize,
    );
  }

  for (const [localX, localZ, radius] of EXERCISE_YARDS) {
    const segments = Math.max(
      detailProfile === "mobile" ? 16 : 24,
      Math.ceil((Math.PI * 2 * radius) / (blockSize * 1.25)),
    );
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const [x, z] = planOffset(
        localX + Math.cos(angle) * radius,
        localZ + Math.sin(angle) * radius,
      );
      pushBlock(
        blocks,
        [x, blockSize * 0.24, z],
        [blockSize * 0.68, blockSize * 0.48, blockSize * 0.68],
        CONCRETE,
      );
    }
  }

  for (const [x, z, width, depth] of ADMINISTRATION_HEDGE) {
    const alongX = width >= depth;
    const halfLength = (alongX ? width : depth) / 2;
    pushPlanSegmentBlocks(
      blocks,
      alongX ? [x - halfLength, z] : [x, z - halfLength],
      alongX ? [x + halfLength, z] : [x, z + halfLength],
      0.92,
      BLOOD_BEECH,
      blockSize,
    );
  }
  return blocks.filter((block) => !blockIntersectsRetainedCell(block));
}

function blockIntersectsRetainedCell(block: Block): boolean {
  const cosine = Math.cos(block.rotationY);
  const sine = Math.sin(block.rotationY);
  const worldCenterX = ROOT_WORLD_M[0] + block.position[0];
  const worldCenterZ = ROOT_WORLD_M[2] + block.position[2];
  const halfX = block.scale[0] / 2;
  const halfZ = block.scale[2] / 2;
  const footprint = [
    [-halfX, -halfZ],
    [halfX, -halfZ],
    [halfX, halfZ],
    [-halfX, halfZ],
  ].map(([x, z]) => [
    worldCenterX + x * cosine + z * sine,
    worldCenterZ - x * sine + z * cosine,
  ]) as Point2[];
  if (
    footprint.some(([x, z]) =>
      pointInRing(x, z, WALK_IN_CELL_FOOTPRINT_WORLD_M),
    ) ||
    WALK_IN_CELL_FOOTPRINT_WORLD_M.some(([x, z]) =>
      pointInRing(x, z, footprint),
    )
  ) {
    return true;
  }
  for (let first = 0; first < footprint.length; first += 1) {
    for (
      let second = 0;
      second < WALK_IN_CELL_FOOTPRINT_WORLD_M.length;
      second += 1
    ) {
      if (
        segmentsIntersect(
          footprint[first],
          footprint[(first + 1) % footprint.length],
          WALK_IN_CELL_FOOTPRINT_WORLD_M[second],
          WALK_IN_CELL_FOOTPRINT_WORLD_M[
            (second + 1) % WALK_IN_CELL_FOOTPRINT_WORLD_M.length
          ],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): boolean {
  const orientation = (a: Point2, b: Point2, c: Point2): number =>
    (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (start: Point2, end: Point2, point: Point2): boolean =>
    point[0] >= Math.min(start[0], end[0]) - 1e-9 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-9 &&
    point[1] >= Math.min(start[1], end[1]) - 1e-9 &&
    point[1] <= Math.max(start[1], end[1]) + 1e-9;
  const firstStartSide = orientation(firstStart, firstEnd, secondStart);
  const firstEndSide = orientation(firstStart, firstEnd, secondEnd);
  const secondStartSide = orientation(secondStart, secondEnd, firstStart);
  const secondEndSide = orientation(secondStart, secondEnd, firstEnd);
  if (
    ((firstStartSide > 1e-9 && firstEndSide < -1e-9) ||
      (firstStartSide < -1e-9 && firstEndSide > 1e-9)) &&
    ((secondStartSide > 1e-9 && secondEndSide < -1e-9) ||
      (secondStartSide < -1e-9 && secondEndSide > 1e-9))
  ) {
    return true;
  }
  return (
    (Math.abs(firstStartSide) <= 1e-9 &&
      onSegment(firstStart, firstEnd, secondStart)) ||
    (Math.abs(firstEndSide) <= 1e-9 &&
      onSegment(firstStart, firstEnd, secondEnd)) ||
    (Math.abs(secondStartSide) <= 1e-9 &&
      onSegment(secondStart, secondEnd, firstStart)) ||
    (Math.abs(secondEndSide) <= 1e-9 &&
      onSegment(secondStart, secondEnd, firstEnd))
  );
}

/** One opaque block-native batch; no smooth wall or park geometry is copied. */
export function createMoabitPrisonMemorialParkMinecraft(
  detailProfile: MoabitPrisonMemorialDetailProfile = "full",
): InstancedMesh {
  const blocks = createMinecraftBlocks(detailProfile);
  if (
    blocks.length >
    MOABIT_PRISON_MEMORIAL_PROFILE.renderPolicy.maxMinecraftBlocks
  ) {
    throw new Error(`Moabit prison Minecraft budget exceeded: ${blocks.length}`);
  }
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x251915,
    emissiveIntensity: 0.12,
    flatShading: true,
    metalness: 0,
    roughness: 0.94,
  });
  material.name = "Geschichtspark Moabit Minecraft material";
  const mesh = new InstancedMesh(geometry, material, blocks.length);
  mesh.name = "Geschichtspark Moabit Minecraft red-brick block batch";
  mesh.position.set(...ROOT_WORLD_M);
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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.userData = {
    blockCount: blocks.length,
    blockNative: true,
    detailProfile,
    exactOneBatch: true,
    mode: "minecraft",
    ownedOsmKey: MOABIT_PRISON_MEMORIAL_PROFILE.osmKey,
    ownedOsmKeys: MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.dedicatedOsmKeys,
    ownedWallWayIds: MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallWayIds,
    preservedLod2BuildingIds:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.retainedLod2BuildingIds,
    preservedLod2PrismIds:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.retainedLod2PrismIds,
    genericArtworkSuppressionKeys:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership
        .genericArtworkSuppressionKeys,
    retainedGenericOsmKeys:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.retainedGenericOsmKeys,
    retainedCellPolicy:
      MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership.cellPolicy,
    profile: MOABIT_PRISON_MEMORIAL_PROFILE,
    smoothGeometryExcluded: true,
    textureFree: true,
  };
  return mesh;
}

/** QA helper: count real GPU renderables in one representation. */
export function moabitPrisonMemorialRenderStats(root: Object3D): {
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
