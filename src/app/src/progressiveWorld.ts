import type {
  PrismBuilding,
  PrismPayload,
  SurfacePayload,
} from "./IsometricCityWorld";
import type { TunnelPortalCourseInput } from "./TunnelPortals";
import type { TransferObject3D } from "./transferableObject3D";
import type { VisualMode } from "./visualMode";

export const DESKTOP_INITIAL_BUILDING_COUNT = 700;
export const MOBILE_INITIAL_BUILDING_COUNT = 320;
/**
 * Every profile keeps all source buildings visible. The nearest buildings use
 * exact LoD2 geometry while the remainder stays present as a compact,
 * mode-aware instanced shell. This caps retained CPU/GPU buffers without
 * opening holes in the city at overview distance.
 */
export const DESKTOP_TOTAL_BUILDING_LIMIT = 12_000;
export const MOBILE_TOTAL_BUILDING_LIMIT = 5_000;
/**
 * The initial near field stays deliberately small, but retaining forty-two
 * 700-building meshes forever multiplied the LoD2 core from 11 draw calls to
 * more than 250. Five-thousand-building Worker batches remain cheap to
 * deserialize, cap the current payload at six follow-up groups and avoid a
 * single very large GPU upload.
 */
export const PROGRESSIVE_BUILDING_BATCH_SIZE = 5_000;
export const MAX_PROGRESSIVE_BUILDING_BATCHES = 3;
export const PAVING_POLYGON_BATCH_SIZE = 100;
export const PROGRESSIVE_WORLD_IDLE_TIMEOUT_MS = 600;
export const PROGRESSIVE_WORLD_FALLBACK_DELAY_MS = 60;

type ProgressiveWorldWorkerInputBase = {
  initialBuildingCount: number;
  type: "build";
};

export type ProgressiveWorldWorkerInput =
  | (ProgressiveWorldWorkerInputBase & {
      detailProfile: "full";
      groundUrl: string;
      prismUrl: string;
      surfacesUrl: string;
      tunnel: TunnelPortalCourseInput | null;
    })
  | (ProgressiveWorldWorkerInputBase & {
      /** Mobile fetches source in-worker; no large decoded graph is cloned. */
      detailProfile: "mobile";
      prismUrl: string;
    });

export type ProgressiveWorldBatchKind = "buildings" | "surfaces";
export type ProgressiveWorldState = "complete" | "failed" | "idle" | "loading";
export type ProgressiveWorldTransition = "none" | "pause" | "resume";
export type ProgressiveWorldStopReason = "complete" | "error" | "pause";

/**
 * Exact asphalt/paving plates were the worker's dominant transient allocation
 * and duplicated the already visible raster streets plus authored ParkDetails
 * paths. Every profile now retains that compact representation and builds only
 * inexpensive lane-marking lines from the road payload.
 */
export function progressiveHeavyRoadPlatesEnabled(
  _detailProfile: ProgressiveWorldWorkerInput["detailProfile"],
): boolean {
  return false;
}

export type ProgressiveWorldWorkerOutput =
  | {
      build_ms: number;
      id: string;
      kind: ProgressiveWorldBatchKind;
      object: TransferObject3D;
      replaces?: string;
      type: "batch";
    }
  | {
      batches: number;
      build_ms: number;
      pretriangulated: boolean;
      type: "complete";
    }
  | { message: string; type: "error" };

/**
 * Do not spend several GiB refining a hidden Day world while Minecraft is
 * active. Drawn-mode changes keep the same Worker alive; every arriving batch
 * is materialised for the then-current mode by ThreeViewer.
 */
export function progressiveWorldTransition(
  mode: VisualMode,
  state: ProgressiveWorldState,
): ProgressiveWorldTransition {
  if (mode === "minecraft") {
    return state === "loading" || state === "complete" ? "pause" : "none";
  }
  return state === "idle" ? "resume" : "none";
}

