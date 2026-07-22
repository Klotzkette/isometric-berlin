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
  day: { contrast: 1.03, edgeStrength: 0.07, saturation: 1.08, strength: 0.32 },
  night: {
    contrast: 1.035,
    edgeStrength: 0.35,
    saturation: 1.05,
    strength: 0.4,
  },
  minecraft: { contrast: 1, edgeStrength: 0.85, saturation: 1, strength: 0 },
};
