import { BUNDESTAG_SPREE_CONNECTION_PROFILE } from "./CentralCivicDetails";
import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  hauptbahnhofEastWestCurveAt,
} from "./MinecraftArchitecturalLandmarks";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { domeRadius } from "./ReichstagDome";
import {
  resolveSchwellenraumFlightTranslation,
  type SchwellenraumFlightResult,
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
 * source footprints therefore remain closed. The station entries and the
 * Gate's five historical passages are the only building-shell exceptions.
 */
export const MINECRAFT_HERO_PORTALS: ReadonlyArray<MinecraftHeroPortal> = [
  ...gatePassageCentres().map(
    (centerZ, index): MinecraftHeroPortal => ({
      centerLocalM: [0, 6.15, centerZ],
      frame: gate,
      id: `brandenburg-gate-passage-${index + 1}`,
      landmark: "Brandenburger Tor",
      sizeM: [gate.depthM + 7, 12.8, GATE_PASSAGE_WIDTHS_M[index]],
      // The two pavilion parts stay closed; only the central gate mass may be
      // replaced by the five real passage voids.
      sourceBuildingIds: [gate.sourcePrismIds[0]],
    }),
  ),
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
    ([-1, 1] as const).map(
      (endSide): MinecraftHeroPortal => ({
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
      }),
    ),
  ),
];

