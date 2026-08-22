import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Object3DEventMap,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

export type SocialCourtDetailProfile = "full" | "mobile";

export const SOCIAL_COURT_ROOT_NAME =
  "Sozialgericht Berlin source-bound Neo-Renaissance facade";
export const SOCIAL_COURT_BATCH_NAME =
  "Sozialgericht sandstone facade, portal and roof sculpture";

// OSM way 423490503 supplies the public Invalidenstrasse site boundary. The
// decorated skin itself belongs on the parallel LoD2 wall behind that boundary
// rather than on the pavement edge. Both are retained as separate source facts.
const STREET_BOUNDARY_START_WORLD = [42.76884108165, -937.37724192] as const;
const STREET_BOUNDARY_END_WORLD = [-9.6127475682, -912.386695696] as const;
const STREET_BOUNDARY_LENGTH_M = Math.hypot(
  STREET_BOUNDARY_END_WORLD[0] - STREET_BOUNDARY_START_WORLD[0],
  STREET_BOUNDARY_END_WORLD[1] - STREET_BOUNDARY_START_WORLD[1],
);
const FACADE_START_WORLD = [32.388, -939.739] as const;
const FACADE_END_WORLD = [-11.798, -918.779] as const;
const FACADE_DX = FACADE_END_WORLD[0] - FACADE_START_WORLD[0];
const FACADE_DZ = FACADE_END_WORLD[1] - FACADE_START_WORLD[1];
const FACADE_LENGTH_M = Math.hypot(FACADE_DX, FACADE_DZ);
const FACADE_AXIS = [
  FACADE_DX / FACADE_LENGTH_M,
  FACADE_DZ / FACADE_LENGTH_M,
] as const;
const OUTWARD_NORMAL = [FACADE_AXIS[1], -FACADE_AXIS[0]] as const;
const STREET_EDGE_CENTER = [
  (STREET_BOUNDARY_START_WORLD[0] + STREET_BOUNDARY_END_WORLD[0]) / 2,
  (STREET_BOUNDARY_START_WORLD[1] + STREET_BOUNDARY_END_WORLD[1]) / 2,
] as const;
const FACADE_EDGE_CENTER = [
  (FACADE_START_WORLD[0] + FACADE_END_WORLD[0]) / 2,
  (FACADE_START_WORLD[1] + FACADE_END_WORLD[1]) / 2,
] as const;
// A 12 cm outward skin clears z-fighting while still overlapping the LoD2
// wall's plan tolerance; it is not a second detached building volume.
const FACADE_OUTWARD_OFFSET_M = 0.12;
const FACADE_CENTER = [
  FACADE_EDGE_CENTER[0] + OUTWARD_NORMAL[0] * FACADE_OUTWARD_OFFSET_M,
  FACADE_EDGE_CENTER[1] + OUTWARD_NORMAL[1] * FACADE_OUTWARD_OFFSET_M,
] as const;
const FACADE_ROTATION_Y = -Math.atan2(FACADE_DZ, FACADE_DX);
const GROUND_Y = 5.5;
const LOD2_HEIGHT_M = 16.956;
const RISALIT_START_WORLD = [17.78, -931.987] as const;
const RISALIT_END_WORLD = [3.873, -925.391] as const;
const RISALIT_WIDTH_M = Math.hypot(
  RISALIT_END_WORLD[0] - RISALIT_START_WORLD[0],
  RISALIT_END_WORLD[1] - RISALIT_START_WORLD[1],
);
const RISALIT_EDGE_CENTER_WORLD = [
  (RISALIT_START_WORLD[0] + RISALIT_END_WORLD[0]) / 2,
  (RISALIT_START_WORLD[1] + RISALIT_END_WORLD[1]) / 2,
] as const;
const RISALIT_CENTER_LOCAL_X_M =
  (RISALIT_EDGE_CENTER_WORLD[0] - FACADE_EDGE_CENTER[0]) * FACADE_AXIS[0] +
  (RISALIT_EDGE_CENTER_WORLD[1] - FACADE_EDGE_CENTER[1]) * FACADE_AXIS[1];
const PORTAL_START_WORLD = [12.856, -928.805] as const;
const PORTAL_END_WORLD = [8.522, -926.749] as const;
const PORTAL_SOURCE_WIDTH_M = Math.hypot(
  PORTAL_END_WORLD[0] - PORTAL_START_WORLD[0],
  PORTAL_END_WORLD[1] - PORTAL_START_WORLD[1],
);
const PORTAL_EDGE_CENTER_WORLD = [
  (PORTAL_START_WORLD[0] + PORTAL_END_WORLD[0]) / 2,
  (PORTAL_START_WORLD[1] + PORTAL_END_WORLD[1]) / 2,
] as const;
const PORTAL_CENTER_LOCAL_X_M =
  (PORTAL_EDGE_CENTER_WORLD[0] - FACADE_EDGE_CENTER[0]) * FACADE_AXIS[0] +
  (PORTAL_EDGE_CENTER_WORLD[1] - FACADE_EDGE_CENTER[1]) * FACADE_AXIS[1];
const BAY_PITCH_M = FACADE_LENGTH_M / 11.1;
const BAY_CENTRES_M = Object.freeze(
  Array.from({ length: 11 }, (_, index) => (index - 5) * BAY_PITCH_M),
);

