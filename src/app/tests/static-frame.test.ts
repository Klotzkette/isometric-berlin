import { describe, expect, test } from "bun:test";
import { BufferGeometry, LineBasicMaterial, LineSegments } from "three";

import {
  STABLE_INK_RENDER_ORDER_SPAN,
  assignStableInkRenderOrder,
  civicDetailsVisible,
  STABLE_INK_VIEW_BIAS_M,
  stabilizeInkLineMaterial,
  stabilizeInkVertexShader,
} from "../src/ThreeViewer";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));
const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));
const stylesSource = await Bun.file(
  new URL("../src/styles.css", import.meta.url),
).text();

describe("idle-frame anti-flicker contract", () => {
  test("preserves the last settled WebGL frame for Safari compositing", () => {
    expect(viewerSource).toContain(
      "preserveDrawingBuffer: preservedBackbufferRequired(",
    );
    expect(viewerSource).toContain("navigator.userAgent");
    expect(viewerSource).toContain("if (!renderRequired)");
    expect(viewerSource).toContain("controls.enableDamping = false");
    expect(viewerSource).not.toContain("timestamp < settleUntil");
    expect(viewerSource).not.toContain("timestamp < runtime.interactionUntil");
  });

  test("responds at full speed without reintroducing idle damping", () => {
    expect(viewerSource).toContain(
      "continuousFlightSpeeds(distance, flightSpeedScratch)",
    );
    expect(viewerSource).toContain(
      "createCameraRigStabilizationScratch()",
    );
    expect(viewerSource).not.toContain("flightVelocity.lerp");
    expect(viewerSource).toContain("controls.rotateSpeed = 1.08");
    expect(appSource).toContain("animationTime: 0.12");
    expect(appSource).toContain("immediateRender: true");
    expect(appSource).toContain("springStiffness: 18");
  });

  test("isolates one compositor surface behind the 3D modes", () => {
    expect(appSource).toContain("`app-shell--viewer-${viewerMode}`");
    expect(stylesSource).toContain(".app-shell--viewer-three .viewer");
    expect(stylesSource).toContain("visibility: hidden");
    expect(stylesSource).toContain(
      ".app-shell--viewer-three .map-stage::after",
    );
    expect(stylesSource).toContain("-webkit-backdrop-filter: none");
    expect(stylesSource).toContain("contain: strict");
  });

  test("keeps transparent ink from fighting itself while the camera moves", () => {
    const material = new LineBasicMaterial();
    stabilizeInkLineMaterial(material);

    expect(material.transparent).toBeTrue();
    expect(material.depthTest).toBeTrue();
    expect(material.depthWrite).toBeFalse();
    expect(material.alphaToCoverage).toBeFalse();
    expect(material.userData.temporallyStableInk).toBeTrue();
    expect(material.userData.stableInkAuthoredOpacity).toBe(1);
    expect(material.customProgramCacheKey()).toContain(
      "stable-ink-view-bias-v1",
    );

    stabilizeInkLineMaterial(material);
    expect(material.userData.temporallyStableInk).toBeTrue();
  });

  test("gives co-layer transparent ink a camera-independent draw order", () => {
    const lines = [
      new LineSegments(new BufferGeometry(), new LineBasicMaterial()),
      new LineSegments(new BufferGeometry(), new LineBasicMaterial()),
      new LineSegments(new BufferGeometry(), new LineBasicMaterial()),
    ];
    for (const line of lines) {
      line.renderOrder = 2;
    }
    assignStableInkRenderOrder(lines);
    const firstOrders = lines.map((line) => line.renderOrder);
    expect(new Set(firstOrders).size).toBe(lines.length);
    for (const order of firstOrders) {
      expect(order).toBeGreaterThan(2);
      expect(order).toBeLessThan(2 + STABLE_INK_RENDER_ORDER_SPAN);
    }

    // Camera motion cannot enter this policy; collecting the same objects
    // again must retain exact ranks rather than accumulating offsets.
    lines.reverse();
    assignStableInkRenderOrder(lines);
    lines.reverse();
    expect(lines.map((line) => line.renderOrder)).toEqual(firstOrders);
  });

  test("biases co-planar ink towards the camera by a physical fixed distance", () => {
    const source = "void main() {\n#include <project_vertex>\n}";
    const stabilized = stabilizeInkVertexShader(source);

    expect(STABLE_INK_VIEW_BIAS_M).toBe(0.03);
    expect(stabilized).toContain("mvPosition.z += stableInkViewBias");
    expect(stabilized).toContain("gl_Position = projectionMatrix * mvPosition");
    expect(stabilizeInkVertexShader(stabilized)).toBe(stabilized);
  });

  test("registers every drawn detail root for motion-safe ink", () => {
    for (const root of [
      "runtime.civicDetails",
      "runtime.centralDetails",
      "runtime.monuments",
      "runtime.culturalDetails",
      "runtime.parkDetails",
      "runtime.tunnelPortals",
    ]) {
      expect(viewerSource).toContain(root);
    }
    expect(viewerSource).toContain("PCFShadowMap");
    expect(viewerSource).not.toContain("PCFSoftShadowMap");
    expect(viewerSource).not.toContain("coarsePointer ? 1000 / 30 : 0");
  });

  test("registers the late CSD memorial before a cold Minecraft frame", () => {
    const memorialInstall = viewerSource.indexOf(
      "runtime.monuments.add(createCsdAttackMemorial())",
    );
    const antiFlickerCollect = viewerSource.indexOf(
      "collectFarZoomAntiFlickerTargets(runtime);",
      memorialInstall,
    );
    const nextLateLayer = viewerSource.indexOf(
      "runtime.culturalDetails.removeFromParent()",
      memorialInstall,
    );
    expect(memorialInstall).toBeGreaterThan(-1);
    expect(antiFlickerCollect).toBeGreaterThan(memorialInstall);
    expect(antiFlickerCollect).toBeLessThan(nextLateLayer);
    expect(viewerSource).toContain(
      "setCsdAttackMemorialSnow(runtime.monuments, isSnowstorm)",
    );
    expect(
      viewerSource.match(/csdAttackMemorialSolidAt\(x, y, z, radius\)/g),
    ).toHaveLength(2);
    const afterInstall = viewerSource.slice(memorialInstall);
    expect(afterInstall).toContain('runtime.lightingMode === "minecraft"');
    expect(afterInstall).toContain("setMinecraftMaterialPresentation(");
    expect(viewerSource).toContain(
      "runtime.monuments.visible = !runtime.underside",
    );
  });

  test("keeps Invalidenfriedhof snow and collision identical on warm and cold starts", () => {
    expect(viewerSource).toContain(
      "setInvalidenfriedhofSnow(runtime.culturalDetails, isSnowstorm)",
    );
    expect(viewerSource).toContain(
      "setStarbucksPariserPlatzSnow(runtime.culturalDetails, isSnowstorm)",
    );
    expect(viewerSource).toContain("setInvalidenfriedhofSnow(");
    expect(viewerSource).toContain("setStarbucksPariserPlatzSnow(");
    expect(
      viewerSource.match(
        /invalidenfriedhofPedestrianSolidAt\(x, y, z, radius\)/g,
      ),
    ).toHaveLength(2);
    // Smooth cemetery detail follows the ordinary cultural visibility policy;
    // Minecraft receives its separate block-native group with the voxel world.
    expect(viewerSource).toContain(
      "runtime.culturalDetails.visible = recognitionVisible",
    );
    expect(viewerSource).toContain(
      "runtime.voxelWorld.visible = voxelMode && !runtime.underside",
    );
  });

  test("keeps the Moabit prison memorial mode-aware on warm and cold starts", () => {
    expect(viewerSource).toContain(
      "moabitPrisonMemorialFocusCamera(runtime.lightingMode)",
    );
    expect(viewerSource).toContain(
      "target_world: [...moabitPrisonMemorialFocusTarget()]",
    );
    expect(viewerSource).toContain(
      "return MOABIT_PRISON_MEMORIAL_MARKER_Y",
    );
    expect(viewerSource).toContain(
      "setMoabitPrisonMemorialSnow(runtime.culturalDetails, isSnowstorm)",
    );
    expect(viewerSource).toContain(
      "setMoabitPrisonMemorialSmoothVisibility(",
    );
    expect(
      viewerSource.match(/moabitPrisonMemorialSolidAt\(x, y, z, 0\)/g),
    ).toHaveLength(2);
    expect(viewerSource).toContain(
      '{ detailProfile: runtime.coarsePointer ? "mobile" : "full" }',
    );
  });

  test("runs the same final anti-aliasing pass in motion and at rest", () => {
    expect(viewerSource).toContain(
      'import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js"',
    );
    expect(viewerSource).toContain("const smaaPass = new SMAAPass()");
    expect(viewerSource).toContain("smaaPass.enabled = true");
    expect(viewerSource.indexOf("composer.addPass(smaaPass)")).toBeGreaterThan(
      viewerSource.indexOf("composer.addPass(new RenderPass(scene, camera))"),
    );
    expect(viewerSource).not.toContain("ShaderPass");
    expect(viewerSource).not.toContain("crispPass");
    expect(viewerSource).toContain("smaaPass.dispose()");
  });

  test("uses the bounded WebGL profile in every mode and device class", () => {
    expect(viewerSource).toContain(
      "const webglMemoryProfile = stableWebglMemoryProfile(coarsePointer)",
    );
    expect(viewerSource).toContain(
      "antialias: webglMemoryProfile.antialias",
    );
    expect(viewerSource).toContain(
      "samples: webglMemoryProfile.composerSamples",
    );
    expect(viewerSource).toContain("type: UnsignedByteType");
    expect(viewerSource).toContain(
      "environmentFrameIntervalMs(runtime.coarsePointer)",
    );
    expect(viewerSource).toContain(
      "cameraMoving || runtime.renderInvalidated",
    );
    expect(viewerSource).toContain(
      "if (runtime.renderInvalidated) {\n          setSurfacePresentation",
    );
  });

  test("cancels inactive world construction after payload races", () => {
    expect(viewerSource).toContain(
      'function voxelWorldIntentActive(runtime: Runtime): boolean {\n  return runtime.lightingMode === "minecraft"',
    );
    expect(viewerSource).toContain(
      'function isoWorldIntentActive(runtime: Runtime): boolean {\n  return runtime.lightingMode !== "minecraft"',
    );
    const isoLoader = viewerSource.slice(
      viewerSource.indexOf("function ensureIsoWorld("),
      viewerSource.indexOf("function ensureVoxelWorld("),
    );
    expect(isoLoader).toContain("!isoWorldIntentActive(runtime)");
    expect(isoLoader).toContain('runtime.isoWorldState = "idle"');
    expect(isoLoader.indexOf("!isoWorldIntentActive(runtime)")).toBeLessThan(
      isoLoader.indexOf("createSchwellenraumMemorialProtectionIndex"),
    );
    const inactiveIsoFailure = isoLoader.lastIndexOf(
      "!isoWorldIntentActive(runtime)",
    );
    const activeIsoFallback = isoLoader.indexOf(
      "runtime.reportWorldFailure()",
      inactiveIsoFailure,
    );
    expect(activeIsoFallback).toBeGreaterThan(inactiveIsoFailure);
    expect(isoLoader.slice(inactiveIsoFailure, activeIsoFallback)).toContain(
      "return",
    );

    const voxelLoader = viewerSource.slice(
      viewerSource.indexOf("function ensureVoxelWorld("),
      viewerSource.indexOf("const DEFAULT_FOV_DEGREES"),
    );
    expect(voxelLoader).toContain("!voxelWorldIntentActive(runtime)");
    expect(voxelLoader).toContain('runtime.voxelWorldState = "idle"');
    expect(voxelLoader).toContain(
      '{ detailProfile: runtime.coarsePointer ? "mobile" : "full" }',
    );
    expect(
      voxelLoader.indexOf("!voxelWorldIntentActive(runtime)"),
    ).toBeLessThan(voxelLoader.indexOf("createMinecraftVoxelWorld("));
  });

  test("rolls back a partially attached voxel world before fallback", () => {
    const voxelLoader = viewerSource.slice(
      viewerSource.indexOf("function ensureVoxelWorld("),
      viewerSource.indexOf("const DEFAULT_FOV_DEGREES"),
    );
    expect(voxelLoader).toContain(
      "let provisionalVoxelWorld: Group | null = null",
    );
    expect(voxelLoader).toContain(
      "let provisionalMinecraftMobs: MinecraftMobField | null = null",
    );
    expect(voxelLoader).toContain(
      "runtime.voxelWorld === provisionalVoxelWorld",
    );
    expect(voxelLoader).toContain(
      "disposeObject3D(runtime, provisionalVoxelWorld)",
    );
    expect(voxelLoader).toContain(
      "disposeObject3D(runtime, provisionalMinecraftMobs.group)",
    );
    expect(voxelLoader.indexOf("runtime.voxelWorld = provisionalVoxelWorld"))
      .toBeGreaterThan(voxelLoader.indexOf("createMinecraftMobs("));
    const inactiveFailure = voxelLoader.lastIndexOf(
      "!voxelWorldIntentActive(runtime)",
    );
    expect(inactiveFailure).toBeGreaterThan(-1);
    const activeFallback = voxelLoader.indexOf(
      "runtime.reportWorldFailure()",
      inactiveFailure,
    );
    expect(activeFallback).toBeGreaterThan(inactiveFailure);
    expect(voxelLoader.slice(inactiveFailure, activeFallback)).toContain(
      "return",
    );
    expect(voxelLoader).toContain(
      "pedestrianSnapshot = capturePedestrianAttachment(runtime)",
    );
    expect(voxelLoader).toContain(
      "restorePedestrianAttachment(runtime, pedestrianSnapshot)",
    );
    expect(voxelLoader).toContain(
      "restoreWorldPresentationAfterRollback(runtime, rollbackUnderside)",
    );
    expect(viewerSource).toContain("cameraFar: runtime.camera.far");
    expect(viewerSource).toContain(
      "controlsMaxDistance: runtime.controls.maxDistance",
    );
    expect(viewerSource).toContain(
      "controlsMinDistance: runtime.controls.minDistance",
    );
    expect(viewerSource).toContain("runtime.camera.far = snapshot.cameraFar");
    expect(viewerSource).toContain(
      "runtime.controls.maxDistance = snapshot.controlsMaxDistance",
    );
    expect(viewerSource).toContain(
      "runtime.controls.minDistance = snapshot.controlsMinDistance",
    );
    expect(voxelLoader).not.toContain("runtime.startDeferredDetails()");
    const voxelCommit = voxelLoader.indexOf(
      "provisionalVoxelWorld = null",
    );
    const voxelReady = voxelLoader.indexOf(
      "notifyPresentationReadyWhenPossible(runtime)",
      voxelCommit,
    );
    expect(voxelCommit).toBeGreaterThan(-1);
    expect(voxelReady).toBeGreaterThan(voxelCommit);
  });

  test("publishes the smooth world transactionally before its worker", () => {
    const isoLoader = viewerSource.slice(
      viewerSource.indexOf("function ensureIsoWorld("),
      viewerSource.indexOf("function ensureVoxelWorld("),
    );
    const construction = isoLoader.indexOf(
      "const isoWorld = createIsometricCity(",
    );
    const commit = isoLoader.indexOf("runtime.isoWorld = isoWorld");
    const workerStart = isoLoader.indexOf(
      "applyProgressiveWorldMode(runtime, runtime.lightingMode, warn)",
    );
    expect(construction).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(construction);
    expect(workerStart).toBeGreaterThan(commit);
    expect(isoLoader).toContain(
      "mutableRootSnapshots = captureMutableRootSnapshots([",
    );
    expect(isoLoader).toContain("runtime.signatures,");
    expect(isoLoader).toContain(
      "restoreProgressiveWorld(runtime, progressiveSnapshot)",
    );
    expect(isoLoader).toContain(
      "rollbackMutableRoots(runtime, mutableRootSnapshots)",
    );
    expect(isoLoader).toContain("runtime.isoWorld = originalIsoWorld");
    expect(isoLoader).toContain("disposeObject3D(runtime, provisionalIsoWorld)");
    expect(isoLoader).toContain(
      "restorePedestrianAttachment(runtime, pedestrianSnapshot)",
    );
    const deferredDetails = isoLoader.indexOf("runtime.startDeferredDetails()");
    const progressiveMode = isoLoader.indexOf(
      "applyProgressiveWorldMode(runtime, runtime.lightingMode, warn)",
    );
    const transactionCommit = isoLoader.indexOf(
      "provisionalIsoWorld = null",
      progressiveMode,
    );
    const presentationReady = isoLoader.indexOf(
      "notifyPresentationReadyWhenPossible(runtime)",
      transactionCommit,
    );
    expect(deferredDetails).toBeGreaterThan(commit);
    expect(progressiveMode).toBeGreaterThan(deferredDetails);
    expect(transactionCommit).toBeGreaterThan(progressiveMode);
    expect(presentationReady).toBeGreaterThan(transactionCommit);
  });

  test("does not clone or reveal deferred park details behind voxels", () => {
    const deferredPark = viewerSource.slice(
      viewerSource.indexOf("const details = createParkDetails("),
      viewerSource.indexOf("runtime.tunnel = createTunnel("),
    );
    expect(deferredPark).toContain("const voxelMode = voxelModeActive(runtime)");
    expect(deferredPark).toContain(
      "details.visible = !runtime.underside && !voxelMode",
    );
    expect(deferredPark).toContain(
      'runtime.lightingMode === "minecraft" &&',
    );
    expect(deferredPark).toContain("!voxelMode");
    expect(deferredPark).toContain(
      'detailProfile: runtime.coarsePointer ? "mobile" : "full"',
    );
    expect(viewerSource).toContain("releaseMinecraftMaterialBindings(");
    expect(viewerSource).toContain("const hiddenHeavyRoots");
    expect(viewerSource).toContain("!hiddenHeavyRoots.has(child)");
    expect(viewerSource).not.toContain("photoFallbackVisible");
    expect(viewerSource).not.toContain(
      "setMinecraftMaterialPresentation(\n        runtime.scene",
    );
    expect(viewerSource).toContain(
      "setMinecraftMaterialPresentation(\n              runtime.culturalDetails",
    );
    expect(viewerSource).toContain(
      "restoreMinecraftMaterialPresentation(runtime.minecraftMaterialState)",
    );
    expect(viewerSource).not.toContain("const passiveIntervals: number[]");
  });

  test("never allocates the retired photographic shell during recovery", () => {
    const recovery = viewerSource.slice(
      viewerSource.indexOf("runtime.reportWorldFailure = () =>"),
      viewerSource.indexOf("runtime.reportWorldFailure = () =>") + 900,
    );
    expect(recovery).toContain("runtime.worldFailureReported");
    expect(recovery).toContain("prozedurale 3D-Welt");
    expect(viewerSource).not.toContain("GLTFLoader");
    expect(viewerSource).not.toContain("MeshoptDecoder");
    expect(viewerSource).not.toContain("loadModelWithRetry");
    expect(viewerSource).not.toContain("const sortedTiles");
    expect(viewerSource).toContain(
      "export function photographicSurfaceNeeded(",
    );
    expect(viewerSource).toContain("return false;");
  });

  test("keeps authored civic flags in every above-ground visual mode", () => {
    for (const mode of ["day", "night", "minecraft"] as const) {
      expect(civicDetailsVisible(false), mode).toBe(true);
    }
    expect(civicDetailsVisible(true)).toBe(false);
  });

  test("does not retain duplicate interaction or settled surface roots", () => {
    expect(viewerSource).not.toContain("runtime.interactionSurface");
    expect(viewerSource).not.toContain("runtime.settledSurface");
    expect(viewerSource).toContain('"recovery-required"');
  });

  test("keeps Richard Wagner readable when switching between smooth and Minecraft worlds", () => {
    expect(viewerSource).toContain(
      "wagnerMemorialFocusCamera(runtime.lightingMode)",
    );
    expect(viewerSource).toContain(
      "previousLightingMode !== lightingMode &&",
    );
    expect(viewerSource).toContain(
      "selectedLandmarkName === WAGNER_MEMORIAL_PROFILE.name ||",
    );
    expect(viewerSource).toContain(
      "selectedLandmarkName === MOABIT_PRISON_MEMORIAL_PROFILE.name",
    );
    expect(viewerSource).toContain(
      "focusLandmarkRef.current(selectedLandmarkName, true)",
    );
  });
});
