import { gendarmenmarktSourceForPrism, gendarmenmarktPartRoofAt } from "./gendarmenmarktProfile";
import { GORKI_BUILDING_PRISM_IDS, GORKI_BUILDING_SOURCE, gorkiPartRoofAt } from "./gorkiBuildingProfile";
import { NEUE_WACHE_PRISM_IDS, NEUE_WACHE_PROFILE, NEUE_WACHE_ROOF_INDEX_RING, neueWacheRoofAt } from "./neueWacheProfile";
import { BEHREN42_PRISM_IDS, BEHREN42_SOURCE } from "./Behren42Profile";
import { schlossNaturkundeSourceForPrism, schlossNaturkundePartRoofAt } from "./schlossNaturkundeProfile";
import { spreebogenTerrainYAt } from "./spreebogenBankProfile";
import { BERLIN_JUNCTION_PRISM_IDS } from "./BerlinJunction";
import { DB_TOWER_PRISM_IDS, DB_TOWER_SOURCE, dbTowerDisplayY, dbTowerRoofAt } from "./dbTowerProfile";
import { DOM_ALTES_SOURCE, DOM_PROFILE, museumDisplayY, domRoofAt, altesRoofAt } from "./domAltesMuseumProfile";
import { DOM_ALTES_PRISM_IDS } from "./domAltesMuseumIds";
import { museumTriadSourceForPrism, museumTriadPartRoofAt } from "./museumTriadProfile";
import { ADMIRALSPALAST_IDS, admiralspalastRoofAt } from "./friedrichstrasseArchitectureProfile";
import { FIFTY_HERTZ_IDS, FIFTY_HERTZ_SOURCE, fiftyHertzRoofAt } from "./fiftyHertzProfile";
import { BELLEVUE_IDS, BELLEVUE_OFFICE_ID, BELLEVUE_PROFILE, bellevueRoofTopAt } from "./bellevueProfile";
import { BISMARCK_MOLTKE_PRISM_IDS } from "./bismarckMoltkeProfiles";
import { BUNDESRAT_MAIN_ID, BUNDESRAT_TOP, BUNDESRAT_PROFILE, bundesratRoofTopAt } from "./bundesratProfile";
import { TOPOGRAPHY_TERROR_IDS, TOPOGRAPHY_TERROR_SITE_IDS, TOPOGRAPHY_TERROR_MUSEUM_ID, topographySiteSurfaceAt } from "./topographyTerrorProfile";
import { topographyAuthoredSolids } from "./TopographyTerrorArchitecture";
import { ROHWEDDER_HAUS_IDS, ROHWEDDER_HAUS_SOURCE } from "./rohwedderHausProfile";
import { BOELL_STIFTUNG_LOW_ID, BOELL_STIFTUNG_UNDERSIDE } from "./boellStiftungProfile";
import { FRIEDRICHSTADT_PALAST_PRISM_ID, FRIEDRICHSTADT_PALAST_PROFILE, friedrichstadtPalastTopAt } from "./FriedrichstadtPalastDetails";
import { SOVIET_MEMORIAL_PRISM_IDS } from "./SovietMemorialSource";
import { ROSENGARTEN_PERGOLA_PRISM_ID } from "./rosengartenProfile";
import { musicMuseumPart, musicMuseumPartRoofHeightAt, musicMuseumDisplayTop } from "./museumLenneProfile";
import { JAKOB_KAISER_EAST_UPPER_PROFILE } from "./parliamentArchitectureProfile";
import { isChancelleryExtensionConstructionPoint } from "./chancelleryExtensionProfile";
import type { PrismPayload, SurfacePayload } from "./IsometricCityWorld";
import { resolveHumboldthafenPrism } from "./humboldthafenCourtyardProfile";
import { ECONOMIC_MINISTRY_SOURCE_IDS, economicMinistryRoofTopAt } from "./EconomicMinistrySourceGeometry";
import {
  minecraftVoxelTreeRetained,
  type MinecraftVoxelDetailProfile,
  type VoxelPayload,
  smoothGroundTopSampler,
} from "./MinecraftVoxelWorld";
import { isLenneOakTree } from "./LenneOak";
import {
  decodeTrees,
  parkHedgeSegments,
  parkShrubClusters,
  type ParkDetailsPayload,
  type PlaygroundEquipment,
} from "./ParkDetails";
import {
  createTunnelPortalApproachTester,
  type TunnelPortalCourseInput,
  tunnelWalkCourses,
} from "./TunnelPortals";
import type { PedestrianInput } from "./navigationInput";
import { MAX_MOTION_FRAME_DELTA_SECONDS } from "./renderQuality";
import { SONY_CENTER_ROOF_PRISM_IDS } from "./sonyCenterRoofSource";
import { BODE_SOURCE, GRILL_SOURCE, SPREE_RECOGNITION_PRISM_IDS } from "./spreeRecognitionProfile";
import { bebelplatzSourceForPrism, bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";
import { hedwigRoofTopAt } from "./HedwigCathedral";
import { ABGEORDNETENHAUS_PROFILE, abgeordnetenhausDisplayTopAt } from "./abgeordnetenhausProfile";
import { createPedestrianBridgeGround } from "./PedestrianBridgeGround";
import type { VisualMode } from "./visualMode";
import { GUSTAV_BRIDGE_SUPPORT_FALLBACK } from "./gustavBridgeSupportSource";
import { ZOLLPACKHOF_PARTS, zollpackhofDisplayTopAt } from "./zollpackhofProfile";

export {
  heldPedestrianInput,
  isPedestrianHighJumpDoubleActivation,
  isPedestrianSprintDoubleActivation,
  pedestrianMovementActivation,
  PEDESTRIAN_HIGH_JUMP_DOUBLE_ACTIVATION_MS,
  PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS,
  type PedestrianInput,
} from "./navigationInput";

export const PEDESTRIAN_EYE_HEIGHT_M = 1.8;
// A slightly taller, softer presentation jump makes stairs and low urban
// obstacles easy to clear. A bounded double-Space boost reaches the higher
// apex below without allowing repeated airborne stacking.
export const PEDESTRIAN_JUMP_APEX_M = 6.2;
export const PEDESTRIAN_HIGH_JUMP_APEX_M = 10.5;
export const PEDESTRIAN_WALK_SPEED_MPS = 13;
export const PEDESTRIAN_SPRINT_MULTIPLIER = 4;
export const PEDESTRIAN_FAST_RUN_MULTIPLIER = 8;
export const PEDESTRIAN_TURN_SPEED_RAD_S = Math.PI * 0.9;
export const PEDESTRIAN_LOOK_SPEED_RAD_S = Math.PI * 0.7;
export const PEDESTRIAN_GRAVITY_MPS2 = 26;
export const PEDESTRIAN_MAX_PITCH_RAD = (Math.PI * 80) / 180;
export const PEDESTRIAN_FOV_DEGREES = 66;
export const PEDESTRIAN_VIEW_DISTANCE_M = 7;
export const PEDESTRIAN_BODY_RADIUS_M = 0.42;
export const PEDESTRIAN_COLLISION_CELL_M = 24;
export const PEDESTRIAN_COLLISION_STEP_M = 0.22;

/** Pariser Platz, east of the Brandenburg Gate, in the viewer's metric frame. */
export const PEDESTRIAN_RESPAWN = {
  x: 497.0499028667109,
  z: 292.8503072652966,
  // West, toward the Brandenburg Gate.
  yaw: -Math.PI / 2,
} as const;

export type PedestrianState = {
  grounded: boolean;
  groundLayer: "surface" | "tunnel";
  groundY: number;
  insideTunnel: boolean;
  jumpOffset: number;
  pitch: number;
  verticalVelocity: number;
  x: number;
  yaw: number;
  z: number;
};

export type PedestrianSpawn = {
  groundYHint?: number;
  pitch?: number;
  /** Direct flight-to-walk transitions retain X/Z and only descend. */
  preserveHorizontalPosition?: boolean;
  x: number;
  yaw: number;
  z: number;
};

export type PedestrianViewPoint = {
  x: number;
  y: number;
  z: number;
};

export type PedestrianBounds = {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
};

export type PedestrianWaterRegion = {
  holes: Array<Array<readonly [number, number]>>;
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
  ring: Array<readonly [number, number]>;
};

type PedestrianObstacleBase = {
  maxX: number;
  maxY: number;
  maxZ: number;
  minX: number;
  minY: number;
  minZ: number;
  /** Stable source feature used to open only the matching authored interior. */
  sourceId?: string;
};

type PedestrianRing = ReadonlyArray<readonly number[]>;

export type PedestrianCircleObstacle = PedestrianObstacleBase & {
  kind: "circle";
  /** Only decoded source trees follow Minecraft's reversible density filter. */
  parkTree?: "ordinary" | "lenne-oak";
  radius: number;
  x: number;
  z: number;
};

export type PedestrianPolygonObstacle = PedestrianObstacleBase & {
  /** Source-coordinate metres per stored ring unit (LoD2 rings use 0.1). */
  coordinateScale: number;
  holes: ReadonlyArray<PedestrianRing>;
  kind: "polygon";
  ring: PedestrianRing;
  /** Source-bound display roof when a documented source height is unusable. */
  topAt?: (x: number, z: number) => number | null;
};

export type PedestrianSegmentObstacle = PedestrianObstacleBase & {
  from: readonly [number, number];
  kind: "segment";
  radius: number;
  to: readonly [number, number];
};

export type PedestrianObstacle =
  | PedestrianCircleObstacle
  | PedestrianPolygonObstacle
  | PedestrianSegmentObstacle;

export type PedestrianObstacleIndex = {
  buildingCount: number;
  cellSizeM: number;
  cells: Map<number | string, PedestrianObstacle[]>;
  hedgeAreaCount: number;
  hedgeSegmentCount: number;
  obstacleCount: number;
  parkDetailsAdded: boolean;
  playgroundEquipmentCount: number;
  shrubClusterCount: number;
  streetLightCount: number;
  treeCount: number;
  wallSegmentCount: number;
};

export type PedestrianEnvironment = {
  bounds: PedestrianBounds;
  /** Source-bound represented bridge decks override water only within their span. */
  bridgeGroundAt?: (x: number, z: number) => number | null;
  groundAt: (x: number, z: number) => number | null;
  /** A live getter keeps bridge support consistent across a mode change. */
  visualMode?: () => VisualMode;
  obstacles?: PedestrianObstacleIndex;
  /** Mode-aware visibility of indexed source trees; other solids stay active. */
  parkTreeSolidAt?: (x: number, z: number, landmarkOak: boolean) => boolean;
  /**
   * A tightly bounded authored doorway, ramp, stair or interior may locally
   * replace its matching closed LoD2 footprint. The optional source id lets a
   * tester reject every other overlapping building. Street furniture, walls
   * and trees are never bypassed by this hook.
   */
  walkableInteriorAt?: (
    x: number,
    y: number,
    z: number,
    sourceId?: string,
  ) => boolean;
  /**
   * Immutable memorial and commemoration volumes always win over an interior
   * opening. Testers should describe the protected volume, not its appearance.
   */
  protectedVolumeAt?: (x: number, y: number, z: number) => boolean;
  /** Mode-authored walls, jambs, gates, ceilings and fixed furnishings. */
  interiorSolidAt?: (
    x: number,
    y: number,
    z: number,
    radius?: number,
  ) => boolean;
  /** Optional mode-authored stairs, ramps and interior floor elevations. */
  interiorGroundAt?: (
    x: number,
    z: number,
    currentGroundY?: number,
  ) => number | null;
  resolveGround?: (
    x: number,
    z: number,
    currentLayer: PedestrianState["groundLayer"],
    groundYHint?: number,
  ) => PedestrianGround | null;
  water: PedestrianWaterRegion[];
};

export type PedestrianGround = {
  insideTunnel: boolean;
  layer: PedestrianState["groundLayer"];
  y: number;
};

export type PedestrianStep = {
  changed: boolean;
  respawned: boolean;
  state: PedestrianState;
};

/** A small trail of actual walk positions, not a second navigation graph. */
export type PedestrianRecoveryHistory = {
  checkpoints: PedestrianState[];
  lastRecorded: PedestrianState | null;
};

export type PedestrianRecoveryResult = {
  recovered: boolean;
  source: "checkpoint" | "nearby" | "none";
  state: PedestrianState;
};

export const PEDESTRIAN_RECOVERY_CHECKPOINT_LIMIT = 48;
export const PEDESTRIAN_RECOVERY_RADIUS_M = 96;

/**
 * Convert the live camera rig into a walking spawn without changing place.
 * The camera's projected ground point is the visible viewer location; the
 * orbit target is only a fallback when that eye lies outside the map.
 */
export function pedestrianSpawnFromView(
  environment: PedestrianEnvironment,
  focusPoint: PedestrianViewPoint,
  cameraPosition: PedestrianViewPoint,
  viewDirection: PedestrianViewPoint,
): PedestrianSpawn | undefined {
  const candidates = [
    {
      groundYHint: cameraPosition.y - PEDESTRIAN_EYE_HEIGHT_M,
      point: cameraPosition,
      preserveHorizontalPosition: true,
    },
    {
      groundYHint: focusPoint.y,
      point: focusPoint,
      preserveHorizontalPosition: false,
    },
  ];
  const selected = candidates.find(({ point }) => {
    return (
      Number.isFinite(point.x) &&
      Number.isFinite(point.z) &&
      point.x >= environment.bounds.minX &&
      point.x <= environment.bounds.maxX &&
      point.z >= environment.bounds.minZ &&
      point.z <= environment.bounds.maxZ &&
      environment.groundAt(point.x, point.z) !== null
    );
  });
  if (!selected) return undefined;

  const horizontalLength = Math.hypot(viewDirection.x, viewDirection.z);
  return {
    groundYHint: Number.isFinite(selected.groundYHint)
      ? selected.groundYHint
      : undefined,
    pitch: Math.asin(clamp(viewDirection.y, -1, 1)),
    ...(selected.preserveHorizontalPosition
      ? { preserveHorizontalPosition: true }
      : {}),
    x: selected.point.x,
    yaw:
      horizontalLength > 1e-6
        ? Math.atan2(viewDirection.x, -viewDirection.z)
        : 0,
    z: selected.point.z,
  };
}

export const PEDESTRIAN_IDLE_INPUT: Readonly<PedestrianInput> = {
  forward: 0,
  look: 0,
  sprint: false,
  strafe: 0,
  turn: 0,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrapRadians(value: number): number {
  const wrapped = ((value + Math.PI) % (Math.PI * 2)) - Math.PI;
  return wrapped < -Math.PI ? wrapped + Math.PI * 2 : wrapped;
}

function pointOnSegment(
  x: number,
  z: number,
  left: readonly number[],
  right: readonly number[],
): boolean {
  const lengthSquared = (right[0] - left[0]) ** 2 + (right[1] - left[1]) ** 2;
  if (lengthSquared < 1e-12) {
    return Math.hypot(x - left[0], z - left[1]) < 1e-7;
  }
  const cross =
    (x - left[0]) * (right[1] - left[1]) - (z - left[1]) * (right[0] - left[0]);
  if (Math.abs(cross) > 1e-7) {
    return false;
  }
  const dot =
    (x - left[0]) * (right[0] - left[0]) + (z - left[1]) * (right[1] - left[1]);
  if (dot < 0) {
    return false;
  }
  return dot <= lengthSquared;
}

export function pointInPedestrianRing(
  x: number,
  z: number,
  ring: PedestrianRing,
): boolean {
  if (ring.length < 3) {
    return false;
  }
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    index += 1
  ) {
    const left = ring[previous];
    const right = ring[index];
    if (pointOnSegment(x, z, left, right)) {
      return true;
    }
    if (
      right[1] > z !== left[1] > z &&
      x <
        ((left[0] - right[0]) * (z - right[1])) / (left[1] - right[1]) +
          right[0]
    ) {
      inside = !inside;
    }
    previous = index;
  }
  return inside;
}

function metricRing(ring: number[][]): Array<readonly [number, number]> {
  return ring
    .filter((point) => point.length >= 2)
    .map((point) => [point[0] / 10, point[1] / 10] as const);
}

export function pedestrianObstacleCellKey(
  xIndex: number,
  zIndex: number,
): number | string {
  // The production map stays well inside signed 16-bit cell coordinates.
  // Packing the pair avoids tens of thousands of short-lived template
  // strings during compilation and on every walking collision query.
  if (
    xIndex >= -32_768 &&
    xIndex <= 32_767 &&
    zIndex >= -32_768 &&
    zIndex <= 32_767
  ) {
    return (xIndex + 32_768) * 65_536 + zIndex + 32_768;
  }
  return `${xIndex}:${zIndex}`;
}

function emptyPedestrianObstacleIndex(): PedestrianObstacleIndex {
  return {
    buildingCount: 0,
    cellSizeM: PEDESTRIAN_COLLISION_CELL_M,
    cells: new Map(),
    hedgeAreaCount: 0,
    hedgeSegmentCount: 0,
    obstacleCount: 0,
    parkDetailsAdded: false,
    playgroundEquipmentCount: 0,
    shrubClusterCount: 0,
    streetLightCount: 0,
    treeCount: 0,
    wallSegmentCount: 0,
  };
}

function addObstacle(
  index: PedestrianObstacleIndex,
  obstacle: PedestrianObstacle,
): void {
  const padding = PEDESTRIAN_BODY_RADIUS_M;
  const minXIndex = Math.floor((obstacle.minX - padding) / index.cellSizeM);
  const maxXIndex = Math.floor((obstacle.maxX + padding) / index.cellSizeM);
  const minZIndex = Math.floor((obstacle.minZ - padding) / index.cellSizeM);
  const maxZIndex = Math.floor((obstacle.maxZ + padding) / index.cellSizeM);
  for (let zIndex = minZIndex; zIndex <= maxZIndex; zIndex += 1) {
    for (let xIndex = minXIndex; xIndex <= maxXIndex; xIndex += 1) {
      const key = pedestrianObstacleCellKey(xIndex, zIndex);
      const cell = index.cells.get(key);
      if (cell) {
        cell.push(obstacle);
      } else {
        index.cells.set(key, [obstacle]);
      }
    }
  }
  index.obstacleCount += 1;
}

function addCircleObstacle(
  index: PedestrianObstacleIndex,
  x: number,
  z: number,
  radius: number,
  minY: number,
  maxY: number,
  parkTree?: PedestrianCircleObstacle["parkTree"],
): void {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY) ||
    radius <= 0 ||
    maxY <= minY
  ) {
    return;
  }
  addObstacle(index, {
    kind: "circle",
    parkTree,
    maxX: x + radius,
    maxY,
    maxZ: z + radius,
    minX: x - radius,
    minY,
    minZ: z - radius,
    radius,
    x,
    z,
  });
}

