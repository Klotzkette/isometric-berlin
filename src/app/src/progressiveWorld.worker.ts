import { Group } from "three";

import {
  createDistantBuildingShells,
  createIsometricCity,
  createSmoothSurfaces,
  type PrismPayload,
  type SurfacePayload,
} from "./IsometricCityWorld";
import { smoothGroundTopSampler, WATER_TOP_Y } from "./MinecraftVoxelWorld";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import {
  DESKTOP_TOTAL_BUILDING_LIMIT,
  MOBILE_TOTAL_BUILDING_LIMIT,
  splitProgressiveBuildings,
  splitParkSurfaceFamily,
  surfaceFamilyPayload,
  type ProgressiveWorldWorkerInput,
  type ProgressiveWorldWorkerOutput,
} from "./progressiveWorld";
import { serializeObject3DForTransfer } from "./transferableObject3D";

type WorkerScope = {
  onmessage: ((event: MessageEvent<ProgressiveWorldWorkerInput>) => void) | null;
  postMessage: (message: ProgressiveWorldWorkerOutput, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;

function removeEmptyGroups(root: Group): void {
  for (const child of [...root.children]) {
    if (child instanceof Group) {
      removeEmptyGroups(child);
      if (child.children.length === 0) root.remove(child);
    }
  }
}

function postBatch(
  root: Group,
  kind: "buildings" | "surfaces",
  id: string,
  startedAt: number,
  replaces?: string,
): void {
  removeEmptyGroups(root);
  const { object, transfers } = serializeObject3DForTransfer(root);
  workerScope.postMessage(
    {
      build_ms: performance.now() - startedAt,
      id,
      kind,
      object,
      replaces,
      type: "batch",
    },
    transfers,
  );
  // The transferred ArrayBuffers are detached now. Drop the Worker-side scene
  // graph immediately instead of retaining thousands of empty BufferAttribute
  // wrappers until a later pressure-triggered GC cycle.
  root.clear();
}

/** Give message delivery and garbage collection a turn between large batches. */
function yieldWorker(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function postBuildingPreviews(
  prismPayload: PrismPayload,
  buildingBatches: readonly PrismPayload["buildings"][],
): number {
  for (let index = 0; index < buildingBatches.length; index += 1) {
    const startedAt = performance.now();
    const root = createDistantBuildingShells(
      prismPayload,
      buildingBatches[index],
    );
    root.userData.representation = "temporary complete-city preview";
    postBatch(
      root,
      "buildings",
      `buildings-preview-${index + 1}`,
      startedAt,
    );
  }
  return buildingBatches.length;
}

async function postBuildingBatches(
  prismPayload: PrismPayload,
  buildingBatches: readonly PrismPayload["buildings"][],
  batchOffset = 0,
): Promise<number> {
  for (let index = 0; index < buildingBatches.length; index += 1) {
    const startedAt = performance.now();
    const root = createIsometricCity(
      prismPayload,
      null,
      null,
      null,
      {
        buildings: buildingBatches[index],
        includeContext: false,
        smoothSurfaces: null,
      },
    );
    postBatch(
      root,
      "buildings",
      `buildings-${batchOffset + index + 1}`,
      startedAt,
      `buildings-preview-${batchOffset + index + 1}`,
    );
    // The exact geometry owns compact typed buffers now. Release the decoded
    // source objects before yielding so completed batches cannot accumulate
    // behind the Worker's garbage collector.
    buildingBatches[index].length = 0;
    await yieldWorker();
  }
  return buildingBatches.length;
}

async function loadPrismPayload(url: string): Promise<PrismPayload> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`LoD2 prism payload failed with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as PrismPayload;
  if (
    !payload ||
    !Array.isArray(payload.buildings) ||
    !Array.isArray(payload.classes)
  ) {
    throw new Error("LoD2 prism payload is incomplete");
  }
  return payload;
}

async function loadJsonResponse(url: string, label: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} payload failed with HTTP ${response.status}`);
  }
  return response;
}