function worldToLocal(
  frame: LocalFrame,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const radians = (frame.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = x - frame.anchorWorld[0];
  const dz = z - frame.anchorWorld[2];
  return [
    dx * cosine - dz * sine,
    y - frame.anchorWorld[1],
    dx * sine + dz * cosine,
  ];
}

export function minecraftHeroLocalToWorld(
  frame: LocalFrame,
  local: Point3,
): [number, number, number] {
  const radians = (frame.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
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
  const local = worldToLocal(portal.frame, x, y, z);
  return local.every(
    (coordinate, axis) =>
      Math.abs(coordinate - portal.centerLocalM[axis]) <=
      portal.sizeM[axis] / 2 + NAVIGATION_EPSILON_M,
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
  const officeBridge = stationOfficeEntrance.bridgeCentresLocalX.some(
    (centerX) =>
      Math.abs(localX - centerX) <=
        stationOfficeEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M &&
      Math.abs(localZ) <=
        stationOfficeEntrance.endLocalZ + NAVIGATION_EPSILON_M,
  );
  return northSouthHall || eastWestHall || officeBridge;
}

function pointInsideHauptbahnhofPublicHall(
  x: number,
  y: number,
  z: number,
): boolean {
  const [localX, localY, localZ] = worldToLocal(station, x, y, z);
  const northSouthHall =
    localY >= station.publicFloorTopLocalY - NAVIGATION_EPSILON_M &&
    localY <=
      stationNorthSouthEntrance.clearHeightM + NAVIGATION_EPSILON_M &&
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
  const officeBridge =
    localY >= station.publicFloorTopLocalY - NAVIGATION_EPSILON_M &&
    localY <= stationOfficeEntrance.clearHeightM + NAVIGATION_EPSILON_M &&
    Math.abs(localZ) <=
      stationOfficeEntrance.endLocalZ + NAVIGATION_EPSILON_M &&
    stationOfficeEntrance.bridgeCentresLocalX.some(
      (centerX) =>
        Math.abs(localX - centerX) <=
        stationOfficeEntrance.clearHalfWidthM + NAVIGATION_EPSILON_M,
    );
  return northSouthHall || eastWestHall || officeBridge;
}

/** Public Minecraft station floor used by walking and as a flight plane. */
export function minecraftHeroGroundAt(x: number, z: number): number | null {
  if (![x, z].every(Number.isFinite)) return null;
  const [localX, , localZ] = worldToLocal(
    station,
    x,
    station.anchorWorld[1],
    z,
  );
  return pointInsideHauptbahnhofHallPlan(localX, localZ)
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
  const local = worldToLocal(frame, x, y, z);
  return local.every(
    (coordinate, axis) =>
      Math.abs(coordinate - centerLocalM[axis]) <=
      sizeM[axis] / 2 + radiusM,
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
  point: Point2,
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
            ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) /
              lengthSquared,
          ),
        );
  return (
    (point[0] - (from[0] + dx * progress)) ** 2 +
    (point[1] - (from[1] + dz * progress)) ** 2
  );
}

function bridgePointAt(
  start: Point2,
  end: Point2,
  progress: number,
  sagittaM = 0,
  lateralM = 0,
): Point2 {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const normalX = length <= 1e-9 ? 0 : -dz / length;
  const normalZ = length <= 1e-9 ? 0 : dx / length;
  const bow = sagittaM * 4 * progress * (1 - progress) + lateralM;
  return [
    start[0] + dx * progress + normalX * bow,
    start[1] + dz * progress + normalZ * bow,
  ];
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
  for (let index = 0; index < segments; index += 1) {
    const from = bridgePointAt(
      start,
      end,
      index / segments,
      sagittaM,
      lateralM,
    );
    const to = bridgePointAt(
      start,
      end,
      (index + 1) / segments,
      sagittaM,
      lateralM,
    );
    if (squaredDistanceToSegment([x, z], from, to) <= thresholdSquared) {
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
      [x, z],
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
  if (![x, y, z].every(Number.isFinite)) return false;
  for (const portal of MINECRAFT_HERO_PORTALS) {
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
  if (![x, y, z, radiusM].every(Number.isFinite) || radiusM < 0) {
    return true;
  }
  if (pointTouchesReichstagDome(x, y, z, radiusM)) return true;

  // The LoD2 gate body ends below the block Quadriga. This compact envelope
  // covers only the chariot/horses/Victoria silhouette above the attic; the
  // five pedestrian passages below remain governed by their exact voids.
  if (
    pointTouchesLocalBox(
      gate,
      [0, 23.5, 0],
      [8, 6.2, 14],
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
  for (const side of [-1, 1]) {
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
  for (const [centerY, heightM] of [
    [upper.deckY - 0.35, 0.8],
    [upper.roofY, 0.8],
  ] as const) {
    if (
      pointTouchesBridgeCourse(
        x,
        y,
        z,
        centerY,
        heightM,
        upper.centrelineWorld[0],
        upper.centrelineWorld[1],
        upper.widthM,
        radiusM,
        upper.frameBayCount,
      )
    ) {
      return true;
    }
  }
  const [start, end] = upper.centrelineWorld;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const normalX = length <= 1e-9 ? 0 : -dz / length;
  const normalZ = length <= 1e-9 ? 0 : dx / length;
  if (
    y >= upper.deckY - radiusM &&
    y <= upper.roofY + radiusM
  ) {
    const postRadius = 0.325 + radiusM;
    for (let index = 0; index <= upper.frameBayCount; index += 1) {
      const progress = index / upper.frameBayCount;
      const centerX = start[0] + dx * progress;
      const centerZ = start[1] + dz * progress;
      for (const side of [-1, 1]) {
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
): SchwellenraumFlightResult {
  return resolveSchwellenraumFlightTranslation(
    start,
    requested,
    environment,
    radiusM,
  );
}

export type MinecraftHeroCameraRig = {
  camera: SchwellenraumPoint;
  target: SchwellenraumPoint;
};

export type MinecraftHeroCameraRigResult = MinecraftHeroCameraRig & {
  blocked: boolean;
};

function pointDelta(
  from: SchwellenraumPoint,
  to: SchwellenraumPoint,
): SchwellenraumPoint {
  return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
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
): MinecraftHeroCameraRigResult {
  const targetValues = [
    previous.target.x,
    previous.target.y,
    previous.target.z,
    proposed.target.x,
    proposed.target.y,
    proposed.target.z,
  ];
  if (!targetValues.every(Number.isFinite)) {
    return {
      blocked: true,
      camera: { ...previous.camera },
      target: { ...previous.target },
    };
  }
  const cameraDelta = pointDelta(previous.camera, proposed.camera);
  const targetDelta = pointDelta(previous.target, proposed.target);
  const resolved = resolveMinecraftHeroFlightTranslation(
    previous.camera,
    cameraDelta,
    environment,
    radiusM,
  );
  const rigidTranslation =
    Math.hypot(
      cameraDelta.x - targetDelta.x,
      cameraDelta.y - targetDelta.y,
      cameraDelta.z - targetDelta.z,
    ) <= 1e-7;
  return {
    blocked: resolved.blocked,
    camera: resolved.position,
    target: rigidTranslation
      ? {
          x: previous.target.x + resolved.applied.x,
          y: previous.target.y + resolved.applied.y,
          z: previous.target.z + resolved.applied.z,
        }
      : { ...proposed.target },
  };
}