function addPolygonObstacle(
  index: PedestrianObstacleIndex,
  ring: PedestrianRing,
  holes: ReadonlyArray<PedestrianRing>,
  minY: number,
  maxY: number,
  sourceId?: string,
  coordinateScale = 1,
  topAt?: PedestrianPolygonObstacle["topAt"],
): void {
  if (
    ring.length < 3 ||
    maxY <= minY ||
    !Number.isFinite(coordinateScale) ||
    coordinateScale <= 0
  ) {
    return;
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of ring) {
    if (point.length < 2) continue;
    const x = point[0] * coordinateScale;
    const z = point[1] * coordinateScale;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return;
  addObstacle(index, {
    coordinateScale,
    holes,
    kind: "polygon",
    maxX,
    maxY,
    maxZ,
    minX,
    minY,
    minZ,
    ring,
    sourceId,
    topAt,
  });
}

function addSegmentObstacle(
  index: PedestrianObstacleIndex,
  from: readonly [number, number],
  to: readonly [number, number],
  radius: number,
  minY: number,
  maxY: number,
): void {
  if (
    !from.every(Number.isFinite) ||
    !to.every(Number.isFinite) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY) ||
    radius <= 0 ||
    maxY <= minY
  ) {
    return;
  }
  addObstacle(index, {
    from,
    kind: "segment",
    maxX: Math.max(from[0], to[0]) + radius,
    maxY,
    maxZ: Math.max(from[1], to[1]) + radius,
    minX: Math.min(from[0], to[0]) - radius,
    minY,
    minZ: Math.min(from[1], to[1]) - radius,
    radius,
    to,
  });
}

