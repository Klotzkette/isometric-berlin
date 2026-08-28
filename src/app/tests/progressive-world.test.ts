import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import { ARCHITECTURAL_INK_PALETTE } from "../src/architecturalInk";
import {
  releaseCompiledSurfacePayload,
  releaseBuiltWorldPayloads,
  releaseFailedWorldPayloads,
  type WorldPayloadLifetimeState,
} from "../src/ThreeViewer";
import {
  PLAZA_FACADE_DETAIL_ZONES,
  createDistantBuildingShells,
  createIsometricCity,
  createPretriangulatedSurfacePlate,
  setIsoNightPresentation,
  type PrismBuilding,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  DESKTOP_PLACE_DETAIL_ZONE_NAMES,
  DESKTOP_TOTAL_BUILDING_LIMIT,
  DESKTOP_INITIAL_BUILDING_COUNT,
  MAX_PROGRESSIVE_BUILDING_BATCHES,
  MOBILE_INITIAL_BUILDING_COUNT,
  MOBILE_TOTAL_BUILDING_LIMIT,
  PAVING_POLYGON_BATCH_SIZE,
  PROGRESSIVE_BUILDING_BATCH_SIZE,
  PROGRESSIVE_ATTACHMENT_MAX_DEFERRAL_MS,
  PROGRESSIVE_WORLD_FALLBACK_DELAY_MS,
  PROGRESSIVE_WORLD_IDLE_TIMEOUT_MS,
  progressiveWorldStopPolicy,
  progressiveAttachmentReady,
  progressiveWorldTransition,
  progressiveWorldVisibilityTransition,
  progressiveHeavyRoadPlatesEnabled,
  isDesktopPlaceDetailBuilding,
  releaseProgressiveWorldBatches,
  splitProgressiveBuildings,
  splitParkSurfaceFamily,
  splitRoadSurfaceFamily,
  surfaceFamilyPayload,
  tryProgressiveWorkerOperation,
} from "../src/progressiveWorld";
import {
  decodeSurfacePlate,
  encodeSurfacePlate,
  splitIndexedSurfacePlate,
} from "../src/surfacePlate";
import {
  deserializeTransferredObject3D,
  objectMaterialsIncludingTransferredAlternates,
  serializeObject3DForTransfer,
  TRANSFERRED_ALTERNATE_MATERIAL_KEYS,
} from "../src/transferableObject3D";

const meshRoot = `${import.meta.dir}/../public/mesh/regierungsviertel`;
const threeViewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();
const progressiveWorkerSource = await Bun.file(
  new URL("../src/progressiveWorld.worker.ts", import.meta.url),
).text();

function building(id: string, xDm: number, zDm: number): PrismBuilding {
  return {
    class: 0,
    h_dm: 100,
    id,
    ring: [
      [xDm, zDm],
      [xDm + 10, zDm],
      [xDm + 10, zDm + 10],
      [xDm, zDm + 10],
    ],
    y0_dm: 0,
  };
}