/**
 * A background tab must not keep constructing transferable city geometry.
 * Pausing disposes every already attached partial batch, so a visible-tab
 * restart can replay the deterministic Worker output without duplicates.
 */
export function progressiveWorldVisibilityTransition(
  hidden: boolean,
  state: ProgressiveWorldState,
): ProgressiveWorldTransition {
  if (hidden) return state === "loading" ? "pause" : "none";
  return state === "idle" ? "resume" : "none";
}

export function progressiveWorldStopPolicy(
  reason: ProgressiveWorldStopReason,
): { disposePartialBatches: boolean; nextState: ProgressiveWorldState } {
  switch (reason) {
    case "pause":
      return { disposePartialBatches: true, nextState: "idle" };
    case "error":
      // The bounded exact near field and every successfully received batch are
      // a usable fallback; never replace them with a synchronous rebuild.
      return { disposePartialBatches: false, nextState: "failed" };
    case "complete":
      return { disposePartialBatches: false, nextState: "complete" };
  }
}

/** Keep unavailable Worker APIs/CSP failures outside the preview promise. */
export function tryProgressiveWorkerOperation<T>(
  operation: () => T,
): { ok: true; value: T } | { error: unknown; ok: false } {
  try {
    return { ok: true, value: operation() };
  } catch (error: unknown) {
    return { error, ok: false };
  }
}

/** Dispose each partial batch exactly once before a paused Worker restarts. */
export function releaseProgressiveWorldBatches<T>(
  batches: T[],
  dispose: (batch: T) => void,
): void {
  for (const batch of batches.splice(0)) dispose(batch);
}

function centroidDistanceSquared(
  building: PrismBuilding,
  centerX: number,
  centerZ: number,
): number {
  if (building.ring.length === 0) return Number.POSITIVE_INFINITY;
  let x = 0;
  let z = 0;
  for (const point of building.ring) {
    x += point[0] / 10;
    z += point[1] / 10;
  }
  x /= building.ring.length;
  z /= building.ring.length;
  return (x - centerX) ** 2 + (z - centerZ) ** 2;
}

