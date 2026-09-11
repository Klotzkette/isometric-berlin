import { Group } from "three";
import { compactStaticGeometry } from "./compactStaticGeometry";
import { createRestoredRoadSurfaceBatches } from "./restoredRoadSurfaces";

import {
  createIsometricCity,
  createSmoothSurfaces,
  type PrismPayload,
  type SurfacePayload,
} from "./IsometricCityWorld";
import { smoothGroundTopSampler, WATER_TOP_Y } from "./MinecraftVoxelWorld";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import {
  splitProgressiveBuildings,
  splitParkSurfaceFamily,
  surfaceFamilyPayload,
  type ProgressiveWorldWorkerInput,
  type ProgressiveWorldWorkerMessage,
  type ProgressiveWorldWorkerOutput,
} from "./progressiveWorld";
import { BuildingDetailWorker } from "./buildingDetailWorker";
import { PackedBuildingDistrictStore } from "./packedBuildingDistrictStore";
import {
  buildingDetailProfile, buildingDetailDistricts, selectBuildingDetailDistricts,
} from "./buildingDetailStreaming";
import { serializeObject3DForTransfer } from "./transferableObject3D";

type WorkerScope = {
  onmessage: ((event: MessageEvent<ProgressiveWorldWorkerMessage>) => void) | null;
  postMessage: (message: ProgressiveWorldWorkerOutput, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;
const attachedBatchResolvers = new Map<string, () => void>();
const attachedBatchPromises = new Map<string, Promise<void>>();
const MAX_TRANSFERRED_BATCHES_IN_FLIGHT = 4;
let mobileDetailWorker: BuildingDetailWorker | undefined;
let latestMobileView: Extract<ProgressiveWorldWorkerMessage, { type: "detail-view" }> | undefined;

function removeEmptyGroups(root: Group): void {
  for (const child of [...root.children]) {
    if (child instanceof Group) {
      removeEmptyGroups(child);
      if (child.children.length === 0) root.remove(child);
    }
  }
}

async function postBatch(
  root: Group,
  kind: "buildings" | "surfaces",
  id: string,
  startedAt: number,
  replaces?: string,
): Promise<void> {
  removeEmptyGroups(root);
  root.traverse(compactStaticGeometry);
  const { object, transfers } = serializeObject3DForTransfer(root);
  const attached = new Promise<void>((resolve) => {
    attachedBatchResolvers.set(id, () => {
      attachedBatchPromises.delete(id);
      resolve();
    });
  });
  attachedBatchPromises.set(id, attached);
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
  if (attachedBatchPromises.size >= MAX_TRANSFERRED_BATCHES_IN_FLIGHT) {
    await Promise.race(attachedBatchPromises.values());
  }
}

async function waitForAttachedBatches(): Promise<void> {
  await Promise.all(attachedBatchPromises.values());
}

/** Give message delivery and garbage collection a turn between large batches. */
function yieldWorker(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

/** This scope ends after attachment; persistent building callbacks retain no terrain graph. */
async function buildSurfaceFamilies(
  input: ProgressiveWorldWorkerInput,
  completedBatchIds: ReadonlySet<string>,
): Promise<void> {
  const groundPromise = loadJsonResponse(
    input.groundUrl,
    "Ground context",
  );
  const surfacesPromise = loadJsonResponse(
    input.surfacesUrl,
    "Surface polygon",
  );
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
  const postSurfacePayload = async (
    payload: SurfacePayload,
    id: string,
  ): Promise<void> => {
    if (completedBatchIds.has(id)) return;
    const startedAt = performance.now();
    const root = createSmoothSurfaces(
      payload,
      waterTop,
      bankY,
      terrainAt,
      { excludeDistrictMarkings: true },
    );
    await postBatch(root, "surfaces", id, startedAt);
    // One surface and at most one building packet may coexist in flight.
    // The next construction waits for their acknowledged viewer attachment.
    await waitForAttachedBatches();
  };
  const postSurface = async (
    family: Parameters<typeof surfaceFamilyPayload>[1],
  ): Promise<void> => {
    const payload = surfaceFamilyPayload(surfaces, family);
    const roadBatch = roadsByKind.get(family);
    if (roadBatch) payload.roads = roadBatch;
    await postSurfacePayload(payload, `surface-${family}`);
    if (roadBatch) roadBatch.length = 0;
    if (family === "water") {
      surfaces.water = [];
      surfaces.sunken_walls = [];
    }
  };

  // Mobile installs the exact whole water family before opening its curtain.
  // Desktop retains the same globally aware family in this worker.
  if (input.detailProfile === "full") await postSurface("water");
  surfaces.water = [];
  surfaces.sunken_walls = [];
  for (const [index, payload] of splitParkSurfaceFamily(
    surfaces,
  ).entries()) {
    await postSurfacePayload(payload, `surface-parks-${index + 1}`);
    await yieldWorker();
  }
  surfaces.parks = [];
  surfaces.scrub_points = [];
  await postSurface("sand");
  await postSurface("earth");
  await postSurface("wood");
  await postSurface("metal");
  const markingPayload = surfaceFamilyPayload(surfaces, "asphalt");
  markingPayload.roads = [];
  await postSurfacePayload(markingPayload, "surface-lane-markings");
  surfaces.lane_markings = [];
  await yieldWorker();
  let roadStartedAt = performance.now();
  for await (const { id, root } of createRestoredRoadSurfaceBatches(ground, completedBatchIds)) {
    await postBatch(root, "surfaces", id, roadStartedAt);
    await waitForAttachedBatches();
    await yieldWorker();
    roadStartedAt = performance.now();
  }
  await waitForAttachedBatches();
}

async function build(input: ProgressiveWorldWorkerInput): Promise<void> {
  const completedBatchIds = new Set(input.completedBatchIds ?? []);
  latestMobileView = {
    type: "detail-view",
    requestedBatchIds: input.requestedBatchIds ?? [],
    retainedBatchIds: [...completedBatchIds],
    viewRevision: input.viewRevision ?? 0,
  };
  const prisms = await loadPrismPayload(input.prismUrl);
  const profile = buildingDetailProfile(input.detailProfile);
  const partition = splitProgressiveBuildings(
    prisms.buildings, input.initialBuildingCount, profile.batchSize, Number.POSITIVE_INFINITY,
  );
  prisms.buildings = [];
  partition.initial.length = 0;
  const defaultWanted = selectBuildingDetailDistricts(
    buildingDetailDistricts(partition.remaining), [317.729, 40.477], undefined,
    { profile: input.detailProfile },
  );
  const batches = new PackedBuildingDistrictStore(partition.remaining);
  await yieldWorker();
  let surfacesReady = false;
  let failed = false;
  let settledRevision: number | undefined;
  let publishedRevision: number | undefined;
  const publishSettled = (): void => {
    if (failed || !surfacesReady || settledRevision === undefined ||
        settledRevision !== latestMobileView?.viewRevision ||
        settledRevision === publishedRevision) return;
    publishedRevision = settledRevision;
    workerScope.postMessage({ type: "settled", viewRevision: settledRevision });
  };
  mobileDetailWorker = new BuildingDetailWorker({
    build: async (id) => {
      const startedAt = performance.now();
      const buildings = batches.read(id);
      const root = createIsometricCity(prisms, null, null, null, {
        buildings, includeContext: false, smoothSurfaces: null,
      });
      buildings.length = 0;
      await postBatch(root, "buildings", id, startedAt,
        id.replace("buildings-", "buildings-preview-"));
      await waitForAttachedBatches();
      await yieldWorker();
    },
    settled: (viewRevision) => { settledRevision = viewRevision; publishSettled(); },
    failed: (error) => {
      failed = true;
      workerScope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    },
  });
  const view = latestMobileView;
  mobileDetailWorker.update(
    view.requestedBatchIds.length ? view.requestedBatchIds : defaultWanted,
    view.retainedBatchIds, view.viewRevision,
  );
  try {
    await buildSurfaceFamilies(input, completedBatchIds);
    surfacesReady = true;
    publishSettled();
  } catch (error) {
    failed = true;
    mobileDetailWorker.stop();
    throw error;
  }
}

workerScope.onmessage = (event): void => {
  if (event.data.type === "detail-view") {
    if (latestMobileView && event.data.viewRevision < latestMobileView.viewRevision) return;
    latestMobileView = event.data;
    mobileDetailWorker?.update(event.data.requestedBatchIds,
      event.data.retainedBatchIds, event.data.viewRevision);
    return;
  }
  if (event.data.type === "batch-attached") {
    const resolve = attachedBatchResolvers.get(event.data.id);
    if (resolve) {
      attachedBatchResolvers.delete(event.data.id);
      resolve();
    }
    return;
  }
  if (event.data.type !== "build") return;
  void build(event.data).catch((error: unknown) => {
    workerScope.postMessage({
      message: error instanceof Error ? error.message : String(error),
      type: "error",
    });
  });
};
