import { BUNDESTAG_SPREE_CONNECTION_PROFILE } from "./CentralCivicDetails";
import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  hauptbahnhofEastWestCurveAt,
} from "./MinecraftArchitecturalLandmarks";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { domeRadius } from "./ReichstagDome";
import {
  createSchwellenraumFlightScratch,
  resolveSchwellenraumFlightTranslation,
  type SchwellenraumFlightResult,
  type SchwellenraumFlightScratch,
  type SchwellenraumPoint,
} from "./schwellenraumNavigation";
import type { VisualMode } from "./visualMode";

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

type LocalFrame = {
  anchorWorld: Point3;
  rotationDegrees: number;
};

export type MinecraftHeroPortal = {
  centerLocalM: Point3;
  frame: LocalFrame;
  id: string;
  landmark: string;
  sizeM: Point3;
  sourceBuildingIds: ReadonlyArray<string>;
};

/** The Minecraft camera uses the same compact swept body as Schwellenraum. */
export const MINECRAFT_FLIGHT_RADIUS_M = 0.62;

const GATE_COLUMN_DIAMETER_M = 1.73;
const GATE_PASSAGE_WIDTHS_M = [3.8, 3.8, 5.65, 3.8, 3.8] as const;
const FALSE_BUNDESTAG_WALL_SOURCE_ID = "K0001zDa";
const NAVIGATION_EPSILON_M = 1e-6;

function gatePassageCentres(): number[] {
  const spacings = GATE_PASSAGE_WIDTHS_M.map(
    (width) => width + GATE_COLUMN_DIAMETER_M,
  );
  const axes = [-spacings.reduce((sum, spacing) => sum + spacing, 0) / 2];
  for (const spacing of spacings) {
    axes.push((axes.at(-1) ?? 0) + spacing);
  }
  return GATE_PASSAGE_WIDTHS_M.map(
    (_width, index) => (axes[index] + axes[index + 1]) / 2,
  );
}

const gate = MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate;
const station = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
const GATE_QUADRIGA_CENTER_LOCAL_M = [0, 23.5, 0] as const;
const GATE_QUADRIGA_SIZE_M = [8, 6.2, 14] as const;
const stationEastWestEntrance = station.entrances.eastWest;
const stationNorthSouthEntrance = station.entrances.northSouth;
const stationOfficeEntrance = station.officeEntrances;
const HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS = [
  ...station.sourcePrismIds,
  // These two long glass-roof LoD2 parts cross the public north-south axis.
  // They are not separate voxel ownership components, but they remain in the
  // metric pedestrian index and therefore belong to the portal allowlist.
  "iiRhAlr6",
  "5gArGdou",
  ...Object.values(station.portalCollisionSourcePrismIds),
] as const;
const HAUPTBAHNHOF_NAVIGATION_SOURCE_ID_SET = new Set<string>(
  HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS,
);

/**
 * Deliberately small public openings through otherwise authoritative solids.
 * The Reichstag and Chancellery have no Minecraft-only public interior: their
 * source footprints therefore remain closed. Station entries are specific to
 * Minecraft; the Gate records the same five real passages reused by every
 * visual mode's pedestrian access policy.
 */
export const BRANDENBURG_GATE_PUBLIC_PASSAGES: ReadonlyArray<MinecraftHeroPortal> =
  gatePassageCentres().map((centerZ, index): MinecraftHeroPortal => ({
    centerLocalM: [0, 6.15, centerZ],
    frame: gate,
    id: `brandenburg-gate-passage-${index + 1}`,
    landmark: "Brandenburger Tor",
    sizeM: [gate.depthM + 7, 12.8, GATE_PASSAGE_WIDTHS_M[index]],
    // The two pavilion parts stay closed; only the central gate mass may be
    // replaced by the five real passage voids.
    sourceBuildingIds: [gate.sourcePrismIds[0]],
  }));

