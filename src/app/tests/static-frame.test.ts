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