/** Compile exact LoD2 building footprints into a constant-time local index. */
export function compilePedestrianObstacles(
  prisms: Pick<PrismPayload, "buildings">,
  visualMode: () => VisualMode = () => "day",
): PedestrianObstacleIndex {
  const index = emptyPedestrianObstacleIndex();
  const replacedParents = new Set<string>();
  for (const sourceBuilding of prisms.buildings) {
    const building = resolveHumboldthafenPrism(sourceBuilding);
    if (BERLIN_JUNCTION_PRISM_IDS.has(building.id)) continue;
    if (SONY_CENTER_ROOF_PRISM_IDS.has(building.id)) continue;
    if (BISMARCK_MOLTKE_PRISM_IDS.has(building.id)) continue;
    if (SOVIET_MEMORIAL_PRISM_IDS.has(building.id)) continue;
    if (building.id === ROSENGARTEN_PERGOLA_PRISM_ID) continue;
    if (building.id === GUSTAV_BRIDGE_SUPPORT_FALLBACK.prismId) continue;
    if (NEUE_WACHE_PRISM_IDS.has(building.id)) {
      // Retain the raw OSM prism as provenance, but its former six-metre
      // fallback slab is not a floor inside the authored hollow memorial.
      addPolygonObstacle(index, NEUE_WACHE_ROOF_INDEX_RING, [],
        NEUE_WACHE_PROFILE.streetY, NEUE_WACHE_PROFILE.pedimentTopY,
        building.id, 1, (x, z) => neueWacheRoofAt(x, z, visualMode() === "minecraft"));
      index.buildingCount += 1;
      continue;
    }
    if (ECONOMIC_MINISTRY_SOURCE_IDS.has(building.id)) {
      const sourceTop = (building.y0_dm + building.h_dm) / 10;
      addPolygonObstacle(index, building.ring, building.holes ?? [],
        building.y0_dm / 10, sourceTop + 0.2, building.id, 0.1,
        (x, z) => economicMinistryRoofTopAt(x, z, building.id));
      index.buildingCount += 1;
      continue;
    }
    const zollpackhof = ZOLLPACKHOF_PARTS.find(({ id }) => id === building.id);
    if (zollpackhof) {
      addPolygonObstacle(index, building.ring, building.holes ?? [],
        zollpackhof.groundY,
        zollpackhof.groundY + zollpackhof.wallHeightM + zollpackhof.roofRiseM + 0.55,
        building.id, 0.1,
        (x, z) => zollpackhofDisplayTopAt(x, z, visualMode() === "minecraft"));
      index.buildingCount += 1;
      continue;
    }
    const gendarmenmarkt = gendarmenmarktSourceForPrism(building.id);
    if (gendarmenmarkt) {
      if (!replacedParents.has(gendarmenmarkt.parent_id)) {
        replacedParents.add(gendarmenmarkt.parent_id);
        for (const part of gendarmenmarkt.parts) {
          addPolygonObstacle(index, part.ring, part.holes,
            part.ground_y_m + gendarmenmarkt.display_y_translation_m,
            part.top_y_m + gendarmenmarkt.display_y_translation_m, part.id, 1,
            (x,z) => gendarmenmarktPartRoofAt(part,x,z));
          index.buildingCount += 1;
        }
      }
      continue;
    }
    const mitteSource = GORKI_BUILDING_PRISM_IDS.has(building.id) ? GORKI_BUILDING_SOURCE :
      BEHREN42_PRISM_IDS.has(building.id) ? BEHREN42_SOURCE : null;
    if (mitteSource) {
      if (!replacedParents.has(mitteSource.parent_id)) {
        replacedParents.add(mitteSource.parent_id);
        const shift = "display_y_translation_m" in mitteSource ? mitteSource.display_y_translation_m : 0;
        for (const part of mitteSource.parts) {
          addPolygonObstacle(index, part.ring, part.holes,
            part.ground_y_m + shift, part.top_y_m + shift, part.id, 1,
            (x, z) => {
              const y = GORKI_BUILDING_PRISM_IDS.has(building.id)
                ? gorkiPartRoofAt(part, x, z) : bebelplatzPartRoofAt(part, x, z);
              return y === null ? null : y + shift;
            });
          index.buildingCount += 1;
        }
      }
      continue;
    }
    const schlossNaturkunde = schlossNaturkundeSourceForPrism(building.id);
    if (schlossNaturkunde) {
      if (!replacedParents.has(schlossNaturkunde.parent_id)) {
        replacedParents.add(schlossNaturkunde.parent_id);
        const translation = schlossNaturkunde.display_y_translation_m;
        for (const part of schlossNaturkunde.parts) {
          addPolygonObstacle(index, part.ring, part.holes,
            part.ground_y_m + translation, part.top_y_m + translation, part.id, 1,
            (x, z) => schlossNaturkundePartRoofAt(part, x, z));
          index.buildingCount += 1;
        }
      }
      continue;
    }
    const bebelplatz = bebelplatzSourceForPrism(building.id);
    if (bebelplatz) {
      if (!replacedParents.has(bebelplatz.parent_id)) {
        replacedParents.add(bebelplatz.parent_id);
        for (const part of bebelplatz.parts) {
          addPolygonObstacle(index, part.ring, part.holes,
            part.ground_y_m, part.top_y_m, part.id, 1,
            (x, z) => bebelplatz.parent_id === "DEBE01YYK00000AQ"
              ? hedwigRoofTopAt(x, z) : bebelplatzPartRoofAt(part, x, z));
          index.buildingCount += 1;
        }
      }
      continue;
    }
    if (SPREE_RECOGNITION_PRISM_IDS.has(building.id)) {
      const source = building.id === "-4211594" ? BODE_SOURCE : GRILL_SOURCE;
      if (!replacedParents.has(source.parent_id)) {
        replacedParents.add(source.parent_id);
        for (const part of source.parts) {
          addPolygonObstacle(index, part.ring, part.holes,
            part.ground_y_m, part.top_y_m, part.id);
          index.buildingCount += 1;
        }
      }
      continue;
    }
    const museum = museumTriadSourceForPrism(building.id);
    if (museum) {
      if (!replacedParents.has(museum.parent_id)) {
        replacedParents.add(museum.parent_id);
        for (const part of museum.parts) {
          addPolygonObstacle(index, part.ring, part.holes,
            part.ground_y_m, part.top_y_m, part.id, 1,
            (x, z) => museumTriadPartRoofAt(part, x, z));
          index.buildingCount += 1;
        }
      }
      continue;
    }
    if (DOM_ALTES_PRISM_IDS.has(building.id)) {
      const isDom = building.id === "13670734";
      const source = isDom ? DOM_ALTES_SOURCE.dom : DOM_ALTES_SOURCE.altes;
      if (!replacedParents.has(source.parent_id)) {
        replacedParents.add(source.parent_id);
        for (const part of source.parts) {
          addPolygonObstacle(index, part.ring, part.holes, part.ground_y_m,
            isDom ? DOM_PROFILE.top : museumDisplayY(part, part.top_y_m), part.id, 1,
            (x, z) => isDom ? domRoofAt(x, z) : altesRoofAt(x, z, part.id));
          index.buildingCount += 1;
        }
      }
      continue;
    }
    if (FIFTY_HERTZ_IDS.has(building.id)) {
      const sourceTop = building.id === FIFTY_HERTZ_SOURCE.extension.id
        ? (FIFTY_HERTZ_SOURCE.extension.y0_dm + FIFTY_HERTZ_SOURCE.extension.h_dm) / 10
        : (building.y0_dm + building.h_dm) / 10;
      addPolygonObstacle(index, building.ring, building.holes ?? [], building.y0_dm / 10, sourceTop + 0.1, building.id, 0.1, (x, z) => fiftyHertzRoofAt(x, z, building.id) ?? sourceTop);
      index.buildingCount += 1;
      continue;
    }
    if (ADMIRALSPALAST_IDS.has(building.id)) {
      const sourceTop = (building.y0_dm + building.h_dm) / 10;
      addPolygonObstacle(index, building.ring, building.holes ?? [], building.y0_dm / 10,
        sourceTop + 0.2, building.id, 0.1,
        (x, z) => admiralspalastRoofAt(x, z, building.id) ?? sourceTop);
      index.buildingCount += 1;
      continue;
    }
    if (BELLEVUE_IDS.has(building.id)) {
      const sourceTop = (building.y0_dm + building.h_dm) / 10;
      addPolygonObstacle(index, building.ring, building.holes ?? [], building.y0_dm / 10,
        building.id === BELLEVUE_OFFICE_ID ? BELLEVUE_PROFILE.office.top + 0.5 : sourceTop + 0.2,
        building.id, 0.1, (x, z) => bellevueRoofTopAt(x, z, building.id) ?? sourceTop);
      index.buildingCount += 1;
      continue;
    }
    const musicPart = musicMuseumPart(building.id);
    if (musicPart) {
      // The source height begins at the basement. Keep the street-level base,
      // but use the absolute official roof instead of adding height twice.
      addPolygonObstacle(index, building.ring, building.holes ?? [],
        musicPart.street_ground_y_m, musicMuseumDisplayTop(building.id), building.id, 0.1,
        (x,z) => musicMuseumPartRoofHeightAt(building.id,x,z,visualMode() === "minecraft"));
      index.buildingCount += 1;
      continue;
    }
    if (DB_TOWER_PRISM_IDS.has(building.id)) {
      const part = DB_TOWER_SOURCE.parts.find(p => p.id.endsWith(building.id))!;
      addPolygonObstacle(index, building.ring, building.holes ?? [], building.y0_dm / 10,
        dbTowerDisplayY(part.top_y_m), building.id, 0.1,
        (x,z) => dbTowerRoofAt(x,z,building.id));
      index.buildingCount += 1;
      continue;
    }
    // Site platforms are walkable surfaces, not occupied building volumes.
    if (TOPOGRAPHY_TERROR_SITE_IDS.has(building.id)) continue;
    const before = index.obstacleCount;
    const parliamentDisplay = building.id === ABGEORDNETENHAUS_PROFILE.mainPrismId;
    addPolygonObstacle(
      index,
      building.ring,
      building.holes ?? [],
      parliamentDisplay ? ABGEORDNETENHAUS_PROFILE.groundY : building.id === BOELL_STIFTUNG_LOW_ID ? BOELL_STIFTUNG_UNDERSIDE : building.y0_dm / 10,
      parliamentDisplay ? ABGEORDNETENHAUS_PROFILE.roofTopY : building.id === BUNDESRAT_MAIN_ID ? BUNDESRAT_TOP + 0.15 + BUNDESRAT_PROFILE.roof.rise : building.id === FRIEDRICHSTADT_PALAST_PRISM_ID ? FRIEDRICHSTADT_PALAST_PROFILE.baseY + 32.24 : (building.y0_dm + building.h_dm) / 10,
      building.id,
      0.1,
      parliamentDisplay ? abgeordnetenhausDisplayTopAt : building.id === BUNDESRAT_MAIN_ID ? (x, z) => bundesratRoofTopAt(x, z) ?? BUNDESRAT_TOP : building.id === FRIEDRICHSTADT_PALAST_PRISM_ID ? friedrichstadtPalastTopAt : undefined,
    );
    if (index.obstacleCount > before) {
      index.buildingCount += 1;
    }
  }
  // A documented display supplement resolves the official LoD2 gap only
  // when the source wing is in this payload. Keep its source record intact.
  const upper = JAKOB_KAISER_EAST_UPPER_PROFILE;
  if (prisms.buildings.some(b => b.id === upper.sourcePrismId)) {
    addPolygonObstacle(index, upper.footprintWorld, [upper.courtyardWorld],
      upper.bottomY, upper.topY, upper.displayPrismId, 1,
      () => visualMode() === "minecraft" ? Number.NEGATIVE_INFINITY : upper.topY);
    for (let x = 536; x < 598; x += 4) for (let z = 20; z < 104; z += 4) {
      if (!pointInPedestrianRing(x, z, upper.footprintWorld) || pointInPedestrianRing(x, z, upper.courtyardWorld)) continue;
      addPolygonObstacle(index, [[x-2,z-2],[x+2,z-2],[x+2,z+2],[x-2,z+2]], [],
        upper.bottomY, upper.topY, upper.displayPrismId, 1,
        () => visualMode() === "minecraft" ? upper.topY : Number.NEGATIVE_INFINITY);
    }
    index.buildingCount += 1;
  }
  if (prisms.buildings.some(building => ROHWEDDER_HAUS_IDS.has(building.id))) {
    const fence = ROHWEDDER_HAUS_SOURCE.entranceFence.points;
    for (let i = 1; i < fence.length; i += 1) {
      addSegmentObstacle(index, [fence[i - 1][0], fence[i - 1][1]],
        [fence[i][0], fence[i][1]], 0.19, 5, 9.8);
    }
  }
  if (prisms.buildings.some(building => TOPOGRAPHY_TERROR_IDS.has(building.id))) {
    for (const solid of topographyAuthoredSolids()) {
      const c = Math.cos(solid.yaw), s = Math.sin(solid.yaw);
      const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
        const dx = sx * solid.width / 2, dz = sz * solid.depth / 2;
        return [solid.x + dx * c + dz * s, solid.z - dx * s + dz * c];
      });
      addPolygonObstacle(index, ring, [], solid.y - solid.height / 2,
        solid.y + solid.height / 2, `${TOPOGRAPHY_TERROR_MUSEUM_ID}:${solid.role}`, 1);
    }
  }
  return index;
}