/**
 * Source hierarchy for the former Berlin-Hamburg railway administration
 * building, now Sozialgericht Berlin.
 *
 * OSM way 423490503 supplies the public Invalidenstrasse site boundary; LoD2
 * object DEBE01YYK0002Qys supplies the actual 48.905 m facade wall, 15.392 m
 * risalit, 5.5 m scene ground and 16.956 m measured building height. Six
 * owner-supplied street photographs control the visible 4 + 3 + 4 axis
 * hierarchy, window families, portal, cornices and roof-sculpture silhouettes.
 * Their pixels are reference-only: no photograph, canvas or runtime texture
 * is copied into the viewer.
 */
export const SOCIAL_COURT_PROFILE = Object.freeze({
  address: "Invalidenstraße 52, 10557 Berlin",
  axisWorld: FACADE_AXIS,
  facade: Object.freeze({
    axisCount: 11,
    bayCentresM: BAY_CENTRES_M,
    bayPitchM: BAY_PITCH_M,
    centreAxisCount: 3,
    facadeLengthM: FACADE_LENGTH_M,
    facadeOffsetOutwardM: FACADE_OUTWARD_OFFSET_M,
    leftWingAxisCount: 4,
    risalitDepthM: 0.72,
    risalitCenterLocalXM: RISALIT_CENTER_LOCAL_X_M,
    risalitWidthM: RISALIT_WIDTH_M,
    rightWingAxisCount: 4,
    rotationY: FACADE_ROTATION_Y,
    sourceFacadeEdgeEndWorldM: FACADE_END_WORLD,
    sourceFacadeEdgeStartWorldM: FACADE_START_WORLD,
    sourceRisalitEdgeEndWorldM: RISALIT_END_WORLD,
    sourceRisalitEdgeCenterWorldM: RISALIT_EDGE_CENTER_WORLD,
    sourceRisalitEdgeStartWorldM: RISALIT_START_WORLD,
    sourceStreetBoundaryEndWorldM: STREET_BOUNDARY_END_WORLD,
    sourceStreetBoundaryLengthM: STREET_BOUNDARY_LENGTH_M,
    sourceStreetBoundaryStartWorldM: STREET_BOUNDARY_START_WORLD,
  }),
  facadeEdgeCenterWorldM: FACADE_EDGE_CENTER,
  frontCenterWorldM: FACADE_CENTER,
  geometryStatus:
    "OSM way 423490503 fixes the public street-side site boundary; Berlin LoD2 DEBE01YYK0002Qys fixes the actual 48.905 m facade wall, 15.392 m risalit, 5.5 m ground and 16.956 m body height; six owner-supplied facade photographs control bounded proportional recognition detail, not a component survey",
  groundY: GROUND_Y,
  lod2: Object.freeze({
    measuredHeightM: LOD2_HEIGHT_M,
    sourceBuildingId: "DEBE01YYK0002Qys",
    sourceCreationDate: "2026-03-02",
  }),
  name: "Sozialgericht Berlin",
  osmWayId: "423490503",
  outwardNormalWorld: OUTWARD_NORMAL,
  palette: Object.freeze({
    glass: 0x718c98,
    granite: 0x77736d,
    main: 0xcbb18a,
    metal: 0x30342f,
    profile: 0xdac39d,
    shadow: 0xaa8e69,
    transom: 0xd2a34f,
    wood: 0x35251d,
  }),
  photoReferenceCount: 6,
  portal: Object.freeze({
    addressNumber: "52",
    centerLocalXM: PORTAL_CENTER_LOCAL_X_M,
    columnCount: 2,
    sourceEdgeCenterWorldM: PORTAL_EDGE_CENTER_WORLD,
    sourceEdgeEndWorldM: PORTAL_END_WORLD,
    sourceEdgeStartWorldM: PORTAL_START_WORLD,
    sourceWidthM: PORTAL_SOURCE_WIDTH_M,
    stepCount: 6,
  }),
  roof: Object.freeze({
    centralSculptureGroupCount: 1,
    flagpoleIsBare: true,
    shoulderSculptureGroupCount: 2,
  }),
  runtimeAssets: [] as const,
  sourceUrls: [
    "https://www.openstreetmap.org/way/423490503",
    "https://www.berlin.de/gerichte/sozialgericht/ueber-uns/allgemeines/",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050269",
  ] as const,
  streetEdgeCenterWorldM: STREET_EDGE_CENTER,
  texturePolicy:
    "Reference photographs are not bundled or loaded; all masonry, glazing, numerals and ornaments are procedural geometry",
});

export const SOCIAL_COURT_RENDER_BUDGET = Object.freeze({
  full: Object.freeze({ maxRenderables: 3, maxVertices: 32_000 }),
  mobile: Object.freeze({ maxRenderables: 3, maxVertices: 21_000 }),
});

const MAIN_STONE = SOCIAL_COURT_PROFILE.palette.main;
const PROFILE_STONE = SOCIAL_COURT_PROFILE.palette.profile;
const STONE_SHADOW = SOCIAL_COURT_PROFILE.palette.shadow;
const GRANITE = SOCIAL_COURT_PROFILE.palette.granite;
const WINDOW_GLASS = SOCIAL_COURT_PROFILE.palette.glass;
const WINDOW_FRAME = 0x292b29;
const DARK_METAL = SOCIAL_COURT_PROFILE.palette.metal;
const DARK_WOOD = SOCIAL_COURT_PROFILE.palette.wood;
const AMBER_TRANSOM = SOCIAL_COURT_PROFILE.palette.transom;
const ROOF_GREEN = 0x68746c;
const BRASS = 0xa7833d;
const Y_AXIS = new Vector3(0, 1, 0);
const ORIGIN = new Vector3(FACADE_CENTER[0], 0, FACADE_CENTER[1]);

function addGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  options: { inked?: boolean; lamp?: boolean } = {},
): void {
  // BufferGeometryUtils cannot merge indexed and non-indexed primitives in
  // one batch. Extruded arches are non-indexed while boxes, toruses and
  // spheres are indexed, so normalise every authored part before painting.
  if (!geometry.index) {
    const positionCount = geometry.getAttribute("position").count;
    geometry.setIndex(
      Array.from({ length: positionCount }, (_, index) => index),
    );
  }
  paintGeometry(geometry, color);
  const lamp = options.lamp ?? false;
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if ((options.inked ?? true) && !lamp) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addWithLocalXOffset(
  builder: Builder,
  localXOffset: number,
  draw: (shifted: Builder) => void,
): void {
  const shifted = createBuilder();
  draw(shifted);
  const offsetX = FACADE_AXIS[0] * localXOffset;
  const offsetZ = FACADE_AXIS[1] * localXOffset;
  for (const key of ["parts", "lamps", "edges"] as const) {
    for (const geometry of shifted[key]) {
      geometry.translate(offsetX, 0, offsetZ);
      builder[key].push(geometry);
    }
  }
}

function worldAt(localX: number, localZ: number): readonly [number, number] {
  const cosine = Math.cos(FACADE_ROTATION_Y);
  const sine = Math.sin(FACADE_ROTATION_Y);
  return [
    ORIGIN.x + localX * cosine + localZ * sine,
    ORIGIN.z - localX * sine + localZ * cosine,
  ];
}

function addLocalBox(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  inked = true,
  lamp = false,
): void {
  const [x, z] = worldAt(localX, localZ);
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(FACADE_ROTATION_Y);
  geometry.translate(x, centerY, z);
  addGeometry(builder, geometry, color, { inked, lamp });
}

function addLocalCylinder(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  radius: number,
  height: number,
  segments: number,
  inked = true,
): void {
  const [x, z] = worldAt(localX, localZ);
  const geometry = new CylinderGeometry(radius, radius, height, segments);
  geometry.translate(x, centerY, z);
  addGeometry(builder, geometry, color, { inked });
}

function addLocalEllipsoid(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  scale: readonly [number, number, number],
  segments: number,
): void {
  const geometry = new SphereGeometry(1, segments, Math.max(4, segments - 2));
  geometry.scale(...scale);
  geometry.rotateY(FACADE_ROTATION_Y);
  const [x, z] = worldAt(localX, localZ);
  geometry.translate(x, centerY, z);
  addGeometry(builder, geometry, color, { inked: false });
}

function addLocalBeam(
  builder: Builder,
  color: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  radius: number,
  segments: number,
): void {
  const [startX, startZ] = worldAt(start[0], start[2]);
  const [endX, endZ] = worldAt(end[0], end[2]);
  const from = new Vector3(startX, start[1], startZ);
  const to = new Vector3(endX, end[1], endZ);
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length < 0.05) return;
  const geometry = new CylinderGeometry(radius, radius, length, segments);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize()),
  );
  geometry.translate(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    (from.z + to.z) / 2,
  );
  addGeometry(builder, geometry, color, { inked: false });
}

function archShape(width: number, height: number): Shape {
  const radius = width / 2;
  const springY = height - radius;
  const shape = new Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, springY);
  shape.absarc(0, springY, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  shape.closePath();
  return shape;
}

function addLocalShape(
  builder: Builder,
  shape: Shape,
  color: number,
  localX: number,
  bottomY: number,
  localZ: number,
  depth: number,
  options: { inked?: boolean; lamp?: boolean } = {},
): void {
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  geometry.translate(localX, bottomY, localZ - depth / 2);
  geometry.rotateY(FACADE_ROTATION_Y);
  geometry.translate(ORIGIN.x, 0, ORIGIN.z);
  addGeometry(builder, geometry, color, options);
}

function addArchedLayer(
  builder: Builder,
  color: number,
  localX: number,
  bottomY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  options: { inked?: boolean; lamp?: boolean } = {},
): void {
  addLocalShape(
    builder,
    archShape(width, height),
    color,
    localX,
    bottomY,
    localZ,
    depth,
    options,
  );
}

function addLocalDisc(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  radius: number,
  segments: number,
  lamp = false,
): void {
  const geometry = new CircleGeometry(radius, segments);
  // CircleGeometry faces +Z by default, while this facade's public front is
  // local -Z. Flip it before placing the disc so FrontSide materials keep the
  // three oculi and Portal 52's amber transom visible from Invalidenstrasse.
  geometry.rotateY(Math.PI);
  geometry.translate(localX, centerY, localZ);
  geometry.rotateY(FACADE_ROTATION_Y);
  geometry.translate(ORIGIN.x, 0, ORIGIN.z);
  addGeometry(builder, geometry, color, { inked: false, lamp });
}

function addLocalRing(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  radius: number,
  tube: number,
  segments: number,
): void {
  const geometry = new TorusGeometry(
    radius,
    tube,
    Math.max(4, Math.floor(segments / 2)),
    segments,
  );
  geometry.translate(localX, centerY, localZ);
  geometry.rotateY(FACADE_ROTATION_Y);
  geometry.translate(ORIGIN.x, 0, ORIGIN.z);
  addGeometry(builder, geometry, color, { inked: false });
}