/** Stable near-to-far order around the authored Reichstag startup view. */
export function prioritizeBuildings(
  buildings: readonly PrismBuilding[],
  center: readonly [number, number] = [317.729, 40.477],
): PrismBuilding[] {
  return buildings
    .map((building, index) => ({
      building,
      distance: centroidDistanceSquared(building, center[0], center[1]),
      index,
    }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .map(({ building }) => building);
}

type SpatialBuilding = {
  building: PrismBuilding;
  index: number;
  x: number;
  z: number;
};

function spatialBuilding(building: PrismBuilding, index: number): SpatialBuilding {
  if (building.ring.length === 0) {
    return { building, index, x: 0, z: 0 };
  }
  let x = 0;
  let z = 0;
  for (const point of building.ring) {
    x += point[0] / 10;
    z += point[1] / 10;
  }
  return {
    building,
    index,
    x: x / building.ring.length,
    z: z / building.ring.length,
  };
}

function splitSpatialEntries(
  entries: SpatialBuilding[],
  batchCount: number,
): SpatialBuilding[][] {
  if (batchCount <= 1 || entries.length <= 1) return [entries];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    minX = Math.min(minX, entry.x);
    maxX = Math.max(maxX, entry.x);
    minZ = Math.min(minZ, entry.z);
    maxZ = Math.max(maxZ, entry.z);
  }
  const axis: "x" | "z" = maxX - minX >= maxZ - minZ ? "x" : "z";
  entries.sort(
    (left, right) =>
      left[axis] - right[axis] ||
      left[axis === "x" ? "z" : "x"] -
        right[axis === "x" ? "z" : "x"] ||
      left.index - right.index,
  );
  const leftBatchCount = Math.floor(batchCount / 2);
  const leftSize = Math.round(
    (entries.length * leftBatchCount) / batchCount,
  );
  return [
    ...splitSpatialEntries(entries.slice(0, leftSize), leftBatchCount),
    ...splitSpatialEntries(
      entries.slice(leftSize),
      batchCount - leftBatchCount,
    ),
  ];
}

/** Compact exact batches let Three.js cull off-camera districts as a unit. */
export function spatialBuildingBatches(
  buildings: readonly PrismBuilding[],
  batchSize: number,
  center: readonly [number, number] = [317.729, 40.477],
): PrismBuilding[][] {
  if (buildings.length === 0) return [];
  const boundedBatch = Math.max(1, Math.floor(batchSize));
  const batchCount = Math.ceil(buildings.length / boundedBatch);
  return splitSpatialEntries(
    buildings.map(spatialBuilding),
    batchCount,
  )
    .sort((left, right) => {
      const nearest = (batch: SpatialBuilding[]): number =>
        batch.reduce(
          (distance, entry) =>
            Math.min(
              distance,
              (entry.x - center[0]) ** 2 + (entry.z - center[1]) ** 2,
            ),
          Number.POSITIVE_INFINITY,
        );
      return nearest(left) - nearest(right) || left[0].index - right[0].index;
    })
    .map((batch) => batch.map(({ building }) => building));
}

export function splitProgressiveBuildings(
  buildings: readonly PrismBuilding[],
  initialCount: number,
  batchSize = PROGRESSIVE_BUILDING_BATCH_SIZE,
  totalLimit = Number.POSITIVE_INFINITY,
): {
  initial: PrismBuilding[];
  omitted: PrismBuilding[];
  remaining: PrismBuilding[][];
} {
  const boundedTotal = Math.max(
    0,
    Math.min(buildings.length, Math.floor(totalLimit)),
  );
  const sourceCompleteOrder = prioritizeBuildings(buildings);
  const ordered = sourceCompleteOrder.slice(0, boundedTotal);
  const boundedInitial = Math.max(0, Math.min(ordered.length, initialCount));
  const boundedBatch = Math.max(1, Math.floor(batchSize));
  const remaining = spatialBuildingBatches(
    ordered.slice(boundedInitial),
    boundedBatch,
  );
  return {
    initial: ordered.slice(0, boundedInitial),
    omitted: sourceCompleteOrder.slice(boundedTotal),
    remaining,
  };
}

export function surfaceFamilyPayload(
  source: SurfacePayload,
  family:
    | "asphalt"
    | "earth"
    | "metal"
    | "parks"
    | "paving"
    | "sand"
    | "water"
    | "wood",
): SurfacePayload {
  const roadFamily = family !== "parks" && family !== "water";
  return {
    ...source,
    lane_markings: family === "asphalt" ? source.lane_markings : [],
    parks: family === "parks" ? source.parks : [],
    roads: roadFamily
      ? (source.roads ?? []).filter((road) => road.kind === family)
      : [],
    scrub_points: family === "parks" ? source.scrub_points : [],
    sunken_walls: family === "water" ? source.sunken_walls : [],
    water: family === "water" ? source.water : [],
  };
}

/**
 * Preserve every source polygon while bounding the transient tessellation of
 * an already partitioned road family. Paving has no kerb side effects, so its
 * source-order chunks are visually and geometrically identical to the former
 * one-shot plate, apart from harmless duplicated seam vertices.
 */
export function splitRoadSurfaceFamily(
  source: SurfacePayload,
  family: "paving",
  batchSize = PAVING_POLYGON_BATCH_SIZE,
): SurfacePayload[] {
  const isolated = surfaceFamilyPayload(source, family);
  const roads = isolated.roads ?? [];
  const boundedBatch = Math.max(1, Math.floor(batchSize));
  const batches: SurfacePayload[] = [];
  for (let offset = 0; offset < roads.length; offset += boundedBatch) {
    batches.push({
      ...isolated,
      roads: roads.slice(offset, offset + boundedBatch),
    });
  }
  return batches;
}
