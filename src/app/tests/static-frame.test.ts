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
).text();
const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
).text();
const stylesSource = await Bun.file(
  new URL("../src/styles.css", import.meta.url),
).text();

describe("idle-frame anti-flicker contract", () => {
  test("preserves the last settled WebGL frame for Safari compositing", () => {
    expect(viewerSource).toContain("preserveDrawingBuffer: true");
    expect(viewerSource).toContain("if (!renderRequired)");
    expect(viewerSource).toContain("controls.enableDamping = false");
    expect(viewerSource).not.toContain("timestamp < settleUntil");
    expect(viewerSource).not.toContain("timestamp < runtime.interactionUntil");
  });

  test("responds at full speed without reintroducing idle damping", () => {
    expect(viewerSource).toContain("continuousFlightSpeeds(distance)");
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
    expect(material.alphaToCoverage).toBeTrue();
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
    expect(viewerSource).toContain("setInvalidenfriedhofSnow(");
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

  test("runs the same final anti-aliasing pass in motion and at rest", () => {
    expect(viewerSource).toContain(
      'import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js"',
    );
    expect(viewerSource).toContain("const smaaPass = new SMAAPass()");
    expect(viewerSource).toContain("smaaPass.enabled = true");
    expect(viewerSource.indexOf("composer.addPass(smaaPass)")).toBeGreaterThan(
      viewerSource.indexOf("composer.addPass(crispPass)"),
    );
    expect(viewerSource).toContain("crispPass.enabled = false");
    expect(viewerSource).not.toContain("crispPass.enabled = true");
    expect(viewerSource).toContain("smaaPass.dispose()");
  });

  test("uses the bounded mobile WebGL profile without changing desktop", () => {
    expect(viewerSource).toContain(
      "const webglMemoryProfile = stableWebglMemoryProfile(coarsePointer)",
    );
    expect(viewerSource).toContain(
      "antialias: webglMemoryProfile.antialias",
    );
    expect(viewerSource).toContain(
      "samples: webglMemoryProfile.composerSamples",
    );
    expect(viewerSource).toContain("? HalfFloatType");
    expect(viewerSource).toContain(": UnsignedByteType");
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
      "runtime.ensurePhotoSurface()",
      inactiveIsoFailure,
    );
    expect(activeIsoFallback).toBeGreaterThan(inactiveIsoFailure);
    expect(isoLoader.slice(inactiveIsoFailure, activeIsoFallback)).toContain(
      "return",
    );

    const voxelLoader = viewerSource.slice(
      viewerSource.indexOf("function ensureVoxelWorld("),
      viewerSource.indexOf("const PHOTO_FOV_DEGREES"),
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
      viewerSource.indexOf("const PHOTO_FOV_DEGREES"),
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
      "runtime.ensurePhotoSurface()",
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
    expect(voxelLoader).toContain(
      "if (!runtime.coarsePointer) {\n        runtime.startDeferredDetails()",
    );
    const voxelDeferredDetails = voxelLoader.indexOf(
      "runtime.startDeferredDetails()",
    );
    const voxelCommit = voxelLoader.indexOf(
      "provisionalVoxelWorld = null",
      voxelDeferredDetails,
    );
    const voxelReady = voxelLoader.indexOf(
      "notifyPresentationReadyWhenPossible(runtime)",
      voxelCommit,
    );
    expect(voxelDeferredDetails).toBeGreaterThan(-1);
    expect(voxelCommit).toBeGreaterThan(voxelDeferredDetails);
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
    expect(viewerSource).toContain(
      "releaseMinecraftMaterialBindings(\n        runtime.parkDetails",
    );
    expect(viewerSource).toContain("child !== runtime.parkDetails");
  });

  test("keeps authored civic flags in every above-ground visual mode", () => {
    for (const mode of ["day", "night", "minecraft"] as const) {
      expect(civicDetailsVisible(false), mode).toBe(true);
    }
    expect(civicDetailsVisible(true)).toBe(false);
  });

  test("keeps the Minecraft underground shell out of the toon-material pass", () => {
    expect(viewerSource).toContain("if (voxelMode && underside)");
    expect(viewerSource).toContain("runtime.interactionSurface");
    expect(viewerSource).toContain("runtime.settledSurface");
    expect(viewerSource).toContain("metallic shards");
  });
});