function equipmentRadius(item: PlaygroundEquipment): number | null {
  if (item.kind === "sandpit") {
    return null;
  }
  if (item.kind === "swing" || item.kind === "climbingframe") {
    return 1.2;
  }
  if (item.kind === "slide" || item.kind === "structure") {
    return 0.9;
  }
  if (item.kind === "roundabout" || item.kind === "basketswing") {
    return 0.75;
  }
  return 0.4;
}

/**
 * Keep the shared Day obstacle index intact. Only a fully attached Minecraft
 * world may release its omitted source trunks; loading/fallback and unusable
 * grid scales retain ordinary collision. Mode changes require no index rebuild.
 */
export function createPedestrianParkTreeSolidTester(
  cellM: number,
  detailProfile: MinecraftVoxelDetailProfile,
  voxelWorldActive: () => boolean,
): NonNullable<PedestrianEnvironment["parkTreeSolidAt"]> {
  const usableCell = Number.isFinite(cellM) && cellM > 0;
  return (x, z, landmarkOak) =>
    landmarkOak ||
    !usableCell ||
    !voxelWorldActive() ||
    minecraftVoxelTreeRetained(
      Math.floor(x / cellM),
      Math.floor(z / cellM),
      detailProfile,
    );
}

/**
 * Add the same visible trunks, shrub clumps, lamp posts and playground fixtures
 * that the deferred park layer draws. Surface objects inside tunnel approaches
 * or the Chancellery construction site stay filtered as they are visually.
 */
export function addPedestrianParkObstacles(
  environment: PedestrianEnvironment,
  payload: ParkDetailsPayload,
  tunnel?: TunnelPortalCourseInput | null,
): PedestrianObstacleIndex {
  const index = environment.obstacles ?? emptyPedestrianObstacleIndex();
  environment.obstacles = index;
  if (index.parkDetailsAdded) {
    return index;
  }
  const insideTunnelApproach = tunnel
    ? createTunnelPortalApproachTester(tunnel)
    : null;
  const trees = decodeTrees(payload.trees, payload.tree_vocabulary);
  for (const tree of trees) {
    const [x, y, z] = tree.position;
    if (
      isChancelleryExtensionConstructionPoint(x, z) ||
      insideTunnelApproach?.(x, z, tree.crown_radius_m + 1.5)
    ) {
      continue;
    }
    const isShrub = tree.tree_group?.toLowerCase().includes("strauch") ?? false;
    const radius = isShrub
      ? clamp(tree.crown_radius_m * 0.55, 0.3, 1.5)
      : clamp(tree.trunk_radius_m ?? 0.22, 0.16, 1.5);
    const before = index.obstacleCount;
    addCircleObstacle(
      index,
      x,
      z,
      radius,
      y,
      y + Math.max(1, tree.height_m),
      isLenneOakTree(tree) ? "lenne-oak" : "ordinary",
    );
    if (index.obstacleCount > before) {
      index.treeCount += 1;
    }
  }
  for (const [x, y, z, height, radius, variant] of parkShrubClusters(
    payload.shrub_patches ?? [],
    insideTunnelApproach,
  )) {
    const before = index.obstacleCount;
    const renderedRadius = radius * (variant === 1 ? 1.16 : 1);
    addCircleObstacle(
      index,
      x,
      z,
      renderedRadius,
      y,
      y + Math.max(0.1, height),
    );
    if (index.obstacleCount > before) {
      index.shrubClusterCount += 1;
    }
  }
  for (const light of payload.street_lights ?? []) {
    const [x, y, z] = light.position;
    if (
      isChancelleryExtensionConstructionPoint(x, z) ||
      insideTunnelApproach?.(x, z, 0.8)
    ) {
      continue;
    }
    const before = index.obstacleCount;
    addCircleObstacle(index, x, z, 0.16, y, y + Math.max(1, light.height_m));
    if (index.obstacleCount > before) {
      index.streetLightCount += 1;
    }
  }
  for (const playground of payload.playgrounds) {
    for (const item of playground.equipment) {
      const radius = equipmentRadius(item);
      if (radius === null) {
        continue;
      }
      const [x, y, z] = item.position;
      const before = index.obstacleCount;
      addCircleObstacle(index, x, z, radius, y, y + 3.2);
      if (index.obstacleCount > before) {
        index.playgroundEquipmentCount += 1;
      }
    }
  }
  for (const segment of parkHedgeSegments(payload.hedges ?? [])) {
    const x = (segment.from[0] + segment.to[0]) / 2;
    const z = (segment.from[2] + segment.to[2]) / 2;
    if (insideTunnelApproach?.(x, z, segment.widthM)) {
      continue;
    }
    const before = index.obstacleCount;
    addSegmentObstacle(
      index,
      [segment.from[0], segment.from[2]],
      [segment.to[0], segment.to[2]],
      segment.widthM / 2,
      Math.min(segment.from[1], segment.to[1]),
      Math.max(segment.from[1], segment.to[1]) + segment.heightM,
    );
    if (index.obstacleCount > before) {
      index.hedgeSegmentCount += 1;
    }
  }
  for (const hedge of payload.hedges ?? []) {
    if (hedge.kind !== "area" || !hedge.rings || hedge.rings.length === 0) {
      continue;
    }
    const rings = hedge.rings.filter((ring) => ring.length >= 3);
    if (rings.length === 0) continue;
    const toGroundRing = (
      ring: [number, number, number][],
    ): Array<readonly [number, number]> =>
      ring.map(([x, , z]) => [x, z] as const);
    const heights = rings.flatMap((ring) => ring.map(([, y]) => y));
    const before = index.obstacleCount;
    addPolygonObstacle(
      index,
      toGroundRing(rings[0]),
      rings.slice(1).map(toGroundRing),
      Math.min(...heights),
      Math.max(...heights) + hedge.height_m,
      hedge.id,
    );
    if (index.obstacleCount > before) {
      index.hedgeAreaCount += 1;
    }
  }
  for (const trace of payload.wall_traces ?? []) {
    for (let point = 1; point < trace.points.length; point += 1) {
      const from = trace.points[point - 1];
      const to = trace.points[point];
      const before = index.obstacleCount;
      addSegmentObstacle(
        index,
        [from[0], from[2]],
        [to[0], to[2]],
        0.18,
        Math.min(from[1], to[1]),
        Math.max(from[1], to[1]) + 2.4,
      );
      if (index.obstacleCount > before) {
        index.wallSegmentCount += 1;
      }
    }
  }
  index.parkDetailsAdded = true;
  return index;
}

