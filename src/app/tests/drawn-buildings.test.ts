import { describe, expect, test } from "bun:test";
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  MeshStandardMaterial,
} from "three";

import {
  applyDrawnFacade,
  averageColorFromPixels,
  blendTowardAnchor,
  dominantFacadeColor,
  flattenBuildingVertexColors,
  HERO_FACADE_ANCHORS,
  installFlatUnlitShader,
  isDrawnFacadeCandidate,
  isDrawnFacadeSatisfied,
  medianColorFromPixels,
  quantizeChannel,
  setBuildingColorMode,
  setFlatUnlit,
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
    expect(medianColorFromPixels(new Uint8ClampedArray())).toEqual([
      176, 172, 160,
    ]);
  });

  test("median reports the dominant tone, ignoring dark/outlier texels", () => {
    // Four bright stone texels plus one near-black window texel: the mean would
    // be dragged down, but the median stays on the dominant stone colour.
    const pixels = new Uint8ClampedArray([
      200, 190, 170, 255, 202, 192, 172, 255, 198, 188, 168, 255, 204, 194, 174,
      255, 8, 8, 10, 255,
    ]);
    const [r, g, b] = medianColorFromPixels(pixels);
    expect(r).toBeGreaterThanOrEqual(198);
    expect(g).toBeGreaterThanOrEqual(188);
    expect(b).toBeGreaterThanOrEqual(168);
  });

  test("quantises channels onto discrete flat levels", () => {
    expect(quantizeChannel(0, 6)).toBe(0);
    expect(quantizeChannel(1, 6)).toBe(1);
    // Six levels ⇒ steps of 0.2; 0.33 snaps to 0.4.
    expect(quantizeChannel(0.33, 6)).toBeCloseTo(0.4, 10);
  });
});

