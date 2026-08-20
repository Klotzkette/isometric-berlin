import { BufferGeometry, Group, Mesh } from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  createIsometricCity,
  createSmoothSurfaces,
  createPretriangulatedSurfacePlate,
  type PretriangulatedSurfaceKind,
  type SurfacePayload,
} from "./IsometricCityWorld";
import { smoothGroundTopSampler, WATER_TOP_Y } from "./MinecraftVoxelWorld";
import {
  splitProgressiveBuildings,
  splitRoadSurfaceFamily,
  surfaceFamilyPayload,
  MOBILE_TOTAL_BUILDING_LIMIT,
  progressiveHeavyRoadPlatesEnabled,
  type ProgressiveWorldWorkerInput,
  type ProgressiveWorldWorkerOutput,
} from "./progressiveWorld";
import {
  fetchSurfacePlate,
  splitIndexedSurfacePlate,
  SURFACE_PLATE_MANIFEST_FILE,
  type SurfacePlateManifest,
} from "./surfacePlate";
import { serializeObject3DForTransfer } from "./transferableObject3D";

type WorkerScope = {
  onmessage: ((event: MessageEvent<ProgressiveWorldWorkerInput>) => void) | null;
  postMessage: (message: ProgressiveWorldWorkerOutput, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;
type FullProgressiveWorldWorkerInput = Extract<
  ProgressiveWorldWorkerInput,
  { detailProfile: "full" }
>;

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
): void {
  removeEmptyGroups(root);
  const { object, transfers } = serializeObject3DForTransfer(root);
  workerScope.postMessage(
    {
      build_ms: performance.now() - startedAt,
      id,
      kind,
      object,
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

function mergeBuiltSurfaceRoots(
  roots: Group[],
  meshName: string,
  mergeChunkSeams = false,
): Group {
  const outputRoot = roots[0];
  const outputMesh = outputRoot?.getObjectByName(meshName);
  if (!outputRoot || !(outputMesh instanceof Mesh)) {
    throw new Error(`Progressive surface chunks lack ${meshName}`);
  }
  const geometries: BufferGeometry[] = [];
  for (const root of roots) {
    const mesh = root.getObjectByName(meshName);
    if (!(mesh instanceof Mesh)) {
      throw new Error(`Progressive surface chunk lacks ${meshName}`);
    }
    geometries.push(mesh.geometry);
    if (root !== outputRoot) root.clear();
  }
  if (geometries.length > 1) {
    const joined = mergeGeometries(geometries, false);
    if (!joined) throw new Error(`Could not merge progressive ${meshName}`);
    outputMesh.geometry = mergeChunkSeams
      ? mergeVertices(joined, 1e-4)
      : joined;
    if (outputMesh.geometry !== joined) joined.dispose();
    for (const geometry of geometries) geometry.dispose();
  }
  return outputRoot;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadHeavyPlates(
  input: FullProgressiveWorldWorkerInput,
): Promise<Partial<Record<PretriangulatedSurfaceKind, ReturnType<typeof createPretriangulatedSurfacePlate>>>> {
  const rootUrl = new URL(input.sceneRootUrl);
  const response = await fetch(new URL(SURFACE_PLATE_MANIFEST_FILE, rootUrl));
  if (!response.ok) {
    throw new Error(`Surface plate manifest failed with HTTP ${response.status}`);
  }
  const manifest = (await response.json()) as SurfacePlateManifest;
  if (
    manifest.format !== "isometric-berlin-surface-plate" ||
    manifest.schema_version !== 1 ||
    manifest.stage !== "post-earcut-pre-terrain-drape" ||
    manifest.source_sha256 !== (await sha256(JSON.stringify(input.surfaces)))
  ) {
    throw new Error("Surface plate manifest does not match surface-polygons.json");
  }
  const entries = new Map(manifest.plates.map((entry) => [entry.kind, entry]));
  const entry = entries.get("asphalt");
  if (!entry) throw new Error("Surface plate manifest lacks asphalt");
  return { asphalt: await fetchSurfacePlate(rootUrl, entry) };
}

function runtimeHeavyPlate(
  input: FullProgressiveWorldWorkerInput,
  kind: PretriangulatedSurfaceKind,
) {
  return createPretriangulatedSurfacePlate(
    (input.surfaces.roads ?? []).filter((road) => road.kind === kind),
  );
}

async function postBuildingBatches(
  input: ProgressiveWorldWorkerInput,
): Promise<number> {
  const buildingBatches = splitProgressiveBuildings(
    input.prismPayload.buildings,
    input.initialBuildingCount,
    undefined,
    input.detailProfile === "mobile"
      ? MOBILE_TOTAL_BUILDING_LIMIT
      : Number.POSITIVE_INFINITY,
  ).remaining;
  for (let index = 0; index < buildingBatches.length; index += 1) {
    const startedAt = performance.now();
    const root = createIsometricCity(
      input.prismPayload,
      null,
      null,
      null,
      {
        buildings: buildingBatches[index],
        includeContext: false,
        smoothSurfaces: null,
      },
    );
    postBatch(root, "buildings", `buildings-${index + 1}`, startedAt);
    await yieldWorker();
  }
  return buildingBatches.length;
}

async function build(input: ProgressiveWorldWorkerInput): Promise<void> {
  const overallStart = performance.now();
  let batchCount = 0;
  if (input.detailProfile === "mobile") {
    // The main-thread preview already owns the coarse raster water, parks and
    // asphalt. Rebuilding those exact surface families in another realm drove
    // phone peaks by hundreds of MiB and copied the ground/surface payloads for
    // no additional mobile pixel. Mobile transfers only its bounded remaining
    // LoD2 building groups; ParkDetails follows after this Worker completes.
    batchCount += await postBuildingBatches(input);
    workerScope.postMessage({
      batches: batchCount,
      build_ms: performance.now() - overallStart,
      pretriangulated: false,
      type: "complete",
    });
    return;
  }
  const heavyRoadPlates = progressiveHeavyRoadPlatesEnabled(
    input.detailProfile,
  );
  let pretriangulated = heavyRoadPlates;
  const heavyPromise = heavyRoadPlates
    ? loadHeavyPlates(input).catch(() => {
        pretriangulated = false;
        return {
          asphalt: runtimeHeavyPlate(input, "asphalt"),
        };
      })
    : null;
  const terrainSample = smoothGroundTopSampler(input.ground);
  const terrainAt = (x: number, z: number): number =>
    terrainSample(
      x / input.ground.cell_m - input.ground.grid.min_x_idx,
      z / input.ground.cell_m - input.ground.grid.min_z_idx,
    );
  const waterTop = input.ground.water_top_y_m ?? WATER_TOP_Y;
  const bankY = waterTop + 5.35;
  const postSurface = (
    family: Parameters<typeof surfaceFamilyPayload>[1],
    pretriangulatedPlate?: ReturnType<typeof createPretriangulatedSurfacePlate>,
  ): void => {
    const startedAt = performance.now();
    const root = createSmoothSurfaces(
      surfaceFamilyPayload(input.surfaces, family),
      waterTop,
      bankY,
      terrainAt,
      family === "asphalt" || family === "paving"
        ? { pretriangulated: { [family]: pretriangulatedPlate ?? undefined } }
        : undefined,
    );
    postBatch(root, "surfaces", `surface-${family}`, startedAt);
    batchCount += 1;
  };

  // Water and lawns establish the map reading first and are both bounded
  // (<0.5 s on the production payload). Finish the two transient-heavy road
  // plates before retaining hundreds of MiB of building buffers in the main
  // scene. This ordering lowers whole-process peak memory without delaying the
  // already visible exact near-field buildings.
  postSurface("water");
  postSurface("parks");
  postSurface("sand");
  postSurface("earth");
  postSurface("wood");
  postSurface("metal");

  if (heavyRoadPlates && heavyPromise) {
    // Paving is already partitioned in the source generator. Processing 100
    // exact source polygons at a time preserves every triangle/count while
    // avoiding the one-shot tessellator's multi-GiB transient. It also keeps
    // the package 4.70 MiB smaller than committing a second plate.
    const pavingBatches = splitRoadSurfaceFamily(input.surfaces, "paving");
    const pavingRoots: Group[] = [];
    for (let index = 0; index < pavingBatches.length; index += 1) {
      pavingRoots.push(
        createSmoothSurfaces(
          pavingBatches[index],
          waterTop,
          bankY,
          terrainAt,
        ),
      );
      await yieldWorker();
    }
    const pavingStartedAt = performance.now();
    postBatch(
      mergeBuiltSurfaceRoots(pavingRoots, "smooth paved paths"),
      "surfaces",
      "surface-paving",
      pavingStartedAt,
    );
    batchCount += 1;

    const heavy = await heavyPromise;
    if (!heavy.asphalt) throw new Error("No asphalt plate was prepared");
    const asphaltChunks = splitIndexedSurfacePlate(heavy.asphalt);
    heavy.asphalt.dispose();
    heavy.asphalt = undefined;
    const asphaltFamily = surfaceFamilyPayload(input.surfaces, "asphalt");
    const emptyAsphaltFamily: SurfacePayload = {
      ...asphaltFamily,
      lane_markings: [],
      roads: [],
    };
    const asphaltRoots: Group[] = [];
    while (asphaltChunks.length > 0) {
      const chunk = asphaltChunks.shift()!;
      const first = asphaltRoots.length === 0;
      asphaltRoots.push(
        createSmoothSurfaces(
          first ? asphaltFamily : emptyAsphaltFamily,
          waterTop,
          bankY,
          terrainAt,
          { pretriangulated: { asphalt: chunk } },
        ),
      );
      await yieldWorker();
    }
    const asphaltStartedAt = performance.now();
    postBatch(
      mergeBuiltSurfaceRoots(asphaltRoots, "smooth carriageways", true),
      "surfaces",
      "surface-asphalt",
      asphaltStartedAt,
    );
    batchCount += 1;
    await yieldWorker();
  }

  // Geometry is already merged by material inside each bounded batch. Desktop
  // stays source-complete and retains the established six follow-up groups.
  batchCount += await postBuildingBatches(input);
  workerScope.postMessage({
    batches: batchCount,
    build_ms: performance.now() - overallStart,
    pretriangulated,
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