function squaredDistanceToSegment(
  x: number,
  z: number,
  from: readonly number[],
  to: readonly number[],
): number {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const progress =
    lengthSquared > 1e-12
      ? clamp(((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared, 0, 1)
      : 0;
  return (
    (x - (from[0] + dx * progress)) ** 2 + (z - (from[1] + dz * progress)) ** 2
  );
}

function squaredDistanceToRing(
  x: number,
  z: number,
  ring: PedestrianRing,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length; index += 1) {
    nearest = Math.min(
      nearest,
      squaredDistanceToSegment(
        x,
        z,
        ring[index],
        ring[(index + 1) % ring.length],
      ),
    );
  }
  return nearest;
}

function pointIsInsidePolygonObstacle(
  x: number,
  z: number,
  obstacle: PedestrianPolygonObstacle,
): boolean {
  const sourceX = x / obstacle.coordinateScale;
  const sourceZ = z / obstacle.coordinateScale;
  if (!pointInPedestrianRing(sourceX, sourceZ, obstacle.ring)) {
    return false;
  }
  return !obstacle.holes.some((hole) =>
    pointInPedestrianRing(sourceX, sourceZ, hole),
  );
}

function pointTouchesPolygonObstacle(
  x: number,
  z: number,
  obstacle: PedestrianPolygonObstacle,
): boolean {
  const sourceX = x / obstacle.coordinateScale;
  const sourceZ = z / obstacle.coordinateScale;
  const paddingSquared =
    (PEDESTRIAN_BODY_RADIUS_M / obstacle.coordinateScale) ** 2;
  const insideOuter = pointInPedestrianRing(sourceX, sourceZ, obstacle.ring);
  if (
    !insideOuter &&
    squaredDistanceToRing(sourceX, sourceZ, obstacle.ring) > paddingSquared
  ) {
    return false;
  }
  for (const hole of obstacle.holes) {
    if (
      pointInPedestrianRing(sourceX, sourceZ, hole) &&
      squaredDistanceToRing(sourceX, sourceZ, hole) > paddingSquared
    ) {
      return false;
    }
  }
  return true;
}

/** Local roof height, retaining capsule clearance just outside a wall/court. */
function polygonObstacleTopAt(
  x: number,
  z: number,
  obstacle: PedestrianPolygonObstacle,
): number {
  if (!obstacle.topAt) return obstacle.maxY;
  const direct = obstacle.topAt(x, z);
  if (direct !== null) return direct;
  // The centre can sit in a courtyard while its capsule still touches a wall.
  // Query just inside the nearest source edge rather than using the tallest
  // roof over every padded boundary of the building.
  let nearestSquared = Number.POSITIVE_INFINITY;
  let nearestTop = obstacle.maxY;
  for (const ring of [obstacle.ring, ...obstacle.holes]) {
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      const ax = a[0] * obstacle.coordinateScale;
      const az = a[1] * obstacle.coordinateScale;
      const dx = (b[0] - a[0]) * obstacle.coordinateScale;
      const dz = (b[1] - a[1]) * obstacle.coordinateScale;
      const lengthSquared = dx * dx + dz * dz;
      if (lengthSquared < 1e-12) continue;
      const progress = clamp(((x - ax) * dx + (z - az) * dz) / lengthSquared, 1e-7, 1 - 1e-7);
      const edgeX = ax + progress * dx;
      const edgeZ = az + progress * dz;
      const distanceSquared = (x - edgeX) ** 2 + (z - edgeZ) ** 2;
      if (distanceSquared >= nearestSquared) continue;
      const inverseLength = 1 / Math.sqrt(lengthSquared);
      const sampleEdge = (inset: number): number | null => {
        const offset = inset * inverseLength;
        return obstacle.topAt!(edgeX - dz * offset, edgeZ + dx * offset)
          ?? obstacle.topAt!(edgeX + dz * offset, edgeZ - dx * offset);
      };
      // Detailed roof planes retain millimetres; source obstacle plans are
      // rounded to decimetres (up to 0.071 m displacement). If the infinitesimal
      // probe misses, sample just inside that bounded rounding band instead
      // of borrowing a distant ridge's height over the visible low eave.
      const top = sampleEdge(1e-5) ?? sampleEdge(0.1);
      if (top !== null) {
        nearestSquared = distanceSquared;
        nearestTop = top;
      }
    }
  }
  return nearestTop;
}

/** Highest represented roof directly below an eye-height hint at exact X/Z. */
function pedestrianRoofGroundAt(
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  ceilingY: number | undefined,
): number | null {
  const obstacles = environment.obstacles;
  if (!obstacles || !Number.isFinite(ceilingY)) return null;
  const key = pedestrianObstacleCellKey(
    Math.floor(x / obstacles.cellSizeM),
    Math.floor(z / obstacles.cellSizeM),
  );
  const nearbyObstacles = obstacles.cells.get(key);
  if (!nearbyObstacles) return null;
  let highest = Number.NEGATIVE_INFINITY;
  for (const obstacle of nearbyObstacles) {
    if (
      obstacle.kind !== "polygon" ||
      !obstacle.sourceId ||
      !pointIsInsidePolygonObstacle(x, z, obstacle)
    ) {
      continue;
    }
    const top = polygonObstacleTopAt(x, z, obstacle);
    // A 22 cm movement substep can climb 9 cm on the authored glass hip.
    // Keep flat source roofs' existing tolerance; only a variable roof needs
    // this bounded rise allowance to avoid stalling on its upward slope.
    const riseAllowance = obstacle.topAt ? 0.15 : 0.05;
    if (top <= ceilingY! + riseAllowance) highest = Math.max(highest, top);
  }
  return Number.isFinite(highest) ? highest : null;
}

function pedestrianBodyTouchesProtectedVolume(
  x: number,
  z: number,
  bodyBottomY: number,
  tester: NonNullable<PedestrianEnvironment["protectedVolumeAt"]>,
): boolean {
  const bodyTopY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M;
  const bodyMiddleY = (bodyBottomY + bodyTopY) / 2;
  return (
    tester(x, bodyBottomY, z) ||
    tester(x, bodyMiddleY, z) ||
    tester(x, bodyTopY, z) ||
    tester(x - PEDESTRIAN_BODY_RADIUS_M, bodyMiddleY, z) ||
    tester(x + PEDESTRIAN_BODY_RADIUS_M, bodyMiddleY, z) ||
    tester(x, bodyMiddleY, z - PEDESTRIAN_BODY_RADIUS_M) ||
    tester(x, bodyMiddleY, z + PEDESTRIAN_BODY_RADIUS_M)
  );
}

function pedestrianBodyTouchesInteriorSolid(
  x: number,
  z: number,
  bodyBottomY: number,
  tester: NonNullable<PedestrianEnvironment["interiorSolidAt"]>,
): boolean {
  const bodyTopY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M;
  const bodyMiddleY = (bodyBottomY + bodyTopY) / 2;
  const radius = PEDESTRIAN_BODY_RADIUS_M;
  return (
    tester(x, bodyBottomY, z, radius) ||
    tester(x, bodyMiddleY, z, radius) ||
    tester(x, bodyTopY, z, radius) ||
    // Offset samples already lie on the capsule boundary. Expanding each by
    // its radius again falsely closed narrow doors and bridge approaches.
    tester(x - radius, bodyMiddleY, z, 0) ||
    tester(x + radius, bodyMiddleY, z, 0) ||
    tester(x, bodyMiddleY, z - radius, 0) ||
    tester(x, bodyMiddleY, z + radius, 0)
  );
}

function pedestrianBodyHasWalkableInterior(
  x: number,
  z: number,
  bodyBottomY: number,
  tester: NonNullable<PedestrianEnvironment["walkableInteriorAt"]>,
  sourceId?: string,
): boolean {
  const bodyTopY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M;
  const bodyMiddleY = (bodyBottomY + bodyTopY) / 2;
  const radius = PEDESTRIAN_BODY_RADIUS_M;
  return (
    tester(x, bodyBottomY, z, sourceId) &&
    tester(x, bodyMiddleY, z, sourceId) &&
    tester(x, bodyTopY, z, sourceId) &&
    tester(x - radius, bodyMiddleY, z, sourceId) &&
    tester(x + radius, bodyMiddleY, z, sourceId) &&
    tester(x, bodyMiddleY, z - radius, sourceId) &&
    tester(x, bodyMiddleY, z + radius, sourceId)
  );
}

