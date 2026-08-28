/**
 * Production-payload benchmark for the progressive drawn city.
 *
 * Run a production preview on port 4175 first. The benchmark uses the real
 * Worker, the committed procedural JSON sources and the same bounded main-thread
 * preview build as ThreeViewer. It deliberately retains every received batch,
 * so RSS and steady-state scene counts represent the browser ownership model
 * instead of a build-and-discard microbenchmark.
 */
import { Group, InstancedMesh, LineSegments, Mesh } from "three";

import {
  createIsometricCity,
  PRISM_WORLD_FILE,
  setIsoNightPresentation,
  SURFACE_WORLD_FILE,
  type PrismPayload,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import {
  GROUND_CONTEXT_FILE,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import {
  DESKTOP_INITIAL_BUILDING_COUNT,
  DESKTOP_TOTAL_BUILDING_LIMIT,
  splitProgressiveBuildings,
  type ProgressiveWorldWorkerOutput,
} from "../src/progressiveWorld";
import { deserializeTransferredObject3D } from "../src/transferableObject3D";

const meshRoot = `${import.meta.dir}/../public/mesh/regierungsviertel`;
const sceneRootUrl =
  process.env.BENCHMARK_SCENE_ROOT ??
  "http://127.0.0.1:4175/mesh/regierungsviertel/";

const [prismPayload, ground, surfaces] = await Promise.all([
  Bun.file(`${meshRoot}/lod2-prisms.json`).json() as Promise<PrismPayload>,
  Bun.file(`${meshRoot}/ground-context.json`).json() as Promise<VoxelPayload>,
  Bun.file(`${meshRoot}/surface-polygons.json`).json() as Promise<SurfacePayload>,
]);

const root = new Group();
const startedAt = performance.now();
let peakRss = process.memoryUsage.rss();
let peakRssAtMs = 0;
const memoryTimer = setInterval(() => {
  const rss = process.memoryUsage.rss();
  if (rss > peakRss) {
    peakRss = rss;
    peakRssAtMs = performance.now() - startedAt;
  }
}, 20);

const worker = new Worker(
  new URL("../src/progressiveWorld.worker.ts", import.meta.url).href,
  { name: "progressive-world-benchmark", type: "module" },
);
const buildingPartition = splitProgressiveBuildings(
  prismPayload.buildings,
  DESKTOP_INITIAL_BUILDING_COUNT,
  undefined,
  DESKTOP_TOTAL_BUILDING_LIMIT,
);
const initialBuildings = buildingPartition.initial;
const input = {
  detailProfile: "full" as const,
  groundUrl: new URL(GROUND_CONTEXT_FILE, sceneRootUrl).toString(),
  initialBuildingCount: DESKTOP_INITIAL_BUILDING_COUNT,
  prismUrl: new URL(PRISM_WORLD_FILE, sceneRootUrl).toString(),
  surfacesUrl: new URL(SURFACE_WORLD_FILE, sceneRootUrl).toString(),
  tunnel: null,
  type: "build" as const,
};
const postStartedAt = performance.now();
worker.postMessage(input);
const postInputMs = performance.now() - postStartedAt;

const previewStartedAt = performance.now();
root.add(
  createIsometricCity(prismPayload, ground, null, surfaces, {
    buildings: initialBuildings,
    smoothSurfaces: null,
  }),
);
const previewCpuMs = performance.now() - previewStartedAt;

let batchCount = 0;
let buildingBatchCount = 0;
let firstBatchArrivalMs: number | null = null;
let firstBuildingArrivalMs: number | null = null;
let firstExactBuildingArrivalMs: number | null = null;
let allBuildingsVisibleMs: number | null = null;
let firstSurfaceBuildMs: number | null = null;
let maxAttachMs = 0;
let maxBatchBytes = 0;
let surfaceBatchCount = 0;
const attachTimes: number[] = [];
const attachedBatches = new Map<string, Group>();
const buildingPreviews = new Set<string>();
let distantBuildingsVisible = buildingPartition.omitted.length === 0;
const batchTimeline: Array<{
  arrival_ms: number;
  id: string;
  rss_mib: number;
}> = [];

function descriptorBytes(value: unknown, seen = new Set<ArrayBuffer>()): number {
  if (ArrayBuffer.isView(value)) {
    const buffer = value.buffer;
    if (buffer instanceof ArrayBuffer && !seen.has(buffer)) {
      seen.add(buffer);
      return buffer.byteLength;
    }
    return 0;
  }
  if (!value || typeof value !== "object") return 0;
  let total = 0;
  for (const child of Object.values(value as Record<string, unknown>)) {
    total += descriptorBytes(child, seen);
  }
  return total;
}

function releaseBatch(batch: Group): void {
  batch.removeFromParent();
  batch.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    object.geometry.dispose();
    if (object instanceof InstancedMesh) object.dispose();
  });
  batch.clear();
}