function addTrianglePanel(
  builder: Builder,
  color: number,
  localX: number,
  width: number,
  bottomY: number,
  rise: number,
  localZ: number,
  depth: number,
): void {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  addLocalShape(builder, shape, color, localX, bottomY, localZ, depth);
}

function addLocalSlopedBox(
  builder: Builder,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  length: number,
  height: number,
  depth: number,
  rotationZ: number,
): void {
  const geometry = new BoxGeometry(length, height, depth);
  geometry.rotateZ(rotationZ);
  geometry.rotateY(FACADE_ROTATION_Y);
  const [x, z] = worldAt(localX, localZ);
  geometry.translate(x, centerY, z);
  addGeometry(builder, geometry, color);
}

function addFramedArchWindow(
  builder: Builder,
  options: {
    bottomY: number;
    frame: number;
    height: number;
    localX: number;
    localZ: number;
    mullionCount?: number;
    transom?: boolean;
    width: number;
  },
): void {
  const { bottomY, frame, height, localX, localZ, width } = options;
  addArchedLayer(
    builder,
    PROFILE_STONE,
    localX,
    bottomY,
    localZ,
    width,
    height,
    0.22,
    { inked: true },
  );
  const innerWidth = width - frame * 2;
  const innerHeight = height - frame * 1.7;
  const innerBottom = bottomY + frame * 0.72;
  addArchedLayer(
    builder,
    WINDOW_GLASS,
    localX,
    innerBottom,
    localZ - 0.14,
    innerWidth,
    innerHeight,
    0.12,
    { inked: false, lamp: true },
  );
  addLocalBox(
    builder,
    WINDOW_FRAME,
    localX,
    innerBottom + innerHeight * 0.43,
    localZ - 0.24,
    0.12,
    innerHeight * 0.76,
    0.08,
    false,
  );
  const mullions = options.mullionCount ?? 1;
  for (let index = 1; index < mullions; index += 1) {
    const x = localX - innerWidth / 2 + (innerWidth * index) / mullions;
    addLocalBox(
      builder,
      WINDOW_FRAME,
      x,
      innerBottom + innerHeight * 0.39,
      localZ - 0.24,
      0.08,
      innerHeight * 0.68,
      0.08,
      false,
    );
  }
  if (options.transom ?? true) {
    const radius = innerWidth / 2;
    const springY = innerBottom + innerHeight - radius;
    addLocalBox(
      builder,
      WINDOW_FRAME,
      localX,
      springY,
      localZ - 0.24,
      innerWidth,
      0.1,
      0.08,
      false,
    );
  }
  addLocalBox(
    builder,
    PROFILE_STONE,
    localX,
    bottomY - 0.1,
    localZ - 0.04,
    width + 0.5,
    0.2,
    0.62,
    true,
  );
}

function addWingPediment(
  builder: Builder,
  localX: number,
  bottomY: number,
): void {
  const width = 3.1;
  const rise = 0.72;
  addTrianglePanel(
    builder,
    PROFILE_STONE,
    localX,
    width,
    bottomY,
    rise,
    -0.47,
    0.2,
  );
  const slopeLength = Math.hypot(width / 2, rise);
  const slopeAngle = Math.atan2(rise, width / 2);
  for (const side of [-1, 1]) {
    addLocalSlopedBox(
      builder,
      PROFILE_STONE,
      localX + side * width * 0.25,
      bottomY + rise * 0.5,
      -0.59,
      slopeLength,
      0.17,
      0.28,
      -side * slopeAngle,
    );
  }
}

function addRustication(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  const courseBottom = groundY + 2.15;
  const courseTop = groundY + 7.38;
  const courseCount = detailProfile === "full" ? 10 : 6;
  const courseHeight = (courseTop - courseBottom) / courseCount;
  for (let course = 1; course < courseCount; course += 1) {
    addLocalBox(
      builder,
      STONE_SHADOW,
      0,
      courseBottom + course * courseHeight,
      -0.32,
      FACADE_LENGTH_M - 0.8,
      0.055,
      0.11,
      false,
    );
  }
  if (detailProfile === "mobile") return;
  const jointPitch = BAY_PITCH_M / 2;
  for (let course = 0; course < courseCount; course += 1) {
    const offset = course % 2 === 0 ? 0 : jointPitch / 2;
    for (
      let localX = -FACADE_LENGTH_M / 2 + offset;
      localX <= FACADE_LENGTH_M / 2;
      localX += jointPitch
    ) {
      if (
        Math.abs(localX - PORTAL_CENTER_LOCAL_X_M) < 4.9 &&
        course < 8
      ) {
        continue;
      }
      addLocalBox(
        builder,
        STONE_SHADOW,
        localX,
        courseBottom + (course + 0.5) * courseHeight,
        -0.335,
        0.055,
        courseHeight - 0.11,
        0.1,
        false,
      );
    }
  }
}

