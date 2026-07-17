import { describe, expect, test } from "bun:test";
import { DataTexture, MeshStandardMaterial } from "three";

import {
  applyDrawnFacade,
  averageColorFromPixels,
  harmonizeFacadeColor,
  isDrawnFacadeCandidate,
  isDrawnFacadeSatisfied,
  quantizeChannel,
  type Rgb,
} from "../src/drawnBuildings";

const luma = ([r, g, b]: Rgb): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

describe("drawn facade colour derivation", () => {
  test("averages opaque texels and ignores transparent ones", () => {
    const pixels = new Uint8ClampedArray([
      100, 100, 100, 255, 200, 200, 200, 255, 0, 0, 0, 0,
    ]);
    expect(averageColorFromPixels(pixels)).toEqual([150, 150, 150]);
  });

  test("falls back to a neutral tone for an empty buffer", () => {
    expect(averageColorFromPixels(new Uint8ClampedArray())).toEqual([
      176, 172, 160,
    ]);
  });

  test("quantises channels onto discrete flat levels", () => {
    expect(quantizeChannel(0, 6)).toBe(0);
    expect(quantizeChannel(1, 6)).toBe(1);
    // Six levels ⇒ steps of 0.2; 0.33 snaps to 0.4.
    expect(quantizeChannel(0.33, 6)).toBeCloseTo(0.4, 10);
  });
});

describe("harmonizeFacadeColor keeps the palette coherent, warm and bright", () => {
  test("a near-black roof photo is lifted to a bright warm stone, never black", () => {
    const stone = harmonizeFacadeColor([12, 12, 14]);
    // Round-4 failure was facades collapsing to ~0.08 luminance. The floor here
    // guarantees a bright tone.
    expect(luma(stone)).toBeGreaterThanOrEqual(0.55);
    // Warm: red channel leads, blue trails.
    expect(stone[0]).toBeGreaterThan(stone[2]);
  });

  test("a cyan sky-reflection photo is desaturated to the same warm stone", () => {
    // Round-5 mosaic came from sky-reflection tiles staying cyan. After
    // harmonising, the chroma is gone and the hue is warm (R >= G >= B).
    const stone = harmonizeFacadeColor([70, 150, 190]);
    expect(stone[0]).toBeGreaterThanOrEqual(stone[2]);
    expect(stone[1]).toBeGreaterThanOrEqual(stone[2]);
    // Blue no longer dominates.
    expect(stone[2]).toBeLessThan(stone[0] + 1);
  });

  test("every harmonised tone lands in the bright, unblown band", () => {
    const samples: Rgb[] = [
      [12, 12, 14],
      [70, 150, 190],
      [200, 40, 40],
      [40, 160, 60],
      [220, 220, 220],
      [128, 120, 110],
    ];
    for (const sample of samples) {
      const l = luma(harmonizeFacadeColor(sample));
      // Floor 0.60 (×warm tint pulls the effective floor slightly lower) up to
      // floor+span; assert a comfortably bright, non-blown range.
      expect(l).toBeGreaterThanOrEqual(0.5);
      expect(l).toBeLessThanOrEqual(0.92);
    }
  });

  test("neighbouring photos snap onto the same shared tone (no patchwork)", () => {
    // Two tiles whose photos differ only by fine noise must quantise to the
    // identical facade colour, so adjacent buildings never form a mosaic.
    const a = harmonizeFacadeColor([150, 148, 146]);
    const b = harmonizeFacadeColor([156, 152, 150]);
    for (let i = 0; i < 3; i += 1) {
      expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(2);
    }
  });
});