export const MINECRAFT_HERO_PORTALS: ReadonlyArray<MinecraftHeroPortal> = [
  ...BRANDENBURG_GATE_PUBLIC_PASSAGES,
  {
    centerLocalM: [
      0,
      stationNorthSouthEntrance.clearHeightM / 2,
      -stationNorthSouthEntrance.endLocalZ,
    ],
    frame: station,
    id: "hauptbahnhof-europaplatz-portal",
    landmark: "Berlin Hauptbahnhof",
    sizeM: [
      stationNorthSouthEntrance.clearHalfWidthM * 2,
      stationNorthSouthEntrance.clearHeightM,
      18,
    ],
    sourceBuildingIds: HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS,
  },
  {
    centerLocalM: [
      0,
      stationNorthSouthEntrance.clearHeightM / 2,
      stationNorthSouthEntrance.endLocalZ,
    ],
    frame: station,
    id: "hauptbahnhof-washingtonplatz-portal",
    landmark: "Berlin Hauptbahnhof",
    sizeM: [
      stationNorthSouthEntrance.clearHalfWidthM * 2,
      stationNorthSouthEntrance.clearHeightM,
      18,
    ],
    sourceBuildingIds: HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS,
  },
  {
    centerLocalM: [
      -stationEastWestEntrance.endLocalX,
      stationEastWestEntrance.clearHeightM / 2,
      hauptbahnhofEastWestCurveAt(-stationEastWestEntrance.endLocalX),
    ],
    frame: station,
    id: "hauptbahnhof-west-hall-portal",
    landmark: "Berlin Hauptbahnhof",
    sizeM: [
      18,
      stationEastWestEntrance.clearHeightM,
      stationEastWestEntrance.clearHalfWidthM * 2,
    ],
    sourceBuildingIds: HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS,
  },
  {
    centerLocalM: [
      stationEastWestEntrance.endLocalX,
      stationEastWestEntrance.clearHeightM / 2,
      hauptbahnhofEastWestCurveAt(stationEastWestEntrance.endLocalX),
    ],
    frame: station,
    id: "hauptbahnhof-east-hall-portal",
    landmark: "Berlin Hauptbahnhof",
    sizeM: [
      18,
      stationEastWestEntrance.clearHeightM,
      stationEastWestEntrance.clearHalfWidthM * 2,
    ],
    sourceBuildingIds: HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS,
  },
  ...stationOfficeEntrance.bridgeCentresLocalX.flatMap((centerX) =>
    ([-1, 1] as const).map((endSide): MinecraftHeroPortal => ({
      centerLocalM: [
        centerX,
        stationOfficeEntrance.clearHeightM / 2,
        endSide * stationOfficeEntrance.endLocalZ,
      ],
      frame: station,
      id: `hauptbahnhof-office-${centerX < 0 ? "west" : "east"}-${
        endSide < 0 ? "north" : "south"
      }-portal`,
      landmark: "Berlin Hauptbahnhof office bridge",
      sizeM: [
        stationOfficeEntrance.clearHalfWidthM * 2,
        stationOfficeEntrance.clearHeightM,
        18,
      ],
      sourceBuildingIds: HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS,
    })),
  ),
];

type MutablePoint3 = { x: number; y: number; z: number };

const localPointScratch: MutablePoint3 = { x: 0, y: 0, z: 0 };
const gateRotationRadians = (gate.rotationDegrees * Math.PI) / 180;
const gateRotation = [
  Math.cos(gateRotationRadians),
  Math.sin(gateRotationRadians),
] as const;
const stationRotationRadians = (station.rotationDegrees * Math.PI) / 180;
const stationRotation = [
  Math.cos(stationRotationRadians),
  Math.sin(stationRotationRadians),
] as const;

