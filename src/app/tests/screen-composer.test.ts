import { expect, test } from "bun:test";
import { Camera, Scene, Vector2, WebGLRenderTarget, type WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";

test("terminal SMAA consumes each fresh city image without alternating city framebuffers", () => {
  const oldImage = globalThis.Image;
  globalThis.Image = class {} as typeof Image;
  try {
    let target: WebGLRenderTarget | null = null;
    const scene = new Scene(), camera = new Camera();
    const cityTargets = new Set<WebGLRenderTarget>();
    const screenInputs: unknown[] = [];
    let freshCity: WebGLRenderTarget | null = null;
    const renderer = {
      autoClear: true, autoClearColor: true, autoClearDepth: true, autoClearStencil: true,
      getPixelRatio: () => 1,
      getSize: (v: Vector2) => v.set(390, 844),
      getRenderTarget: () => target,
      setRenderTarget: (next: WebGLRenderTarget | null) => { target = next; },
      clear: () => {},
      render: (object: Scene | {material: {uniforms: {tColor: {value: unknown}}}}) => {
        if (object === scene) { expect(target).not.toBeNull(); freshCity = target; cityTargets.add(target!); }
        else if (!target) {
          const material = (object as {material: {uniforms: {tColor: {value: unknown}}}}).material;
          expect(material.uniforms.tColor.value).toBe(freshCity!.texture);
          screenInputs.push(material.uniforms.tColor.value);
        }
      },
    };
    const composer = new EffectComposer(renderer as unknown as WebGLRenderer, new WebGLRenderTarget(1, 1));
    const smaa = new SMAAPass();
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(smaa);
    for (let i = 0; i < 3; i++) composer.render(1 / 60);
    expect(cityTargets.size).toBe(2);
    cityTargets.clear(); screenInputs.length = 0;
    smaa.needsSwap = false;
    composer.setSize(390 * 1.35, 844 * 1.35);
    for (let i = 0; i < 6; i++) composer.render(1 / 60);
    expect(cityTargets.size).toBe(1);
    expect(screenInputs).toHaveLength(6);
    expect(freshCity!.width).toBe(390 * 1.35);
    expect(freshCity!.height).toBe(844 * 1.35);
    smaa.dispose(); composer.dispose();
  } finally { globalThis.Image = oldImage; }
});