describe("progressive exact-world scheduling", () => {
  test("bounds desktop exact geometry while covering every source building once", () => {
    expect(MOBILE_INITIAL_BUILDING_COUNT).toBeLessThanOrEqual(320);
    expect(DESKTOP_INITIAL_BUILDING_COUNT).toBeLessThanOrEqual(700);
    expect(PROGRESSIVE_BUILDING_BATCH_SIZE).toBeLessThanOrEqual(5_000);
    const buildings = Array.from({ length: 29_818 }, (_, index) =>
      building(String(index), 3_177 + index * 20, 405),
    );
    const { initial, omitted, remaining } = splitProgressiveBuildings(
      buildings,
      700,
      PROGRESSIVE_BUILDING_BATCH_SIZE,
      DESKTOP_TOTAL_BUILDING_LIMIT,
    );
    expect(initial).toHaveLength(700);
    expect(omitted).toHaveLength(
      buildings.length - DESKTOP_TOTAL_BUILDING_LIMIT,
    );
    expect(remaining).toHaveLength(MAX_PROGRESSIVE_BUILDING_BATCHES);
    expect(
      remaining.every(
        (batch) => batch.length <= PROGRESSIVE_BUILDING_BATCH_SIZE,
      ),
    ).toBeTrue();
    const ids = [...initial, ...remaining.flat(), ...omitted].map(
      (entry) => entry.id,
    );
    expect(ids).toHaveLength(buildings.length);
    expect(new Set(ids).size).toBe(buildings.length);
  });

  test("bounds exact LoD2 geometry on both profiles without hiding buildings", () => {
    const buildings = Array.from({ length: 29_818 }, (_, index) =>
      building(String(index), 3_177 + index * 20, 405),
    );
    const mobile = splitProgressiveBuildings(
      buildings,
      MOBILE_INITIAL_BUILDING_COUNT,
      PROGRESSIVE_BUILDING_BATCH_SIZE,
      MOBILE_TOTAL_BUILDING_LIMIT,
    );
    const desktop = splitProgressiveBuildings(
      buildings,
      DESKTOP_INITIAL_BUILDING_COUNT,
      PROGRESSIVE_BUILDING_BATCH_SIZE,
      DESKTOP_TOTAL_BUILDING_LIMIT,
    );

    expect(MOBILE_TOTAL_BUILDING_LIMIT).toBeLessThanOrEqual(5_000);
    expect([...mobile.initial, ...mobile.remaining.flat()]).toHaveLength(
      MOBILE_TOTAL_BUILDING_LIMIT,
    );
    expect(mobile.omitted).toHaveLength(
      buildings.length - MOBILE_TOTAL_BUILDING_LIMIT,
    );
    expect(
      new Set([
        ...mobile.initial,
        ...mobile.remaining.flat(),
        ...mobile.omitted,
      ]).size,
    ).toBe(buildings.length);
    expect(mobile.initial).toHaveLength(MOBILE_INITIAL_BUILDING_COUNT);
    expect(mobile.remaining).toHaveLength(1);
    expect(DESKTOP_TOTAL_BUILDING_LIMIT).toBeLessThanOrEqual(12_000);
    expect(desktop.omitted).toHaveLength(
      buildings.length - DESKTOP_TOTAL_BUILDING_LIMIT,
    );
    expect([...desktop.initial, ...desktop.remaining.flat()]).toHaveLength(
      DESKTOP_TOTAL_BUILDING_LIMIT,
    );
    expect(
      new Set([
        ...desktop.initial,
        ...desktop.remaining.flat(),
        ...desktop.omitted,
      ]).size,
    ).toBe(buildings.length);
  });

  test("represents every omitted mobile building in one bounded instanced shell", () => {
    const buildings = Array.from({ length: 1_000 }, (_, index) =>
      building(String(index), 3_177 + index * 20, 405 + (index % 11) * 20),
    );
    const payload = {
      buildings,
      classes: ["concrete"],
      schema_version: 1,
    };
    const partition = splitProgressiveBuildings(buildings, 100, 100, 200);
    const coverage = createDistantBuildingShells(payload, partition.omitted);
    const shells = coverage.getObjectByName(
      "LoD2 distant building shells",
    ) as InstancedMesh;
    expect(shells).toBeInstanceOf(InstancedMesh);
    expect(shells.count).toBe(800);
    expect(coverage.userData.sourceBuildingCount).toBe(800);
    expect((shells.material as MeshBasicMaterial).vertexColors).toBeFalse();
    expect(shells.instanceColor).not.toBeNull();
    const retainedBytes =
      shells.instanceMatrix.array.byteLength +
      (shells.instanceColor?.array.byteLength ?? 0) +
      Object.values(shells.geometry.attributes).reduce(
        (sum, attribute) => sum + attribute.array.byteLength,
        0,
      ) +
      (shells.geometry.index?.array.byteLength ?? 0);
    expect(retainedBytes).toBeLessThan(80 * 1024);
    setIsoNightPresentation(coverage, true, true, "night");
    expect(shells.material).toBe(shells.userData.nightMaterial);
    setIsoNightPresentation(coverage, false, true, "schwellenraum");
    expect(shells.material).toBe(shells.userData.schwellenraumMaterial);
    expect(progressiveWorkerSource).toContain(
      "createDistantBuildingShells(prismPayload, partition.omitted)",
    );
    const wire = serializeObject3DForTransfer(coverage);
    const restored = deserializeTransferredObject3D(
      structuredClone(wire.object, { transfer: wire.transfers }),
    ) as Group;
    const restoredShells = restored.getObjectByName(
      "LoD2 distant building shells",
    ) as InstancedMesh;
    expect((restoredShells.material as MeshBasicMaterial).vertexColors).toBeFalse();
    expect(restoredShells.instanceMatrix.version).toBeGreaterThan(0);
    expect(restoredShells.instanceColor?.version).toBeGreaterThan(0);
    expect(
      Math.min(...Array.from(restoredShells.instanceColor!.array.slice(0, 3))),
    ).toBeGreaterThan(0);
  });

  test("repairs black legacy building shells after worker transfer", () => {
    const legacyShell = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ vertexColors: true }),
      1,
    );
    legacyShell.setMatrixAt(0, new Matrix4());
    legacyShell.setColorAt(
      0,
      new Color(ARCHITECTURAL_INK_PALETTE.facadeConcrete),
    );
    legacyShell.userData.dayMaterial = legacyShell.material;
    legacyShell.userData.nightMaterial = new MeshStandardMaterial({
      vertexColors: true,
    });

    const wire = serializeObject3DForTransfer(legacyShell);
    const restored = deserializeTransferredObject3D(
      structuredClone(wire.object, { transfer: wire.transfers }),
    ) as InstancedMesh;

    expect(restored.instanceColor).not.toBeNull();
    expect(restored.geometry.getAttribute("color")).toBeUndefined();
    expect((restored.material as MeshBasicMaterial).vertexColors).toBeFalse();
    expect(
      (restored.userData.nightMaterial as MeshStandardMaterial).vertexColors,
    ).toBeFalse();
  });

  test("keeps startup first while filling the same desktop cap with all five requested quarters", () => {
    const requested = DESKTOP_PLACE_DETAIL_ZONE_NAMES.map((name) => {
      const zone = PLAZA_FACADE_DETAIL_ZONES.find((entry) => entry.name === name);
      expect(zone).toBeDefined();
      return building(
        `requested-${name}`,
        Math.round(zone!.centreWorldM[0] * 10),
        Math.round(zone!.centreWorldM[1] * 10),
      );
    });
    const startup = building("startup", 3_177, 405);
    const ordinary = Array.from({ length: 8 }, (_, index) =>
      building(`ordinary-${index}`, 3_180 + index * 3, 405 + index * 2),
    );
    const buildings = [startup, ...ordinary, ...requested];
    const exactLimit = 1 + requested.length;
    const prioritized = splitProgressiveBuildings(
      buildings,
      1,
      100,
      exactLimit,
      true,
    );
    const exactIds = new Set(
      [...prioritized.initial, ...prioritized.remaining.flat()].map(
        (entry) => entry.id,
      ),
    );
    expect(prioritized.initial.map((entry) => entry.id)).toEqual(["startup"]);
    expect(exactIds.size).toBe(exactLimit);
    expect(
      requested.every(
        (entry) => exactIds.has(entry.id) && isDesktopPlaceDetailBuilding(entry),
      ),
    ).toBeTrue();
    expect(prioritized.omitted).toHaveLength(buildings.length - exactLimit);

    const distanceOnly = splitProgressiveBuildings(buildings, 1, 100, 2);
    expect(
      [...distanceOnly.initial, ...distanceOnly.remaining.flat()].some((entry) =>
        entry.id.startsWith("requested-"),
      ),
    ).toBeFalse();
  });

  test("uses compact raster asphalt on desktop and phones", async () => {
    expect(progressiveHeavyRoadPlatesEnabled("full")).toBeFalse();
    expect(progressiveHeavyRoadPlatesEnabled("mobile")).toBeFalse();
    const [ground, surfaces] = await Promise.all([
      Bun.file(`${meshRoot}/ground-context.json`).json() as Promise<VoxelPayload>,
      Bun.file(`${meshRoot}/surface-polygons.json`).json() as Promise<SurfacePayload>,
    ]);
    const source = building("ordinary", 0, 0);
    const payload = {
      buildings: [source],
      classes: ["concrete"],
      schema_version: 1,
    };
    const withoutRaster = createIsometricCity(payload, ground, null, surfaces, {
      buildings: [source],
      includeContext: false,
      smoothSurfaces: null,
    });
    const withRaster = createIsometricCity(payload, ground, null, surfaces, {
      buildings: [source],
      includeContext: false,
      retainRasterAsphalt: true,
      smoothSurfaces: null,
    });
    const deferredSlabs = withoutRaster.getObjectByName(
      "Drawn ground slabs",
    ) as InstancedMesh;
    const mobileSlabs = withRaster.getObjectByName(
      "Drawn ground slabs",
    ) as InstancedMesh;
    expect(mobileSlabs.count).toBeGreaterThan(deferredSlabs.count);
    expect(
      threeViewerSource.match(/retainRasterAsphalt: true/g)?.length,
    ).toBeGreaterThanOrEqual(1);
  });

  test("posts source URLs instead of decoded world graphs to both Workers", () => {
    const inputStart = threeViewerSource.indexOf(
      "const progressiveInput: ProgressiveWorldWorkerInput",
    );
    const desktopBranch = threeViewerSource.indexOf(
      ": ground && surfaces",
      inputStart,
    );
    const mobileBranch = threeViewerSource.slice(inputStart, desktopBranch);
    expect(inputStart).toBeGreaterThan(0);
    expect(desktopBranch).toBeGreaterThan(inputStart);
    expect(mobileBranch).toContain('detailProfile: "mobile"');
    expect(mobileBranch).toContain("initialBuildingCount,");
    expect(mobileBranch).toContain("prismUrl: new URL(");
    expect(mobileBranch).not.toContain("prismPayload:");
    expect(mobileBranch).not.toContain("ground,");
    expect(mobileBranch).not.toContain("sceneRootUrl:");
    expect(mobileBranch).not.toContain("surfaces,");
    expect(mobileBranch).not.toContain("tunnel:");
    const desktopEnd = threeViewerSource.indexOf(
      "const isoWorld = createIsometricCity",
      desktopBranch,
    );
    const desktopInput = threeViewerSource.slice(desktopBranch, desktopEnd);
    expect(desktopInput).toContain('detailProfile: "full"');
    expect(desktopInput).toContain("groundUrl: new URL(");
    expect(desktopInput).toContain("prismUrl: new URL(");
    expect(desktopInput).toContain("surfacesUrl: new URL(");
    expect(desktopInput).not.toContain("prismPayload:");

    const workerMobileStart = progressiveWorkerSource.indexOf(
      'if (input.detailProfile === "mobile")',
    );
    const workerDesktopStart = progressiveWorkerSource.indexOf(
      "const groundPromise",
      workerMobileStart,
    );
    const workerMobileBranch = progressiveWorkerSource.slice(
      workerMobileStart,
      workerDesktopStart,
    );
    expect(workerMobileBranch).toContain("loadPrismPayload(input.prismUrl)");
    expect(workerMobileBranch).toContain("buildings-distant");
    expect(workerMobileBranch).toContain(
      "postBuildingPreviews(prisms, partition.remaining)",
    );
    expect(workerMobileBranch).toContain(
      "postBuildingBatches(prisms, partition.remaining)",
    );
    expect(workerMobileBranch).toContain("prisms.buildings = []");
    expect(workerMobileBranch).toContain("partition.omitted.length = 0");
    expect(workerMobileBranch).not.toContain("postSurface(");
    expect(workerMobileBranch).not.toContain("createSmoothSurfaces(");
    expect(workerMobileBranch).toContain("pretriangulated: false");
    const workerDesktopBranch = progressiveWorkerSource.slice(
      workerDesktopStart,
    );
    expect(workerDesktopBranch).toContain("DESKTOP_TOTAL_BUILDING_LIMIT");
    expect(workerDesktopBranch).toContain("buildings-distant");
    expect(workerDesktopBranch).toContain("prismPayload.buildings = []");
    expect(progressiveWorkerSource).toContain("buildingBatches[index].length = 0");
    expect(workerDesktopBranch).toContain("surfaces.roads = []");
    expect(workerDesktopBranch).toContain("surfaces.water = []");
    expect(workerDesktopBranch).toContain("surfaces.parks = []");
    expect(workerDesktopBranch).toContain("surfaces.lane_markings = []");
    expect(workerDesktopBranch).toContain("splitParkSurfaceFamily(");
    expect(workerDesktopBranch).toContain("surface-parks-${index + 1}");
    expect(workerDesktopBranch).toContain("surface-lane-markings");
    expect(workerDesktopBranch.indexOf("groundResponse.json()")).toBeGreaterThan(
      workerDesktopBranch.indexOf("[nearestBuildingBatch]"),
    );
    expect(workerDesktopBranch).not.toContain("loadHeavyPlates");
    expect(workerDesktopBranch).not.toContain("splitIndexedSurfacePlate");
    expect(progressiveWorkerSource).toContain(
      "MAX_TRANSFERRED_BATCHES_IN_FLIGHT = 4",
    );
    expect(progressiveWorkerSource).toContain(
      "Promise.race(attachedBatchPromises.values())",
    );
    expect(progressiveWorkerSource).toContain(
      "await waitForAttachedBatches()",
    );
    expect(progressiveWorkerSource).toContain('type === "batch-attached"');
    expect(threeViewerSource).toContain('type: "batch-attached"');
  });

  test("pauses only for Minecraft and retains partial exact batches on errors", () => {
    expect(progressiveWorldTransition("minecraft", "loading")).toBe("pause");
    expect(progressiveWorldTransition("minecraft", "complete")).toBe("pause");
    expect(progressiveWorldTransition("night", "loading")).toBe("none");
    expect(progressiveWorldTransition("schwellenraum", "loading")).toBe("none");
    expect(progressiveWorldTransition("day", "idle")).toBe("resume");
    expect(progressiveWorldTransition("day", "failed")).toBe("none");
    expect(progressiveWorldStopPolicy("pause")).toEqual({
      disposePartialBatches: true,
      nextState: "idle",
    });
    expect(progressiveWorldStopPolicy("error")).toEqual({
      disposePartialBatches: false,
      nextState: "failed",
    });
    expect(progressiveWorldStopPolicy("complete")).toEqual({
      disposePartialBatches: false,
      nextState: "complete",
    });
    const batches = ["water", "buildings"];
    const disposed: string[] = [];
    releaseProgressiveWorldBatches(batches, (batch) => disposed.push(batch));
    expect(disposed).toEqual(["water", "buildings"]);
    expect(batches).toEqual([]);
  });

  test("stops hidden-tab refinement and restarts it without retaining partial batches", () => {
    expect(progressiveWorldVisibilityTransition(true, "loading")).toBe(
      "pause",
    );
    expect(progressiveWorldVisibilityTransition(true, "complete")).toBe(
      "none",
    );
    expect(progressiveWorldVisibilityTransition(false, "idle")).toBe(
      "resume",
    );
    expect(progressiveWorldVisibilityTransition(false, "loading")).toBe(
      "none",
    );
    expect(threeViewerSource).toContain(
      "cancelScheduledProgressiveWorld(runtime)",
    );
    expect(threeViewerSource).toContain(
      'window.addEventListener("pagehide", onPageHide)',
    );
    expect(threeViewerSource).toContain(
      'window.addEventListener("pageshow", onPageShow)',
    );
    expect(threeViewerSource).toContain("resize(true)");
  });

  test("lets visibility previews through but yields exact attachment to input", () => {
    const busy = {
      critical: false,
      idleBudgetMs: 10,
      inputPending: true,
      interactionActive: true,
      queuedForMs: 20,
    };
    expect(progressiveAttachmentReady(busy)).toBe(false);
    expect(progressiveAttachmentReady({ ...busy, critical: true })).toBe(true);
    expect(
      progressiveAttachmentReady({
        ...busy,
        queuedForMs: PROGRESSIVE_ATTACHMENT_MAX_DEFERRAL_MS,
      }),
    ).toBe(true);
    expect(
      progressiveAttachmentReady({
        ...busy,
        idleBudgetMs: 5,
        inputPending: false,
        interactionActive: false,
      }),
    ).toBe(true);
  });

  test("shows every building through replaceable previews before exact refinement", () => {
    const distantBuildings = progressiveWorkerSource.lastIndexOf(
      '"buildings-distant"',
    );
    const desktopPreview = progressiveWorkerSource.lastIndexOf(
      "postBuildingPreviews(prismPayload, buildingBatches)",
    );
    const exactBuildings = progressiveWorkerSource.indexOf(
      "[nearestBuildingBatch]",
      desktopPreview,
    );
    const firstSurface = progressiveWorkerSource.indexOf(
      'postSurface("water")',
      exactBuildings,
    );
    const laneMarkings = progressiveWorkerSource.indexOf(
      '"surface-lane-markings"',
      firstSurface,
    );
    expect(distantBuildings).toBeGreaterThan(0);
    expect(desktopPreview).toBeGreaterThan(distantBuildings);
    expect(desktopPreview).toBeGreaterThan(0);
    expect(exactBuildings).toBeGreaterThan(desktopPreview);
    expect(firstSurface).toBeGreaterThan(exactBuildings);
    expect(laneMarkings).toBeGreaterThan(firstSurface);
    expect(progressiveWorkerSource).not.toContain("surface-paving");
    expect(progressiveWorkerSource).not.toContain("surface-asphalt");
    expect(progressiveWorkerSource).toContain(
      "`buildings-preview-${index + 1}`",
    );
    expect(threeViewerSource).toContain(
      "batch.userData.progressiveWorldBatchId === message.replaces",
    );
    expect(threeViewerSource).toContain("disposeObject3D(runtime, replaced)");
    expect(PROGRESSIVE_WORLD_IDLE_TIMEOUT_MS).toBeLessThanOrEqual(600);
    expect(PROGRESSIVE_WORLD_FALLBACK_DELAY_MS).toBeLessThanOrEqual(60);
  });

  test("releases decoded world payloads after their consumers finish", () => {
    expect(threeViewerSource).toContain(
      "export function releaseBuiltWorldPayloads(",
    );
    expect(threeViewerSource).toContain(
      "delete runtime.groundPayloadPromise",
    );
    expect(threeViewerSource).toContain(
      "delete runtime.streetPayloadPromise",
    );
    expect(threeViewerSource).toContain(
      "delete runtime.surfacePayloadPromise",
    );
    expect(threeViewerSource).toContain(
      "delete runtime.railPayloadPromise",
    );
    expect(threeViewerSource).toContain(
      "delete runtime.voxelPayloadPromise",
    );
    expect(threeViewerSource).toContain("delete runtime.progressiveWorldInput");
    expect(threeViewerSource).toContain("releaseBuiltWorldPayloads(runtime)");
    expect(threeViewerSource).toContain(
      'releaseFailedWorldPayloads(runtime, "iso")',
    );
    expect(threeViewerSource).toContain(
      'releaseFailedWorldPayloads(runtime, "voxel")',
    );
    expect(threeViewerSource).toContain(
      "releaseCompiledSurfacePayload(runtime, surfacePayloadPromise)",
    );
  });

  test("releases fulfilled payload promises by completed or failed family", () => {
    const payload = Promise.resolve({});
    const built: WorldPayloadLifetimeState = {
      coarsePointer: false,
      groundPayloadPromise: payload,
      isoWorld: new Group(),
      prismPayloadPromise: payload,
      railPayloadPromise: payload,
      streetPayloadPromise: payload,
      surfacePayloadPromise: payload,
      voxelPayloadPromise: payload,
      voxelWorld: null,
    };

    releaseBuiltWorldPayloads(built);
    expect(built.groundPayloadPromise).toBeUndefined();
    expect(built.streetPayloadPromise).toBeUndefined();
    expect(built.surfacePayloadPromise).toBeUndefined();
    expect(built.railPayloadPromise).toBeUndefined();
    expect(built.voxelPayloadPromise).toBe(payload);
    expect(built.prismPayloadPromise).toBe(payload);

    built.voxelWorld = new Group();
    releaseBuiltWorldPayloads(built);
    expect(built.voxelPayloadPromise).toBeUndefined();
    expect(built.prismPayloadPromise).toBeUndefined();

    const failedIso: WorldPayloadLifetimeState = {
      ...built,
      groundPayloadPromise: payload,
      isoWorld: null,
      prismPayloadPromise: payload,
      railPayloadPromise: payload,
      streetPayloadPromise: payload,
      surfacePayloadPromise: payload,
      voxelPayloadPromise: payload,
      voxelWorld: null,
    };
    releaseFailedWorldPayloads(failedIso, "iso");
    expect(failedIso.groundPayloadPromise).toBeUndefined();
    expect(failedIso.streetPayloadPromise).toBeUndefined();
    expect(failedIso.surfacePayloadPromise).toBeUndefined();
    expect(failedIso.railPayloadPromise).toBeUndefined();
    expect(failedIso.prismPayloadPromise).toBeUndefined();
    expect(failedIso.voxelPayloadPromise).toBe(payload);

    const failedVoxel: WorldPayloadLifetimeState = {
      ...failedIso,
      groundPayloadPromise: payload,
      prismPayloadPromise: payload,
      voxelPayloadPromise: payload,
    };
    releaseFailedWorldPayloads(failedVoxel, "voxel");
    expect(failedVoxel.voxelPayloadPromise).toBeUndefined();
    expect(failedVoxel.prismPayloadPromise).toBeUndefined();
    expect(failedVoxel.groundPayloadPromise).toBe(payload);
  });

  test("releases only the pedestrian surface request that was compiled", () => {
    const compiled = Promise.resolve({});
    const newer = Promise.resolve({ newer: true });
    const state: Pick<WorldPayloadLifetimeState, "surfacePayloadPromise"> = {
      surfacePayloadPromise: newer,
    };

    expect(releaseCompiledSurfacePayload(state, compiled)).toBe(false);
    expect(state.surfacePayloadPromise).toBe(newer);
    expect(releaseCompiledSurfacePayload(state, newer)).toBe(true);
    expect(state.surfacePayloadPromise).toBeUndefined();
  });

  test("starts mobile ParkDetails only after exact refinement settles", () => {
    const completionStart = threeViewerSource.indexOf(
      'progressiveWorldStopPolicy("complete").nextState',
    );
    const parkAfterCompletion = threeViewerSource.indexOf(
      "if (runtime.coarsePointer) runtime.startDeferredDetails()",
      completionStart,
    );
    expect(completionStart).toBeGreaterThan(0);
    expect(parkAfterCompletion).toBeGreaterThan(completionStart);

    const parkScheduler = threeViewerSource.slice(
      threeViewerSource.indexOf("runtime.startDeferredDetails = () =>"),
      threeViewerSource.indexOf("runtime.tunnel = createTunnel("),
    );
    expect(parkScheduler).toContain(
      'runtime.progressiveWorldState === "loading"',
    );
    expect(parkScheduler).toContain(
      'runtime.progressiveWorldState === "idle"',
    );
    expect(parkScheduler).toContain("document.hidden");
  });

  test("bounds unavailable Worker APIs outside the exact-preview promise", () => {
    const constructionFailure = new Error("Worker blocked by CSP");
    expect(
      tryProgressiveWorkerOperation(() => {
        throw constructionFailure;
      }),
    ).toEqual({ error: constructionFailure, ok: false });
    let posts = 0;
    expect(
      tryProgressiveWorkerOperation(() => {
        posts += 1;
      }),
    ).toEqual({ ok: true, value: undefined });
    expect(posts).toBe(1);

    const constructionGuard = threeViewerSource.indexOf(
      "const construction = tryProgressiveWorkerOperation",
    );
    const postGuard = threeViewerSource.indexOf(
      "const posted = tryProgressiveWorkerOperation",
    );
    expect(constructionGuard).toBeGreaterThan(0);
    expect(postGuard).toBeGreaterThan(constructionGuard);
    expect(threeViewerSource).toContain(
      "markProgressiveWorldUnavailable(runtime, warn)",
    );
    expect(threeViewerSource).toContain(
      "if (!posted.ok) failProgressiveWorld(runtime, worker, warn)",
    );

    const isoLoader = threeViewerSource.slice(
      threeViewerSource.indexOf("function ensureIsoWorld("),
      threeViewerSource.indexOf("function ensureVoxelWorld("),
    );
    const previewBuild = isoLoader.indexOf(
      "const isoWorld = createIsometricCity",
    );
    const committedRoot = isoLoader.indexOf("runtime.isoWorld = isoWorld");
    const progressiveStart = isoLoader.indexOf(
      "applyProgressiveWorldMode(runtime, runtime.lightingMode, warn)",
    );
    expect(previewBuild).toBeGreaterThan(0);
    expect(committedRoot).toBeGreaterThan(previewBuild);
    expect(progressiveStart).toBeGreaterThan(committedRoot);
    expect(isoLoader).toContain(
      "restoreProgressiveWorld(runtime, progressiveSnapshot)",
    );
  });

  test("isolates surface families without dropping their exact source objects", () => {
    const road = (kind: string, name: string) => ({
      area_m2: 10,
      holes: [],
      kind,
      name,
      ring: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    });
    const source: SurfacePayload = {
      lane_markings: [{ name: "dash", points: [[0, 0], [10, 0]], width_m: 1 }],
      parks: [road("lawn", "park")],
      roads: [road("asphalt", "street"), road("paving", "square")],
      schema_version: 1,
      scrub_points: [[1, 2, 3, 4, 0]],
      sunken_walls: [],
      water: [road("river", "Spree")],
    };
    const asphalt = surfaceFamilyPayload(source, "asphalt");
    expect(asphalt.roads).toEqual([source.roads?.[0]]);
    expect(asphalt.lane_markings).toBe(source.lane_markings);
    expect(asphalt.parks).toEqual([]);
    expect(asphalt.water).toEqual([]);
    const parks = surfaceFamilyPayload(source, "parks");
    expect(parks.parks).toBe(source.parks);
    expect(parks.scrub_points).toBe(source.scrub_points);
    expect(parks.roads).toEqual([]);
    const water = surfaceFamilyPayload(source, "water");
    expect(water.water).toBe(source.water);
  });

  test("streams park surfaces without duplicating scrub samples", () => {
    const park = (kind: "garden" | "lawn") => ({
      area_m2: 10,
      holes: [],
      kind,
      name: kind,
      ring: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    });
    const source: SurfacePayload = {
      lane_markings: [],
      parks: Array.from({ length: 5 }, (_, index) =>
        park(index === 4 ? "garden" : "lawn"),
      ),
      roads: [],
      schema_version: 1,
      scrub_points: [
        [1, 2, 3, 4, 0],
        [5, 6, 7, 8, 1],
      ],
      sunken_walls: [],
      water: [],
    };
    const batches = splitParkSurfaceFamily(source, 2);
    expect(batches.map((batch) => batch.parks.length)).toEqual([2, 2, 1]);
    expect(batches[0].scrub_points).toBe(source.scrub_points);
    expect(batches.slice(1).every((batch) => batch.scrub_points?.length === 0))
      .toBeTrue();
    expect(batches.every((batch) => batch.roads?.length === 0)).toBeTrue();
    expect(batches.every((batch) => batch.water.length === 0)).toBeTrue();
  });

  test("bounds paving tessellation while covering every source polygon once", () => {
    const roads = Array.from({ length: 251 }, (_, index) => ({
      area_m2: 10,
      holes: [],
      kind: index % 2 === 0 ? "paving" : "asphalt",
      name: String(index),
      ring: [
        [index, 0],
        [index + 1, 0],
        [index + 1, 1],
        [index, 1],
      ] as Array<[number, number]>,
    }));
    const source: SurfacePayload = {
      lane_markings: [],
      parks: [],
      roads,
      schema_version: 1,
      scrub_points: [],
      sunken_walls: [],
      water: [],
    };
    const batches = splitRoadSurfaceFamily(source, "paving");
    const expected = roads.filter((road) => road.kind === "paving");
    expect(batches).toHaveLength(2);
    expect(
      batches.every(
        (batch) => (batch.roads?.length ?? 0) <= PAVING_POLYGON_BATCH_SIZE,
      ),
    ).toBeTrue();
    expect(batches.flatMap((batch) => batch.roads ?? [])).toEqual(expected);
  });

  test("Worker building batches cannot duplicate one-off context or hero models", () => {
    const source = building("ordinary", 0, 0);
    const batch = createIsometricCity(
      { buildings: [source], classes: ["concrete"], schema_version: 1 },
      null,
      null,
      null,
      {
        buildings: [source],
        includeContext: false,
        smoothSurfaces: null,
      },
    );
    expect(batch.getObjectByName("LoD2 prism buildings")).not.toBeNull();
    expect(batch.getObjectByName("presentation paper backdrop")).toBeUndefined();
    expect(batch.getObjectByName("Landmark detail refinements")).toBeUndefined();
    expect(batch.getObjectByName("Federal state representations")).toBeUndefined();
  });

  test("the preview defers smooth quays without adding their raster fallback", async () => {
    const [ground, surfaces] = await Promise.all([
      Bun.file(`${meshRoot}/ground-context.json`).json() as Promise<VoxelPayload>,
      Bun.file(`${meshRoot}/surface-polygons.json`).json() as Promise<SurfacePayload>,
    ]);
    const source = building("ordinary", 0, 0);
    const preview = createIsometricCity(
      { buildings: [source], classes: ["concrete"], schema_version: 1 },
      ground,
      null,
      surfaces,
      {
        buildings: [source],
        includeContext: false,
        smoothSurfaces: null,
      },
    );
    expect(preview.getObjectByName("Drawn ground slabs")).not.toBeNull();
    expect(preview.getObjectByName("drawn quay walls")).toBeUndefined();
    expect(preview.getObjectByName("smooth quay walls")).toBeUndefined();
  });

  test("the production mobile preview retains bounded static water, bed and quays", async () => {
    const [ground, surfaces] = await Promise.all([
      Bun.file(`${meshRoot}/ground-context.json`).json() as Promise<VoxelPayload>,
      Bun.file(`${meshRoot}/surface-polygons.json`).json() as Promise<SurfacePayload>,
    ]);
    const source = building("ordinary", 0, 0);
    const preview = createIsometricCity(
      { buildings: [source], classes: ["concrete"], schema_version: 1 },
      ground,
      null,
      surfaces,
      {
        buildings: [source],
        includeContext: false,
        retainRasterAsphalt: true,
        retainRasterWater: true,
        smoothSurfaces: null,
      },
    );
    const bed = preview.getObjectByName("drawn river bed") as InstancedMesh;
    const water = preview.getObjectByName(
      "drawn water surface",
    ) as InstancedMesh;
    const quays = preview.getObjectByName("drawn quay walls") as Mesh;
    const quayInk = preview.getObjectByName("quay ink lines") as LineSegments;
    expect(bed).toBeInstanceOf(InstancedMesh);
    expect(water).toBeInstanceOf(InstancedMesh);
    expect(water.count).toBe(4_263);
    expect(bed.count).toBe(water.count);
    expect(quays).toBeInstanceOf(Mesh);
    expect(quayInk).toBeInstanceOf(LineSegments);
    expect(preview.getObjectByName("smooth water surface")).toBeUndefined();
    expect(preview.getObjectByName("smooth river bed")).toBeUndefined();
    expect(preview.getObjectByName("smooth quay walls")).toBeUndefined();

    const seenGeometries = new Set<BufferGeometry>();
    let retainedBytes = 0;
    for (const object of [bed, water, quays, quayInk]) {
      if (!seenGeometries.has(object.geometry)) {
        seenGeometries.add(object.geometry);
        for (const attribute of Object.values(object.geometry.attributes)) {
          retainedBytes += attribute.array.byteLength;
        }
        retainedBytes += object.geometry.index?.array.byteLength ?? 0;
      }
      if (object instanceof InstancedMesh) {
        retainedBytes += object.instanceMatrix.array.byteLength;
        retainedBytes += object.instanceColor?.array.byteLength ?? 0;
      }
    }
    expect(retainedBytes).toBeLessThan(4 * 1024 * 1024);

    const isoLoader = threeViewerSource.slice(
      threeViewerSource.indexOf("function ensureIsoWorld("),
      threeViewerSource.indexOf("function ensureVoxelWorld("),
    );
    expect(isoLoader).toContain(
      "retainRasterWater: runtime.coarsePointer",
    );
  });

  test("production follow-up groups stay inside the steady draw-call budget", async () => {
    const payload = (await Bun.file(`${meshRoot}/lod2-prisms.json`).json()) as {
      buildings: PrismBuilding[];
      classes: string[];
      schema_version: number;
    };
    const batches = splitProgressiveBuildings(
      payload.buildings,
      DESKTOP_INITIAL_BUILDING_COUNT,
      PROGRESSIVE_BUILDING_BATCH_SIZE,
      DESKTOP_TOTAL_BUILDING_LIMIT,
      true,
    );
    const exactIds = new Set(
      [...batches.initial, ...batches.remaining.flat()].map((entry) => entry.id),
    );
    const requestedPlaceBuildings = payload.buildings.filter(
      isDesktopPlaceDetailBuilding,
    );
    expect(requestedPlaceBuildings).toHaveLength(967);
    expect(
      requestedPlaceBuildings.every((entry) => exactIds.has(entry.id)),
    ).toBeTrue();
    let renderables = 0;
    let retainedBytes = 0;
    let vertices = 0;
    let largestBatchArea = 0;
    const seenGeometries = new Set<BufferGeometry>();
    for (const buildings of [batches.initial, ...batches.remaining]) {
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minZ = Number.POSITIVE_INFINITY;
      let maxZ = Number.NEGATIVE_INFINITY;
      for (const entry of buildings) {
        for (const [xDm, zDm] of entry.ring) {
          minX = Math.min(minX, xDm / 10);
          maxX = Math.max(maxX, xDm / 10);
          minZ = Math.min(minZ, zDm / 10);
          maxZ = Math.max(maxZ, zDm / 10);
        }
      }
      largestBatchArea = Math.max(
        largestBatchArea,
        (maxX - minX) * (maxZ - minZ),
      );
      const group = createIsometricCity(payload, null, null, null, {
        buildings,
        includeContext: false,
        smoothSurfaces: null,
      });
      group.traverse((object) => {
        if (!(object instanceof Mesh) && !(object instanceof LineSegments)) {
          return;
        }
        renderables += 1;
        vertices += object.geometry.getAttribute("position")?.count ?? 0;
        if (!seenGeometries.has(object.geometry)) {
          seenGeometries.add(object.geometry);
          for (const attribute of Object.values(object.geometry.attributes)) {
            retainedBytes += attribute.array.byteLength;
          }
          retainedBytes += object.geometry.index?.array.byteLength ?? 0;
        }
        if (object instanceof InstancedMesh) {
          retainedBytes += object.instanceMatrix.array.byteLength;
          retainedBytes += object.instanceColor?.array.byteLength ?? 0;
        }
        if (object.name === "LoD2 prism buildings") {
          const color = object.geometry.getAttribute("color");
          expect(object.geometry.getAttribute("normal")).toBeUndefined();
          expect(color.array).toBeInstanceOf(Uint8Array);
          expect(color.normalized).toBeTrue();
        }
        object.geometry.dispose();
      });
      group.clear();
    }
    // Exact production geometry is retained in two spatial batches; all
    // remaining buildings are represented by one shared instanced shell. The
    // v0.72.32 place-front expansion adds only line vertices inside the same
    // facade-axis renderables; its byte delta is pinned separately.
    expect(batches.remaining).toHaveLength(MAX_PROGRESSIVE_BUILDING_BATCHES);
    expect(renderables).toBeLessThanOrEqual(49);
    expect(vertices).toBe(3_745_576);
    expect(retainedBytes).toBe(54_043_670);
    // The identical all-attribute/index/instance accounting for the previous
    // distance-only selection was 54,135,158 bytes.
    expect(retainedBytes).toBeLessThanOrEqual(54_135_158);
    expect(largestBatchArea).toBeLessThan(11 * 1_000_000);
  });
});

