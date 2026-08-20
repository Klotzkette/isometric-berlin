import type {
  PrismBuilding,
  PrismPayload,
  SurfacePayload,
} from "./IsometricCityWorld";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import type { TunnelPortalCourseInput } from "./TunnelPortals";
import type { TransferObject3D } from "./transferableObject3D";
import type { VisualMode } from "./visualMode";

export const DESKTOP_INITIAL_BUILDING_COUNT = 700;
export const MOBILE_INITIAL_BUILDING_COUNT = 320;
/**
 * Coarse-pointer devices keep the complete authored near field, but stop the
 * exact LoD2 refinement before a phone has to retain the full 29k-building
 * desktop city.  Five thousand nearest buildings still cover the government
 * quarter and its recognisable approaches while bounding both CPU and GPU
 * memory.  Desktop remains source-complete.
 */
export const MOBILE_TOTAL_BUILDING_LIMIT = 5_000;
/**
 * The initial near field stays deliberately small, but retaining forty-two
 * 700-building meshes forever multiplied the LoD2 core from 11 draw calls to
 * more than 250. Five-thousand-building Worker batches remain cheap to
 * deserialize, cap the current payload at six follow-up groups and avoid a
 * single very large GPU upload.
 */
export const PROGRESSIVE_BUILDING_BATCH_SIZE = 5_000;
export const MAX_PROGRESSIVE_BUILDING_BATCHES = 6;
export const PAVING_POLYGON_BATCH_SIZE = 100;

type ProgressiveWorldWorkerInputBase = {
  initialBuildingCount: number;
  prismPayload: PrismPayload;
  type: "build";
};

export type ProgressiveWorldWorkerInput =
  | (ProgressiveWorldWorkerInputBase & {
      detailProfile: "full";
      ground: VoxelPayload;
      sceneRootUrl: string;
      surfaces: SurfacePayload;
      tunnel: TunnelPortalCourseInput | null;
    })
  | (ProgressiveWorldWorkerInputBase & {
      /** Mobile refines buildings only; ground/surface payloads stay main-thread. */
      detailProfile: "mobile";
    });

export type ProgressiveWorldBatchKind = "buildings" | "surfaces";
export type ProgressiveWorldState = "complete" | "failed" | "idle" | "loading";
export type ProgressiveWorldTransition = "none" | "pause" | "resume";
export type ProgressiveWorldStopReason = "complete" | "error" | "pause";

/**
 * Exact asphalt/paving plates are the worker's dominant transient allocation.
 * Phones retain the preview's raster asphalt and every authored park path
 * from ParkDetails instead; desktop keeps both exact road families.
 */
export function progressiveHeavyRoadPlatesEnabled(
  detailProfile: ProgressiveWorldWorkerInput["detailProfile"],
): boolean {
  return detailProfile === "full";
}

export type ProgressiveWorldWorkerOutput =
  | {
      build_ms: number;
      id: string;
      kind: ProgressiveWorldBatchKind;
      object: TransferObject3D;
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

export function splitProgressiveBuildings(
  buildings: readonly PrismBuilding[],
  initialCount: number,
  batchSize = PROGRESSIVE_BUILDING_BATCH_SIZE,
  totalLimit = Number.POSITIVE_INFINITY,
): { initial: PrismBuilding[]; remaining: PrismBuilding[][] } {
  const boundedTotal = Math.max(
    0,
    Math.min(buildings.length, Math.floor(totalLimit)),
  );
  const ordered = prioritizeBuildings(buildings).slice(0, boundedTotal);
  const boundedInitial = Math.max(0, Math.min(ordered.length, initialCount));
  const boundedBatch = Math.max(1, Math.floor(batchSize));
  const remaining: PrismBuilding[][] = [];
  for (
    let offset = boundedInitial;
    offset < ordered.length;
    offset += boundedBatch
  ) {
    remaining.push(ordered.slice(offset, offset + boundedBatch));
  }
  return { initial: ordered.slice(0, boundedInitial), remaining };
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