/** True when a standing pedestrian capsule overlaps a compiled solid. */
export function pedestrianPointIsBlocked(
  x: number,
  z: number,
  bodyBottomY: number,
  obstacles: PedestrianObstacleIndex | undefined,
  access?: Pick<
    PedestrianEnvironment,
    | "interiorSolidAt"
    | "parkTreeSolidAt"
    | "protectedVolumeAt"
    | "walkableInteriorAt"
  >,
): boolean {
  const bodyTopY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M;
  if (
    access?.protectedVolumeAt &&
    pedestrianBodyTouchesProtectedVolume(
      x,
      z,
      bodyBottomY,
      access.protectedVolumeAt,
    )
  ) {
    return true;
  }
  if (
    access?.interiorSolidAt &&
    pedestrianBodyTouchesInteriorSolid(
      x,
      z,
      bodyBottomY,
      access.interiorSolidAt,
    )
  ) {
    return true;
  }
  if (!obstacles) {
    return false;
  }
  const key = pedestrianObstacleCellKey(
    Math.floor(x / obstacles.cellSizeM),
    Math.floor(z / obstacles.cellSizeM),
  );
  const nearbyObstacles = obstacles.cells.get(key);
  if (!nearbyObstacles) return false;
  for (const obstacle of nearbyObstacles) {
    if (
      bodyTopY <= obstacle.minY + 0.02 ||
      bodyBottomY >= obstacle.maxY - 0.02 ||
      x < obstacle.minX - PEDESTRIAN_BODY_RADIUS_M ||
      x > obstacle.maxX + PEDESTRIAN_BODY_RADIUS_M ||
      z < obstacle.minZ - PEDESTRIAN_BODY_RADIUS_M ||
      z > obstacle.maxZ + PEDESTRIAN_BODY_RADIUS_M
    ) {
      continue;
    }
    if (obstacle.kind === "circle") {
      if (
        obstacle.parkTree &&
        access?.parkTreeSolidAt?.(
          obstacle.x,
          obstacle.z,
          obstacle.parkTree === "lenne-oak",
        ) === false
      ) {
        continue;
      }
      const radius = obstacle.radius + PEDESTRIAN_BODY_RADIUS_M;
      if ((x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 <= radius * radius) {
        return true;
      }
    } else if (obstacle.kind === "segment") {
      const radius = obstacle.radius + PEDESTRIAN_BODY_RADIUS_M;
      if (
        squaredDistanceToSegment(x, z, obstacle.from, obstacle.to) <=
        radius * radius
      ) {
        return true;
      }
    } else if (pointTouchesPolygonObstacle(x, z, obstacle)) {
      if (bodyBottomY >= polygonObstacleTopAt(x, z, obstacle) - 0.02) continue;
      if (
        !access?.walkableInteriorAt ||
        !pedestrianBodyHasWalkableInterior(
          x,
          z,
          bodyBottomY,
          access.walkableInteriorAt,
          obstacle.sourceId,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export function compilePedestrianWater(
  payload: Pick<SurfacePayload, "water">,
): PedestrianWaterRegion[] {
  return payload.water.flatMap((surface) => {
    const ring = metricRing(surface.ring);
    if (ring.length < 3) {
      return [];
    }
    const xs = ring.map(([x]) => x);
    const zs = ring.map(([, z]) => z);
    return [
      {
        holes: surface.holes.map(metricRing).filter((hole) => hole.length >= 3),
        maxX: Math.max(...xs),
        maxZ: Math.max(...zs),
        minX: Math.min(...xs),
        minZ: Math.min(...zs),
        ring,
      },
    ];
  });
}

export function pedestrianPointIsWater(
  x: number,
  z: number,
  water: readonly PedestrianWaterRegion[],
): boolean {
  for (const region of water) {
    if (
      x < region.minX ||
      x > region.maxX ||
      z < region.minZ ||
      z > region.maxZ ||
      !pointInPedestrianRing(x, z, region.ring)
    ) {
      continue;
    }
    let insideHole = false;
    for (const hole of region.holes) {
      if (pointInPedestrianRing(x, z, hole)) {
        insideHole = true;
        break;
      }
    }
    if (!insideHole) {
      return true;
    }
  }
  return false;
}

export function createPedestrianEnvironment(
  ground: VoxelPayload,
  surfaces: Pick<SurfacePayload, "water">,
  tunnel?: TunnelPortalCourseInput | null,
  prisms?: Pick<PrismPayload, "buildings"> | null,
): PedestrianEnvironment {
  const smoothGround = smoothGroundTopSampler(ground);
  const cell = ground.cell_m;
  const {
    cols,
    min_x_idx: minXIndex,
    min_z_idx: minZIndex,
    rows,
  } = ground.grid;
  const bounds = {
    maxX: (minXIndex + cols) * cell,
    maxZ: (minZIndex + rows) * cell,
    minX: minXIndex * cell,
    minZ: minZIndex * cell,
  };
  const surfaceGroundAt = (x: number, z: number): number | null => {
    const xOffset = x / cell - minXIndex;
    const zOffset = z / cell - minZIndex;
    if (xOffset < 0 || zOffset < 0 || xOffset >= cols || zOffset >= rows) {
      return null;
    }
    const terrain = spreebogenTerrainYAt(x,z,smoothGround(xOffset, zOffset));
    const site = topographySiteSurfaceAt(x, z);
    return site === null ? terrain : Math.max(terrain, site);
  };
  const tunnelSegments = tunnel
    ? tunnelWalkCourses(tunnel).flatMap((course) =>
        course.points.slice(0, -1).map((from, index) => {
          const to = course.points[index + 1];
          const dx = to[0] - from[0];
          const dz = to[2] - from[2];
          return {
            dx,
            dz,
            from,
            halfWidthM: course.halfWidthM,
            kind: course.kind,
            lengthSquared: dx * dx + dz * dz,
            to,
          };
        }),
      )
    : [];
  const resolveGround: NonNullable<PedestrianEnvironment["resolveGround"]> = (
    x,
    z,
    currentLayer,
    groundYHint,
  ) => {
    const surfaceY = surfaceGroundAt(x, z);
    let nearestTunnelKind: "portal" | "tube" | null = null;
    let nearestTunnelScore = Number.POSITIVE_INFINITY;
    let nearestTunnelY = 0;
    for (const segment of tunnelSegments) {
      const progress =
        segment.lengthSquared > 1e-8
          ? clamp(
              ((x - segment.from[0]) * segment.dx +
                (z - segment.from[2]) * segment.dz) /
                segment.lengthSquared,
              0,
              1,
            )
          : 0;
      const closestX = segment.from[0] + segment.dx * progress;
      const closestZ = segment.from[2] + segment.dz * progress;
      const distanceSquared = (x - closestX) ** 2 + (z - closestZ) ** 2;
      if (distanceSquared > (segment.halfWidthM + 0.35) ** 2) {
        continue;
      }
      if (currentLayer !== "tunnel" && segment.kind !== "portal") {
        continue;
      }
      const y = segment.from[1] + (segment.to[1] - segment.from[1]) * progress;
      const score = Number.isFinite(groundYHint)
        ? Math.abs(y - groundYHint!)
        : distanceSquared;
      if (score < nearestTunnelScore) {
        nearestTunnelKind = segment.kind;
        nearestTunnelScore = score;
        nearestTunnelY = y;
      }
    }
    if (nearestTunnelKind) {
      const useTunnel =
        currentLayer === "tunnel" ||
        surfaceY === null ||
        !Number.isFinite(groundYHint) ||
        Math.abs(nearestTunnelY - groundYHint!) <=
          Math.abs(surfaceY - groundYHint!) + 0.35;
      if (useTunnel) {
        return {
          insideTunnel:
            nearestTunnelKind === "tube" ||
            surfaceY === null ||
            nearestTunnelY < surfaceY - 0.75,
          layer: "tunnel",
          y: nearestTunnelY,
        };
      }
    }
    return surfaceY === null
      ? null
      : { insideTunnel: false, layer: "surface", y: surfaceY };
  };
  const environment: PedestrianEnvironment = {
    bounds,
    groundAt: surfaceGroundAt,
    resolveGround,
    water: compilePedestrianWater(surfaces),
  };
  environment.obstacles = prisms ? compilePedestrianObstacles(
    prisms, () => environment.visualMode?.() ?? "day",
  ) : undefined;
  environment.bridgeGroundAt = createPedestrianBridgeGround(
    ground,
    () => environment.visualMode?.() ?? "day",
    PEDESTRIAN_BODY_RADIUS_M,
  );
  return environment;
}

function resolvePedestrianGround(
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  currentLayer: PedestrianState["groundLayer"],
  groundYHint?: number,
): PedestrianGround | null {
  if (currentLayer !== "tunnel") {
    const roofY = pedestrianRoofGroundAt(environment, x, z, groundYHint);
    if (roofY !== null) {
      return { insideTunnel: false, layer: "surface", y: roofY };
    }
    const interiorY = environment.interiorGroundAt?.(x, z, groundYHint);
    if (typeof interiorY === "number" && Number.isFinite(interiorY)) {
      return { insideTunnel: false, layer: "surface", y: interiorY };
    }
    const bridgeY = environment.bridgeGroundAt?.(x, z);
    if (typeof bridgeY === "number" && Number.isFinite(bridgeY)) {
      return { insideTunnel: false, layer: "surface", y: bridgeY };
    }
  }
  if (environment.resolveGround) {
    return environment.resolveGround(x, z, currentLayer, groundYHint);
  }
  const y = environment.groundAt(x, z);
  return y === null
    ? null
    : ({ insideTunnel: false, layer: "surface", y } as const);
}

function pedestrianGroundIsWater(
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  ground: PedestrianGround,
): boolean {
  if (ground.layer !== "surface") return false;
  const bridgeY = environment.bridgeGroundAt?.(x, z);
  if (typeof bridgeY === "number" && Math.abs(ground.y - bridgeY) < 0.05) {
    return false;
  }
  return pedestrianPointIsWater(x, z, environment.water);
}

const PEDESTRIAN_SPAWN_VIEW_CLEARANCE_M = 10;
const PEDESTRIAN_SPAWN_VIEW_SAMPLE_M = 0.5;

function pedestrianSpawnViewClearance(
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  ground: PedestrianGround,
  yaw: number,
): number {
  const directionX = Math.sin(yaw);
  const directionZ = -Math.cos(yaw);
  let clearance = 0;
  for (
    let distance = PEDESTRIAN_SPAWN_VIEW_SAMPLE_M;
    distance <= PEDESTRIAN_SPAWN_VIEW_CLEARANCE_M;
    distance += PEDESTRIAN_SPAWN_VIEW_SAMPLE_M
  ) {
    const sampleX = x + directionX * distance;
    const sampleZ = z + directionZ * distance;
    if (
      !inBounds(sampleX, sampleZ, environment.bounds) ||
      pedestrianPointIsBlocked(
        sampleX,
        sampleZ,
        ground.y,
        environment.obstacles,
        environment,
      ) ||
      pedestrianGroundIsWater(environment, sampleX, sampleZ,
        resolvePedestrianGround(environment, sampleX, sampleZ, ground.layer, ground.y) ?? ground)
    ) {
      break;
    }
    clearance = distance;
  }
  return clearance;
}

function nearestClearPedestrianSpawn(
  environment: PedestrianEnvironment,
  spawn: PedestrianSpawn,
  requestedGround: PedestrianGround,
): { ground: PedestrianGround; spawn: PedestrianSpawn } | null {
  if (
    !pedestrianPointIsBlocked(
      spawn.x,
      spawn.z,
      requestedGround.y,
      environment.obstacles,
      environment,
    ) &&
    !pedestrianGroundIsWater(environment, spawn.x, spawn.z, requestedGround)
  ) {
    return { ground: requestedGround, spawn };
  }
  // Entering walk mode over a roof must place the person beside that building,
  // not inside its walls. A bounded radial search runs only on activation.
  let bestCandidate:
    | { clearance: number; ground: PedestrianGround; spawn: PedestrianSpawn }
    | undefined;
  for (let radius = 1; radius <= 160; radius += 1) {
    for (let direction = 0; direction < 16; direction += 1) {
      const angle = (direction / 16) * Math.PI * 2;
      const x = spawn.x + Math.cos(angle) * radius;
      const z = spawn.z + Math.sin(angle) * radius;
      if (!inBounds(x, z, environment.bounds)) {
        continue;
      }
      const ground = resolvePedestrianGround(
        environment,
        x,
        z,
        requestedGround.layer,
        requestedGround.y,
      );
      if (
        ground === null ||
        pedestrianPointIsBlocked(
          x,
          z,
          ground.y,
          environment.obstacles,
          environment,
        ) ||
        pedestrianGroundIsWater(environment, x, z, ground)
      ) {
        continue;
      }
      const outwardX = x - spawn.x;
      const outwardZ = z - spawn.z;
      const yaw =
        Math.hypot(outwardX, outwardZ) > 1e-6
          ? Math.atan2(outwardX, -outwardZ)
          : spawn.yaw;
      const candidate = {
        clearance: pedestrianSpawnViewClearance(environment, x, z, ground, yaw),
        ground,
        spawn: {
          ...spawn,
          x,
          yaw,
          z,
        },
      };
      if (candidate.clearance >= PEDESTRIAN_SPAWN_VIEW_CLEARANCE_M) {
        return candidate;
      }
      if (!bestCandidate || candidate.clearance > bestCandidate.clearance) {
        bestCandidate = candidate;
      }
    }
  }
  return bestCandidate ?? null;
}

export function createPedestrianState(
  environment: PedestrianEnvironment,
  requestedSpawn: PedestrianSpawn = PEDESTRIAN_RESPAWN,
): PedestrianState {
  const surfaceY = environment.groundAt(requestedSpawn.x, requestedSpawn.z);
  const interiorY = environment.interiorGroundAt?.(
    requestedSpawn.x,
    requestedSpawn.z,
    requestedSpawn.groundYHint,
  );
  const requestedLayer =
    !Number.isFinite(interiorY) &&
    Number.isFinite(requestedSpawn.groundYHint) &&
    surfaceY !== null &&
    requestedSpawn.groundYHint! < surfaceY - 0.75
      ? "tunnel"
      : "surface";
  const requestedGround = resolvePedestrianGround(
    environment,
    requestedSpawn.x,
    requestedSpawn.z,
    requestedLayer,
    requestedSpawn.groundYHint,
  );
  const fallbackGround = resolvePedestrianGround(
    environment,
    PEDESTRIAN_RESPAWN.x,
    PEDESTRIAN_RESPAWN.z,
    "surface",
  );
  const initialSpawn =
    requestedGround === null ? PEDESTRIAN_RESPAWN : requestedSpawn;
  const initialGround = requestedGround ?? fallbackGround;
  const verticalDropTouchesProtectedVolume =
    requestedGround !== null &&
    environment.protectedVolumeAt !== undefined &&
    pedestrianBodyTouchesProtectedVolume(
      requestedSpawn.x,
      requestedSpawn.z,
      requestedGround.y,
      environment.protectedVolumeAt,
    );
  const keepVerticalDrop =
    requestedGround !== null &&
    requestedSpawn.preserveHorizontalPosition === true &&
    !verticalDropTouchesProtectedVolume;
  const clear = initialGround
    ? keepVerticalDrop
      ? { ground: initialGround, spawn: initialSpawn }
      : nearestClearPedestrianSpawn(environment, initialSpawn, initialGround)
    : null;
  const spawn = clear?.spawn ?? initialSpawn;
  const resolvedGround = clear?.ground ?? initialGround;
  return {
    grounded: true,
    groundLayer: resolvedGround?.layer ?? "surface",
    groundY: resolvedGround?.y ?? 4,
    insideTunnel: resolvedGround?.insideTunnel ?? false,
    jumpOffset: 0,
    pitch: clamp(
      "pitch" in spawn && typeof spawn.pitch === "number" ? spawn.pitch : 0,
      -PEDESTRIAN_MAX_PITCH_RAD,
      PEDESTRIAN_MAX_PITCH_RAD,
    ),
    verticalVelocity: 0,
    x: spawn.x,
    yaw: wrapRadians(spawn.yaw),
    z: spawn.z,
  };
}

export function pedestrianViewDirection(state: PedestrianState): {
  x: number;
  y: number;
  z: number;
} {
  const horizontal = Math.cos(state.pitch);
  return {
    x: Math.sin(state.yaw) * horizontal,
    y: Math.sin(state.pitch),
    z: -Math.cos(state.yaw) * horizontal,
  };
}

export function lookPedestrian(
  state: PedestrianState,
  yawDelta: number,
  pitchDelta: number,
): PedestrianState {
  if (yawDelta === 0 && pitchDelta === 0) {
    return state;
  }
  return {
    ...state,
    pitch: clamp(
      state.pitch + pitchDelta,
      -PEDESTRIAN_MAX_PITCH_RAD,
      PEDESTRIAN_MAX_PITCH_RAD,
    ),
    yaw: wrapRadians(state.yaw + yawDelta),
  };
}

export function setPedestrianYaw(
  state: PedestrianState,
  yaw: number,
): PedestrianState {
  return { ...state, yaw: wrapRadians(yaw) };
}

export function jumpPedestrian(
  state: PedestrianState,
  higher = false,
): PedestrianState {
  if (state.grounded) {
    const apex = higher ? PEDESTRIAN_HIGH_JUMP_APEX_M : PEDESTRIAN_JUMP_APEX_M;
    return {
      ...state,
      grounded: false,
      verticalVelocity: Math.sqrt(2 * PEDESTRIAN_GRAVITY_MPS2 * apex),
    };
  }
  if (
    !higher ||
    state.verticalVelocity <= 0 ||
    state.jumpOffset >= PEDESTRIAN_HIGH_JUMP_APEX_M
  ) {
    return state;
  }
  const boostedVelocity = Math.sqrt(
    2 *
      PEDESTRIAN_GRAVITY_MPS2 *
      (PEDESTRIAN_HIGH_JUMP_APEX_M - state.jumpOffset),
  );
  if (boostedVelocity <= state.verticalVelocity) {
    return state;
  }
  return {
    ...state,
    verticalVelocity: boostedVelocity,
  };
}

function inBounds(x: number, z: number, bounds: PedestrianBounds): boolean {
  return (
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
  );
}

export function createPedestrianRecoveryHistory(): PedestrianRecoveryHistory {
  return { checkpoints: [], lastRecorded: null };
}

/** Recheck a standing destination, including body clearance from shorelines. */
function pedestrianRecoveryGround(
  state: PedestrianState,
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  groundYHint = state.groundY,
): PedestrianGround | null {
  const radius = PEDESTRIAN_BODY_RADIUS_M;
  if (
    !Number.isFinite(groundYHint) ||
    !inBounds(x - radius, z - radius, environment.bounds) ||
    !inBounds(x + radius, z + radius, environment.bounds)
  ) return null;
  const ground = resolvePedestrianGround(
    environment, x, z, state.groundLayer, groundYHint,
  );
  // Never exchange a tunnel for its overlying road or switch station floors.
  if (
    !ground || !Number.isFinite(ground.y) || ground.layer !== state.groundLayer ||
    Math.abs(ground.y - groundYHint) > 1.5 ||
    Math.abs(ground.y - state.groundY) > 1.5 ||
    pedestrianPointIsBlocked(
      x, z, ground.y, environment.obstacles, environment,
    )
  ) return null;
  for (const [dx, dz] of [[0, 0], [-radius, 0], [radius, 0], [0, -radius], [0, radius]]) {
    if (pedestrianGroundIsWater(environment, x + dx!, z + dz!, ground)) return null;
  }
  return ground;
}

/** Record only grounded, currently clear positions, at most once per 3 metres. */
export function rememberPedestrianRecoveryState(
  history: PedestrianRecoveryHistory,
  state: PedestrianState,
  environment: PedestrianEnvironment,
): void {
  if (!state.grounded) return;
  const previous = history.lastRecorded;
  if (
    previous && previous.groundLayer === state.groundLayer &&
    Math.abs(previous.groundY - state.groundY) < 1.5 &&
    Math.hypot(previous.x - state.x, previous.z - state.z) < 3
  ) return;
  if (!pedestrianRecoveryGround(state, environment, state.x, state.z)) return;
  const checkpoint = { ...state };
  history.checkpoints.push(checkpoint);
  history.lastRecorded = checkpoint;
  if (history.checkpoints.length > PEDESTRIAN_RECOVERY_CHECKPOINT_LIMIT) {
    history.checkpoints.shift();
  }
}

function pedestrianRecoveryHasExit(
  state: PedestrianState,
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  ground: PedestrianGround,
  firstAngle: number,
): boolean {
  // Check a swept two-metre exit, not just an unoccupied but isolated capsule.
  // This runs only on an explicit recovery request, never in the render loop.
  for (let direction = 0; direction < 8; direction += 1) {
    const angle = firstAngle + direction * Math.PI / 4;
    let clear = true;
    for (let step = 1; step <= 10; step += 1) {
      if (!pedestrianRecoveryGround(
        state, environment,
        x + Math.cos(angle) * step * 0.2,
        z + Math.sin(angle) * step * 0.2,
        ground.y,
      )) {
        clear = false;
        break;
      }
    }
    if (clear) return true;
  }
  return false;
}

/**
 * Explicit local escape: retrace a verified walk point, then try bounded nearby
 * ground. It never changes normal collision rules or falls back to a landmark.
 * Returning `none` leaves the exact state intact for the caller's flight option.
 */
export function recoverPedestrian(
  state: PedestrianState,
  environment: PedestrianEnvironment,
  history: PedestrianRecoveryHistory,
): PedestrianRecoveryResult {
  const finish = (
    x: number,
    z: number,
    ground: PedestrianGround,
    source: "checkpoint" | "nearby",
  ): PedestrianRecoveryResult => {
    const recoveredState: PedestrianState = {
      ...state,
      grounded: true,
      groundLayer: ground.layer,
      groundY: ground.y,
      insideTunnel: ground.insideTunnel,
      jumpOffset: 0,
      verticalVelocity: 0,
      x,
      z,
    };
    // Repeated presses continue back along the trail instead of bouncing
    // between the obstruction and the recovered position.
    history.lastRecorded = recoveredState;
    return { recovered: true, source, state: recoveredState };
  };
  for (let index = history.checkpoints.length - 1; index >= 0; index -= 1) {
    const checkpoint = history.checkpoints[index]!;
    const distance = Math.hypot(checkpoint.x - state.x, checkpoint.z - state.z);
    if (
      distance < 4 || distance > PEDESTRIAN_RECOVERY_RADIUS_M ||
      checkpoint.groundLayer !== state.groundLayer ||
      Math.abs(checkpoint.groundY - state.groundY) > 1.5
    ) continue;
    const ground = pedestrianRecoveryGround(
      state, environment, checkpoint.x, checkpoint.z, checkpoint.groundY,
    );
    if (!ground || !pedestrianRecoveryHasExit(
      state, environment, checkpoint.x, checkpoint.z, ground,
      Math.atan2(checkpoint.z - state.z, checkpoint.x - state.x),
    )) continue;
    history.checkpoints.splice(index);
    return finish(checkpoint.x, checkpoint.z, ground, "checkpoint");
  }
  const backwards = state.yaw + Math.PI / 2;
  for (const radius of [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, PEDESTRIAN_RECOVERY_RADIUS_M]) {
    for (let direction = 0; direction < 24; direction += 1) {
      const angle = backwards + direction * Math.PI / 12;
      const x = state.x + Math.cos(angle) * radius;
      const z = state.z + Math.sin(angle) * radius;
      const ground = pedestrianRecoveryGround(state, environment, x, z);
      if (!ground || !pedestrianRecoveryHasExit(state, environment, x, z, ground, angle)) continue;
      return finish(x, z, ground, "nearby");
    }
  }
  return { recovered: false, source: "none", state };
}

export function stepPedestrian(
  state: PedestrianState,
  input: PedestrianInput,
  deltaSeconds: number,
  environment: PedestrianEnvironment,
): PedestrianStep {
  const dt = clamp(deltaSeconds, 0, MAX_MOTION_FRAME_DELTA_SECONDS);
  if (dt === 0) {
    return { changed: false, respawned: false, state };
  }

  const nextYaw = wrapRadians(
    state.yaw + clamp(input.turn, -1, 1) * PEDESTRIAN_TURN_SPEED_RAD_S * dt,
  );
  const nextPitch = clamp(
    state.pitch + clamp(input.look, -1, 1) * PEDESTRIAN_LOOK_SPEED_RAD_S * dt,
    -PEDESTRIAN_MAX_PITCH_RAD,
    PEDESTRIAN_MAX_PITCH_RAD,
  );
  const rawForward = clamp(input.forward, -1, 1);
  const rawStrafe = clamp(input.strafe, -1, 1);
  const inputLength = Math.max(1, Math.hypot(rawForward, rawStrafe));
  const forward = rawForward / inputLength;
  const strafe = rawStrafe / inputLength;

  let jumpOffset = state.jumpOffset;
  let verticalVelocity = state.verticalVelocity;
  let grounded = state.grounded;
  if (!grounded) {
    jumpOffset +=
      verticalVelocity * dt - (PEDESTRIAN_GRAVITY_MPS2 * dt * dt) / 2;
    verticalVelocity -= PEDESTRIAN_GRAVITY_MPS2 * dt;
    if (jumpOffset <= 0 && verticalVelocity <= 0) {
      jumpOffset = 0;
      verticalVelocity = 0;
      grounded = true;
    }
  }

  const speed =
    PEDESTRIAN_WALK_SPEED_MPS *
    (input.fastRun
      ? PEDESTRIAN_FAST_RUN_MULTIPLIER
      : input.sprint
        ? PEDESTRIAN_SPRINT_MULTIPLIER
        : 1);
  const distance = speed * dt;
  const requestedDx =
    (Math.sin(nextYaw) * forward + Math.cos(nextYaw) * strafe) * distance;
  const requestedDz =
    (-Math.cos(nextYaw) * forward + Math.sin(nextYaw) * strafe) * distance;
  const movementLength = Math.hypot(requestedDx, requestedDz);
  const movementSteps = Math.max(
    1,
    Math.ceil(movementLength / PEDESTRIAN_COLLISION_STEP_M),
  );
  const stepX = requestedDx / movementSteps;
  const stepZ = requestedDz / movementSteps;
  let x = state.x;
  let z = state.z;
  // A style switch can change a block deck by a metre. Merely waiting or
  // looking must not relocate the visitor; resolve support when they move.
  let currentGround =
    (movementLength > 0 ? resolvePedestrianGround(
      environment,
      x,
      z,
      state.groundLayer,
      state.groundY,
    ) : null) ??
    ({
      insideTunnel: state.insideTunnel,
      layer: state.groundLayer,
      y: state.groundY,
    } as const);
  let currentBlocked =
    movementLength > 0 &&
    pedestrianPointIsBlocked(
      x,
      z,
      currentGround.y + jumpOffset,
      environment.obstacles,
      environment,
    );
  let currentInWater =
    movementLength > 0 &&
    pedestrianGroundIsWater(environment, x, z, currentGround);
  let acceptedCandidateBlocked = currentBlocked;
  let acceptedCandidateInWater = currentInWater;

  const acceptedGround = (
    candidateX: number,
    candidateZ: number,
  ): PedestrianGround | null => {
    if (!inBounds(candidateX, candidateZ, environment.bounds)) {
      return null;
    }
    const ground = resolvePedestrianGround(
      environment,
      candidateX,
      candidateZ,
      currentGround.layer,
      currentGround.y,
    );
    if (ground === null) {
      return null;
    }
    if (
      currentBlocked && environment.protectedVolumeAt &&
      pedestrianBodyTouchesProtectedVolume(
        candidateX, candidateZ, ground.y + jumpOffset,
        environment.protectedVolumeAt,
      )
    ) return null;
    const candidateBlocked = pedestrianPointIsBlocked(
      candidateX,
      candidateZ,
      ground.y + jumpOffset,
      environment.obstacles,
      environment,
    );
    const candidateInWater = pedestrianGroundIsWater(
      environment, candidateX, candidateZ, ground,
    );
    // If a deferred obstacle arrives around the current position, permit the
    // next movement to escape it. A normal clear position may never enter one.
    if (candidateBlocked && !currentBlocked) {
      return null;
    }
    // Water is a shoreline collision, not a lethal volume. A dry pedestrian
    // can slide along its edge without ever being teleported to a spawn point.
    if (candidateInWater && !currentInWater) {
      return null;
    }
    acceptedCandidateBlocked = candidateBlocked;
    acceptedCandidateInWater = candidateInWater;
    return ground;
  };

  const accept = (
    candidateX: number,
    candidateZ: number,
    ground: PedestrianGround,
  ): void => {
    x = candidateX;
    z = candidateZ;
    currentGround = ground;
    currentBlocked = acceptedCandidateBlocked;
    currentInWater = acceptedCandidateInWater;
  };

  for (let step = 0; step < movementSteps && movementLength > 0; step += 1) {
    const fullGround = acceptedGround(x + stepX, z + stepZ);
    if (fullGround) {
      accept(x + stepX, z + stepZ, fullGround);
      continue;
    }
    if (Math.abs(stepX) >= Math.abs(stepZ)) {
      if (stepX !== 0) {
        const xGround = acceptedGround(x + stepX, z);
        if (xGround) accept(x + stepX, z, xGround);
      }
      if (stepZ !== 0) {
        const zGround = acceptedGround(x, z + stepZ);
        if (zGround) accept(x, z + stepZ, zGround);
      }
    } else {
      if (stepZ !== 0) {
        const zGround = acceptedGround(x, z + stepZ);
        if (zGround) accept(x, z + stepZ, zGround);
      }
      if (stepX !== 0) {
        const xGround = acceptedGround(x + stepX, z);
        if (xGround) accept(x + stepX, z, xGround);
      }
    }
  }

  const groundY = currentGround.y;
  const groundLayer = currentGround.layer;
  const insideTunnel = currentGround.insideTunnel;

  // An already wet position may advance toward dry ground over several frames.
  // Rejecting every intermediate wet frame permanently trapped slow movement
  // after a deferred shoreline arrived. Dry positions still cannot enter water.

  const changed =
    x !== state.x ||
    z !== state.z ||
    nextYaw !== state.yaw ||
    nextPitch !== state.pitch ||
    groundY !== state.groundY ||
    groundLayer !== state.groundLayer ||
    insideTunnel !== state.insideTunnel ||
    jumpOffset !== state.jumpOffset ||
    verticalVelocity !== state.verticalVelocity ||
    grounded !== state.grounded;
  if (!changed) {
    return { changed: false, respawned: false, state };
  }
  return {
    changed: true,
    respawned: false,
    state: {
      grounded,
      groundLayer,
      groundY,
      insideTunnel,
      jumpOffset,
      pitch: nextPitch,
      verticalVelocity,
      x,
      yaw: nextYaw,
      z,
    },
  };
}
