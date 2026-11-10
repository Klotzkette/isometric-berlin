import { expect, test } from "bun:test";
import { HalfFloatType, RGBAFormat, RGFormat, type WebGLRenderer, type WebGLRenderTarget } from "three";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { configureSmaaEdgeTarget } from "../src/smaaEdgeTarget";

test("only the stock SMAA edges use RG16F and fall back after context restoration", () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class {} as typeof Image;
  try {
    const pass = new SMAAPass();
    const { _edgesRT: edges, _weightsRT: weights } = pass as unknown as {
      _edgesRT: WebGLRenderTarget; _weightsRT: WebGLRenderTarget;
    };
    const texture = edges.texture;
    const weightTexture = weights.texture;
    const minFilter = texture.minFilter, magFilter = texture.magFilter;
    let supported = false;
    const renderer = { extensions: { has: (name: string) => {
      expect(name).toBe("EXT_color_buffer_float");
      return supported;
    } } } as Pick<WebGLRenderer, "extensions">;

    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(false);
    expect(texture.format).toBe(RGBAFormat);
    supported = true;
    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(true);
    expect(texture.format).toBe(RGFormat);
    expect(texture.type).toBe(HalfFloatType);
    expect(texture.minFilter).toBe(minFilter);
    expect(texture.magFilter).toBe(magFilter);
    expect(edges.texture).toBe(texture);
    expect(weights.texture).toBe(weightTexture);
    expect(weightTexture.format).toBe(RGBAFormat);
    expect(weightTexture.type).toBe(HalfFloatType);
    supported = false;
    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(false);
    expect(texture.format).toBe(RGBAFormat);
    pass.dispose();
  } finally {
    globalThis.Image = originalImage;
  }
});