function addBasementBand(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  addLocalBox(
    builder,
    GRANITE,
    0,
    groundY + 0.36,
    -0.19,
    FACADE_LENGTH_M,
    0.72,
    0.36,
  );
  addLocalBox(
    builder,
    PROFILE_STONE,
    0,
    groundY + 1.72,
    -0.3,
    FACADE_LENGTH_M - 0.8,
    0.68,
    0.28,
  );
  const visibleBays =
    detailProfile === "full"
      ? BAY_CENTRES_M
      : BAY_CENTRES_M.filter((_, index) => index % 2 === 0 || index === 5);
  for (const localX of visibleBays) {
    if (Math.abs(localX) < 0.1) continue;
    addLocalBox(
      builder,
      WINDOW_FRAME,
      localX,
      groundY + 0.98,
      -0.43,
      2.0,
      1.05,
      0.12,
      false,
      true,
    );
    for (const side of [-1, 1]) {
      addLocalSlopedBox(
        builder,
        DARK_METAL,
        localX,
        groundY + 0.98,
        -0.52,
        2.45,
        0.07,
        0.07,
        side * 0.42,
      );
    }
    addLocalRing(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 1.78,
      -0.52,
      0.28,
      0.075,
      detailProfile === "full" ? 14 : 10,
    );
  }
}

function addWingWindows(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  const wingCentres = BAY_CENTRES_M.filter(
    (localX) => Math.abs(localX) > BAY_PITCH_M * 1.45,
  );
  for (const localX of wingCentres) {
    addFramedArchWindow(builder, {
      bottomY: groundY + 2.47,
      frame: 0.28,
      height: 4.45,
      localX,
      localZ: -0.43,
      width: 2.45,
    });
    addFramedArchWindow(builder, {
      bottomY: groundY + 7.76,
      frame: 0.25,
      height: 4.15,
      localX,
      localZ: -0.42,
      width: 2.25,
    });
    addWingPediment(builder, localX, groundY + 12.04);
    for (const side of [-1, 1]) {
      addFramedArchWindow(builder, {
        bottomY: groundY + 12.8,
        frame: 0.18,
        height: 2.38,
        localX: localX + side * 0.56,
        localZ: -0.42,
        transom: false,
        width: 0.94,
      });
    }
    addLocalCylinder(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 13.91,
      -0.71,
      0.1,
      2.18,
      detailProfile === "full" ? 10 : 6,
      false,
    );
  }
}

function addCentralArcade(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  const centralCentres = [-BAY_PITCH_M, 0, BAY_PITCH_M] as const;
  for (const localX of centralCentres) {
    addArchedLayer(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 7.04,
      -0.89,
      4.1,
      8.34,
      0.22,
    );
    addArchedLayer(
      builder,
      STONE_SHADOW,
      localX,
      groundY + 7.31,
      -1.04,
      3.7,
      7.82,
      0.14,
      { inked: false },
    );
    for (const side of [-1, 1]) {
      addFramedArchWindow(builder, {
        bottomY: groundY + 7.48,
        frame: 0.17,
        height: 4.88,
        localX: localX + side * 0.76,
        localZ: -1.16,
        transom: true,
        width: 1.24,
      });
    }
    addLocalCylinder(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 9.82,
      -1.4,
      0.13,
      4.55,
      detailProfile === "full" ? 12 : 8,
      false,
    );
    addLocalDisc(
      builder,
      WINDOW_GLASS,
      localX,
      groundY + 14.04,
      -1.18,
      1.25,
      detailProfile === "full" ? 24 : 14,
      true,
    );
    addLocalRing(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 14.04,
      -1.3,
      1.47,
      0.18,
      detailProfile === "full" ? 28 : 16,
    );
    addLocalRing(
      builder,
      STONE_SHADOW,
      localX,
      groundY + 14.04,
      -1.34,
      1.17,
      0.08,
      detailProfile === "full" ? 24 : 14,
    );
    addLocalBox(
      builder,
      WINDOW_FRAME,
      localX,
      groundY + 14.04,
      -1.42,
      2.48,
      0.1,
      0.07,
      false,
    );
    addLocalBox(
      builder,
      WINDOW_FRAME,
      localX,
      groundY + 14.04,
      -1.42,
      0.1,
      2.48,
      0.07,
      false,
    );
  }

  const columnCentres = [
    -BAY_PITCH_M * 1.55,
    -BAY_PITCH_M * 0.5,
    BAY_PITCH_M * 0.5,
    BAY_PITCH_M * 1.55,
  ];
  for (const localX of columnCentres) {
    addLocalCylinder(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 11.12,
      -1.42,
      0.33,
      7.55,
      detailProfile === "full" ? 14 : 8,
    );
    addLocalCylinder(
      builder,
      STONE_SHADOW,
      localX,
      groundY + 7.22,
      -1.42,
      0.46,
      0.35,
      detailProfile === "full" ? 14 : 8,
      false,
    );
    addLocalBox(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 14.95,
      -1.42,
      0.92,
      0.42,
      0.72,
    );
    if (detailProfile === "full") {
      for (const groove of [-0.18, 0, 0.18]) {
        addLocalBox(
          builder,
          STONE_SHADOW,
          localX + groove,
          groundY + 11.08,
          -1.82,
          0.035,
          6.88,
          0.035,
          false,
        );
      }
    }
  }
}

const NUMBER_GLYPHS = {
  "2": ["111", "001", "111", "100", "111"],
  "5": ["111", "100", "111", "001", "111"],
} as const;

function addPortalNumber(builder: Builder, groundY: number): void {
  const pixel = 0.16;
  const text = "52";
  const totalWidth = 7 * pixel;
  for (let glyphIndex = 0; glyphIndex < text.length; glyphIndex += 1) {
    const glyph = NUMBER_GLYPHS[text[glyphIndex] as "5" | "2"];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        addLocalBox(
          builder,
          DARK_METAL,
          -totalWidth / 2 + (glyphIndex * 4 + column + 0.5) * pixel,
          groundY + 5.83 + (4 - row) * pixel,
          -2.26,
          pixel * 0.78,
          pixel * 0.78,
          0.07,
          false,
        );
      }
    }
  }
}

