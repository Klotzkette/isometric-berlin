import { describe, expect, test } from "bun:test";
import { DataTexture, MeshStandardMaterial } from "three";

import {
  applyDrawnFacade,
  averageColorFromPixels,
  drawnFacadeColor,
  isDrawnFacadeCandidate,
  quantizeChannel,
  stylizeFacadePixels,
} from "../src/drawnBuildings";

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

  test("posterises and desaturates toward a drawn tone", () => {
    const drawn = drawnFacadeColor([210, 40, 40]);
    // Result stays reddish but is pulled toward luminance (less saturated).
    const spread = Math.max(...drawn) - Math.min(...drawn);
    expect(spread).toBeLessThan(210 - 40);
    // Every channel lands on a posterised level (multiple of 255/5).
    for (const channel of drawn) {
      expect(Math.round((channel / 255) * 5) / 5).toBeCloseTo(channel / 255, 6);
    }
  });
});

describe("stylizeFacadePixels renders a drawing, not a photo", () => {
  test("flat regions posterise onto drawn tones with no inking", () => {
    // A uniform 2x2 patch has no luminance edges, so every texel becomes the
    // plain posterised gouache tone — no photo gradient survives.
    const value = 100;
    const pixels = new Uint8ClampedArray(2 * 2 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
    const styled = stylizeFacadePixels(pixels, 2, 2);
    const [pr, pg, pb] = drawnFacadeColor([value, value, value], 5, 0.3);
    expect(Math.abs(styled[0] - pr)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(styled[1] - pg)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(styled[2] - pb)).toBeLessThanOrEqual(0.5);
    expect(styled[3]).toBe(255);
  });

  test("inks a thin dark line along a facade edge and preserves alpha", () => {
    // Row: two mid-grey texels then two light texels. The texel straddling the
    // luminance step gets darkened (an inked window/cornice line); the flat
    // texel away from the edge keeps its plain posterised tone.
    const pixels = new Uint8ClampedArray([
      100, 100, 100, 255, 100, 100, 100, 255, 240, 240, 240, 200, 240, 240, 240,
      200,
    ]);
    const styled = stylizeFacadePixels(pixels, 4, 1);
    const flatDark = styled[0];
    const edgeDark = styled[4];
    expect(edgeDark).toBeLessThan(flatDark);
    // Alpha is carried through untouched (cut-out edges stay intact).
    expect(styled[3]).toBe(255);
    expect(styled[11]).toBe(200);
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