describe("transferable Three geometry", () => {
  test("round-trips hierarchy, exact typed buffers, instances and mode materials", () => {
    const root = new Group();
    root.name = "batch";
    const day = new MeshBasicMaterial({ color: 0xabcdef });
    const night = new MeshStandardMaterial({ color: 0x123456 });
    const mesh = new Mesh(new BoxGeometry(2, 3, 4), day);
    mesh.name = "LoD2 prism buildings";
    mesh.userData.dayMaterial = day;
    mesh.userData.nightMaterial = night;
    mesh.userData.contract = "exact";
    root.add(mesh);
    const instances = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
      2,
    );
    instances.name = "instances";
    instances.setMatrixAt(0, new Matrix4().makeTranslation(3, 4, 5));
    instances.setMatrixAt(1, new Matrix4().makeTranslation(6, 7, 8));
    root.add(instances);

    const wire = serializeObject3DForTransfer(root);
    expect(wire.transfers.length).toBeGreaterThan(0);
    expect(wire.transfers.every((buffer) => buffer instanceof ArrayBuffer)).toBeTrue();
    const restored = deserializeTransferredObject3D(
      structuredClone(wire.object),
    ) as Group;
    const restoredMesh = restored.getObjectByName("LoD2 prism buildings");
    expect(restoredMesh).toBeInstanceOf(Mesh);
    expect(restoredMesh?.userData.contract).toBe("exact");
    expect(
      (restoredMesh as Mesh).geometry.getAttribute("position").array,
    ).toEqual(mesh.geometry.getAttribute("position").array);
    expect((restoredMesh as Mesh).geometry.boundingSphere?.radius).toBe(
      mesh.geometry.boundingSphere?.radius,
    );
    const restoredInstances = restored.getObjectByName("instances");
    expect(restoredInstances).toBeInstanceOf(InstancedMesh);
    expect((restoredInstances as InstancedMesh).boundingSphere?.radius).toBe(
      instances.boundingSphere?.radius,
    );
    setIsoNightPresentation(restored, true, true, "night");
    expect((restoredMesh as Mesh).material).toBe(restoredMesh?.userData.nightMaterial);
  });

  test("relights every progressive LoD2 batch, not only the first matching name", () => {
    const city = new Group();
    const bodies: Mesh[] = [];
    for (let index = 0; index < 3; index += 1) {
      const day = new MeshBasicMaterial({ color: 0xffffff });
      const night = new MeshStandardMaterial({ color: 0x222222 });
      const mesh = new Mesh(new BoxGeometry(), day);
      mesh.name = "LoD2 prism buildings";
      mesh.userData.dayMaterial = day;
      mesh.userData.nightMaterial = night;
      city.add(mesh);
      bodies.push(mesh);
    }
    setIsoNightPresentation(city, true, true, "night");
    expect(bodies.every((mesh) => mesh.material === mesh.userData.nightMaterial)).toBeTrue();
    setIsoNightPresentation(city, false, true, "day");
    expect(bodies.every((mesh) => mesh.material === mesh.userData.dayMaterial)).toBeTrue();
  });

  test("materialises every transferred surface and facade batch across drawn modes", () => {
    const city = new Group();
    const surfaceNames = [
      "smooth garden beds",
      "smooth earth desire paths",
      "smooth timber paths",
      "smooth metal paths and steps",
      "natural pond floors",
      "natural pond bank slopes",
      "natural pond water",
      "basin display-depth walls",
      "static water ripple ribbons",
      "Otto-Weidt-Platz fountain floor",
      "Otto-Weidt-Platz fountain water",
      "smooth water surface",
    ] as const;
    const surfaces: Array<{
      day: MeshBasicMaterial;
      mesh: Mesh;
      moonlit?: MeshBasicMaterial;
      night: MeshBasicMaterial;
    }> = [];
    const mullions: LineSegments[] = [];
    const litPanes: Mesh[] = [];

    for (let batchIndex = 0; batchIndex < 2; batchIndex += 1) {
      const batch = new Group();
      batch.name = `progressive batch ${batchIndex}`;
      city.add(batch);
      for (const name of surfaceNames) {
        const day = new MeshBasicMaterial({ color: 0xdedede });
        const night = new MeshBasicMaterial({ color: 0x151a22 });
        const mesh = new Mesh(new BoxGeometry(), day);
        mesh.name = name;
        mesh.userData.dayMaterial = day;
        mesh.userData.nightMaterial = night;
        let moonlit: MeshBasicMaterial | undefined;
        if (name === "smooth water surface") {
          moonlit = new MeshBasicMaterial({ color: 0x080f1c });
          mesh.userData.moonlitMaterial = moonlit;
        }
        batch.add(mesh);
        surfaces.push({ day, mesh, moonlit, night });
      }

      const paneDay = new MeshBasicMaterial({ color: 0xa9c7d8 });
      const paneNight = new MeshBasicMaterial({ color: 0x344759 });
      const pane = new Mesh(new BoxGeometry(), paneDay);
      pane.name = "Charite aluminium facade window panes";
      pane.userData.dayMaterial = paneDay;
      pane.userData.nightMaterial = paneNight;
      batch.add(pane);
      surfaces.push({ day: paneDay, mesh: pane, night: paneNight });

      const litPane = new Mesh(
        new BoxGeometry(),
        new MeshBasicMaterial({ color: 0xffd98c }),
      );
      litPane.name = "Charite lit facade window panes";
      litPane.visible = false;
      batch.add(litPane);
      litPanes.push(litPane);

      const mullion = new LineSegments(
        new BoxGeometry(),
        new LineBasicMaterial({ color: 0 }),
      );
      mullion.name = "LoD2 glass mullions";
      batch.add(mullion);
      mullions.push(mullion);
    }

    const expectMode = (
      expectedMaterial: "day" | "night" | "schwellenraum",
      inkMode: "day" | "night" | "snowstorm" | "schwellenraum",
      lightsVisible: boolean,
      moonlitActive = false,
    ): void => {
      expect(
        surfaces.every(
          ({ day, mesh, moonlit, night }) =>
            mesh.material ===
            (expectedMaterial === "schwellenraum"
              ? mesh.userData.schwellenraumMaterial
              : expectedMaterial === "night"
              ? moonlitActive && moonlit
                ? moonlit
                : night
              : day),
        ),
      ).toBeTrue();
      expect(litPanes.every((pane) => pane.visible === lightsVisible)).toBeTrue();
      expect(
        mullions.every(
          (mullion) =>
            (mullion.material as LineBasicMaterial).color.getHex() ===
            ARCHITECTURAL_INK_PALETTE[inkMode].detail,
        ),
      ).toBeTrue();
    };

    setIsoNightPresentation(city, true, true, "night");
    expectMode("night", "night", true);
    setIsoNightPresentation(city, false, true, "snowstorm");
    expectMode("day", "snowstorm", false);
    setIsoNightPresentation(city, false, true, "schwellenraum");
    expectMode("schwellenraum", "schwellenraum", false);
    setIsoNightPresentation(city, false, true, "day");
    expectMode("day", "day", false);
    setIsoNightPresentation(city, true, false, "night");
    expectMode("night", "night", false, true);
    expect(
      surfaces
        .filter(({ moonlit }) => moonlit)
        .every(({ mesh, moonlit }) => mesh.material === moonlit),
    ).toBeTrue();
  });

  test("collects assigned and transferred alternate materials exactly once", () => {
    expect(TRANSFERRED_ALTERNATE_MATERIAL_KEYS).toEqual([
      "dayMaterial",
      "nightMaterial",
      "moonlitMaterial",
      "schwellenraumMaterial",
    ]);
    const assigned = new MeshBasicMaterial();
    const night = new MeshStandardMaterial();
    const moonlit = new MeshBasicMaterial();
    const schwellenraum = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(), assigned);
    mesh.userData.dayMaterial = assigned;
    mesh.userData.nightMaterial = night;
    mesh.userData.moonlitMaterial = moonlit;
    mesh.userData.schwellenraumMaterial = schwellenraum;

    const materials = objectMaterialsIncludingTransferredAlternates(mesh);
    expect(materials).toEqual([assigned, night, moonlit, schwellenraum]);
    const disposalCounts = new Map(
      materials.map((material) => [material, 0]),
    );
    for (const material of materials) {
      material.dispose = (): void => {
        disposalCounts.set(material, disposalCounts.get(material)! + 1);
      };
    }
    for (const material of objectMaterialsIncludingTransferredAlternates(mesh)) {
      material.dispose();
    }
    expect([...disposalCounts.values()]).toEqual([1, 1, 1, 1]);
    expect(threeViewerSource).toMatch(
      /objectMaterialsIncludingTransferredAlternates\(\s*object,?\s*\)/,
    );
  });
});