const complete = await new Promise<
  Extract<ProgressiveWorldWorkerOutput, { type: "complete" }>
>((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("Progressive Worker benchmark timed out")),
    60_000,
  );
  worker.onmessage = (event: MessageEvent<ProgressiveWorldWorkerOutput>) => {
    const message = event.data;
    if (message.type === "error") {
      clearTimeout(timeout);
      reject(new Error(message.message));
      return;
    }
    if (message.type === "complete") {
      clearTimeout(timeout);
      resolve(message);
      return;
    }
    const arrivalMs = performance.now() - startedAt;
    firstBatchArrivalMs ??= arrivalMs;
    if (message.kind === "buildings") {
      firstBuildingArrivalMs ??= arrivalMs;
      if (message.id === "buildings-distant") {
        distantBuildingsVisible = true;
        buildingBatchCount += 1;
      } else if (message.id.startsWith("buildings-preview-")) {
        buildingPreviews.add(message.id);
      } else {
        buildingBatchCount += 1;
        firstExactBuildingArrivalMs ??= arrivalMs;
      }
    } else {
      surfaceBatchCount += 1;
      firstSurfaceBuildMs ??= message.build_ms;
    }
    batchCount += 1;
    batchTimeline.push({
      arrival_ms: Number(arrivalMs.toFixed(1)),
      id: message.id,
      rss_mib: Number((process.memoryUsage.rss() / 1024 / 1024).toFixed(1)),
    });
    maxBatchBytes = Math.max(maxBatchBytes, descriptorBytes(message.object));
    const attachStartedAt = performance.now();
    const object = deserializeTransferredObject3D(message.object);
    setIsoNightPresentation(object as Group, false, true, "day");
    if (message.replaces) {
      const replaced = attachedBatches.get(message.replaces);
      if (replaced) {
        attachedBatches.delete(message.replaces);
        releaseBatch(replaced);
      }
    }
    root.add(object);
    attachedBatches.set(message.id, object as Group);
    if (
      distantBuildingsVisible &&
      buildingPreviews.size === buildingPartition.remaining.length &&
      allBuildingsVisibleMs === null
    ) {
      allBuildingsVisibleMs = performance.now() - startedAt;
    }
    const attachMs = performance.now() - attachStartedAt;
    attachTimes.push(attachMs);
    maxAttachMs = Math.max(maxAttachMs, attachMs);
    worker.postMessage({ id: message.id, type: "batch-attached" });
  };
  worker.onerror = (event) => {
    clearTimeout(timeout);
    reject(event.error ?? new Error(event.message));
  };
});

worker.terminate();
clearInterval(memoryTimer);
peakRss = Math.max(peakRss, process.memoryUsage.rss());

