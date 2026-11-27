import { expect, test } from "bun:test";
import { HalfFloatType, RGBAFormat, RGFormat, type ShaderMaterial, type WebGLRenderer, type WebGLRenderTarget } from "three";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { SMAAEdgesShader } from "three/examples/jsm/shaders/SMAAShader.js";
import { configureSmaaEdgeTarget } from "../src/smaaEdgeTarget";

test("the stock SMAA detector writes a sky-independent binary half-float mask, including after restore", () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class {} as typeof Image;
  try {
    const pass = new SMAAPass();
    const { _edgesRT: edges, _weightsRT: weights, _materialEdges: material } = pass as unknown as {
      _edgesRT: WebGLRenderTarget; _weightsRT: WebGLRenderTarget; _materialEdges: ShaderMaterial;
    };
    const texture = edges.texture;
    const weightTexture = weights.texture;
    const minFilter = texture.minFilter, magFilter = texture.magFilter;

    let compactSupported = true;
    const renderer = { extensions: { has: (name: string) => {
      expect(name).toBe("EXT_color_buffer_float");
      return compactSupported;
    } } } as Pick<WebGLRenderer, "extensions">;

    material.fragmentShader += "\n// custom detector";
    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(false);
    expect(texture.type).toBe(HalfFloatType);
    material.fragmentShader = SMAAEdgesShader.fragmentShader;

    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(true);
    const version = material.version;
    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(true);
    expect(material.version).toBe(version);
    expect(material.fragmentShader).not.toContain("discard;");
    expect(material.fragmentShader.replace("return vec4( 0.0 );", "discard;")).toBe(SMAAEdgesShader.fragmentShader);
    expect(texture.format).toBe(RGFormat);
    expect(texture.type).toBe(HalfFloatType);
    expect(texture.minFilter).toBe(minFilter);
    expect(texture.magFilter).toBe(magFilter);
    expect(edges.texture).toBe(texture);
    expect(weights.texture).toBe(weightTexture);
    expect(weightTexture.format).toBe(RGBAFormat);
    expect(weightTexture.type).toBe(HalfFloatType);
    compactSupported = false;
    expect(configureSmaaEdgeTarget(pass, renderer)).toBe(false);
    expect(texture.format).toBe(RGBAFormat);
    expect(texture.type).toBe(HalfFloatType);
    expect(material.fragmentShader).not.toContain("discard;");
    pass.dispose();
  } finally {
    globalThis.Image = originalImage;
  }
});