describe("lossless pretriangulated road plates", () => {
  test("round-trips synthetic Earcut positions and index values exactly", () => {
    const geometry = createPretriangulatedSurfacePlate([
      {
        area_m2: 100,
        holes: [],
        name: "square",
        ring: [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ],
      },
    ]);
    expect(geometry).not.toBeNull();
    const encoded = encodeSurfacePlate("asphalt", geometry!);
    const decoded = decodeSurfacePlate(encoded.buffer, "asphalt");
    expect(decoded.getAttribute("position").array).toEqual(
      geometry!.getAttribute("position").array,
    );
    expect(Array.from(decoded.getIndex()!.array)).toEqual(
      Array.from(geometry!.getIndex()!.array),
    );
  });

  test("partitions plates only between triangles and preserves their coordinates", () => {
    const geometry = createPretriangulatedSurfacePlate([
      {
        area_m2: 200,
        holes: [],
        name: "rectangle",
        ring: [
          [0, 0],
          [200, 0],
          [200, 100],
          [0, 100],
        ],
      },
    ])!;
    const sourcePosition = geometry.getAttribute("position");
    const sourceIndex = geometry.getIndex()!;
    const sourceTriangles = Array.from(
      { length: sourceIndex.count },
      (_, index) => {
        const vertex = sourceIndex.getX(index);
        return [
          sourcePosition.getX(vertex),
          sourcePosition.getY(vertex),
          sourcePosition.getZ(vertex),
        ];
      },
    );
    const chunks = splitIndexedSurfacePlate(geometry, 3);
    const chunkTriangles = chunks.flatMap((chunk) => {
      const position = chunk.getAttribute("position");
      const index = chunk.getIndex()!;
      return Array.from({ length: index.count }, (_, entry) => {
        const vertex = index.getX(entry);
        return [
          position.getX(vertex),
          position.getY(vertex),
          position.getZ(vertex),
        ];
      });
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunkTriangles).toEqual(sourceTriangles);
  });

  test("production no longer ships the retired road-plate cache", async () => {
    expect(
      await Bun.file(`${meshRoot}/surface-pretriangulation.json`).exists(),
    ).toBeFalse();
    const plateFiles = Array.from(
      new Bun.Glob("surface-*.plate.gz").scanSync(meshRoot),
    );
    expect(plateFiles).toEqual([]);
    expect(progressiveWorkerSource).not.toContain("SURFACE_PLATE_MANIFEST_FILE");
    expect(progressiveWorkerSource).not.toContain("fetchSurfacePlate");
  });
});
