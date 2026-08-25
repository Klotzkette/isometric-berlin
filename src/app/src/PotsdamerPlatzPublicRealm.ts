import { Group } from "three";

import {
  addBox,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
} from "./drawnKit";

type Point3 = readonly [number, number, number];

const ALTE_POTSDAMER_LIGHT_PAIRS = [
  [
    [270.7, 5.389, 1105.32],
    [263.33, 5.375, 1092.69],
  ],
  [
    [256.95, 5.181, 1114.07],
    [246.9, 5.142, 1102.99],
  ],
  [
    [245.04, 4.94, 1121.12],
    [236.16, 4.962, 1110.74],
  ],
  [
    [235.4, 4.95, 1128.53],
    [227.26, 4.96, 1117.81],
  ],
  [
    [223.17, 4.961, 1138.06],
    [213.92, 4.812, 1128.04],
  ],
  [
    [207.61, 4.819, 1149.34],
    [199.16, 4.959, 1136.8],
  ],
  [
    [191.75, 4.815, 1158.43],
    [184.68, 4.842, 1148.82],
  ],
  [
    [178.02, 4.785, 1169.75],
    [169.87, 4.796, 1159.39],
  ],
  [
    [159.13, 4.705, 1182.5],
    [151.79, 4.758, 1172.34],
  ],
  [
    [144.31, 4.614, 1194.78],
    [135.11, 4.676, 1182.59],
  ],
  [
    [126.16, 4.676, 1208.18],
    [117.72, 4.698, 1194.91],
  ],
  [
    [110.99, 4.648, 1218.74],
    [102.13, 4.678, 1207.64],
  ],
  [
    [90.63, 4.679, 1233.18],
    [81.43, 4.644, 1221.34],
  ],
  [
    [79.51, 4.674, 1241.65],
    [70.32, 4.584, 1229.11],
  ],
] as const satisfies readonly (readonly [Point3, Point3])[];

const CORRIDOR_CENTRES = ALTE_POTSDAMER_LIGHT_PAIRS.map(
  ([left, right]) =>
    [
      (left[0] + right[0]) / 2,
      (left[1] + right[1]) / 2,
      (left[2] + right[2]) / 2,
    ] as const,
);

export const POTSDAMER_PUBLIC_REALM_PROFILE = {
  name: "Potsdamer Platz public realm",
  officialLightIds: [
    92334, 92335, 92336, 92337, 92338, 92339, 92340, 92341, 92342, 92343, 92344,
    92345, 92346, 92347, 92348, 92349, 92350, 92351, 92352, 92353, 92354, 92355,
    92356, 92357, 92358, 92359, 92360, 92361,
  ] as const,
  corridorCentreWorldM: CORRIDOR_CENTRES,
  corridorWidthM: 11.8,
  corridorSegmentCount: CORRIDOR_CENTRES.length - 1,
  trafficTowerWorldM: [302.391, 5.4, 1081.736] as const,
  geometryStatus:
    "paired official Berlin light positions anchor the current pedestrian corridor; paving bands, movable seating, planters, bollards and bicycle racks are bounded presentation detail rather than a fixture survey; official lamps are rendered by the shared light layer and are not duplicated",
  sourceUrls: [
    "https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/planung-entwurf-neubau/quartier-am-potsdamer-platz-1135231.php",
    "https://gdi.berlin.de/services/wfs/beleuchtung",
    "https://www.openstreetmap.org/way/15196055",
  ] as const,
} as const;

export const POTSDAMER_PUBLIC_REALM_RENDER_BUDGET = {
  maximumDrawables: 3,
  maximumVertices: 12_000,
} as const;

const PAVING_LIGHT = 0xc7c3b9;
const PAVING_DARK = 0x8b8b86;
const GRANITE = 0x777a77;
const FURNITURE = 0x343a3a;
const TIMBER = 0x8b6548;
const PLANTER = 0x676a64;
const PLANTING = 0x5d814e;

function segmentFrame(start: Point3, end: Point3) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dz) || 1;
  const ax = dx / length;
  const az = dz / length;
  return {
    ax,
    az,
    length,
    nx: -az,
    nz: ax,
    rotationY: -Math.atan2(dz, dx),
  };
}

function addCorridorPaving(builder: ReturnType<typeof createBuilder>): void {
  for (let index = 0; index < CORRIDOR_CENTRES.length - 1; index += 1) {
    const start = CORRIDOR_CENTRES[index];
    const end = CORRIDOR_CENTRES[index + 1];
    const frame = segmentFrame(start, end);
    const cx = (start[0] + end[0]) / 2;
    const cy = (start[1] + end[1]) / 2 + 0.055;
    const cz = (start[2] + end[2]) / 2;
    addBox(
      builder,
      index % 2 === 0 ? PAVING_LIGHT : 0xb9b7af,
      cx,
      cy,
      cz,
      frame.length + 0.18,
      0.09,
      POTSDAMER_PUBLIC_REALM_PROFILE.corridorWidthM,
      frame.rotationY,
      false,
    );
    for (const side of [-1, 1]) {
      const offset =
        side * (POTSDAMER_PUBLIC_REALM_PROFILE.corridorWidthM / 2 - 0.2);
      addBox(
        builder,
        PAVING_DARK,
        cx + frame.nx * offset,
        cy + 0.025,
        cz + frame.nz * offset,
        frame.length + 0.2,
        0.07,
        0.24,
        frame.rotationY,
        false,
      );
    }
    if (index % 2 === 0) {
      addBox(
        builder,
        GRANITE,
        cx,
        cy + 0.035,
        cz,
        0.22,
        0.045,
        POTSDAMER_PUBLIC_REALM_PROFILE.corridorWidthM - 0.8,
        frame.rotationY,
        false,
      );
    }
  }
}