function addPortalOrnaments(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  for (const side of [-1, 1]) {
    const localX = side * 3.32;
    addLocalBox(
      builder,
      PROFILE_STONE,
      localX,
      groundY + 6.35,
      -1.75,
      1.22,
      1.7,
      0.3,
    );
    addLocalRing(
      builder,
      STONE_SHADOW,
      localX,
      groundY + 6.45,
      -1.96,
      0.32,
      0.08,
      detailProfile === "full" ? 14 : 8,
    );
    if (detailProfile === "full") {
      for (const leaf of [-0.42, 0.42]) {
        addLocalEllipsoid(
          builder,
          STONE_SHADOW,
          localX + leaf * 0.6,
          groundY + 6.45 + leaf,
          -1.98,
          [0.13, 0.42, 0.08],
          6,
        );
      }
    }
    for (const y of [groundY + 5.1, groundY + 5.75]) {
      addLocalRing(
        builder,
        STONE_SHADOW,
        side * (2.18 + (y - groundY - 5.1) * 1.7),
        y,
        -2.0,
        0.16,
        0.05,
        8,
      );
    }
  }
}

function addMainPortal(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  addArchedLayer(
    builder,
    PROFILE_STONE,
    0,
    groundY + 0.82,
    -1.57,
    6.2,
    6.8,
    0.42,
  );
  addArchedLayer(
    builder,
    STONE_SHADOW,
    0,
    groundY + 1.15,
    -1.83,
    5.2,
    6.14,
    0.2,
    { inked: false },
  );
  addArchedLayer(
    builder,
    DARK_WOOD,
    0,
    groundY + 1.45,
    -2.02,
    4.28,
    5.62,
    0.16,
    { inked: false },
  );
  addLocalBox(builder, DARK_WOOD, 0, groundY + 3.15, -2.18, 4.16, 3.95, 0.18);
  addLocalBox(
    builder,
    WINDOW_FRAME,
    0,
    groundY + 3.2,
    -2.3,
    0.12,
    3.82,
    0.08,
    false,
  );
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      0x5f5044,
      side * 1.02,
      groundY + 3.35,
      -2.29,
      1.42,
      2.42,
      0.08,
      false,
    );
    addLocalBox(
      builder,
      BRASS,
      side * 1.02,
      groundY + 3.35,
      -2.35,
      detailProfile === "full" ? 0.65 : 0.9,
      1.85,
      0.05,
      false,
      true,
    );
    if (detailProfile === "full") {
      for (let bar = -2; bar <= 2; bar += 1) {
        addLocalBox(
          builder,
          DARK_METAL,
          side * 1.02 + bar * 0.13,
          groundY + 3.35,
          -2.4,
          0.035,
          1.86,
          0.04,
          false,
        );
      }
    }
  }
  addLocalDisc(
    builder,
    AMBER_TRANSOM,
    0,
    groundY + 5.47,
    -2.2,
    1.78,
    detailProfile === "full" ? 24 : 14,
    true,
  );
  // The lower half of the disc is hidden by the door; this dark strip makes
  // the surviving upper semicircle and its spring line explicit.
  addLocalBox(
    builder,
    DARK_WOOD,
    0,
    groundY + 4.55,
    -2.29,
    3.72,
    1.82,
    0.1,
    false,
  );
  addLocalBox(
    builder,
    WINDOW_FRAME,
    0,
    groundY + 5.47,
    -2.38,
    3.55,
    0.09,
    0.05,
    false,
  );
  addPortalNumber(builder, groundY);

  for (const side of [-1, 1]) {
    for (let block = 0; block < 7; block += 1) {
      addLocalBox(
        builder,
        block % 2 === 0 ? PROFILE_STONE : MAIN_STONE,
        side * 3.72,
        groundY + 1.16 + block * 0.72,
        -1.42,
        1.16,
        0.62,
        0.82,
      );
    }
    addLocalCylinder(
      builder,
      PROFILE_STONE,
      side * 2.7,
      groundY + 3.75,
      -2.17,
      0.34,
      4.68,
      detailProfile === "full" ? 14 : 8,
    );
    addLocalBox(
      builder,
      PROFILE_STONE,
      side * 2.7,
      groundY + 6.16,
      -2.17,
      0.98,
      0.44,
      0.82,
    );
  }
  addPortalOrnaments(builder, detailProfile, groundY);

  addLocalBox(builder, PROFILE_STONE, 0, groundY + 7.48, -1.6, 9.8, 0.7, 1.05);
  const portalDentils = detailProfile === "full" ? 13 : 7;
  for (let index = 0; index < portalDentils; index += 1) {
    addLocalBox(
      builder,
      STONE_SHADOW,
      -4.2 + (8.4 * index) / (portalDentils - 1),
      groundY + 7.12,
      -2.13,
      0.34,
      0.3,
      0.42,
      false,
    );
  }

  for (let step = 0; step < SOCIAL_COURT_PROFILE.portal.stepCount; step += 1) {
    const t = step / (SOCIAL_COURT_PROFILE.portal.stepCount - 1);
    addLocalBox(
      builder,
      GRANITE,
      0,
      groundY + 0.09 + step * 0.16,
      -3.0 + step * 0.4,
      7.4 - t * 1.6,
      0.18,
      0.72,
      true,
    );
  }
  for (const side of [-1, 1]) {
    addLocalBeam(
      builder,
      DARK_METAL,
      [side * 2.45, groundY + 0.4, -3.05],
      [side * 2.2, groundY + 1.72, -1.05],
      0.06,
      7,
    );
    addLocalBeam(
      builder,
      DARK_METAL,
      [side * 2.45, groundY + 0.22, -3.05],
      [side * 2.45, groundY + 0.96, -3.05],
      0.055,
      7,
    );
  }
}

