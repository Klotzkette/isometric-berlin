import ts from "typescript";
import {
  Group, InstancedMesh, LineSegments, Material, Mesh, Texture,
  type Object3D,
} from "three";
import { setIsoNightPresentation } from "../../src/IsometricCityWorld";
import {
  hideReplacedBuildingPreview, restoreBuildingPreviews,
} from "../../src/progressiveBuildingCoverage";
import {
  progressiveWorldStopPolicy, releaseProgressiveWorldBatches,
  tryProgressiveWorkerOperation, type ProgressiveWorldWorkerOutput,
  type ProgressiveWorldState,
} from "../../src/progressiveWorld";
import {
  deserializeTransferredObject3D, objectMaterialsIncludingTransferredAlternates,
} from "../../src/transferableObject3D";
import {
  createMinecraftMaterialState, disposeMinecraftMaterialState,
  releaseMinecraftMaterialBindings,
} from "../../src/visual-modes/minecraft/materialMode";
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
    "attachProgressiveWorldMessage", "releaseBuiltWorldPayloads",
    "disposeObject3D",
  ];
  const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = names.map((name) => {
    const node = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
    if (!node) throw new Error(`Missing production function ${name}`);
    return node.getText(parsed).replace(/^export\s+/, "");
  });
  const compiled = ts.transpileModule(declarations.join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const bindings = {
    Group, InstancedMesh, LineSegments, Material, Mesh, Texture,
    setIsoNightPresentation, hideReplacedBuildingPreview, restoreBuildingPreviews,
    progressiveWorldStopPolicy, releaseProgressiveWorldBatches,
    tryProgressiveWorkerOperation, deserializeTransferredObject3D,
    objectMaterialsIncludingTransferredAlternates, releaseMinecraftMaterialBindings,
    collectFarZoomAntiFlickerTargets: () => {},
    registerBerlinerEnsembleRoofSignTargets: () => {},
    setEnvironmentalPresentation: () => {},
    PROGRESSIVE_WORLD_WARNING: "coverage worker unavailable",
    performance: { mark: () => {} },
  };
  const functions = new Function(...Object.keys(bindings), `${compiled}; return { ${names.join(", ")} };`)(
    ...Object.values(bindings),
  ) as {
    attachProgressiveWorldMessage: (runtime: unknown, worker: unknown, message: AttachMessage, warn: (message: string) => void) => void;
    stopProgressiveWorld: (runtime: unknown) => void;
    failProgressiveWorld: (runtime: unknown, worker: unknown, warn: (message: string) => void) => void;
    markProgressiveWorldUnavailable: (runtime: unknown, warn: (message: string) => void) => void;
    disposeObject3D: (runtime: unknown, root: Object3D) => void;
  };
  const warnings: string[] = [];
  const acknowledged: string[] = [];
  let terminated = 0;
  let failAcknowledgement = false;
  const worker = {
    terminate: () => { terminated += 1; },
    postMessage: (message: { id: string }) => {
      if (failAcknowledgement) throw new Error("Worker already closed");
      acknowledged.push(message.id);
    },
  };
  let deferredStarts = 0;
  const runtime = {
    isoWorld, voxelWorld: null,
    coarsePointer,
    lightingMode: "day" as VisualMode,
    nightLightsOn: true,
    progressiveWorldWorker: worker as typeof worker | undefined,
    progressiveWorldState: "loading" as ProgressiveWorldState,
    progressiveWorldBatches: [] as Group[],
    progressiveWorldMessages: [] as unknown[],
    progressiveWorldInput: {},
    progressiveWorldAttachCancel: undefined as undefined | (() => void),
    progressiveWorldStartCancel: undefined as undefined | (() => void),
    renderInvalidated: false,
    minecraftMaterialState: createMinecraftMaterialState(),
    startDeferredDetails: () => { deferredStarts += 1; },
  };
  const warn = (message: string) => { warnings.push(message); };
  return {
    runtime, worker, warnings, acknowledged,
    get terminated() { return terminated; },
    get deferredStarts() { return deferredStarts; },
    attach: (message: AttachMessage) => functions.attachProgressiveWorldMessage(runtime, worker, message, warn),
    pause: () => functions.stopProgressiveWorld(runtime),
    fail: () => functions.failProgressiveWorld(runtime, worker, warn),
    unavailable: () => functions.markProgressiveWorldUnavailable(runtime, warn),
    failAcknowledgement: () => { failAcknowledgement = true; },
    restart: () => {
      runtime.progressiveWorldWorker = worker;
      runtime.progressiveWorldState = "loading";
    },
    dispose: () => {
      functions.disposeObject3D(runtime, isoWorld);
      disposeMinecraftMaterialState(runtime.minecraftMaterialState);
    },
  };
}
