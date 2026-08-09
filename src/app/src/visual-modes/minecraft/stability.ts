import type { VisualMode } from "../../visualMode";

export type MinecraftStabilityPolicy = {
  /**
   * Whether incidental flag motion may alter geometry while navigating.
   * Frozen in every mode: the flags keep one authored wind pose, so moving the
   * camera is the only changing transform and thin edges cannot flash.
   */
  animateWind: boolean;
  /**
   * Whether to force the composer to keep rendering every frame. Off in every
   * mode now: Minecraft used to pin continuous rendering, so the voxel pass
   * re-quantised the framebuffer forever even when nothing moved. A still
   * Minecraft view must settle to a single, calm frame instead.
   */
  forceContinuousRender: boolean;
  /**
   * Whether to keep the surface locked to the chunky interaction tier. On in
   * Minecraft so the detail tier never swaps when motion stops — that swap is
   * the visible "Zusammensetzen"/pop. Day and Night still settle to the
   * high-detail tier as before.
   */
  pinInteractionSurface: boolean;
};

export function minecraftStabilityPolicy(
  mode: VisualMode,
): MinecraftStabilityPolicy {
  const minecraft = mode === "minecraft";
  return {
    animateWind: false,
    forceContinuousRender: false,
    pinInteractionSurface: minecraft,
  };
}
