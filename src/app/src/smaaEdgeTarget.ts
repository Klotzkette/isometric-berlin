import { HalfFloatType, REVISION, RGBAFormat, RGFormat, WebGLRenderTarget, type WebGLRenderer } from "three";
import type { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";

type SmaaInternals = {
  _edgesRT?: WebGLRenderTarget;
  _materialWeights?: { uniforms: { tDiffuse?: { value: unknown } } };
};

/** Configure before the first draw on a new or restored WebGL context. */
export function configureSmaaEdgeTarget(
  pass: SMAAPass,
  renderer: Pick<WebGLRenderer, "extensions">,
): boolean {
  // Three r185 writes only red and green edge values and reads only those two
  // channels in its weight shader. Keep the same 16-bit precision and filters.
  if (REVISION !== "185") return false;
  const internals = pass as unknown as SmaaInternals;
  const target = internals._edgesRT;
  if (!(target instanceof WebGLRenderTarget) || target.depthBuffer ||
      target.texture.type !== HalfFloatType ||
      (target.texture.format !== RGBAFormat && target.texture.format !== RGFormat) ||
      internals._materialWeights?.uniforms.tDiffuse?.value !== target.texture) return false;

  const compact = renderer.extensions.has("EXT_color_buffer_float");
  target.texture.format = compact ? RGFormat : RGBAFormat;
  return compact;
}
