import { describe, expect, test } from "bun:test";
import { invalidateScenePresentation } from "../src/ThreeViewer";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const transpiler = new Bun.Transpiler({ loader: "ts" });

type TestRuntime = {
  renderInvalidated: boolean;
  shadowInvalidated: boolean;
  tunnelPortalInteriorVisible: boolean;
  focusedCameraFov: number | null;
  interactionUntil: number;
};

// Execute the actual navigation invalidator and shadow-render gate. This
// catches interaction->renderInvalidated->shadowInvalidated coupling without
// a synthetic WebGL context or a duplicate scheduling policy.
const interactionSource = source.slice(
  source.indexOf("function markSurfaceInteraction("),
  source.indexOf("/** Authored civic signatures"),
);
const interact = new Function(
  "invalidateScenePresentation", "setTunnelPortalPresentation", "voxelModeActive",
  `${transpiler.transformSync(interactionSource)}; return markSurfaceInteraction;`,
)(invalidateScenePresentation, () => {}, () => false) as (
  runtime: TestRuntime, durationMs?: number, preserveTunnelFocus?: boolean,
) => void;

const frameStart = source.indexOf("        const isMoving =\n");
const gateStart = source.indexOf("        const shadowRefresh =\n", frameStart);
const gateEnd = source.indexOf("        // Visible civic cloth", gateStart);
const renderStart = source.indexOf("        if (shadowRefresh) renderer.shadowMap.needsUpdate = true;", gateEnd);
const renderEnd = source.indexOf("        runtime.renderInvalidated = false;", renderStart)
  + "        runtime.renderInvalidated = false;".length;
expect(frameStart).toBeGreaterThan(-1);
expect(gateStart).toBeGreaterThan(frameStart);
expect(renderStart).toBeGreaterThan(gateEnd);

const render = new Function("runtime", "renderer", "composer", "cameraMoving",
  source.slice(gateStart, gateEnd) + source.slice(renderStart, renderEnd),
) as (runtime: TestRuntime, renderer: { shadowMap: { enabled: boolean; needsUpdate: boolean } },
  composer: { render(): void }, cameraMoving: boolean) => void;

function harness(enabled = true) {
  const runtime: TestRuntime = {
    renderInvalidated: false, shadowInvalidated: false,
    tunnelPortalInteriorVisible: false, focusedCameraFov: null, interactionUntil: 0,
  };
  const renderer = { shadowMap: { enabled, needsUpdate: false } };
  let shadowUpdates = 0;
  const composer = { render() {
    if (renderer.shadowMap.enabled && renderer.shadowMap.needsUpdate) {
      shadowUpdates += 1;
      renderer.shadowMap.needsUpdate = false;
    }
  } };
  return { runtime, renderer, frame: (moving: boolean) => render(runtime, renderer, composer, moving),
    updates: () => shadowUpdates };
}

describe("static desktop shadow invalidation", () => {
  test("camera movement and release reuse the existing shadow atlas", () => {
    const view = harness();
    for (let frame = 0; frame < 120; frame += 1) {
      interact(view.runtime);
      expect(view.runtime.renderInvalidated).toBeTrue();
      view.frame(true);
    }
    interact(view.runtime); // OrbitControls' end also invalidates the view.
    view.frame(false);
    expect(view.updates()).toBe(0);
    expect(view.runtime.shadowInvalidated).toBeFalse();
    expect(source.slice(frameStart, gateStart)).not.toContain("runtime.shadowInvalidated = true");
  });

  test("a scene change during motion survives until one settled shadow render", () => {
    const view = harness();
    invalidateScenePresentation(view.runtime);
    expect(view.runtime.renderInvalidated).toBeTrue();
    interact(view.runtime);
    view.frame(true);
    expect(view.updates()).toBe(0);
    expect(view.runtime.shadowInvalidated).toBeTrue();
    view.frame(false);
    expect(view.updates()).toBe(1);
    expect(view.runtime.shadowInvalidated).toBeFalse();
    view.frame(false);
    expect(view.updates()).toBe(1);
  });

  test("closing a focused tunnel portal remains a visibility mutation", () => {
    const view = harness();
    view.runtime.tunnelPortalInteriorVisible = true;
    interact(view.runtime, 220, true);
    expect(view.runtime.shadowInvalidated).toBeFalse();
    interact(view.runtime);
    expect(view.runtime.tunnelPortalInteriorVisible).toBeFalse();
    view.frame(false);
    expect(view.updates()).toBe(1);
  });

  test("disabled shadows retain a pending source change until enabled", () => {
    const view = harness(false);
    invalidateScenePresentation(view.runtime);
    view.frame(false);
    expect(view.updates()).toBe(0);
    expect(view.runtime.shadowInvalidated).toBeTrue();
    view.renderer.shadowMap.enabled = true;
    view.frame(false);
    expect(view.updates()).toBe(1);
  });

  test("geometry, lighting and model visibility explicitly invalidate shadows", () => {
    for (const name of ["attachProgressiveWorldMessage", "setSceneLighting",
      "setModelMaterialState", "setEnvironmentalPresentation", "syncPedestrianTunnelPresentation",
      "collectFarZoomAntiFlickerTargets", "updateMobileBuildingDetails"]) {
      const start = source.indexOf(`function ${name}(`);
      const end = source.indexOf("\nfunction ", start + 1);
      expect(start, name).toBeGreaterThan(-1);
      expect(source.slice(start, end), name).toContain("invalidateScenePresentation(runtime)");
    }
    const fadeStart = source.indexOf("function updateFarZoomAntiFlicker(");
    const fadeEnd = source.indexOf("export function applyLightingToRoot(", fadeStart);
    const fade = source.slice(fadeStart, fadeEnd);
    expect(fade.match(/if \(visibilityChanged\) invalidateScenePresentation\(runtime\)/g)).toHaveLength(2);
    // Opacity follows the camera continuously; it must not rebuild the atlas.
    expect(fade.slice(0, fade.indexOf("const fineDetailVisible")))
      .not.toContain("invalidateScenePresentation(runtime)");
  });
});