async function build(input: ProgressiveWorldWorkerInput): Promise<void> {
  const overallStart = performance.now();
  let batchCount = 0;
  if (input.detailProfile === "mobile") {
    // The main-thread preview already owns the coarse raster water, parks and
    // asphalt. Rebuilding those exact surface families in another realm drove
    // phone peaks by hundreds of MiB. Fetching LoD2 directly in this Worker
    // also avoids cloning the 29k-building decoded graph through postMessage.
    const prisms = await loadPrismPayload(input.prismUrl);
    const partition = splitProgressiveBuildings(
      prisms.buildings,
      input.initialBuildingCount,
      undefined,
      MOBILE_TOTAL_BUILDING_LIMIT,
    );
    prisms.buildings = [];
    partition.initial.length = 0;
    if (partition.omitted.length > 0) {
      const startedAt = performance.now();
      postBatch(
        createDistantBuildingShells(prisms, partition.omitted),
        "buildings",
        "buildings-distant",
        startedAt,
      );
      partition.omitted.length = 0;
      batchCount += 1;
      await yieldWorker();
    }
    batchCount += postBuildingPreviews(prisms, partition.remaining);
    await yieldWorker();
    batchCount += await postBuildingBatches(prisms, partition.remaining);
    workerScope.postMessage({
      batches: batchCount,
      build_ms: performance.now() - overallStart,
      pretriangulated: false,
      type: "complete",
    });
    return;
  }
  // Start both transfers now, but leave their multi-megabyte JSON graphs
  // undecoded until the first exact building batch has been published.
  const groundPromise = loadJsonResponse(
    input.groundUrl,
    "Ground context",
  );
  const surfacesPromise = loadJsonResponse(
    input.surfacesUrl,
    "Surface polygon",
  );
  const prismPayload = await loadPrismPayload(input.prismUrl);
  const partition = splitProgressiveBuildings(
    prismPayload.buildings,
    input.initialBuildingCount,
    undefined,
    DESKTOP_TOTAL_BUILDING_LIMIT,
  );
  prismPayload.buildings = [];
  partition.initial.length = 0;
  if (partition.omitted.length > 0) {
    const startedAt = performance.now();
    postBatch(
      createDistantBuildingShells(prismPayload, partition.omitted),
      "buildings",
      "buildings-distant",
      startedAt,
    );
    partition.omitted.length = 0;
    batchCount += 1;
  }
  const buildingBatches = partition.remaining;
  batchCount += postBuildingPreviews(prismPayload, buildingBatches);
  await yieldWorker();

  // The nearest exact batch does not depend on terrain or roads. Publish it
  // while those payloads are still decoding instead of serialising all work
  // behind the former road-plate allocation.
  const [nearestBuildingBatch, ...deferredBuildingBatches] = buildingBatches;
  if (nearestBuildingBatch) {
    batchCount += await postBuildingBatches(
      prismPayload,
      [nearestBuildingBatch],
    );
  }

  const [groundResponse, surfacesResponse] = await Promise.all([
    groundPromise,
    surfacesPromise,
  ]);
  const ground = (await groundResponse.json()) as VoxelPayload;
  const surfaces = (await surfacesResponse.json()) as SurfacePayload;
  const terrainSample = smoothGroundTopSampler(ground);
  const terrainAt = (x: number, z: number): number =>
    terrainSample(
      x / ground.cell_m - ground.grid.min_x_idx,
      z / ground.cell_m - ground.grid.min_z_idx,
    );
  const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
  const bankY = waterTop + 5.35;
  const streamedRoadKinds = new Set(["sand", "earth", "wood", "metal"]);
  const roadsByKind = new Map<
    string,
    NonNullable<SurfacePayload["roads"]>
  >();
  for (const road of surfaces.roads ?? []) {
    const kind = road.kind;
    if (!kind || !streamedRoadKinds.has(kind)) continue;
    const family = roadsByKind.get(kind);
    if (family) family.push(road);
    else roadsByKind.set(kind, [road]);
  }
  surfaces.roads = [];
  const postSurfacePayload = (payload: SurfacePayload, id: string): void => {
    const startedAt = performance.now();
    const root = createSmoothSurfaces(
      payload,
      waterTop,
      bankY,
      terrainAt,
    );
    postBatch(root, "surfaces", id, startedAt);
    batchCount += 1;
  };
  const postSurface = (
    family: Parameters<typeof surfaceFamilyPayload>[1],
  ): void => {
    const payload = surfaceFamilyPayload(surfaces, family);
    const roadBatch = roadsByKind.get(family);
    if (roadBatch) payload.roads = roadBatch;
    postSurfacePayload(payload, `surface-${family}`);
    if (roadBatch) roadBatch.length = 0;
    if (family === "water") {
      surfaces.water = [];
      surfaces.sunken_walls = [];
    }
  };

  // Water, lawns and the small special-surface families establish the map
  // reading without duplicating the raster streets and authored park paths.
  postSurface("water");
  for (const [index, payload] of splitParkSurfaceFamily(
    surfaces,
  ).entries()) {
    postSurfacePayload(payload, `surface-parks-${index + 1}`);
    await yieldWorker();
  }
  surfaces.parks = [];
  surfaces.scrub_points = [];
  postSurface("sand");
  postSurface("earth");
  postSurface("wood");
  postSurface("metal");
  const markingPayload = surfaceFamilyPayload(surfaces, "asphalt");
  markingPayload.roads = [];
  const markingStartedAt = performance.now();
  postBatch(
    createSmoothSurfaces(markingPayload, waterTop, bankY, terrainAt),
    "surfaces",
    "surface-lane-markings",
    markingStartedAt,
  );
  surfaces.lane_markings = [];
  batchCount += 1;
  await yieldWorker();

  // Exact batches are already merged by material. The permanent distant shell
  // keeps every remaining source building visible in all visual modes.
  batchCount += await postBuildingBatches(
    prismPayload,
    deferredBuildingBatches,
    nearestBuildingBatch ? 1 : 0,
  );
  workerScope.postMessage({
    batches: batchCount,
    build_ms: performance.now() - overallStart,
    pretriangulated: false,
    type: "complete",
  });
}

workerScope.onmessage = (event): void => {
  if (event.data.type !== "build") return;
  void build(event.data).catch((error: unknown) => {
    workerScope.postMessage({
      message: error instanceof Error ? error.message : String(error),
      type: "error",
    });
  });
};