function frameRotation(frame: LocalFrame): readonly [number, number] {
  if (frame === gate) return gateRotation;
  if (frame === station) return stationRotation;
  const radians = (frame.rotationDegrees * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
}

function worldToLocal(
  frame: LocalFrame,
  x: number,
  y: number,
  z: number,
  output: MutablePoint3,
): MutablePoint3 {
  const rotation = frameRotation(frame);
  const cosine = rotation[0];
  const sine = rotation[1];
  const dx = x - frame.anchorWorld[0];
  const dz = z - frame.anchorWorld[2];
  output.x = dx * cosine - dz * sine;
  output.y = y - frame.anchorWorld[1];
  output.z = dx * sine + dz * cosine;
  return output;
}

export function minecraftHeroLocalToWorld(
  frame: LocalFrame,
  local: Point3,
): [number, number, number] {
  const rotation = frameRotation(frame);
  const cosine = rotation[0];
  const sine = rotation[1];
  return [
    frame.anchorWorld[0] + cosine * local[0] + sine * local[2],
    frame.anchorWorld[1] + local[1],
    frame.anchorWorld[2] - sine * local[0] + cosine * local[2],
  ];
}

function pointInsidePortal(
  portal: MinecraftHeroPortal,
  x: number,
  y: number,
  z: number,
): boolean {
  const local = worldToLocal(portal.frame, x, y, z, localPointScratch);
  return (
    Math.abs(local.x - portal.centerLocalM[0]) <=
      portal.sizeM[0] / 2 + NAVIGATION_EPSILON_M &&
    Math.abs(local.y - portal.centerLocalM[1]) <=
      portal.sizeM[1] / 2 + NAVIGATION_EPSILON_M &&
    Math.abs(local.z - portal.centerLocalM[2]) <=
      portal.sizeM[2] / 2 + NAVIGATION_EPSILON_M
  );
}

function pointInsideHauptbahnhofHallPlan(
  localX: number,
  localZ: number,
): boolean {
  const northSouthHall =
    Math.abs(localX) <=
      stationNorthSouthEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M &&
    Math.abs(localZ) <=
      stationNorthSouthEntrance.endLocalZ + NAVIGATION_EPSILON_M;
  const eastWestHall =
    Math.abs(localX) <=
      stationEastWestEntrance.endLocalX + NAVIGATION_EPSILON_M &&
    Math.abs(localZ - hauptbahnhofEastWestCurveAt(localX)) <=
      stationEastWestEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M;
  let officeBridge = false;
  if (
    Math.abs(localZ) <=
    stationOfficeEntrance.endLocalZ + NAVIGATION_EPSILON_M
  ) {
    for (const centerX of stationOfficeEntrance.bridgeCentresLocalX) {
      if (
        Math.abs(localX - centerX) <=
        stationOfficeEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M
      ) {
        officeBridge = true;
        break;
      }
    }
  }
  return northSouthHall || eastWestHall || officeBridge;
}

function pointInsideHauptbahnhofPublicHall(
  x: number,
  y: number,
  z: number,
): boolean {
  const local = worldToLocal(station, x, y, z, localPointScratch);
  const localX = local.x;
  const localY = local.y;
  const localZ = local.z;
  const northSouthHall =
    localY >= station.publicFloorTopLocalY - NAVIGATION_EPSILON_M &&
    localY <= stationNorthSouthEntrance.clearHeightM + NAVIGATION_EPSILON_M &&
    Math.abs(localX) <=
      stationNorthSouthEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M &&
    Math.abs(localZ) <=
      stationNorthSouthEntrance.endLocalZ + NAVIGATION_EPSILON_M;
  const eastWestHall =
    localY >= station.publicFloorTopLocalY - NAVIGATION_EPSILON_M &&
    localY <= stationEastWestEntrance.clearHeightM + NAVIGATION_EPSILON_M &&
    Math.abs(localX) <=
      stationEastWestEntrance.endLocalX + NAVIGATION_EPSILON_M &&
    Math.abs(localZ - hauptbahnhofEastWestCurveAt(localX)) <=
      stationEastWestEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M;
  let officeBridge = false;
  if (
    localY >= station.publicFloorTopLocalY - NAVIGATION_EPSILON_M &&
    localY <= stationOfficeEntrance.clearHeightM + NAVIGATION_EPSILON_M &&
    Math.abs(localZ) <= stationOfficeEntrance.endLocalZ + NAVIGATION_EPSILON_M
  ) {
    for (const centerX of stationOfficeEntrance.bridgeCentresLocalX) {
      if (
        Math.abs(localX - centerX) <=
        stationOfficeEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M
      ) {
        officeBridge = true;
        break;
      }
    }
  }
  return northSouthHall || eastWestHall || officeBridge;
}

/** Public Minecraft station floor used by walking and as a flight plane. */
export function minecraftHeroGroundAt(x: number, z: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const local = worldToLocal(
    station,
    x,
    station.anchorWorld[1],
    z,
    localPointScratch,
  );
  return pointInsideHauptbahnhofHallPlan(local.x, local.z)
    ? station.anchorWorld[1] + station.publicFloorTopLocalY
    : null;
}

function pointTouchesLocalBox(
  frame: LocalFrame,
  centerLocalM: Point3,
  sizeM: Point3,
  x: number,
  y: number,
  z: number,
  radiusM: number,
): boolean {
  const local = worldToLocal(frame, x, y, z, localPointScratch);
  return (
    Math.abs(local.x - centerLocalM[0]) <= sizeM[0] / 2 + radiusM &&
    Math.abs(local.y - centerLocalM[1]) <= sizeM[1] / 2 + radiusM &&
    Math.abs(local.z - centerLocalM[2]) <= sizeM[2] / 2 + radiusM
  );
}

function pointTouchesReichstagDome(
  x: number,
  y: number,
  z: number,
  radiusM: number,
): boolean {
  const dome = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag.dome;
  const relativeY = y - dome.anchorWorld[1];
  if (relativeY < -radiusM || relativeY > dome.heightM + radiusM) {
    return false;
  }
  const normalizedY = Math.max(0, Math.min(1, relativeY / dome.heightM));
  const shellRadiusM = domeRadius(normalizedY, dome.diameterM);
  const radialM = Math.hypot(x - dome.anchorWorld[0], z - dome.anchorWorld[2]);
  // The authored ring blocks are 1.35 m deep. Keep their real top oculus
  // open rather than replacing the glass dome with a solid invisible plug.
  return Math.abs(radialM - shellRadiusM) <= 0.72 + radiusM;
}

function squaredDistanceToSegment(
  x: number,
  z: number,
  from: Point2,
  to: Point2,
): number {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const progress =
    lengthSquared <= 1e-9
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared,
          ),
        );
  return (
    (x - (from[0] + dx * progress)) ** 2 + (z - (from[1] + dz * progress)) ** 2
  );
}

