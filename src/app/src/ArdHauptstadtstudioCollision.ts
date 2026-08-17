import { ARD_HAUPTSTADTSTUDIO_MAIN_ID } from "./ArdHauptstadtstudio";
import type { PrismPayload } from "./IsometricCityWorld";

type WorldPoint3 = readonly [number, number, number];

export type ArdRoofEquipmentSolid =
  | {
      centerWorldM: WorldPoint3;
      id: string;
      kind: "box";
      rotationY: number;
      sizeM: WorldPoint3;
    }
  | {
      centerWorldM: WorldPoint3;
      halfDepthM: number;
      id: string;
      kind: "dish";
      radiusM: number;
      rotationX: number;
      rotationY: number;
    }
  | {
      centerWorldM: WorldPoint3;
      halfHeightM: number;
      id: string;
      kind: "vertical-cylinder";
      radiusM: number;
    };

export type ArdRoofEquipmentCollisionIndex = {
  displayApproximation: true;
  geometryStatus: string;
  roofYM: number;
  solidAt: (x: number, y: number, z: number, radiusM?: number) => boolean;
  solids: ReadonlyArray<ArdRoofEquipmentSolid>;
  sourcePrismId: typeof ARD_HAUPTSTADTSTUDIO_MAIN_ID;
};

export const ARD_HAUPTSTADTSTUDIO_ROOF_COLLISION_PROFILE = {
  displayApproximation: true,
  geometryStatus:
    "conservative analytic Schwellenraum solids matched to the visible photo-bounded roof-equipment approximations; not surveyed dimensions or positions",
  sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
} as const;

type RelativeBox = {
  centerXM: number;
  centerYOffsetM: number;
  centerZM: number;
  id: string;
  rotationY: number;
  sizeM: WorldPoint3;
};

type RelativeDish = {
  azimuth: number;
  baseYOffsetM: number;
  diameterM: number;
  id: string;
  tilt: number;
  xM: number;
  zM: number;
};

const SCREEN_ROTATION_Y = -0.18;

const BASE_BOXES: ReadonlyArray<RelativeBox> = [
  {
    centerXM: 650.2,
    centerYOffsetM: 0.72,
    centerZM: 17.25,
    id: "ard-roof-technical-screen",
    rotationY: SCREEN_ROTATION_Y,
    sizeM: [7.6, 1.35, 0.18],
  },
  {
    centerXM: 660,
    centerYOffsetM: 0.58,
    centerZM: 15,
    id: "ard-roof-technical-box",
    rotationY: -0.09,
    sizeM: [2.25, 1.12, 1.55],
  },
] as const;

const DISHES: ReadonlyArray<RelativeDish> = [
  {
    azimuth: -0.55,
    baseYOffsetM: 0.05,
    diameterM: 3.8,
    id: "ard-roof-dish-large",
    tilt: 0.9,
    xM: 621.5,
    zM: 24,
  },
  {
    azimuth: 0.35,
    baseYOffsetM: 0.05,
    diameterM: 1.35,
    id: "ard-roof-dish-west-small",
    tilt: 0.82,
    xM: 625.5,
    zM: 27.2,
  },
  {
    azimuth: -0.2,
    baseYOffsetM: 0.05,
    diameterM: 1.1,
    id: "ard-roof-dish-east-small",
    tilt: 0.84,
    xM: 638,
    zM: 19,
  },
] as const;

function resolvedBox(box: RelativeBox, roofYM: number): ArdRoofEquipmentSolid {
  return {
    centerWorldM: [box.centerXM, roofYM + box.centerYOffsetM, box.centerZM],
    id: box.id,
    kind: "box",
    rotationY: box.rotationY,
    sizeM: box.sizeM,
  };
}

function ventBoxes(roofYM: number): ArdRoofEquipmentSolid[] {
  const cosine = Math.cos(SCREEN_ROTATION_Y);
  const sine = Math.sin(SCREEN_ROTATION_Y);
  return Array.from({ length: 6 }, (_, vent) => {
    const localX = -2.85 + vent * 1.14;
    return resolvedBox(
      {
        centerXM: 650.2 + localX * cosine + 0.12 * sine,
        centerYOffsetM: 0.72,
        centerZM: 17.25 - localX * sine + 0.12 * cosine,
        id: `ard-roof-screen-vent-${vent + 1}`,
        rotationY: SCREEN_ROTATION_Y,
        sizeM: [0.72, 0.82, 0.055],
      },
      roofYM,
    );
  });
}

function dishSolids(
  dish: RelativeDish,
  roofYM: number,
): ArdRoofEquipmentSolid[] {
  const stemHeightM = Math.max(0.55, dish.diameterM * 0.34);
  const stemRadiusM = Math.max(0.07, dish.diameterM * 0.028);
  return [
    {
      centerWorldM: [
        dish.xM,
        roofYM + dish.baseYOffsetM + stemHeightM / 2,
        dish.zM,
      ],
      halfHeightM: stemHeightM / 2,
      id: `${dish.id}-stem`,
      kind: "vertical-cylinder",
      radiusM: stemRadiusM,
    },
    {
      centerWorldM: [
        dish.xM,
        roofYM + dish.baseYOffsetM + stemHeightM + dish.diameterM * 0.18,
        dish.zM,
      ],
      halfDepthM: 0.08,
      id: dish.id,
      kind: "dish",
      radiusM: dish.diameterM / 2,
      rotationX: dish.tilt,
      rotationY: dish.azimuth,
    },
  ];
}