function addFacadeCourses(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  for (const [height, thickness, depth, color] of [
    [groundY + 2.08, 0.32, 0.52, PROFILE_STONE],
    [groundY + 7.45, 0.46, 0.68, PROFILE_STONE],
    [groundY + 12.35, 0.3, 0.5, PROFILE_STONE],
    [groundY + 15.65, 0.28, 0.48, STONE_SHADOW],
    [groundY + 16.45, 0.58, 0.86, PROFILE_STONE],
    [groundY + 16.92, 0.35, 1.05, PROFILE_STONE],
  ] as const) {
    addLocalBox(
      builder,
      color,
      0,
      height,
      -0.31,
      FACADE_LENGTH_M + (height > groundY + 16 ? 0.9 : 0),
      thickness,
      depth,
    );
  }
  const dentilCount = detailProfile === "full" ? 85 : 43;
  for (let index = 0; index < dentilCount; index += 1) {
    addLocalBox(
      builder,
      STONE_SHADOW,
      -FACADE_LENGTH_M / 2 +
        0.55 +
        ((FACADE_LENGTH_M - 1.1) * index) / (dentilCount - 1),
      groundY + 16.17,
      -0.84,
      detailProfile === "full" ? 0.48 : 0.72,
      0.28,
      0.42,
      false,
    );
  }
  for (const corner of [-1, 1]) {
    for (let block = 0; block < 11; block += 1) {
      addLocalBox(
        builder,
        block % 2 === 0 ? PROFILE_STONE : MAIN_STONE,
        corner * (FACADE_LENGTH_M / 2 - 0.62),
        groundY + 2.38 + block * 1.26,
        -0.55,
        1.25,
        0.94,
        0.72,
        false,
      );
    }
  }
}

function addRoofSculptures(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  const segmentCount = detailProfile === "full" ? 8 : 6;
  // Central allegorical group: a dominant draped figure with two seated
  // attendants. The photographs are not sufficient to claim identities, so
  // these remain deliberately compact graphite silhouettes.
  addLocalBox(builder, DARK_METAL, 0, groundY + 19.9, -0.15, 6.5, 0.55, 1.7);
  addLocalCylinder(
    builder,
    DARK_METAL,
    0,
    groundY + 21.1,
    -0.28,
    0.5,
    2.05,
    segmentCount,
    false,
  );
  addLocalEllipsoid(
    builder,
    DARK_METAL,
    0,
    groundY + 22.35,
    -0.28,
    [0.43, 0.5, 0.43],
    segmentCount,
  );
  for (const side of [-1, 1]) {
    addLocalEllipsoid(
      builder,
      DARK_METAL,
      side * 1.55,
      groundY + 20.72,
      -0.22,
      [0.78, 1.0, 0.58],
      segmentCount,
    );
    addLocalEllipsoid(
      builder,
      DARK_METAL,
      side * 1.75,
      groundY + 21.72,
      -0.2,
      [0.36, 0.4, 0.35],
      segmentCount,
    );
    addLocalBeam(
      builder,
      DARK_METAL,
      [side * 0.35, groundY + 21.42, -0.26],
      [side * 1.55, groundY + 20.9, -0.22],
      0.12,
      6,
    );
  }

  // Shoulder groups read as reclining lion/figure silhouettes without an
  // unsupported claim about the individual sculpture subjects.
  for (const side of [-1, 1]) {
    const x = side * SOCIAL_COURT_PROFILE.facade.risalitWidthM * 0.414;
    addLocalBox(
      builder,
      DARK_METAL,
      x,
      groundY + 17.72,
      -0.08,
      4.7,
      0.45,
      1.65,
    );
    addLocalEllipsoid(
      builder,
      DARK_METAL,
      x + side * 0.25,
      groundY + 18.55,
      -0.12,
      [1.45, 0.62, 0.58],
      segmentCount,
    );
    addLocalEllipsoid(
      builder,
      DARK_METAL,
      x - side * 1.2,
      groundY + 18.88,
      -0.12,
      [0.48, 0.52, 0.44],
      segmentCount,
    );
    if (detailProfile === "full") {
      addLocalBeam(
        builder,
        DARK_METAL,
        [x + side * 0.55, groundY + 18.7, -0.12],
        [x + side * 1.75, groundY + 18.28, -0.12],
        0.11,
        6,
      );
    }
  }

  // The reference photographs consistently show a bare mast.
  addLocalCylinder(
    builder,
    DARK_METAL,
    0,
    groundY + 25.0,
    0.04,
    0.075,
    6.4,
    8,
    false,
  );
}

