/**
 * Central crispness profile for the settled post-process chain, next to
 * the day/night/minecraft lighting palettes. `strength` drives the
 * unsharp-mask, `edgeStrength` the screen-space "isometric edge" outline
 * (Roberts-cross on luminance in crisp.frag). Minecraft bypasses the
 * crisp pass entirely (strength 0): its `edgeStrength` feeds the
 * `edgeMix` uniform of the shared minecraft postprocess shader instead,
 * which draws the near-black block outline in both the 3D composer pass
 * and the 2D DZI post-processor.
 */
export type CrispnessProfile = {
  contrast: number;
  edgeStrength: number;
  saturation: number;
  strength: number;
};

export const CRISPNESS_PROFILES: Record<
  "day" | "night" | "minecraft",
  CrispnessProfile
> = {
  // Day reads as a light fine-line drawing: barely-there screen-space
  // edges (the geometry ink carries the contours), gentle sharpening.
  // Saturation and contrast are exactly neutral: with the film curve gone
  // (presentationTone.ts) the composited pixel equals the authored paint
  // tone, and a 1.08 chroma lift here would re-introduce the loud green
  // this round removed. The unsharp mask stays — it sharpens edges without
  // touching hue.
  day: { contrast: 1, edgeStrength: 0.07, saturation: 1, strength: 0.32 },
  night: {
    contrast: 1,
    edgeStrength: 0.35,
    saturation: 1,
    strength: 0.4,
  },
  minecraft: { contrast: 1, edgeStrength: 0.85, saturation: 1, strength: 0 },
};

/**
 * Distance window over which the Day/Night crisp pass fades out as the camera
 * pulls back. Below FULL the drawing is sharpened at the authored strength;
 * above NONE the pass is a pure passthrough.
 *
 * Why a zoom fade instead of a motion fade: a 1 px unsharp mask amplifies
 * whatever lands between pixels, so far out — where a screen pixel covers many
 * metres of ink work — it amplifies aliasing rather than line quality. Ramping
 * it with camera *motion* (as v0.38.0 did) meant every zoom step swapped
 * between a soft and a hard image, which reads as flicker. Zoom is a property
 * of the view, so the picture is now identical whether the camera moves or
 * stands still. The default view (948 m) sits inside the FULL band, so the
 * signed-off look at the standard framing is unchanged.
 */
export const CRISP_FULL_DISTANCE_M = 1050;
export const CRISP_NONE_DISTANCE_M = 2100;

export function crispZoomScale(distanceM: number): number {
  if (!Number.isFinite(distanceM)) {
    return 1;
  }
  if (distanceM <= CRISP_FULL_DISTANCE_M) {
    return 1;
  }
  if (distanceM >= CRISP_NONE_DISTANCE_M) {
    return 0;
  }
  const t =
    (distanceM - CRISP_FULL_DISTANCE_M) /
    (CRISP_NONE_DISTANCE_M - CRISP_FULL_DISTANCE_M);
  // Smoothstep, so neither end of the window has a gradient step.
  return 1 - t * t * (3 - 2 * t);
}