describe("dominantFacadeColor keeps the building's real colour (round-6)", () => {
  test("a warm stone facade stays warm (R leads)", () => {
    const [r, g, b] = dominantFacadeColor([180, 150, 100]);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  test("a cool glass facade stays cool (B leads) — NOT recoloured warm", () => {
    // The round-5 failure forced everything to warm sandstone. A glass tower
    // must keep its own cool tone.
    const [r, , b] = dominantFacadeColor([40, 90, 150]);
    expect(b).toBeGreaterThan(r);
  });

  test("a dark facade is lifted to a readable mid tone, never black", () => {
    expect(luma(dominantFacadeColor([12, 12, 14]))).toBeGreaterThanOrEqual(0.3);
  });

  test("a bright white facade is kept bright but not blown out", () => {
    const l = luma(dominantFacadeColor([240, 240, 240]));
    expect(l).toBeGreaterThanOrEqual(0.75);
    expect(l).toBeLessThanOrEqual(0.9);
  });

  test("hue is preserved for a saturated real colour", () => {
    // A red-brick facade must not lose its identity — red still dominates.
    const [r, g, b] = dominantFacadeColor([170, 70, 60]);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });
});

describe("blendTowardAnchor", () => {
  test("interpolates linearly toward the anchor", () => {
    expect(blendTowardAnchor([0, 0, 0], [100, 200, 40], 0.5)).toEqual([
      50, 100, 20,
    ]);
  });

  test("clamps the blend amount to [0, 1]", () => {
    expect(blendTowardAnchor([10, 10, 10], [200, 200, 200], 2)).toEqual([
      200, 200, 200,
    ]);
    expect(blendTowardAnchor([10, 10, 10], [200, 200, 200], -1)).toEqual([
      10, 10, 10,
    ]);
  });
});

describe("applyDrawnFacade renders an unlit flat real-colour facade", () => {
  test("removes photo maps and sets matte, non-metallic shading", () => {
    const material = new MeshStandardMaterial({ color: 0x8899aa });
    material.metalness = 0.9;
    applyDrawnFacade(material);
    expect(material.map).toBeNull();
    expect(material.emissiveMap).toBeNull();
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThanOrEqual(0.72);
  });

  test("keeps the real hue (a cool material stays cool) and never goes black", () => {
    const material = new MeshStandardMaterial({ color: 0x28425f });
    applyDrawnFacade(material);
    expect(material.color.b).toBeGreaterThan(material.color.r);
    const l =
      0.2126 * material.color.r +
      0.7152 * material.color.g +
      0.0722 * material.color.b;
    expect(l).toBeGreaterThanOrEqual(0.3);
  });

  test("stores the flat tone for the lossless day/night mode switch", () => {
    const material = new MeshStandardMaterial({ color: 0x9a8f77 });
    applyDrawnFacade(material);
    expect(material.userData.dayFlatColor).toBe(material.color.getHex());
  });

  test("a hero anchor nudges the tone toward the curated colour", () => {
    const plain = new MeshStandardMaterial({ color: 0x304050 });
    applyDrawnFacade(plain);
    const anchored = new MeshStandardMaterial({ color: 0x304050 });
    applyDrawnFacade(anchored, { anchor: HERO_FACADE_ANCHORS.reichstag });
    // The anchored copy is pulled toward warm sandstone: warmer (more red)
    // than the un-anchored cool tone.
    expect(anchored.color.r).toBeGreaterThan(plain.color.r);
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

describe("applyDrawnFacade keeps a vertex-coloured building's real colour", () => {
  test("keeps vertex colours and a neutral white multiplier (no flat tone)", () => {
    const material = new MeshStandardMaterial({ color: 0x445566 });
    material.vertexColors = true;
    applyDrawnFacade(material);
    // Real colour lives in the vertex-colour attribute; the diffuse multiplier
    // must be neutral white so it survives untinted, and no single flat tone is
    // baked in.
    expect(material.vertexColors).toBe(true);
    expect(material.color.r).toBeCloseTo(1, 5);
    expect(material.color.g).toBeCloseTo(1, 5);
    expect(material.color.b).toBeCloseTo(1, 5);
    expect(material.userData.drawnKind).toBe("vertex");
    expect(material.userData.dayFlatColor).toBeUndefined();
  });

  test("a textured/plain material still collapses to a flat tone", () => {
    const material = new MeshStandardMaterial({ color: 0x9a8f77 });
    applyDrawnFacade(material);
    expect(material.userData.drawnKind).toBe("flat");
    expect(material.userData.dayFlatColor).toBe(material.color.getHex());
  });
});

describe("flat-unlit shader toggle", () => {
  test("installFlatUnlitShader is idempotent and installs an onBeforeCompile", () => {
    const material = new MeshStandardMaterial();
    installFlatUnlitShader(material);
    const first = material.onBeforeCompile;
    expect(typeof first).toBe("function");
    installFlatUnlitShader(material);
    // Second call is a no-op guard — the hook is not re-wrapped.
    expect(material.onBeforeCompile).toBe(first);
    expect(material.userData.flatUnlitInstalled).toBe(true);
  });

  test("setFlatUnlit flips the userData toggle", () => {
    const material = new MeshStandardMaterial();
    installFlatUnlitShader(material);
    setFlatUnlit(material, true);
    expect(material.userData.flatUnlit).toBe(1);
    setFlatUnlit(material, false);
    expect(material.userData.flatUnlit).toBe(0);
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

describe("flattenBuildingVertexColors collapses faces to flat tones", () => {
  // Build one wall (vertical, +X facing) whose baked vertex colours carry a
  // strong lightness gradient (the photogrammetry smear), plus a roof patch
  // (up-facing) and one green vegetation vertex, all in the same XZ cell.
  const buildGeometry = () => {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    // 6 wall verts at the same XZ cell, gradient from dark to light grey.
    for (let i = 0; i < 6; i += 1) {
      positions.push(2, i * 3, 2);
      normals.push(1, 0, 0);
      const v = 0.2 + (i / 5) * 0.6; // 0.2 → 0.8 gradient
      colors.push(v, v, v);
    }
    // 3 roof verts (up normal, high Y), warm sandstone with noise.
    positions.push(3, 40, 3, 4, 40, 4, 5, 40, 5);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    colors.push(0.7, 0.6, 0.45, 0.75, 0.62, 0.44, 0.68, 0.58, 0.46);
    // 1 vegetation vert (green-dominant) — must stay soft (unchanged).
    positions.push(6, 1, 6);
    normals.push(0, 1, 0);
    colors.push(0.15, 0.5, 0.12);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
  };

  const channelStd = (
    attr: { getX: (i: number) => number },
    indices: number[],
  ): number => {
    const values = indices.map((i) => attr.getX(i));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
    return Math.sqrt(variance);
  };

  test("a single wall face becomes one flat colour (zero gradient)", () => {
    const geometry = buildGeometry();
    expect(flattenBuildingVertexColors(geometry, 16)).toBe(true);
    const color = geometry.getAttribute("color");
    const wall = [0, 1, 2, 3, 4, 5];
    // Every wall vertex now shares one flat tone: σ ≈ 0 within the face.
    expect(channelStd(color, wall) * 255).toBeLessThan(1);
  });

  test("roof and wall in the same cell get distinct flat tones", () => {
    const geometry = buildGeometry();
    flattenBuildingVertexColors(geometry, 16);
    const color = geometry.getAttribute("color");
    const wallColor = [color.getX(0), color.getY(0), color.getZ(0)];
    const roofColor = [color.getX(6), color.getY(6), color.getZ(6)];
    const delta =
      Math.abs(wallColor[0] - roofColor[0]) +
      Math.abs(wallColor[1] - roofColor[1]) +
      Math.abs(wallColor[2] - roofColor[2]);
    expect(delta).toBeGreaterThan(0.05);
  });

  test("vegetation vertices are left soft (unchanged)", () => {
    const geometry = buildGeometry();
    flattenBuildingVertexColors(geometry, 16);
    const color = geometry.getAttribute("color");
    // The green vegetation vertex (index 9) keeps its original colour.
    expect(color.getX(9)).toBeCloseTo(0.15, 5);
    expect(color.getY(9)).toBeCloseTo(0.5, 5);
    expect(color.getZ(9)).toBeCloseTo(0.12, 5);
  });

  test("setBuildingColorMode restores the exact original colours (lossless)", () => {
    const geometry = buildGeometry();
    flattenBuildingVertexColors(geometry, 16);
    setBuildingColorMode(geometry, false);
    const color = geometry.getAttribute("color");
    // Original wall gradient is back byte-for-byte.
    expect(color.getX(0)).toBeCloseTo(0.2, 5);
    expect(color.getX(5)).toBeCloseTo(0.8, 5);
    setBuildingColorMode(geometry, true);
    // Day mode restores the flat buffer again.
    expect(channelStd(geometry.getAttribute("color"), [0, 1, 2, 3, 4, 5]) * 255).toBeLessThan(1);
  });

  test("is idempotent and a no-op on colourless geometry", () => {
    const geometry = buildGeometry();
    expect(flattenBuildingVertexColors(geometry, 16)).toBe(true);
    // Second call returns true without rebuilding (guard).
    expect(flattenBuildingVertexColors(geometry, 16)).toBe(true);
    const bare = new BufferGeometry();
    bare.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0], 3),
    );
    expect(flattenBuildingVertexColors(bare, 16)).toBe(false);
  });
});