describe("applyDrawnFacade", () => {
  test("removes photo maps and sets matte, non-metallic shading", () => {
    const material = new MeshStandardMaterial({ color: 0x8899aa });
    material.metalness = 0.9;
    applyDrawnFacade(material);
    expect(material.map).toBeNull();
    expect(material.emissiveMap).toBeNull();
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThanOrEqual(0.72);
  });

  test("sets a bright warm facade colour, never dark", () => {
    const material = new MeshStandardMaterial({ color: 0x101012 });
    applyDrawnFacade(material);
    const l =
      0.2126 * material.color.r +
      0.7152 * material.color.g +
      0.0722 * material.color.b;
    expect(l).toBeGreaterThanOrEqual(0.5);
    expect(material.color.r).toBeGreaterThanOrEqual(material.color.b);
  });

  test("sets the drawn-facade contract flag and is idempotent", () => {
    const material = new MeshStandardMaterial({ color: 0x8899aa });
    applyDrawnFacade(material);
    expect(material.userData.drawnFacadeApplied).toBe(true);
    // Second call is a no-op guard (does not throw / re-process).
    applyDrawnFacade(material);
    expect(material.userData.drawnFacadeApplied).toBe(true);
  });
});

describe("drawn-facade contract (no unstylised photo building survives)", () => {
  const leafTexture = () => new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);

  test("an untouched candidate building violates the contract", () => {
    expect(isDrawnFacadeSatisfied(new MeshStandardMaterial())).toBe(false);
  });

  test("a stylised candidate building satisfies the contract", () => {
    const material = new MeshStandardMaterial();
    applyDrawnFacade(material);
    expect(isDrawnFacadeSatisfied(material)).toBe(true);
  });

  test("an exempt cut-out card (leaf) satisfies the contract untouched", () => {
    const tree = new MeshStandardMaterial();
    tree.alphaTest = 0.5;
    tree.map = leafTexture();
    expect(isDrawnFacadeSatisfied(tree)).toBe(true);
    expect(tree.userData.drawnFacadeApplied).toBeUndefined();
  });
});

describe("vegetation and cut-out materials are exempt from the drawn facade", () => {
  const leafTexture = () => new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);

  test("opaque building materials qualify for the drawn facade", () => {
    expect(isDrawnFacadeCandidate(new MeshStandardMaterial())).toBe(true);
  });

  test("alpha-tested cut-out cards (leaves) are skipped", () => {
    const material = new MeshStandardMaterial();
    material.alphaTest = 0.5;
    expect(isDrawnFacadeCandidate(material)).toBe(false);
  });

  test("blended-transparent materials are skipped", () => {
    const material = new MeshStandardMaterial();
    material.transparent = true;
    expect(isDrawnFacadeCandidate(material)).toBe(false);
  });

  test("materials carrying an alphaMap are skipped", () => {
    const material = new MeshStandardMaterial();
    material.alphaMap = leafTexture();
    expect(isDrawnFacadeCandidate(material)).toBe(false);
  });

  test("a skipped tree keeps its texture instead of becoming a solid quad", () => {
    // Reproduces the regression: an alpha-tested leaf card must keep its map,
    // otherwise the cut-out fills in as a flat (sky-averaged) light-blue quad.
    const tree = new MeshStandardMaterial();
    tree.alphaTest = 0.5;
    tree.map = leafTexture();
    if (isDrawnFacadeCandidate(tree)) {
      applyDrawnFacade(tree);
    }
    expect(tree.map).not.toBeNull();
  });
});

describe("vertex-colour posterisation (hard-edged drawn facades)", () => {
  test("applyDrawnFacade installs the poster shader with a stable cache key", async () => {
    const { MeshStandardMaterial } = await import("three");
    const { applyDrawnFacade, VERTEX_POSTER_COLOR_FRAGMENT } = await import(
      "../src/drawnBuildings"
    );
    const material = new MeshStandardMaterial({ vertexColors: true });
    applyDrawnFacade(material);
    expect(typeof material.onBeforeCompile).toBe("function");
    expect(material.customProgramCacheKey()).toBe(
      "drawn-facade-vertex-poster-v1",
    );
    const shader = {
      fragmentShader: "prefix\n#include <color_fragment>\nsuffix",
      uniforms: {},
      vertexShader: "",
    };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.fragmentShader).not.toContain("#include <color_fragment>");
    expect(shader.fragmentShader).toContain("posterTone");
    // Canopy exemption: green-dominant fragments keep their smooth tone.
    expect(shader.fragmentShader).toContain("canopySoftness");
    expect(VERTEX_POSTER_COLOR_FRAGMENT).toContain("floor(vertexLuma * 5.0");
  });
});
