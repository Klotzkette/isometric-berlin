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
    expect(viewerSource).toContain("PCFSoftShadowMap");
    expect(viewerSource).not.toContain("coarsePointer ? 1000 / 30 : 0");
  });

  test("keeps authored civic flags in every above-ground visual mode", () => {
    for (const mode of ["day", "night", "minecraft"] as const) {
      expect(civicDetailsVisible(false), mode).toBe(true);
    }
    expect(civicDetailsVisible(true)).toBe(false);
  });
});