function pointTouchesBridgeCourse(
  x: number,
  y: number,
  z: number,
  centerY: number,
  heightM: number,
  start: Point2,
  end: Point2,
  widthM: number,
  radiusM: number,
  segments: number,
  sagittaM = 0,
  lateralM = 0,
): boolean {
  if (Math.abs(y - centerY) > heightM / 2 + radiusM) return false;
  const thresholdSquared = (widthM / 2 + radiusM) ** 2;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const normalX = length <= 1e-9 ? 0 : -dz / length;
  const normalZ = length <= 1e-9 ? 0 : dx / length;
  for (let index = 0; index < segments; index += 1) {
    const fromProgress = index / segments;
    const toProgress = (index + 1) / segments;
    const fromBow = sagittaM * 4 * fromProgress * (1 - fromProgress) + lateralM;
    const toBow = sagittaM * 4 * toProgress * (1 - toProgress) + lateralM;
    const fromX = start[0] + dx * fromProgress + normalX * fromBow;
    const fromZ = start[1] + dz * fromProgress + normalZ * fromBow;
    const toX = start[0] + dx * toProgress + normalX * toBow;
    const toZ = start[1] + dz * toProgress + normalZ * toBow;
    const segmentDx = toX - fromX;
    const segmentDz = toZ - fromZ;
    const segmentLengthSquared = segmentDx * segmentDx + segmentDz * segmentDz;
    const progress =
      segmentLengthSquared <= 1e-9
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((x - fromX) * segmentDx + (z - fromZ) * segmentDz) /
                segmentLengthSquared,
            ),
          );
    const closestX = fromX + segmentDx * progress;
    const closestZ = fromZ + segmentDz * progress;
    if ((x - closestX) ** 2 + (z - closestZ) ** 2 <= thresholdSquared) {
      return true;
    }
  }
  return false;
}

function pointInsideFalseBundestagWall(
  x: number,
  y: number,
  z: number,
): boolean {
  const upper = BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge;
  return (
    y >= 1.5 &&
    y <= upper.envelopeTopY + 0.5 &&
    squaredDistanceToSegment(
      x,
      z,
      upper.centrelineWorld[0],
      upper.centrelineWorld[1],
    ) <=
      2.35 ** 2
  );
}

/** True only while the visual mode is Minecraft; every other mode is inert. */
export function minecraftHeroCollisionEnabled(mode: VisualMode): boolean {
  return mode === "minecraft";
}

/**
 * The five historic passages are real public voids in every presentation,
 * even though the authoritative LoD2 source represents the colonnade as one
 * closed footprint. Keep this exception source-specific so columns and side
 * pavilions remain solid.
 */
