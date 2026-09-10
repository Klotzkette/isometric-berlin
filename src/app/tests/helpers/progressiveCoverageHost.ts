import ts from "typescript";
import {
  Group, InstancedMesh, LineSegments, Material, Mesh, Texture,
  type Object3D,
} from "three";
import { setIsoNightPresentation } from "../../src/IsometricCityWorld";
import {
  hideReplacedBuildingPreview, restoreBuildingPreview,
} from "../../src/progressiveBuildingCoverage";
import {
  progressiveWorldStopPolicy,
  tryProgressiveWorkerOperation, type ProgressiveWorldWorkerOutput,
  type ProgressiveWorldState, type ProgressiveWorldWorkerInput,
} from "../../src/progressiveWorld";
import {
  deserializeTransferredObject3D, objectMaterialsIncludingTransferredAlternates,
} from "../../src/transferableObject3D";
import {
  createMinecraftMaterialState, disposeMinecraftMaterialState,
  releaseMinecraftMaterialBindings,
} from "../../src/visual-modes/minecraft/materialMode";
import { selectBuildingDetailDistricts, type BuildingDetailDistrict } from "../../src/buildingDetailStreaming";
import type { VisualMode } from "../../src/visualMode";

type AttachMessage = Exclude<ProgressiveWorldWorkerOutput, { type: "error" }>;

/**
 * Execute the actual viewer attachment/pause/failure functions. Only unrelated
 * UI invalidation, sign registration and environmental presentation are inert;
 * transfer decoding, relighting, preview visibility and resource disposal run
 * their production implementations without a browser/GPU.
 */
export function progressiveCoverageHost(
  source: string,
  isoWorld: Group,
  coarsePointer = true,
) {
  const names = [
    "cancelScheduledProgressiveAttachment", "clearProgressiveAttachmentQueue",
    "cancelScheduledProgressiveWorld", "failProgressiveWorld",
    "markProgressiveWorldUnavailable", "stopProgressiveWorld",
    "startProgressiveWorld",
    "attachProgressiveWorldMessage", "releaseBuiltWorldPayloads",
    "disposeObject3D", "updateMobileBuildingDetails",
  ];
  const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = names.map((name) => {
    const node = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
    if (!node) throw new Error(`Missing production function ${name}`);
    return node.getText(parsed).replace(/^export\s+/, "")
      .replaceAll("import.meta.url", JSON.stringify("https://fixture.invalid/ThreeViewer.tsx"));
  });
  const compiled = ts.transpileModule(declarations.join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const warnings: string[] = [];
  const acknowledged: string[] = [];
  const builds: ProgressiveWorldWorkerInput[] = [];
  const views: unknown[] = [];
  let terminated = 0;
  let failAcknowledgement = false;
  const createWorker = () => ({
    terminate: () => { terminated += 1; },
    postMessage: (message: ProgressiveWorldWorkerInput | { id: string; type: "batch-attached" }) => {
      if (message.type === "build") {
        builds.push(message);
        return;
      }
      if ((message as { type: string }).type === "detail-view") { views.push(message); return; }
      if (failAcknowledgement) throw new Error("Worker already closed");
      acknowledged.push(message.id);
    },
  });
  let worker = createWorker();
  const document = { hidden: false };
  const bindings = {
    Group, InstancedMesh, LineSegments, Material, Mesh, Texture,
    setIsoNightPresentation, hideReplacedBuildingPreview, restoreBuildingPreview, selectBuildingDetailDistricts,
    progressiveWorldStopPolicy,
    tryProgressiveWorkerOperation, deserializeTransferredObject3D,
    objectMaterialsIncludingTransferredAlternates, releaseMinecraftMaterialBindings,
    collectFarZoomAntiFlickerTargets: () => {},
    registerBerlinerEnsembleRoofSignTargets: () => {},
    setEnvironmentalPresentation: () => {},
    scheduleProgressiveAttachment: () => {},
    isoWorldIntentActive: (state: { lightingMode: VisualMode }) => state.lightingMode !== "minecraft",
    Worker: function () { worker = createWorker(); return worker; },
    URL, document,
    PROGRESSIVE_WORLD_WARNING: "coverage worker unavailable",
    performance: { clearMarks: () => {}, mark: () => {}, now: () => performance.now() },
  };
  const functions = new Function(...Object.keys(bindings), `${compiled}; return { ${names.join(", ")} };`)(
    ...Object.values(bindings),
  ) as {
    attachProgressiveWorldMessage: (runtime: unknown, worker: unknown, message: AttachMessage, warn: (message: string) => void) => void;
    stopProgressiveWorld: (runtime: unknown) => void;
    startProgressiveWorld: (runtime: unknown, warn: (message: string) => void) => void;
    failProgressiveWorld: (runtime: unknown, worker: unknown, warn: (message: string) => void) => void;
    markProgressiveWorldUnavailable: (runtime: unknown, warn: (message: string) => void) => void;
    disposeObject3D: (runtime: unknown, root: Object3D) => void;
    updateMobileBuildingDetails: (runtime: unknown, time: number, warn: (message: string) => void) => void;
  };
  let deferredStarts = 0;
  const runtime = {
    disposed: false,
    camera: { position: { x: 0, z: 0 } },
    controls: { target: { x: 0, z: 0 } },
    pedestrian: { enabled: false },
    mobileBuildingDistricts: undefined as readonly BuildingDetailDistrict[] | undefined,
    mobileBuildingWanted: undefined as readonly string[] | undefined,
    mobileBuildingViewRevision: undefined as number | undefined,
    mobileBuildingLastView: undefined as {x: number; z: number; at: number} | undefined,
    isoWorld, voxelWorld: null,
    coarsePointer,
    lightingMode: "day" as VisualMode,
    nightLightsOn: true,
    progressiveWorldWorker: worker as typeof worker | undefined,
    progressiveWorldState: "loading" as ProgressiveWorldState,
    progressiveWorldBatches: [] as Group[],
    progressiveWorldMessages: [] as unknown[],
    progressiveWorldInput: { type: "build", detailProfile: "mobile", initialBuildingCount: 0, prismUrl: "https://fixture.invalid/prisms.json" } as ProgressiveWorldWorkerInput,
    progressiveWorldAttachCancel: undefined as undefined | (() => void),
    progressiveWorldStartCancel: undefined as undefined | (() => void),
    renderInvalidated: false,
    minecraftMaterialState: createMinecraftMaterialState(),
    startDeferredDetails: () => { deferredStarts += 1; },
  };
  const warn = (message: string) => { warnings.push(message); };
  return {
    runtime, warnings, acknowledged, builds, views, document,
    get worker() { return worker; },
    get terminated() { return terminated; },
    get deferredStarts() { return deferredStarts; },
    attach: (message: AttachMessage) => functions.attachProgressiveWorldMessage(runtime, worker, message, warn),
    view: (x: number, z: number, time: number) => {
      runtime.controls.target = { x, z };
      functions.updateMobileBuildingDetails(runtime, time, warn);
    },
    pause: () => functions.stopProgressiveWorld(runtime),
    fail: () => functions.failProgressiveWorld(runtime, worker, warn),
    unavailable: () => functions.markProgressiveWorldUnavailable(runtime, warn),
    failAcknowledgement: () => { failAcknowledgement = true; },
    restart: () => functions.startProgressiveWorld(runtime, warn),
    dispose: () => {
      functions.disposeObject3D(runtime, isoWorld);
      disposeMinecraftMaterialState(runtime.minecraftMaterialState);
    },
  };
}