function addBench(
  builder: ReturnType<typeof createBuilder>,
  point: Point3,
  side: -1 | 1,
  next: Point3,
): void {
  const frame = segmentFrame(point, next);
  const offset = side * 4.55;
  const x = point[0] + frame.nx * offset;
  const z = point[2] + frame.nz * offset;
  addBox(
    builder,
    TIMBER,
    x,
    point[1] + 0.5,
    z,
    2.25,
    0.12,
    0.58,
    frame.rotationY,
  );
  addBox(
    builder,
    TIMBER,
    x - frame.nx * side * 0.24,
    point[1] + 0.91,
    z - frame.nz * side * 0.24,
    2.25,
    0.72,
    0.11,
    frame.rotationY,
  );
  for (const along of [-0.72, 0.72]) {
    addBox(
      builder,
      FURNITURE,
      x + frame.ax * along,
      point[1] + 0.25,
      z + frame.az * along,
      0.1,
      0.5,
      0.42,
      frame.rotationY,
      false,
    );
  }
}

function addStreetFurniture(
  builder: ReturnType<typeof createBuilder>,
  mobile: boolean,
): void {
  const stride = mobile ? 4 : 2;
  for (let index = 1; index < CORRIDOR_CENTRES.length - 1; index += stride) {
    const point = CORRIDOR_CENTRES[index];
    const next = CORRIDOR_CENTRES[index + 1];
    const side = index % 2 === 0 ? -1 : 1;
    addBench(builder, point, side, next);
    const frame = segmentFrame(point, next);
    const planterSide = -side;
    const planterX = point[0] + frame.nx * planterSide * 4.65;
    const planterZ = point[2] + frame.nz * planterSide * 4.65;
    addBox(
      builder,
      PLANTER,
      planterX,
      point[1] + 0.27,
      planterZ,
      1.65,
      0.48,
      1.65,
      frame.rotationY,
    );
    addBox(
      builder,
      PLANTING,
      planterX,
      point[1] + 0.53,
      planterZ,
      1.32,
      0.08,
      1.32,
      frame.rotationY,
      false,
    );
  }

  const rackIndices = mobile ? [3, 9] : [2, 5, 8, 11];
  for (const index of rackIndices) {
    const point = CORRIDOR_CENTRES[index];
    const next = CORRIDOR_CENTRES[index + 1];
    const frame = segmentFrame(point, next);
    for (let rack = -1; rack <= 1; rack += 1) {
      const along = rack * 0.72;
      const x = point[0] + frame.ax * along + frame.nx * 4.38;
      const z = point[2] + frame.az * along + frame.nz * 4.38;
      addBox(
        builder,
        FURNITURE,
        x,
        point[1] + 0.34,
        z,
        0.08,
        0.68,
        0.08,
        0,
        false,
      );
      addBox(
        builder,
        FURNITURE,
        x - frame.nx * 0.34,
        point[1] + 0.66,
        z - frame.nz * 0.34,
        0.08,
        0.08,
        0.68,
        frame.rotationY,
        false,
      );
      addBox(
        builder,
        FURNITURE,
        x - frame.nx * 0.68,
        point[1] + 0.34,
        z - frame.nz * 0.68,
        0.08,
        0.68,
        0.08,
        0,
        false,
      );
    }
  }

  for (const index of [0, CORRIDOR_CENTRES.length - 1]) {
    const point = CORRIDOR_CENTRES[index];
    const neighbour = CORRIDOR_CENTRES[index === 0 ? 1 : index - 1];
    const frame = segmentFrame(point, neighbour);
    for (const lateral of [-4.2, -2.1, 0, 2.1, 4.2]) {
      addCylinder(
        builder,
        FURNITURE,
        point[0] + frame.nx * lateral,
        point[1] + 0.39,
        point[2] + frame.nz * lateral,
        0.13,
        0.78,
        8,
      );
    }
  }
}

function addTrafficTowerPaving(
  builder: ReturnType<typeof createBuilder>,
): void {
  const [x, y, z] = POTSDAMER_PUBLIC_REALM_PROFILE.trafficTowerWorldM;
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const angle = (spoke / 8) * Math.PI;
    addBox(builder, GRANITE, x, y + 0.095, z, 20.5, 0.035, 0.24, angle, false);
  }
  for (const [dx, dz] of [
    [-8.8, -8.8],
    [8.8, -8.8],
    [-8.8, 8.8],
    [8.8, 8.8],
  ] as const) {
    addBox(builder, GRANITE, x + dx, y + 0.28, z + dz, 2.2, 0.48, 0.68);
  }
}

export function createPotsdamerPlatzPublicRealm(
  detailProfile: "full" | "mobile" = "full",
): Group {
  const root = new Group();
  root.name = POTSDAMER_PUBLIC_REALM_PROFILE.name;
  root.userData = {
    ...POTSDAMER_PUBLIC_REALM_PROFILE,
    detailProfile,
    keepInMinecraft: true,
  };
  const builder = createBuilder();
  addCorridorPaving(builder);
  addStreetFurniture(builder, detailProfile === "mobile");
  addTrafficTowerPaving(builder);
  const details = finishDrawnGroup(builder, {
    name: POTSDAMER_PUBLIC_REALM_PROFILE.name,
  });
  if (details) root.add(details);
  return root;
}
