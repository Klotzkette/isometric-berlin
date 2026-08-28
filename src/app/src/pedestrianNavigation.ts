import { isChancelleryExtensionConstructionPoint } from "./chancelleryExtensionProfile";
import type { PrismPayload, SurfacePayload } from "./IsometricCityWorld";
import {
  type VoxelPayload,
  smoothGroundTopSampler,
} from "./MinecraftVoxelWorld";
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
export const PEDESTRIAN_WALK_SPEED_MPS = 6.4;
export const PEDESTRIAN_SPRINT_MULTIPLIER = 4;
export const PEDESTRIAN_FAST_RUN_MULTIPLIER = 8;
export const PEDESTRIAN_TURN_SPEED_RAD_S = Math.PI * 0.62;
export const PEDESTRIAN_LOOK_SPEED_RAD_S = Math.PI * 0.48;
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
  groundAt: (x: number, z: number) => number | null;
  obstacles?: PedestrianObstacleIndex;
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
    },
    { groundYHint: focusPoint.y, point: focusPoint },
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
): PedestrianObstacleIndex {
  const index = emptyPedestrianObstacleIndex();
  for (const building of prisms.buildings) {
    const before = index.obstacleCount;
    addPolygonObstacle(
      index,
      building.ring,
      building.holes ?? [],
      building.y0_dm / 10,
      (building.y0_dm + building.h_dm) / 10,
      building.id,
      0.1,
    );
    if (index.obstacleCount > before) {
      index.buildingCount += 1;
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
    addCircleObstacle(index, x, z, radius, y, y + Math.max(1, tree.height_m));
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

function pointTouchesPolygonObstacle(
  x: number,
  z: number,
  obstacle: PedestrianPolygonObstacle,
): boolean {
  const sourceX = x / obstacle.coordinateScale;
  const sourceZ = z / obstacle.coordinateScale;
  const paddingSquared =
    (PEDESTRIAN_BODY_RADIUS_M / obstacle.coordinateScale) ** 2;
  const insideOuter = pointInPedestrianRing(
    sourceX,
    sourceZ,
    obstacle.ring,
  );
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

function pedestrianBodySamples(
  x: number,
  z: number,
  bodyBottomY: number,
): Array<readonly [number, number, number]> {
  const bodyTopY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M;
  const bodyMiddleY = (bodyBottomY + bodyTopY) / 2;
  return [
    [x, bodyBottomY, z],
    [x, bodyMiddleY, z],
    [x, bodyTopY, z],
    [x - PEDESTRIAN_BODY_RADIUS_M, bodyMiddleY, z],
    [x + PEDESTRIAN_BODY_RADIUS_M, bodyMiddleY, z],
    [x, bodyMiddleY, z - PEDESTRIAN_BODY_RADIUS_M],
    [x, bodyMiddleY, z + PEDESTRIAN_BODY_RADIUS_M],
  ];
}

/** True when a standing pedestrian capsule overlaps a compiled solid. */
export function pedestrianPointIsBlocked(
  x: number,
  z: number,
  bodyBottomY: number,
  obstacles: PedestrianObstacleIndex | undefined,
  access?: Pick<
    PedestrianEnvironment,
    "interiorSolidAt" | "protectedVolumeAt" | "walkableInteriorAt"
  >,
): boolean {
  const bodyTopY = bodyBottomY + PEDESTRIAN_EYE_HEIGHT_M;
  const bodySamples = pedestrianBodySamples(x, z, bodyBottomY);
  if (
    access?.protectedVolumeAt &&
    bodySamples.some(([sampleX, sampleY, sampleZ]) =>
      access.protectedVolumeAt!(sampleX, sampleY, sampleZ),
    )
  ) {
    return true;
  }
  if (
    access?.interiorSolidAt &&
    bodySamples.some(([sampleX, sampleY, sampleZ]) =>
      access.interiorSolidAt!(
        sampleX,
        sampleY,
        sampleZ,
        PEDESTRIAN_BODY_RADIUS_M,
      ),
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
  for (const obstacle of obstacles.cells.get(key) ?? []) {
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
      if (
        !access?.walkableInteriorAt ||
        !bodySamples.every(([sampleX, sampleY, sampleZ]) =>
          access.walkableInteriorAt!(
            sampleX,
            sampleY,
            sampleZ,
            obstacle.sourceId,
          ),
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
    if (!region.holes.some((hole) => pointInPedestrianRing(x, z, hole))) {
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
    return smoothGround(xOffset, zOffset);
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
  const tunnelGroundsAt = (x: number, z: number) =>
    tunnelSegments.flatMap((segment) => {
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
        return [];
      }
      return [
        {
          distanceSquared,
          kind: segment.kind,
          y: segment.from[1] + (segment.to[1] - segment.from[1]) * progress,
        },
      ];
    });
  const resolveGround: NonNullable<PedestrianEnvironment["resolveGround"]> = (
    x,
    z,
    currentLayer,
    groundYHint,
  ) => {
    const surfaceY = surfaceGroundAt(x, z);
    const tunnelGrounds = tunnelGroundsAt(x, z);
    const portalGrounds = tunnelGrounds.filter(
      (candidate) => candidate.kind === "portal",
    );
    const selectable =
      currentLayer === "tunnel" ? tunnelGrounds : portalGrounds;
    const nearestTunnel = selectable.reduce<(typeof selectable)[number] | null>(
      (nearest, candidate) => {
        if (!nearest) return candidate;
        if (Number.isFinite(groundYHint)) {
          return Math.abs(candidate.y - groundYHint!) <
            Math.abs(nearest.y - groundYHint!)
            ? candidate
            : nearest;
        }
        return candidate.distanceSquared < nearest.distanceSquared
          ? candidate
          : nearest;
      },
      null,
    );
    if (nearestTunnel) {
      const useTunnel =
        currentLayer === "tunnel" ||
        surfaceY === null ||
        !Number.isFinite(groundYHint) ||
        Math.abs(nearestTunnel.y - groundYHint!) <=
          Math.abs(surfaceY - groundYHint!) + 0.35;
      if (useTunnel) {
        return {
          insideTunnel:
            nearestTunnel.kind === "tube" ||
            surfaceY === null ||
            nearestTunnel.y < surfaceY - 0.75,
          layer: "tunnel",
          y: nearestTunnel.y,
        };
      }
    }
    return surfaceY === null
      ? null
      : { insideTunnel: false, layer: "surface", y: surfaceY };
  };
  return {
    bounds,
    groundAt: surfaceGroundAt,
    obstacles: prisms ? compilePedestrianObstacles(prisms) : undefined,
    resolveGround,
    water: compilePedestrianWater(surfaces),
  };
}

function resolvePedestrianGround(
  environment: PedestrianEnvironment,
  x: number,
  z: number,
  currentLayer: PedestrianState["groundLayer"],
  groundYHint?: number,
): PedestrianGround | null {
  if (currentLayer !== "tunnel") {
    const interiorY = environment.interiorGroundAt?.(x, z, groundYHint);
    if (typeof interiorY === "number" && Number.isFinite(interiorY)) {
      return { insideTunnel: false, layer: "surface", y: interiorY };
    }
  }
  return (
    environment.resolveGround?.(x, z, currentLayer, groundYHint) ??
    (() => {
      const y = environment.groundAt(x, z);
      return y === null
        ? null
        : ({ insideTunnel: false, layer: "surface", y } as const);
    })()
  );
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
      (ground.layer === "surface" &&
        pedestrianPointIsWater(sampleX, sampleZ, environment.water))
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
    !(
      requestedGround.layer === "surface" &&
      pedestrianPointIsWater(spawn.x, spawn.z, environment.water)
    )
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
        (ground.layer === "surface" &&
          pedestrianPointIsWater(x, z, environment.water))
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
        clearance: pedestrianSpawnViewClearance(
          environment,
          x,
          z,
          ground,
          yaw,
        ),
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
  const clear = initialGround
    ? nearestClearPedestrianSpawn(environment, initialSpawn, initialGround)
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
    const apex = higher
      ? PEDESTRIAN_HIGH_JUMP_APEX_M
      : PEDESTRIAN_JUMP_APEX_M;
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

export function stepPedestrian(
  state: PedestrianState,
  input: PedestrianInput,
  deltaSeconds: number,
  environment: PedestrianEnvironment,
): PedestrianStep {
  const dt = clamp(deltaSeconds, 0, 0.05);
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
  let currentGround =
    resolvePedestrianGround(
      environment,
      x,
      z,
      state.groundLayer,
      state.groundY,
    ) ??
    ({
      insideTunnel: state.insideTunnel,
      layer: state.groundLayer,
      y: state.groundY,
    } as const);

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
    const currentBlocked = pedestrianPointIsBlocked(
      x,
      z,
      currentGround.y + jumpOffset,
      environment.obstacles,
      environment,
    );
    const candidateBlocked = pedestrianPointIsBlocked(
      candidateX,
      candidateZ,
      ground.y + jumpOffset,
      environment.obstacles,
      environment,
    );
    const currentInWater =
      currentGround.layer === "surface" &&
      pedestrianPointIsWater(x, z, environment.water);
    const candidateInWater =
      ground.layer === "surface" &&
      pedestrianPointIsWater(candidateX, candidateZ, environment.water);
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
  };

  for (let step = 0; step < movementSteps && movementLength > 0; step += 1) {
    const fullGround = acceptedGround(x + stepX, z + stepZ);
    if (fullGround) {
      accept(x + stepX, z + stepZ, fullGround);
      continue;
    }
    const axes: Array<readonly [number, number]> =
      Math.abs(stepX) >= Math.abs(stepZ)
        ? [
            [stepX, 0],
            [0, stepZ],
          ]
        : [
            [0, stepZ],
            [stepX, 0],
          ];
    for (const [dx, dz] of axes) {
      if (dx === 0 && dz === 0) {
        continue;
      }
      const axisGround = acceptedGround(x + dx, z + dz);
      if (axisGround) {
        accept(x + dx, z + dz, axisGround);
      }
    }
  }

  const groundY = currentGround.y;
  const groundLayer = currentGround.layer;
  const insideTunnel = currentGround.insideTunnel;

  if (
    grounded &&
    groundLayer === "surface" &&
    pedestrianPointIsWater(x, z, environment.water)
  ) {
    // Late-loaded water geometry may surround an existing position. Keep it
    // stable instead of treating the streamed shoreline as a death volume.
    return {
      changed: false,
      respawned: false,
      state,
    };
  }

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