function addPedimentAndRoof(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  addLocalBox(
    builder,
    ROOF_GREEN,
    0,
    groundY + 17.12,
    0.22,
    FACADE_LENGTH_M - 2,
    0.32,
    2.0,
    false,
  );
  const width = SOCIAL_COURT_PROFILE.facade.risalitWidthM;
  const rise = 2.7;
  addTrianglePanel(
    builder,
    MAIN_STONE,
    RISALIT_CENTER_LOCAL_X_M,
    width,
    groundY + 16.92,
    rise,
    -0.58,
    0.68,
  );
  addLocalBox(
    builder,
    PROFILE_STONE,
    RISALIT_CENTER_LOCAL_X_M,
    groundY + 16.92,
    -0.94,
    width + 1.1,
    0.42,
    0.82,
  );
  const slopeLength = Math.hypot(width / 2, rise);
  const slopeAngle = Math.atan2(rise, width / 2);
  for (const side of [-1, 1]) {
    addLocalSlopedBox(
      builder,
      PROFILE_STONE,
      RISALIT_CENTER_LOCAL_X_M + side * width * 0.25,
      groundY + 16.92 + rise / 2,
      -0.96,
      slopeLength,
      0.32,
      0.55,
      -side * slopeAngle,
    );
  }
  addWithLocalXOffset(builder, RISALIT_CENTER_LOCAL_X_M, (shifted) => {
    addRoofSculptures(shifted, detailProfile, groundY);
  });
}

function addFacade(
  builder: Builder,
  detailProfile: SocialCourtDetailProfile,
  groundY: number,
): void {
  // A shallow, source-aligned skin supplies the warm sandstone colour while
  // leaving the complete LoD2 footprint, depth and collision mass untouched.
  addLocalBox(
    builder,
    MAIN_STONE,
    0,
    groundY + LOD2_HEIGHT_M / 2,
    0,
    FACADE_LENGTH_M - 0.25,
    LOD2_HEIGHT_M,
    0.3,
  );
  addLocalBox(
    builder,
    MAIN_STONE,
    RISALIT_CENTER_LOCAL_X_M,
    groundY + LOD2_HEIGHT_M / 2,
    -0.38,
    SOCIAL_COURT_PROFILE.facade.risalitWidthM,
    LOD2_HEIGHT_M,
    SOCIAL_COURT_PROFILE.facade.risalitDepthM,
  );
  addRustication(builder, detailProfile, groundY);
  addBasementBand(builder, detailProfile, groundY);
  addWingWindows(builder, detailProfile, groundY);

  // The two ground-floor windows beside the portal belong to the three-axis
  // risalit; the middle opening itself is Portal 52.
  for (const localX of [
    RISALIT_CENTER_LOCAL_X_M - BAY_PITCH_M,
    RISALIT_CENTER_LOCAL_X_M + BAY_PITCH_M,
  ]) {
    addFramedArchWindow(builder, {
      bottomY: groundY + 2.47,
      frame: 0.3,
      height: 4.45,
      localX,
      localZ: -0.86,
      width: 2.45,
    });
  }
  addWithLocalXOffset(builder, RISALIT_CENTER_LOCAL_X_M, (shifted) => {
    addCentralArcade(shifted, detailProfile, groundY);
  });
  addWithLocalXOffset(builder, PORTAL_CENTER_LOCAL_X_M, (shifted) => {
    addMainPortal(shifted, detailProfile, groundY);
  });
  addFacadeCourses(builder, detailProfile, groundY);
  addPedimentAndRoof(builder, detailProfile, groundY);
}

export function createSocialCourtDetails(
  detailProfile: SocialCourtDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = SOCIAL_COURT_ROOT_NAME;
  root.userData = {
    addressNumber: SOCIAL_COURT_PROFILE.portal.addressNumber,
    detailProfile,
    facadeAxisCount: SOCIAL_COURT_PROFILE.facade.axisCount,
    geometryStatus: SOCIAL_COURT_PROFILE.geometryStatus,
    keepInMinecraft: false,
    objectProfile: SOCIAL_COURT_PROFILE,
    performanceBudget: SOCIAL_COURT_RENDER_BUDGET[detailProfile],
    photoReferenceCount: SOCIAL_COURT_PROFILE.photoReferenceCount,
    runtimeAssets: SOCIAL_COURT_PROFILE.runtimeAssets,
    sourceBound: true,
    sourceUrls: SOCIAL_COURT_PROFILE.sourceUrls,
    textureFree: true,
  };
  const builder = createBuilder();
  addFacade(builder, detailProfile, SOCIAL_COURT_PROFILE.groundY);
  const batch = finishDrawnGroup(builder, {
    lampEmissive: 0xffc980,
    lampEmissiveIntensity: 0.28,
    name: SOCIAL_COURT_BATCH_NAME,
  });
  if (batch) root.add(batch);
  return root;
}

export type SocialCourtRenderStats = {
  renderables: number;
  vertices: number;
};

export function socialCourtRenderStats(
  root: Object3D<Object3DEventMap>,
): SocialCourtRenderStats {
  let renderables = 0;
  let vertices = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !object.type.includes("Line")) return;
    const geometry = (object as Mesh).geometry;
    if (!geometry) return;
    renderables += 1;
    vertices += geometry.getAttribute("position")?.count ?? 0;
  });
  return { renderables, vertices };
}

/** Local-to-world helper shared by the block-native Minecraft reading. */
export function socialCourtFacadeWorldAt(
  localX: number,
  localZ: number,
): readonly [number, number] {
  return worldAt(localX, localZ);
}

/** Rotation matrix exported for deterministic geometry QA. */
export const SOCIAL_COURT_FACADE_MATRIX = new Matrix4().makeRotationY(
  FACADE_ROTATION_Y,
);