function buildSolids(roofYM: number): ArdRoofEquipmentSolid[] {
  return [
    ...BASE_BOXES.map((box) => resolvedBox(box, roofYM)),
    ...ventBoxes(roofYM),
    ...DISHES.flatMap((dish) => dishSolids(dish, roofYM)),
    {
      centerWorldM: [628, roofYM + 3.6, 19.8],
      halfHeightM: 3.6,
      id: "ard-roof-mast",
      kind: "vertical-cylinder",
      radiusM: 0.1,
    },
    ...[4.7, 6.15].map((centerYOffsetM, index): ArdRoofEquipmentSolid => ({
      centerWorldM: [628, roofYM + centerYOffsetM, 19.8],
      id: `ard-roof-mast-crossbar-${index + 1}`,
      kind: "box",
      rotationY: 0,
      sizeM: [1.28, 0.07, 0.07],
    })),
  ];
}

function pointTouchesBox(
  x: number,
  y: number,
  z: number,
  solid: Extract<ArdRoofEquipmentSolid, { kind: "box" }>,
  padding: number,
): boolean {
  const dx = x - solid.centerWorldM[0];
  const dz = z - solid.centerWorldM[2];
  const cosine = Math.cos(solid.rotationY);
  const sine = Math.sin(solid.rotationY);
  const localX = cosine * dx - sine * dz;
  const localZ = sine * dx + cosine * dz;
  return (
    Math.abs(localX) <= solid.sizeM[0] / 2 + padding &&
    Math.abs(y - solid.centerWorldM[1]) <= solid.sizeM[1] / 2 + padding &&
    Math.abs(localZ) <= solid.sizeM[2] / 2 + padding
  );
}

function pointTouchesVerticalCylinder(
  x: number,
  y: number,
  z: number,
  solid: Extract<ArdRoofEquipmentSolid, { kind: "vertical-cylinder" }>,
  padding: number,
): boolean {
  return (
    Math.hypot(x - solid.centerWorldM[0], z - solid.centerWorldM[2]) <=
      solid.radiusM + padding &&
    Math.abs(y - solid.centerWorldM[1]) <= solid.halfHeightM + padding
  );
}

function pointTouchesDish(
  x: number,
  y: number,
  z: number,
  solid: Extract<ArdRoofEquipmentSolid, { kind: "dish" }>,
  padding: number,
): boolean {
  const dx = x - solid.centerWorldM[0];
  const dy = y - solid.centerWorldM[1];
  const dz = z - solid.centerWorldM[2];
  const azimuthCosine = Math.cos(solid.rotationY);
  const azimuthSine = Math.sin(solid.rotationY);
  const afterYawX = azimuthCosine * dx - azimuthSine * dz;
  const afterYawZ = azimuthSine * dx + azimuthCosine * dz;
  const tiltCosine = Math.cos(solid.rotationX);
  const tiltSine = Math.sin(solid.rotationX);
  const localY = tiltCosine * dy + tiltSine * afterYawZ;
  const localZ = -tiltSine * dy + tiltCosine * afterYawZ;
  return (
    Math.hypot(afterYawX, localZ) <= solid.radiusM + padding &&
    Math.abs(localY) <= solid.halfDepthM + padding
  );
}

function pointTouchesSolid(
  x: number,
  y: number,
  z: number,
  solid: ArdRoofEquipmentSolid,
  padding: number,
): boolean {
  if (solid.kind === "box") {
    return pointTouchesBox(x, y, z, solid, padding);
  }
  if (solid.kind === "dish") {
    return pointTouchesDish(x, y, z, solid, padding);
  }
  return pointTouchesVerticalCylinder(x, y, z, solid, padding);
}

/**
 * Build the mode-only collision contract from the retained LoD2 roof height.
 * Horizontal positions and equipment dimensions deliberately mirror the
 * visible photo-bounded display approximations; the official shell continues
 * to own the building and roof collision below them.
 */
export function createArdHauptstadtstudioRoofCollision(
  prisms: Pick<PrismPayload, "buildings">,
): ArdRoofEquipmentCollisionIndex | null {
  const main = prisms.buildings.find(
    (building) => building.id === ARD_HAUPTSTADTSTUDIO_MAIN_ID,
  );
  if (!main) return null;
  const roofYM = (main.y0_dm + main.h_dm) / 10;
  if (!Number.isFinite(roofYM)) return null;
  const solids = buildSolids(roofYM);
  return {
    ...ARD_HAUPTSTADTSTUDIO_ROOF_COLLISION_PROFILE,
    roofYM,
    solidAt: (x, y, z, radiusM = 0) => {
      if (![x, y, z, radiusM].every(Number.isFinite)) return false;
      const padding = Math.max(0, radiusM);
      return solids.some((solid) => pointTouchesSolid(x, y, z, solid, padding));
    },
    solids,
  };
}