export function brandenburgGateWalkableAt(
  x: number,
  y: number,
  z: number,
  sourceBuildingId?: string,
): boolean {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z) ||
    sourceBuildingId === undefined
  ) {
    return false;
  }
  for (const portal of BRANDENBURG_GATE_PUBLIC_PASSAGES) {
    if (
      portal.sourceBuildingIds.includes(sourceBuildingId) &&
      pointInsidePortal(portal, x, y, z)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Source-specific exception for public portals and the old false solid wall
 * between the Bundestag buildings. Unknown or overlapping source ids never
 * inherit an opening.
 */
export function minecraftHeroWalkableAt(
  x: number,
  y: number,
  z: number,
  sourceBuildingId?: string,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return false;
  }
  if (brandenburgGateWalkableAt(x, y, z, sourceBuildingId)) return true;
  for (const portal of MINECRAFT_HERO_PORTALS) {
    if (portal.landmark === "Brandenburger Tor") continue;
    if (
      pointInsidePortal(portal, x, y, z) &&
      sourceBuildingId !== undefined &&
      portal.sourceBuildingIds.includes(sourceBuildingId)
    ) {
      return true;
    }
  }
  if (
    sourceBuildingId !== undefined &&
    HAUPTBAHNHOF_NAVIGATION_SOURCE_ID_SET.has(sourceBuildingId) &&
    pointInsideHauptbahnhofPublicHall(x, y, z)
  ) {
    return true;
  }
  return (
    sourceBuildingId === FALSE_BUNDESTAG_WALL_SOURCE_ID &&
    pointInsideFalseBundestagWall(x, y, z)
  );
}

/**
 * Restores the real thin bridge decks, rails, roof and posts after the false
 * LoD2 wall has been opened. These are analytical collision volumes only;
 * they do not create, move or recolour render geometry.
 */
export function minecraftHeroSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z) ||
    !Number.isFinite(radiusM) ||
    radiusM < 0
  ) {
    return true;
  }
  if (pointTouchesReichstagDome(x, y, z, radiusM)) return true;

  // The LoD2 gate body ends below the block Quadriga. This compact envelope
  // covers only the chariot/horses/Victoria silhouette above the attic; the
  // five pedestrian passages below remain governed by their exact voids.
  if (
    pointTouchesLocalBox(
      gate,
      GATE_QUADRIGA_CENTER_LOCAL_M,
      GATE_QUADRIGA_SIZE_M,
      x,
      y,
      z,
      radiusM,
    )
  ) {
    return true;
  }

  const lower = BUNDESTAG_SPREE_CONNECTION_PROFILE.lowerBridge;
  const upper = BUNDESTAG_SPREE_CONNECTION_PROFILE.upperBridge;
  if (
    pointTouchesBridgeCourse(
      x,
      y,
      z,
      lower.deckY - 0.35,
      0.8,
      lower.centrelineWorld[0],
      lower.centrelineWorld[1],
      lower.widthM,
      radiusM,
      26,
      lower.curveSagittaM,
    )
  ) {
    return true;
  }
  for (let side = -1; side <= 1; side += 2) {
    if (
      pointTouchesBridgeCourse(
        x,
        y,
        z,
        lower.deckY + 1.05,
        0.55,
        lower.centrelineWorld[0],
        lower.centrelineWorld[1],
        0.45,
        radiusM,
        26,
        lower.curveSagittaM,
        side * (lower.widthM / 2 - 0.25),
      )
    ) {
      return true;
    }
  }
  if (
    pointTouchesBridgeCourse(
      x,
      y,
      z,
      upper.deckY - 0.35,
      0.8,
      upper.centrelineWorld[0],
      upper.centrelineWorld[1],
      upper.widthM,
      radiusM,
      upper.frameBayCount,
    ) ||
    pointTouchesBridgeCourse(
      x,
      y,
      z,
      upper.roofY,
      0.8,
      upper.centrelineWorld[0],
      upper.centrelineWorld[1],
      upper.widthM,
      radiusM,
      upper.frameBayCount,
    )
  ) {
    return true;
  }
  const [start, end] = upper.centrelineWorld;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const normalX = length <= 1e-9 ? 0 : -dz / length;
  const normalZ = length <= 1e-9 ? 0 : dx / length;
  if (y >= upper.deckY - radiusM && y <= upper.roofY + radiusM) {
    const postRadius = 0.325 + radiusM;
    for (let index = 0; index <= upper.frameBayCount; index += 1) {
      const progress = index / upper.frameBayCount;
      const centerX = start[0] + dx * progress;
      const centerZ = start[1] + dz * progress;
      for (let side = -1; side <= 1; side += 2) {
        const postX = centerX + normalX * side * 1.25;
        const postZ = centerZ + normalZ * side * 1.25;
        if ((x - postX) ** 2 + (z - postZ) ** 2 <= postRadius ** 2) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Minecraft-only façade/roof collision with swept anti-tunnelling samples. */
export function resolveMinecraftHeroFlightTranslation(
  start: SchwellenraumPoint,
  requested: SchwellenraumPoint,
  environment: PedestrianEnvironment,
  radiusM = MINECRAFT_FLIGHT_RADIUS_M,
  scratch?: SchwellenraumFlightScratch,
): SchwellenraumFlightResult {
  return resolveSchwellenraumFlightTranslation(
    start,
    requested,
    environment,
    radiusM,
    scratch,
  );
}

export type MinecraftHeroCameraRig = {
  camera: SchwellenraumPoint;
  target: SchwellenraumPoint;
};

export type MinecraftHeroCameraRigResult = MinecraftHeroCameraRig & {
  blocked: boolean;
};

export type MinecraftHeroCameraRigScratch = {
  cameraDelta: SchwellenraumPoint;
  flight: SchwellenraumFlightScratch;
  result: MinecraftHeroCameraRigResult;
  targetDelta: SchwellenraumPoint;
};

export function createMinecraftHeroCameraRigScratch(): MinecraftHeroCameraRigScratch {
  return {
    cameraDelta: { x: 0, y: 0, z: 0 },
    flight: createSchwellenraumFlightScratch(),
    result: {
      blocked: false,
      camera: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
    },
    targetDelta: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Reconciles direct OrbitControls poses against the same swept camera body.
 * Pure pans remain a rigid camera/target translation; an orbit or cursor-
 * anchored dolly keeps its proposed focal point while only the lens is kept
 * outside solids.
 */
export function reconcileMinecraftHeroCameraRig(
  previous: MinecraftHeroCameraRig,
  proposed: MinecraftHeroCameraRig,
  environment: PedestrianEnvironment,
  radiusM = MINECRAFT_FLIGHT_RADIUS_M,
  scratch?: MinecraftHeroCameraRigScratch,
): MinecraftHeroCameraRigResult {
  const state = scratch ?? createMinecraftHeroCameraRigScratch();
  const { cameraDelta, result, targetDelta } = state;
  if (
    !Number.isFinite(previous.target.x) ||
    !Number.isFinite(previous.target.y) ||
    !Number.isFinite(previous.target.z) ||
    !Number.isFinite(proposed.target.x) ||
    !Number.isFinite(proposed.target.y) ||
    !Number.isFinite(proposed.target.z)
  ) {
    result.blocked = true;
    result.camera.x = previous.camera.x;
    result.camera.y = previous.camera.y;
    result.camera.z = previous.camera.z;
    result.target.x = previous.target.x;
    result.target.y = previous.target.y;
    result.target.z = previous.target.z;
    return result;
  }
  cameraDelta.x = proposed.camera.x - previous.camera.x;
  cameraDelta.y = proposed.camera.y - previous.camera.y;
  cameraDelta.z = proposed.camera.z - previous.camera.z;
  targetDelta.x = proposed.target.x - previous.target.x;
  targetDelta.y = proposed.target.y - previous.target.y;
  targetDelta.z = proposed.target.z - previous.target.z;
  const resolved = resolveMinecraftHeroFlightTranslation(
    previous.camera,
    cameraDelta,
    environment,
    radiusM,
    state.flight,
  );
  const rigidTranslation =
    Math.hypot(
      cameraDelta.x - targetDelta.x,
      cameraDelta.y - targetDelta.y,
      cameraDelta.z - targetDelta.z,
    ) <= 1e-7;
  result.blocked = resolved.blocked;
  result.camera.x = resolved.position.x;
  result.camera.y = resolved.position.y;
  result.camera.z = resolved.position.z;
  result.target.x = rigidTranslation
    ? previous.target.x + resolved.applied.x
    : proposed.target.x;
  result.target.y = rigidTranslation
    ? previous.target.y + resolved.applied.y
    : proposed.target.y;
  result.target.z = rigidTranslation
    ? previous.target.z + resolved.applied.z
    : proposed.target.z;
  return result;
}
