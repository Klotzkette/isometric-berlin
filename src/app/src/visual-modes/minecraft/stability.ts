import type { VisualMode } from "../../visualMode";

export type MinecraftStabilityPolicy = {
  /**
   * Whether per-frame wind/flag motion should keep animating. Frozen in
   * Minecraft: an animating source under the NEAREST screen-space voxel pass
   * re-quantises those pixels every frame, which is the "Flirren" the user
   * still saw. A frozen source lets a still camera resolve to one stable
   * frame.
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
    animateWind: !minecraft,
    forceContinuousRender: false,
    pinInteractionSurface: minecraft,
  };
}