let drawCalls = 0;
let object3DCount = 0;
let renderableCount = 0;
let vertices = 0;
let geometryBytes = 0;
const geometries = new Set<object>();
const renderableStats: Array<{
  bytes: number;
  name: string;
  vertices: number;
}> = [];
root.traverse((object) => {
  object3DCount += 1;
  if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
  renderableCount += 1;
  const geometry = object.geometry;
  drawCalls += Array.isArray(object.material)
    ? Math.max(1, geometry.groups.length)
    : 1;
  if (geometries.has(geometry)) return;
  geometries.add(geometry);
  const position = geometry.getAttribute("position");
  vertices += position?.count ?? 0;
  let renderableBytes = 0;
  for (const attribute of Object.values(geometry.attributes)) {
    geometryBytes += attribute.array.byteLength;
    renderableBytes += attribute.array.byteLength;
  }
  if (geometry.index) {
    geometryBytes += geometry.index.array.byteLength;
    renderableBytes += geometry.index.array.byteLength;
  }
  renderableStats.push({
    bytes: renderableBytes,
    name: object.name || object.type,
    vertices: position?.count ?? 0,
  });
});

renderableStats.sort((left, right) => right.bytes - left.bytes);

function geometryHash(name: string): string | null {
  const object = root.getObjectByName(name);
  if (!(object instanceof Mesh)) return null;
  const hasher = new Bun.CryptoHasher("sha256");
  for (const attributeName of Object.keys(object.geometry.attributes).sort()) {
    hasher.update(attributeName);
    hasher.update(object.geometry.getAttribute(attributeName).array);
  }
  if (object.geometry.index) hasher.update(object.geometry.index.array);
  return hasher.digest("hex");
}

attachTimes.sort((left, right) => left - right);
const attachP95 =
  attachTimes[Math.max(0, Math.ceil(attachTimes.length * 0.95) - 1)] ?? 0;

console.log(
  JSON.stringify(
    {
      batches: batchCount,
      batch_timeline: batchTimeline,
      all_buildings_visible_ms: Number(allBuildingsVisibleMs?.toFixed(1)),
      building_batches: buildingBatchCount,
      exact_ready_ms: Number((performance.now() - startedAt).toFixed(1)),
      first_batch_arrival_ms: Number(firstBatchArrivalMs?.toFixed(1)),
      first_building_arrival_ms: Number(firstBuildingArrivalMs?.toFixed(1)),
      first_exact_building_arrival_ms: Number(
        firstExactBuildingArrivalMs?.toFixed(1),
      ),
      first_surface_build_ms: Number(firstSurfaceBuildMs?.toFixed(1)),
      main_attach_max_ms: Number(maxAttachMs.toFixed(1)),
      main_attach_p95_ms: Number(attachP95.toFixed(1)),
      max_batch_mib: Number((maxBatchBytes / 1024 / 1024).toFixed(1)),
      peak_rss_mib: Number((peakRss / 1024 / 1024).toFixed(1)),
      peak_rss_at_ms: Number(peakRssAtMs.toFixed(1)),
      post_input_ms: Number(postInputMs.toFixed(1)),
      pretriangulated: complete.pretriangulated,
      preview_cpu_ms: Number(previewCpuMs.toFixed(1)),
      steady_state: {
        asphalt_sha256: geometryHash("smooth carriageways"),
        draw_calls: drawCalls,
        geometry_mib: Number((geometryBytes / 1024 / 1024).toFixed(1)),
        object3d: object3DCount,
        renderables: renderableCount,
        top_renderables: renderableStats.slice(0, 12).map((entry) => ({
          geometry_mib: Number((entry.bytes / 1024 / 1024).toFixed(1)),
          name: entry.name,
          vertices: entry.vertices,
        })),
        vertices,
      },
      surface_batches: surfaceBatchCount,
      temporary_building_preview_batches: buildingPreviews.size,
      worker_build_ms: Number(complete.build_ms.toFixed(1)),
      worker_reported_batches: complete.batches,
    },
    null,
    2,
  ),
);
