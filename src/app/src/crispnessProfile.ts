/**
 * Central post-process profile next to the day/night/minecraft lighting
 * palettes. Both screen-space gains are pinned to zero for the interactive
 * 3D viewer: authored world-space ink and block materials carry every edge
 * without sampling neighbouring pixels while the camera moves. The shader
 * remains a neutral colour/composer pass and a compatibility surface for the
 * static DZI tooling.
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
  // Day reads as a light fine-line drawing. Geometry ink carries the
  // contours; a second screen-space contour changed coverage whenever an
  // edge crossed a pixel during camera motion, so it is deliberately off.
  // Saturation and contrast are exactly neutral: with the film curve gone
  // (presentationTone.ts) the composited pixel equals the authored paint
  // tone, and a 1.08 chroma lift here would re-introduce the loud green
  // this round removed. The authored world-space ink is already crisp; any
  // neighbour-sampling sharpen term would amplify sub-pixel motion again.
  day: { contrast: 1, edgeStrength: 0, saturation: 1, strength: 0 },
  night: {
    contrast: 1,
    edgeStrength: 0,
    saturation: 1,
    strength: 0,
  },
  // Minecraft's block boundaries come from world-space geometry and toon
  // materials. A 0.85 screen-space outline was the strongest remaining
  // temporal aliasing source in that mode.
  minecraft: { contrast: 1, edgeStrength: 0, saturation: 1, strength: 0 },
};

/**
 * Compatibility distance window for the Day/Night composer profile. The
 * interactive gains are zero, so the pass is a pure passthrough at every
 * distance; keeping the pure scale function avoids changing the view contract
 * for static tooling that still consumes it.
 *
 * A motion-driven gain is explicitly forbidden: it made every zoom step swap
 * between soft and hard pixels. Any future non-zero static-export gain must be
 * a pure function of distance so equal camera poses always produce equal
 * pixels.
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
