import { HalfFloatType, REVISION, RGBAFormat, RGFormat, WebGLRenderTarget, type ShaderMaterial, type WebGLRenderer } from "three";
import type { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { SMAAEdgesShader } from "three/examples/jsm/shaders/SMAAShader.js";

type SmaaInternals = {
  _edgesRT?: WebGLRenderTarget;
  _materialEdges?: ShaderMaterial;
  _materialWeights?: { uniforms: { tDiffuse?: { value: unknown } } };
};

// The stock shader discards non-edges and expects its target to be cleared to
// black. The viewer's clear colour follows the sky, including underwater and
// at night. Write the mathematically empty mask explicitly for every such pixel.
const stockEdges = SMAAEdgesShader.fragmentShader;
const explicitEdges = stockEdges.replace("discard;", "return vec4( 0.0 );");

/** Configure before the first draw on a new or restored WebGL context. */
export function configureSmaaEdgeTarget(
  pass: SMAAPass,
  renderer: Pick<WebGLRenderer, "extensions">,
): boolean {
  if (REVISION !== "185" || explicitEdges === stockEdges) return false;
  const { _edgesRT: target, _materialEdges: material, _materialWeights } = pass as unknown as SmaaInternals;
  if (!(target instanceof WebGLRenderTarget) || target.depthBuffer || !material ||
      _materialWeights?.uniforms.tDiffuse?.value !== target.texture) return false;

  const { texture } = target;
  if (texture.type !== HalfFloatType || (texture.format !== RGBAFormat && texture.format !== RGFormat) ||
      (material.fragmentShader !== stockEdges && material.fragmentShader !== explicitEdges)) return false;

  if (material.fragmentShader !== explicitEdges) {
    material.fragmentShader = explicitEdges;
    material.needsUpdate = true;
  }
  // Keep half-float filtering: some mobile GL drivers interpolate normalized
  // bytes differently even though the stored binary samples are identical.
  const compact = renderer.extensions.has("EXT_color_buffer_float");
  texture.format = compact ? RGFormat : RGBAFormat;
  return compact;
}
