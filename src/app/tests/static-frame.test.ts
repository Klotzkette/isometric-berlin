import { describe, expect, test } from "bun:test";
import { LineBasicMaterial } from "three";

import {
  civicDetailsVisible,
  stabilizeInkLineMaterial,
} from "../src/ThreeViewer";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

describe("idle-frame anti-flicker contract", () => {
  test("preserves the last settled WebGL frame for Safari compositing", () => {
    expect(viewerSource).toContain("preserveDrawingBuffer: true");
    expect(viewerSource).toContain("if (!renderRequired)");
  });

  test("keeps transparent ink from fighting itself while the camera moves", () => {
    const material = new LineBasicMaterial();
    stabilizeInkLineMaterial(material);

    expect(material.transparent).toBeTrue();
    expect(material.depthTest).toBeTrue();
    expect(material.depthWrite).toBeFalse();
    expect(material.alphaToCoverage).toBeTrue();
    expect(material.userData.temporallyStableInk).toBeTrue();

    stabilizeInkLineMaterial(material);
    expect(material.userData.temporallyStableInk).toBeTrue();
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

  test("runs the same final anti-aliasing pass in motion and at rest", () => {
    expect(viewerSource).toContain(
      'import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js"',
    );
    expect(viewerSource).toContain("const smaaPass = new SMAAPass()");
    expect(viewerSource).toContain("smaaPass.enabled = true");
    expect(viewerSource.indexOf("composer.addPass(smaaPass)")).toBeGreaterThan(
      viewerSource.indexOf("composer.addPass(crispPass)"),
    );
    expect(viewerSource).toContain("smaaPass.dispose()");
  });

  test("keeps authored civic flags in every above-ground visual mode", () => {
    for (const mode of ["day", "night", "minecraft"] as const) {
      expect(civicDetailsVisible(false), mode).toBe(true);
    }
    expect(civicDetailsVisible(true)).toBe(false);
  });
});
